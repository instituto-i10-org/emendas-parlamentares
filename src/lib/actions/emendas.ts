"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/audit";
import { podeCriarEmenda, podeGerirEmenda } from "@/lib/authz";
import { aplicadoDoAutor, carregarContexto } from "@/lib/emendas/contexto";
import { chaveClassificacao, estadoSchema, lerNumero, paraValidacao, type EstadoEmenda } from "@/lib/emendas/estado";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  classificar,
  dotacaoDe,
  elementoDoInstrumento,
  eventoEfetivo,
  modeloDaDotacao,
  parcelaDaDotacao,
  podeAvancar,
  resumoValidacao,
  situacaoEfetiva,
  validar,
  type Checagem,
  type Classificacao,
  type Selecao,
} from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";

export type ResultadoGravacao =
  | { ok: true; id: string; revisao: number; numero: number | null; status: string }
  | { ok: false; erro: string; checks?: Checagem[] };

// ============================================================================
// Gravação da emenda. O servidor refaz a classificação a partir do banco e só
// aceita a escolha de dotação se ela estiver entre as opções do motor.
// ============================================================================

export async function salvarEmenda(entrada: EstadoEmenda, submeter = false): Promise<ResultadoGravacao> {
  const user = await getCurrentUser();
  const parsed = estadoSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos na emenda. Recarregue a página e tente de novo." };
  const e = parsed.data as EstadoEmenda;

  if (submeter && !rateLimit(`submeter:${user.id}`, 10, 60_000)) {
    return { ok: false, erro: "Muitas submissões seguidas. Aguarde um minuto." };
  }

  const ano = await getAnoAtivo();
  const ctx = ano ? await carregarContexto(ano) : null;
  if (!ctx) return { ok: false, erro: "Nenhum exercício ativo." };

  // Autoria e permissão.
  const existente = e.id
    ? await prisma.emenda.findUnique({ where: { id: e.id }, include: { autor: true } })
    : null;
  if (e.id && !existente) return { ok: false, erro: "Emenda não encontrada." };
  let autorId: string;
  if (existente) {
    if (!podeGerirEmenda(user, { autorUsuarioId: existente.autor.usuarioId })) {
      return { ok: false, erro: "Você não pode alterar esta emenda." };
    }
    if (existente.status !== "RASCUNHO") return { ok: false, erro: "Emenda já submetida não se altera por aqui." };
    if (existente.revisao !== e.revisao) {
      return { ok: false, erro: "Esta emenda foi alterada em outra aba. Reabra a versão salva antes de continuar." };
    }
    autorId = existente.autorId;
  } else {
    if (!podeCriarEmenda(user)) return { ok: false, erro: "Seu perfil não apresenta emendas." };
    const autor = await prisma.autor.findUnique({ where: { usuarioId: user.id } });
    if (!autor) return { ok: false, erro: "Sua conta não está vinculada a um autor (vereador)." };
    autorId = autor.id;
  }

  // Destino e classificação, refeitos aqui.
  const destino = e.destinoId ? ctx.destinos.find((d) => d.id === e.destinoId) ?? null : null;
  if (e.destinoId && (!destino || destino.execucao !== e.execucao)) {
    return { ok: false, erro: "O destino escolhido não vale para esta forma de execução." };
  }
  const pretendido = lerNumero(e.pretendido);
  let classificacao: Classificacao | null = null;
  if (destino && e.objeto.trim() && e.classificadoCom && e.classificadoCom === chaveClassificacao(e)) {
    classificacao = classificar({
      objeto: e.objeto,
      destino,
      execucao: e.execucao,
      pretendido,
      loa: ctx.loa,
      catalogo: ctx.catalogo,
    });
  }
  const selecao = selecaoValida(classificacao, e.selecao);
  const dotacao = dotacaoDe(classificacao, selecao);
  const situacao = situacaoEfetiva(classificacao, selecao);
  const modelo = modeloDaDotacao(dotacao);
  const valor = Math.round(e.itens.reduce((s, i) => s + lerNumero(i.quantidade) * lerNumero(i.valorUnitario), 0) * 100) / 100;

  let validacao: { checks: Checagem[]; bloqueios: number; alertas: number } | null = null;
  if (submeter) {
    if (!podeAvancar(classificacao, selecao)) {
      return { ok: false, erro: "A emenda precisa de classificação válida antes de ser submetida." };
    }
    const aplicado = await aplicadoDoAutor(ctx.exercicioId, autorId, ctx.config.percentualSaude, e.id);
    const checks = validar(
      paraValidacao(e, { classificacao, metaPlanejamento: dotacao ? ctx.metas[dotacao.id] ?? null : null }),
      { config: ctx.config, aplicado, biblioteca: ctx.catalogo.objetos }
    );
    const resumo = resumoValidacao(checks);
    if (!resumo.pode) {
      return { ok: false, erro: `A emenda tem ${resumo.bloqueios} bloqueio(s). Revise a validação.`, checks };
    }
    validacao = { checks, ...resumo };
  }

  const dados = {
    execucao: e.execucao,
    destinoId: destino?.id ?? null,
    objeto: e.objeto.trim(),
    quantidade: null,
    valorPretendido: pretendido > 0 ? pretendido : null,
    endereco: e.endereco.trim(),
    situacao: classificacao ? situacao : null,
    dotacaoId: dotacao && situacao === "OK" ? dotacao.id : null,
    escolhaDotacao: selecao.escolha,
    classificacao: classificacao ? fotografia(classificacao, selecao) : Prisma.DbNull,
    parcela: parcelaDaDotacao(dotacao),
    modelo,
    agenteExecutor: e.agenteExecutor.trim(),
    justificativa: e.justificativa.trim(),
    metaFinalistica: e.metaFinalistica.trim(),
    etapas: e.etapas.trim(),
    etapasEditadas: e.etapasEditadas,
    quadroViabilidade: e.quadro,
    instrumento: modelo === "TERCEIRO_SETOR" ? e.instrumento : null,
    instrumentoOutro: modelo === "TERCEIRO_SETOR" && e.instrumento === "OUTRO" ? e.instrumentoOutro.trim() : "",
    elementoOsc: modelo === "TERCEIRO_SETOR" ? elementoDoInstrumento(e.instrumento, dotacao?.gnd ?? "3") : null,
    evento: eventoEfetivo(dotacao, e.evento),
    valor,
    declaracaoVinculo: e.declaracao,
  };

  const salvo = await prisma.$transaction(async (tx) => {
    const emenda = existente
      ? await tx.emenda.update({ where: { id: existente.id }, data: { ...dados, revisao: { increment: 1 } } })
      : await tx.emenda.create({ data: { ...dados, exercicioId: ctx.exercicioId, autorId } });

    await tx.itemEmenda.deleteMany({ where: { emendaId: emenda.id } });
    await tx.referenciaPreco.deleteMany({ where: { emendaId: emenda.id } });
    await tx.metaEmenda.deleteMany({ where: { emendaId: emenda.id } });
    await tx.parcelaDesembolso.deleteMany({ where: { emendaId: emenda.id } });

    await tx.metaEmenda.createMany({
      data: e.metas
        .filter((m) => m.beneficiarios.trim() || m.unidade.trim() || lerNumero(m.quantidade))
        .map((m, ordem) => ({
          emendaId: emenda.id,
          ordem,
          beneficiarios: m.beneficiarios.trim(),
          unidade: m.unidade.trim(),
          quantidade: lerNumero(m.quantidade),
        })),
    });
    const refId = new Map<string, string>();
    for (const r of e.referencias) {
      const criada = await tx.referenciaPreco.create({
        data: {
          emendaId: emenda.id,
          codigo: r.codigo,
          tipo: r.tipo,
          campos: r.campos,
          emissor: r.emissor,
          data: r.data ? new Date(`${r.data}T12:00:00Z`) : null,
          dataTexto: r.dataTexto,
          unidade: r.unidade,
          valor: r.valor,
          objeto: r.objeto,
          porte: r.porte || null,
          link: r.link || null,
          observacao: r.observacao || null,
          procedencia: r.procedencia,
          aprovadoPor: r.aprovadoPor,
          aprovadoEm: r.aprovadoEm ? new Date(r.aprovadoEm) : null,
          origemExterna: r.origemExterna,
          consultadoEm: r.consultadoEm ? new Date(r.consultadoEm) : null,
        },
      });
      refId.set(r.codigo, criada.id);
    }
    await tx.itemEmenda.createMany({
      data: e.itens
        .filter((i) => i.descricao.trim() || lerNumero(i.valorUnitario))
        .map((i, ordem) => ({
          emendaId: emenda.id,
          ordem,
          descricao: i.descricao.trim(),
          quantidade: lerNumero(i.quantidade),
          valorUnitario: lerNumero(i.valorUnitario),
          referenciaId: i.referencia ? refId.get(i.referencia) ?? null : null,
        })),
    });
    await tx.parcelaDesembolso.createMany({
      data: e.parcelas
        .map(lerNumero)
        .filter((v) => v > 0)
        .map((valor, ordem) => ({ emendaId: emenda.id, ordem, valor })),
    });

    if (!validacao) return emenda;

    // Número atribuído na submissão, em transação: nunca por contagem.
    const contador = await tx.contadorEmenda.upsert({
      where: { exercicioId: ctx.exercicioId },
      update: { ultimo: { increment: 1 } },
      create: { exercicioId: ctx.exercicioId, ultimo: 1 },
    });
    await tx.validacaoEmenda.create({
      data: {
        emendaId: emenda.id,
        bloqueios: validacao.bloqueios,
        alertas: validacao.alertas,
        itens: validacao.checks,
      },
    });
    return tx.emenda.update({
      where: { id: emenda.id },
      data: { status: "SUBMETIDA", numero: contador.ultimo, submetidaEm: new Date() },
    });
  });

  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "Emenda",
    entidadeId: salvo.id,
    acao: submeter ? "SUBMETER" : existente ? "ATUALIZAR_RASCUNHO" : "CRIAR_RASCUNHO",
    dadosAntes: existente ? { status: existente.status, revisao: existente.revisao, valor: existente.valor } : undefined,
    dadosDepois: { status: salvo.status, revisao: salvo.revisao, valor: salvo.valor, numero: salvo.numero },
  });
  revalidatePath("/emendas");
  return { ok: true, id: salvo.id, revisao: salvo.revisao, numero: salvo.numero, status: salvo.status };
}

