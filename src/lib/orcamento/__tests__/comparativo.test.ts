import { describe, expect, it } from "vitest";
import { comparar, leiDoProjeto, type LinhaOrcamento } from "../comparativo";

const linha = (id: string, chave: string, valor: number): LinhaOrcamento => ({ id, chave, ficha: null, codigo: chave, nome: chave, uo: "13.01", orgao: "13", natureza: "4.4.90.52", fonte: "01.1100000", valor });

describe("T-8.1 comparativo projeto × lei", () => {
  const pl = [linha("p1", "A", 100000), linha("p2", "B", 50000), linha("p3", "C", 1000000)];
  // Impositivas de Mogi: sem dotação de origem no sistema.
  const emendas = [
    { id: "e1", numero: 1, valor: 12000, destinoId: "p1", origemId: null },
    { id: "e2", numero: 2, valor: 8000, destinoId: "p1", origemId: null },
  ];
  it("T-8.1-1 dotação R$ 20.000 maior, explicada por duas emendas", () => {
    const lei = [linha("l1", "A", 120000), linha("l2", "B", 50000), linha("l3", "C", 1000000), linha("l4", "N", 5000)];
    const c = comparar(pl, lei, emendas);
    const a = c.find((x) => x.chave === "A")!;
    expect(a).toMatchObject({ valorPl: 100000, valorLei: 120000, diferenca: 20000, explicado: 20000 });
    expect(a.emendas.map((e) => e.numero)).toEqual([1, 2]);
    expect(c.find((x) => x.chave === "C")!).toMatchObject({ diferenca: 0, explicado: 0 });
  });
  it("T-8.1-1 com origem (reserva), a origem é descontada", () => {
    const c = comparar(pl, [], [{ id: "e3", numero: 3, valor: 5000, destinoId: "p2", origemId: "p3" }]);
    expect(c.find((x) => x.chave === "B")!.explicado).toBe(5000);
    expect(c.find((x) => x.chave === "C")!.explicado).toBe(-5000);
  });
  it("T-8.1-2 dotação só na lei é marcada como nova; só no projeto, suprimida", () => {
    const c = comparar(pl, [linha("l4", "N", 5000)], []);
    expect(c.find((x) => x.chave === "N")!.marca).toBe("NOVA");
    expect(c.find((x) => x.chave === "A")!.marca).toBe("SUPRIMIDA");
  });
  it("T-8.1-3 base da lei = projeto + emendas incorporadas", () => {
    const lei = leiDoProjeto(pl, emendas);
    expect(lei).toEqual([{ id: "p1", valor: 120000 }, { id: "p2", valor: 50000 }, { id: "p3", valor: 1000000 }]);
    const soma = (l: { valor: number }[]) => l.reduce((s, x) => s + x.valor, 0);
    expect(soma(lei)).toBe(soma(pl) + 20000);
  });
});
