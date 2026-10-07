import { describe, expect, it } from "vitest";
import { municipioConfigurado, municipioSchema } from "../municipio";

describe("dados do município", () => {
  const base = { nome: "Mogi Guaçu", uf: "SP", codigoIbge: "3530706", nomeCamara: "Câmara Municipal de Mogi Guaçu", nomePrefeitura: "" };

  it("aceita os dados de Mogi e IBGE em branco", () => {
    expect(municipioSchema.safeParse(base).success).toBe(true);
    expect(municipioSchema.safeParse({ ...base, codigoIbge: "" }).success).toBe(true);
  });

  it("recusa nome curto, UF inexistente e IBGE fora de 7 dígitos", () => {
    const msg = (x: object) => {
      const r = municipioSchema.safeParse({ ...base, ...x });
      return r.success ? null : r.error.issues[0].message;
    };
    expect(msg({ nome: "X" })).toBe("Informe o nome do município.");
    expect(msg({ uf: "XX" })).toBe("Escolha a UF.");
    expect(msg({ codigoIbge: "123" })).toBe("O código IBGE tem 7 dígitos.");
  });

  it("nome em branco = município não configurado", () => {
    expect(municipioConfigurado({ nome: "" })).toBe(false);
    expect(municipioConfigurado({ nome: "  " })).toBe(false);
    expect(municipioConfigurado(null)).toBe(false);
    expect(municipioConfigurado({ nome: "Mogi Guaçu" })).toBe(true);
  });
});
