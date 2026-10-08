import { expect, test, type Page } from "@playwright/test";
import { DESTINOS, completarPlano, entrar, sql } from "./apoio";

// D3: o valor da emenda é o informado; a planilha o comprova.
// D4: dotação informada à mão, achada na LOA ou fora dela.

test.afterAll(async () => {
  await sql(`delete from "Emenda" where objeto like 'D34 %'`);
});

async function inicio(page: Page, objeto: string, valor = "3000") {
  await page.goto("/emendas/nova");
  await page.locator(`input[name="execucao"][value="DIRETA"]`).check({ force: true });
  await page.locator("#f-dest").fill(DESTINOS.saude);
  await page.getByRole("option").filter({ hasText: DESTINOS.saude }).first().click();
  await page.locator("#f-pre").fill(valor);
  await page.locator("#f-obj").fill(objeto);
}

async function informar(page: Page, d: { unidade: string; funcional: string; natureza: string; fonte: string; ficha?: string }) {
  await page.getByRole("button", { name: "Informar a dotação manualmente" }).click();
  await page.locator("#f-dot-unidade").fill(d.unidade);
  await page.locator("#f-dot-funcional").fill(d.funcional);
  await page.locator("#f-dot-natureza").fill(d.natureza);
  await page.locator("#f-dot-fonte").fill(d.fonte);
  if (d.ficha) await page.locator("#f-dot-ficha").fill(d.ficha);
  await page.getByRole("button", { name: /^Conferir na/ }).click();
}

async function salvar(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
  await expect(page).toHaveURL(/\/emendas\/c[a-z0-9]+/, { timeout: 15_000 });
  return new URL(page.url()).pathname.split("/").pop()!;
}

