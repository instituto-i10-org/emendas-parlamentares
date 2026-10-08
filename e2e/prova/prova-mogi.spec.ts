import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { DESTINOS, apagarEmendasDeTeste, criarRascunho, emendaValida, entrar, escolherExecucao, idDaUrl, inserirEmenda, irParaEtapa3 as irParaEtapa3Apoio, passo1, preencherLogin, proximo, sql, confirmarNaJanela, abrirMinhaConta } from "../apoio";

// ============================================================================
// Ensaio da prova de conceito em Mogi Guaçu: um teste por item do formulário
// (43), com o número do item no nome, percorrendo a tela como na sessão e
// guardando a captura de cada uma em docs/prova/capturas/. Os testes de cada
// bloco (e2e/blocoN-*.spec.ts) cobrem os casos de borda; aqui é o roteiro.
//
// Os itens 3.1, 3.2, 3.3, 3.4, 5.1 e 5.2 tratam da tela de apresentação da
// emenda, aprovada como está pelo Dr. Emerson: ficam pulados, com a nota.
// ============================================================================

const CAPTURAS = path.resolve("docs/prova/capturas");
mkdirSync(CAPTURAS, { recursive: true });
async function captura(page: Page, item: string) {
  await page.screenshot({ path: path.join(CAPTURAS, `item-${item}.png`), fullPage: true });
}
const PARCIAL = "parcial por decisão (telas de emenda aprovadas pelo Dr. Emerson)";

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});
const criadas: string[] = [];
test.afterAll(async () => {
  await apagarEmendasDeTeste("p43-");
  if (criadas.length) await sql(`delete from "Emenda" where id = any($1)`, [criadas]);
  await sql(`delete from "InstrumentoPlanejamento" where numero like 'P43 %'`);
});

// Ficha da saúde no PL 264/2026 (a ficha se repete entre unidades).
const SAUDE = { ficha: "444", unidade: "13.01" };
const treze = (page: Page) => page.locator('ol[aria-label="As treze verificações"]').first();

function pdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
}
const CAB = ["orgao_codigo", "unidade_codigo", "unidade_nome", "funcao_codigo", "subfuncao_codigo", "programa_codigo", "programa_nome", "acao_codigo", "acao_nome", "natureza_codigo", "fonte_codigo", "aplicacao_codigo", "ficha", "valor_autorizado"];
const LINHA: Record<string, string> = { orgao_codigo: "02", unidade_codigo: "02.95", unidade_nome: "Saúde", funcao_codigo: "10", subfuncao_codigo: "301", programa_codigo: "1001", programa_nome: "Saúde", acao_codigo: "2031", acao_nome: "Atenção básica", natureza_codigo: "3.3.90.30", fonte_codigo: "1", aplicacao_codigo: "310.0000", ficha: "1", valor_autorizado: "200,00" };
const csv = (linhas: Record<string, string>[]) => Buffer.from([CAB.join(";"), ...linhas.map((l) => CAB.map((c) => l[c] ?? "").join(";"))].join("\n") + "\n");

