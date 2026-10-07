"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { lerBuffer } from "@/lib/arquivos/armazenamento";
import { auditar } from "@/lib/audit";
import { podeGerirPlanejamento } from "@/lib/authz";
import { CAMPOS, cargaDoInstrumento, faltandoNoMapa, mapearCabecalho, type TipoCarga } from "@/lib/orcamento/colunas";
import { conferirTotal, totalizar, validarDotacao } from "@/lib/orcamento/importacao";
import { camposDaLinhaIa, passo, progressoInicial, type Fonte, type Progresso } from "@/lib/orcamento/pdf/leitura";
import { amostra, contarPaginas, coberturaDeImagem, textoDasPaginas } from "@/lib/orcamento/pdf/texto";
import { lerPlanilha } from "@/lib/orcamento/planilha";
import {
  baseDoExercicio,
  existentesDoInstrumento,
  gravarDotacoes,
  gravarPrioridades,
  gravarProgramasPpa,
  linhasDaPlanilha,
  planejarRecarga,
  revalidar,
  validarCampos,
} from "@/lib/orcamento/servidor";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

type Falha = { ok: false; erro: string };

async function gestor() {
  const user = await getCurrentUser();
  return podeGerirPlanejamento(user) ? user : null;
}

const caminho = (id: string) => `/executivo/planejamento/importacao/${id}`;

// ------------------------------------------------------------------ início

const inicioSchema = z.object({
  instrumentoId: z.string().min(1).max(40),
  arquivoId: z.string().min(1).max(40),
  paginaInicial: z.number().int().min(1).max(5000).nullable().optional(),
  paginaFinal: z.number().int().min(1).max(5000).nullable().optional(),
});

export async function iniciarImportacao(entrada: z.input<typeof inicioSchema>): Promise<{ ok: true; id: string } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão para importar a base." };
  if (!(await rateLimit(`importacao:${user.id}`, 10, 60_000))) return { ok: false, erro: "Muitas importações seguidas. Aguarde um minuto." };
  const p = inicioSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: "Dados inválidos." };
  const [inst, arquivo] = await Promise.all([
    prisma.instrumentoPlanejamento.findUnique({ where: { id: p.data.instrumentoId } }),
    prisma.arquivo.findUnique({ where: { id: p.data.arquivoId } }),
  ]);
  if (!inst) return { ok: false, erro: "Instrumento não encontrado." };
  if (!arquivo || arquivo.uso !== "IMPORTACAO") return { ok: false, erro: "Arquivo inválido. Envie de novo." };
  const faixa = p.data.paginaInicial && p.data.paginaFinal ? ([p.data.paginaInicial, p.data.paginaFinal] as [number, number]) : null;
  if (faixa && faixa[1] < faixa[0]) return { ok: false, erro: "A página final vem antes da inicial." };

  const tipoCarga = cargaDoInstrumento(inst.tipo);
  const ext = arquivo.nome.toLowerCase().split(".").pop() ?? "";
  const base = {
    instrumentoId: inst.id,
    arquivoId: arquivo.id,
    tipoCarga,
    criadoPorId: user.id,
    totalImpresso: inst.totalImpresso,
    paginaInicial: faixa?.[0] ?? null,
    paginaFinal: faixa?.[1] ?? null,
  };

  if (["csv", "xlsx", "xls", "txt"].includes(ext)) {
    const bytes = new Uint8Array(await lerBuffer(arquivo.chave));
    const planilha = lerPlanilha(tipoCarga, arquivo.nome, bytes);
    const { mapa, faltam } = mapearCabecalho(tipoCarga, planilha.cabecalho);
    const imp = await prisma.importacao.create({
      data: { ...base, formato: "PLANILHA", situacao: faltam.length ? "MAPEAR" : "LIDA", cabecalho: planilha.cabecalho, mapa },
    });
    if (!faltam.length) await lerLinhasDaPlanilha(imp.id, mapa);
    return { ok: true, id: imp.id };
  }

  if (tipoCarga !== "DOTACOES") return { ok: false, erro: "A carga da LDO e do PPA é por planilha (CSV ou XLSX). Baixe o modelo." };
  if (ext === "pdf") {
    const bytes = new Uint8Array(await lerBuffer(arquivo.chave));
    let paginas: number;
    try {
      paginas = await contarPaginas(bytes);
    } catch {
      return { ok: false, erro: "Não foi possível abrir o PDF. Confira se o arquivo não está protegido ou danificado." };
    }
    // Texto nativo só quando a página não é imagem: a digitalização com OCR tem
    // texto, mas não confiável; aí a leitura é pela imagem.
    const paginasAmostra = amostra(faixa?.[0] ?? 1, faixa?.[1] ?? paginas);
    const [textos, cobertura] = await Promise.all([
      Promise.all(paginasAmostra.map((n) => textoDasPaginas(bytes, n, n))).then((l) => l.flat()),
      coberturaDeImagem(bytes, paginasAmostra),
    ]);
    const digitalizada = cobertura.filter((c) => c > 0.8).length > cobertura.length / 2;
    const media = textos.reduce((s, x) => s + x.caracteres, 0) / Math.max(1, textos.length);
    const modo = !digitalizada && media > 200 ? "TEXTO" : "IMAGEM";
    const progresso = progressoInicial(modo, paginas, faixa);
    const imp = await prisma.importacao.create({
      data: { ...base, formato: modo === "TEXTO" ? "PDF_TEXTO" : "PDF_IMAGEM", situacao: "LENDO", paginas, progresso: progresso as never },
    });
    return { ok: true, id: imp.id };
  }
  // Foto da página.
  const imp = await prisma.importacao.create({
    data: { ...base, formato: "IMAGEM", situacao: "LENDO", paginas: 1, progresso: progressoInicial("IMAGEM", 1, null) as never },
  });
  return { ok: true, id: imp.id };
}

