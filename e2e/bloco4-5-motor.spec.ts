import { expect, test, type Page } from "@playwright/test";
import { DESTINOS, criarRascunho, emendaValida as emendaValidaApoio, entrar, sql, confirmarJanela } from "./apoio";

// Itens 4.1 a 4.5 e 12.1 (motor das treze verificações), no fluxo de três
// etapas de Mogi Guaçu: as treze aparecem na etapa 3, acima das conferências
// que já existiam, e a remessa é refeita e gravada no servidor.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});

const OBJETO = "Aquisição de cadeira de rodas para a unidade de saúde";
const criadas: string[] = [];

const treze = (page: Page) => page.locator('ol[aria-label="As treze verificações"]').first();
const linha = (page: Page, codigo: string) => treze(page).locator(`li[data-codigo="${codigo}"]`);

async function irParaEtapa3(page: Page, id: string) {
  await page.goto(`/emendas/${id}`);
  await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
  await page.getByRole("button", { name: /Ir para a validação/ }).click();
  await expect(treze(page)).toBeVisible();
}

async function emendaValida(page: Page): Promise<string> {
  const id = await emendaValidaApoio(page, OBJETO);
  criadas.push(id);
  return id;
}

const botaoRemeter = (page: Page) => page.getByRole("button", { name: /^Submeter/ });
const exercicioAtual = async () => (await sql<{ id: string }>(`select id from "Exercicio" order by ano desc limit 1`))[0].id;

test.afterAll(async () => {
  if (criadas.length) await sql(`delete from "Emenda" where id = any($1)`, [criadas]);
  await sql(`delete from "RegraValidacao"`);
});

