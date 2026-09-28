import { describe, expect, it } from "vitest";
import { lerValor, validarLinhas } from "../importacao";
import { codigosDeExibicao } from "../codigo-dotacao";

const linha = (extra: Record<string, string> = {}) => ({
  orgao_codigo: "13",
  orgao_nome: "Secretaria de Saúde",
  unidade_codigo: "13.01",
  unidade_nome: "Atenção Básica",
  funcao_codigo: "10",
  subfuncao_codigo: "301",
  subfuncao_nome: "Atenção Básica",
  programa_codigo: "1001",
  programa_nome: "Atenção básica à saúde",
  acao_codigo: "2001",
  acao_nome: "Atendimentos atenção básica",
  natureza_codigo: "4.4.90.52",
  fonte_codigo: "05.3610000",
  valor_autorizado: "398.820,00",
  ...extra,
});

describe("importação da base de dotações", () => {
  it("lê valores em formato brasileiro e decimal com ponto", () => {
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("1000.50")).toBe(1000.5);
    expect(lerValor("1.000")).toBe(1000);
    expect(lerValor("R$ 5.000,00")).toBe(5000);
    expect(lerValor("abc")).toBeNull();
  });

  it("valida a linha e deduz o tipo da ação pela numeração", () => {
    const r = validarLinhas([linha()]);
    expect(r.erros).toEqual([]);
    expect(r.dotacoes[0].acao.tipo).toBe("ATIVIDADE");
    expect(r.dotacoes[0].natureza).toMatchObject({ grupo: "4", modalidade: "90", elemento: "52" });
    expect(r.dotacoes[0].valor).toBe(398820);
  });

  it("acusa colunas ausentes, campos vazios e valores inválidos", () => {
    const semColuna = linha();
    delete (semColuna as Record<string, string>).fonte_codigo;
    expect(validarLinhas([semColuna]).erros[0].motivo).toMatch(/fonte_codigo/);
    expect(validarLinhas([linha({ programa_codigo: "" })]).erros[0]).toMatchObject({ linha: 2 });
    expect(validarLinhas([linha({ valor_autorizado: "-1" })]).erros[0].motivo).toMatch(/valor_autorizado/);
    expect(validarLinhas([linha({ natureza_codigo: "x" })]).erros[0].motivo).toMatch(/natureza_codigo/);
    expect(validarLinhas([linha({ acao_tipo: "xpto" })]).erros[0].motivo).toMatch(/acao_tipo/);
  });

  it("gera códigos de exibição únicos quando a ação se repete", () => {
    const linhas = [
      { actionCode: "2001", elem: "52", ficha: "470", pagina: 10 },
      { actionCode: "2001", elem: "52", ficha: "Não legível", pagina: 11 },
      { actionCode: "2002", elem: "30", ficha: "1", pagina: 12 },
    ];
    expect(codigosDeExibicao(linhas, new Set())).toEqual(["2001.52", "2001.52/p11", "2002"]);
  });
});