async function lerLinhasDaPlanilha(id: string, mapa: Record<string, number>) {
  const imp = await prisma.importacao.findUniqueOrThrow({ where: { id }, include: { arquivo: true, instrumento: true } });
  const base = await baseDoExercicio(imp.instrumento.exercicioId);
  const linhas = await linhasDaPlanilha({ id, tipoCarga: imp.tipoCarga, arquivo: imp.arquivo }, mapa, base);
  await prisma.$transaction([
    prisma.linhaImportada.deleteMany({ where: { importacaoId: id } }),
    prisma.linhaImportada.createMany({ data: linhas }),
    prisma.importacao.update({ where: { id }, data: { situacao: "LIDA", mapa } }),
  ]);
}

// Mapeamento de colunas feito na tela: campo → índice da coluna (-1 = sem coluna).
export async function salvarMapa(id: string, mapa: Record<string, number>): Promise<{ ok: true } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const imp = await prisma.importacao.findUnique({ where: { id } });
  if (!imp || imp.formato !== "PLANILHA" || imp.situacao === "GRAVADA") return { ok: false, erro: "Importação não encontrada." };
  const limpo = Object.fromEntries(Object.entries(mapa).filter(([campo, i]) => CAMPOS[imp.tipoCarga].some((c) => c.campo === campo) && Number.isInteger(i) && i >= 0 && i < imp.cabecalho.length));
  const faltam = faltandoNoMapa(imp.tipoCarga, limpo);
  if (faltam.length) return { ok: false, erro: `Ligue as colunas obrigatórias: ${faltam.join(", ")}.` };
  await lerLinhasDaPlanilha(id, limpo);
  revalidatePath(caminho(id));
  return { ok: true };
}

// ------------------------------------------------------------------ leitura

export type EstadoLeitura = { ok: true; situacao: string; mensagem: string; lidas: number; total: number; linhas: number } | Falha;

