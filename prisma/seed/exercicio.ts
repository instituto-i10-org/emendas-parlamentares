import type { PrismaClient } from "../../src/generated/prisma/client";
import type { StatusInstrumento, TipoNorma } from "../../src/generated/prisma/enums";
import { data, lerDados } from "./dados";

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
};

// Exercícios com dados em prisma/dados/mogi-guacu/ (exercicio-<ano>.json,
// loa-<ano>.json e unidades-<ano>.json).
export const ANOS_COM_DADOS = [2026, 2027] as const;

export const lerExercicio = (ano: number) => lerDados<ExercicioJson>(`exercicio-${ano}.json`);

function tipoNorma(titulo: string): TipoNorma {
  if (/lei orgânica/i.test(titulo) && !/proposta/i.test(titulo)) return "LOM";
  if (/^lei n/i.test(titulo)) return "LEI";
  return "OUTRO";
}

export async function semearExercicio(prisma: PrismaClient, ano: number) {
  const ex = lerExercicio(ano);

  if (!(await prisma.municipio.findFirst())) {
    await prisma.municipio.create({
      data: {
        nome: "Mogi Guaçu",
        uf: "SP",
        codigoIbge: "3530706",
        nomeCamara: "Câmara Municipal de Mogi Guaçu",
        nomePrefeitura: "Prefeitura Municipal de Mogi Guaçu",
      },
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
    codigoAplicacao: ex.applicationCode,
    formatoVariacao: 4,
    variacaoOcupaFonte: false,
    // IC-EP vigora a partir de 2027 (art. 2º da Portaria STN/MF 636/2026).
    icEpVigente: ex.icEp !== null,
    icEpCodigo: ex.icEp,
    orgaosForaDasEmendas: ex.excludedOrgans,
    rotuloBase: ex.baseLabel,
  };
  await prisma.configuracaoExercicio.upsert({
    where: { exercicioId: exercicio.id },
    update: configuracao,
    create: { ...configuracao, exercicioId: exercicio.id },
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
