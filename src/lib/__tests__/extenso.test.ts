import { describe, expect, it } from "vitest";
import { dataPorExtenso, inteiroPorExtenso, reaisPorExtenso } from "../extenso";

describe("valores por extenso", () => {
  it.each([
    [1, "um"],
    [16, "dezesseis"],
    [21, "vinte e um"],
    [100, "cem"],
    [101, "cento e um"],
    [999, "novecentos e noventa e nove"],
    [1000, "um mil"],
    [1200, "um mil e duzentos"],
    [1250, "um mil, duzentos e cinquenta"],
    [2005, "dois mil e cinco"],
    [1_000_000, "um milhão"],
    [1_200_000, "um milhão e duzentos mil"],
    [286944, "duzentos e oitenta e seis mil, novecentos e quarenta e quatro"],
    [11112367, "onze milhões, cento e doze mil, trezentos e sessenta e sete"],
  ])("%i", (n, txt) => expect(inteiroPorExtenso(n)).toBe(txt));

  it("reais e centavos", () => {
    expect(reaisPorExtenso(286944.11)).toBe("duzentos e oitenta e seis mil, novecentos e quarenta e quatro reais e onze centavos");
    expect(reaisPorExtenso(1)).toBe("um real");
    expect(reaisPorExtenso(0.01)).toBe("um centavo");
    expect(reaisPorExtenso(2_000_000)).toBe("dois milhões de reais");
    expect(reaisPorExtenso(854797.44)).toBe("oitocentos e cinquenta e quatro mil, setecentos e noventa e sete reais e quarenta e quatro centavos");
  });

  it("data no fuso de Brasília", () => {
    expect(dataPorExtenso(new Date("2026-10-08T02:00:00Z"))).toBe("7 de outubro de 2026");
    expect(dataPorExtenso(new Date("2026-10-08T15:00:00Z"))).toBe("8 de outubro de 2026");
  });
});