async function instrumentoDeTeste(numero: string, total: number) {
  const [ex] = await sql<{ id: string }>(`select id from "Exercicio" where ano = 2027`);
  await sql(`delete from "InstrumentoPlanejamento" where numero = $1`, [numero]);
  await sql(
    `insert into "InstrumentoPlanejamento" (id, tipo, especie, numero, ementa, "exercicioId", status, "totalImpresso", "createdAt", "updatedAt")
     values ('inst-' || md5(random()::text), 'LOA', 'PROJETO_LEI', $1, 'Instrumento do ensaio da prova', $2, 'EM_ELABORACAO', $3, now(), now())`,
    [numero, ex.id, total]
  );
}
async function importar(page: Page, numero: string, nome: string, buffer: Buffer) {
  // O sistema limita 10 importações por minuto por usuário; a suíte inteira
  // importa mais que isso em sequência, então o ensaio zera o contador.
  await sql(`delete from "TentativaAcesso" where chave like 'importacao:%'`);
  await page.goto("/executivo/planejamento");
  await page.locator("tr", { hasText: numero }).getByRole("button", { name: /Importar base/ }).click();
  await page.locator("#imp-arq").setInputFiles({ name: nome, mimeType: "text/csv", buffer });
  await expect(page.getByRole("link", { name: nome })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Ler e conferir" }).click();
  await expect(page).toHaveURL(/\/importacao\//, { timeout: 60_000 });
}
async function irParaEtapa3(page: Page, id: string, secao: "verificacoes" | "envio" = "verificacoes") {
  await irParaEtapa3Apoio(page, id, secao);
  if (secao === "verificacoes") await expect(treze(page)).toBeVisible();
}

test.describe("Grupo 1 — Instrumentos", () => {
  test("Item 1.1 — cadastro de PPA, LDO e LOA com número, ementa, data e arquivo", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/executivo/planejamento");
    await page.getByRole("button", { name: "Novo instrumento" }).click();
    await page.getByRole("button", { name: "Projeto de lei", exact: true }).click();
    await page.getByRole("button", { name: "LDO", exact: true }).click();
    await page.locator("#in-num").fill("P43 LDO 2027");
    await page.locator("#in-dt").fill("2026-04-30");
    await page.locator("#in-em").fill("Dispõe sobre as diretrizes para a elaboração da lei orçamentária de 2027.");
    await page.locator("#in-arq").setInputFiles({ name: "ldo-2027.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(page.getByRole("link", { name: "ldo-2027.pdf" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Instrumento cadastrado.")).toBeVisible();
    const linha = page.locator("tr", { hasText: "P43 LDO 2027" });
    await expect(linha).toContainText("30/04/2026");
    await expect(linha.getByRole("link", { name: /ldo-2027\.pdf/ })).toBeVisible();
    await captura(page, "1.1");
  });

  test("Item 1.2 — lei aprovada vinculada ao projeto de origem", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/executivo/planejamento");
    await page.getByRole("button", { name: "Novo instrumento" }).click();
    await page.getByRole("button", { name: "Lei aprovada", exact: true }).click();
    await page.getByRole("button", { name: "LOA", exact: true }).click();
    await page.locator("#in-num").fill("P43 Lei 9.000/2026");
    await page.locator("#in-em").fill("Estima a receita e fixa a despesa para 2027.");
    await page.locator("#in-or").selectOption({ label: "LOA · PL 264/2026" });
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.locator("tr", { hasText: "Lei aprovada" }).filter({ hasText: "P43 Lei 9.000/2026" })).toContainText("Lei originada do PL 264/2026");
    await captura(page, "1.2");
    await sql(`delete from "InstrumentoPlanejamento" where numero = 'P43 Lei 9.000/2026'`);
  });

  test("Item 1.3 — emendamento aberto ou fechado pela situação do instrumento e do exercício", async ({ page }) => {
    await entrar(page, "vereador");
    await page.goto("/emendas");
    await expect(page.getByText("Emendamento aberto.")).toBeVisible();
    await sql(`update "InstrumentoPlanejamento" set status = 'EM_ELABORACAO' where numero = 'PL 264/2026'`);
    try {
      await page.goto("/emendas");
      await expect(page.getByText("Emendamento fechado.")).toBeVisible();
      await captura(page, "1.3");
    } finally {
      await sql(`update "InstrumentoPlanejamento" set status = 'EM_TRAMITACAO' where numero = 'PL 264/2026'`);
    }
  });
});

