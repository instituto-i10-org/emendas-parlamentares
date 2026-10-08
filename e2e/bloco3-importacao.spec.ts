import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { entrar, sql, confirmarNaJanela } from "./apoio";

// Importação da base (itens 2.1, 2.2 e 2.3): planilhas em vários formatos,
// mapeamento de colunas, LDO e PPA, conferência de totais, correção e recarga.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

type Linha = Record<string, string>;
const CAB = ["orgao_codigo", "unidade_codigo", "unidade_nome", "funcao_codigo", "subfuncao_codigo", "programa_codigo", "programa_nome", "acao_codigo", "acao_nome", "natureza_codigo", "fonte_codigo", "aplicacao_codigo", "ficha", "valor_autorizado"];

// A base real do PL 264/2026, como planilha.
function baseMogi(): Linha[] {
  const loa = JSON.parse(readFileSync(path.resolve("prisma/dados/mogi-guacu/loa-2027.json"), "utf8")) as {
    dotacoes: { ficha: string; nome: string; actionCode: string; uo: string; unitName: string; funcao: string; subf: string; prog: string; programName: string; gnd: string; mod: string; elem: string; sourceCode: string; applicationCode: string; autorizado: number }[];
  };
  const cat = (g: string) => (g === "9" ? "9" : Number(g) >= 4 ? "4" : "3");
  return loa.dotacoes.map((d) => ({
    orgao_codigo: d.uo.split(".")[0],
    unidade_codigo: d.uo,
    unidade_nome: d.unitName,
    funcao_codigo: d.funcao,
    subfuncao_codigo: d.subf,
    programa_codigo: d.prog,
    programa_nome: d.programName,
    acao_codigo: d.actionCode,
    acao_nome: d.nome,
    natureza_codigo: `${cat(d.gnd)}.${d.gnd}.${d.mod}.${d.elem}`,
    fonte_codigo: d.sourceCode,
    aplicacao_codigo: d.applicationCode,
    ficha: d.ficha,
    valor_autorizado: d.autorizado.toFixed(2).replace(".", ","),
  }));
}

const csv = (linhas: Linha[], cab = CAB, sep = ";") => [cab.join(sep), ...linhas.map((l) => cab.map((c) => l[c] ?? "").join(sep))].join("\n") + "\n";