// Um passo da leitura do PDF ou da foto. A tela chama até a situação sair de LENDO.
export async function avancarLeitura(id: string): Promise<EstadoLeitura> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const imp = await prisma.importacao.findUnique({ where: { id }, include: { arquivo: true } });
  if (!imp) return { ok: false, erro: "Importação não encontrada." };
  if (imp.situacao !== "LENDO") return { ok: true, situacao: imp.situacao, mensagem: "", lidas: imp.paginasLidas, total: imp.paginas ?? 0, linhas: await prisma.linhaImportada.count({ where: { importacaoId: id } }) };
  const p = imp.progresso as unknown as Progresso;
  const bytes = new Uint8Array(await lerBuffer(imp.arquivo.chave));
  const fonte: Fonte = imp.formato === "IMAGEM" ? { tipo: "imagem", mime: imp.arquivo.tipo, bytes } : { tipo: "pdf", bytes };

  const atuais = (await prisma.linhaImportada.findMany({ where: { importacaoId: id } }))
    .map((l) => {
      const r = validarDotacao(l.campos as Record<string, string>);
      return r.ok ? { pagina: l.pagina ?? 0, unidade: r.valor.unidade.codigo, valor: r.valor.valor } : null;
    })
    .filter((x): x is { pagina: number; unidade: string; valor: number } => !!x);

  const r = await passo(fonte, p, atuais, user.id);
  if (r.erro) {
    await prisma.importacao.update({ where: { id }, data: { situacao: "ERRO", erro: r.erro, progresso: r.progresso as never } });
    return { ok: false, erro: r.erro };
  }
  const base = await baseDoExercicio((await prisma.instrumentoPlanejamento.findUniqueOrThrow({ where: { id: imp.instrumentoId } })).exercicioId);
  await prisma.$transaction(async (tx) => {
    if (r.substituirPaginas?.length) await tx.linhaImportada.deleteMany({ where: { importacaoId: id, pagina: { in: r.substituirPaginas }, incluida: false } });
    if (r.linhas?.length) {
      const ultimo = (await tx.linhaImportada.aggregate({ where: { importacaoId: id }, _max: { numero: true } }))._max.numero ?? 0;
      await tx.linhaImportada.createMany({
        data: r.linhas.map((l, i) => {
          const campos = camposDaLinhaIa(l);
          const v = validarCampos("DOTACOES", campos, base);
          return { importacaoId: id, numero: ultimo + i + 1, pagina: l.pagina, campos, motivos: v.ok ? [] : v.motivos };
        }),
      });
    }
    const pr = r.progresso;
    const concluida = pr.fase === "CONCLUIDA";
    const lidas = pr.lotes.slice(0, pr.loteAtual).reduce((s, [a, b]) => s + (b - a + 1), 0);
    await tx.importacao.update({
      where: { id },
      data: {
        progresso: pr as never,
        paginasLidas: lidas,
        situacao: concluida ? "LIDA" : "LENDO",
        // O total impresso lido no documento só entra se ninguém informou outro.
        ...(pr.totalGeral && !imp.totalImpresso ? { totalImpresso: pr.totalGeral } : {}),
      },
    });
  });
  if (r.progresso.fase === "CONCLUIDA") await marcarDivergencias(id);
  const n = await prisma.linhaImportada.count({ where: { importacaoId: id } });
  return { ok: true, situacao: r.progresso.fase === "CONCLUIDA" ? "LIDA" : "LENDO", mensagem: r.progresso.mensagem, lidas: r.progresso.lotes.slice(0, r.progresso.loteAtual).reduce((s, [a, b]) => s + (b - a + 1), 0), total: r.progresso.paginasQuadro.length || (imp.paginas ?? 0), linhas: n };
}

// Unidade cuja soma não bate com o total impresso, mesmo depois da releitura:
// as linhas dela ganham o aviso, com as páginas para conferir.
async function marcarDivergencias(id: string) {
  const imp = await prisma.importacao.findUniqueOrThrow({ where: { id } });
  const p = imp.progresso as unknown as Progresso | null;
  if (!p) return;
  const linhas = await prisma.linhaImportada.findMany({ where: { importacaoId: id } });
  const somas = new Map<string, { valor: number; ids: string[]; paginas: Set<number> }>();
  for (const l of linhas) {
    const r = validarDotacao(l.campos as Record<string, string>);
    if (!r.ok) continue;
    const s = somas.get(r.valor.unidade.codigo) ?? { valor: 0, ids: [], paginas: new Set() };
    s.valor += Math.round(r.valor.valor * 100);
    s.ids.push(l.id);
    if (l.pagina) s.paginas.add(l.pagina);
    somas.set(r.valor.unidade.codigo, s);
  }
  // Avisos na unidade executora (o nível mais fino impresso); o órgão e a
  // unidade orçamentária ficam na conferência do total geral.
  const impresso = new Map(p.totais.filter((t) => t.nivel === "UNIDADE_EXECUTORA" && t.codigo).map((t) => [t.codigo!, Math.round(t.valor * 100)]));
  for (const [codigo, v] of impresso) {
    const s = somas.get(codigo);
    if (!s || s.valor === v) continue;
    const aviso = `A soma da unidade ${codigo} (${(s.valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) não confere com o total impresso (${(v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}). Confira as páginas ${[...s.paginas].sort((a, b) => a - b).join(", ")}.`;
    await prisma.linhaImportada.updateMany({ where: { id: { in: s.ids } }, data: { avisos: [aviso] } });
  }
}

