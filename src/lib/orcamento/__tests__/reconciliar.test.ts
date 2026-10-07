import { describe, expect, it } from "vitest";
import { contarDotacoes, lotes, reconciliarUnidades } from "../pdf/reconciliar";

describe("reconciliação da leitura de PDF", () => {
  const linhas = [
    { pagina: 9, unidade: "02.01.01", valor: 1000 },
    { pagina: 9, unidade: "02.01.02", valor: 500 },
    { pagina: 10, unidade: "02.02.01", valor: 300 },
  ];
  it("confere unidade executora, unidade orçamentária e órgão pelo prefixo do código", () => {
    const totais = [
      { pagina: 9, nivel: "UNIDADE_EXECUTORA" as const, codigo: "02.01.01", valor: 1000 },
      { pagina: 9, nivel: "UNIDADE_ORCAMENTARIA" as const, codigo: "02.01", valor: 1500 },
      { pagina: 10, nivel: "ORGAO" as const, codigo: "02", valor: 1800 },
    ];
    expect(reconciliarUnidades(linhas, totais)).toEqual([]);
  });
  it("aponta a divergência mais específica primeiro, com as páginas", () => {
    const totais = [
      { pagina: 10, nivel: "ORGAO" as const, codigo: "02", valor: 2000 },
      { pagina: 10, nivel: "UNIDADE_EXECUTORA" as const, codigo: "02.02.01", valor: 500 },
    ];
    const d = reconciliarUnidades(linhas, totais);
    expect(d.map((x) => [x.codigo, x.diferenca, x.paginas])).toEqual([
      ["02.02.01", -200, [10]],
      ["02", -200, [9, 10]],
    ]);
  });
  it("conta as linhas de dotação no texto e agrupa páginas em lotes", () => {
    const texto = "   3.3.90.30   MATERIAL DE CONSUMO   1   110.0000   35   40.000,00\n   TOTAL UNIDADE EXECUTORA   1.560.000,00\n   4.4.90.52   EQUIPAMENTOS   1   110.0000   34   5.000,00";
    expect(contarDotacoes(texto)).toBe(2);
    expect(lotes([9, 10, 11, 12, 20], 3)).toEqual([[9, 11], [12, 12], [20, 20]]);
  });
});
