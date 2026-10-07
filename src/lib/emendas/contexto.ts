import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { NATUREZAS_EMENDAVEIS } from "@/lib/orcamento/codigo-dotacao";
import type { Aplicado, Catalogo, ConfigMotor, DestinoMotor, DotacaoBase, FontePreco, MetaPlanejamento, Regras } from "@/lib/riep";
import { nomeDoAlcance, pertence } from "@/lib/riep/destino";
import { situacaoEmendamento, type SituacaoEmendamento } from "./emendamento";

// ============================================================================
// Contexto do motor para um exercício: configuração, LOA elegível, catálogos,
// destinos e metas das peças. Tudo o que a tela de emenda precisa, lido do
// banco uma vez por requisição.
// ============================================================================

const num = (v: { toNumber(): number } | number | null | undefined) =>
  v == null ? null : typeof v === "number" ? v : v.toNumber();

export type DestinoTela = DestinoMotor & {
  // Grafias de beneficiários mesclados neste (a busca as encontra).
  apelidos: string[];
  unidadeNome: string | null;
  unidadeRepasse: string | null;
  telefone: string | null;
  email: string | null;
};

export type ContextoEmenda = {
  exercicioId: string;
  config: ConfigMotor;
  catalogo: Catalogo;
  // Base ativa do projeto de lei do exercício (só o que a emenda pode usar),
  // com o que as treze verificações conferem.
  loa: DotacaoBase[];
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
  // O emendamento está aberto agora? (exercício, projeto de lei e prazo)
  emendamento: SituacaoEmendamento;
  // O que as treze verificações leem do exercício, além da base.
  verificacao: DadosVerificacao;
};

