import { describe, expect, it } from "vitest";
import { autoresDaEmenda, juntarNomes, parteDe, participa, partesParaCota } from "../autoria";
import { estadoInicial, problemaDaAutoria, totalDasPartes } from "../estado";
import { relatorioTramitacao } from "../relatorio-tramitacao";

const emenda = {
  autorId: "a",
  valor: 80000,
  autor: { id: "a", nome: "Ana", partido: "PSD" },
  coautores: [
    { autorId: "c", valor: 10000, ordem: 1, autor: { id: "c", nome: "Caio", partido: null } },
    { autorId: "b", valor: 30000, ordem: 0, autor: { id: "b", nome: "Bia", partido: "PL" } },
  ],
};

describe("coautoria: partes da emenda", () => {
  it("o autor primeiro, com o valor menos as partes; coautores na ordem", () => {
    expect(autoresDaEmenda(emenda)).toEqual([
      { autorId: "a", nome: "Ana", partido: "PSD", valor: 40000, principal: true },
      { autorId: "b", nome: "Bia", partido: "PL", valor: 30000, principal: false },
      { autorId: "c", nome: "Caio", partido: null, valor: 10000, principal: false },
    ]);
  });
  it("a parte de cada um; quem não participa, zero", () => {
    expect(parteDe(emenda, "a")).toBe(40000);
    expect(parteDe(emenda, "b")).toBe(30000);
    expect(parteDe(emenda, "x")).toBe(0);
    expect(participa(emenda, "c")).toBe(true);
    expect(participa(emenda, "x")).toBe(false);
  });
  it("emenda sem coautores: tudo do autor", () => {
    expect(autoresDaEmenda({ ...emenda, coautores: [] })).toHaveLength(1);
    expect(parteDe({ ...emenda, coautores: [] }, "a")).toBe(80000);
  });
  it("nomes para texto corrido", () => {
    expect(juntarNomes(["Ana"])).toBe("Ana");
    expect(juntarNomes(["Ana", "Bia", "Caio"])).toBe("Ana, Bia e Caio");
  });
  it("partes para a cota, com o aplicado de cada vereador", () => {
    const vereadores = [{ id: "b", nome: "Bia", partido: "PL", aplicado: { saude: 1, demais: 2 } }];
    expect(partesParaCota(100, { nome: "Ana", aplicado: { saude: 0, demais: 0 } }, [], vereadores)).toBeUndefined();
    expect(partesParaCota(100, { nome: "Ana", aplicado: { saude: 0, demais: 0 } }, [{ autorId: "b", valor: 30 }], vereadores)).toEqual([
      { nome: "Ana", valor: 70, aplicado: { saude: 0, demais: 0 } },
      { nome: "Bia", valor: 30, aplicado: { saude: 1, demais: 2 } },
    ]);
  });
});

describe("coautoria no formulário", () => {
  it("o valor da emenda é a soma das partes; sem coautores, o digitado", () => {
    expect(totalDasPartes({ ...estadoInicial(), pretendido: "R$ 5.000,00" })).toBe(5000);
    expect(totalDasPartes({ ...estadoInicial(), parteAutor: "R$ 50.000,00", coautores: [{ autorId: "b", valor: "R$ 30.000,50" }] })).toBe(80000.5);
  });
  it("linha sem vereador ou sem valor não passa", () => {
    expect(problemaDaAutoria(estadoInicial())).toBeNull();
    expect(problemaDaAutoria({ ...estadoInicial(), parteAutor: "R$ 1,00", coautores: [{ autorId: "", valor: "R$ 1,00" }] })).toMatch(/Escolha o vereador/);
    expect(problemaDaAutoria({ ...estadoInicial(), parteAutor: "R$ 1,00", coautores: [{ autorId: "b", valor: "" }] })).toMatch(/valor de cada vereador/);
    expect(problemaDaAutoria({ ...estadoInicial(), parteAutor: "R$ 1,00", coautores: [{ autorId: "b", valor: "R$ 2,00" }] })).toBeNull();
  });
});

describe("relatório de tramitação por autor, com as partes", () => {
  it("cada vereador soma a sua parte; o total do período conta a emenda uma vez", () => {
    const quando = new Date("2026-10-10T12:00:00Z");
    const r = relatorioTramitacao(
      [{ emendaId: "e1", de: "RASCUNHO", para: "SUBMETIDA", criadoEm: quando }],
      new Map([["e1", { id: "e1", numero: 1, autor: "Ana + 1", objeto: "x", valor: 80000, partes: [{ autor: "Ana", valor: 50000 }, { autor: "Bia", valor: 30000 }] }]]),
      new Date("2026-10-01T00:00:00Z"),
      new Date("2026-10-31T00:00:00Z")
    );
    expect(r.porAutor.map((a) => [a.autor, a.remetidas, a.valorRemetido])).toEqual([
      ["Ana", 1, 50000],
      ["Bia", 1, 30000],
    ]);
    expect(r.total).toEqual({ qtd: 1, valor: 80000 });
  });
});
