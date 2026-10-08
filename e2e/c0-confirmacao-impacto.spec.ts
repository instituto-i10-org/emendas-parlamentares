import { expect, test, type Page } from "@playwright/test";
import { apagarEmendasDeTeste, entrar, inserirEmenda, sql } from "./apoio";

// Etapa C0: as alterações sensíveis de configuração abrem a janela com o que
// muda e quantas emendas a alteração alcança; com emenda enviada alcançada, a
// ciência é obrigatória — e o servidor confere de novo.

const cotaAtual = async () => {
  const [c] = await sql<{ cota: string | null }>(
    `select c."cotaIndividual"::text cota from "ConfiguracaoExercicio" c join "Exercicio" e on e.id = c."exercicioId" where e.ano = 2027`
  );
  return c.cota;
};

async function mudarCota(page: Page, valor: string) {
  await page.goto("/config?aba=exercicio");
  await page.locator("#c-cota").fill(valor);
  await page.getByRole("button", { name: "Salvar parâmetros" }).click();
  const janela = page.getByRole("dialog");
  await expect(janela.locator("[data-impacto]")).toBeVisible({ timeout: 15_000 });
  return janela;
}

test.describe("C0 — confirmação com impacto", () => {
  let cotaOriginal: string | null = null;

  test.beforeAll(async () => {
    cotaOriginal = await cotaAtual();
  });
  test.afterAll(async () => {
    await sql(
      `update "ConfiguracaoExercicio" c set "cotaIndividual" = $1 from "Exercicio" e where e.id = c."exercicioId" and e.ano = 2027`,
      [cotaOriginal]
    );
    await apagarEmendasDeTeste("c0-");
  });

  test("cota com emendas enviadas: mostra o que muda, a contagem e exige ciência; cancelar não grava", async ({ page }) => {
    await inserirEmenda({ id: "c0-a", status: "SUBMETIDA", numero: 9701, submetidaEm: "2026-10-05" });
    await inserirEmenda({ id: "c0-b", status: "APROVADA", numero: 9702, submetidaEm: "2026-10-05" });
    await entrar(page, "admin");

    const janela = await mudarCota(page, "700.000,00");
    await expect(janela.getByText("Cota individual")).toBeVisible();
    await expect(janela.locator("[data-emendas-afetadas]")).toContainText("já enviadas");
    const confirmar = janela.getByRole("button", { name: "Salvar parâmetros" });
    await expect(confirmar).toBeDisabled();
    await janela.getByRole("button", { name: "Cancelar" }).click();
    await expect(janela).toBeHidden();
    expect(await cotaAtual()).toBe(cotaOriginal);

    const outra = await mudarCota(page, "700.000,00");
    await outra.getByRole("checkbox", { name: /Entendo que esta alteração afeta/ }).check();
    await outra.getByRole("button", { name: "Salvar parâmetros" }).click();
    await expect(page.getByText("Parâmetros do exercício salvos.")).toBeVisible();
    expect(Number(await cotaAtual())).toBe(700000);
    const audit = await sql(`select 1 from "AuditLog" where entidade = 'ConfiguracaoExercicio' and acao = 'ATUALIZAR' and "criadoEm" > now() - interval '2 minutes'`);
    expect(audit.length).toBeGreaterThan(0);
  });

  test("sem emenda enviada alcançada: janela simples, sem a caixa de ciência", async ({ page }) => {
    await apagarEmendasDeTeste("c0-");
    await entrar(page, "admin");
    await page.goto("/config?aba=exercicio");
    const [antes] = await sql<{ m: string | null }>(`select c."memoriaCota" m from "ConfiguracaoExercicio" c join "Exercicio" e on e.id = c."exercicioId" where e.ano = 2027`);
    // Texto explicativo: não muda a conferência de nenhuma emenda.
    await page.locator("#c-mem").fill(`${antes.m ?? ""} (revisada)`);
    await page.getByRole("button", { name: "Salvar parâmetros" }).click();
    const janela = page.getByRole("dialog");
    await expect(janela.locator("[data-impacto]")).toBeVisible({ timeout: 15_000 });
    await expect(janela.getByText("Memória de cálculo da cota")).toBeVisible();
    await expect(janela.getByRole("checkbox")).toHaveCount(0);
    await janela.getByRole("button", { name: "Salvar parâmetros" }).click();
    await expect(page.getByText("Parâmetros do exercício salvos.")).toBeVisible();
    await sql(`update "ConfiguracaoExercicio" c set "memoriaCota" = $1 from "Exercicio" e where e.id = c."exercicioId" and e.ano = 2027`, [antes.m]);
  });

  test("o servidor confere de novo: emenda enviada no meio do caminho faz a gravação ser recusada", async ({ page }) => {
    await apagarEmendasDeTeste("c0-");
    const [{ n }] = await sql<{ n: number }>(
      `select count(*)::int n from "Emenda" e join "Exercicio" x on x.id = e."exercicioId" where x.ano = 2027 and e.status in ('SUBMETIDA','EM_TRAMITACAO','EM_DILIGENCIA','APROVADA','REJEITADA')`
    );
    expect(n, "este caso parte de 2027 sem emenda enviada").toBe(0);
    await entrar(page, "admin");
    const janela = await mudarCota(page, "720.000,00");
    await expect(janela.getByRole("checkbox")).toHaveCount(0);
    // Entre abrir a janela e confirmar, uma emenda é enviada.
    await inserirEmenda({ id: "c0-c", status: "SUBMETIDA", numero: 9703, submetidaEm: "2026-10-05" });
    await janela.getByRole("button", { name: "Salvar parâmetros" }).click();
    await expect(page.getByText(/afeta 1 emenda já enviada/)).toBeVisible();
    expect(Number(await cotaAtual())).toBe(700000);
  });

  test("exercício histórico (2026): alteração bloqueada, nada se grava", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/inicio");
    await page.getByLabel("Exercício em exibição").filter({ visible: true }).first().selectOption("2026");
    await page.waitForLoadState("networkidle");
    await page.goto("/config?aba=exercicio");
    const [antes] = await sql<{ t: string }>(`select c."toleranciaValorPct"::text t from "ConfiguracaoExercicio" c join "Exercicio" e on e.id = c."exercicioId" where e.ano = 2026`);
    await page.locator("#c-tol").fill("15");
    await page.getByRole("button", { name: "Salvar parâmetros" }).click();
    const janela = page.getByRole("dialog");
    await expect(janela.getByRole("alert")).toContainText("histórico");
    await expect(janela.getByRole("button", { name: "Salvar parâmetros" })).toHaveCount(0);
    await janela.getByRole("button", { name: "Fechar" }).last().click();
    const [depois] = await sql<{ t: string }>(`select c."toleranciaValorPct"::text t from "ConfiguracaoExercicio" c join "Exercicio" e on e.id = c."exercicioId" where e.ano = 2026`);
    expect(depois.t).toBe(antes.t);
    await page.goto("/inicio");
    await page.getByLabel("Exercício em exibição").filter({ visible: true }).first().selectOption("2027");
  });

  test("situação do projeto de lei: a janela diz que o emendamento fecha", async ({ page }) => {
    await entrar(page, "executivo");
    await page.goto("/executivo/planejamento");
    const linha = page.locator("tr", { hasText: "PL 264/2026" });
    await linha.getByRole("button", { name: "Mudar situação" }).click();
    await page.getByRole("menuitem", { name: "Voltar para Enviado" }).click();
    const janela = page.getByRole("dialog");
    await expect(janela.locator("[data-impacto]")).toBeVisible({ timeout: 15_000 });
    await expect(janela).toContainText("passa de aberto para fechado");
    await janela.getByRole("button", { name: "Cancelar" }).click();
    const [pl] = await sql<{ status: string }>(`select status from "InstrumentoPlanejamento" where numero = 'PL 264/2026'`);
    expect(pl.status).toBe("EM_TRAMITACAO");
  });

  test("destino com emenda enviada não se desativa: a janela orienta a mesclar", async ({ page }) => {
    const [d] = await sql<{ id: string; nome: string }>(`select id, nome from "Destino" where ativo and execucao = 'DIRETA' order by nome limit 1`);
    await inserirEmenda({ id: "c0-d", status: "SUBMETIDA", numero: 9704, submetidaEm: "2026-10-05" });
    await sql(`update "Emenda" set "destinoId" = $1 where id = 'c0-d'`, [d.id]);
    await entrar(page, "admin");
    await page.goto(`/config?aba=destinos`);
    await page.getByPlaceholder(/Buscar/).first().fill(d.nome);
    await page.locator("[data-destino]", { hasText: d.nome }).first().getByRole("button", { name: "Desativar" }).click();
    const janela = page.getByRole("dialog");
    await expect(janela.getByRole("alert")).toContainText("Mesclar");
    await janela.getByRole("button", { name: "Fechar" }).last().click();
    const [depois] = await sql<{ ativo: boolean }>(`select ativo from "Destino" where id = $1`, [d.id]);
    expect(depois.ativo).toBe(true);
  });
});