// ------------------------------------------------------------------ conferência

const camposSchema = z.record(z.string().max(60), z.string().max(500));

export async function corrigirLinha(id: string, linhaId: string, campos: Record<string, string>): Promise<{ ok: true; motivos: string[] } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const p = camposSchema.safeParse(campos);
  if (!p.success) return { ok: false, erro: "Dados inválidos." };
  const linha = await prisma.linhaImportada.findUnique({ where: { id: linhaId }, include: { importacao: { include: { instrumento: true } } } });
  if (!linha || linha.importacaoId !== id || linha.importacao.situacao !== "LIDA") return { ok: false, erro: "Linha não encontrada." };
  const base = await baseDoExercicio(linha.importacao.instrumento.exercicioId);
  const r = validarCampos(linha.importacao.tipoCarga, p.data, base);
  const motivos = r.ok ? [] : r.motivos;
  await prisma.$transaction(async (tx) => {
    await tx.linhaImportada.update({ where: { id: linhaId }, data: { campos: p.data, motivos, avisos: [], corrigidaPorId: user.id, corrigidaEm: new Date() } });
    await auditar(tx, { usuarioId: user.id, entidade: "LinhaImportada", entidadeId: linhaId, acao: "CORRIGIR", dadosAntes: linha.campos, dadosDepois: p.data });
  });
  revalidatePath(caminho(id));
  return { ok: true, motivos };
}

export async function incluirLinha(id: string, campos: Record<string, string>): Promise<{ ok: true; motivos: string[] } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const p = camposSchema.safeParse(campos);
  if (!p.success) return { ok: false, erro: "Dados inválidos." };
  const imp = await prisma.importacao.findUnique({ where: { id }, include: { instrumento: true } });
  if (!imp || imp.situacao !== "LIDA") return { ok: false, erro: "Importação não encontrada." };
  const base = await baseDoExercicio(imp.instrumento.exercicioId);
  const r = validarCampos(imp.tipoCarga, p.data, base);
  const motivos = r.ok ? [] : r.motivos;
  const ultimo = (await prisma.linhaImportada.aggregate({ where: { importacaoId: id }, _max: { numero: true } }))._max.numero ?? 0;
  await prisma.$transaction(async (tx) => {
    const l = await tx.linhaImportada.create({
      data: { importacaoId: id, numero: ultimo + 1, pagina: p.data.pagina ? Number(p.data.pagina) || null : null, campos: p.data, motivos, incluida: true, corrigidaPorId: user.id, corrigidaEm: new Date() },
    });
    await auditar(tx, { usuarioId: user.id, entidade: "LinhaImportada", entidadeId: l.id, acao: "INCLUIR", dadosDepois: p.data });
  });
  revalidatePath(caminho(id));
  return { ok: true, motivos };
}

export async function excluirLinha(id: string, linhaId: string): Promise<{ ok: true } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const linha = await prisma.linhaImportada.findUnique({ where: { id: linhaId }, include: { importacao: true } });
  if (!linha || linha.importacaoId !== id || linha.importacao.situacao !== "LIDA") return { ok: false, erro: "Linha não encontrada." };
  await prisma.$transaction(async (tx) => {
    await tx.linhaImportada.delete({ where: { id: linhaId } });
    await auditar(tx, { usuarioId: user.id, entidade: "LinhaImportada", entidadeId: linhaId, acao: "EXCLUIR", dadosAntes: linha.campos });
  });
  revalidatePath(caminho(id));
  return { ok: true };
}

export async function definirTotalImpresso(id: string, valor: number | null): Promise<{ ok: true } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) return { ok: false, erro: "Valor inválido." };
  const imp = await prisma.importacao.findUnique({ where: { id } });
  if (!imp || imp.situacao === "GRAVADA") return { ok: false, erro: "Importação não encontrada." };
  await prisma.$transaction(async (tx) => {
    await tx.importacao.update({ where: { id }, data: { totalImpresso: valor } });
    await auditar(tx, { usuarioId: user.id, entidade: "Importacao", entidadeId: id, acao: "TOTAL_IMPRESSO", dadosAntes: { totalImpresso: imp.totalImpresso }, dadosDepois: { totalImpresso: valor } });
  });
  revalidatePath(caminho(id));
  return { ok: true };
}

