import "server-only";
import { prisma } from "@/lib/prisma";
import { relatorioTramitacao } from "./relatorio-tramitacao";

// Período do relatório (padrão: do dia 1º do mês até hoje, em Brasília) e os
// números por situação, por autor e por movimentação. Usado na tela e na
// página de impressão.
export function periodoDoRelatorio(f: { de?: string | null; ate?: string | null }) {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const de = f.de ?? `${hoje.slice(0, 8)}01`;
  const ate = f.ate ?? hoje;
  return { de, ate, inicio: new Date(`${de}T00:00:00-03:00`), fim: new Date(`${ate}T23:59:59-03:00`) };
}

export async function dadosRelatorioTramitacao(ano: number, inicio: Date, fim: Date) {
  const [passagens, emendas] = await Promise.all([
    prisma.historicoEmenda.findMany({
      where: { criadoEm: { gte: inicio, lte: fim }, emenda: { exercicio: { ano } } },
      select: { emendaId: true, de: true, para: true, criadoEm: true },
    }),
    prisma.emenda.findMany({ where: { exercicio: { ano } }, select: { id: true, numero: true, objeto: true, valor: true, autor: { select: { nome: true } } } }),
  ]);
  return relatorioTramitacao(
    passagens,
    new Map(emendas.map((e) => [e.id, { id: e.id, numero: e.numero, autor: e.autor.nome, objeto: e.objeto, valor: e.valor.toNumber() }])),
    inicio,
    fim
  );
}
