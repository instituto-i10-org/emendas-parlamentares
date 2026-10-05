import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { DESTINOS, criarRascunho, entrar, sql } from "./apoio";

// Pedidos do Dr. Emerson: preço informado pelo autor a partir de fonte oficial
// (sem pesquisa automática) e o link para a entidade preencher o plano.

const ENTIDADE = DESTINOS.entidade;
const OBJETO_ENTIDADE = "Aquisição de colchonetes para atividades físicas com idosos";

// Confirmações do navegador (gerar outro link, cancelar, enviar) são aceitas.
test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

// Primeira linha da memória de cálculo (a tabela que tem a coluna "Fonte do preço").
const linhaItem = (page: Page) => page.locator("table", { has: page.getByRole("columnheader", { name: /Fonte do preço/ }) }).locator("tbody tr").first();

async function irParaPlano(page: Page) {
  await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
  await expect(page.getByText(/MODELO/)).toBeVisible();
}

test.describe("Preço manual com fontes oficiais", () => {
  test("T-P-1 não existe mais pesquisa automática de preço", async ({ page }) => {
    const externas: string[] = [];
    page.on("request", (r) => {
      if (/pnigp/i.test(r.url())) externas.push(r.url());
    });
    await entrar(page, "vereador");
    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "Aquisição de cadeira de rodas para a unidade de saúde", valor: "20000" });
    await irParaPlano(page);
    await expect(page.getByText("Onde pesquisar o preço")).toBeVisible();
    await expect(page.getByText("Pesquisa de preço", { exact: true })).toHaveCount(0);
    await expect(page.getByPlaceholder(/Busque|pesquisar/i)).toHaveCount(0);
    expect(externas).toEqual([]);
  });

  test("T-P-2 fontes indicadas mudam com o tipo de despesa (saúde e obra)", async ({ page }) => {
    await entrar(page, "vereador");
    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "Aquisição de cadeira de rodas para a unidade de saúde", valor: "20000" });
    await irParaPlano(page);
    const quadro = page.locator("div").filter({ has: page.getByText("Onde pesquisar o preço") }).first();
    await expect(quadro.getByRole("link", { name: /Banco de Preços em Saúde/ })).toHaveAttribute("href", "https://bps.saude.gov.br/");
    await expect(quadro.getByRole("link", { name: /SINAPI/ })).toHaveCount(0);

    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.escola, objeto: "Reforma da cobertura da escola", valor: "150000" });
    await irParaPlano(page);
    const quadroObra = page.locator("div").filter({ has: page.getByText("Onde pesquisar o preço") }).first();
    await expect(quadroObra.getByRole("link", { name: /SINAPI/ })).toBeVisible();
    await expect(quadroObra.getByRole("link", { name: /SICRO/ })).toBeVisible();
  });

  test("T-P-3 e T-P-4 item sem fonte: bloqueia; com a regra em alerta, só alerta", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=exercicio");
    await page.getByRole("button", { name: "Impede a submissão" }).click();
    await page.getByRole("button", { name: "Salvar parâmetros" }).click();
    await expect(page.getByText("Parâmetros do exercício salvos.")).toBeVisible();

    await entrar(page, "vereador");
    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "Aquisição de cadeira de rodas para a unidade de saúde", valor: "3000" });
    await irParaPlano(page);
    const linha = linhaItem(page);
    await linha.getByPlaceholder("Item").fill("Cadeira de rodas");
    await linha.locator("input[inputmode=decimal]").nth(1).fill("1500");
    await page.getByRole("button", { name: /Validar e submeter/ }).first().click();
    await expect(page.getByText("Linha sem fonte de preço")).toBeVisible();
    await expect(page.locator("[data-nivel=bad]", { hasText: "Linha sem fonte de preço" }).or(page.getByText("Linha sem fonte de preço"))).toBeVisible();

    await entrar(page, "admin");
    await page.goto("/config?aba=exercicio");
    await page.getByRole("button", { name: "Só alerta" }).click();
    await page.getByRole("button", { name: "Salvar parâmetros" }).click();
    await expect(page.getByText("Parâmetros do exercício salvos.")).toBeVisible();
    const cfg = await sql<{ fontePrecoObrigatoria: boolean }>(
      `select c."fontePrecoObrigatoria" from "ConfiguracaoExercicio" c join "Exercicio" e on e.id = c."exercicioId" order by e.ano desc limit 1`
    );
    expect(cfg[0].fontePrecoObrigatoria).toBe(false);
    // Volta ao padrão para os demais testes.
    await page.getByRole("button", { name: "Impede a submissão" }).click();
    await page.getByRole("button", { name: "Salvar parâmetros" }).click();
  });

  test("T-P-5 administração edita o endereço de uma fonte e a tela da emenda muda", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=precos");
    const cartao = page.locator("div.rounded-box", { hasText: "Banco de Preços em Saúde" }).first();
    await cartao.getByRole("button", { name: "Editar" }).click();
    await page.locator("#fp-u").fill("https://bps.saude.gov.br/consulta");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Fonte de preço salva.")).toBeVisible();
    const f = await sql<{ url: string }>(`select url from "FontePrecoOficial" where nome like 'Banco de Preços em Saúde%'`);
    expect(f[0].url).toBe("https://bps.saude.gov.br/consulta");
    const audit = await sql(`select 1 from "AuditLog" where entidade = 'FontePrecoOficial' and acao = 'ATUALIZAR'`);
    expect(audit.length).toBeGreaterThan(0);
    // Restaura.
    await cartao.getByRole("button", { name: "Editar" }).click();
    await page.locator("#fp-u").fill("https://bps.saude.gov.br/");
    await page.getByRole("button", { name: "Salvar" }).click();
  });

  test("fonte informada pelo diálogo vale para a linha e aparece no quadro de origem", async ({ page }) => {
    await entrar(page, "vereador");
    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "Aquisição de cadeira de rodas para a unidade de saúde", valor: "3000" });
    await irParaPlano(page);
    const linha = linhaItem(page);
    await linha.getByPlaceholder("Item").fill("Cadeira de rodas adulto");
    await linha.locator("select").selectOption("__nova");
    await page.locator("#rf-fonte").selectOption({ label: "Banco de Preços em Saúde (Ministério da Saúde)" });
    await expect(page.getByRole("link", { name: /Abrir Banco de Preços em Saúde/ })).toBeVisible();
    await page.locator("#rf-unid").fill("unidade");
    await page.locator("#rf-valor").fill("1450,00");
    await page.getByRole("button", { name: "Registrar fonte" }).click();
    await expect(linha.getByText("fonte oficial")).toBeVisible();
    await expect(linha.locator("input[inputmode=decimal]").nth(1)).toHaveValue("1.450,00");
  });
});

