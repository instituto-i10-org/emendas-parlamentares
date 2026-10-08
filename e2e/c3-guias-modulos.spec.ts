import { expect, test, type Page } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { GUIAS } from "../src/config/guias";
import { CONTAS, dotacaoDaFicha, emendaValida, entrar, inserirEmenda, sql } from "./apoio";

// Etapa C3 (PLANO-MOGI-CONFIG.md): um guia por módulo. Para cada guia, com o
// perfil que vê a tela, abre pelo "Ver ajuda" e percorre todos os passos:
// cada passo com âncora destaca um elemento visível (nenhum balão solto) e o
// balão cabe na tela — a 1440 e a 390 px. Depois, a abertura automática por
// módulo e por etapa da nova emenda, "Pular todos" e a versão que sobe.

const balao = (page: Page) => page.locator(".driver-popover");
const SAUDE = { ficha: "444", unidade: "13.01" };
const PREFIXO = "c3g-";

type Alvo = { guia: string; url: string | (() => string) };

let emendaVista = "";
let rascunho = "";
let importacao = "";

async function abrirAjuda(page: Page, celular: boolean) {
  if (celular) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  await page.getByRole("button", { name: "Ver ajuda" }).click();
  await expect(balao(page)).toBeVisible();
}

// Percorre o guia aberto e confere cada passo. Devolve quantos passos mostrou.
async function percorrer(page: Page, id: string, largura: number): Promise<number> {
  const guia = GUIAS[id];
  const porTitulo = new Map(guia.passos.map((p) => [p.titulo, p]));
  let passos = 0;
  for (let i = 0; i < 20; i++) {
    const titulo = (await balao(page).locator(".driver-popover-title").innerText()).trim();
    const def = porTitulo.get(titulo);
    expect(def, `${id}: passo "${titulo}" não é deste guia`).toBeTruthy();
    if (def?.ancora) {
      // O destaque chega ao elemento novo logo depois do texto do balão.
      const certo = page.locator(`.driver-active-element[data-guia="${def.ancora}"], .driver-active-element[data-guia="menu.celular"]`).first();
      await expect(certo, `${id}: "${titulo}" não destacou ${def.ancora}`).toBeVisible();
    }
    await page.waitForTimeout(250); // o balão termina de se posicionar
    const caixa = await balao(page).boundingBox();
    expect(caixa!.x, `${id}: balão sai pela esquerda`).toBeGreaterThanOrEqual(-1);
    expect(caixa!.x + caixa!.width, `${id}: balão sai pela direita`).toBeLessThanOrEqual(largura + 1);
    passos++;
    const concluir = balao(page).getByRole("button", { name: "Concluir" });
    if (await concluir.isVisible().catch(() => false)) {
      await concluir.click();
      break;
    }
    await balao(page).getByRole("button", { name: "Próximo" }).click();
    await expect(balao(page).locator(".driver-popover-title")).not.toHaveText(titulo);
  }
  await expect(balao(page)).toBeHidden();
  return passos;
}

const configs = ["municipio", "exercicio", "validacao", "portal", "usuarios", "perfis", "areas", "tipos-destino", "destinos", "biblioteca", "precos", "normas", "auditoria"];

const POR_PERFIL: { conta: keyof typeof CONTAS; alvos: () => Alvo[] }[] = [
  {
    conta: "admin",
    alvos: () => [
      { guia: "inicio", url: "/inicio" },
      { guia: "painel", url: "/painel" },
      { guia: "comparativo", url: "/comparativo" },
      { guia: "conformidade", url: "/conformidade" },
      { guia: "conta", url: "/conta" },
      ...configs.map((a) => ({ guia: `config.${a}`, url: `/config?aba=${a}` })),
    ],
  },
  {
    conta: "executivo",
    alvos: () => [
      { guia: "planejamento", url: "/executivo/planejamento" },
      { guia: "importacao", url: () => `/executivo/planejamento/importacao/${importacao}` },
      { guia: "viabilidade", url: "/executivo/viabilidade" },
      { guia: "execucao", url: "/executivo/execucao" },
    ],
  },
  {
    conta: "comissao",
    alvos: () => [
      { guia: "tramitacao", url: "/tramitacao" },
      { guia: "vereador360", url: "/vereador360" },
    ],
  },
  {
    conta: "vereador",
    alvos: () => [
      { guia: "emendas", url: "/emendas" },
      { guia: "emenda", url: () => `/emendas/${emendaVista}` },
    ],
  },
];

