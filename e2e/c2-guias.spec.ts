import { expect, test, type Page } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { CONTAS, entrar, sql } from "./apoio";

// Etapa C2 (PLANO-MOGI-CONFIG.md): guias de ajuda em balões, "Ver ajuda" no
// menu, abertura na primeira visita, "Pular este guia" / "Pular todos",
// reabertura quando a versão sobe, "Rever todos os guias" e o quadro da
// primeira configuração no Início.
//
// Nos testes os guias não abrem sozinhos (GUIAS_AUTOMATICOS=false); aqui o
// cookie liga a abertura automática só para este navegador.

const balao = (page: Page) => page.locator(".driver-popover");

async function ligarAutomaticos(page: Page) {
  await page.context().addCookies([{ name: "guias-automaticos", value: "1", url: BASE_URL }]);
}

async function zerarGuias(conta: keyof typeof CONTAS) {
  await sql(`delete from "GuiaVisto" where "usuarioId" = (select id from "User" where email = $1)`, [CONTAS[conta]]);
}

async function vistos(conta: keyof typeof CONTAS) {
  return sql<{ guia: string; versao: number; concluidoEm: Date | null; puladoEm: Date | null; pulouTodos: boolean }>(
    `select guia, versao, "concluidoEm", "puladoEm", "pulouTodos" from "GuiaVisto" where "usuarioId" = (select id from "User" where email = $1)`,
    [CONTAS[conta]]
  );
}

