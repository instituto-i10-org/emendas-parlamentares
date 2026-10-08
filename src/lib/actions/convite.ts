"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { registrarAuditoria } from "@/lib/audit";
import { podeGerirEmenda } from "@/lib/authz";
import { lerFontesPreco } from "@/lib/emendas/contexto";
import {
  MENSAGEM_CONVITE,
  errosPlanoEntidade,
  planoEntidadeParaEstado,
  planoEntidadeSchema,
  situacaoConvite,
  validadeConvite,
  type PlanoEntidade,
  type SituacaoConvite,
} from "@/lib/emendas/convite";
import type { EstadoEmenda } from "@/lib/emendas/estado";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { naoRemetida } from "@/lib/emendas/situacoes";

type Falha = { ok: false; erro: string };

// O código vai no link e nunca é guardado: no banco fica só o resumo SHA-256.
const resumo = (codigo: string) => createHash("sha256").update(codigo).digest("hex");
const codigoValido = (codigo: unknown): codigo is string => typeof codigo === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(codigo);

async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "desconhecido").trim().slice(0, 64);
}

export type ConviteTela = {
  id: string;
  criadoEm: string;
  expiraEm: string;
  situacao: SituacaoConvite;
  usadoEm: string | null;
  responsavel: string | null;
  aplicadoEm: string | null;
  conteudo: PlanoEntidade | null;
};

// ------------------------------------------------------------ lado do gabinete

async function emendaDoGabinete(emendaId: string) {
  const user = await getCurrentUser();
  const emenda = await prisma.emenda.findUnique({
    where: { id: emendaId },
    include: { autor: true, exercicio: { include: { configuracao: true } } },
  });
  if (!emenda || !podeGerirEmenda(user, { autorUsuarioId: emenda.autor.usuarioId })) return { user, emenda: null };
  return { user, emenda };
}

export async function listarConvites(emendaId: string): Promise<{ ok: true; convites: ConviteTela[] } | Falha> {
  const { emenda } = await emendaDoGabinete(emendaId);
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  const convites = await prisma.conviteEntidade.findMany({ where: { emendaId }, orderBy: { criadoEm: "desc" }, take: 20 });
  return {
    ok: true,
    convites: convites.map((c) => ({
      id: c.id,
      criadoEm: c.criadoEm.toISOString(),
      expiraEm: c.expiraEm.toISOString(),
      situacao: situacaoConvite(c, emenda.status),
      usadoEm: c.usadoEm?.toISOString() ?? null,
      responsavel: c.responsavelNome ? `${c.responsavelNome}${c.responsavelCargo ? ` (${c.responsavelCargo})` : ""}` : null,
      aplicadoEm: c.aplicadoEm?.toISOString() ?? null,
      conteudo: (c.conteudo as PlanoEntidade | null) ?? null,
    })),
  };
}

// Um link válido por vez: gerar outro cancela o anterior que ainda não foi usado.
export async function gerarConvite(emendaId: string): Promise<{ ok: true; codigo: string; expiraEm: string } | Falha> {
  const { user, emenda } = await emendaDoGabinete(emendaId);
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (!naoRemetida(emenda.status)) return { ok: false, erro: "Só emenda em rascunho recebe link para a entidade." };
  if (emenda.execucao !== "INDIRETA") return { ok: false, erro: "O link é para entidade do terceiro setor (execução indireta)." };
  if (!(await rateLimit(`convite-gerar:${user.id}`, 10, 60_000))) return { ok: false, erro: "Muitos links gerados seguidos. Aguarde um minuto." };

  const codigo = randomBytes(32).toString("base64url");
  const dias = emenda.exercicio.configuracao?.validadeLinkEntidadeDias ?? 10;
  const expiraEm = validadeConvite(dias);
  const agora = new Date();
  const criado = await prisma.$transaction(async (tx) => {
    await tx.conviteEntidade.updateMany({
      where: { emendaId, usadoEm: null, revogadoEm: null },
      data: { revogadoEm: agora, revogadoPorId: user.id },
    });
    return tx.conviteEntidade.create({ data: { emendaId, codigoHash: resumo(codigo), expiraEm, criadoPorId: user.id } });
  });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "ConviteEntidade",
    entidadeId: criado.id,
    acao: "GERAR_LINK",
    dadosDepois: { emendaId, expiraEm: criado.expiraEm },
  });
  return { ok: true, codigo, expiraEm: criado.expiraEm.toISOString() };
}

export async function revogarConvite(conviteId: string): Promise<{ ok: true } | Falha> {
  const user = await getCurrentUser();
  const c = await prisma.conviteEntidade.findUnique({ where: { id: conviteId }, include: { emenda: { include: { autor: true } } } });
  if (!c || !podeGerirEmenda(user, { autorUsuarioId: c.emenda.autor.usuarioId })) return { ok: false, erro: "Link não encontrado." };
  if (c.usadoEm) return { ok: false, erro: "O link já foi usado pela entidade." };
  if (c.revogadoEm) return { ok: true };
  const depois = await prisma.conviteEntidade.update({ where: { id: c.id }, data: { revogadoEm: new Date(), revogadoPorId: user.id } });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "ConviteEntidade",
    entidadeId: c.id,
    acao: "REVOGAR_LINK",
    dadosAntes: { revogadoEm: null },
    dadosDepois: { revogadoEm: depois.revogadoEm },
  });
  return { ok: true };
}