export type DadosVerificacao = {
  // O PPA marcou ao menos um programa do exercício.
  ppaCadastrado: boolean;
  // Prioridades e metas da LDO: programas inteiros e pares "programa|ação".
  ldo: { cadastrada: boolean; programas: string[]; acoes: string[] };
  regras: Regras;
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
    apelidos?: string[];
  },
  unidades: Record<string, string>
): DestinoTela {
  return {
    id: d.id,
    nome: d.nome,
    execucao: d.execucao,
    apelidos: d.apelidos ?? [],
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

  // A emenda incide sobre o projeto de lei do exercício (o mesmo critério do
  // indicador de emendamento): a sugestão de dotação e a verificação (iv) usam
  // a mesma base.
  const projeto = await projetoBase(exercicioId);
  const [configuracao, unidadesDb, dotacoes, metasDb, areas, objetos, destinosDb, tiposDestino, fontesDb, prioridades, ppaMarcados, regras] = await Promise.all([
    lerConfiguracao(exercicioId),
    prisma.unidadeOrcamentaria.findMany({ where: { exercicioId }, orderBy: { codigo: "asc" } }),
    prisma.dotacao.findMany({
      where: { exercicioId, ativo: true, instrumentoId: projeto?.id ?? "-" },
      orderBy: { ordem: "asc" },
      include: {
        orgao: true,
        unidadeOrcamentaria: true,
        funcao: true,
        subfuncao: true,
        programa: true,
        acao: { include: { programa: { select: { codigo: true } } } },
        naturezaDespesa: true,
        fonteRecurso: true,
      },
    }),
    prisma.metaAcao.findMany({ where: { exercicioId }, include: { programa: { select: { codigo: true } }, acao: { select: { codigo: true } } } }),
    prisma.areaAplicacao.findMany({ orderBy: { ordem: "asc" } }),
    prisma.objetoBiblioteca.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, include: { area: true } }),
    prisma.destino.findMany({ where: { ativo: true }, orderBy: [{ execucao: "asc" }, { nome: "asc" }] }),
    prisma.tipoDestino.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
    lerFontesPreco(),
    prisma.prioridadeLdo.findMany({ where: { exercicioId }, select: { programa: { select: { codigo: true } }, acao: { select: { codigo: true } } } }),
    prisma.programa.count({ where: { exercicioId, constaNoPPA: true } }),
    lerRegras(exercicioId),
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

  const loa: DotacaoBase[] = elegiveis.map((d) => ({
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
    orgao: d.orgao.codigo,
    acaoCodigo: d.acao.codigo,
    acaoPrograma: d.acao.programa.codigo,
    natureza: d.naturezaDespesa.codigo,
    constaNoPPA: d.programa.constaNoPPA,
    // As relações da dotação são obrigatórias no banco: os oito componentes
    // estão sempre presentes.
    completa: true,
  }));

  // Prioridades e metas da LDO importadas em Planejamento; sem elas, as metas
  // das ações carregadas das peças fazem as vezes do anexo.
  const ldo = prioridades.length
    ? {
        cadastrada: true,
        programas: [...new Set(prioridades.filter((p) => !p.acao).map((p) => p.programa.codigo))],
        acoes: [...new Set(prioridades.filter((p) => p.acao).map((p) => `${p.programa.codigo}|${p.acao!.codigo}`))],
      }
    : { cadastrada: metasDb.length > 0, programas: [], acoes: [...new Set(metasDb.map((m) => `${m.programa.codigo}|${m.acao.codigo}`))] };

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
    emendamento: situacaoEmendamento({
      ano,
      exercicioStatus: exercicio.status,
      projeto,
      situacoesQueAdmitem: configuracao?.situacoesEmendamento ?? ["EM_TRAMITACAO"],
      prazoProtocolo,
      hoje: hojeBrasilia(),
    }),
    verificacao: { ppaCadastrado: ppaMarcados > 0, ldo, regras },
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
        status: { in: ["SUBMETIDA", "EM_TRAMITACAO", "EM_DILIGENCIA", "APROVADA"] },
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

// Situação do emendamento de um exercício, sem carregar a base inteira.
export const lerEmendamento = cache(async (ano: number): Promise<SituacaoEmendamento | null> => {
  const ex = await prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true } });
  if (!ex) return null;
  const projeto = await projetoBase(ex.id);
  return situacaoEmendamento({
    ano,
    exercicioStatus: ex.status,
    projeto,
    situacoesQueAdmitem: ex.configuracao?.situacoesEmendamento ?? ["EM_TRAMITACAO"],
    prazoProtocolo: ex.configuracao?.prazoProtocolo ? diaBrasilia(ex.configuracao.prazoProtocolo) : null,
    hoje: hojeBrasilia(),
  });
});

// O projeto de lei orçamentária do exercício que recebe as emendas: o primeiro
// cadastrado com base de dotações. O mesmo critério na emenda, no indicador de
// emendamento e no comparativo.
export async function projetoBase(exercicioId: string) {
  return prisma.instrumentoPlanejamento.findFirst({
    where: { exercicioId, tipo: "LOA", especie: "PROJETO_LEI", dotacoes: { some: {} } },
    orderBy: { createdAt: "asc" },
    select: { id: true, numero: true, status: true },
  });
}

// Regras de validação do exercício: a do exercício prevalece sobre a geral. O
// fundamento é o escrito na regra ou, na falta, a norma citada.
export async function lerRegras(exercicioId: string): Promise<Regras> {
  const linhas = await prisma.regraValidacao.findMany({
    where: { OR: [{ exercicioId: null }, { exercicioId }] },
    include: { norma: { select: { titulo: true, artigo: true } } },
  });
  const regras: Regras = {};
  for (const r of linhas.sort((a, b) => (a.exercicioId ? 1 : 0) - (b.exercicioId ? 1 : 0))) {
    const norma = r.norma ? `${r.norma.titulo}${r.norma.artigo ? `, ${r.norma.artigo}` : ""}` : null;
    regras[r.codigo] = { modo: r.modo, ativa: r.ativa, fundamento: r.fundamento || norma };
  }
  return regras;
}