test.describe("D3 e D4", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, "vereador");
  });

  test("D3 — planilha fora da tolerância trava; o atalho iguala o valor ao total", async ({ page }) => {
    await inicio(page, "D34 Aquisição de cadeira de rodas para a unidade de saúde", "3000");
    await page.getByRole("button", { name: /Analisar e classificar/ }).click();
    const ir = page.getByRole("button", { name: /Ir para o plano de trabalho/ });
    const usar = page.getByRole("button", { name: "Usar esta dotação" }).first();
    await expect(ir.or(usar)).toBeVisible({ timeout: 10_000 });
    if (!(await ir.isVisible())) await usar.click();
    await ir.click();
    const linha = page.locator('[data-tabela="itens"] tbody tr').first();
    await linha.getByPlaceholder("Item").fill("Cadeira de rodas");
    await linha.locator("input[inputmode=decimal]").nth(0).fill("1");
    await linha.locator("input[inputmode=decimal]").nth(1).fill("2000");
    const conf = page.locator('[data-teste="conferencia-planilha"]');
    await expect(conf).toHaveAttribute("data-estado", "fora");
    await conf.getByRole("button", { name: "Usar o total da planilha como valor da emenda" }).click();
    await expect(conf).toHaveAttribute("data-estado", "igual");
    await expect(page.locator('[data-guia="nova-emenda.resumo"]')).toContainText("Valor da emenda");
    await expect(page.locator('[data-guia="nova-emenda.resumo"]')).toContainText("R$ 2.000,00");
    const id = await salvar(page);
    const [e] = await sql<{ valor: string; valorPretendido: string }>(`select valor, "valorPretendido" from "Emenda" where id = $1`, [id]);
    expect(Number(e.valor)).toBe(2000);
    expect(Number(e.valorPretendido)).toBe(2000);
  });

  test("D4 — dotação informada e encontrada na LOA segue com ela", async ({ page }) => {
    const [d] = await sql<{ id: string; uo: string; funcional: string; natureza: string; fonte: string; ficha: string; codigo: string }>(
      `select d.id, u.codigo uo, f.codigo || '.' || s.codigo || '.' || p.codigo || '.' || a.codigo funcional, n.codigo natureza, fr.codigo fonte, d.ficha, d.codigo
         from "Dotacao" d
         join "UnidadeOrcamentaria" u on u.id = d."unidadeOrcamentariaId"
         join "Funcao" f on f.id = d."funcaoId" join "Subfuncao" s on s.id = d."subfuncaoId"
         join "Programa" p on p.id = d."programaId" join "Acao" a on a.id = d."acaoId"
         join "NaturezaDespesa" n on n.id = d."naturezaDespesaId" join "FonteRecurso" fr on fr.id = d."fonteRecursoId"
         join "InstrumentoPlanejamento" i on i.id = d."instrumentoId" join "Exercicio" e on e.id = d."exercicioId"
        where d.ativo and i.especie = 'PROJETO_LEI' and f.codigo = '10' and n.codigo = '4.4.90.52'
        order by e.ano desc, i."createdAt", d.ordem limit 1`
    );
    await inicio(page, "D34 Aquisição de equipamento informado na LOA");
    await informar(page, { unidade: d.uo, funcional: d.funcional, natureza: d.natureza, fonte: d.fonte, ficha: d.ficha });
    await expect(page.getByText("Encontrada na LOA")).toBeVisible();
    await expect(page.getByRole("button", { name: /Ir para o plano de trabalho/ })).toBeVisible();
    const id = await salvar(page);
    const [e] = await sql<{ dotacaoId: string; dotacaoInformada: { naLoa: boolean } }>(`select "dotacaoId", "dotacaoInformada" from "Emenda" where id = $1`, [id]);
    expect(e.dotacaoId).toBe(d.id);
    expect(e.dotacaoInformada.naLoa).toBe(true);
  });

  test("D4 — fora da LOA: declaração, envio e selo na tramitação", async ({ page }) => {
    await inicio(page, "D34 Aquisição de equipamento fora da LOA");
    await informar(page, { unidade: "02.10", funcional: "10.302.9999.2999", natureza: "4.4.90.52", fonte: "01.1100000" });
    await expect(page.getByText("Não encontrada na LOA")).toBeVisible();
    await page.getByText("A classificação foi informada por mim e é de minha responsabilidade.").click();
    const id = await salvar(page);
    const [e] = await sql<{ dotacaoId: string | null; dotacaoInformada: { naLoa: boolean }; declaracaoDotacao: boolean }>(
      `select "dotacaoId", "dotacaoInformada", "declaracaoDotacao" from "Emenda" where id = $1`,
      [id]
    );
    expect(e.dotacaoId).toBeNull();
    expect(e.dotacaoInformada.naLoa).toBe(false);
    expect(e.declaracaoDotacao).toBe(true);

    await completarPlano(id);
    await page.goto(`/emendas/${id}`);
    await expect(page.getByText("Não encontrada na LOA")).toBeVisible();
    await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
    await page.getByRole("button", { name: /Ir para a validação/ }).click();
    await page.getByRole("button", { name: /^Submeter/ }).click();
    await expect(page).toHaveURL(new RegExp(`/emendas/${id}$`), { timeout: 15_000 });
    const [{ numero, status }] = await sql<{ numero: number; status: string }>(`select numero, status from "Emenda" where id = $1`, [id]);
    expect(status).not.toBe("INVALIDA");
    const [v] = await sql<{ verificacoes: { numero: string; estado: string }[] }>(
      `select verificacoes from "ValidacaoEmenda" where "emendaId" = $1 order by momento desc limit 1`,
      [id]
    );
    expect(v.verificacoes.find((x) => x.numero === "iv")?.estado).toBe("alerta");

    await entrar(page, "comissao");
    await page.goto(`/tramitacao?q=${numero}`);
    const linha = page.locator("tr", { hasText: "fora da LOA" }).first();
    await expect(linha.getByText("dotação informada pelo vereador")).toBeVisible();
    await page.goto(`/emendas/${id}`);
    await expect(page.getByText(/não encontrada na LOA\. Declaração/)).toBeVisible();
  });
});