test.describe("Grupo 4 — motor das treze verificações", () => {
  test("T-4.1-1 e T-4.2-1 a etapa 3 mostra sempre as treze, com razão e fundamento, acima das conferências de sempre", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto: OBJETO, valor: "3000" });
    criadas.push(id);
    await irParaEtapa3(page, id);
    await expect(treze(page).locator("> li")).toHaveCount(13);
    for (const n of ["(i)", "(vii)", "(xiii)"]) await expect(treze(page)).toContainText(n);
    await expect(linha(page, "PLANO_TRABALHO")).toContainText("Falha");
    await expect(linha(page, "PLANO_TRABALHO")).toContainText(/Plano de trabalho incompleto: .*metas físicas/);
    await expect(linha(page, "TIPO_COERENTE")).toContainText("não é remanejamento nem anulação");
    await expect(linha(page, "CAMPOS_PREENCHIDOS")).toContainText("Fundamento:");
    // O que já existia continua abaixo.
    await expect(page.getByText("Pré-checagem das condições de validade")).toBeVisible();
    await expect(page.getByText("Metas incompletas")).toBeVisible();
    await expect(botaoRemeter(page)).toBeDisabled();
  });

  test("T-4.3-2 aba Validação: fixas travadas; modo trocado é gravado e auditado", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=validacao");
    for (const c of ["CAMPOS_PREENCHIDOS", "EXERCICIO_ABERTO", "INSTRUMENTO_ABERTO", "DOTACAO_EXISTE", "CLASSIFICACAO_COMPLETA", "TIPO_COERENTE"]) {
      await expect(page.locator(`#modo-${c}`)).toHaveCount(0);
      await expect(page.locator(`li[data-codigo="${c}"]`)).toContainText("Sempre bloqueante.");
    }
    await page.locator("#modo-ADERENCIA_LDO").selectOption("ALERTA");
    await page.getByRole("button", { name: "Salvar regras" }).click();
    await confirmarJanela(page);
    await expect(page.getByText("Regras de validação salvas")).toBeVisible();
    const regra = await sql<{ modo: string }>(`select modo from "RegraValidacao" where codigo = 'ADERENCIA_LDO' and "exercicioId" = $1`, [await exercicioAtual()]);
    expect(regra[0].modo).toBe("ALERTA");
    const audit = await sql(`select 1 from "AuditLog" where entidade = 'RegraValidacao'`);
    expect(audit.length).toBeGreaterThan(0);
    await sql(`delete from "RegraValidacao"`);
  });

  test("T-4.3-1 e T-4.3-3 mudar o modo muda a validação seguinte, sem publicação", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page);
    const [d] = await sql<{ programaId: string }>(`select d."programaId" from "Emenda" e join "Dotacao" d on d.id = e."dotacaoId" where e.id = $1`, [id]);
    await sql(`update "Programa" set "constaNoPPA" = false where id = $1`, [d.programaId]);
    try {
      await irParaEtapa3(page, id);
      await expect(linha(page, "PROGRAMA_NO_PPA")).toContainText("Falha");
      await expect(botaoRemeter(page)).toBeDisabled();

      await sql(`insert into "RegraValidacao" (id, codigo, "exercicioId", modo, ativa, "updatedAt") values ('t45-ppa', 'PROGRAMA_NO_PPA', $1, 'ALERTA', true, now())`, [await exercicioAtual()]);
      await irParaEtapa3(page, id);
      await expect(linha(page, "PROGRAMA_NO_PPA")).toContainText("Alerta");
      await expect(linha(page, "PROGRAMA_NO_PPA")).toContainText("verificação alerta");
      await expect(botaoRemeter(page)).toBeEnabled();
    } finally {
      await sql(`update "Programa" set "constaNoPPA" = true where id = $1`, [d.programaId]);
      await sql(`delete from "RegraValidacao"`);
    }
  });

  test("T-4.4-1 e T-4.4-2 o servidor refaz a validação e grava a tentativa recusada", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page);
    await irParaEtapa3(page, id);
    await expect(botaoRemeter(page)).toBeEnabled();
    // A cota muda entre a tela e o envio: o navegador não sabe, o servidor sim.
    const ex = await exercicioAtual();
    const [cfg] = await sql<{ cotaIndividual: string }>(`select "cotaIndividual" from "ConfiguracaoExercicio" where "exercicioId" = $1`, [ex]);
    await sql(`update "ConfiguracaoExercicio" set "cotaIndividual" = 100 where "exercicioId" = $1`, [ex]);
    try {
      await botaoRemeter(page).click();
      await expect(page.getByText("Remessa recusada na conferência do servidor")).toBeVisible();
      await expect(linha(page, "COTA_AUTOR")).toContainText("Falha");
      const [e] = await sql<{ status: string; numero: number | null }>(`select status, numero from "Emenda" where id = $1`, [id]);
      expect(e).toEqual({ status: "INVALIDA", numero: null });
      const [v] = await sql<{ valida: boolean; n: number; momento: string; revisao: number | null; usuarioId: string | null }>(
        `select valida, jsonb_array_length(verificacoes) n, momento, revisao, "usuarioId" from "ValidacaoEmenda" where "emendaId" = $1 order by "executadaEm" desc limit 1`,
        [id]
      );
      expect(v.valida).toBe(false);
      expect(v.n).toBe(13);
      expect(v.momento).toBe("REMESSA");
      expect(v.revisao).not.toBeNull();
      expect(v.usuarioId).not.toBeNull();
      const audit = await sql(`select 1 from "AuditLog" where entidade = 'Emenda' and "entidadeId" = $1 and acao = 'REMESSA_RECUSADA'`, [id]);
      expect(audit).toHaveLength(1);
    } finally {
      await sql(`update "ConfiguracaoExercicio" set "cotaIndividual" = $2 where "exercicioId" = $1`, [ex, cfg.cotaIndividual]);
    }
    // A inválida volta ao autor: reabre no editor e, salva, é rascunho de novo.
    await page.goto(`/emendas/${id}`);
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page.getByText("Rascunho salvo.")).toBeVisible();
    const [depois] = await sql<{ status: string }>(`select status from "Emenda" where id = $1`, [id]);
    expect(depois.status).toBe("RASCUNHO");
  });

  test("T-4.4-3 e T-4.2-2 emenda válida é remetida; relatório e históricos na página, na Comissão e na impressão", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page);
    await irParaEtapa3(page, id);
    await botaoRemeter(page).click();
    await expect(page).toHaveURL(new RegExp(`/emendas/${id}$`));
    await expect(page.getByRole("tab", { name: "Validação", exact: true })).toBeVisible();
    const [e] = await sql<{ status: string; numero: number | null }>(`select status, numero from "Emenda" where id = $1`, [id]);
    expect(e.status).toBe("SUBMETIDA");
    expect(e.numero).not.toBeNull();
    const [v] = await sql<{ valida: boolean; n: number; momento: string }>(
      `select valida, jsonb_array_length(verificacoes) n, momento from "ValidacaoEmenda" where "emendaId" = $1 order by "executadaEm" desc limit 1`,
      [id]
    );
    expect(v).toEqual({ valida: true, n: 13, momento: "REMESSA" });
    await expect(page.locator("aside").getByText("Válida").first()).toBeVisible();
    // Lateral em abas: validações anteriores e situações.
    await page.getByRole("tab", { name: "Validações anteriores" }).click();
    await expect(page.locator("aside details summary", { hasText: "Remessa" })).toBeVisible();
    await page.getByRole("tab", { name: "Situações" }).click();
    await expect(page.locator("aside").getByText("Rascunho → Submetida")).toBeVisible();

    await entrar(page, "comissao");
    await page.goto(`/emendas/${id}`);
    await expect(page.locator('aside ol[aria-label="As treze verificações"] > li').first()).toBeVisible();
    await expect(page.locator("aside").getByText("(xiii)").first()).toBeVisible();

    await page.goto(`/emendas/${id}/plano`);
    await expect(page.getByRole("heading", { name: /^\d+\. Validação$/ })).toBeVisible();
    await expect(page.locator('ol[aria-label="As treze verificações"] > li')).toHaveCount(13);
  });

  test("T-12.1-2 parâmetro definido sem fundamento é recusado; com fundamento, gravado", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=validacao");
    await page.getByLabel("Fundamento: Cota individual").fill("");
    await page.getByRole("button", { name: "Salvar parâmetros da validação" }).click();
    // A recusa aparece na janela, antes de gravar; nada se grava.
    const janela = page.getByRole("dialog");
    await expect(janela.getByText(/Informe o fundamento de: cota individual/)).toBeVisible();
    await janela.getByRole("button", { name: "Fechar" }).last().click();

    await page.getByLabel("Fundamento: Cota individual").fill("Lei Orgânica, art. 140");
    await page.getByLabel("Fundamento: Percentual da saúde").fill("Lei Orgânica, art. 140");
    await page.getByLabel("Fundamento: Prazo de protocolo das emendas").fill("Regimento Interno, art. 210");
    await page.getByLabel("Fundamento: Prazo da diligência").fill("Regimento Interno, art. 210-C, § 2º");
    await page.getByRole("button", { name: "Salvar parâmetros da validação" }).click();
    await confirmarJanela(page);
    await expect(page.getByText("Parâmetros da validação salvos.")).toBeVisible();
    const [c] = await sql<{ fundamentos: Record<string, { texto: string }> }>(`select fundamentos from "ConfiguracaoExercicio" where "exercicioId" = $1`, [await exercicioAtual()]);
    expect(c.fundamentos.cotaIndividual.texto).toBe("Lei Orgânica, art. 140");
    const audit = await sql(`select 1 from "AuditLog" where acao = 'ATUALIZAR_VALIDACAO'`);
    expect(audit.length).toBeGreaterThan(0);
    await sql(`update "ConfiguracaoExercicio" set fundamentos = '{}' where "exercicioId" = $1`, [await exercicioAtual()]);
  });
});
