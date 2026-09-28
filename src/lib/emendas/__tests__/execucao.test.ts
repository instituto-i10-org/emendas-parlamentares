import { describe, expect, it } from "vitest";
import { conferirLancamento, somasExecucao } from "../execucao";

describe("execução da emenda", () => {
  it("soma por etapa", () => {
    expect(
      somasExecucao([
        { etapa: "EMPENHO", valor: 100 },
        { etapa: "EMPENHO", valor: 50.1 },
        { etapa: "LIQUIDACAO", valor: 80 },
      ])
    ).toEqual({ empenhado: 150.1, liquidado: 80, pago: 0 });
  });

  it("empenho não passa do valor aprovado", () => {
    expect(conferirLancamento(1000, [], { etapa: "EMPENHO", valor: 1000 })).toBeNull();
    expect(conferirLancamento(1000, [], { etapa: "EMPENHO", valor: 1000.01 })).toMatch(/acima do valor aprovado/);
  });

  it("liquidação não passa do empenhado, pagamento não passa do liquidado", () => {
    const antes = [{ etapa: "EMPENHO" as const, valor: 500 }];
    expect(conferirLancamento(1000, antes, { etapa: "LIQUIDACAO", valor: 600 })).toMatch(/acima do empenhado/);
    expect(conferirLancamento(1000, antes, { etapa: "PAGAMENTO", valor: 1 })).toMatch(/acima do liquidado/);
  });

  it("estorno não deixa a etapa negativa", () => {
    const antes = [{ etapa: "EMPENHO" as const, valor: 500 }];
    expect(conferirLancamento(1000, antes, { etapa: "EMPENHO", valor: -200 })).toBeNull();
    expect(conferirLancamento(1000, antes, { etapa: "EMPENHO", valor: -600 })).toMatch(/negativo/);
    expect(conferirLancamento(1000, antes, { etapa: "EMPENHO", valor: 0 })).toMatch(/diferente de zero/);
  });
});
