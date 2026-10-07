import { describe, expect, it } from "vitest";
import { conferirCiencia, contar, diferencas, exibir, exigeCiencia, impactoVazio } from "../tipos";

const decimal = (n: number) => ({ toNumber: () => n });

describe("antes → depois", () => {
  const campos = {
    cotaIndividual: { rotulo: "Cota individual", formato: "moeda" as const },
    percentualSaude: { rotulo: "Parcela mínima da saúde", formato: "percentual" as const },
    prazoProtocolo: { rotulo: "Fim do protocolo", formato: "data" as const },
    situacoesEmendamento: { rotulo: "Situações", formato: "lista" as const, opcoes: { EM_TRAMITACAO: "em tramitação", ENVIADO: "enviado" } },
    fontePrecoObrigatoria: { rotulo: "Fonte obrigatória", formato: "sim-nao" as const },
  };

  it("só lista o que muda, com o valor do banco (Decimal, Date) comparado ao digitado", () => {
    const antes = {
      cotaIndividual: decimal(854797.44),
      percentualSaude: decimal(50),
      prazoProtocolo: new Date("2027-11-20T23:59:59-03:00"),
      situacoesEmendamento: ["EM_TRAMITACAO"],
      fontePrecoObrigatoria: true,
    };
    const depois = { cotaIndividual: 800000, percentualSaude: 50, prazoProtocolo: "2027-11-20", situacoesEmendamento: ["EM_TRAMITACAO"], fontePrecoObrigatoria: true };
    const m = diferencas(antes, depois, campos);
    expect(m).toHaveLength(1);
    expect(m[0].campo).toBe("Cota individual");
    expect(m[0].antes).toContain("854.797,44");
    expect(m[0].depois).toContain("800.000,00");
  });

  it("lista sem ordem: a mesma escolha em outra ordem não é mudança", () => {
    const m = diferencas({ situacoesEmendamento: ["ENVIADO", "EM_TRAMITACAO"] }, { situacoesEmendamento: ["EM_TRAMITACAO", "ENVIADO"] }, campos);
    expect(m).toEqual([]);
  });

  it("vazio vira “não definido” e conta como mudança", () => {
    const m = diferencas({ cotaIndividual: decimal(100) }, { cotaIndividual: null }, campos);
    expect(m[0].antes).toMatch(/^R\$\s100,00$/);
    expect(m[0].depois).toBe("não definido");
  });

  it("campo que não veio na alteração não aparece", () => {
    expect(diferencas({ cotaIndividual: decimal(100) }, {}, campos)).toEqual([]);
  });

  it("formatos", () => {
    expect(exibir(12, { rotulo: "", formato: "meses" })).toBe("12 meses");
    expect(exibir(1, { rotulo: "", formato: "dias" })).toBe("1 dia");
    expect(exibir("2027-11-20", { rotulo: "", formato: "data" })).toBe("20/11/2027");
    expect(exibir(false, { rotulo: "", formato: "sim-nao" })).toBe("não");
    expect(exibir("GLOBAL", { rotulo: "", opcoes: { GLOBAL: "global" } })).toBe("global");
  });
});

describe("contagem e ciência", () => {
  it("separa enviadas, em análise, aprovadas e rascunhos", () => {
    const c = contar([
      { status: "RASCUNHO", n: 3 },
      { status: "INVALIDA", n: 1 },
      { status: "SUBMETIDA", n: 2 },
      { status: "EM_TRAMITACAO", n: 1 },
      { status: "EM_DILIGENCIA", n: 1 },
      { status: "APROVADA", n: 4 },
      { status: "REJEITADA", n: 1 },
    ]);
    expect(c).toEqual({ enviadas: 9, emAnalise: 4, aprovadas: 4, rascunhos: 4 });
  });

  it("sem emenda enviada: não pede ciência", () => {
    const i = impactoVazio({ emendas: { enviadas: 0, emAnalise: 0, aprovadas: 0, rascunhos: 5 } });
    expect(exigeCiencia(i)).toBe(false);
    expect(conferirCiencia(i, false)).toBeNull();
  });

  it("com emenda enviada: o servidor recusa sem a ciência e aceita com ela", () => {
    const i = impactoVazio({ emendas: { enviadas: 12, emAnalise: 3, aprovadas: 0, rascunhos: 0 } });
    expect(exigeCiencia(i)).toBe(true);
    expect(conferirCiencia(i, false)).toContain("12 emendas já enviadas");
    expect(conferirCiencia(i, undefined)).not.toBeNull();
    expect(conferirCiencia(i, true)).toBeNull();
  });

  it("bloqueio vale mesmo com a ciência marcada", () => {
    const i = impactoVazio({ bloqueio: "O exercício 2026 está encerrado." });
    expect(exigeCiencia(i)).toBe(false);
    expect(conferirCiencia(i, true)).toBe("O exercício 2026 está encerrado.");
  });
});
