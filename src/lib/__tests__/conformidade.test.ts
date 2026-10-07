import { describe, expect, it } from "vitest";
import { conferirConformidade, type EstadoConformidade } from "../conformidade";

const hoje = new Date("2026-10-06T12:00:00Z");
const base = (x: Partial<EstadoConformidade> = {}): EstadoConformidade => ({
  hoje,
  normas: [
    { tipo: "LOM", ativo: true, dataVigencia: new Date("2026-09-30"), vigenciaFim: null, titulo: "LOM" },
    { tipo: "REGIMENTO_INTERNO", ativo: true, dataVigencia: new Date("2020-01-01"), vigenciaFim: null, titulo: "RI" },
  ],
  manual: { atoInstituidor: true, publicadoEm: new Date("2026-10-01") },
  portal: { ok: true, detalhe: "ok" },
  emendasRemetidas: 3,
  semAutor: 0,
  semValidacao: 0,
  parametros: { cota: 175245.51, percentualSaude: 50, vereadores: 9 },
  regraCota: { ativa: true, modo: "BLOQUEANTE" },
  regraLimite: { ativa: true, modo: "BLOQUEANTE" },
  ...x,
});
const item = (e: EstadoConformidade, id: string) => conferirConformidade(e).find((i) => i.id === id)!;

describe("T-11 conformidade derivada do estado real", () => {
  it("tudo em ordem: seis itens principais conformes", () => {
    const r = conferirConformidade(base()).filter((i) => i.principal);
    expect(r).toHaveLength(6);
    expect(r.every((i) => i.nivel === "ok")).toBe(true);
  });
  it("T-11.1-1 Lei Orgânica desativada", () => {
    expect(item(base({ normas: [{ tipo: "LOM", ativo: false, dataVigencia: new Date("2026-01-01"), vigenciaFim: null, titulo: "LOM" }] }), "LOM").nivel).toBe("bad");
  });
  it("T-11.1-2 Lei Orgânica com vigência futura", () => {
    const i = item(base({ normas: [{ tipo: "LOM", ativo: true, dataVigencia: new Date("2027-01-01"), vigenciaFim: null, titulo: "LOM" }] }), "LOM");
    expect(i.nivel).toBe("bad");
    expect(i.detalhe).toContain("ainda não vigente");
  });
  it("T-11.1-3 sem Regimento", () => expect(item(base({ normas: base().normas.filter((n) => n.tipo !== "REGIMENTO_INTERNO") }), "REGIMENTO").nivel).toBe("bad"));
  it("T-11.1-4 manual sem ato ou sem publicação", () => {
    expect(item(base({ manual: { atoInstituidor: false, publicadoEm: new Date() } }), "MANUAL").nivel).toBe("bad");
    expect(item(base({ manual: { atoInstituidor: true, publicadoEm: null } }), "MANUAL").detalhe).toBe("Não publicado.");
  });
  it("T-11.1-5 portal desligado", () => expect(item(base({ portal: null }), "PORTAL").nivel).toBe("bad"));
  it("T-11.1-6 emenda sem autor, com a contagem", () => expect(item(base({ semAutor: 2 }), "AUTOR").detalhe).toContain("2 emenda(s)"));
  it("T-11.1-7 cota em branco ou regra de cota em alerta", () => {
    expect(item(base({ parametros: { cota: null, percentualSaude: 50, vereadores: 9 } }), "LIMITES").nivel).toBe("bad");
    expect(item(base({ regraCota: { ativa: true, modo: "ALERTA" } }), "LIMITES").detalhe).toContain("(ix)");
  });
  it("T-11.2-1 cada pendência traz providência e link", () => {
    const r = conferirConformidade(base({ normas: [], manual: { atoInstituidor: false, publicadoEm: null }, portal: null, semAutor: 1, parametros: { cota: null, percentualSaude: null, vereadores: null } }));
    for (const i of r.filter((x) => x.nivel !== "ok")) {
      expect(i.providencia).toBeTruthy();
      expect(i.link).toMatch(/^\//);
    }
  });
});