test.describe("Grupo 2 — Importação", () => {
  test.setTimeout(180_000);

  test("Item 2.1 — importação com relatório de cada linha recusada", async ({ page }) => {
    await instrumentoDeTeste("P43 IMPORTA", 200);
    await entrar(page, "admin");
    await importar(page, "P43 IMPORTA", "base.csv", csv([LINHA, { ...LINHA, ficha: "2", valor_autorizado: "abc" }]));
    await expect(page.getByRole("link", { name: "Recusadas (1)" })).toBeVisible();
    await expect(page.getByText('Valor "abc" inválido.').first()).toBeVisible();
    await captura(page, "2.1");
  });

  test("Item 2.2 — os oito componentes derivados de cada linha", async ({ page }) => {
    await instrumentoDeTeste("P43 COMPONENTES", 200);
    await entrar(page, "admin");
    await importar(page, "P43 COMPONENTES", "componentes.csv", csv([LINHA]));
    await expect(page.getByText("Linhas válidas", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Todas/ }).click();
    const l = page.locator("tr", { hasText: "ficha 1" });
    for (const t of ["02.95", "10.301", "1001", "2031", "3.3.90.30"]) await expect(l).toContainText(t);
    await captura(page, "2.2");
  });

  test("Item 2.3 — conferência de totais antes de gravar", async ({ page }) => {
    await instrumentoDeTeste("P43 TOTAIS", 300);
    await entrar(page, "admin");
    await importar(page, "P43 TOTAIS", "totais.csv", csv([LINHA, { ...LINHA, ficha: "2", valor_autorizado: "100,00" }]));
    await expect(page.getByText("confere")).toBeVisible();
    const antes = await sql<{ n: string }>(`select count(*) n from "Dotacao" d join "InstrumentoPlanejamento" i on i.id = d."instrumentoId" where i.numero = 'P43 TOTAIS'`);
    expect(Number(antes[0].n)).toBe(0);
    await captura(page, "2.3");
    await page.getByRole("button", { name: "Confirmar carga" }).click();
    await confirmarNaJanela(page, "Confirmar carga");
    await expect(page.getByText(/2 dotações gravadas/)).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("Grupo 3 — Apresentação", () => {
  test.skip("Item 3.1 — formulário em blocos numerados, todos visíveis", () => void PARCIAL);
  test.skip("Item 3.2 — dotação em cascata, com saldo e por extenso", () => void PARCIAL);
  test.skip("Item 3.3 — tipo de emenda; remanejamento com origem e destino diferentes", () => void PARCIAL);
  test.skip("Item 3.4 — acréscimo, anulação e remanejamento", () => void PARCIAL);

  test("Item 3.5 — beneficiário por destino; cadastro sem sair da tela; rascunho", async ({ page }) => {
    await entrar(page, "vereador");
    await page.goto("/emendas/nova");
    await escolherExecucao(page, "INDIRETA");
    await proximo(page);
    await page.locator("#f-dest").fill("Entidade nova do ensaio");
    await expect(page.getByRole("option", { name: /Cadastrar “Entidade nova do ensaio”/ })).toBeVisible();
    await captura(page, "3.5");
    // Rascunho com o preenchimento incompleto.
    await page.locator("#f-dest").fill("");
    await page.getByRole("button", { name: /^Seção 3: Objeto e valor/ }).click();
    await page.locator("#f-obj").fill("Rascunho incompleto do ensaio da prova");
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page).toHaveURL(/\/emendas\/c[a-z0-9]+(\?|$)/, { timeout: 15_000 });
    criadas.push(idDaUrl(page));
  });
});

test.describe("Grupo 4 — Motor", () => {
  test("Item 4.1 — as treze verificações em três estados", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "Aquisição de cadeira de rodas para a unidade de saúde", valor: "3000" });
    criadas.push(id);
    await irParaEtapa3(page, id);
    await expect(treze(page).locator("> li")).toHaveCount(13);
    await expect(treze(page).locator('li[data-codigo="PLANO_TRABALHO"]')).toContainText("Falha");
    await captura(page, "4.1");
    await proximo(page);
    await expect(page.getByRole("button", { name: /^Submeter/ })).toBeDisabled();
  });

  test("Item 4.2 — relatório com razão e fundamento de cada verificação", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "Aquisição de cadeira de rodas para a unidade de saúde", valor: "3000" });
    criadas.push(id);
    await irParaEtapa3(page, id);
    await expect(treze(page).locator('li[data-codigo="PLANO_TRABALHO"]')).toContainText(/Plano de trabalho incompleto/);
    await expect(treze(page).locator("> li").first()).toContainText("Fundamento:");
    // As conferências que já existiam continuam abaixo.
    await expect(page.getByText("Pré-checagem das condições de validade")).toBeVisible();
    await captura(page, "4.2");
  });

  test("Item 4.3 — modo bloqueante ou alerta por verificação, em Configurações", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=validacao");
    await expect(page.locator("li[data-codigo=CAMPOS_PREENCHIDOS]")).toContainText("Sempre bloqueante.");
    await expect(page.locator("#modo-ADERENCIA_LDO")).toBeVisible();
    await captura(page, "4.3");
  });

  test("Item 4.4 — validação no servidor, gravada com o histórico", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page, "Aquisição de cadeira de rodas do ensaio 4.4");
    criadas.push(id);
    await irParaEtapa3(page, id, "envio");
    await page.getByRole("button", { name: /^Submeter/ }).click();
    await expect(page.getByRole("tab", { name: "Validações anteriores" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Validações anteriores" }).click();
    const v = await sql<{ n: number; momento: string }>(`select jsonb_array_length(verificacoes) n, momento from "ValidacaoEmenda" where "emendaId" = $1 order by "executadaEm" desc limit 1`, [id]);
    expect(v[0]).toEqual({ n: 13, momento: "REMESSA" });
    await captura(page, "4.4");
  });

  test("Item 4.5 — cada verificação conferida (programa fora do PPA falha em v)", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page, "Aquisição de cadeira de rodas do ensaio 4.5");
    criadas.push(id);
    const [d] = await sql<{ programaId: string }>(`select d."programaId" from "Emenda" e join "Dotacao" d on d.id = e."dotacaoId" where e.id = $1`, [id]);
    await sql(`update "Programa" set "constaNoPPA" = false where id = $1`, [d.programaId]);
    try {
      await irParaEtapa3(page, id);
      await expect(treze(page).locator('li[data-codigo="PROGRAMA_NO_PPA"]')).toContainText("Falha");
      await captura(page, "4.5");
    } finally {
      await sql(`update "Programa" set "constaNoPPA" = true where id = $1`, [d.programaId]);
    }
  });
});

