import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parcelaDaDotacao, type Parcela } from "@/lib/riep";
import { somasExecucao } from "./execucao";

// ============================================================================
// Leituras das emendas do exercício, compartilhadas por tramitação, Executivo,
// painéis e portal. A parcela (saúde/demais) é a gravada na submissão; se
// faltar, deriva do IC-CO da dotação — o mesmo critério do motor.
// ============================================================================

const incluir = {
  autor: true,
  destino: true,
  dotacao: { include: { acao: true, programa: true, unidadeOrcamentaria: true, funcao: true, subfuncao: true, naturezaDespesa: true } },
  pareceres: { orderBy: { criadoEm: "desc" }, take: 1, include: { usuario: { select: { name: true, email: true } } } },
  andamentos: { orderBy: [{ data: "desc" }, { criadoEm: "desc" }] },
  tramitadaPor: { select: { name: true, email: true } },
} satisfies Prisma.EmendaInclude;

export type EmendaLinha = Prisma.EmendaGetPayload<{ include: typeof incluir }> & {
  parcelaEfetiva: Parcela | null;
  somasExec: ReturnType<typeof somasExecucao>;
};

export async function listarEmendas(ano: number, onde: Prisma.EmendaWhereInput = {}): Promise<EmendaLinha[]> {
  const linhas = await prisma.emenda.findMany({
    where: { exercicio: { ano }, ...onde },
    include: incluir,
    orderBy: [{ numero: "asc" }, { updatedAt: "desc" }],
  });
  return linhas.map((x) => ({
    ...x,
    parcelaEfetiva:
      x.parcela ?? (x.dotacao ? parcelaDaDotacao({ funcao: x.dotacao.funcao.codigo, subf: x.dotacao.subfuncao.codigo }) : null),
    somasExec: somasExecucao(x.andamentos.map((a) => ({ etapa: a.etapa, valor: a.valor.toNumber() }))),
  }));
}

// ----------------------------------------------------------- consolidado

export type ResumoAutor = {
  autorId: string;
  nome: string;
  partido: string | null;
  itens: number;
  saude: number;
  demais: number;
  total: number;
  importadas: number;
};

export type Consolidado = {
  ano: number;
  cotaIndividual: number | null;
  percentualSaude: number;
  numeroVereadores: number;
  tetoGlobal: number | null;
  rclBase: number | null;
  percentualRcl: number | null;
  memoriaCota: string | null;
  porAutor: ResumoAutor[];
  saude: number;
  demais: number;
  total: number;
  porStatus: Record<string, { qtd: number; valor: number }>;
  porDestino: { nome: string; qtd: number; valor: number; saude: number }[];
};