function xlsx(linhas: Linha[]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([CAB, ...linhas.map((l) => CAB.map((c) => l[c] ?? ""))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "QDD");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

async function novoInstrumento(numero: string, tipo: "LOA" | "LDO" | "PPA" = "LOA", total?: number) {
  const [ex] = await sql<{ id: string }>(`select id from "Exercicio" where ano = 2027`);
  await sql(`delete from "InstrumentoPlanejamento" where numero = $1`, [numero]);
  const [i] = await sql<{ id: string }>(
    `insert into "InstrumentoPlanejamento" (id, tipo, especie, numero, ementa, "exercicioId", status, "totalImpresso", "createdAt", "updatedAt")
     values ('inst-' || md5(random()::text), $1, 'PROJETO_LEI', $2, 'Instrumento de teste da importação', $3, 'EM_ELABORACAO', $4, now(), now()) returning id`,
    [tipo, numero, ex.id, total ?? null]
  );
  return i.id;
}

async function importar(page: Page, numero: string, arquivo: { name: string; mimeType: string; buffer: Buffer }) {
  await page.goto("/executivo/planejamento");
  const linha = page.locator("tr", { hasText: numero });
  await linha.getByRole("button", { name: /Importar base/ }).click();
  await page.locator("#imp-arq").setInputFiles(arquivo);
  await expect(page.getByRole("link", { name: arquivo.name })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Ler e conferir" }).click();
  await expect(page).toHaveURL(/\/importacao\//, { timeout: 60_000 });
  return page.url().split("/").pop()!.split("?")[0];
}

// Os instrumentos criados aqui são projetos de lei de 2027: saem no fim para
// não se somarem à base que as emendas dos outros testes percorrem.
test.afterAll(async () => {
  // As prioridades da LDO de teste saem antes do instrumento (a chave dele
  // ficaria nula e a prioridade valeria para as specs seguintes).
  await sql(
    `delete from "PrioridadeLdo" where "instrumentoId" in (select id from "InstrumentoPlanejamento" where numero like 'PL TESTE-%' or numero in ('PL LDO-TESTE', 'PL PPA-TESTE'))`
  );
  await sql(`delete from "InstrumentoPlanejamento" where numero like 'PL TESTE-%' or numero in ('PL LDO-TESTE', 'PL PPA-TESTE')`);
});

test.describe("Importação por planilha", () => {
  test.setTimeout(240_000);

  test("T-2.1-2 e T-2.3-1 CSV UTF-8 sem marca de ordem: acentos certos; nada gravado antes da confirmação", async ({ page }) => {
    await novoInstrumento("PL TESTE-ACENTO", "LOA", 1500);
    await entrar(page, "admin");
    const conteudo = csv([
      { orgao_codigo: "02", unidade_codigo: "02.92", unidade_nome: "Educação Básica", funcao_codigo: "12", subfuncao_codigo: "361", programa_codigo: "0009", programa_nome: "Educação de qualidade", acao_codigo: "1007", acao_nome: "Obras escolares", natureza_codigo: "4.4.90.51", fonte_codigo: "1", aplicacao_codigo: "110.0000", ficha: "9001", valor_autorizado: "1.000,00" },
      { orgao_codigo: "02", unidade_codigo: "02.92", unidade_nome: "Educação Básica", funcao_codigo: "12", subfuncao_codigo: "361", programa_codigo: "0009", programa_nome: "Educação de qualidade", acao_codigo: "1007", acao_nome: "Obras escolares", natureza_codigo: "4.4.90.52", fonte_codigo: "1", aplicacao_codigo: "110.0000", ficha: "9002", valor_autorizado: "500,00" },
    ]);
    const id = await importar(page, "PL TESTE-ACENTO", { name: "base-acento.csv", mimeType: "text/csv", buffer: Buffer.from(conteudo, "utf8") });
    await expect(page.getByText("Linhas válidas", { exact: true })).toBeVisible();
    await expect(page.getByText(/Educação Básica/).first()).toBeVisible();
    const antes = await sql<{ n: string }>(`select count(*) n from "Dotacao" d join "InstrumentoPlanejamento" i on i.id = d."instrumentoId" where i.numero = 'PL TESTE-ACENTO'`);
    expect(Number(antes[0].n)).toBe(0);
    await page.getByRole("button", { name: "Confirmar carga" }).click();
    await confirmarNaJanela(page, "Confirmar carga");
    await expect(page.getByText(/2 dotações gravadas/)).toBeVisible({ timeout: 60_000 });
    const u = await sql<{ nome: string }>(`select nome from "UnidadeOrcamentaria" where codigo = '02.92'`);
    expect(u[0].nome).toBe("Educação Básica");
    const reg = await sql(`select 1 from "AuditLog" where acao = 'IMPORTAR_BASE' and "dadosDepois"::text like $1`, [`%${id}%`]);
    expect(reg.length).toBe(1);
  });

  test("T-2.1-3, T-2.1-4 e T-2.2-1 linhas inválidas: cada uma com número e motivo, em páginas; as válidas seguem", async ({ page }) => {
    await novoInstrumento("PL TESTE-ERROS", "LOA", 100);
    await entrar(page, "admin");
    const boa = { orgao_codigo: "02", unidade_codigo: "02.95", unidade_nome: "Saúde", funcao_codigo: "10", subfuncao_codigo: "301", programa_codigo: "1001", programa_nome: "Saúde", acao_codigo: "2031", acao_nome: "Atenção básica", natureza_codigo: "3.3.90.30", fonte_codigo: "1", aplicacao_codigo: "310.0000", ficha: "", valor_autorizado: "100,00" };
    const ruins = Array.from({ length: 60 }, (_, i) => ({ ...boa, ficha: String(i + 1), valor_autorizado: "abc" }));
    const outroOrgao = { ...boa, orgao_codigo: "01", ficha: "61" };
    const semFonte = { ...boa, fonte_codigo: "", ficha: "62" };
    await importar(page, "PL TESTE-ERROS", { name: "base-erros.csv", mimeType: "text/csv", buffer: Buffer.from(csv([boa, ...ruins, outroOrgao, semFonte]), "utf8") });
    await expect(page.getByRole("link", { name: "Recusadas (62)" })).toBeVisible();
    await expect(page.getByText("linha 3", { exact: true })).toBeVisible();
    await expect(page.getByText('Valor "abc" inválido.').first()).toBeVisible();
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await page.getByRole("link", { name: "Próxima" }).click();
    await expect(page.getByText(/não pertence ao órgão 01/)).toBeVisible();
    await expect(page.getByText("Fonte de recurso ausente.")).toBeVisible();
    await expect(page.getByText("Linhas válidas", { exact: true }).locator("..")).toContainText(/Linhas válidas\s*1$/);
    const rel = await page.request.get(page.url().replace(/\?.*$/, "").replace("/executivo/planejamento/importacao/", "/api/importacao/") + "/relatorio");
    const texto = await rel.text();
    expect(texto.split("\r\n").filter(Boolean).length).toBe(1 + 62);
  });

  test("T-2.1-7 planilha com cabeçalho de outro formato: ligar a coluna que faltou", async ({ page }) => {
    await novoInstrumento("PL TESTE-MAPA", "LOA", 250);
    await entrar(page, "admin");
    const cab = ["Órgão", "Unidade Executora", "Nome da Unidade", "Funcional Programática", "Nome do Programa", "Especificação", "Elemento", "Fonte", "Aplicação", "Ficha", "Quantia"];
    const linha = ["02", "02.95", "Saúde", "10.301.1001.2031", "Saúde", "Atenção básica", "3.3.90.30", "1", "310.0000", "77", "250,00"];
    await importar(page, "PL TESTE-MAPA", { name: "outro-formato.csv", mimeType: "text/csv", buffer: Buffer.from([cab.join(";"), linha.join(";")].join("\n") + "\n") });
    await expect(page.getByText("Colunas da planilha")).toBeVisible();
    await page.locator("#map-valor_autorizado").selectOption({ label: "Quantia" });
    await page.getByRole("button", { name: "Ler a planilha com estas colunas" }).click();
    await expect(page.getByText("Linhas válidas", { exact: true })).toBeVisible();
    await expect(page.getByText("confere")).toBeVisible();
  });

  test("T-2.3-2 e T-2.3-3 total impresso errado trava; corrigir a linha libera; a correção fica auditada", async ({ page }) => {
    await novoInstrumento("PL TESTE-TOTAL", "LOA", 300);
    await entrar(page, "admin");
    const l = { orgao_codigo: "02", unidade_codigo: "02.95", unidade_nome: "Saúde", funcao_codigo: "10", subfuncao_codigo: "301", programa_codigo: "1001", programa_nome: "Saúde", acao_codigo: "2031", acao_nome: "Atenção básica", natureza_codigo: "3.3.90.30", fonte_codigo: "1", aplicacao_codigo: "310.0000", ficha: "1", valor_autorizado: "200,00" };
    await importar(page, "PL TESTE-TOTAL", { name: "total.csv", mimeType: "text/csv", buffer: Buffer.from(csv([l, { ...l, ficha: "2", valor_autorizado: "50,00" }])) });
    await expect(page.getByText(/difere do total impresso/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar carga" })).toBeDisabled();
    await page.getByRole("link", { name: /Todas/ }).click();
    await page.locator("tr", { hasText: "ficha 2" }).getByRole("button", { name: "Corrigir" }).click();
    await page.locator("#ln-valor_autorizado").fill("100,00");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("confere")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar carga" })).toBeEnabled();
    const aud = await sql(`select 1 from "AuditLog" where entidade = 'LinhaImportada' and acao = 'CORRIGIR'`);
    expect(aud.length).toBeGreaterThan(0);
  });

  test("T-2.1-1 e T-2.3-4 a base real em XLSX recarrega o PL no lugar; dotação com emenda que mudaria trava", async ({ page }) => {
    await entrar(page, "admin");
    const base = baseMogi();
    const id = await importar(page, "PL 264/2026", { name: "qdd-2027.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: xlsx(base) });
    await expect(page.getByText("confere")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/0 dotações novas, 803 atualizadas no lugar/)).toBeVisible();
    // Uma emenda em rascunho apontando para a ficha 1 da Câmara (01.01; a ficha
    // se repete entre unidades); a recarga mudaria a natureza dela.
    const [d] = await sql<{ id: string }>(`select d.id from "Dotacao" d join "InstrumentoPlanejamento" i on i.id = d."instrumentoId" where i.numero = 'PL 264/2026' and d.ficha = '1' and d."unidadeOrcamentariaId" in (select id from "UnidadeOrcamentaria" where codigo = '01.01')`);
    const [aut] = await sql<{ id: string; ex: string }>(`select a.id, e.id ex from "Autor" a, "Exercicio" e where a.nome = 'Vereador Exemplo' and e.ano = 2027`);
    await sql(`insert into "Emenda" (id, "exercicioId", "autorId", "dotacaoId", "updatedAt") values ('emenda-trava', $1, $2, $3, now())`, [aut.ex, aut.id, d.id]);
    try {
      const alterada = base.map((l) => (l.ficha === "1" && l.unidade_codigo === "01.01" ? { ...l, natureza_codigo: "3.1.90.13" } : l));
      await importar(page, "PL 264/2026", { name: "qdd-alterado.csv", mimeType: "text/csv", buffer: Buffer.from(csv(alterada)) });
      await expect(page.getByText(/mudaria de classificação e tem emenda: rascunho/)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Confirmar carga" })).toBeDisabled();
    } finally {
      await sql(`delete from "Emenda" where id = 'emenda-trava'`);
    }
    // Sem a emenda, a primeira importação confirma e a base continua com 803 fichas e o mesmo total.
    await page.goto(`/executivo/planejamento/importacao/${id}`);
    await page.getByRole("button", { name: "Confirmar carga" }).click();
    await confirmarNaJanela(page, "Confirmar carga");
    await expect(page.getByText(/803 dotações gravadas/)).toBeVisible({ timeout: 120_000 });
    const t = await sql<{ n: string; s: string }>(`select count(*) n, sum("valorAutorizado") s from "Dotacao" d join "InstrumentoPlanejamento" i on i.id = d."instrumentoId" where i.numero = 'PL 264/2026' and d.ativo`);
    expect([Number(t[0].n), Number(t[0].s)]).toEqual([803, 1083895132]);
  });
});

test.describe("LDO e PPA", () => {
  test("T-2.1-5 prioridades da LDO: programa inexistente recusado; as válidas gravadas", async ({ page }) => {
    await novoInstrumento("PL LDO-TESTE", "LDO");
    await entrar(page, "admin");
    const cab = ["programa_codigo", "acao_codigo", "descricao", "meta"];
    const linhas = [
      ["1001", "", "Ampliar a cobertura da atenção básica", "100"],
      ["1003", "", "Ampliar a assistência ambulatorial e hospitalar", "3"],
      ["8888", "", "Programa que não existe", ""],
    ];
    await importar(page, "PL LDO-TESTE", { name: "ldo.csv", mimeType: "text/csv", buffer: Buffer.from([cab, ...linhas].map((l) => l.join(";")).join("\n") + "\n") });
    await expect(page.getByText("O programa 8888 não existe na base do exercício.")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar carga" }).click();
    await confirmarNaJanela(page, "Confirmar carga");
    await expect(page.getByText("2 prioridades da LDO gravadas.")).toBeVisible();
    const p = await sql<{ n: string }>(`select count(*) n from "PrioridadeLdo" p join "InstrumentoPlanejamento" i on i.id = p."instrumentoId" where i.numero = 'PL LDO-TESTE'`);
    expect(Number(p[0].n)).toBe(2);
  });

  test("T-2.1-6 programas do PPA: marcados como constantes do PPA", async ({ page }) => {
    await novoInstrumento("PL PPA-TESTE", "PPA");
    await sql(`update "Programa" set "constaNoPPA" = false where codigo = '1001'`);
    await entrar(page, "admin");
    const cab = ["programa_codigo", "programa_nome", "acao_codigo", "meta_exercicio"];
    const progs = await sql<{ codigo: string; nome: string }>(`select distinct p.codigo, p.nome from "Programa" p join "Exercicio" e on e.id = p."exercicioId" where e.ano = 2027`);
    await importar(page, "PL PPA-TESTE", { name: "ppa.csv", mimeType: "text/csv", buffer: Buffer.from([cab.join(";"), ...progs.map((p) => [p.codigo, p.nome, "", ""].join(";"))].join("\n") + "\n") });
    await page.getByRole("button", { name: "Confirmar carga" }).click();
    await confirmarNaJanela(page, "Confirmar carga");
    await expect(page.getByText(/programas do PPA marcados/)).toBeVisible();
    const p = await sql<{ consta: boolean }>(`select "constaNoPPA" consta from "Programa" p join "Exercicio" e on e.id = p."exercicioId" where e.ano = 2027 and p.codigo = '1001'`);
    expect(p[0].consta).toBe(true);
  });
});

// Leitura de PDF pela IA: só com a chave configurada (E2E_IA=1). PDF com
// texto: duas páginas do projeto de LOA de outro município (82 dotações),
// fechando a aba no meio e voltando. PDF digitalizado: o QDD do PL 264/2026.
// Os PDFs ficam fora do repositório; E2E_PDF_TEXTO aponta outro arquivo.
const PDF_TEXTO = process.env.E2E_PDF_TEXTO ?? "/Users/diegoramos/better/borborema-fontes/ploa-2027/pl-051-2026-loa-2027.pdf";
test.describe("Importação de PDF", () => {
  test.skip(!process.env.E2E_IA, "leitura de PDF exige a chave do serviço de IA (E2E_IA=1)");
  test.setTimeout(600_000);
  test("T-2.1-1 (PDF) e T-2.1-9 PDF com texto, páginas 9 e 10: 82 dotações; a leitura retoma depois de sair da tela", async ({ page }) => {
    await novoInstrumento("PL TESTE-PDF", "LOA");
    await entrar(page, "admin");
    const pdf = readFileSync(PDF_TEXTO);
    await page.goto("/executivo/planejamento");
    await page.locator("tr", { hasText: "PL TESTE-PDF" }).getByRole("button", { name: /Importar base/ }).click();
    await page.locator("#imp-arq").setInputFiles({ name: "outro-municipio.pdf", mimeType: "application/pdf", buffer: pdf });
    await expect(page.getByRole("link", { name: "outro-municipio.pdf" })).toBeVisible({ timeout: 60_000 });
    await page.locator("#imp-de").fill("9");
    await page.locator("#imp-ate").fill("10");
    await page.getByRole("button", { name: "Ler e conferir" }).click();
    await expect(page.getByText("Leitura do documento")).toBeVisible({ timeout: 60_000 });
    const url = page.url();
    await page.goto("/inicio");
    await page.goto(url);
    await expect(page.getByText("Linhas válidas", { exact: true })).toBeVisible({ timeout: 300_000 });
    const n = await sql<{ n: string }>(`select count(*) n from "LinhaImportada" l join "Importacao" i on i.id = l."importacaoId" join "InstrumentoPlanejamento" p on p.id = i."instrumentoId" where p.numero = 'PL TESTE-PDF' and cardinality(l.motivos) = 0`);
    expect(Number(n[0].n)).toBe(82);
  });

  test("T-2.1-8 PDF digitalizado (QDD do PL 264/2026 de Mogi Guaçu): chega à conferência, com o que não fecha apontado", async ({ page }) => {
    const arquivo = "/Users/diegoramos/better/emendas-parlamentares-ux/v2-emendas-impositivas/PL-264-2026/6 Consolidado Geral/05 - QDD - Quadro de Detalhamento da Despesa.pdf";
    await novoInstrumento("PL TESTE-DIGITALIZADO", "LOA");
    await entrar(page, "admin");
    await page.goto("/executivo/planejamento");
    await page.locator("tr", { hasText: "PL TESTE-DIGITALIZADO" }).getByRole("button", { name: /Importar base/ }).click();
    await page.locator("#imp-arq").setInputFiles({ name: "qdd-mogi-guacu.pdf", mimeType: "application/pdf", buffer: readFileSync(arquivo) });
    await expect(page.getByRole("link", { name: "qdd-mogi-guacu.pdf" })).toBeVisible({ timeout: 60_000 });
    await page.locator("#imp-de").fill("2");
    await page.locator("#imp-ate").fill("3");
    await page.getByRole("button", { name: "Ler e conferir" }).click();
    await expect(page.getByText("Linhas válidas", { exact: true })).toBeVisible({ timeout: 400_000 });
    const [imp] = await sql<{ formato: string }>(`select i.formato from "Importacao" i join "InstrumentoPlanejamento" p on p.id = i."instrumentoId" where p.numero = 'PL TESTE-DIGITALIZADO'`);
    expect(imp.formato).toBe("PDF_IMAGEM");
    const [n] = await sql<{ n: string }>(`select count(*) n from "LinhaImportada" l join "Importacao" i on i.id = l."importacaoId" join "InstrumentoPlanejamento" p on p.id = i."instrumentoId" where p.numero = 'PL TESTE-DIGITALIZADO'`);
    expect(Number(n.n)).toBeGreaterThan(20);
    // Sem o total impresso a carga não se confirma: a conferência é obrigatória.
    await expect(page.getByRole("button", { name: "Confirmar carga" })).toBeDisabled();
  });
});