test.describe("Grupo 5 — Plano de trabalho", () => {
  test.skip("Item 5.1 — plano conforme a categoria do beneficiário", () => void PARCIAL);
  test.skip("Item 5.2 — o que falta para remeter, sempre à vista", () => void PARCIAL);

  test("Item 5.3 — link para a entidade preencher o plano, de uso único", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await criarRascunho(page, { execucao: "INDIRETA", destino: DESTINOS.entidade, objeto: "Aquisição de colchonetes para atividades físicas com idosos", valor: "3596" });
    criadas.push(id);
    await page.goto(`/emendas/${id}?etapa=2`);
    await page.getByRole("button", { name: /Gerar link para a entidade|Gerar novo link/ }).click();
    await expect(page.getByLabel("Link para a entidade")).toBeVisible();
    await captura(page, "5.3");
  });
});

test.describe("Grupo 6 — Tramitação", () => {
  test("Item 6.1 — situações da emenda e fila com filtros", async ({ page }) => {
    await inserirEmenda({ id: "p43-fila", status: "SUBMETIDA", ficha: SAUDE, numero: 9430, objeto: "Macas para o ensaio da prova" });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=parecer&situacao=SUBMETIDA&q=Macas para o ensaio");
    const linha = page.locator("tr", { hasText: "Macas para o ensaio" });
    await expect(linha).toBeVisible();
    await expect(page.getByLabel("Situação")).toBeVisible();
    await expect(page.getByLabel("Autor")).toBeVisible();
    await expect(page.getByLabel("Área")).toBeVisible();
    await captura(page, "6.1");
    await linha.getByRole("button", { name: "Receber" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Receber" }).click();
    await expect(page.getByText("Emenda recebida: em tramitação.")).toBeVisible();
  });

  test("Item 6.2 — parecer obrigatório e saneamento em fila própria", async ({ page }) => {
    await inserirEmenda({ id: "p43-par", status: "EM_TRAMITACAO", ficha: SAUDE, numero: 9431, objeto: "Parecer do ensaio" });
    await inserirEmenda({
      id: "p43-san",
      status: "INVALIDA",
      ficha: SAUDE,
      objeto: "Saneamento do ensaio",
      verificacoes: [{ codigo: "COTA_AUTOR", numero: "ix", titulo: "Cota individual do autor", estado: "falha", razao: "Passa da cota.", fundamento: "Lei Orgânica", modo: "BLOQUEANTE" }],
    });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=parecer&q=Parecer do ensaio");
    await page.locator("tr", { hasText: "Parecer do ensaio" }).getByRole("button", { name: "Decidir" }).click();
    await page.getByRole("button", { name: "Aprovar", exact: true }).click();
    await page.locator("#parecer").fill("Curto");
    await page.getByRole("button", { name: "Aprovar emenda" }).click();
    await expect(page.getByText("Escreva o parecer (ao menos 20 caracteres).")).toBeVisible();
    await page.locator("#parecer").fill("A emenda atende ao interesse público e às regras da Lei Orgânica.");
    await page.getByRole("button", { name: "Aprovar emenda" }).click();
    await expect(page.getByText("Emenda aprovada.")).toBeVisible();
    await page.goto("/tramitacao?aba=saneamento&q=Saneamento do ensaio");
    await expect(page.locator("tr", { hasText: "Saneamento do ensaio" })).toContainText("(ix) Cota individual do autor");
    await captura(page, "6.2");
  });

  test("Item 6.3 — emendas incorporadas à lei e relatórios", async ({ page }) => {
    await inserirEmenda({ id: "p43-lei", status: "APROVADA", ficha: SAUDE, numero: 9432, objeto: "Incorporar no ensaio" });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=lei&q=Incorporar no ensaio");
    await page.locator("tr", { hasText: "Incorporar no ensaio" }).getByRole("button", { name: "Marcar incorporada" }).click();
    await expect(page.getByText("Marcada como incorporada à lei.")).toBeVisible();
    await captura(page, "6.3");
    await page.goto("/tramitacao?aba=relatorios");
    await expect(page.getByRole("heading", { name: "Por situação" })).toBeVisible();
  });
});

test.describe("Grupo 7 — Painéis", () => {
  test("Item 7.1 — painel geral: apresentado e acatado lado a lado, por área", async ({ page }) => {
    await entrar(page, "comissao");
    await page.goto("/painel");
    for (const t of ["Apresentado", "Acatado", "Consumo do teto"]) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Por área" })).toBeVisible();
    await captura(page, "7.1");
  });

  test("Item 7.2 — visão do gabinete", async ({ page }) => {
    await entrar(page, "vereador");
    await page.goto("/vereador360");
    for (const t of ["Cota individual", "Comprometido", "Saldo da cota"]) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await captura(page, "7.2");
  });

  test("Item 7.3 — resumo por autor", async ({ page }) => {
    await entrar(page, "comissao");
    await page.goto("/painel");
    await expect(page.getByRole("heading", { name: "Cota por vereador" })).toBeVisible();
    await captura(page, "7.3");
  });

  test("Item 7.4 — fila de análise com o apontamento de cada pendência", async ({ page }) => {
    await inserirEmenda({
      id: "p43-ap",
      status: "INVALIDA",
      ficha: SAUDE,
      objeto: "Apontamento do ensaio",
      verificacoes: [{ codigo: "PLANO_TRABALHO", numero: "xiii", titulo: "Plano de trabalho preenchido", estado: "falha", razao: "Faltam as metas físicas.", fundamento: "Lei Orgânica", modo: "BLOQUEANTE" }],
    });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=saneamento&q=Apontamento do ensaio");
    await expect(page.locator("tr", { hasText: "Apontamento do ensaio" })).toContainText("(xiii) Plano de trabalho preenchido: Faltam as metas físicas.");
    await captura(page, "7.4");
  });
});

test.describe("Grupo 8 — Projeto e lei", () => {
  test("Item 8.1 — comparativo projeto × lei por dotação", async ({ page }) => {
    await entrar(page, "comissao");
    await page.goto("/comparativo");
    for (const t of ["Projeto de lei", "Lei aprovada", "Diferença"]) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await captura(page, "8.1");
  });

  test("Item 8.2 — execução das dotações emendadas", async ({ page }) => {
    await inserirEmenda({ id: "p43-ex", status: "APROVADA", ficha: SAUDE, numero: 9433, objeto: "Execução do ensaio" });
    await sql(`insert into "AndamentoExecucao" (id, "emendaId", etapa, data, valor) values ('p43-and', 'p43-ex', 'EMPENHO', now(), 30000)`);
    await entrar(page, "comissao");
    await page.goto("/comparativo?aba=execucao");
    await expect(page.locator("tr", { hasText: "nº 9433" })).toBeVisible();
    await captura(page, "8.2");
  });
});

test.describe("Grupos 9 a 11 — Portal, manual e conformidade", () => {
  test("Item 9.1 — portal sem login, com os números do exercício", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/publica");
    for (const t of ["Emendas apresentadas", "Total apresentado", "Total acatado"]) await expect(page.getByText(t, { exact: true })).toBeVisible();
    await captura(page, "9.1");
  });

  test("Item 9.2 — relação com busca e filtros; ficha com a classificação completa", async ({ page }) => {
    const [outro] = await sql<{ id: string }>(`select id from "Autor" where "usuarioId" is null and not demonstracao order by nome limit 1`);
    await inserirEmenda({ id: "p43-pub", status: "APROVADA", autorId: outro.id, ficha: SAUDE, numero: 9434, objeto: "Emenda pública do ensaio" });
    await page.context().clearCookies();
    await page.goto("/publica/emendas?q=pública do ensaio&situacao=APROVADA");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.locator("tbody tr a").first().click();
    for (const t of ["Órgão", "Função", "Subfunção", "Natureza", "Fonte"]) await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await captura(page, "9.2");
  });

  test("Item 10.1 — manual orientativo lido da configuração", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/publica/manual");
    await expect(page.getByRole("heading", { name: /Situação deste manual/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Limites do exercício/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /As treze verificações/ })).toBeVisible();
    await captura(page, "10.1");
  });

  test("Item 11.1 — checklist de conformidade derivado do estado real", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/conformidade");
    for (const id of ["LOM", "REGIMENTO", "MANUAL", "PORTAL", "AUTOR", "LIMITES"]) await expect(page.locator(`li[data-item=${id}]`)).toBeVisible();
    await captura(page, "11.1");
  });

  test("Item 11.2 — providência e link em cada pendência", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/conformidade");
    const pendente = page.locator("li[data-item]", { hasText: "Providência:" }).first();
    await expect(pendente.getByRole("link", { name: "Resolver" })).toBeVisible();
    await captura(page, "11.2");
  });
});

