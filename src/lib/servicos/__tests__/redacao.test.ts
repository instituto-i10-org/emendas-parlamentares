import { describe, expect, it } from "vitest";
import { conferirSugestao, payloadRedacao } from "../redacao";

const emenda = "Aquisição de 2 ambulâncias para a UBS Centro. A frota atual tem veículos antigos.";

describe("T-15.1 apoio à redação", () => {
  it("T-15.1-3 só o que consta da própria emenda vai ao modelo", () => {
    const p = payloadRedacao({ campo: "justificativa", texto: "texto", objeto: "objeto", destino: "UBS Centro", execucao: "DIRETA" }, "m");
    expect(Object.keys(JSON.parse(p.input))).toEqual(["campo", "texto", "objeto", "destino", "execucao"]);
    expect(p.input).not.toMatch(/PPA|LOA|referencias|biblioteca/);
  });
  it("T-15.1-1 sugestão que só reescreve passa", () => {
    expect(conferirSugestao(emenda, "Aquisição de 2 ambulâncias para a UBS Centro, porque a frota atual está envelhecida.")).toEqual([]);
  });
  it("T-15.1-2 número, percentual, data, norma ou fonte novos: recusada", () => {
    expect(conferirSugestao(emenda, "Aquisição de 2 ambulâncias para atender 15.000 habitantes.")[0]).toMatch(/15000/);
    expect(conferirSugestao(emenda, "Aquisição de 2 ambulâncias, ampliando em 30% o atendimento.").join()).toMatch(/30%/);
    expect(conferirSugestao(emenda, "Aquisição de 2 ambulâncias até 31 de dezembro.").join()).toMatch(/data/);
    expect(conferirSugestao(emenda, "Aquisição de 2 ambulâncias nos termos da Lei nº 8.080.").join()).toMatch(/norma|número/);
    expect(conferirSugestao(emenda, "Segundo o IBGE, a UBS Centro atende muitos pacientes; 2 ambulâncias.").join()).toMatch(/IBGE/);
  });
});
