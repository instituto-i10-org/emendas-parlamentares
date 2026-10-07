import { describe, expect, it } from "vitest";
import { relatorioTramitacao, type EmendaDoRelatorio, type Passagem } from "../relatorio-tramitacao";

const em = (id: string, autor: string, valor: number): EmendaDoRelatorio => ({ id, numero: Number(id.slice(1)), autor, objeto: `Objeto ${id}`, valor });
const d = (s: string) => new Date(`${s}T12:00:00-03:00`);

describe("T-6.3-2 e T-6.3-3 relatório de tramitação", () => {
  // Dez emendas remetidas em dias diferentes de setembro e outubro.
  const emendas = new Map(Array.from({ length: 10 }, (_, i) => em(`e${i + 1}`, i % 2 ? "Ana" : "Bruno", 10000 * (i + 1))).map((e) => [e.id, e]));
  const passagens: Passagem[] = Array.from({ length: 10 }, (_, i) => ({ emendaId: `e${i + 1}`, para: "SUBMETIDA", criadoEm: d(`2026-${i < 5 ? "09" : "10"}-${String(10 + i).padStart(2, "0")}`) }));
  passagens.push({ emendaId: "e6", para: "APROVADA", criadoEm: d("2026-10-20") }, { emendaId: "e7", para: "REJEITADA", criadoEm: d("2026-10-21") }, { emendaId: "e1", para: "APROVADA", criadoEm: d("2026-09-30") });

  it("só as do período, com totais corretos", () => {
    const r = relatorioTramitacao(passagens, emendas, d("2026-10-01"), d("2026-10-31"));
    expect(r.porSituacao).toEqual([
      { situacao: "SUBMETIDA", qtd: 5, valor: 60000 + 70000 + 80000 + 90000 + 100000 },
      { situacao: "APROVADA", qtd: 1, valor: 60000 },
      { situacao: "REJEITADA", qtd: 1, valor: 70000 },
    ]);
    expect(r.total).toEqual({ qtd: 5, valor: 400000 });
  });
  it("por autor bate com a lista", () => {
    const r = relatorioTramitacao(passagens, emendas, d("2026-10-01"), d("2026-10-31"));
    const ana = r.porAutor.find((a) => a.autor === "Ana")!;
    const bruno = r.porAutor.find((a) => a.autor === "Bruno")!;
    expect(ana).toMatchObject({ remetidas: 3, aprovadas: 1, rejeitadas: 0 });
    expect(bruno).toMatchObject({ remetidas: 2, aprovadas: 0, rejeitadas: 1 });
    expect(ana.remetidas + bruno.remetidas).toBe(r.porSituacao[0].qtd);
  });
});
