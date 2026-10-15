import { expect, test, type Page } from "@playwright/test";
import { DESTINOS, criarRascunho, completarPlano, entrar, inserirEmenda, irParaEtapa3, passo1, proximo, sql } from "./apoio";

// Coautoria (pedido do Dr. Emerson, 15/10/2026): vários vereadores na mesma
// emenda, cada um com a sua parte, que sai da cota dele. Tela, cota, listas,
// documento e portal.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

const criadas: string[] = [];
test.afterAll(async () => {
  await sql(`delete from "Emenda" where id like 'te1-%' or id = any($1)`, [criadas]);
});

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
const sem = (s: string) => s.replace(/ /g, " ");
const treze = (page: Page) => page.locator('ol[aria-label="As treze verificações"]').first();
const linha = (page: Page, codigo: string) => treze(page).locator(`li[data-codigo="${codigo}"]`);

// Dois vereadores reais (fora da demonstração), na ordem do nome.
async function vereadores() {
  const r = await sql<{ id: string; nome: string }>(`select id, nome from "Autor" where not demonstracao order by nome limit 2`);
  return { a: r[0], b: r[1] };
}

test.describe("Coautoria", () => {
  test("tela: adicionar vereador, valor pela soma das partes, gravar e reabrir", async ({ page }) => {
    const { b } = await vereadores();
    await entrar(page, "vereador");
    await passo1(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "", valor: "" }, { ate: "objeto" });
    await page.locator("#f-obj").fill("Aquisição de cadeira de rodas para a unidade de saúde");
    await page.locator("#f-pre").fill("50000");
    await page.getByRole("button", { name: "Adicionar vereador" }).click();
    // Sem escolher o vereador, a seção não avança.
    await proximo(page);
    await expect(page.getByText("Escolha o vereador de cada linha").first()).toBeVisible();
    await page.getByLabel("Coautor 1", { exact: true }).selectOption(b.id);
    await page.getByLabel(`Valor de ${b.nome}`).fill("30000");
    await expect(page.getByText(/Valor da emenda:/)).toContainText(BRL(80000));
    await page.locator('[data-guia="nova-emenda.valor"]').screenshot({ path: "test-results/coautoria-tela.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-guia="nova-emenda.valor"]').screenshot({ path: "test-results/coautoria-tela-celular.png" });
    await page.setViewportSize({ width: 1280, height: 720 });
    // A primeira linha é o autor, fixa: não tem lixeira.
    await expect(page.getByRole("button", { name: /^Retirar / })).toHaveCount(1);
    await proximo(page);
    await page.getByRole("button", { name: /Analisar e classificar/ }).click();
    const pronta = page.locator('[data-pronta="sim"]');
    const usar = page.getByRole("button", { name: "Usar esta dotação" }).first();
    await expect(pronta.or(usar)).toBeVisible({ timeout: 10_000 });
    if (!(await pronta.isVisible())) await usar.click();
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page).toHaveURL(/\/emendas\/c[a-z0-9]+(\?|$)/, { timeout: 15_000 });
    const id = new URL(page.url()).pathname.split("/").pop()!;
    criadas.push(id);

    const [e] = await sql<{ valorPretendido: string }>(`select "valorPretendido" from "Emenda" where id = $1`, [id]);
    expect(Number(e.valorPretendido)).toBe(80000);
    const co = await sql<{ autorId: string; valor: string }>(`select "autorId", valor from "CoautorEmenda" where "emendaId" = $1`, [id]);
    expect(co.map((c) => [c.autorId, Number(c.valor)])).toEqual([[b.id, 30000]]);

    // Reaberta: as linhas voltam; retirar o coautor devolve o valor ao autor.
    await page.goto(`/emendas/${id}?etapa=1&secao=3`);
    await expect(page.getByLabel("Coautor 1", { exact: true })).toHaveValue(b.id);
    await expect(page.locator("#f-pre")).toHaveValue("R$ 50.000,00");
    await page.getByRole("button", { name: `Retirar ${b.nome}` }).click();
    await expect(page.getByText(/Valor da emenda:/)).toHaveCount(0);
    await expect(page.locator("#f-pre")).toHaveValue("R$ 50.000,00");
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page.getByText("Rascunho salvo.")).toBeVisible();
    expect(await sql(`select 1 from "CoautorEmenda" where "emendaId" = $1`, [id])).toHaveLength(0);
  });

  test("cota: a parte do coautor é conferida contra a cota dele, na tela e no envio", async ({ page }) => {
    const { b } = await vereadores();
    const [ex] = await sql<{ id: string; cota: string }>(
      `select e.id, c."cotaIndividual" cota from "Exercicio" e join "ConfiguracaoExercicio" c on c."exercicioId" = e.id order by e.ano desc limit 1`
    );
    await entrar(page, "vereador");
    const id = await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: "Aquisição de cadeira de rodas para a unidade de saúde", valor: "3000" });
    criadas.push(id);
    await completarPlano(id);
    // R$ 2.000 do autor e R$ 1.000 do coautor.
    await sql(`insert into "CoautorEmenda" (id, "emendaId", "autorId", ordem, valor) values ($1 || 'c', $1, $2, 0, 1000)`, [id, b.id]);
    // O coautor já gastou a cota inteira em outra emenda.
    await inserirEmenda({ id: "te1-cheia", status: "SUBMETIDA", autorId: b.id, valor: Number(ex.cota), numero: 9790 });

    await irParaEtapa3(page, id);
    await expect(linha(page, "COTA_AUTOR")).toContainText("Falha");
    await expect(linha(page, "COTA_AUTOR")).toContainText(b.nome);

    // Com o saldo de volta, a emenda segue e o envio grava as partes.
    await sql(`delete from "Emenda" where id = 'te1-cheia'`);
    await irParaEtapa3(page, id);
    await expect(linha(page, "COTA_AUTOR")).toContainText("Conforme");
    const remeter = page.getByRole("button", { name: /^Submeter/ });
    if (!(await remeter.isVisible())) await proximo(page);
    await remeter.click();
    await expect(page).toHaveURL(new RegExp(`/emendas/${id}`));
    await expect.poll(async () => (await sql<{ status: string }>(`select status from "Emenda" where id = $1`, [id]))[0].status).toBe("SUBMETIDA");
    expect(await sql(`select 1 from "CoautorEmenda" where "emendaId" = $1`, [id])).toHaveLength(1);
    // Emenda de demonstração: a parte do coautor real não aparece para ele.
    await entrar(page, "admin");
    await page.goto(`/vereador360?autor=${b.id}`);
    await expect(page.getByRole("link", { name: "Aquisição de cadeira de rodas para a unidade de saúde" })).toHaveCount(0);
  });

  test("listas, documento e portal: todos os autores, a parte de cada um, sem quebrar a linha", async ({ page }) => {
    const { a, b } = await vereadores();
    await inserirEmenda({ id: "te1-co", status: "SUBMETIDA", autorId: a.id, ficha: { ficha: "444", unidade: "13.01" }, valor: 80000, numero: 9701, submetidaEm: new Date().toISOString(), objeto: "Emenda em coautoria de teste" });
    await sql(`insert into "CoautorEmenda" (id, "emendaId", "autorId", ordem, valor) values ('te1-co-b', 'te1-co', $1, 0, 30000)`, [b.id]);

    await entrar(page, "admin");
    // Lista geral: o autor e o selo "+1", com nomes e valores no balão.
    await page.goto("/emendas?q=9701");
    const tr = page.locator("tr", { hasText: "Emenda em coautoria de teste" });
    const selo = tr.getByRole("button", { name: /Mais 1 coautor/ });
    await expect(selo).toHaveText("+1");
    await selo.click();
    const balao = page.getByRole("tooltip");
    await expect(balao).toContainText(b.nome);
    expect(sem(await balao.innerText())).toContain(BRL(30000));
    expect(sem(await balao.innerText())).toContain(BRL(50000));

    // Vereador 360 do coautor: a parte dele, com o total embaixo.
    await page.goto(`/vereador360?autor=${b.id}`);
    const l360 = page.locator("tr", { hasText: "Emenda em coautoria de teste" });
    await expect(l360).toContainText("coautor");
    expect(sem(await l360.innerText())).toContain(BRL(30000));
    expect(sem(await l360.innerText())).toContain(`de ${BRL(80000)}`);

    // Documento: autores com o valor, coautoria e uma assinatura por vereador.
    await page.goto(`/emendas/te1-co/documento`);
    const capa = page.locator('[data-doc="capa"]');
    await expect(capa).toContainText(a.nome);
    await expect(capa).toContainText(b.nome);
    await expect(page.getByText("Parlamentar Individual Impositiva, em coautoria.")).toBeVisible();
    await expect(page.getByText(b.nome.toLocaleUpperCase("pt-BR"), { exact: true })).toBeVisible();
    await expect(page.getByText(a.nome.toLocaleUpperCase("pt-BR"), { exact: true })).toBeVisible();

    // Portal: filtrado pelo coautor, a emenda aparece com a parte dele.
    await page.goto(`/publica/emendas?autor=${b.id}`);
    const lp = page.locator("tr", { hasText: "Emenda em coautoria de teste" });
    expect(sem(await lp.innerText())).toContain(BRL(30000));
    await page.goto("/publica/emendas/te1-co");
    await expect(page.getByText("Vereadores", { exact: true })).toBeVisible();
    await expect(page.getByText(b.nome).first()).toBeVisible();

    // Celular: nenhuma das listas rola para o lado.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ["/emendas?q=9701", `/vereador360?autor=${b.id}`, `/publica/emendas?autor=${b.id}`]) {
      await page.goto(url);
      const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(larguras[0], url).toBeLessThanOrEqual(larguras[1]);
    }
  });
});
