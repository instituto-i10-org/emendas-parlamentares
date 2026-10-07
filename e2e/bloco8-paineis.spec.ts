import { expect, test, type Page } from "@playwright/test";
import { apagarEmendasDeTeste, entrar, inserirEmenda, sql, confirmarJanela } from "./apoio";

// Itens 7.1, 7.2, 7.3, 8.1 e 8.2: painel geral, visão do gabinete, resumo por
// autor, comparativo projeto × lei e execução por dotação.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});
test.afterEach(async () => {
  await apagarEmendasDeTeste("t8-");
});

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// O cartão do indicador: o pai do rótulo.
const kpi = (page: Page, rotulo: string) => page.getByText(rotulo, { exact: true }).first().locator("xpath=..");
// Fichas reais do PL 264/2026 (a ficha se repete entre unidades).
const SAUDE = { ficha: "444", unidade: "13.01" };
const EDUCACAO = { ficha: "228", unidade: "11.01" };
const SOCIAL = { ficha: "134", unidade: "14.01" };

// Os mesmos números, direto do banco, no exercício em exibição (o mais recente).
async function totais() {
  const [r] = await sql<{ apresentado: string; acatado: string; contam: string; importadas: string }>(
    `with ex as (select id from "Exercicio" order by ano desc limit 1)
     select
       coalesce(sum(valor) filter (where status in ('SUBMETIDA','EM_TRAMITACAO','EM_DILIGENCIA','APROVADA','REJEITADA')), 0) apresentado,
       coalesce(sum(valor) filter (where status = 'APROVADA'), 0) acatado,
       coalesce(sum(valor) filter (where status in ('SUBMETIDA','EM_TRAMITACAO','EM_DILIGENCIA','APROVADA')), 0) contam,
       (select coalesce(sum(valor), 0) from "EmendaImportada" where "exercicioId" = (select id from ex)) importadas
     from "Emenda" where "exercicioId" = (select id from ex)`
  );
  return { apresentado: Number(r.apresentado), acatado: Number(r.acatado), consumo: Number(r.contam) + Number(r.importadas) };
}

test.describe("Grupo 7 — painéis", () => {
  test("T-7.1-1, T-7.1-2, T-7.1-3 e T-7.1-4 apresentado e acatado lado a lado, três áreas, consumo do teto, sem carga manual", async ({ page }) => {
    await inserirEmenda({ id: "t8-a1", status: "APROVADA", ficha: SAUDE, valor: 11000, numero: 9601 });
    await inserirEmenda({ id: "t8-a2", status: "APROVADA", ficha: EDUCACAO, valor: 12000, numero: 9602 });
    await inserirEmenda({ id: "t8-a3", status: "APROVADA", ficha: SOCIAL, valor: 13000, numero: 9603 });
    await inserirEmenda({ id: "t8-s1", status: "SUBMETIDA", ficha: SAUDE, valor: 14000, numero: 9604 });
    await inserirEmenda({ id: "t8-s2", status: "EM_TRAMITACAO", ficha: EDUCACAO, valor: 15000, numero: 9605 });

    await entrar(page, "comissao");
    await page.goto("/painel");
    let t = await totais();
    await expect(kpi(page, "Apresentado")).toContainText(BRL(t.apresentado));
    await expect(kpi(page, "Acatado")).toContainText(BRL(t.acatado));
    await expect(kpi(page, "Consumo do teto")).toContainText(BRL(t.consumo));
    const area = page.locator("section").filter({ has: page.getByRole("heading", { name: "Por área" }) });
    for (const nome of ["Saúde", "Educação", "Assistência social"]) {
      expect(Number(await area.locator("tr", { hasText: nome }).locator("td").nth(1).innerText())).toBeGreaterThan(0);
    }
    // Todas as áreas do cadastro aparecem, mesmo sem emenda.
    for (const nome of ["Cultura", "Esporte", "Segurança"]) await expect(area.locator("tr", { hasText: nome })).toHaveCount(1);

    await sql(`update "Emenda" set valor = 21000 where id = 't8-a1'`);
    await page.reload();
    t = await totais();
    await expect(kpi(page, "Acatado")).toContainText(BRL(t.acatado));
  });

  test("T-7.2-1, T-7.2-2 e T-7.3-1 visão do gabinete, só a própria, batendo com o resumo", async ({ page }) => {
    await inserirEmenda({ id: "t8-g1", status: "SUBMETIDA", ficha: SAUDE, valor: 20000, numero: 9701, objeto: "Gabinete um" });
    const [outro] = await sql<{ id: string; nome: string }>(`select id, nome from "Autor" where "usuarioId" is null order by nome limit 1`);
    await entrar(page, "vereador");
    await page.goto(`/vereador360?autor=${outro.id}`);
    await expect(page.getByRole("heading", { name: "Vereador Exemplo" })).toBeVisible();
    await expect(page.getByText(outro.nome)).toHaveCount(0);
    for (const k of ["Cota individual", "Comprometido", "Saldo da cota", "Saúde", "Demais áreas"]) await expect(page.getByText(k, { exact: true }).first()).toBeVisible();
    await expect(page.locator("tr", { hasText: "Gabinete um" })).toContainText("Submetida");
    const comprometido = (await kpi(page, "Comprometido").innerText()).match(/R\$\s?[\d.]+,\d{2}/u)![0];

    await entrar(page, "comissao");
    await page.goto("/painel");
    await expect(page.locator("tr", { hasText: "Vereador Exemplo" })).toContainText(comprometido);
  });
});

