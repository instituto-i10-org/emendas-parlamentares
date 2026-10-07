import { describe, expect, it } from "vitest";
import { situacaoEmendamento } from "../emendamento";

const base = {
  ano: 2027,
  exercicioStatus: "ABERTO",
  projeto: { numero: "PL 264/2026", status: "EM_TRAMITACAO" },
  situacoesQueAdmitem: ["EM_TRAMITACAO"],
  prazoProtocolo: "2026-10-10",
  hoje: "2026-10-06",
};

describe("emendamento aberto ou fechado (T-1.3-1 a T-1.3-3)", () => {
  it("exercício aberto, PL em tramitação e prazo no futuro: aberto", () => {
    const s = situacaoEmendamento(base);
    expect(s.aberto).toBe(true);
    expect(s.explicacao).toContain("10/10/2026");
  });
  it("PL volta para em elaboração: fecha, com o motivo", () => {
    const s = situacaoEmendamento({ ...base, projeto: { ...base.projeto, status: "EM_ELABORACAO" } });
    expect(s).toMatchObject({ aberto: false, motivo: "INSTRUMENTO_FECHADO" });
    expect(s.explicacao).toContain("em elaboração");
  });
  it("exercício encerrado fecha", () => {
    expect(situacaoEmendamento({ ...base, exercicioStatus: "ENCERRADO" }).motivo).toBe("EXERCICIO_ENCERRADO");
  });
  it("sem projeto de lei fecha", () => {
    expect(situacaoEmendamento({ ...base, projeto: null }).motivo).toBe("SEM_PROJETO");
  });
  it("prazo vencido fecha; no próprio dia ainda está aberto", () => {
    expect(situacaoEmendamento({ ...base, hoje: "2026-10-11" }).motivo).toBe("PRAZO_ENCERRADO");
    expect(situacaoEmendamento({ ...base, hoje: "2026-10-10" }).aberto).toBe(true);
  });
  it("as situações que admitem emenda são parâmetro", () => {
    const s = situacaoEmendamento({ ...base, projeto: { ...base.projeto, status: "ENVIADO" }, situacoesQueAdmitem: ["ENVIADO", "EM_TRAMITACAO"] });
    expect(s.aberto).toBe(true);
  });
});
