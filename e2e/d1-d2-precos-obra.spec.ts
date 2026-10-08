import { expect, test, type Page } from "@playwright/test";
import { DESTINOS, criarRascunho, emendaValida, entrar, idDaUrl, proximo, sql } from "./apoio";

// Pedidos do Dr. Emerson (PLANO-MOGI-EMERSON.md, D1 e D2): fontes com link já
// pesquisando o item, banco i10 recomendado, "Ver referência" só para consulta,
// aviso e declaração de responsabilidade pelos preços, obra por m².

const PREFIXO = "D1D2";
test.afterAll(async () => {
  await sql(`delete from "Emenda" where objeto like $1`, [`%${PREFIXO}%`]);
});

const linhaItem = (page: Page) => page.locator('[data-tabela="itens"] tbody tr').first();
const quadroFontes = (page: Page) => page.locator("div").filter({ has: page.getByText("Onde pesquisar o preço") }).first();

// Rascunho salvo, aberto na memória de cálculo (etapa 2, seção 3).
async function irParaPlano(page: Page) {
  await page.goto(`/emendas/${idDaUrl(page)}?etapa=2&secao=3`);
  await expect(page.locator('[data-guia-tela="nova-emenda.etapa2"]')).toBeVisible();
}

test.describe("D1 — fontes de preço e responsabilidade", () => {
  test("banco i10 recomendado em primeiro, aviso fixo e links do PNCP com a busca", async ({ page }) => {
    await entrar(page, "vereador");
    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: `Aquisição de cadeira de rodas para a unidade de saúde ${PREFIXO}`, valor: "3000" });
    await irParaPlano(page);
    const q = quadroFontes(page);
    await expect(q.getByText("Os preços são de sua responsabilidade.")).toBeVisible();
    const primeiro = q.locator("li").first();
    await expect(primeiro.getByText("Recomendado")).toBeVisible();
    await expect(primeiro.getByRole("link", { name: /Banco de preços i10/ })).toHaveAttribute("href", "https://pnigp.vercel.app/banco-precos");
    await expect(q.getByRole("link", { name: /Atas de registro de preços/ })).toHaveAttribute("href", "https://pncp.gov.br/app/atas?q=&status=vigente&ufs=SP&pagina=1");
    await expect(q.getByRole("link", { name: /Pesquisa de Preços \(Compras.gov.br\)/ })).toHaveAttribute(
      "href",
      "https://pesquisaprecos.compras.gov.br/pesquisa-precos-frontend-semlogin/"
    );
  });

  test("Ver referência consulta pelo servidor e nunca preenche o valor", async ({ page }) => {
    await entrar(page, "vereador");
    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: `Aquisição de cadeira de rodas para a unidade de saúde ${PREFIXO}`, valor: "3000" });
    await irParaPlano(page);
    const linha = linhaItem(page);
    const ver = linha.getByRole("button", { name: "Ver referência" });
    await expect(ver).toBeDisabled();
    await linha.getByPlaceholder("Item").fill("Cadeira de rodas");
    await ver.click();
    const janela = page.getByRole("dialog", { name: "Referência de preço" });
    // Sem internet nos testes (BANCO_PRECOS_URL vazio): aviso de indisponível.
    await expect(janela.getByText(/Referência indisponível agora/)).toBeVisible();
    await janela.getByRole("button", { name: "Fechar" }).click();
    await expect(janela).toHaveCount(0);
    await expect(linha.locator("input[inputmode=decimal]").nth(1)).toHaveValue("");
  });

  test("CDHU marcada como assinatura paga; recomendada na configuração", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=precos");
    const cdhu = page.locator("div.rounded-box").filter({ hasText: "Tabela CPOS/CDHU" }).first();
    await expect(cdhu.getByText("assinatura paga")).toBeVisible();
    const banco = page.locator("div.rounded-box").filter({ hasText: "Banco de preços i10" }).first();
    await expect(banco.getByText("recomendada")).toBeVisible();
    const atas = page.locator("div.rounded-box").filter({ hasText: "Atas de registro de preços" }).first();
    await expect(atas.getByText("abre já com o item")).toBeVisible();
  });

  test("declaração dos preços: sem ela a emenda não é enviada", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page, `Aquisição de cadeira de rodas para a unidade de saúde ${PREFIXO}`);
    await sql(`update "Emenda" set "declaracaoPrecos" = false where id = $1`, [id]);
    await page.goto(`/emendas/${id}?etapa=3`);
    // A declaração se marca na seção seguinte: as verificações não a listam.
    await expect(page.locator('[data-guia="nova-emenda.treze"]')).toBeVisible();
    await expect(page.getByText("Declaração dos preços pendente")).toHaveCount(0);
    await proximo(page);
    const caixa = page.getByRole("checkbox", { name: /Declaro que pesquisei e informei os preços desta emenda/ });
    await expect(caixa).not.toBeChecked();
    await expect(page.getByRole("button", { name: /^Submeter/ })).toBeDisabled();
    await caixa.check();
    await page.getByRole("button", { name: /^Submeter/ }).click();
    await expect(page).toHaveURL(new RegExp(`/emendas/${id}$`), { timeout: 15_000 });
    const [e] = await sql<{ status: string; declaracaoPrecos: boolean }>(`select status, "declaracaoPrecos" from "Emenda" where id = $1`, [id]);
    expect(e.declaracaoPrecos).toBe(true);
    expect(e.status).toBe("SUBMETIDA");
  });
});

test.describe("D2 — obras por m²", () => {
  test("parâmetro do custo do m² na configuração do exercício", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=exercicio");
    await expect(page.locator("#c-m2")).toHaveValue("2.089,88");
    await expect(page.locator("#c-m2c")).toHaveValue("ago/2026");
  });

  test("obra: item único em m² com o custo de referência, só quando o autor pede", async ({ page }) => {
    await entrar(page, "vereador");
    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.escola, objeto: `Reforma da cobertura da escola ${PREFIXO}`, valor: "150000" });
    await irParaPlano(page);
    const quadro = page.locator('[data-guia="nova-emenda.obra-m2"]');
    await expect(quadro).toContainText("R$ 2.089,88");
    const usar = quadro.getByRole("button", { name: "Usar item único em m²" });
    await expect(usar).toBeDisabled();
    await quadro.getByLabel("Área (m²)").fill("50");
    await expect(quadro).toContainText("R$ 104.494,00");
    await usar.click();
    const linha = linhaItem(page);
    await expect(linha.getByPlaceholder("Item")).toHaveValue(/área construída/);
    await expect(linha.getByLabel("Unidade do item")).toHaveValue("m²");
    await expect(linha.locator("input[inputmode=decimal]").nth(1)).toHaveValue("2.089,88");
    await expect(page.getByRole("button", { name: /Quadro de origem \(1\)/ })).toBeVisible();
  });
});