// A escolha do proponente só vale entre as opções; OK automático é do sistema.
function selecaoValida(c: Classificacao | null, s: Selecao): Selecao {
  if (!c) return { escolha: null, dotacaoId: null };
  if (c.situacao === "OK") return { escolha: "SISTEMA", dotacaoId: c.selecionada?.id ?? null };
  if (c.situacao !== "VALIDAR") return { escolha: null, dotacaoId: null };
  if (s.escolha === "PROPONENTE" && s.dotacaoId && c.opcoes.some((d) => d.id === s.dotacaoId)) return s;
  if (s.escolha === "ANALISE_TECNICA") return { escolha: "ANALISE_TECNICA", dotacaoId: null };
  return { escolha: null, dotacaoId: null };
}

// O que explica, depois, por que a dotação é esta.
function fotografia(c: Classificacao, s: Selecao) {
  const d = dotacaoDe(c, s);
  return {
    situacao: c.situacao,
    objeto: c.objeto,
    base: c.base,
    motivo: c.motivo,
    porQue: c.porQue,
    escolha: s.escolha,
    dotacao: d ? { codigo: d.codigo, nome: d.nome, uo: d.uo, natureza: `${d.gnd}.${d.gnd}.${d.mod}.${d.elem}` } : null,
    opcoes: c.opcoes.map((o) => o.codigo),
  } as Prisma.InputJsonValue;
}

export async function excluirRascunho(id: string): Promise<{ ok: boolean; erro?: string }> {
  const user = await getCurrentUser();
  const emenda = await prisma.emenda.findUnique({ where: { id }, include: { autor: true } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (!podeGerirEmenda(user, { autorUsuarioId: emenda.autor.usuarioId })) return { ok: false, erro: "Sem permissão." };
  if (emenda.status !== "RASCUNHO") return { ok: false, erro: "Só rascunhos podem ser excluídos." };
  await prisma.emenda.delete({ where: { id } });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "Emenda",
    entidadeId: id,
    acao: "EXCLUIR_RASCUNHO",
    dadosAntes: { objeto: emenda.objeto, valor: emenda.valor },
  });
  revalidatePath("/emendas");
  return { ok: true };
}
