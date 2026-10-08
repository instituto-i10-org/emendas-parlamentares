import { describe, expect, it } from "vitest";
import { diferencaLegivel, idsDoRegistro, nomeDoRegistro, rotuloAcao, rotuloCampo, rotuloEntidade, valorLegivel } from "../legivel";

describe("auditoria em linguagem simples", () => {
  it("rótulos de entidade, ação e campo em português; desconhecidos viram texto legível", () => {
    expect(rotuloEntidade("Destino")).toBe("Destino");
    expect(rotuloEntidade("AreaAplicacao")).toBe("Área");
    expect(rotuloEntidade("CoisaNova")).toBe("Coisa nova");
    expect(rotuloAcao("MESCLAR")).toBe("Mescla");
    expect(rotuloAcao("ACAO_INEDITA")).toBe("Acao inedita");
    expect(rotuloCampo("unidadeRepasseCodigo")).toBe("Unidade de repasse");
    expect(rotuloCampo("perfilId")).toBe("Perfil");
    expect(rotuloCampo("campoSemNome")).toBe("Campo sem nome");
  });

  it("valores legíveis: sim/não, datas, reais, listas, códigos e ids", () => {
    expect(valorLegivel("ativo", true)).toBe("Sim");
    expect(valorLegivel("ativo", false)).toBe("Não");
    expect(valorLegivel("nome", null)).toBe("—");
    expect(valorLegivel("cotaIndividual", 854797.44).replace(/\s/g, " ")).toBe("R$ 854.797,44");
    expect(valorLegivel("valor", "30000.00").replace(/\s/g, " ")).toBe("R$ 30.000,00");
    expect(valorLegivel("dataVigencia", "2024-01-01T12:00:00.000Z")).toBe("01/01/2024");
    expect(valorLegivel("prazoProtocolo", "2026-10-07T19:33:12.457Z")).toMatch(/^07\/10\/2026,? 16:33$/);
    expect(valorLegivel("apelidos", ["Assoc. Benef. Teste", "Outra"])).toBe("Assoc. Benef. Teste, Outra");
    expect(valorLegivel("execucao", "DIRETA")).toBe("Direta");
    expect(valorLegivel("status", "APROVADA")).toBe("Aprovada");
    expect(valorLegivel("perfilId", "cmuvp0zbo0001drrq04mdmpio", { cmuvp0zbo0001drrq04mdmpio: "Vereador" })).toBe("Vereador");
    expect(valorLegivel("perfilId", "cmuvp0zbo0001drrq04mdmpio")).toBe("—");
  });

  it("só os campos que mudaram, sem id nem carimbos técnicos", () => {
    const antes = { id: "cmuyi8taq00vnjk8zenfukk8o", nome: "Associação Beneficente Teste", ativo: true, apelidos: [], createdAt: "2026-10-07T19:32:54.482Z", updatedAt: "2026-10-07T19:32:54.482Z", criadoPorId: "cmuvp0zep0005drrqr8l8z2fu", cnpj: null };
    const depois = { ...antes, apelidos: ["Assoc. Benef. Teste"], updatedAt: "2026-10-07T19:33:12.457Z" };
    const g = diferencaLegivel(antes, depois);
    expect(g).toEqual([{ titulo: null, linhas: [{ campo: "Também grafado", antes: "—", depois: "Assoc. Benef. Teste" }] }]);
  });

  it("mescla: mantido e removido viram grupos, cada um com o que mudou", () => {
    const base = { id: "cmuyi7x1k00vljk8z3x2n29kq", nome: "Assoc. Benef. Teste", ativo: true, mescladoEmId: null, apelidos: [] };
    const mant = { id: "cmuyi8taq00vnjk8zenfukk8o", nome: "Associação Beneficente Teste", ativo: true, apelidos: [] };
    const g = diferencaLegivel(
      { mantido: mant, removido: base },
      { mantido: { ...mant, apelidos: ["Assoc. Benef. Teste"] }, removido: { ...base, ativo: false, mescladoEmId: mant.id }, emendasReapontadas: 0 },
      { [mant.id]: "Associação Beneficente Teste" }
    );
    expect(g[0]).toEqual({ titulo: null, linhas: [{ campo: "Emendas transferidas", antes: "—", depois: "0" }] });
    expect(g[1]).toEqual({ titulo: "Mantido", linhas: [{ campo: "Também grafado", antes: "—", depois: "Assoc. Benef. Teste" }] });
    expect(g[2].titulo).toBe("Removido");
    expect(g[2].linhas).toEqual([
      { campo: "Ativo", antes: "Sim", depois: "Não" },
      { campo: "Mesclado em", antes: "—", depois: "Associação Beneficente Teste" },
    ]);
  });

  it("criação mostra os campos preenchidos; nada vaza de JSON", () => {
    const g = diferencaLegivel(null, { id: "cmuyi7x1k00vljk8z3x2n29kq", nome: "Teste", orgaos: ["13", "20"], ordem: 9 });
    expect(g[0].linhas).toEqual([
      { campo: "Nome", antes: "—", depois: "Teste" },
      { campo: "Órgãos", antes: "—", depois: "13, 20" },
      { campo: "Ordem", antes: "—", depois: "9" },
    ]);
    for (const l of g.flatMap((x) => x.linhas)) expect(`${l.antes}${l.depois}`).not.toMatch(/[{}"]/);
  });

  it("nome do registro e ids para buscar nomes", () => {
    expect(nomeDoRegistro({ nome: "A" }, { nome: "B" })).toBe("B");
    expect(nomeDoRegistro({ mantido: { nome: "C" } }, null)).toBe("C");
    expect(idsDoRegistro({ id: "cmuyi7x1k00vljk8z3x2n29kq", perfilId: "cmuvp0zbo0001drrq04mdmpio" }, null)).toEqual(["cmuvp0zbo0001drrq04mdmpio"]);
  });
});
