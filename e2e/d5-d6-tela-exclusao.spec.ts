import { expect, test } from "@playwright/test";
import { DESTINOS, criarRascunho, entrar, escolherExecucao, idDaUrl, proximo, sql } from "./apoio";

// D5: nova tela por seções (validação ao avançar, padrão GOV.UK).
// D6: exclusão com duplo check e "Desfazer" nas linhas do formulário.

test.afterAll(async () => {
  await sql(`delete from "Emenda" where objeto like 'D56 %'`);
});

test.describe("D5 e D6", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, "vereador");
  });

  test("D5 — Próximo não avança com campo faltando: quadro de problemas, campo marcado e link", async ({ page }) => {
    await page.goto("/emendas/nova");
    await expect(page.getByRole("heading", { level: 2, name: /Tipo de emenda e execução/ })).toBeVisible();
    // Só a impositiva está disponível.
    await expect(page.locator('[data-guia="nova-emenda.tipo"] [aria-disabled="true"]')).toHaveCount(3);
    await escolherExecucao(page, "DIRETA");
    await proximo(page);
    await expect(page.getByRole("heading", { level: 2, name: /Destino e endereço/ })).toBeVisible();
    await proximo(page);
    const quadro = page.locator('[data-teste="problemas-secao"]');
    await expect(quadro).toContainText("Há 2 problemas nesta seção");
    await expect(page.locator("#f-dest-erro")).toHaveText(/Escolha para onde vai a emenda/);
    // Continua na mesma seção.
    await expect(page.getByRole("heading", { level: 2, name: /Destino e endereço/ })).toBeVisible();
    await page.locator("#f-dest").fill(DESTINOS.saude);
    await page.getByRole("option").filter({ hasText: DESTINOS.saude }).first().click();
    await expect(quadro).toHaveCount(0);
    await proximo(page);
    await expect(page.getByRole("heading", { level: 2, name: /Objeto e valor/ })).toBeVisible();
  });

  test("D6 — descartar rascunho só depois de digitar EXCLUIR", async ({ page }) => {
    const id = await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "D56 Aquisição de cadeira de rodas para a unidade de saúde", valor: "3000" });
    await page.getByRole("button", { name: "Descartar rascunho" }).click();
    const janela = page.getByRole("dialog");
    const descartar = janela.getByRole("button", { name: "Descartar", exact: true });
    await expect(descartar).toBeDisabled();
    await janela.locator('[data-teste="digitar-excluir"] input').fill("excluir");
    await descartar.click();
    await expect(page).toHaveURL(/\/emendas$/, { timeout: 15_000 });
    expect(await sql(`select 1 from "Emenda" where id = $1`, [id])).toHaveLength(0);
  });

  test("D6 — linha removida volta com Desfazer", async ({ page }) => {
    await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "D56 Aquisição de cadeira de rodas para a unidade de saúde", valor: "3000" });
    await page.goto(`/emendas/${idDaUrl(page)}?etapa=2&secao=3`);
    const linhas = page.locator('[data-tabela="itens"] tbody tr');
    await linhas.first().getByPlaceholder("Item").fill("Cadeira de rodas");
    await linhas.first().getByRole("button", { name: "Adicionar linha abaixo" }).click();
    await expect(linhas).toHaveCount(2);
    await linhas.nth(1).getByPlaceholder("Item").fill("Almofada");
    await linhas.nth(1).getByRole("button", { name: "Remover linha" }).click();
    await expect(linhas).toHaveCount(1);
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(linhas).toHaveCount(2);
    await expect(linhas.nth(1).getByPlaceholder("Item")).toHaveValue("Almofada");
  });
});
