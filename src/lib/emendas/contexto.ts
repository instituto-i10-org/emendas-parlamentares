import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { NATUREZAS_EMENDAVEIS } from "@/lib/orcamento/codigo-dotacao";
import type { Aplicado, Catalogo, ConfigMotor, DestinoMotor, DotacaoMotor, FontePreco, MetaPlanejamento } from "@/lib/riep";
import { nomeDoAlcance, pertence } from "@/lib/riep/destino";

// ============================================================================
// Contexto do motor para um exercício: configuração, LOA elegível, catálogos,
// destinos e metas das peças. Tudo o que a tela de emenda precisa, lido do
// banco uma vez por requisição.
// ============================================================================

const num = (v: { toNumber(): number } | number | null | undefined) =>
  v == null ? null : typeof v === "number" ? v : v.toNumber();

export type DestinoTela = DestinoMotor & {
  unidadeNome: string | null;
  unidadeRepasse: string | null;
  telefone: string | null;
  email: string | null;
};

export type ContextoEmenda = {
  exercicioId: string;
  config: ConfigMotor;
  catalogo: Catalogo;
  loa: DotacaoMotor[];
  metas: Record<string, MetaPlanejamento>;
  destinos: DestinoTela[];
  // Unidades orçamentárias do exercício, para o cadastro de destino.
  unidades: { codigo: string; nome: string }[];
  // Fim do protocolo de emendas (aaaa-mm-dd), de Configurações; nulo = sem data.
  prazoProtocolo: string | null;
  // Verdadeiro quando o dia de hoje (horário de Brasília) já passou do prazo.
  prazoEncerrado: boolean;
  // Fontes oficiais de preço que a tela indica ao autor.
  fontesPreco: FontePreco[];
  // Dias de validade do link da entidade.
  validadeLinkEntidadeDias: number;
};

// Dia de hoje em Brasília, no formato aaaa-mm-dd — é assim que o prazo é guardado.
export const diaBrasilia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const hojeBrasilia = () => diaBrasilia(new Date());

export function paraConfigMotor(ano: number, c: Awaited<ReturnType<typeof lerConfiguracao>>): ConfigMotor {
  return {
    exercicio: ano,
    cotaIndividual: num(c?.cotaIndividual),
    percentualSaude: num(c?.percentualSaude) ?? 50,
    afericaoSaude: c?.afericaoSaude ?? "GLOBAL",
    toleranciaValorPct: num(c?.toleranciaValorPct) ?? 10,
    validadeReferenciaMeses: c?.validadeReferenciaMeses ?? 12,
    percentualAcessorio: num(c?.percentualAcessorio) ?? 20,
    fonteAudesp: c?.fonteAudesp ?? null,
    fonteAudespNome: c?.fonteAudespNome ?? null,
    codigoAplicacao: c?.codigoAplicacao ?? null,
    formatoVariacao: c?.formatoVariacao ?? 4,
    variacaoOcupaFonte: c?.variacaoOcupaFonte ?? false,
    icEpVigente: c?.icEpVigente ?? false,
    icEpCodigo: c?.icEpCodigo ?? null,
    rotuloBase: c?.rotuloBase ?? null,
    fontePrecoObrigatoria: c?.fontePrecoObrigatoria ?? true,
  };
}

function lerConfiguracao(exercicioId: string) {
  return prisma.configuracaoExercicio.findUnique({ where: { exercicioId } });
}

