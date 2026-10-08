import { afterEach, describe, expect, it, vi } from "vitest";
import { INDISPONIVEL, consultarBancoI10, lerRespostaBanco } from "../banco-i10";

describe("resposta do banco de preços i10", () => {
  it("mantém só o que tem mediana e nome, até cinco", () => {
    const corpo = {
      resultados: [
        { item: "Cadeira De Rodas", unidade: "unidade", mediana: 1412.845, faixaMin: 1150, faixaMax: 1938.95, n: 48, nMunis: 8, fonte: "Compras municipais (SC)" },
        { item: "Sem mediana", mediana: null },
        { item: "", mediana: 10 },
        ...Array.from({ length: 8 }, (_, i) => ({ item: `X${i}`, mediana: 100 + i, n: 0, fonte: "BPS" })),
      ],
    };
    const r = lerRespostaBanco(corpo);
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual({ item: "Cadeira De Rodas", unidade: "unidade", mediana: 1412.845, faixaMin: 1150, faixaMax: 1938.95, compras: 48, municipios: 8, fonte: "Compras municipais (SC)" });
    expect(r[1].compras).toBeNull();
  });
  it("formato estranho vira lista vazia", () => {
    expect(lerRespostaBanco(null)).toEqual([]);
    expect(lerRespostaBanco({ resultados: "x" })).toEqual([]);
  });
});

describe("consulta", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("nome curto não consulta", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await consultarBancoI10("ab", "https://b")).toMatchObject({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });
  it("falha de rede ou tempo vira indisponível", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await consultarBancoI10("cadeira", "https://b")).toEqual({ ok: false, erro: INDISPONIVEL });
  });
  it("resposta não ok vira indisponível", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 502 })));
    expect(await consultarBancoI10("cadeira", "https://b")).toEqual({ ok: false, erro: INDISPONIVEL });
  });
  it("consulta pelo servidor com o termo codificado", async () => {
    const f = vi.fn().mockResolvedValue(Response.json({ resultados: [{ item: "Cadeira", mediana: 10 }] }));
    vi.stubGlobal("fetch", f);
    expect(await consultarBancoI10("  cadeira   de rodas ", "https://b/")).toMatchObject({ ok: true, resultados: [{ item: "Cadeira", mediana: 10 }] });
    expect(f.mock.calls[0][0]).toBe("https://b/api/banco-precos?q=cadeira%20de%20rodas");
  });
});
