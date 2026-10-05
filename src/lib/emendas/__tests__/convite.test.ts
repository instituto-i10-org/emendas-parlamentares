import { describe, expect, it } from "vitest";
import { errosPlanoEntidade, planoEntidadeParaEstado, planoEntidadeSchema, situacaoConvite, totalPlanoEntidade, validadeConvite, type PlanoEntidade } from "../convite";

const agora = new Date("2026-10-06T15:00:00-03:00");
const valido = { usadoEm: null, revogadoEm: null, expiraEm: new Date("2026-10-16T23:59:59-03:00") };

describe("link da entidade — situação (T-L-3 a T-L-6)", () => {
  it("link novo, emenda em rascunho, dentro da validade: vale", () => {
    expect(situacaoConvite(valido, "RASCUNHO", agora)).toBe("VALIDO");
  });
  it("usado uma vez não vale de novo", () => {
    expect(situacaoConvite({ ...valido, usadoEm: agora }, "RASCUNHO", agora)).toBe("USADO");
  });
  it("vencido", () => {
    expect(situacaoConvite(valido, "RASCUNHO", new Date("2026-10-17T00:00:01-03:00"))).toBe("VENCIDO");
  });
  it("revogado pelo gabinete", () => {
    expect(situacaoConvite({ ...valido, revogadoEm: agora }, "RASCUNHO", agora)).toBe("REVOGADO");
  });
  it("emenda fora de rascunho invalida o link", () => {
    for (const s of ["SUBMETIDA", "EM_DILIGENCIA", "APROVADA", "REJEITADA"]) expect(situacaoConvite(valido, s, agora)).toBe("EMENDA_REMETIDA");
  });
  it("validade vai até o fim do dia, em Brasília", () => {
    expect(validadeConvite(10, agora).toISOString()).toBe("2026-10-17T02:59:59.000Z");
  });
});

const plano = (p: Partial<PlanoEntidade> = {}): PlanoEntidade => ({
  responsavelNome: "Maria da Silva",
  responsavelCargo: "Presidente",
  metaFinalistica: "Atender 40 idosos com atividades físicas orientadas",
  metas: [{ beneficiarios: "Idosos do centro de convivência", unidade: "pessoas", quantidade: "40" }],
  etapas: "",
  itens: [
    { descricao: "Colchonete", unidade: "unidade", quantidade: "40", valorUnitario: "89,90", fonteId: "f1", fonteOutra: "", dataConsulta: "2026-10-05", link: "" },
    { descricao: "Instrutor", unidade: "hora", quantidade: "100", valorUnitario: "60,00", fonteId: null, fonteOutra: "Academia X, CNPJ 00.000.000/0001-00", dataConsulta: "2026-10-04", link: "" },
  ],
  parcelas: ["9.596,00"],
  observacao: "",
  ...p,
});
const fontes = [{ id: "f1", nome: "Atas de registro de preços (PNCP)", url: "https://pncp.gov.br/app/atas", orientacao: "", aplicaA: [], tipo: "ATA" as const }];

describe("link da entidade — o envio", () => {
  it("plano completo passa no esquema e nas conferências", () => {
    expect(planoEntidadeSchema.safeParse(plano()).success).toBe(true);
    expect(errosPlanoEntidade(plano(), fontes)).toEqual([]);
    expect(totalPlanoEntidade(plano())).toBe(9596);
  });
  it("sem responsável, sem meta ou sem item o esquema recusa", () => {
    expect(planoEntidadeSchema.safeParse(plano({ responsavelNome: "" })).success).toBe(false);
    expect(planoEntidadeSchema.safeParse(plano({ metas: [] })).success).toBe(false);
    expect(planoEntidadeSchema.safeParse(plano({ itens: [] })).success).toBe(false);
  });
  it("item sem fonte, sem valor ou com fonte inexistente é apontado", () => {
    const p = plano();
    p.itens[0] = { ...p.itens[0], fonteId: null, fonteOutra: "" };
    p.itens[1] = { ...p.itens[1], valorUnitario: "" };
    expect(errosPlanoEntidade(p, fontes)).toEqual(["Item 1: informe de onde tirou o preço.", "Item 2: informe o valor unitário."]);
    expect(errosPlanoEntidade(plano({ itens: [{ ...plano().itens[0], fonteId: "inexistente" }] }), fontes)).toEqual(["Item 1: informe de onde tirou o preço."]);
  });
  it("vira rascunho: cada item ganha a fonte (oficial ou outra) e o preço informado", () => {
    const e = planoEntidadeParaEstado(plano(), fontes);
    expect(e.itens?.map((i) => [i.descricao, i.valorUnitario, i.referencia])).toEqual([
      ["Colchonete", "89,90", "R1"],
      ["Instrutor", "60,00", "R2"],
    ]);
    expect(e.referencias?.map((r) => [r.codigo, r.emissor, r.tipo, r.fonteId, r.data])).toEqual([
      ["R1", "Atas de registro de preços (PNCP)", "ATA", "f1", "2026-10-05"],
      ["R2", "Academia X, CNPJ 00.000.000/0001-00", "COTACAO", null, "2026-10-04"],
    ]);
    expect(e.metaFinalistica).toContain("40 idosos");
    expect(e.parcelas).toEqual(["9.596,00"]);
    // Etapas vazias não apagam as do rascunho.
    expect("etapas" in e).toBe(false);
  });
});
