import { describe, expect, it } from "vitest";
import { chaveNome, possiveisDuplicados } from "../beneficiarios";

const b = (id: string, nome: string, cnpj: string | null = null, execucao = "INDIRETA") => ({ id, nome, cnpj, execucao, ativo: true, emendas: 0 });

describe("T-12.3-1 beneficiários parecidos", () => {
  it("grafias, acentos, caixa e abreviações", () => {
    expect(chaveNome("Assoc. Beneficente X")).toBe(chaveNome("Associação Beneficente X"));
    expect(chaveNome("ASSOCIAÇÃO BENEFICENTE  x")).toBe(chaveNome("associacao beneficente X"));
    expect(chaveNome("Lar de Idosos S. Sebastião")).toBe(chaveNome("Lar Idosos São Sebastião"));
  });
  it("marca o par por nome e por CNPJ; não mistura forma de execução", () => {
    const pares = possiveisDuplicados([
      b("1", "Assoc. Beneficente X"),
      b("2", "Associação Beneficente X"),
      b("3", "Entidade Y", "11.222.333/0001-81"),
      b("4", "Outra Entidade", "11222333000181"),
      b("5", "Associação Beneficente X", null, "DIRETA"),
    ]);
    expect(pares.map((p) => [p.a.id, p.b.id, p.motivo])).toEqual([
      ["3", "4", "CNPJ"],
      ["1", "2", "NOME"],
    ]);
  });
});