export async function cancelarImportacao(id: string): Promise<{ ok: true } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const imp = await prisma.importacao.findUnique({ where: { id } });
  if (!imp || imp.situacao === "GRAVADA") return { ok: false, erro: "Importação não encontrada." };
  await prisma.$transaction(async (tx) => {
    await tx.importacao.update({ where: { id }, data: { situacao: "CANCELADA" } });
    await auditar(tx, { usuarioId: user.id, entidade: "Importacao", entidadeId: id, acao: "CANCELAR", dadosAntes: { situacao: imp.situacao }, dadosDepois: { situacao: "CANCELADA" } });
  });
  revalidatePath("/executivo/planejamento");
  return { ok: true };
}

// Retoma a leitura parada por erro (falha passageira do serviço de IA).
export async function retomarLeitura(id: string): Promise<{ ok: true } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const imp = await prisma.importacao.findUnique({ where: { id } });
  if (!imp || imp.situacao !== "ERRO" || imp.formato === "PLANILHA") return { ok: false, erro: "Nada a retomar." };
  await prisma.$transaction(async (tx) => {
    await tx.importacao.update({ where: { id }, data: { situacao: "LENDO", erro: null } });
    await auditar(tx, { usuarioId: user.id, entidade: "Importacao", entidadeId: id, acao: "RETOMAR_LEITURA", dadosAntes: { situacao: imp.situacao, erro: imp.erro }, dadosDepois: { situacao: "LENDO" } });
  });
  return { ok: true };
}

// ------------------------------------------------------------------ resumo e confirmação

export type ResumoConferencia = {
  tipo: TipoCarga;
  validas: number;
  recusadas: number;
  totalLido: number;
  totalImpresso: number | null;
  bate: boolean;
  diferenca: number | null;
  porOrgao: { codigo: string; nome: string; valor: number; linhas: number }[];
  porUnidade: { codigo: string; nome: string; valor: number; linhas: number }[];
  recarga: { criar: number; atualizar: number; mudamValor: number; desativar: number; travas: string[] } | null;
  novos: { orgaos: number; unidades: number; programas: number; acoes: number };
  programasProvisorios: number;
  podeConfirmar: boolean;
  porQueNao: string | null;
};

export async function resumoConferencia(id: string): Promise<ResumoConferencia | null> {
  // Só quem gere o planejamento vê a conferência da importação.
  if (!(await gestor())) return null;
  const imp = await prisma.importacao.findUnique({ where: { id }, include: { instrumento: true } });
  if (!imp) return null;
  const base = await baseDoExercicio(imp.instrumento.exercicioId);
  const v = await revalidar(id, imp.tipoCarga, base);
  const totalImpresso = imp.totalImpresso?.toNumber() ?? null;
  if (imp.tipoCarga !== "DOTACOES") {
    const validas = v.prioridades.length + v.programas.length;
    return {
      tipo: imp.tipoCarga,
      validas,
      recusadas: v.recusadas,
      totalLido: 0,
      totalImpresso: null,
      bate: true,
      diferenca: null,
      porOrgao: [],
      porUnidade: [],
      recarga: null,
      novos: { orgaos: 0, unidades: 0, programas: 0, acoes: 0 },
      programasProvisorios: 0,
      podeConfirmar: validas > 0 && imp.situacao === "LIDA",
      porQueNao: validas ? null : "Nenhuma linha válida para gravar.",
    };
  }
  const linhas = v.dotacoes.map((d) => d.valor);
  const t = totalizar(linhas);
  const c = conferirTotal(t.totalLido, totalImpresso);
  const plano = planejarRecarga(await existentesDoInstrumento(imp.instrumentoId), linhas);
  const novos = {
    orgaos: new Set(linhas.map((l) => l.orgao.codigo).filter((x) => !base.orgaos[x])).size,
    unidades: new Set(linhas.map((l) => l.unidade.codigo).filter((x) => !base.unidades[x])).size,
    programas: new Set(linhas.map((l) => l.programa.codigo).filter((x) => !base.programas[x])).size,
    acoes: new Set(linhas.map((l) => `${l.programa.codigo}|${l.acao.codigo}`).filter((x) => !base.acoes[x])).size,
  };
  const porQueNao =
    imp.situacao !== "LIDA"
      ? "A leitura ainda não terminou."
      : !linhas.length
        ? "Nenhuma linha válida para gravar."
        : totalImpresso === null
          ? "Informe o valor total impresso na peça para conferir a soma."
          : !c.bate
            ? `A soma das linhas válidas difere do total impresso em ${c.diferenca!.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Corrija ou inclua as linhas que faltam.`
            : plano.travas.length
              ? "Há dotação com emenda que mudaria ou sairia da base."
              : null;
  return {
    tipo: "DOTACOES",
    validas: linhas.length,
    recusadas: v.recusadas,
    totalLido: t.totalLido,
    totalImpresso,
    bate: c.bate,
    diferenca: c.diferenca,
    porOrgao: t.porOrgao,
    porUnidade: t.porUnidade,
    recarga: {
      criar: plano.criar.length,
      atualizar: plano.atualizar.length,
      mudamValor: plano.atualizar.filter((a) => a.mudouValor).length,
      desativar: plano.desativar.length,
      travas: plano.travas.map((x) => x.motivo),
    },
    novos,
    programasProvisorios: new Set(linhas.filter((l) => /^Programa \d+$/.test(l.programa.nome)).map((l) => l.programa.codigo)).size,
    podeConfirmar: !porQueNao,
    porQueNao,
  };
}

