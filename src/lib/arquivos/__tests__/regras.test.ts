import { describe, expect, it } from "vitest";
import { CHAVE_VALIDA } from "../permissao";
import { conferirArquivo, nomeSeguro, tipoDoArquivo } from "../regras";

describe("regras de arquivo", () => {
  it("peça orçamentária só em PDF e até 100 MB", () => {
    expect(conferirArquivo("PECA_ORCAMENTARIA", { nome: "LOA 2026.pdf", tipo: "application/pdf", tamanho: 12 * 1024 * 1024 })).toBeNull();
    expect(conferirArquivo("PECA_ORCAMENTARIA", { nome: "LOA.xlsx", tipo: "", tamanho: 100 })).toMatch(/Formato não aceito/);
    expect(conferirArquivo("PECA_ORCAMENTARIA", { nome: "LOA.pdf", tipo: "application/pdf", tamanho: 101 * 1024 * 1024 })).toMatch(/grande demais/);
    expect(conferirArquivo("PECA_ORCAMENTARIA", { nome: "LOA.pdf", tipo: "application/pdf", tamanho: 0 })).toMatch(/vazio/);
  });
  it("importação aceita PDF, CSV, XLSX e foto", () => {
    for (const n of ["qdd.pdf", "base.csv", "base.xlsx", "foto.jpg", "foto.png"]) {
      expect(conferirArquivo("IMPORTACAO", { nome: n, tipo: "", tamanho: 10 })).toBeNull();
    }
    expect(conferirArquivo("IMPORTACAO", { nome: "virus.exe", tipo: "", tamanho: 10 })).toMatch(/Formato não aceito/);
  });
  it("tipo vazio é deduzido da extensão; nome perde barras e controles", () => {
    expect(tipoDoArquivo("a.PDF", "")).toBe("application/pdf");
    expect(nomeSeguro("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(nomeSeguro("")).toBe("arquivo");
  });
  it("caminho do envio direto: prefixo do uso, data e nome aleatório", () => {
    expect(CHAVE_VALIDA.test("norma/2026-10-05/0123456789abcdef0123456789abcdef.pdf")).toBe(true);
    expect(CHAVE_VALIDA.test("norma/2026-10-05/../segredo.pdf")).toBe(false);
    expect(CHAVE_VALIDA.test("outro/2026-10-05/0123456789abcdef0123456789abcdef.pdf")).toBe(false);
  });
});
