import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { CAMPOS_DESTINOS, CAMPOS_HISTORICO, lerTabela, modeloCsv, planejarDestinos, planejarHistorico, type DestinoExistente } from "../planilhas";

const csv = (texto: string, codificacao: "utf-8" | "windows-1252" = "utf-8") =>
  codificacao === "utf-8" ? new TextEncoder().encode(texto) : Uint8Array.from([...texto].map((ch) => (ch === "ç" ? 0xe7 : ch === "ã" ? 0xe3 : ch === "é" ? 0xe9 : ch.charCodeAt(0))));

const unidades = new Set(["13.01", "14.01", "11.01"]);

const EXISTENTE: DestinoExistente = {
  id: "d1",
  nome: "Associação Ágape",
  nomeOficial: "ASSOCIACAO AGAPE",
  execucao: "INDIRETA",
  unidadeCodigo: null,
  unidadeRepasseCodigo: "14.01",
  endereco: "Rua Sidney Canavezzi, 121",
  cnpj: "32832327000116",
  cnes: null,
  inep: null,
  populacaoReferencia: null,
  fontePopulacao: null,
  ativo: true,
};

describe("planilha de destinos", () => {
  const texto =
    "nome;execucao;unidade;unidade_repasse;endereco;cnpj;populacao\n" +
    "UBS Jardim Teste;direta;13.01;;Rua A, 10;;5000\n" +
    "EMEF Nova;Direta;11.01;;Rua B, 20;;\n" +
    "Assoc. Ágape;indireta;;14.01;Rua Sidney Canavezzi, 121;;120\n" +
    ";direta;13.01;;Rua C, 30;;\n" +
    "UBS Jardim Teste;direta;13.01;;Rua A, 10;;5000\n";

  it("2 novos, 1 atualizado (pela grafia do nome), 1 recusado e a linha repetida recusada", () => {
    const t = lerTabela(CAMPOS_DESTINOS, "destinos.csv", csv(texto));
    expect(t.faltam).toEqual([]);
    const p = planejarDestinos(t, [EXISTENTE], unidades);
    expect(p.novos.map((n) => n.dados.nome)).toEqual(["UBS Jardim Teste", "EMEF Nova"]);
    expect(p.atualizados).toHaveLength(1);
    expect(p.atualizados[0].id).toBe("d1");
    // O nome cadastrado fica; a grafia da planilha vira "também grafado".
    expect(p.atualizados[0].mudancas.map((m) => m.campo)).toEqual(["População de referência", "Também grafado"]);
    expect(p.atualizados[0].dados.nome).toBe("Associação Ágape");
    expect(p.atualizados[0].apelido).toBe("Assoc. Ágape");
    // O vazio da planilha não apaga o CNPJ cadastrado.
    expect(p.atualizados[0].dados.cnpj).toBe("32832327000116");
    expect(p.recusados.map((r) => r.linha)).toEqual([5, 6]);
    expect(p.recusados[0].motivos[0]).toMatch(/Nome/);
    expect(p.recusados[1].motivos[0]).toMatch(/Repetido/);
  });

  it("acha pelo CNPJ mesmo com outro nome", () => {
    const t = lerTabela(CAMPOS_DESTINOS, "d.csv", csv("nome;execucao;unidade_repasse;endereco;cnpj\nCasa Ágape;indireta;14.01;Rua X, 1;32.832.327/0001-16\n"));
    const p = planejarDestinos(t, [EXISTENTE], unidades);
    expect(p.atualizados[0]?.id).toBe("d1");
  });

  it("unidade inexistente, execução inválida e CNPJ curto são recusados com o motivo", () => {
    const t = lerTabela(CAMPOS_DESTINOS, "d.csv", csv("nome;execucao;unidade;endereco;cnpj\nUBS X;direta;99.01;Rua Y, 2;\nCasa Y;mista;;Rua Z, 3;123\n"));
    const p = planejarDestinos(t, [], unidades);
    expect(p.recusados[0].motivos.join(" ")).toMatch(/99\.01 não existe/);
    expect(p.recusados[1].motivos.join(" ")).toMatch(/direta.*indireta/);
    expect(p.recusados[1].motivos.join(" ")).toMatch(/14 dígitos/);
  });

  it("Windows-1252 com sinônimos de cabeçalho", () => {
    const t = lerTabela(CAMPOS_DESTINOS, "d.csv", csv("Destino;Forma de execução;UO;Endereço\nCreche São João;direta;11.01;Rua das Flores, 5\n", "windows-1252"));
    expect(t.faltam).toEqual([]);
    const p = planejarDestinos(t, [], unidades);
    expect(p.novos[0].dados.nome).toBe("Creche São João");
  });

  it("XLSX com título antes do cabeçalho", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Destinos de Mogi"], [], ["nome", "execucao", "unidade", "endereco"], ["CEI Teste", "direta", "11.01", "Rua K, 9"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "D");
    const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    const t = lerTabela(CAMPOS_DESTINOS, "d.xlsx", bytes);
    expect(planejarDestinos(t, [], unidades).novos[0].linha).toBe(4);
  });

  it("falta coluna obrigatória: nada é planejado", () => {
    const t = lerTabela(CAMPOS_DESTINOS, "d.csv", csv("nome;unidade\nX;13.01\n"));
    expect(t.faltam).toEqual(["Execução (direta ou indireta)", "Endereço"]);
    expect(planejarDestinos(t, [], unidades).novos).toEqual([]);
  });

  it("modelo começa com a marca de ordem e traz as colunas", () => {
    expect(modeloCsv(CAMPOS_DESTINOS).startsWith("﻿nome;nome_oficial;execucao")).toBe(true);
  });
});