export function paraDestinoMotor(
  d: {
    id: string;
    nome: string;
    execucao: "DIRETA" | "INDIRETA";
    unidadeCodigo: string | null;
    unidadeRepasseCodigo: string | null;
    endereco: string;
    cnpj: string | null;
    responsavelNome: string | null;
    responsavelCargo: string | null;
    telefone: string | null;
    email: string | null;
    populacaoReferencia: number | null;
    fontePopulacao: string | null;
    dataPopulacao: string | null;
    origem: "BASE_OFICIAL" | "CADASTRO";
    pendenciaHabilitacao: string | null;
    subfuncaoSugerida?: string | null;
  },
  unidades: Record<string, string>
): DestinoTela {
  return {
    id: d.id,
    nome: d.nome,
    execucao: d.execucao,
    uo: d.execucao === "DIRETA" ? d.unidadeCodigo : null,
    endereco: d.endereco,
    cnpj: d.cnpj,
    responsavel: d.responsavelNome,
    cargo: d.responsavelCargo,
    populacao: d.populacaoReferencia,
    fontePopulacao: d.fontePopulacao,
    dataPopulacao: d.dataPopulacao,
    novo: d.origem === "CADASTRO",
    pendenciaHabilitacao: d.pendenciaHabilitacao,
    subfuncao: d.subfuncaoSugerida ?? null,
    unidadeNome: nomeDoAlcance(d.unidadeCodigo, unidades),
    unidadeRepasse: d.unidadeRepasseCodigo,
    telefone: d.telefone,
    email: d.email,
  };
}

export const carregarContexto = cache(async (ano: number): Promise<ContextoEmenda | null> => {
  const exercicio = await prisma.exercicio.findUnique({ where: { ano } });
  if (!exercicio) return null;
  const exercicioId = exercicio.id;

  const [configuracao, unidadesDb, dotacoes, metasDb, areas, objetos, destinosDb, tiposDestino, fontesDb] = await Promise.all([
    lerConfiguracao(exercicioId),
    prisma.unidadeOrcamentaria.findMany({ where: { exercicioId }, orderBy: { codigo: "asc" } }),
    prisma.dotacao.findMany({
      where: { exercicioId, ativo: true, instrumento: { especie: "PROJETO_LEI" } },
      orderBy: { ordem: "asc" },
      include: {
        orgao: true,
        unidadeOrcamentaria: true,
        funcao: true,
        subfuncao: true,
        programa: true,
        acao: true,
        naturezaDespesa: true,
        fonteRecurso: true,
      },
    }),
    prisma.metaAcao.findMany({ where: { exercicioId } }),
    prisma.areaAplicacao.findMany({ orderBy: { ordem: "asc" } }),
    prisma.objetoBiblioteca.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, include: { area: true } }),
    prisma.destino.findMany({ where: { ativo: true }, orderBy: [{ execucao: "asc" }, { nome: "asc" }] }),
    prisma.tipoDestino.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
    lerFontesPreco(),
  ]);

  const config = paraConfigMotor(ano, configuracao);
  // Guardado como 23:59:59 de Brasília; o dia é lido no mesmo fuso.
  const prazoProtocolo = configuracao?.prazoProtocolo ? diaBrasilia(configuracao.prazoProtocolo) : null;
  const unidades = Object.fromEntries(unidadesDb.map((u) => [u.codigo, u.nome]));
  // Órgãos fora das emendas (a Câmara, os encargos gerais): códigos de órgão ou
  // de unidade; a unidade que pertence a um deles fica de fora.
  const foraLista = configuracao?.orgaosForaDasEmendas ?? [];
  const foraDasEmendas = (uo: string) => foraLista.some((f) => pertence(uo, f));

  const elegiveis = dotacoes.filter(
    (d) =>
      NATUREZAS_EMENDAVEIS.has(`${d.naturezaDespesa.grupo}|${d.naturezaDespesa.modalidadeAplicacao}`) &&
      !foraDasEmendas(d.unidadeOrcamentaria.codigo)
  );

  const loa: DotacaoMotor[] = elegiveis.map((d) => ({
    id: d.id,
    codigo: d.codigo,
    ficha: d.ficha,
    nome: d.acao.nome,
    uo: d.unidadeOrcamentaria.codigo,
    funcao: d.funcao.codigo,
    subf: d.subfuncao.codigo,
    subfn: d.subfuncao.nome,
    prog: d.programa.codigo,
    progn: d.programa.nome,
    tipo: d.acao.tipo === "PROJETO" ? "P" : "A",
    gnd: d.naturezaDespesa.grupo,
    mod: d.naturezaDespesa.modalidadeAplicacao,
    elem: d.naturezaDespesa.elemento,
    fonte: d.fonteRecurso.codigo,
    fonten: d.fonteRecurso.nome,
    autorizado: d.valorAutorizado.toNumber(),
  }));

  // Meta da ação, por dotação.
  const metaPorChave = new Map(metasDb.map((m) => [`${m.unidadeId}|${m.programaId}|${m.acaoId}`, m]));
  const metas: Record<string, MetaPlanejamento> = {};
  for (const d of elegiveis) {
    const m = metaPorChave.get(`${d.unidadeOrcamentariaId}|${d.programaId}|${d.acaoId}`);
    if (!m) continue;
    metas[d.id] = {
      produto: m.produto,
      unidade: m.unidadeMedida,
      publico: m.publicoAlvo,
      quantidadePpa: num(m.quantidadePpa),
      quantidadeExercicio: num(m.quantidadeExercicio),
      beneficiarios: num(m.beneficiariosExercicio),
      notaLdo: m.notaLdo,
    };
  }

  const catalogo: Catalogo = {
    areas: areas.map((a) => ({ nome: a.nome, orgaos: a.orgaos, unidadePadrao: a.unidadePadrao })),
    objetos: objetos.map((o) => ({
      rotulo: o.rotulo,
      termos: o.termos,
      natureza: o.natureza,
      elemento: o.elemento,
      divisibilidade: o.divisibilidade,
      subfuncao: o.subfuncao,
      estrito: o.estrito,
      explicacao: o.explicacao,
      area: o.area?.nome ?? null,
      pistas: o.pistas,
    })),
    unidades,
    tiposDestino: tiposDestino.map((t) => ({ nome: t.nome, padrao: t.padrao, pistas: t.pistas, subfuncao: t.subfuncao })),
  };

  return {
    exercicioId,
    config,
    catalogo,
    loa,
    metas,
    destinos: destinosDb.map((d) => paraDestinoMotor(d, unidades)),
    unidades: unidadesDb
      .filter((u) => !foraDasEmendas(u.codigo))
      .map((u) => ({ codigo: u.codigo, nome: u.nome })),
    prazoProtocolo,
    prazoEncerrado: !!prazoProtocolo && hojeBrasilia() > prazoProtocolo,
    fontesPreco: fontesDb,
    validadeLinkEntidadeDias: configuracao?.validadeLinkEntidadeDias ?? 10,
  };
});

