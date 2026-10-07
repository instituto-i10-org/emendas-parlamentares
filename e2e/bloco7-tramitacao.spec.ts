import { expect, test, type Page } from "@playwright/test";
import { apagarEmendasDeTeste, emendaValida, entrar, inserirEmenda, sql } from "./apoio";

// Itens 6.1, 6.2, 6.3 e 7.4: situações, filas com filtros e paginação,
// saneamento separado do parecer, incorporação à lei e relatórios.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});
test.afterEach(async () => {
  await apagarEmendasDeTeste("t7-");
});

// Fichas reais do PL 264/2026 (a ficha se repete entre unidades).
const SAUDE = { ficha: "444", unidade: "13.01" };
const EDUCACAO = { ficha: "228", unidade: "11.01" };
const outroAutor = async () => (await sql<{ id: string }>(`select id from "Autor" where "usuarioId" is null order by nome limit 1`))[0].id;

async function decidir(page: Page, linha: ReturnType<Page["locator"]>, decisao: "Aprovar" | "Rejeitar", parecer: string) {
  await linha.getByRole("button", { name: "Decidir" }).click();
  await page.getByRole("button", { name: decisao, exact: true }).click();
  await page.locator("#parecer").fill(parecer);
  await page.getByRole("button", { name: `${decisao} emenda` }).click();
}

