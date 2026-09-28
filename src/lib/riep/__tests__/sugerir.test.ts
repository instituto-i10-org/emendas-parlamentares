import { describe, expect, it } from "vitest";
import { classificar } from "../classificar";
import { precisaAjuste, sugerirDestinos, sugerirTextos } from "../sugerir";
import { catalogo, destino, loa, todosDestinos } from "./dados-reais";

const entrada = (objeto: string, trecho: string) => {
  const d = destino(trecho);
  return { objeto, destino: d, execucao: d.execucao, pretendido: 100000, loa, catalogo };
};

describe("ajuste automático", () => {
  it("ambulância para o hospital: não troca por obra; sugere destinos onde cabe", () => {
    const x = entrada("Compra de uma ambulância", "Tabajara");
    expect(precisaAjuste(classificar(x))).toBe(true);
    const textos = sugerirTextos(x);
    expect(textos.every((t) => t.dotacao.elem !== "51")).toBe(true);
    const { sugestoes, total } = sugerirDestinos({ ...x, destinos: todosDestinos() });
    expect(total).toBeGreaterThan(0);
    expect(sugestoes[0].dotacao.elem).toBe("52");
  });

  it("objeto não reconhecido ganha um texto que o motor enquadra", () => {
    const x = entrada("Compra de material para o atendimento dos pacientes", "UBS Centro Oeste");
    expect(precisaAjuste(classificar(x))).toBe(true);
    const textos = sugerirTextos(x);
    expect(textos.length).toBeGreaterThan(0);
    for (const t of textos) {
      const r = classificar({ ...x, objeto: t.texto });
      expect(precisaAjuste(r)).toBe(false);
    }
    expect(textos.map((t) => t.rotulo)).toContain("Material hospitalar");
  });
});