test.describe("Link da entidade", () => {
  async function gerarLink(page: Page): Promise<{ emendaId: string; url: string }> {
    await entrar(page, "vereador");
    const emendaId = await criarRascunho(page, { execucao: "INDIRETA", destino: ENTIDADE, objeto: OBJETO_ENTIDADE, valor: "4000" });
    await irParaPlano(page);
    await page.getByRole("button", { name: /Gerar link para a entidade|Gerar novo link/ }).click();
    const campo = page.getByLabel("Link para a entidade");
    await expect(campo).toBeVisible();
    return { emendaId, url: await campo.inputValue() };
  }

  async function preencherComoEntidade(page: Page, url: string, nome = "Maria da Silva") {
    await page.context().clearCookies();
    await page.goto(url);
    await page.locator("#pe-nome").fill(nome);
    await page.locator("#pe-cargo").fill("Presidente");
    await page.locator("#pe-meta").fill("Atender 40 idosos com atividades físicas orientadas três vezes por semana");
    await page.locator("#pe-mb-0").fill("Idosos do centro de convivência");
    await page.locator("#pe-mu-0").fill("pessoas");
    await page.locator("#pe-mq-0").fill("40");
    await page.locator("#pe-id-0").fill("Colchonete para ginástica");
    await page.locator("#pe-iu-0").fill("unidade");
    await page.locator("#pe-iq-0").fill("40");
    await page.locator("#pe-iv-0").fill("89,90");
    await page.locator("#pe-if-0").selectOption({ index: 1 });
    await page.locator("#pe-pa-0").fill("3.596,00");
    await page.getByRole("button", { name: "Enviar plano ao gabinete" }).click();
  }

  test("T-L-1 gabinete gera o link; o código não fica no banco", async ({ page }) => {
    const { emendaId, url } = await gerarLink(page);
    expect(url).toMatch(/\/publica\/plano\/[A-Za-z0-9_-]{40,}$/);
    const codigo = url.split("/").pop()!;
    const linhas = await sql<{ codigoHash: string }>(`select "codigoHash" from "ConviteEntidade" where "emendaId" = $1`, [emendaId]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].codigoHash).toBe(createHash("sha256").update(codigo).digest("hex"));
    const bruto = await sql(`select 1 from "ConviteEntidade" where "codigoHash" = $1`, [codigo]);
    expect(bruto).toHaveLength(0);
  });

  test("T-L-2 e T-L-3 entidade envia sem login; o mesmo link não abre de novo", async ({ page }) => {
    const { emendaId, url } = await gerarLink(page);
    await preencherComoEntidade(page, url);
    await expect(page.getByText("Plano enviado")).toBeVisible();
    const c = await sql<{ responsavelNome: string; usadoEm: Date }>(`select "responsavelNome", "usadoEm" from "ConviteEntidade" where "emendaId" = $1`, [emendaId]);
    expect(c[0].responsavelNome).toBe("Maria da Silva");
    expect(c[0].usadoEm).toBeTruthy();
    const audit = await sql(`select 1 from "AuditLog" where acao = 'PLANO_ENVIADO_PELA_ENTIDADE'`);
    expect(audit.length).toBeGreaterThan(0);

    await page.goto(url);
    await expect(page.getByText(/já foi utilizado/)).toBeVisible();

    // O gabinete vê o envio e traz para o rascunho.
    await entrar(page, "vereador");
    await page.goto(`/emendas/${emendaId}`);
    await irParaPlano(page);
    await expect(page.getByText("Plano enviado pela entidade")).toBeVisible();
    await expect(page.getByText(/Preenchido por Maria da Silva/)).toBeVisible();
    await page.getByRole("button", { name: "Trazer para o plano" }).click();
    await expect(linhaItem(page).getByPlaceholder("Item")).toHaveValue("Colchonete para ginástica");
  });

  test("T-L-4 link vencido não abre", async ({ page }) => {
    const { emendaId, url } = await gerarLink(page);
    await sql(`update "ConviteEntidade" set "expiraEm" = now() - interval '1 minute' where "emendaId" = $1`, [emendaId]);
    await page.context().clearCookies();
    await page.goto(url);
    await expect(page.getByText(/Este link venceu/)).toBeVisible();
  });

  test("T-L-5 link revogado pelo gabinete não abre", async ({ page }) => {
    const { url } = await gerarLink(page);
    await page.getByRole("button", { name: "Cancelar link" }).click();
    await expect(page.getByText("Link cancelado.")).toBeVisible();
    await page.context().clearCookies();
    await page.goto(url);
    await expect(page.getByText(/cancelado pelo gabinete/)).toBeVisible();
  });

  test("T-L-6 emenda fora de rascunho invalida o link", async ({ page }) => {
    const { emendaId, url } = await gerarLink(page);
    await sql(`update "Emenda" set status = 'SUBMETIDA' where id = $1`, [emendaId]);
    await page.context().clearCookies();
    await page.goto(url);
    await expect(page.getByText(/a emenda já foi remetida/)).toBeVisible();
  });

  test("T-L-7 código errado repetido bloqueia o endereço por um tempo", async ({ page }) => {
    let bloqueou = false;
    for (let i = 0; i < 25; i++) {
      await page.goto(`/publica/plano/${"x".repeat(43)}${i.toString().padStart(2, "0")}`);
      if (await page.getByText(/Muitos links inválidos/).isVisible().catch(() => false)) {
        bloqueou = true;
        break;
      }
    }
    expect(bloqueou).toBe(true);
  });

  test("T-L-8 depois de usado, um link novo funciona uma vez; gerar outro cancela o anterior", async ({ page }) => {
    const { emendaId, url } = await gerarLink(page);
    await preencherComoEntidade(page, url);
    await expect(page.getByText("Plano enviado")).toBeVisible();
    await entrar(page, "vereador");
    await page.goto(`/emendas/${emendaId}`);
    await irParaPlano(page);
    await page.getByRole("button", { name: /Gerar link para a entidade|Gerar novo link/ }).click();
    const segundo = await page.getByLabel("Link para a entidade").inputValue();
    await page.getByRole("button", { name: "Gerar novo link" }).click();
    await expect(page.getByLabel("Link para a entidade")).not.toHaveValue(segundo);
    const terceiro = await page.getByLabel("Link para a entidade").inputValue();
    await page.context().clearCookies();
    await page.goto(segundo);
    await expect(page.getByText(/cancelado pelo gabinete/)).toBeVisible();
    await preencherComoEntidade(page, terceiro, "João Souza");
    await expect(page.getByText("Plano enviado")).toBeVisible();
  });
});