// O gabinete traz para o rascunho o plano que a entidade enviou. O rascunho só
// muda de fato quando o gabinete salvar.
export async function aplicarPlanoEntidade(conviteId: string): Promise<{ ok: true; parcial: Partial<EstadoEmenda> } | Falha> {
  const user = await getCurrentUser();
  const c = await prisma.conviteEntidade.findUnique({ where: { id: conviteId }, include: { emenda: { include: { autor: true } } } });
  if (!c || !podeGerirEmenda(user, { autorUsuarioId: c.emenda.autor.usuarioId })) return { ok: false, erro: "Envio não encontrado." };
  if (!c.usadoEm || !c.conteudo) return { ok: false, erro: "A entidade ainda não enviou o plano por este link." };
  if (!naoRemetida(c.emenda.status)) return { ok: false, erro: "A emenda já foi remetida." };
  const p = planoEntidadeSchema.safeParse(c.conteudo);
  if (!p.success) return { ok: false, erro: "O envio da entidade está ilegível." };
  const parcial = planoEntidadeParaEstado(p.data, await lerFontesPreco());
  await prisma.conviteEntidade.update({ where: { id: c.id }, data: { aplicadoEm: new Date(), aplicadoPorId: user.id } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "ConviteEntidade", entidadeId: c.id, acao: "APLICAR_PLANO_ENTIDADE" });
  return { ok: true, parcial };
}

// ------------------------------------------------------------ lado da entidade

export type ConvitePublico =
  | { ok: false; erro: string }
  | {
      ok: true;
      emenda: {
        objeto: string;
        destino: string;
        autor: string;
        exercicio: number;
        valorPretendido: number | null;
        // Tolerância planilha × valor da emenda, do exercício.
        tolerancia: number;
        modelo: string | null;
        etapasSugeridas: string;
      };
      expiraEm: string;
    };

// Usado pela página pública: diz se o link vale e o que a entidade precisa saber.
export async function abrirConvite(codigo: string): Promise<ConvitePublico> {
  const ip = await ipDaRequisicao();
  if (!(await rateLimit(`convite-abrir:${ip}`, 60, 60_000))) return { ok: false, erro: "Muitas tentativas seguidas. Aguarde um minuto." };
  const c = codigoValido(codigo)
    ? await prisma.conviteEntidade.findUnique({
        where: { codigoHash: resumo(codigo) },
        include: { emenda: { include: { autor: true, destino: true, exercicio: { include: { configuracao: true } } } } },
      })
    : null;
  if (!c) {
    // Código errado: conta como tentativa suspeita.
    if (!(await rateLimit(`convite-erro:${ip}`, 20, 600_000))) return { ok: false, erro: "Muitos links inválidos seguidos. Aguarde alguns minutos." };
    return { ok: false, erro: "Link inválido. Confira o endereço que o gabinete enviou." };
  }
  const s = situacaoConvite(c, c.emenda.status);
  if (s !== "VALIDO") return { ok: false, erro: MENSAGEM_CONVITE[s] };
  return {
    ok: true,
    emenda: {
      objeto: c.emenda.objeto,
      destino: c.emenda.destino?.nome ?? "",
      autor: c.emenda.autor.nome,
      exercicio: c.emenda.exercicio.ano,
      valorPretendido: c.emenda.valorPretendido?.toNumber() ?? null,
      tolerancia: c.emenda.exercicio.configuracao?.toleranciaValorPct.toNumber() ?? 10,
      modelo: c.emenda.modelo,
      etapasSugeridas: c.emenda.etapas,
    },
    expiraEm: c.expiraEm.toISOString(),
  };
}

// Envio único: na mesma transação confere que o link ainda vale e o marca usado.
export async function enviarPlanoEntidade(codigo: string, entrada: PlanoEntidade): Promise<{ ok: true } | Falha> {
  const ip = await ipDaRequisicao();
  if (!(await rateLimit(`convite-enviar:${ip}`, 10, 60_000))) return { ok: false, erro: "Muitos envios seguidos. Aguarde um minuto." };
  if (!codigoValido(codigo)) return { ok: false, erro: "Link inválido." };
  const p = planoEntidadeSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const fontes = await lerFontesPreco();
  const erros = errosPlanoEntidade(p.data, fontes);
  if (erros.length) return { ok: false, erro: erros[0] };

  const resultado = await prisma.$transaction(async (tx) => {
    const c = await tx.conviteEntidade.findUnique({ where: { codigoHash: resumo(codigo) }, include: { emenda: true } });
    if (!c) return { ok: false as const, erro: "Link inválido." };
    const s = situacaoConvite(c, c.emenda.status);
    if (s !== "VALIDO") return { ok: false as const, erro: MENSAGEM_CONVITE[s] };
    // Só marca se ninguém marcou antes (dois envios ao mesmo tempo).
    const marcados = await tx.conviteEntidade.updateMany({
      where: { id: c.id, usadoEm: null, revogadoEm: null },
      data: {
        usadoEm: new Date(),
        responsavelNome: p.data.responsavelNome,
        responsavelCargo: p.data.responsavelCargo,
        enviadoDeIp: ip,
        conteudo: p.data,
      },
    });
    if (!marcados.count) return { ok: false as const, erro: MENSAGEM_CONVITE.USADO };
    return { ok: true as const, id: c.id, emendaId: c.emendaId };
  });
  if (!resultado.ok) return resultado;
  await registrarAuditoria({
    usuarioId: null,
    entidade: "ConviteEntidade",
    entidadeId: resultado.id,
    acao: "PLANO_ENVIADO_PELA_ENTIDADE",
    dadosDepois: { emendaId: resultado.emendaId, responsavel: p.data.responsavelNome, cargo: p.data.responsavelCargo, ip },
  });
  return { ok: true };
}