test.describe("C3 — um guia por módulo", () => {
  test.setTimeout(300_000);

  test.beforeAll(async ({ browser }, info) => {
    info.setTimeout(240_000);
    await sql(`delete from "Emenda" where id like $1 or objeto like 'Guia C3%'`, [`${PREFIXO}%`]);
    // Uma emenda enviada (visão da emenda, filas da Comissão) e um rascunho
    // completo do vereador (as três etapas da nova emenda).
    await dotacaoDaFicha(SAUDE.ficha, SAUDE.unidade);
    emendaVista = `${PREFIXO}vista`;
    await inserirEmenda({ id: emendaVista, status: "SUBMETIDA", ficha: SAUDE, numero: 9701, submetidaEm: new Date().toISOString(), objeto: "Guia C3 emenda enviada" });
    const page = await browser.newPage();
    await entrar(page, "vereador");
    rascunho = await emendaValida(page, "Guia C3 aquisição de cadeiras de rodas para a unidade de saúde");
    // Uma importação conferida, para o guia da conferência.
    const [ex] = await sql<{ id: string }>(`select id from "Exercicio" where ano = 2027`);
    await sql(`delete from "InstrumentoPlanejamento" where numero = 'PL GUIA-C3'`);
    await sql(
      `insert into "InstrumentoPlanejamento" (id, tipo, especie, numero, ementa, "exercicioId", status, "totalImpresso", "createdAt", "updatedAt")
       values ('inst-guia-c3', 'LOA', 'PROJETO_LEI', 'PL GUIA-C3', 'Instrumento do teste dos guias', $1, 'EM_ELABORACAO', 1000, now(), now())`,
      [ex.id]
    );
    await entrar(page, "executivo");
    await page.goto("/executivo/planejamento");
    await page.locator("tr", { hasText: "PL GUIA-C3" }).getByRole("button", { name: /Importar base/ }).click();
    const cab = "orgao_codigo;unidade_codigo;unidade_nome;funcao_codigo;subfuncao_codigo;programa_codigo;programa_nome;acao_codigo;acao_nome;natureza_codigo;fonte_codigo;ficha;valor_autorizado";
    const linha = "14;14.01;Assistência Social;08;244;4011;Gestão da assistência;2865;Proteção à mulher;3.3.50.39;01.5100000;9701;1.000,00";
    await page.locator("#imp-arq").setInputFiles({ name: "guia-c3.csv", mimeType: "text/csv", buffer: Buffer.from(`${cab}\n${linha}\n${linha.replace(";01.5100000;", ";;")}\n`) });
    await expect(page.getByRole("link", { name: "guia-c3.csv" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Ler e conferir" }).click();
    await expect(page).toHaveURL(/\/importacao\//, { timeout: 60_000 });
    importacao = page.url().split("/").pop()!.split("?")[0];
    await page.close();
  });

  test.afterAll(async () => {
    await sql(`delete from "Emenda" where id like $1 or objeto like 'Guia C3%'`, [`${PREFIXO}%`]);
    await sql(`delete from "InstrumentoPlanejamento" where numero = 'PL GUIA-C3'`);
  });

  for (const [rotulo, largura, altura] of [
    ["1440", 1440, 900],
    ["390", 390, 844],
  ] as const) {
    for (const { conta, alvos } of POR_PERFIL) {
      test(`T-G3 guias de ${conta} a ${rotulo} px: todo passo com âncora visível`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: altura });
        await entrar(page, conta);
        for (const a of alvos()) {
          await page.goto(typeof a.url === "string" ? a.url : a.url());
          await abrirAjuda(page, largura < 768);
          const n = await percorrer(page, a.guia, largura);
          expect(n, `${a.guia}: nenhum passo mostrado`).toBeGreaterThan(0);
          expect(await page.evaluate(() => document.documentElement.scrollWidth), `${a.guia}: rolagem lateral`).toBeLessThanOrEqual(largura);
        }
      });
    }

    test(`T-G3 nova emenda a ${rotulo} px: o guia é o da etapa em que a pessoa está`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await entrar(page, "vereador");
      await page.goto(`/emendas/${rascunho}`);
      await abrirAjuda(page, largura < 768);
      expect(await percorrer(page, "nova-emenda.etapa1", largura)).toBeGreaterThan(2);
      await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
      await abrirAjuda(page, largura < 768);
      expect(await percorrer(page, "nova-emenda.etapa2", largura)).toBeGreaterThan(2);
      await page.getByRole("button", { name: /Ir para a validação/ }).click();
      await abrirAjuda(page, largura < 768);
      expect(await percorrer(page, "nova-emenda.etapa3", largura)).toBeGreaterThan(2);
    });
  }

  test("T-G3 primeiro acesso: cada módulo e cada etapa abrem sozinhos uma vez", async ({ page }) => {
    await sql(`delete from "GuiaVisto" where "usuarioId" = (select id from "User" where email = $1)`, [CONTAS.vereador]);
    await entrar(page, "vereador");
    await page.context().addCookies([{ name: "guias-automaticos", value: "1", url: BASE_URL }]);
    await page.goto("/emendas");
    await expect(balao(page)).toContainText(GUIAS.emendas.passos[0].titulo);
    await balao(page).getByRole("button", { name: "Pular este guia" }).click();
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(balao(page)).toBeHidden();
    // Editor: abre o guia da etapa 1; ao avançar, o da etapa 2 abre sozinho.
    await page.goto(`/emendas/${rascunho}`);
    await expect(balao(page)).toContainText(GUIAS["nova-emenda.etapa1"].passos[0].titulo);
    await balao(page).getByRole("button", { name: "Fechar o guia" }).click();
    await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
    await expect(balao(page)).toContainText(GUIAS["nova-emenda.etapa2"].passos[0].titulo);
    await balao(page).getByRole("button", { name: "Pular este guia" }).click();
    const vistos = await sql<{ guia: string }>(`select guia from "GuiaVisto" where "usuarioId" = (select id from "User" where email = $1)`, [CONTAS.vereador]);
    expect(vistos.map((v) => v.guia).sort()).toEqual(expect.arrayContaining(["emendas", "nova-emenda.etapa1", "nova-emenda.etapa2"]));
  });

  test("T-G3 pular todos vale para os outros módulos; versão nova reabre uma vez", async ({ page }) => {
    await sql(`delete from "GuiaVisto" where "usuarioId" = (select id from "User" where email = $1)`, [CONTAS.comissao]);
    await entrar(page, "comissao");
    await page.context().addCookies([{ name: "guias-automaticos", value: "1", url: BASE_URL }]);
    await page.goto("/painel");
    await expect(balao(page)).toContainText(GUIAS.painel.passos[0].titulo);
    await balao(page).getByRole("button", { name: "Pular todos" }).click();
    await expect(balao(page)).toBeHidden();
    // Todos os guias ficam marcados, inclusive os de telas ainda não visitadas.
    await expect
      .poll(async () => (await sql<{ n: string }>(`select count(*) n from "GuiaVisto" where "pulouTodos" and "usuarioId" = (select id from "User" where email = $1)`, [CONTAS.comissao]))[0].n)
      .toBe(String(Object.keys(GUIAS).length));
    for (const url of ["/tramitacao", "/vereador360", "/conformidade"]) {
      await page.goto(url);
      await page.waitForTimeout(1500);
      await expect(balao(page), url).toBeHidden();
    }
    // O guia da Tramitação "mudou": a versão vista fica para trás.
    await sql(`update "GuiaVisto" set versao = 0 where guia = 'tramitacao' and "usuarioId" = (select id from "User" where email = $1)`, [CONTAS.comissao]);
    await page.goto("/tramitacao");
    await expect(balao(page)).toContainText(GUIAS.tramitacao.passos[0].titulo);
    await balao(page).getByRole("button", { name: "Fechar o guia" }).click();
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(balao(page)).toBeHidden();
  });
});