test.describe("C2 — guias de ajuda", () => {
  test.beforeEach(async () => {
    await zerarGuias("admin");
    await zerarGuias("vereador");
  });

  test("T-G-1 abre sozinho na primeira visita; pular este guia grava e não reabre", async ({ page }) => {
    await entrar(page, "admin");
    await ligarAutomaticos(page);
    await page.goto("/inicio");
    await expect(balao(page)).toBeVisible();
    await expect(balao(page)).toContainText("Bem-vindo ao Emendas360");
    await expect(balao(page)).toContainText("Passo 1 de");
    // Os botões pedidos: voltar, próximo, fechar, pular este, pular todos.
    await expect(balao(page).getByRole("button", { name: "Próximo" })).toBeVisible();
    await expect(balao(page).getByRole("button", { name: "Voltar" })).toBeVisible();
    await expect(balao(page).getByRole("button", { name: "Fechar o guia" })).toBeVisible();
    await expect(balao(page).getByRole("button", { name: "Pular todos" })).toBeVisible();
    await balao(page).getByRole("button", { name: "Pular este guia" }).click();
    await expect(balao(page)).toBeHidden();
    await expect.poll(async () => (await vistos("admin")).find((v) => v.guia === "inicio")?.puladoEm).not.toBeFalsy();
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(balao(page)).toBeHidden();
  });

  test("T-G-2 sem abertura automática nada abre; Ver ajuda abre o guia da tela e Concluir grava", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/inicio");
    await page.waitForTimeout(1500);
    await expect(balao(page)).toBeHidden();
    await page.getByRole("button", { name: "Ver ajuda" }).click();
    await expect(balao(page)).toContainText("Bem-vindo ao Emendas360");
    // Percorre até o fim.
    for (let i = 0; i < 12; i++) {
      const concluir = balao(page).getByRole("button", { name: "Concluir" });
      if (await concluir.isVisible().catch(() => false)) {
        await concluir.click();
        break;
      }
      await balao(page).getByRole("button", { name: "Próximo" }).click();
    }
    await expect(balao(page)).toBeHidden();
    await expect.poll(async () => (await vistos("admin")).find((v) => v.guia === "inicio")?.concluidoEm).not.toBeFalsy();
  });

  test("T-G-8 Esc não fecha o guia; as setas avançam e voltam", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/inicio");
    await page.getByRole("button", { name: "Ver ajuda" }).click();
    await expect(balao(page)).toContainText("Passo 1 de");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await expect(balao(page)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(balao(page)).toContainText("Passo 2 de");
    await page.keyboard.press("ArrowLeft");
    await expect(balao(page)).toContainText("Passo 1 de");
    // Nada foi gravado como visto pelo Esc.
    expect((await vistos("admin")).find((v) => v.guia === "inicio")).toBeUndefined();
    await balao(page).getByRole("button", { name: "Fechar o guia" }).click();
    await expect(balao(page)).toBeHidden();
  });

  test("T-G-3 pular todos marca todos os guias; nenhum abre mais sozinho", async ({ page }) => {
    await entrar(page, "admin");
    await ligarAutomaticos(page);
    await page.goto("/inicio");
    await balao(page).getByRole("button", { name: "Pular todos" }).click();
    await expect(balao(page)).toBeHidden();
    await expect(page.getByText("Os guias não abrem mais sozinhos")).toBeVisible();
    await expect.poll(async () => (await vistos("admin")).every((v) => v.pulouTodos)).toBe(true);
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(balao(page)).toBeHidden();
  });

  test("T-G-4 guia que mudou (versão nova) abre de novo uma vez", async ({ page }) => {
    await entrar(page, "admin");
    await ligarAutomaticos(page);
    await sql(
      `insert into "GuiaVisto" (id, "usuarioId", guia, versao, "puladoEm", "updatedAt") select 'g-teste', id, 'inicio', 0, now(), now() from "User" where email = $1`,
      [CONTAS.admin]
    );
    await page.goto("/inicio");
    await expect(balao(page)).toBeVisible();
    await balao(page).getByRole("button", { name: "Fechar o guia" }).click();
    await expect(balao(page)).toBeHidden();
    await expect.poll(async () => (await vistos("admin")).find((v) => v.guia === "inicio")?.versao).toBeGreaterThan(0);
  });

  test("T-G-5 Minha conta: rever todos os guias faz o guia abrir de novo", async ({ page }) => {
    await entrar(page, "admin");
    await ligarAutomaticos(page);
    await page.goto("/inicio");
    await balao(page).getByRole("button", { name: "Pular este guia" }).click();
    await expect.poll(async () => (await vistos("admin")).length).toBeGreaterThan(0);
    await page.goto("/conta");
    await page.getByRole("button", { name: "Rever todos os guias" }).click();
    await expect(page.getByText("cada guia abre de novo")).toBeVisible();
    expect(await vistos("admin")).toHaveLength(0);
    await page.goto("/inicio");
    await expect(balao(page)).toBeVisible();
  });

  test("T-G-6 primeira configuração: oito passos conferidos nos dados, só para quem administra", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/inicio");
    const quadro = page.locator("details", { has: page.locator('[data-guia="inicio.primeira-configuracao"]') });
    await expect(quadro).toBeVisible();
    await expect(quadro.locator("li[data-passo]")).toHaveCount(8);
    // Na base de testes: município, exercício, orçamento, áreas, destinos e usuários feitos.
    for (const id of ["municipio", "exercicio", "loa", "areas", "destinos", "usuarios"]) {
      await expect(quadro.locator(`li[data-passo="${id}"]`)).toContainText("Feito");
    }
    const validacao = quadro.locator('li[data-passo="validacao"]');
    const fundamentos = await sql<{ f: unknown }>(`select c.fundamentos f from "ConfiguracaoExercicio" c join "Exercicio" e on e.id = c."exercicioId" order by e.ano desc limit 1`);
    if (!fundamentos[0] || !Object.keys(fundamentos[0].f as object).length) {
      await expect(validacao.getByRole("link", { name: "Mostrar onde" })).toHaveAttribute("href", /\/config\?aba=validacao&guia=config\.validacao/);
    }
    // Quem não administra não vê o quadro.
    await entrar(page, "vereador");
    await page.goto("/inicio");
    await expect(page.locator('[data-guia="inicio.primeira-configuracao"]')).toHaveCount(0);
  });

  test("T-G-7 no celular, Ver ajuda fica no menu e abre o guia; nada transborda", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page, "admin");
    await page.goto("/inicio");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("button", { name: "Ver ajuda" }).click();
    await expect(balao(page)).toBeVisible();
    const caixa = await balao(page).boundingBox();
    expect(caixa!.x).toBeGreaterThanOrEqual(0);
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
