import * as XLSX from "xlsx";

// ============================================================================
// Planilhas exportadas (CSV e XLSX) iguais à tela. CSV no formato que o Excel
// e o LibreOffice em português abrem direto: ponto e vírgula, marca de ordem
// UTF-8, vírgula decimal. Códigos ("02.01", "01") vão como texto nos dois.
// ============================================================================

export type Celula = string | number | null | undefined;
export type Linha = Record<string, Celula>;

const numeroBR = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

function campoCsv(v: Celula): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? numeroBR(v) : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csv(linhas: Linha[], colunas?: string[]): string {
  const cab = colunas ?? (linhas[0] ? Object.keys(linhas[0]) : []);
  return "﻿" + [cab.map(campoCsv).join(";"), ...linhas.map((l) => cab.map((c) => campoCsv(l[c])).join(";"))].join("\r\n") + "\r\n";
}

export function xlsx(abas: { nome: string; linhas: Linha[] }[]): Uint8Array {
  const livro = XLSX.utils.book_new();
  for (const a of abas) {
    const folha = XLSX.utils.json_to_sheet(a.linhas);
    // Texto continua texto: o Excel não come os zeros à esquerda dos códigos.
    for (const ref of Object.keys(folha)) {
      const c = folha[ref] as XLSX.CellObject | undefined;
      if (ref.startsWith("!") || !c) continue;
      if (c.t === "s") c.z = "@";
      else if (c.t === "n" && !Number.isInteger(c.v as number)) c.z = "#,##0.00";
    }
    XLSX.utils.book_append_sheet(livro, folha, a.nome.slice(0, 31));
  }
  return new Uint8Array(XLSX.write(livro, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

export function respostaPlanilha(formato: string | null, nome: string, abas: { nome: string; linhas: Linha[] }[]): Response {
  if (formato === "xlsx") {
    return new Response(xlsx(abas) as BodyInit, {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${nome}.xlsx"` },
    });
  }
  return new Response(csv(abas[abas.length - 1]?.linhas ?? []), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}.csv"` },
  });
}
