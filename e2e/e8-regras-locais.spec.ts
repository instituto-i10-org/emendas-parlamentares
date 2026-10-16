import { expect, test } from "@playwright/test";
import { confirmarJanela, emendaValida, entrar, irParaEtapa3, proximo, sql } from "./apoio";

// Regras locais (Configurações › Validação): desligadas por padrão; ligadas,
// entram nas conferências da emenda e no manual público.

const criadas: string[] = [];
const exercicioAtual = async () => (await sql<{ id: string }>(`select id from "Exercicio" order by ano desc limit 1`))[0].id;

test.afterAll(async () => {
  if (criadas.length) await sql(`delete from "Emenda" where id = any($1)`, [criadas]);
  await sql(`delete from "RegraValidacao" where codigo in ('VALOR_MINIMO', 'QUANTIDADE_MAXIMA', 'SEM_PESSOAL_DIVIDA')`);
});

test.describe.serial("Regras locais", () => {
  test("começam desligadas e, ligadas, gravam os parâmetros", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=validacao");
    for (const c of ["VALOR_MINIMO", "QUANTIDADE_MAXIMA", "SEM_PESSOAL_DIVIDA"]) {
      await expect(page.locator(`li[data-codigo="${c}"]`)).toContainText("desligada");
    }
    await page.getByLabel("Ligar: Valor mínimo por emenda").check();
    await page.locator('li[data-codigo="VALOR_MINIMO"]').getByLabel("Mínimo geral (R$)").fill("5000");
    await page.locator('li[data-codigo="VALOR_MINIMO"]').getByLabel("Fundamento por extenso").fill("LDO do exercício, art. 26");
    await page.getByRole("button", { name: "Salvar regras locais" }).click();
    await confirmarJanela(page);
    await expect(page.getByText("Regras de validação salvas")).toBeVisible();
    const [r] = await sql<{ ativa: boolean; parametros: Record<string, number> }>(
      `select ativa, parametros from "RegraValidacao" where codigo = 'VALOR_MINIMO' and "exercicioId" = $1`,
      [await exercicioAtual()]
    );
    expect(r.ativa).toBe(true);
    expect(r.parametros).toEqual({ geral: 5000 });
  });

  test("ligada sem valor é recusada", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=validacao");
    await page.getByLabel("Ligar: Quantidade máxima de emendas por vereador").check();
    await page.getByRole("button", { name: "Salvar regras locais" }).click();
    await confirmarJanela(page);
    await expect(page.getByText(/Informe ao menos um valor em "Quantidade máxima/).first()).toBeVisible();
    const gravada = await sql(`select 1 from "RegraValidacao" where codigo = 'QUANTIDADE_MAXIMA' and ativa`);
    expect(gravada).toHaveLength(0);
  });

  test("emenda abaixo do mínimo não é remetida; o manual mostra a regra", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page, "Aquisição de cadeira de rodas para a unidade de saúde");
    criadas.push(id);
    await irParaEtapa3(page, id);
    await expect(page.getByText("Abaixo do valor mínimo").first()).toBeVisible();
    const b = page.getByRole("button", { name: /^Submeter/ });
    if (!(await b.isVisible())) await proximo(page);
    await expect(b).toBeDisabled();

    await page.goto("/publica/manual");
    await expect(page.getByText("Regras locais do município")).toBeVisible();
    await expect(page.locator('li[data-codigo="VALOR_MINIMO"]')).toContainText("5.000,00");
  });

  test("desligada, a mesma emenda volta a poder ser remetida", async ({ page }) => {
    await sql(`update "RegraValidacao" set ativa = false where codigo = 'VALOR_MINIMO'`);
    await entrar(page, "vereador");
    await irParaEtapa3(page, criadas[0]);
    await expect(page.getByText("Abaixo do valor mínimo")).toHaveCount(0);
    const b = page.getByRole("button", { name: /^Submeter/ });
    if (!(await b.isVisible())) await proximo(page);
    await expect(b).toBeEnabled();
    await page.goto("/publica/manual");
    await expect(page.getByText("Regras locais do município")).toHaveCount(0);
  });
});
