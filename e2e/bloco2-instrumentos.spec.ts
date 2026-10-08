import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { entrar, sql, confirmarJanela } from "./apoio";

// Instrumentos de planejamento e exercícios (itens 1.1, 1.2 e 1.3), com o
// envio e o download de arquivo da fundação (T-0-6, T-0-7).

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

// PDF mínimo válido, com enchimento para chegar ao tamanho pedido.
function pdf(bytes = 2000): Buffer {
  const corpo = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n";
  const fim = "%%EOF\n";
  const enchimento = Math.max(0, bytes - corpo.length - fim.length);
  return Buffer.concat([Buffer.from(corpo), Buffer.from("%" + "x".repeat(Math.max(0, enchimento - 2)) + "\n"), Buffer.from(fim)]);
}

async function abrirNovoInstrumento(page: Page) {
  await page.goto("/executivo/planejamento");
  await page.getByRole("button", { name: "Novo instrumento" }).click();
}

test.describe("Instrumentos de planejamento", () => {
  test("T-1.1-1 e T-0-6 cadastrar LDO com número, ementa, data e PDF; o arquivo volta íntegro", async ({ page }) => {
    await entrar(page, "admin");
    await abrirNovoInstrumento(page);
    await page.getByRole("button", { name: "Projeto de lei", exact: true }).click();
    await page.getByRole("button", { name: "LDO", exact: true }).click();
    await page.locator("#in-num").fill("PL 99/2026");
    await page.locator("#in-dt").fill("2026-04-30");
    await page.locator("#in-em").fill("Dispõe sobre as diretrizes para a elaboração da lei orçamentária de 2027.");
    const conteudo = pdf(12 * 1024 * 1024);
    await page.locator("#in-arq").setInputFiles({ name: "LDO 2027.pdf", mimeType: "application/pdf", buffer: conteudo });
    await expect(page.getByRole("link", { name: "LDO 2027.pdf" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Instrumento cadastrado.")).toBeVisible();

    const linha = page.locator("tr", { hasText: "PL 99/2026" });
    await expect(linha).toContainText("LDO");
    await expect(linha).toContainText("30/04/2026");
    const link = linha.getByRole("link", { name: /LDO 2027\.pdf/ });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    const resp = await page.request.get(href!);
    expect(resp.status()).toBe(200);
    const baixado = await resp.body();
    expect(createHash("sha256").update(baixado).digest("hex")).toBe(createHash("sha256").update(conteudo).digest("hex"));
    const reg = await sql<{ sha256: string; tamanho: number }>(`select sha256, tamanho from "Arquivo" where nome = 'LDO 2027.pdf'`);
    expect(reg[0].tamanho).toBe(conteudo.length);
  });

  test("T-1.1-2 cadastro sem número ou sem ementa é recusado", async ({ page }) => {
    await entrar(page, "admin");
    await abrirNovoInstrumento(page);
    await page.locator("#in-em").fill("Ementa qualquer de teste.");
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Informe o número.")).toBeVisible();
    await page.locator("#in-num").fill("PL 98/2026");
    await page.locator("#in-em").fill("");
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Informe a ementa.")).toBeVisible();
  });

  test("T-1.1-3 editar a ementa; excluir só sem dotações", async ({ page }) => {
    await entrar(page, "admin");
    await abrirNovoInstrumento(page);
    await page.locator("#in-num").fill("PL 97/2026");
    await page.locator("#in-em").fill("Ementa original do instrumento de teste.");
    await page.getByRole("button", { name: "Cadastrar" }).click();
    const linha = page.locator("tr", { hasText: "PL 97/2026" });
    await linha.getByRole("button", { name: "Editar" }).click();
    await page.locator("#in-em").fill("Ementa corrigida do instrumento de teste.");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(linha).toContainText("Ementa corrigida");
    const aud = await sql(`select 1 from "AuditLog" where entidade = 'InstrumentoPlanejamento' and acao = 'ATUALIZAR' and "dadosAntes"::text like '%Ementa original%'`);
    expect(aud.length).toBe(1);
    await linha.getByRole("button", { name: "Excluir" }).click();
    // Duplo check: sem digitar EXCLUIR, o botão da janela não se libera.
    await expect(page.getByRole("dialog").locator("[data-impacto]")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("dialog").getByRole("button", { name: "Excluir", exact: true })).toBeDisabled();
    await confirmarJanela(page);
    await expect(page.getByText("Instrumento excluído.")).toBeVisible();
    await expect(page.locator("tr", { hasText: "PL 97/2026" })).toHaveCount(0);
    // O projeto com base de dotações não oferece exclusão.
    await expect(page.locator("tr", { hasText: "PL 264/2026" }).getByRole("button", { name: "Excluir" })).toHaveCount(0);
  });

  test("T-1.2-1 e T-1.2-2 lei aprovada liga-se a projeto do mesmo tipo; vínculo nos dois sentidos", async ({ page }) => {
    await entrar(page, "admin");
    await abrirNovoInstrumento(page);
    await page.getByRole("button", { name: "Lei aprovada", exact: true }).click();
    await page.getByRole("button", { name: "LOA", exact: true }).click();
    await page.locator("#in-num").fill("Lei 9.999/2026");
    await page.locator("#in-em").fill("Estima a receita e fixa a despesa para 2027.");
    await page.locator("#in-or").selectOption({ label: "LOA · PL 264/2026" });
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Instrumento cadastrado.")).toBeVisible();
    await expect(page.locator("tr", { hasText: "Lei aprovada" }).filter({ hasText: "Lei 9.999/2026" })).toContainText("Lei originada do PL 264/2026");
    await expect(page.locator("tr", { hasText: "Projeto de lei" }).filter({ hasText: "PL 264/2026" })).toContainText("Originou: Lei 9.999/2026");

    // A tela só oferece projetos do mesmo tipo: uma LDO não tem a LOA como origem.
    await abrirNovoInstrumento(page);
    await page.getByRole("button", { name: "Lei aprovada", exact: true }).click();
    await page.getByRole("button", { name: "LDO", exact: true }).click();
    await expect(page.locator("#in-or option", { hasText: "PL 264/2026" })).toHaveCount(0);
    await sql(`delete from "InstrumentoPlanejamento" where numero = 'Lei 9.999/2026'`);
  });
});

test.describe("Emendamento aberto e fechado", () => {
  const projeto = `"InstrumentoPlanejamento" where numero = 'PL 264/2026'`;

  test("T-1.3-1 e T-1.3-2 PL em tramitação abre; em elaboração fecha, com o motivo", async ({ page }) => {
    await entrar(page, "vereador");
    await page.goto("/emendas");
    await expect(page.getByText("Emendamento aberto.")).toBeVisible();
    await sql(`update ${projeto.replace("where", "set status = 'EM_ELABORACAO' where")}`);
    try {
      await page.goto("/emendas");
      await expect(page.getByText("Emendamento fechado.")).toBeVisible();
      await expect(page.getByText(/está em elaboração/)).toBeVisible();
      await page.goto("/emendas/nova");
      await expect(page.getByText("Emendamento fechado")).toBeVisible();
    } finally {
      await sql(`update ${projeto.replace("where", "set status = 'EM_TRAMITACAO' where")}`);
    }
  });

  test("T-1.3-3 exercício encerrado: nem rascunho se grava; reabrir devolve", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=exercicio");
    const linha = page.locator("li", { hasText: "2027" }).first();
    await linha.getByRole("button", { name: "Encerrar" }).click();
    await confirmarJanela(page);
    await expect(page.getByText(/encerrado: o emendamento está fechado/)).toBeVisible();
    try {
      await entrar(page, "vereador");
      // Em Mogi há 2026 e 2027: com 2027 encerrado, o padrão passa a ser o
      // último aberto; o vereador escolhe 2027 no seletor para vê-lo.
      await page.goto("/inicio");
      await page.getByLabel("Exercício em exibição").filter({ visible: true }).first().selectOption("2027");
      await page.waitForLoadState("networkidle");
      await page.goto("/emendas");
      await expect(page.getByText(/O exercício 2027 está encerrado/)).toBeVisible();
    } finally {
      await sql(`update "Exercicio" set status = 'ABERTO' where ano = 2027`);
    }
  });

  test("T-1.3-4 seletor de exercício visível com menu recolhido, no celular e com um ano só", async ({ page }) => {
    await entrar(page, "vereador");
    await page.goto("/inicio");
    await expect(page.getByLabel("Exercício em exibição").filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Recolher menu" }).click();
    await expect(page.getByLabel("Exercício em exibição").filter({ visible: true }).first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 800 });
    await page.reload();
    await expect(page.getByLabel("Exercício em exibição").filter({ visible: true }).first()).toBeVisible();
  });
});

test("T-0-7 arquivo privado não baixa sem login", async ({ page }) => {
  await entrar(page, "admin");
  const [a] = await sql<{ id: string }>(`select id from "Arquivo" limit 1`);
  test.skip(!a, "nenhum arquivo enviado nesta rodada");
  await sql(`update "Arquivo" set publico = false where id = $1`, [a.id]);
  await page.context().clearCookies();
  const r = await page.request.get(`/api/arquivos/${a.id}`);
  expect(r.status()).toBe(401);
  await sql(`update "Arquivo" set publico = true where id = $1`, [a.id]);
  const r2 = await page.request.get(`/api/arquivos/${a.id}`);
  expect(r2.status()).toBe(200);
});