test.describe("Grupo 6 — tramitação", () => {
  test("T-6.1-1 rascunho → submetida → em tramitação → aprovada, tudo no histórico", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page, "Aquisição de macas para o centro de saúde");
    await page.goto(`/emendas/${id}`);
    await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
    await page.getByRole("button", { name: /Ir para a validação/ }).click();
    await page.getByRole("button", { name: /^Submeter/ }).click();
    await expect(page).toHaveURL(new RegExp(`/emendas/${id}$`));
    await expect(page.getByRole("heading", { name: "Histórico de validações" })).toBeVisible();
    const [{ numero }] = await sql<{ numero: number }>(`select numero from "Emenda" where id = $1`, [id]);

    try {
      await entrar(page, "comissao");
      await page.goto(`/tramitacao?q=${numero}`);
      const linha = page.locator("tr", { hasText: "macas para o centro" }).first();
      await linha.getByRole("button", { name: "Receber" }).click();
      await expect(page.getByText("Emenda recebida: em tramitação.")).toBeVisible();
      await decidir(page, page.locator("tr", { hasText: "macas para o centro" }).first(), "Aprovar", "A emenda atende ao interesse público e às regras da Lei Orgânica.");
      await expect(page.getByText("Emenda aprovada.")).toBeVisible();

      const passos = await sql<{ de: string | null; para: string; usuario: string | null }>(
        `select h.de, h.para, u.email usuario from "HistoricoEmenda" h left join "User" u on u.id = h."usuarioId" where "emendaId" = $1 order by h."criadoEm"`,
        [id]
      );
      expect(passos.map((p) => p.para)).toEqual(["SUBMETIDA", "EM_TRAMITACAO", "APROVADA"]);
      expect(passos[0].de).toBe("RASCUNHO");
      expect(passos.every((p) => p.usuario)).toBe(true);
      await page.goto(`/emendas/${id}`);
      for (const t of ["Rascunho → Submetida", "Submetida → Em tramitação", "Em tramitação → Aprovada"]) await expect(page.locator("aside").getByText(t)).toBeVisible();
    } finally {
      await sql(`delete from "Emenda" where id = $1`, [id]);
    }
  });

  test("T-6.1-3 fila filtrada por situação, autor e área ao mesmo tempo", async ({ page }) => {
    const outro = await outroAutor();
    await inserirEmenda({ id: "t7-a", status: "SUBMETIDA", ficha: SAUDE, numero: 9001, objeto: "Filtro A — saúde, vereador, submetida" });
    await inserirEmenda({ id: "t7-b", status: "EM_TRAMITACAO", ficha: SAUDE, numero: 9002, objeto: "Filtro B — saúde, vereador, em tramitação" });
    await inserirEmenda({ id: "t7-c", status: "SUBMETIDA", ficha: EDUCACAO, numero: 9003, objeto: "Filtro C — educação, vereador, submetida" });
    await inserirEmenda({ id: "t7-d", status: "SUBMETIDA", ficha: SAUDE, numero: 9004, objeto: "Filtro D — saúde, outro autor, submetida", autorId: outro });
    const [vereador] = await sql<{ id: string }>(`select a.id from "Autor" a join "User" u on u.id = a."usuarioId" where u.email = 'vereador@emendas360.local'`);
    const [saude] = await sql<{ id: string }>(`select id from "AreaAplicacao" where nome = 'Saúde'`);
    await entrar(page, "comissao");
    await page.goto(`/tramitacao?aba=parecer&situacao=SUBMETIDA&autor=${vereador.id}&area=${saude.id}&q=Filtro`);
    await expect(page.getByText("Filtro A")).toBeVisible();
    for (const t of ["Filtro B", "Filtro C", "Filtro D"]) await expect(page.getByText(t)).toHaveCount(0);
    // Pela própria barra de filtros (formulário GET).
    await page.goto("/tramitacao?aba=parecer");
    await page.getByLabel("Buscar").fill("Filtro");
    await page.getByLabel("Situação").selectOption("SUBMETIDA");
    await page.getByLabel("Autor").selectOption(vereador.id);
    await page.getByLabel("Área").selectOption(saude.id);
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText("Filtro A")).toBeVisible();
    await expect(page.getByText("Filtro C")).toHaveCount(0);
  });

  test("T-6.1-4 fila com 60 emendas é paginada", async ({ page }) => {
    for (let i = 1; i <= 60; i++) await inserirEmenda({ id: `t7-p${i}`, status: "SUBMETIDA", ficha: SAUDE, numero: 9100 + i, objeto: `Paginação ${i}` });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=parecer&q=Paginação");
    await expect(page.getByText("60 emendas · página 1 de 3")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(25);
    await page.getByRole("link", { name: "Próxima" }).click();
    await expect(page.getByText("página 2 de 3")).toBeVisible();
  });

  test("T-6.2-1, T-6.2-2 e T-6.2-4 parecer obrigatório; rejeição com parecer; dois pareceres no histórico", async ({ page }) => {
    await inserirEmenda({ id: "t7-r", status: "EM_TRAMITACAO", ficha: SAUDE, numero: 9201, objeto: "Parecer duplo" });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=parecer&q=Parecer duplo");
    const linha = page.locator("tr", { hasText: "Parecer duplo" });
    await linha.getByRole("button", { name: "Decidir" }).click();
    await page.getByRole("button", { name: "Rejeitar", exact: true }).click();
    await page.locator("#parecer").fill("Curto");
    await page.getByRole("button", { name: "Rejeitar emenda" }).click();
    await expect(page.getByText("Escreva o parecer (ao menos 20 caracteres).")).toBeVisible();
    await page.locator("#parecer").fill("Primeiro parecer: a emenda não atende à pertinência temática.");
    await page.getByRole("button", { name: "Rejeitar emenda" }).click();
    await expect(page.getByText("Emenda rejeitada.")).toBeVisible();

    await page.goto("/tramitacao?aba=decididas&q=Parecer duplo");
    await page.locator("tr", { hasText: "Parecer duplo" }).getByRole("button", { name: "Reabrir" }).click();
    await page.locator("#motivo").fill("Erro material na decisão anterior");
    await page.getByRole("button", { name: /Devolver|Reabrir/ }).last().click();
    await expect(page.getByText("Emenda devolvida à fila.")).toBeVisible();
    await page.goto("/tramitacao?aba=parecer&q=Parecer duplo");
    await decidir(page, page.locator("tr", { hasText: "Parecer duplo" }), "Aprovar", "Segundo parecer: corrigido o erro material, a emenda é aprovada.");
    await expect(page.getByText("Emenda aprovada.")).toBeVisible();
    await page.goto("/emendas/t7-r");
    await expect(page.getByText(/Primeiro parecer/)).toBeVisible();
    await expect(page.getByText(/Segundo parecer/).first()).toBeVisible();
  });

  test("T-6.2-3 e T-7.4-1 inválida vai ao saneamento com a verificação que falhou; devolvida, o autor vê o texto", async ({ page }) => {
    await inserirEmenda({
      id: "t7-s",
      status: "INVALIDA",
      ficha: SAUDE,
      objeto: "Saneamento inválida",
      verificacoes: [{ codigo: "COTA_AUTOR", numero: "ix", titulo: "Cota individual do autor", estado: "falha", razao: "Passa da cota em R$ 1.000,00.", fundamento: "LOM", modo: "BLOQUEANTE" }],
    });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=parecer&q=Saneamento");
    await expect(page.getByText("Saneamento inválida")).toHaveCount(0);
    await page.goto("/tramitacao?aba=saneamento&q=Saneamento");
    const linha = page.locator("tr", { hasText: "Saneamento inválida" });
    await expect(linha.getByRole("list", { name: "Verificações que falharam" })).toContainText("(ix) Cota individual do autor: Passa da cota");
    await linha.getByRole("button", { name: "Devolver ao autor" }).click();
    await page.locator("#dev-t7-s").fill("Reduza o valor para caber na sua cota individual.");
    await page.getByRole("button", { name: "Devolver", exact: true }).click();
    await expect(page.getByText("Emenda devolvida ao autor.")).toBeVisible();

    await entrar(page, "vereador");
    await page.goto("/emendas/t7-s");
    await expect(page.getByText("A análise técnica devolveu esta emenda")).toBeVisible();
    await expect(page.getByText("Reduza o valor para caber na sua cota individual.")).toBeVisible();
  });

  test("T-6.2-3 diligência no saneamento com o pedido e o prazo padrão de Configurações", async ({ page }) => {
    await sql(`update "ConfiguracaoExercicio" set "prazoDiligenciaDias" = 7 where "exercicioId" = (select id from "Exercicio" order by ano desc limit 1)`);
    try {
      await inserirEmenda({ id: "t7-dl", status: "SUBMETIDA", ficha: SAUDE, numero: 9250, objeto: "Pedido de ajuste" });
      await entrar(page, "comissao");
      await page.goto("/tramitacao?aba=parecer&q=Pedido de ajuste");
      await page.locator("tr", { hasText: "Pedido de ajuste" }).getByRole("button", { name: "Pedir ajuste" }).click();
      await expect(page.locator("#dil-dias")).toHaveValue("7");
      await expect(page.getByText(/padrão configurado: 7 dias/)).toBeVisible();
      await page.locator("#dil-motivo").fill("Complete as metas físicas e a memória de cálculo do plano de trabalho.");
      await page.getByRole("button", { name: "Devolver para ajuste" }).click();
      await expect(page.getByText("Emenda devolvida ao autor para ajuste.")).toBeVisible();
      await page.goto("/tramitacao?aba=saneamento&q=Pedido de ajuste");
      await expect(page.locator("tr", { hasText: "Pedido de ajuste" })).toContainText("Pedido da Comissão: Complete as metas físicas");
      await expect(page.locator("tr", { hasText: "Pedido de ajuste" })).toContainText("aguardando o autor");
    } finally {
      await sql(`update "ConfiguracaoExercicio" set "prazoDiligenciaDias" = 5`);
    }
  });

  test("T-7.4-2 fila de parecer mostra os alertas da validação na linha", async ({ page }) => {
    await inserirEmenda({
      id: "t7-al",
      status: "SUBMETIDA",
      ficha: SAUDE,
      numero: 9301,
      objeto: "Com alerta",
      verificacoes: [{ codigo: "ADERENCIA_LDO", numero: "viii", titulo: "Aderência às prioridades e metas da LDO", estado: "alerta", razao: "Sem LDO.", fundamento: "CF", modo: "ALERTA" }],
    });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=parecer&q=Com alerta");
    await expect(page.locator("tr", { hasText: "Com alerta" }).getByRole("list", { name: "Alertas da validação" })).toContainText("(viii) Aderência");
  });

  test("T-6.3-1 incorporadas na lei: marcadas uma a uma, com data e responsável", async ({ page }) => {
    await inserirEmenda({ id: "t7-i1", status: "APROVADA", ficha: SAUDE, numero: 9401, objeto: "Incorporar um" });
    await inserirEmenda({ id: "t7-i2", status: "APROVADA", ficha: SAUDE, numero: 9402, objeto: "Incorporar dois" });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=lei&q=Incorporar");
    await page.locator("tr", { hasText: "Incorporar um" }).getByRole("button", { name: "Marcar incorporada" }).click();
    await expect(page.getByText("Marcada como incorporada à lei.")).toBeVisible();
    await expect(page.locator("tr", { hasText: "Incorporar um" })).toContainText("Comissão de Finanças");
    await expect(page.locator("tr", { hasText: "Incorporar dois" })).toContainText("ainda não marcada");
    const linhas = await sql<{ id: string; em: Date | null; por: string | null }>(`select id, "incorporadaEm" em, "incorporadaPorId" por from "Emenda" where id like 't7-i%' order by id`);
    expect(linhas[0].em && linhas[0].por).toBeTruthy();
    expect(linhas[1].em).toBeNull();
  });

  test("T-6.3-2 relatório do período lista as movimentações e exporta", async ({ page }) => {
    await inserirEmenda({ id: "t7-rel", status: "SUBMETIDA", ficha: SAUDE, numero: 9501, objeto: "Relatório do mês" });
    await sql(`insert into "HistoricoEmenda" (id, "emendaId", de, para, "criadoEm") values ('h-t7-rel', 't7-rel', 'RASCUNHO', 'SUBMETIDA', now())`);
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=relatorios");
    await expect(page.getByText("Relatório do mês")).toBeVisible();
    const href = await page.getByRole("link", { name: "CSV" }).last().getAttribute("href");
    const r = await page.request.get(href!);
    expect(r.status()).toBe(200);
    expect(await r.text()).toContain("Relatório do mês");
    const x = await page.request.get(href!.replace("formato=csv", "formato=xlsx"));
    expect(x.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("T-6.1 aba por programa continua com o consolidado de Mogi", async ({ page }) => {
    await inserirEmenda({ id: "t7-pg", status: "APROVADA", ficha: SAUDE, numero: 9601, objeto: "Programa consolidado", valor: 12345 });
    await entrar(page, "comissao");
    await page.goto("/tramitacao?aba=programas&q=Programa consolidado");
    await expect(page.getByRole("heading", { name: "Por programa" })).toBeVisible();
    await expect(page.locator("tbody tr").first()).toContainText("R$ 12.345,00");
  });

  test("T-14.1-1 e T-14.1-3 exportação da lista respeita os filtros; CSV em português", async ({ page }) => {
    await inserirEmenda({ id: "t7-x1", status: "APROVADA", ficha: SAUDE, numero: 9701, objeto: "Exportar aprovada" });
    await inserirEmenda({ id: "t7-x2", status: "SUBMETIDA", ficha: SAUDE, numero: 9702, objeto: "Exportar submetida" });
    await entrar(page, "comissao");
    const [ex] = await sql<{ ano: number }>(`select ano from "Exercicio" order by ano desc limit 1`);
    const r = await page.request.get(`/api/export/emendas?ano=${ex.ano}&formato=csv&lista=1&situacao=APROVADA&q=Exportar`);
    expect(r.status()).toBe(200);
    const texto = await r.text();
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    const linhas = texto.trim().split("\r\n");
    expect(linhas[0]).toContain("Numero;Exercicio;Situacao;Autor;Objeto");
    expect(linhas[0]).not.toContain("Tipo");
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toContain(";13.01;");
    expect(linhas[1]).toContain("Exportar aprovada");
    const x = await page.request.get(`/api/export/emendas?ano=${ex.ano}&formato=xlsx&lista=1&q=Exportar`);
    expect(x.headers()["content-type"]).toContain("spreadsheetml");
  });
});
