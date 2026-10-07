import { expect, test } from "@playwright/test";
import { apagarEmendasDeTeste, entrar, sql } from "./apoio";

// Itens 12.1 a 12.4, 13.1, 13.3, 14.1, 14.2 e 15.1: normas com arquivo e
// vigência, beneficiários e mesclagem, usuários, auditoria com antes e depois,
// exportação, impressão e apoio à redação.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});
test.afterEach(async () => {
  await apagarEmendasDeTeste("t10-");
});

function pdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
}

test.describe("Grupo 12 — configuração", () => {
  test("T-12.2-1 e T-12.2-2 Regimento com PDF e vigência; edição refletida e auditada", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=normas");
    await page.getByRole("button", { name: "Nova norma" }).click();
    await page.getByRole("button", { name: "Regimento Interno", exact: true }).click();
    await page.locator("#nm-t").fill("Regimento Interno de teste t10");
    await page.locator("#nm-v").fill("2024-01-01");
    await page.locator("#nm-vf").fill("2030-12-31");
    await page.locator("#nm-arq").setInputFiles({ name: "regimento.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(page.getByRole("link", { name: "regimento.pdf" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText(/Norma cadastrada/)).toBeVisible();
    const cartao = page.locator("[data-norma]", { hasText: "Regimento Interno de teste t10" });
    await expect(cartao).toContainText("vigência desde 01/01/2024 até 31/12/2030");
    const href = await cartao.getByRole("link", { name: "Arquivo" }).getAttribute("href");
    const r = await page.request.get(href!);
    expect(r.status()).toBe(200);
    expect((await r.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await cartao.getByRole("button", { name: "Editar" }).click();
    await page.locator("#nm-t").fill("Regimento Interno de teste t10 (consolidado)");
    await page.locator("#nm-vf").fill("");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Norma atualizada.")).toBeVisible();
    await expect(page.locator("[data-norma]", { hasText: "(consolidado)" })).toContainText("vigência desde 01/01/2024");
    const [a] = await sql<{ antes: { titulo: string }; depois: { titulo: string } }>(
      `select "dadosAntes" antes, "dadosDepois" depois from "AuditLog" where entidade = 'DocumentoNormativo' and acao = 'ATUALIZAR' order by "criadoEm" desc limit 1`
    );
    expect(a.antes.titulo).toBe("Regimento Interno de teste t10");
    expect(a.depois.titulo).toBe("Regimento Interno de teste t10 (consolidado)");
    await sql(`delete from "DocumentoNormativo" where titulo like 'Regimento Interno de teste t10%'`);
  });
});
