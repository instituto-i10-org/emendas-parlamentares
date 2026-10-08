import type { PrismaClient } from "../../src/generated/prisma/client";
import type { StatusInstrumento, TipoNorma } from "../../src/generated/prisma/enums";
import { data, lerDados, lerMunicipio } from "./dados";

type InstrumentoJson = {
  number: string;
  summary: string;
  status: StatusInstrumento;
  sentAt?: string;
  approvedAt?: string;
  effectiveAt?: string;
};

export type ExercicioJson = {
  year: number;
  // Como a base aparece para quem elabora ("LOA 2026 (Lei 6.246/2025)").
  baseLabel: string;
  // O projeto de lei é a base das emendas; a lei só existe depois da sanção.
  instruments: { bill: InstrumentoJson; law: InstrumentoJson | null };
  // Órgãos cujo orçamento não recebe emenda.
  excludedOrgans: string[];
  // Procedência da meta física do exercício, impressa junto de cada meta.
  goalNote: string;
  audespSource: string;
  audespName: string;
  applicationCode: string;
  // Nulo enquanto o identificador não vigora no exercício.
  icEp: string | null;
  individualQuota: number;
  healthPercent: number;
  healthMeasurement: "global" | "individual";
  healthNote: string;
  referenceAgeMonths: number;
  quotaCalculation: string;
  rclPercent: number;
  rclBase: { year: number; value: number; note: string };
  councilors: number;
  legalBasis: { norm: string; article: string; excerpt: string; url: string | null }[];
  deadlines: { what: string; date: string; url: string | null }[];
  // Fundamento por extenso de cada parâmetro ({ cotaIndividual: "LOM art. …" }),
  // quando a pasta do município o traz com procedência.
  parameterBasis?: Record<string, string>;
  // Regras das treze verificações (modo e fundamento), quando o município as fixa.
  validationRules?: { code: string; mode: "BLOQUEANTE" | "ALERTA"; active?: boolean; basis: string }[];
  // Custo de referência do m² de construção (obras), com procedência.
  m2Reference?: { value: number; period: string; source: string; url: string };
};

// Exercícios com dados na pasta do município (exercicio-<ano>.json,
// loa-<ano>.json e unidades-<ano>.json).
export const anosComDados = () => lerMunicipio().anos;

export const lerExercicio = (ano: number) => lerDados<ExercicioJson>(`exercicio-${ano}.json`);

function tipoNorma(titulo: string): TipoNorma {
  if (/lei orgânica/i.test(titulo) && !/proposta/i.test(titulo)) return "LOM";
  if (/regimento interno/i.test(titulo)) return "REGIMENTO_INTERNO";
  if (/^lei n/i.test(titulo)) return "LEI";
  return "OUTRO";
}

export async function semearExercicio(prisma: PrismaClient, ano: number) {
  const ex = lerExercicio(ano);

  if (!(await prisma.municipio.findFirst())) {
    const m = lerMunicipio();
    await prisma.municipio.create({
      data: { nome: m.nome, uf: m.uf, codigoIbge: m.codigoIbge, nomeCamara: m.nomeCamara, nomePrefeitura: m.nomePrefeitura },
    });
  }

  const exercicio = await prisma.exercicio.upsert({
    where: { ano: ex.year },
    update: {},
    create: { ano: ex.year, status: "ABERTO" },
  });

  const configuracao = {
    cotaIndividual: ex.individualQuota,
    percentualRcl: ex.rclPercent,
    rclBase: ex.rclBase.value,
    rclAnoBase: ex.rclBase.year,
    rclObservacao: ex.rclBase.note,
    numeroVereadores: ex.councilors,
    memoriaCota: ex.quotaCalculation,
    percentualSaude: ex.healthPercent,
    afericaoSaude: ex.healthMeasurement === "global" ? ("GLOBAL" as const) : ("INDIVIDUAL" as const),
    observacaoSaude: ex.healthNote,
    toleranciaValorPct: 10,
    validadeReferenciaMeses: ex.referenceAgeMonths,
    percentualAcessorio: 20,
    fonteAudesp: ex.audespSource,
    fonteAudespNome: ex.audespName,
    codigoAplicacao: ex.applicationCode || null,
    formatoVariacao: 4,
    variacaoOcupaFonte: false,
    // IC-EP vigora a partir de 2027 (art. 2º da Portaria STN/MF 636/2026).
    icEpVigente: ex.icEp !== null,
    icEpCodigo: ex.icEp,
    orgaosForaDasEmendas: ex.excludedOrgans,
    rotuloBase: ex.baseLabel,
    ...(ex.m2Reference
      ? {
          custoM2Referencia: ex.m2Reference.value,
          custoM2Competencia: ex.m2Reference.period,
          custoM2Fonte: ex.m2Reference.source,
          custoM2Url: ex.m2Reference.url,
        }
      : {}),
  };
  // Fundamentos só quando a pasta os traz: os escritos pela tela ficam.
  const fundamentos = ex.parameterBasis ? Object.fromEntries(Object.entries(ex.parameterBasis).map(([k, texto]) => [k, { texto, normaId: null }])) : undefined;
  await prisma.configuracaoExercicio.upsert({
    where: { exercicioId: exercicio.id },
    update: { ...configuracao, ...(fundamentos ? { fundamentos } : {}) },
    create: { ...configuracao, ...(fundamentos ? { fundamentos } : {}), exercicioId: exercicio.id },
  });

  await prisma.prazoExercicio.deleteMany({ where: { exercicioId: exercicio.id } });
  await prisma.prazoExercicio.createMany({
    data: ex.deadlines.map((p) => ({
      exercicioId: exercicio.id,
      descricao: p.what,
      data: data(p.date),
      url: p.url,
    })),
  });

  for (const n of ex.legalBasis) {
    const existente = await prisma.documentoNormativo.findFirst({ where: { titulo: n.norm, artigo: n.article } });
    const dados = { tipo: tipoNorma(n.norm), titulo: n.norm, artigo: n.article, trecho: n.excerpt, url: n.url };
    if (existente) await prisma.documentoNormativo.update({ where: { id: existente.id }, data: dados });
    else await prisma.documentoNormativo.create({ data: dados });
  }

  return exercicio;
}

// Regras de validação do exercício vindas da pasta do município. Sem
// validationRules, nada é gravado: valem os padrões do sistema e o que a
// administração definir em Configurações › Validação.
export async function semearRegras(prisma: PrismaClient, exercicioId: string, ano: number) {
  const ex = lerExercicio(ano);
  for (const r of ex.validationRules ?? []) {
    const dados = { modo: r.mode, ativa: r.active ?? true, fundamento: r.basis };
    const existente = await prisma.regraValidacao.findFirst({ where: { codigo: r.code, exercicioId } });
    if (existente) await prisma.regraValidacao.update({ where: { id: existente.id }, data: dados });
    else await prisma.regraValidacao.create({ data: { ...dados, codigo: r.code, exercicioId } });
  }
  return ex.validationRules?.length ?? 0;
}
