import { respostaPlanilha } from "@/lib/exportacao";
import { podeVerTodasEmendas, temPermissao } from "@/lib/authz";
import { relatorioTramitacao } from "@/lib/emendas/relatorio-tramitacao";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { prisma } from "@/lib/prisma";
import { usuarioDaSessao } from "@/lib/session";

// Relatório de tramitação do período (por situação, por autor e linhas), em
// CSV (as linhas) ou XLSX (três abas).
export async function GET(req: Request) {
  const ator = await usuarioDaSessao();
  if (!ator) return new Response("Não autenticado.", { status: 401 });
  if (!podeVerTodasEmendas(ator) && !temPermissao(ator, "consultarTudo")) return new Response("Sem permissão.", { status: 403 });
  const url = new URL(req.url);
  const ano = Number(url.searchParams.get("ano"));
  const de = url.searchParams.get("de") ?? "";
  const ate = url.searchParams.get("ate") ?? "";
  if (!Number.isInteger(ano) || !/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return new Response("Parâmetros inválidos.", { status: 400 });
  const formato = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const inicio = new Date(`${de}T00:00:00-03:00`);
  const fim = new Date(`${ate}T23:59:59-03:00`);
  const [passagens, emendas] = await Promise.all([
    prisma.historicoEmenda.findMany({ where: { criadoEm: { gte: inicio, lte: fim }, emenda: { exercicio: { ano } } }, select: { emendaId: true, de: true, para: true, criadoEm: true } }),
    prisma.emenda.findMany({ where: { exercicio: { ano } }, select: { id: true, numero: true, objeto: true, valor: true, autor: { select: { nome: true } } } }),
  ]);
  const r = relatorioTramitacao(
    passagens,
    new Map(emendas.map((e) => [e.id, { id: e.id, numero: e.numero, autor: e.autor.nome, objeto: e.objeto, valor: e.valor.toNumber() }])),
    inicio,
    fim
  );
  const movimentos = r.linhas.map((l) => ({
    Quando: l.quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    Numero: l.emenda.numero,
    Autor: l.emenda.autor,
    Objeto: l.emenda.objeto,
    Situacao: STATUS_EMENDA[l.situacao]?.rotulo ?? l.situacao,
    Valor: l.emenda.valor,
  }));
  return respostaPlanilha(formato, `tramitacao-${de}-a-${ate}`, [
    { nome: "Por situação", linhas: r.porSituacao.map((s) => ({ Situacao: STATUS_EMENDA[s.situacao]?.rotulo ?? s.situacao, Emendas: s.qtd, Valor: s.valor })) },
    { nome: "Por autor", linhas: r.porAutor.map((a) => ({ Autor: a.autor, Remetidas: a.remetidas, ValorRemetido: a.valorRemetido, Aprovadas: a.aprovadas, ValorAprovado: a.valorAprovado, Rejeitadas: a.rejeitadas, ValorRejeitado: a.valorRejeitado })) },
    { nome: "Movimentações", linhas: movimentos },
  ]);
}
