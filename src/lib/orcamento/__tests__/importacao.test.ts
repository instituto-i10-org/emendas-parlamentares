import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { codigosDeExibicao } from "../codigo-dotacao";
import { aplicarMapa, mapearCabecalho } from "../colunas";
import {
  conferirTotal,
  lerFuncional,
  lerNatureza,
  lerValor,
  planejarRecarga,
  totalizar,
  validarDotacao,
  validarPrioridade,
  validarProgramaPpa,
  type BaseExistente,
  type LinhaDotacao,
} from "../importacao";
import { decodificarTexto, detectarSeparador, lerCsv, lerPlanilha } from "../planilha";

const linha = (extra: Record<string, string> = {}) => ({
  orgao_codigo: "02",
  unidade_codigo: "02.05.02",
  unidade_nome: "Fundo Municipal de Saúde",
  funcao_codigo: "10",
  subfuncao_codigo: "301",
  programa_codigo: "0011",
  programa_nome: "Saúde para todos",
  acao_codigo: "2031",
  acao_nome: "Atenção básica",
  natureza_codigo: "4.4.90.52",
  fonte_codigo: "1",
  aplicacao_codigo: "310.0000",
  valor_autorizado: "398.820,00",
  ...extra,
});

describe("leitura de valores, natureza e funcional", () => {
  it("valores em formato brasileiro, decimal com ponto e milhar americano", () => {
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("1000.50")).toBe(1000.5);
    expect(lerValor("1.000")).toBe(1000);
    expect(lerValor("1,234.50")).toBe(1234.5);
    expect(lerValor("R$ 5.000,00")).toBe(5000);
    expect(lerValor("abc")).toBeNull();
  });
  it("natureza com ou sem pontos, e categoria inválida recusada", () => {
    expect(lerNatureza("33903000")?.codigo).toBe("3.3.90.30");
    expect(lerNatureza("4.4.90.52.00")?.codigo).toBe("4.4.90.52");
    expect(lerNatureza("7.1.90.30")).toBeNull();
  });
  it("funcional programática supre função, subfunção, programa e ação", () => {
    expect(lerFuncional("04.122.0002.2015")).toEqual({ funcao: "04", subfuncao: "122", programa: "0002", acao: "2015" });
    expect(lerFuncional("041220002 2015")).toEqual({ funcao: "04", subfuncao: "122", programa: "0002", acao: "2015" });
  });
});

