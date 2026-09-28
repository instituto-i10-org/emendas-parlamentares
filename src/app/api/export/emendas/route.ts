import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { podeVerTodasEmendas, temPermissao } from "@/lib/authz";
import { listarEmendas } from "@/lib/emendas/consultas";
import { PARCELA, STATUS_EMENDA } from "@/lib/emendas/rotulos";

// Exportação das emendas do exercício (CSV ou XLSX). Só para quem vê todas as
// emendas: Comissão, Presidência, Executivo (viabilidade/execução) e admin.
export async function GET(req: Request) {
  const sessao = await auth();
  const ator = { id: sessao?.user?.id ?? "", perfil: sessao?.user?.perfil ?? null };
  if (!ator.perfil) return new Response("Não autenticado.", { status: 401 });
  if (!podeVerTodasEmendas(ator) && !temPermissao(ator, "analisarViabilidade", "registrarExecucao")) {
    return new Response("Sem permissão.", { status: 403 });
  }
  const url = new URL(req.url);
  const ano = Number(url.searchParams.get("ano"));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return new Response("Ano inválido.", { status: 400 });
  const formato = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";

  const emendas = await listarEmendas(ano, { status: { not: "RASCUNHO" } });
  const linhas = emendas.map((e) => ({
    Numero: e.numero,
    Autor: e.autor.nome,
    Objeto: e.objeto,
    Destino: e.destino?.nome ?? "",
    Dotacao: e.dotacao ? `${e.dotacao.codigo} — ${e.dotacao.acao.nome}` : "a definir",
    Unidade: e.dotacao?.unidadeOrcamentaria.codigo ?? "",
    Natureza: e.dotacao?.naturezaDespesa.codigo ?? "",
    Parcela: e.parcelaEfetiva ? PARCELA[e.parcelaEfetiva] : "",
    Situacao: STATUS_EMENDA[e.status].rotulo,
    Valor: e.valor.toNumber(),
    Empenhado: e.somasExec.empenhado,
    Liquidado: e.somasExec.liquidado,
    Pago: e.somasExec.pago,
  }));
  const planilha = XLSX.utils.json_to_sheet(linhas);
  const nome = `emendas-${ano}.${formato}`;
  if (formato === "csv") {
    return new Response("﻿" + XLSX.utils.sheet_to_csv(planilha), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
    });
  }
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "Emendas");
  const buffer = XLSX.write(livro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