describe("planilha de emendas de anos anteriores", () => {
  const anos = new Set([2026, 2027]);
  const texto =
    "ano;numero;autor;descricao;valor;parcela\n" +
    "2026;1;Ana Souza;Aquisição de cadeiras para a UBS;R$ 30.000,00;saúde\n" +
    "2026;2;Bruno Lima;Material pedagógico para a EMEF;15.000,50;demais\n" +
    "2026;3;Ana Souza;Reforma da quadra;10000;\n" +
    "2025;4;Ana Souza;Ano sem exercício;1000;\n" +
    "2026;2;Bruno Lima;Repetida;1;\n";

  it("novas, atualizada, recusas e autores novos", () => {
    const t = lerTabela(CAMPOS_HISTORICO, "h.csv", csv(texto));
    const existentes = [{ ano: 2026, numero: 3, autor: "Ana Souza", descricao: "Reforma da quadra", valor: 9000, parcela: null }];
    const p = planejarHistorico(t, existentes, anos, ["Bruno Lima"]);
    expect(p.novas.map((n) => n.dados.numero)).toEqual([1, 2]);
    expect(p.novas[0].dados).toMatchObject({ valor: 30000, parcela: "SAUDE" });
    expect(p.novas[1].dados.valor).toBe(15000.5);
    expect(p.atualizadas).toHaveLength(1);
    expect(p.atualizadas[0].mudancas[0].campo).toBe("Valor");
    expect(p.recusados.map((r) => r.linha)).toEqual([5, 6]);
    expect(p.recusados[0].motivos[0]).toMatch(/2025 não está cadastrado/);
    expect(p.autoresNovos).toEqual(["Ana Souza"]);
  });

  it("parcela inválida é recusada", () => {
    const t = lerTabela(CAMPOS_HISTORICO, "h.csv", csv("ano;numero;autor;descricao;valor;parcela\n2026;9;Ana Souza;Algo bom aqui;100;educação\n"));
    expect(planejarHistorico(t, [], anos, []).recusados[0].motivos[0]).toMatch(/Parcela/);
  });
});