test.describe("Grupo 8 — projeto e lei", () => {
  test("T-8.1-1, T-8.1-2 e T-8.1-3 gerar a lei do projeto mais as incorporadas; diferença explicada pelas emendas", async ({ page }) => {
    await inserirEmenda({ id: "t8-i1", status: "APROVADA", ficha: SAUDE, valor: 12000, numero: 9801 });
    await inserirEmenda({ id: "t8-i2", status: "APROVADA", ficha: SAUDE, valor: 8000, numero: 9802 });
    await sql(`update "Emenda" set "incorporadaEm" = now() where id in ('t8-i1', 't8-i2')`);
    const [ex] = await sql<{ id: string }>(`select id from "Exercicio" order by ano desc limit 1`);
    const [antes] = await sql<{ total: string }>(
      `select sum("valorAutorizado") total from "Dotacao" d join "InstrumentoPlanejamento" i on i.id = d."instrumentoId"
        where d.ativo and i.especie = 'PROJETO_LEI' and i.tipo = 'LOA' and d."exercicioId" = $1`,
      [ex.id]
    );
    // Só a lei deste teste é apagada no fim: a Lei 6.246/2025 (2026) fica.
    const leisAntes = (await sql<{ id: string }>(`select id from "InstrumentoPlanejamento" where especie = 'LEI_APROVADA'`)).map((x) => x.id);
    try {
      await entrar(page, "admin");
      await page.goto("/comparativo");
      await page.getByRole("button", { name: "Gerar base da lei" }).click();
      await confirmarJanela(page);
      await expect(page.getByText(/Lei gerada/)).toBeVisible({ timeout: 30_000 });
      const [lei] = await sql<{ total: string }>(
        `select sum("valorAutorizado") total from "Dotacao" d join "InstrumentoPlanejamento" i on i.id = d."instrumentoId" where i.especie = 'LEI_APROVADA' and d."exercicioId" = $1`,
        [ex.id]
      );
      // Em Mogi a impositiva soma no destino: a lei é o projeto mais as incorporadas.
      expect(Number(lei.total)).toBeCloseTo(Number(antes.total) + 20000, 2);
      await page.goto(`/comparativo?emendadas=1&uo=${SAUDE.unidade}`);
      const linha = page.locator("tr", { hasText: `ficha ${SAUDE.ficha}` }).first();
      await expect(linha).toContainText(BRL(20000));
      await expect(linha).toContainText("nº 9801");
      await expect(linha).toContainText("nº 9802");
      // Dotação só na lei: marcada.
      const [li] = await sql<{ id: string }>(`select id from "InstrumentoPlanejamento" where especie = 'LEI_APROVADA' and "exercicioId" = $1 limit 1`, [ex.id]);
      await sql(
        `insert into "Dotacao" (id, "instrumentoId", "exercicioId", codigo, ficha, "orgaoId", "unidadeOrcamentariaId", "funcaoId", "subfuncaoId", "programaId", "acaoId", "naturezaDespesaId", "fonteRecursoId", "valorAutorizado", "updatedAt")
         select 't8-nova', $1, d."exercicioId", 't8-nova', '99999', d."orgaoId", d."unidadeOrcamentariaId", d."funcaoId", d."subfuncaoId", d."programaId", d."acaoId", d."naturezaDespesaId",
                (select id from "FonteRecurso" f where f.id <> d."fonteRecursoId" and f."exercicioId" = d."exercicioId" limit 1), 777, now()
           from "Dotacao" d join "UnidadeOrcamentaria" u on u.id = d."unidadeOrcamentariaId" where d."instrumentoId" = $1 and u.codigo = $2 limit 1`,
        [li.id, SAUDE.unidade]
      );
      await page.goto(`/comparativo?emendadas=1&uo=${SAUDE.unidade}`);
      await expect(page.locator("tr", { hasText: "ficha 99999" })).toContainText("Só na lei");
    } finally {
      await sql(`delete from "Dotacao" where "instrumentoId" in (select id from "InstrumentoPlanejamento" where especie = 'LEI_APROVADA' and "exercicioId" = $1)`, [ex.id]);
      await sql(`delete from "InstrumentoPlanejamento" where especie = 'LEI_APROVADA' and not (id = any($1))`, [leisAntes]);
    }
  });

  test("T-8.2-1 execução por dotação soma por etapa", async ({ page }) => {
    await inserirEmenda({ id: "t8-x1", status: "APROVADA", ficha: EDUCACAO, valor: 30000, numero: 9901 });
    await sql(
      `insert into "AndamentoExecucao" (id, "emendaId", etapa, data, valor) values
       ('t8-a-e', 't8-x1', 'EMPENHO', now(), 30000), ('t8-a-l', 't8-x1', 'LIQUIDACAO', now(), 20000), ('t8-a-p', 't8-x1', 'PAGAMENTO', now(), 15000)`
    );
    await entrar(page, "comissao");
    await page.goto("/comparativo?aba=execucao");
    const linha = page.locator("tr", { hasText: "nº 9901" });
    for (const v of [30000, 20000, 15000]) await expect(linha).toContainText(BRL(v));
  });

  test("menu: Projeto × lei aparece para todos os perfis; gerar a base só para quem gere o planejamento", async ({ page }) => {
    await entrar(page, "vereador");
    await expect(page.getByRole("link", { name: "Projeto × lei" }).first()).toBeVisible();
    await page.goto("/comparativo");
    await expect(page.getByRole("heading", { name: "Projeto × lei" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar base da lei" })).toHaveCount(0);
  });
});