export async function confirmarImportacao(id: string): Promise<{ ok: true; mensagem: string } | Falha> {
  const user = await gestor();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const imp = await prisma.importacao.findUnique({ where: { id }, include: { instrumento: true, arquivo: true } });
  if (!imp) return { ok: false, erro: "Importação não encontrada." };
  const resumo = await resumoConferencia(id);
  if (!resumo?.podeConfirmar) return { ok: false, erro: resumo?.porQueNao ?? "A importação não pode ser confirmada." };
  const exercicioId = imp.instrumento.exercicioId;
  const base = await baseDoExercicio(exercicioId);
  const v = await revalidar(id, imp.tipoCarga, base);
  let mensagem = "";
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      if (imp.tipoCarga === "DOTACOES") {
        const linhas = v.dotacoes.map((d) => d.valor);
        const plano = planejarRecarga(await existentesDoInstrumento(imp.instrumentoId), linhas);
        const antes = await tx.dotacao.aggregate({ where: { instrumentoId: imp.instrumentoId, ativo: true }, _sum: { valorAutorizado: true }, _count: true });
        await gravarDotacoes(tx, imp.instrumentoId, exercicioId, linhas, plano);
        mensagem = `${linhas.length} dotações gravadas (${plano.criar.length} novas, ${plano.atualizar.length} atualizadas, ${plano.desativar.length} desativadas).`;
        await auditar(tx, {
          usuarioId: user.id,
          entidade: "InstrumentoPlanejamento",
          entidadeId: imp.instrumentoId,
          acao: "IMPORTAR_BASE",
          dadosAntes: { dotacoes: antes._count, total: antes._sum.valorAutorizado },
          dadosDepois: { arquivo: imp.arquivo.nome, importacao: id, dotacoes: linhas.length, total: resumo.totalLido, criadas: plano.criar.length, atualizadas: plano.atualizar.length, desativadas: plano.desativar.length },
        });
      } else if (imp.tipoCarga === "PRIORIDADES_LDO") {
        await gravarPrioridades(tx, imp.instrumentoId, exercicioId, v.prioridades.map((p) => p.valor));
        mensagem = `${v.prioridades.length} prioridades da LDO gravadas.`;
        await auditar(tx, { usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: imp.instrumentoId, acao: "IMPORTAR_PRIORIDADES", dadosDepois: { arquivo: imp.arquivo.nome, prioridades: v.prioridades.length } });
      } else {
        const r = await gravarProgramasPpa(tx, exercicioId, v.programas.map((p) => p.valor), `Meta do ${imp.instrumento.numero}`);
        mensagem = `${r.programas} programas do PPA marcados; ${r.metas} metas gravadas.`;
        await auditar(tx, { usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: imp.instrumentoId, acao: "IMPORTAR_PPA", dadosDepois: { arquivo: imp.arquivo.nome, ...r } });
      }
      await tx.importacao.update({ where: { id }, data: { situacao: "GRAVADA", gravadaEm: new Date(), gravadaPorId: user.id, totalLido: resumo.totalLido, resumo: resumo as never } });
    },
    { timeout: 240_000, maxWait: 20_000 }
  );
  revalidatePath("/executivo/planejamento");
  revalidatePath(caminho(id));
  return { ok: true, mensagem };
}
