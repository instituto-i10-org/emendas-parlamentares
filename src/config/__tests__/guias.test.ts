import { describe, expect, it } from "vitest";
import { deveAbrirSozinho, guiaDaRota, GUIAS } from "../guias";

describe("guias de ajuda", () => {
  it("cada guia tem id único, versão e passos com título e texto", () => {
    for (const g of Object.values(GUIAS)) {
      expect(g.versao).toBeGreaterThan(0);
      expect(g.passos.length).toBeGreaterThan(0);
      for (const p of g.passos) {
        expect(p.titulo.trim()).not.toBe("");
        expect(p.texto.trim()).not.toBe("");
      }
    }
  });

  it("o Início tem guia; tela sem guia não tem", () => {
    expect(guiaDaRota("/inicio")?.id).toBe("inicio");
    expect(guiaDaRota("/tela-que-nao-existe")).toBeNull();
  });

  it("abre sozinho só na primeira visita ou quando a versão sobe", () => {
    const g = GUIAS.inicio;
    expect(deveAbrirSozinho(g, {})).toBe(true);
    expect(deveAbrirSozinho(g, { inicio: g.versao })).toBe(false);
    expect(deveAbrirSozinho(g, { inicio: g.versao - 1 })).toBe(true);
  });
});
