import { expect, test, type Page } from "@playwright/test";
import { DESTINOS, abrirMinhaConta, criarRascunho, entrar, sql } from "./apoio";

// Ajustes de interface pelos prints do Diego (08/10/2026, PLANO-MOGI-UI.md).

const criadas: string[] = [];
test.afterAll(async () => {
  if (criadas.length) await sql(`delete from "Emenda" where id = any($1)`, [criadas]);
  await sql(`delete from "Emenda" where objeto like 'UI-PRINT %'`);
});

// Passo 1 preenchido e analisado, sem salvar.
async function passo1(page: Page, o: { execucao: "DIRETA" | "INDIRETA"; destino: string; objeto: string; valor: string }) {
  await page.goto("/emendas/nova");
  await page.locator(`input[name="execucao"][value="${o.execucao}"]`).check({ force: true });
  await page.locator("#f-dest").fill(o.destino);
  await page.getByRole("option").filter({ hasText: o.destino }).first().click();
  await page.locator("#f-pre").fill(o.valor);
  await page.locator("#f-obj").fill(o.objeto);
  await page.getByRole("button", { name: /Analisar e classificar/ }).click();
  const ir = page.getByRole("button", { name: /Ir para o plano de trabalho/ });
  const usar = page.getByRole("button", { name: "Usar esta dotação" }).first();
  await expect(ir.or(usar)).toBeVisible({ timeout: 10_000 });
  if (!(await ir.isVisible())) await usar.click();
  await expect(ir).toBeVisible();
}

test.describe("Ajustes de interface (prints)", () => {
  test("Print 2 — pretendido acima do autorizado: botão ajusta o valor", async ({ page }) => {
    await entrar(page, "vereador");
    await passo1(page, { execucao: "DIRETA", destino: DESTINOS.escola, objeto: "UI-PRINT Aquisição de mobiliário escolar para as salas de aula", valor: "999999999" });
    const ajustar = page.getByRole("button", { name: /Ajustar ao autorizado/ });
    await expect(ajustar).toBeVisible();
    const rotulo = (await ajustar.textContent()) ?? "";
    const valor = rotulo.match(/R\$\s?([\d.,]+)/)?.[1];
    expect(valor).toBeTruthy();
    await ajustar.click();
    await expect(page.locator("#f-pre")).toHaveValue(new RegExp(valor!.replace(/\./g, "\\.")));
    await expect(page.getByText("Valor pretendido ajustado ao autorizado da dotação.")).toBeVisible();
  });

  test("Print 5 — salvar rascunho mantém a etapa, inclusive ao recarregar", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "UI-PRINT Aquisição de cadeira de rodas para a unidade de saúde", valor: "3000" });
    criadas.push(id);
    await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
    await expect(page.getByRole("heading", { name: "Plano de trabalho", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Salvar rascunho" }).last().click();
    await expect(page.getByText("Rascunho salvo.")).toBeVisible();
    await expect(page).toHaveURL(/etapa=2/);
    await expect(page.getByRole("heading", { name: "Plano de trabalho", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Plano de trabalho", exact: true })).toBeVisible();
  });

  test("Print 4 — antes de salvar, 'Salvar rascunho e gerar link' salva e mostra o link", async ({ page }) => {
    await entrar(page, "vereador");
    await passo1(page, { execucao: "INDIRETA", destino: DESTINOS.entidade, objeto: "UI-PRINT Aquisição de colchonetes para as atividades da entidade", valor: "5000" });
    await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
    await page.getByRole("button", { name: "Salvar rascunho e gerar link" }).click();
    await expect(page).toHaveURL(/\/emendas\/c[a-z0-9]+\?etapa=2$/, { timeout: 15_000 });
    await expect(page.getByLabel("Link para a entidade")).toHaveValue(/\/publica\/plano\/[A-Za-z0-9_-]{40,}$/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
    criadas.push(page.url().split("/").pop()!.split("?")[0]);
  });

  // O atalho do Controle Interno (print 7) só aparece onde os atalhos de entrada
  // estão ligados (DEMO_LOGIN); nos testes e em produção, não.
  test("Print 8 — Minha conta é uma janela", async ({ page }) => {
    await entrar(page, "vereador");
    await page.goto("/inicio");
    await abrirMinhaConta(page);
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Trocar a senha" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Rever todos os guias" })).toBeVisible();
    // O endereço antigo leva ao Início com a janela aberta.
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole("dialog", { name: "Minha conta" })).toBeVisible();
  });

  test("Prints 9 a 11 — situação do instrumento: um botão com as opções por extenso", async ({ page }) => {
    await entrar(page, "executivo");
    await page.goto("/executivo/planejamento");
    const linha = page.locator("tr", { hasText: "PL 264/2026" });
    await expect(linha.getByText("←")).toHaveCount(0);
    await linha.getByRole("button", { name: "Mudar situação" }).click();
    await expect(page.getByRole("menuitem", { name: "Voltar para Enviado" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Avançar para Aprovado" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Avançar para Aprovado" }).click();
    const janela = page.getByRole("dialog");
    await expect(janela.locator("[data-impacto]")).toBeVisible({ timeout: 15_000 });
    await janela.getByRole("button", { name: "Cancelar" }).click();
    const [pl] = await sql<{ status: string }>(`select status from "InstrumentoPlanejamento" where numero = 'PL 264/2026'`);
    expect(pl.status).toBe("EM_TRAMITACAO");
  });

  test("Print 17 — imprimir o relatório abre a página limpa, só com o relatório", async ({ page }) => {
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=relatorios");
    const imprimir = page.getByRole("link", { name: "Imprimir" });
    await expect(imprimir).toHaveAttribute("href", /^\/tramitacao\/relatorio\?de=\d{4}-\d{2}-\d{2}&ate=\d{4}-\d{2}-\d{2}$/);
    await page.goto((await imprimir.getAttribute("href"))!);
    await expect(page.getByRole("heading", { name: "Relatório da tramitação" })).toBeVisible();
    for (const t of ["Por situação", "Por autor", "Movimentações"]) await expect(page.getByRole("heading", { name: t })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
  });

  test("Print 6 — nenhuma confirmação nativa do navegador", async ({ page }) => {
    let nativa = false;
    page.on("dialog", (d) => {
      nativa = true;
      void d.dismiss();
    });
    await entrar(page, "executivo");
    await page.goto("/executivo/planejamento");
    await page.locator("tr", { hasText: "PL 264/2026" }).getByRole("button", { name: "Mudar situação" }).click();
    await page.getByRole("menuitem", { name: "Voltar para Enviado" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    expect(nativa).toBe(false);
  });

  test("Item F — no celular, as tabelas viram cartões com o rótulo de cada campo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page, "executivo");
    await page.goto("/executivo/planejamento");
    const tabela = page.locator("table").first();
    await expect(tabela).toBeVisible();
    expect(await tabela.evaluate((t) => getComputedStyle(t).display)).toBe("block");
    expect(await tabela.locator("thead").evaluate((t) => getComputedStyle(t).display)).toBe("none");
    const situacao = page.locator('td[data-rotulo="Situação"]').first();
    await expect(situacao).toBeVisible();
    expect(await situacao.evaluate((td) => getComputedStyle(td, "::before").content)).toContain("Situação");
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });
});
