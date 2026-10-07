import { describe, expect, it } from "vitest";
import { comFiltros, lerFiltros, ondeDosFiltros } from "../filtros";

describe("filtros das listas de emendas", () => {
  it("lê situação, autor, área, texto, período e página; ignora o inválido", () => {
    const f = lerFiltros({ situacao: "SUBMETIDA,QUALQUER", autor: "a1", area: "ar1", q: " cadeira ", de: "2026-10-01", ate: "x", pagina: "3" });
    expect(f).toMatchObject({ situacao: ["SUBMETIDA"], autorId: "a1", areaId: "ar1", q: "cadeira", de: "2026-10-01", ate: null, pagina: 3 });
  });
  it("T-6.1-3 combina os filtros em E", () => {
    const onde = ondeDosFiltros(lerFiltros({ situacao: "SUBMETIDA", autor: "a1" }), ["13"]);
    expect((onde.AND as unknown[]).length).toBe(3);
  });
  it("monta a URL preservando os filtros", () => {
    const f = lerFiltros({ situacao: "APROVADA", q: "escola" });
    expect(comFiltros("/tramitacao", f, { pagina: 2, aba: "parecer" })).toBe("/tramitacao?situacao=APROVADA&q=escola&pagina=2&aba=parecer");
  });
});
