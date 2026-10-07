import { expect, test } from "@playwright/test";
import { apagarEmendasDeTeste, entrar, inserirEmenda, sql } from "./apoio";

// Itens 9.1, 9.2, 10.1, 11.1 e 11.2: portal público, manual lido
// do banco e conformidade derivada do estado real.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});
test.afterEach(async () => {
  await apagarEmendasDeTeste("t9-");
  await sql(`update "Municipio" set "portalPublico" = true`);
});

const outroAutor = async () => (await sql<{ id: string; nome: string }>(`select id, nome from "Autor" where "usuarioId" is null and not demonstracao order by nome limit 1`))[0];
// Ficha da saúde no projeto de lei de 2027 (unidade 13.01).
const FICHA = { ficha: "444", unidade: "13.01" };

test.describe("Grupo 9 — portal", () => {
  test("T-9.1-1, T-9.1-2, T-9.2-1 a T-9.2-5 portal sem login: números, busca, filtro, paginação e ficha completa", async ({ page }) => {
    const autor = await outroAutor();
    for (let i = 1; i <= 30; i++) {
      await inserirEmenda({ id: `t9-${i}`, status: i <= 3 ? "APROVADA" : "SUBMETIDA", autorId: autor.id, ficha: FICHA, numero: 9900 + i, objeto: i === 1 ? "Aquisição de cadeira de rodas t9" : `Objeto portal t9 ${i}` });
    }
    await page.context().clearCookies();
    await page.goto("/publica");
    for (const k of ["Emendas apresentadas", "Total apresentado", "Total acatado"]) await expect(page.getByText(k, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Por situação" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Por vereador" })).toBeVisible();
    await expect(page.getByText(autor.nome).first()).toBeVisible();

    await page.goto("/publica/emendas?q=cadeira de rodas t9");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.goto("/publica/emendas?q=t9&situacao=APROVADA");
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await page.goto("/publica/emendas?q=t9");
    await expect(page.locator("tbody tr")).toHaveCount(25);
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    const links = await page.locator("tbody tr a").count();
    expect(links).toBe(25);
    await page.locator("tbody tr a").first().click();
    for (const k of ["Vereador", "Valor"]) await expect(page.getByText(k, { exact: true }).first()).toBeVisible();
    for (const k of ["Órgão", "Unidade", "Função", "Subfunção", "Programa", "Ação", "Natureza", "Fonte"]) await expect(page.getByText(k, { exact: true }).first()).toBeVisible();
  });

  test("T-11.1-5 portal desligado: indisponível e conformidade pendente", async ({ page }) => {
    await sql(`update "Municipio" set "portalPublico" = false`);
    await page.context().clearCookies();
    await page.goto("/publica/emendas");
    await expect(page.getByText("Portal indisponível")).toBeVisible();
    await entrar(page, "admin");
    await page.goto("/conformidade");
    const item = page.locator("li[data-item=PORTAL]");
    await expect(item).toContainText("desligado");
    await item.getByRole("link", { name: "Resolver" }).click();
    await expect(page).toHaveURL(/aba=portal/);
    await page.getByRole("button", { name: "Ligar portal" }).click();
    await expect(page.getByText("Portal público ligado.")).toBeVisible();
  });
});

test.describe("Grupo 10 — manual", () => {
  test("T-10.1-1 a T-10.1-5 manual público lido do banco", async ({ page }) => {
    const [ex] = await sql<{ id: string }>(`select id from "Exercicio" order by ano desc limit 1`);
    await sql(`update "ConfiguracaoExercicio" set "prazoProtocolo" = '2026-11-20T23:59:59-03:00', "percentualSaude" = 60 where "exercicioId" = $1`, [ex.id]);
    await sql(`delete from "RegraValidacao" where codigo = 'ADERENCIA_LDO' and "exercicioId" = $1`, [ex.id]);
    await sql(`insert into "RegraValidacao" (id, codigo, "exercicioId", modo, ativa, "updatedAt") values ('t9-r', 'ADERENCIA_LDO', $1, 'ALERTA', true, now())`, [ex.id]);
    const [orig] = await sql<{ cota: string | null; prazo: Date | null; saude: string }>(
      `select "cotaIndividual" cota, "prazoProtocolo" prazo, "percentualSaude" saude from "ConfiguracaoExercicio" where "exercicioId" = $1`,
      [ex.id]
    );
    try {
      await page.context().clearCookies();
      await page.goto("/publica/manual");
      await expect(page.getByText("20/11/2026")).toBeVisible();
      await expect(page.getByText("60%").first()).toBeVisible();
      await expect(page.locator("li[data-codigo=ADERENCIA_LDO]")).toContainText("só alerta");
      await page.goto("/publica");
      await expect(page.getByText(/No mínimo 60%/)).toBeVisible();
      await expect(page.getByText(/metade/i)).toHaveCount(0);
      // Parâmetro em branco: "não definido".
      await sql(`update "ConfiguracaoExercicio" set "cotaIndividual" = null where "exercicioId" = $1`, [ex.id]);
      await page.goto("/publica/manual");
      await expect(page.locator("li", { hasText: "Cota individual:" })).toContainText("não definido");
    } finally {
      await sql(`update "ConfiguracaoExercicio" set "prazoProtocolo" = $2, "percentualSaude" = $3, "cotaIndividual" = $4 where "exercicioId" = $1`, [ex.id, orig.prazo, orig.saude, orig.cota]);
      await sql(`delete from "RegraValidacao" where id = 't9-r'`);
    }
  });
});

test.describe("Grupo 11 — conformidade", () => {
  test("T-11.1-1 e T-11.2-1 Lei Orgânica desativada fica pendente, com providência e link", async ({ page }) => {
    await sql(`update "DocumentoNormativo" set ativo = false where tipo = 'LOM'`);
    try {
      await entrar(page, "admin");
      await page.goto("/conformidade");
      const lom = page.locator("li[data-item=LOM]");
      await expect(lom).toContainText("Nenhum dispositivo da Lei Orgânica ativo");
      await expect(lom).toContainText("Providência:");
      await lom.getByRole("link", { name: "Resolver" }).click();
      await expect(page).toHaveURL(/aba=normas/);
    } finally {
      await sql(`update "DocumentoNormativo" set ativo = true where tipo = 'LOM'`);
    }
  });

  test("T-11.1-4 manual: publicar com ato instituidor resolve a pendência", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/conformidade");
    await expect(page.locator("li[data-item=MANUAL]")).toContainText("Sem ato instituidor");
    await page.goto("/config?aba=portal");
    await page.locator("#ato-manual").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Publicar manual" }).click();
    await expect(page.getByText("Manual publicado.")).toBeVisible();
    await page.goto("/conformidade");
    await expect(page.locator("li[data-item=MANUAL]")).toContainText("instituído por ato cadastrado e publicado");
    await page.context().clearCookies();
    await page.goto("/publica/manual");
    await expect(page.getByText(/Publicado:/).locator("..")).toContainText("em ");
    await sql(`update "Municipio" set "manualAtoId" = null, "manualPublicadoEm" = null, "manualPublicadoPorId" = null`);
  });
});