// Cota por autor e totais do exercício. Conta as emendas submetidas,
// aprovadas e as importadas (apresentadas fora do sistema); rejeitadas e
// rascunhos não consomem cota. Importadas sem área dividem-se pela meação.
// `publico`: o que o portal e a página inicial mostram — sem a conta de
// demonstração, que é real dentro do sistema e invisível fora dele.
export const consolidar = cache(async (ano: number, publico = false): Promise<Consolidado | null> => {
  const exercicio = await prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true } });
  if (!exercicio) return null;
  const cfg = exercicio.configuracao;
  const pct = cfg?.percentualSaude.toNumber() ?? 50;
  const semDemonstracao = publico ? { autor: { demonstracao: false } } : {};
  const [emendas, importadas, autores] = await Promise.all([
    listarEmendas(ano, semDemonstracao),
    prisma.emendaImportada.findMany({ where: { exercicioId: exercicio.id, ...semDemonstracao } }),
    prisma.autor.findMany({ where: publico ? { demonstracao: false } : {}, orderBy: { nome: "asc" } }),
  ]);

  const porAutor = new Map<string, ResumoAutor>(
    autores.map((a) => [a.id, { autorId: a.id, nome: a.nome, partido: a.partido, itens: 0, saude: 0, demais: 0, total: 0, importadas: 0 }])
  );
  const porStatus: Consolidado["porStatus"] = {};
  const porDestino = new Map<string, { nome: string; qtd: number; valor: number; saude: number }>();
  const contam = (s: string) => s === "SUBMETIDA" || s === "EM_TRAMITACAO" || s === "EM_DILIGENCIA" || s === "APROVADA";

  for (const e of emendas) {
    const v = e.valor.toNumber();
    const st = (porStatus[e.status] ??= { qtd: 0, valor: 0 });
    st.qtd++;
    st.valor += v;
    if (!contam(e.status)) continue;
    const a = porAutor.get(e.autorId)!;
    a.itens++;
    a.total += v;
    if (e.parcelaEfetiva === "SAUDE") a.saude += v;
    else a.demais += v;
    const nome = e.destino?.nome ?? e.dotacao?.unidadeOrcamentaria.nome ?? "Destino a definir";
    const d = porDestino.get(nome) ?? { nome, qtd: 0, valor: 0, saude: 0 };
    d.qtd++;
    d.valor += v;
    if (e.parcelaEfetiva === "SAUDE") d.saude += v;
    porDestino.set(nome, d);
  }
  for (const i of importadas) {
    const v = i.valor.toNumber();
    const a = porAutor.get(i.autorId);
    if (!a) continue;
    a.itens++;
    a.importadas++;
    a.total += v;
    if (i.parcela === "SAUDE") a.saude += v;
    else if (i.parcela === "DEMAIS") a.demais += v;
    else {
      a.saude += (v * pct) / 100;
      a.demais += v - (v * pct) / 100;
    }
    const st = (porStatus.IMPORTADA ??= { qtd: 0, valor: 0 });
    st.qtd++;
    st.valor += v;
  }

  const lista = [...porAutor.values()].filter((a) => a.itens > 0 || autores.find((x) => x.id === a.autorId)?.usuarioId);
  const cota = cfg?.cotaIndividual?.toNumber() ?? null;
  const n = cfg?.numeroVereadores ?? lista.length;
  return {
    ano,
    cotaIndividual: cota,
    percentualSaude: pct,
    numeroVereadores: n,
    tetoGlobal: cota !== null ? cota * n : null,
    rclBase: cfg?.rclBase?.toNumber() ?? null,
    percentualRcl: cfg?.percentualRcl?.toNumber() ?? null,
    memoriaCota: cfg?.memoriaCota ?? null,
    porAutor: lista.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome)),
    saude: lista.reduce((s, a) => s + a.saude, 0),
    demais: lista.reduce((s, a) => s + a.demais, 0),
    total: lista.reduce((s, a) => s + a.total, 0),
    porStatus,
    porDestino: [...porDestino.values()].sort((a, b) => b.valor - a.valor),
  };
});

// Situação da cota de um autor.
export function situacaoCota(a: Pick<ResumoAutor, "saude" | "demais" | "total">, c: Pick<Consolidado, "cotaIndividual" | "percentualSaude">) {
  if (c.cotaIndividual === null) return { tom: "warn" as const, rotulo: "cota não parametrizada" };
  const tolerancia = 0.005;
  const parcelaSaude = (c.cotaIndividual * c.percentualSaude) / 100;
  const parcelaDemais = c.cotaIndividual - parcelaSaude;
  if (a.total - c.cotaIndividual > tolerancia) return { tom: "bad" as const, rotulo: "acima da cota" };
  if (a.demais - parcelaDemais > tolerancia) return { tom: "bad" as const, rotulo: "reserva da saúde invadida" };
  if (a.saude + (c.cotaIndividual - a.total) < parcelaSaude - tolerancia) return { tom: "warn" as const, rotulo: "mínimo em saúde em risco" };
  return { tom: "ok" as const, rotulo: a.total > 0 ? "conforme" : "sem emendas" };
}