// Fontes oficiais de preço ativas, na ordem do cadastro.
export async function lerFontesPreco(): Promise<FontePreco[]> {
  const fontes = await prisma.fontePrecoOficial.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  return fontes.map((f) => ({ id: f.id, nome: f.nome, url: f.url, orientacao: f.orientacao, aplicaA: f.aplicaA, tipo: f.tipo }));
}

// Já apresentado pelo autor no exercício, sem contar a emenda em edição.
// Emendas importadas sem área identificada dividem-se pela meação legal.
export async function aplicadoDoAutor(
  exercicioId: string,
  autorId: string,
  percentualSaude: number,
  excetoEmendaId?: string | null
): Promise<Aplicado> {
  const [proprias, importadas] = await Promise.all([
    prisma.emenda.groupBy({
      by: ["parcela"],
      where: {
        exercicioId,
        autorId,
        // Em diligência a emenda continua apresentada: a cota segue reservada.
        status: { in: ["SUBMETIDA", "EM_DILIGENCIA", "APROVADA"] },
        ...(excetoEmendaId ? { id: { not: excetoEmendaId } } : {}),
      },
      _sum: { valor: true },
    }),
    prisma.emendaImportada.groupBy({
      by: ["parcela"],
      where: { exercicioId, autorId },
      _sum: { valor: true },
    }),
  ]);
  const aplicado = { saude: 0, demais: 0 };
  for (const g of [...proprias, ...importadas]) {
    const v = g._sum.valor?.toNumber() ?? 0;
    if (g.parcela === "SAUDE") aplicado.saude += v;
    else if (g.parcela === "DEMAIS") aplicado.demais += v;
    else {
      aplicado.saude += (v * percentualSaude) / 100;
      aplicado.demais += v - (v * percentualSaude) / 100;
    }
  }
  return { saude: Math.round(aplicado.saude * 100) / 100, demais: Math.round(aplicado.demais * 100) / 100 };
}