describe("T-2.2 derivação e integridade", () => {
  it("deriva os oito componentes; órgão é a unidade sem o último segmento", () => {
    const r = validarDotacao(linha());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.orgao.codigo).toBe("02.05");
    expect(r.valor.funcao).toEqual({ codigo: "10", nome: "Saúde" });
    expect(r.valor.subfuncao).toEqual({ codigo: "301", nome: "Atenção Básica" });
    expect(r.valor.fonte.codigo).toBe("01.310.0000");
    expect(r.valor.natureza).toMatchObject({ grupo: "4", modalidade: "90", elemento: "52", nome: "Equipamentos e material permanente" });
    expect(r.valor.acao.tipo).toBe("ATIVIDADE");
    expect(r.valor.valor).toBe(398820);
  });
  it("T-2.2-1 linha sem fonte é recusada sozinha, com motivo", () => {
    expect(validarDotacao(linha({ fonte_codigo: "" }))).toEqual({ ok: false, motivos: ["Fonte de recurso ausente."] });
  });
  it("T-2.2-3 nome da função e da subfunção vêm da tabela oficial", () => {
    const r = validarDotacao(linha({ funcao_codigo: "12", subfuncao_codigo: "365" }));
    expect(r.ok && [r.valor.funcao.nome, r.valor.subfuncao.nome]).toEqual(["Educação", "Educação Infantil"]);
  });
  it("T-2.1-4 unidade de outro órgão: recusada com o motivo", () => {
    const r = validarDotacao(linha({ orgao_codigo: "01" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivos[0]).toMatch(/não pertence ao órgão 01/);
  });
  it("vários problemas na mesma linha saem todos", () => {
    const r = validarDotacao(linha({ programa_codigo: "", valor_autorizado: "-1", natureza_codigo: "x" }));
    expect(!r.ok && r.motivos).toEqual(["Programa ausente.", 'Natureza da despesa "x" inválida (use 3.3.90.30).', "Valor negativo."]);
  });
  it("nome ausente vem da base existente; sem base, a unidade e a ação recusam e o programa fica provisório", () => {
    const base: BaseExistente = { orgaos: {}, unidades: { "02.05.02": "FMS" }, programas: { "0011": "Saúde" }, acoes: { "0011|2031": "AB" } };
    expect(validarDotacao(linha({ unidade_nome: "", programa_nome: "", acao_nome: "" }), base).ok).toBe(true);
    const r = validarDotacao(linha({ programa_nome: "" }));
    expect(r.ok && r.valor.programa.nome).toBe("Programa 0011");
    expect(validarDotacao(linha({ acao_nome: "" })).ok).toBe(false);
  });
});

describe("T-2.1-5 e T-2.1-6 prioridades da LDO e programas do PPA", () => {
  const base: BaseExistente = { orgaos: {}, unidades: { "02.05.02": "FMS" }, programas: { "0011": "Saúde" }, acoes: { "0011|2031": "AB" } };
  it("prioridade com programa ou ação inexistente é recusada", () => {
    expect(validarPrioridade({ programa_codigo: "0011", descricao: "Ampliar atenção básica" }, base).ok).toBe(true);
    const r = validarPrioridade({ programa_codigo: "9999", descricao: "x" }, base);
    expect(!r.ok && r.motivos).toEqual(["O programa 9999 não existe na base do exercício."]);
    const a = validarPrioridade({ programa_codigo: "0011", acao_codigo: "1234", descricao: "x" }, base);
    expect(!a.ok && a.motivos).toEqual(["A ação 1234 não existe no programa 0011."]);
  });
  it("programa do PPA com unidade inexistente é recusado; meta inválida também", () => {
    expect(validarProgramaPpa({ programa_codigo: "0011", programa_nome: "Saúde", meta_exercicio: "1.200" }, base)).toMatchObject({ ok: true, valor: { metaExercicio: 1200 } });
    const r = validarProgramaPpa({ programa_codigo: "0011", programa_nome: "Saúde", unidade_codigo: "09.99", meta_exercicio: "muito" }, base);
    expect(!r.ok && r.motivos.length).toBe(2);
  });
});

describe("T-2.1-7 mapeamento de colunas por sinônimos", () => {
  it("cabeçalho de outra prefeitura é reconhecido; o que falta é apontado", () => {
    const m = mapearCabecalho("DOTACOES", ["Órgão", "Unidade Executora", "Nome da Unidade", "Funcional Programática", "Nome do Programa", "Especificação", "Natureza", "Fonte", "Aplicação", "Ficha", "Valor Orçado"]);
    expect(Object.keys(m.mapa)).toEqual(
      expect.arrayContaining(["orgao_codigo", "unidade_codigo", "unidade_nome", "funcional", "programa_nome", "acao_nome", "natureza_codigo", "fonte_codigo", "aplicacao_codigo", "ficha", "valor_autorizado"])
    );
    expect(m.faltam).toEqual([]);
    expect(mapearCabecalho("DOTACOES", ["unidade", "valor"]).faltam).toContain("natureza_codigo");
  });
});

describe("T-2.1-2 e T-2.1-3 planilhas: acentos, separador, zeros à esquerda", () => {
  const csv =
    "orgao;unidade_codigo;unidade_nome;funcao_codigo;subfuncao_codigo;programa_codigo;programa_nome;acao_codigo;acao_nome;natureza_codigo;fonte_codigo;valor_autorizado\n" +
    "02;02.04.02;Educação Básica;12;361;0009;Educação;1007;Obras escolares;4.4.90.51;01;1.000,00\n";
  it("UTF-8 sem marca de ordem mantém o acento", () => {
    const d = decodificarTexto(new TextEncoder().encode(csv));
    expect(d.codificacao).toBe("utf-8");
    expect(d.texto).toContain("Educação");
  });
  it("Windows-1252 também é lido", () => {
    const latin = Uint8Array.from([..."unidade_nome\nEduca"].map((c) => c.charCodeAt(0)).concat([0xe7, 0xe3, 0x6f]));
    expect(decodificarTexto(latin).texto).toContain("Educação");
  });
  it("separador ponto e vírgula; zeros à esquerda preservados", () => {
    expect(detectarSeparador(csv)).toBe(";");
    const p = lerPlanilha("DOTACOES", "base.csv", new TextEncoder().encode(csv));
    const r = aplicarMapa(p.linhas[0].celulas, mapearCabecalho("DOTACOES", p.cabecalho).mapa);
    expect(r.programa_codigo).toBe("0009");
    expect(r.orgao_codigo).toBe("02");
    expect(p.linhas[0].numero).toBe(2);
  });
  it("aspas com separador e quebra de linha dentro", () => {
    expect(lerCsv('a;"b;c";"d\ne"\n1;2;3', ";")).toEqual([["a", "b;c", "d\ne"], ["1", "2", "3"]]);
  });
  it("XLSX com título antes do cabeçalho e código numérico com zero à esquerda", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Quadro de detalhamento da despesa"], ["unidade_codigo", "programa_codigo", "valor_autorizado"], ["02.04.02", "0009", 1234.5]]);
    ws["B3"] = { t: "n", v: 9, w: "0009", z: "0000" };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QDD");
    const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    const p = lerPlanilha("DOTACOES", "base.xlsx", bytes);
    expect(p.linhaCabecalho).toBe(2);
    expect(p.linhas[0].celulas).toEqual(["02.04.02", "0009", "1234.5"]);
  });
});