test.describe("Grupos 12 a 15 — Configuração, acesso, exportação e redação", () => {
  test("Item 12.1 — parâmetros com fundamento e modo, por exercício", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=validacao");
    await expect(page.getByRole("heading", { name: "Parâmetros da validação e da tramitação" })).toBeVisible();
    await expect(page.getByLabel("Fundamento: Cota individual")).toBeVisible();
    await captura(page, "12.1");
  });

  test("Item 12.2 — repositório normativo com arquivo e vigência", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=normas");
    await expect(page.locator("[data-norma]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova norma" })).toBeVisible();
    await captura(page, "12.2");
  });

  test("Item 12.3 — beneficiários com detecção de duplicados", async ({ page }) => {
    await sql(`insert into "Destino" (id, nome, execucao, endereco, origem, "updatedAt") values ('p43-d1', 'Assoc. Amigos do Ensaio', 'INDIRETA', 'Rua 1', 'CADASTRO', now()), ('p43-d2', 'Associação Amigos do Ensaio', 'INDIRETA', 'Rua 1', 'CADASTRO', now())`);
    try {
      await entrar(page, "admin");
      await page.goto("/config?aba=destinos");
      await expect(page.locator("[data-par]", { hasText: "Amigos do Ensaio" })).toBeVisible();
      await captura(page, "12.3");
    } finally {
      await sql(`delete from "Destino" where id in ('p43-d1', 'p43-d2')`);
    }
  });

  test("Item 12.4 — usuários e perfis; auditoria consultável", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=usuarios");
    await expect(page.locator("th", { hasText: "Poder" })).toBeAttached();
    await page.goto("/config?aba=auditoria");
    await page.getByRole("button", { name: "Abrir", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await captura(page, "12.4");
  });

  test("Item 13.1 — perfis, inclusive somente consulta, e troca da própria senha", async ({ page }) => {
    await entrar(page, "consulta@emendas360.local");
    await page.goto("/inicio");
    await abrirMinhaConta(page);
    await expect(page.getByRole("heading", { name: "Trocar a senha" })).toBeVisible();
    await page.goto("/tramitacao");
    await expect(page.getByRole("button", { name: "Decidir" })).toHaveCount(0);
    await captura(page, "13.1");
  });

  test("Item 13.2 — permissão relida a cada ação no servidor", async ({ page }) => {
    await entrar(page, "consulta@emendas360.local");
    const r = await page.request.get(`/api/export/emendas?ano=2027&formato=csv`);
    expect(r.status()).toBe(200);
    await page.goto("/config");
    await expect(page).not.toHaveURL(/\/config/);
    await captura(page, "13.2");
  });

  test("Item 13.3 — trilha com antes e depois; limite de tentativas no login", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=auditoria");
    await page.getByRole("button", { name: "Abrir", exact: true }).first().click();
    await expect(page.getByRole("dialog").getByRole("columnheader", { name: "Antes" })).toBeVisible();
    await captura(page, "13.3");
    await preencherLogin(page, "ninguem-p43@emendas360.local", "senha-errada-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText(/E-mail ou senha inválidos|Muitas tentativas/)).toBeVisible();
    await sql(`delete from "TentativaAcesso" where chave like '%ninguem-p43%'`);
  });

  test("Item 14.1 — exportação CSV e XLSX com os filtros da tela", async ({ page }) => {
    await entrar(page, "comissao");
    await page.goto("/emendas?situacao=APROVADA");
    const href = await page.getByRole("link", { name: /CSV/ }).first().getAttribute("href");
    expect(href).toContain("situacao=APROVADA");
    const r = await page.request.get(href!);
    expect((await r.text()).startsWith("﻿")).toBe(true);
    await captura(page, "14.1");
  });

  test("Item 14.2 — impressão da emenda inteira", async ({ page }) => {
    await inserirEmenda({ id: "p43-imp", status: "APROVADA", ficha: SAUDE, numero: 9435, objeto: "Emenda impressa do ensaio" });
    await entrar(page, "comissao");
    await page.goto("/emendas/p43-imp/plano");
    await expect(page.getByText("Emenda e plano de trabalho").first()).toBeVisible();
    await expect(page.getByText("Tramitação e pareceres").first()).toBeVisible();
    await captura(page, "14.2");
  });

  test("Item 15.1 — apoio à redação só com o conteúdo da emenda", async ({ page }) => {
    test.setTimeout(90_000);
    await entrar(page, "vereador");
    await passo1(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "", valor: "" }, { analisar: false, ate: "objeto" });
    await page.locator("#f-obj").fill("Aquisição de cadeira de rodas para a unidade de saúde do bairro");
    await page.getByRole("button", { name: "Melhorar texto" }).first().click();
    if (process.env.E2E_IA) await expect(page.getByText(/Sugestão|recusada/).first()).toBeVisible({ timeout: 60_000 });
    else await expect(page.getByText(/apoio à redação está indisponível/)).toBeVisible();
    await captura(page, "15.1");
  });
});
