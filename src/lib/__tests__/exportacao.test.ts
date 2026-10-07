import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { csv, xlsx } from "../exportacao";

describe("T-14.1-2 planilhas em português", () => {
  it("CSV: ponto e vírgula, marca de ordem, vírgula decimal, acentos e códigos intactos", () => {
    const s = csv([{ Unidade: "02.01", Fonte: "01", Objeto: 'Aquisição; com aspas "x"', Valor: 1234.5 }]);
    expect(s.startsWith("﻿")).toBe(true);
    const [cab, linha] = s.slice(1).split("\r\n");
    expect(cab).toBe("Unidade;Fonte;Objeto;Valor");
    expect(linha).toBe('02.01;01;"Aquisição; com aspas ""x""";1234,50');
  });
  it("XLSX: códigos como texto", () => {
    const buf = xlsx([{ nome: "Emendas", linhas: [{ Unidade: "02.01", Fonte: "01", Valor: 10 }] }]);
    const folha = XLSX.read(buf, { type: "array" }).Sheets.Emendas;
    expect(folha.A2.t).toBe("s");
    expect(folha.A2.v).toBe("02.01");
    expect(folha.B2.v).toBe("01");
    expect(folha.C2.t).toBe("n");
  });
});
