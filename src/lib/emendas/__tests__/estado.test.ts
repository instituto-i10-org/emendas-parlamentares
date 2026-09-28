import { describe, expect, it } from "vitest";
import { chaveClassificacao, estadoInicial } from "../estado";

describe("chave da classificação", () => {
  const base = { ...estadoInicial(), execucao: "DIRETA" as const, destinoId: "d1", objeto: "Aquisição de ambulância", pretendido: "R$ 100.000,00" };

  it("ajustar só o valor pretendido não invalida a análise", () => {
    const ajustado = { ...base, pretendido: "R$ 351.480,00" };
    expect(chaveClassificacao(ajustado)).toBe(chaveClassificacao(base));
  });

  it("objeto, destino ou execução diferentes invalidam", () => {
    expect(chaveClassificacao({ ...base, objeto: "Aquisição de ultrassom" })).not.toBe(chaveClassificacao(base));
    expect(chaveClassificacao({ ...base, destinoId: "d2" })).not.toBe(chaveClassificacao(base));
    expect(chaveClassificacao({ ...base, execucao: "INDIRETA" })).not.toBe(chaveClassificacao(base));
  });
});