describe("T-2.1-1 a base real de Mogi Guaçu (QDD do PL 264/2026)", () => {
  it("803 linhas, nenhuma recusada, soma R$ 1.083.895.132,00", () => {
    const loa = JSON.parse(readFileSync(path.resolve(process.cwd(), "prisma/dados/mogi-guacu/loa-2027.json"), "utf8")) as {
      dotacoes: { ficha: string; nome: string; actionCode: string; uo: string; unitName: string; funcao: string; subf: string; prog: string; programName: string; gnd: string; mod: string; elem: string; sourceCode: string; applicationCode: string; autorizado: number }[];
    };
    const categoria = (gnd: string) => (gnd === "9" ? "9" : Number(gnd) >= 4 ? "4" : "3");
    const r = loa.dotacoes.map((d) =>
      validarDotacao({
        unidade_codigo: d.uo,
        unidade_nome: d.unitName,
        funcao_codigo: d.funcao,
        subfuncao_codigo: d.subf,
        programa_codigo: d.prog,
        programa_nome: d.programName,
        acao_codigo: d.actionCode,
        acao_nome: d.nome,
        natureza_codigo: `${categoria(d.gnd)}.${d.gnd}.${d.mod}.${d.elem}`,
        fonte_codigo: d.sourceCode,
        aplicacao_codigo: d.applicationCode,
        ficha: d.ficha,
        valor_autorizado: String(d.autorizado),
      })
    );
    expect(r.filter((x) => !x.ok)).toEqual([]);
    const t = totalizar(r.flatMap((x) => (x.ok ? [x.valor] : [])));
    expect(t.linhas).toBe(803);
    expect(conferirTotal(t.totalLido, 1_083_895_132)).toEqual({ bate: true, diferenca: 0 });
    expect(t.porOrgao.find((o) => o.codigo === "01")?.valor).toBe(16_260_000);
  });
});

describe("T-2.3-2 conferência de totais", () => {
  it("total impresso diferente: não bate e mostra a diferença", () => {
    expect(conferirTotal(1000, 1000.01)).toEqual({ bate: false, diferenca: -0.01 });
    expect(conferirTotal(1000, null)).toEqual({ bate: false, diferenca: null });
  });
});

describe("T-2.3-4 recarga segura", () => {
  const nova = (extra: Record<string, string> = {}): LinhaDotacao => {
    const r = validarDotacao(linha({ ficha: "10", ...extra }));
    if (!r.ok) throw new Error(r.motivos.join());
    return r.valor;
  };
  const existente = { id: "d1", unidade: "02.05.02", programa: "0011", acao: "2031", natureza: "4.4.90.52", fonte: "01.310.0000", ficha: "10", valor: 398820, emendas: [] as string[] };
  it("mesma ficha: atualiza no lugar, preservando o id", () => {
    const p = planejarRecarga([existente], [nova({ valor_autorizado: "400.000,00" })]);
    expect(p.atualizar).toEqual([{ id: "d1", indice: 0, mudouClassificacao: false, mudouValor: true }]);
    expect(p.travas).toEqual([]);
  });
  it("dotação com emenda que mudaria de classificação trava", () => {
    const p = planejarRecarga([{ ...existente, emendas: ["nº 3"] }], [nova({ natureza_codigo: "3.3.90.30" })]);
    expect(p.travas[0].motivo).toMatch(/mudaria de classificação.*nº 3/);
  });
  it("dotação com emenda que sairia da base trava; sem emenda, só desativa", () => {
    const p = planejarRecarga([{ ...existente, emendas: ["rascunho"] }, { ...existente, id: "d2", ficha: "11" }], []);
    expect(p.desativar).toEqual(["d1", "d2"]);
    expect(p.travas.map((x) => x.id)).toEqual(["d1"]);
  });
  it("linha nova sem correspondente é criada", () => {
    expect(planejarRecarga([], [nova()]).criar).toEqual([0]);
  });
});

describe("códigos de exibição", () => {
  it("únicos quando a ação se repete", () => {
    const linhas = [
      { actionCode: "2001", elem: "52", ficha: "470", pagina: 10 },
      { actionCode: "2001", elem: "52", ficha: "Não legível", pagina: 11 },
      { actionCode: "2002", elem: "30", ficha: "1", pagina: 12 },
    ];
    expect(codigosDeExibicao(linhas, new Set())).toEqual(["2001.52", "2001.52/p11", "2002"]);
  });
});
