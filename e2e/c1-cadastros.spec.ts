import { expect, test, type Page } from "@playwright/test";
import { entrar, sql } from "./apoio";

// Etapa C1: cadastros que configuram o município pela tela — Município, Áreas,
// Tipos de destino, destinos por planilha e emendas de anos anteriores. Só o
// Administrador Geral grava; quem vê Configurações só consulta.

const csv = (nome: string, linhas: string[]) => ({ name: nome, mimeType: "text/csv", buffer: Buffer.from("﻿" + linhas.join("\r\n") + "\r\n", "utf-8") });

async function conferir(page: Page, tipo: "destinos" | "historico", arquivo: ReturnType<typeof csv>) {
  await page.locator(`#pl-${tipo}`).setInputFiles(arquivo);
  await page.getByRole("button", { name: "Conferir planilha" }).click();
  return page.getByRole("dialog").locator("[data-conferencia]");
}

test.describe("C1 — cadastros pela tela", () => {
  test("Município: dados de Mogi preenchidos; admin edita (auditado); quem não é admin só vê", async ({ page }) => {
    const [antes] = await sql<{ nomeCamara: string }>(`select "nomeCamara" from "Municipio" limit 1`);
    try {
      await entrar(page, "admin");
      await page.goto("/config?aba=municipio");
      await expect(page.locator("#mu-nome")).toHaveValue("Mogi Guaçu");
      await expect(page.locator("#mu-uf")).toHaveValue("SP");
      await expect(page.locator("#mu-ibge")).toHaveValue("3530706");
      await page.locator("#mu-camara").fill("Câmara Municipal de Mogi Guaçu (teste C1)");
      await page.getByRole("button", { name: "Salvar dados do município" }).click();
      await expect(page.getByText("Dados do município salvos.")).toBeVisible();
      const audit = await sql(`select 1 from "AuditLog" where entidade = 'Municipio' and acao = 'ATUALIZAR' and "dadosDepois"->>'nomeCamara' like '%teste C1%'`);
      expect(audit.length).toBe(1);
      // IBGE com tamanho errado é recusado.
      await page.locator("#mu-ibge").fill("123");
      await page.getByRole("button", { name: "Salvar dados do município" }).click();
      await expect(page.getByText("O código IBGE tem 7 dígitos.")).toBeVisible();

      // Presidente (administra configurações, mas não é Administrador Geral): só vê.
      await entrar(page, "presidente");
      await page.goto("/config?aba=municipio");
      await expect(page.locator("#mu-nome")).toBeDisabled();
      await expect(page.getByRole("button", { name: "Salvar dados do município" })).toHaveCount(0);
      await expect(page.getByText("Somente o Administrador Geral altera estes dados.")).toBeVisible();
    } finally {
      await sql(`update "Municipio" set "nomeCamara" = $1`, [antes.nomeCamara]);
    }
  });

  test("Áreas: as 9 de Mogi; criar, renomear, reordenar, excluir; área com objetos não se exclui", async ({ page }) => {
    try {
      await entrar(page, "admin");
      await page.goto("/config?aba=areas");
      for (const a of ["Saúde", "Educação", "Assistência social"]) await expect(page.locator(`[data-area="${a}"]`)).toBeVisible();

      await page.getByRole("button", { name: "Nova área" }).click();
      await page.locator("#ar-nome").fill("Área Teste C1");
      await page.locator("#ar-orgaos").fill("99");
      await page.getByRole("button", { name: "Criar área" }).click();
      await expect(page.getByText("Área “Área Teste C1” criada.")).toBeVisible();
      await expect(page.locator('[data-area="Área Teste C1"]')).toBeVisible();

      // Renomear.
      await page.locator("tr", { has: page.locator('[data-area="Área Teste C1"]') }).getByRole("button", { name: "Editar" }).click();
      await page.locator("#ar-nome").fill("Área Teste C1 renomeada");
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(page.locator('[data-area="Área Teste C1 renomeada"]')).toBeVisible();

      // Reordenar: sobe uma posição.
      const ordem = async () => (await sql<{ nome: string }>(`select nome from "AreaAplicacao" order by ordem, nome`)).map((r) => r.nome);
      const antes = await ordem();
      await page.getByRole("button", { name: "Subir Área Teste C1 renomeada" }).click();
      await expect.poll(async () => (await ordem()).indexOf("Área Teste C1 renomeada")).toBe(antes.indexOf("Área Teste C1 renomeada") - 1);

      // Saúde tem objetos: a janela já mostra a lista e não oferece excluir.
      await page.locator("tr", { has: page.locator('[data-area="Saúde"]') }).getByRole("button", { name: "Excluir" }).click();
      const janela = page.getByRole("dialog");
      await expect(janela.getByText(/não pode ser excluída: \d+ objeto\(s\)/)).toBeVisible();
      await expect(janela.getByRole("listitem", { name: undefined }).filter({ hasText: "Ambulância" })).toBeVisible();
      await expect(janela.getByRole("button", { name: "Excluir área" })).toHaveCount(0);
      await expect(janela.getByRole("link", { name: "Ir para a Biblioteca de objetos" })).toHaveAttribute("href", "/config?aba=biblioteca");
      await janela.getByRole("button", { name: "Fechar" }).last().click();
      expect((await sql(`select 1 from "AreaAplicacao" where nome = 'Saúde'`)).length).toBe(1);

      // A área de teste, sem objetos, sai.
      await page.locator("tr", { has: page.locator('[data-area="Área Teste C1 renomeada"]') }).getByRole("button", { name: "Excluir" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Excluir área" }).click();
      await expect(page.getByText("Área “Área Teste C1 renomeada” excluída.")).toBeVisible();
      const trilha = await sql<{ acao: string }>(`select acao from "AuditLog" where entidade = 'AreaAplicacao' and acao in ('CRIAR','RENOMEAR','REORDENAR','EXCLUIR') order by "criadoEm" desc limit 4`);
      expect(trilha.map((t) => t.acao).sort()).toEqual(["CRIAR", "EXCLUIR", "RENOMEAR", "REORDENAR"]);
    } finally {
      await sql(`delete from "AreaAplicacao" where nome like 'Área Teste C1%'`);
      // Devolve a ordem de cadastro.
      await sql(`update "AreaAplicacao" a set ordem = o.n from (select id, row_number() over (order by ordem, nome) n from "AreaAplicacao") o where o.id = a.id`);
    }
  });

  test("Áreas: editar os órgãos pede a confirmação com impacto; quem não é admin só vê", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=areas");
    await page.locator("tr", { has: page.locator('[data-area="Cultura"]') }).getByRole("button", { name: "Editar" }).click();
    await page.locator("#ar-orgaos").fill("23, 98");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    const janela = page.getByRole("dialog", { name: /Salvar a área Cultura/ });
    await expect(janela.locator("[data-impacto]")).toBeVisible({ timeout: 15_000 });
    await expect(janela).toContainText("Órgãos de Cultura");
    await janela.getByRole("button", { name: "Cancelar" }).click();
    expect((await sql<{ orgaos: string[] }>(`select orgaos from "AreaAplicacao" where nome = 'Cultura'`))[0].orgaos).toEqual(["23"]);

    await entrar(page, "presidente");
    await page.goto("/config?aba=areas");
    await expect(page.getByRole("button", { name: "Nova área" })).toHaveCount(0);
    await expect(page.getByText("Somente o Administrador Geral altera as áreas.")).toBeVisible();
  });

  test("Tipos de destino: teste de nome, lista de palavras, regra avançada; desativar", async ({ page }) => {
    try {
      await entrar(page, "admin");
      await page.goto("/config?aba=tipos-destino");
      await expect(page.locator("[data-tipo]")).toHaveCount(16);
      await page.locator("#td-teste").fill("UBS Jardim Ypê");
      await expect(page.locator("[data-resultado-teste]")).toContainText("UBS / USF / ESF");
      await expect(page.locator("[data-resultado-teste]")).toContainText("301");

      // Cadastro Único não cabe numa lista de palavras: regra avançada.
      await page.locator("tr", { has: page.locator('[data-tipo="Cadastro Único"]') }).getByRole("button", { name: "Editar" }).click();
      await expect(page.locator("#td-regra")).toHaveValue("cadastro unico|\\bc\\.?c\\.?s\\.?c\\b");
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

      // Novo tipo por lista de palavras; palavra inteira para a sigla.
      await page.getByRole("button", { name: "Novo tipo" }).click();
      await page.locator("#td-nome").fill("Teste C1 Biblioteca");
      await page.getByLabel("Palavra 1", { exact: true }).fill("BMT");
      await page.getByRole("button", { name: "Adicionar palavra" }).click();
      await page.getByLabel("Palavra 2", { exact: true }).fill("Biblioteca Municipal");
      await page.locator("#td-sub").selectOption("392");
      await page.getByRole("button", { name: "Criar tipo" }).click();
      await expect(page.getByText("Tipo “Teste C1 Biblioteca” criado.")).toBeVisible();
      const [t] = await sql<{ padrao: string; subfuncao: string }>(`select padrao, subfuncao from "TipoDestino" where nome = 'Teste C1 Biblioteca'`);
      expect(t).toEqual({ padrao: "\\bbmt\\b|biblioteca municipal", subfuncao: "392" });
      await page.locator("#td-teste").fill("Biblioteca Municipal Central");
      await expect(page.locator("[data-resultado-teste]")).toContainText("Teste C1 Biblioteca");

      // Desativar pede confirmação e deixa de reconhecer.
      await page.locator("tr", { has: page.locator('[data-tipo="Teste C1 Biblioteca"]') }).getByRole("button", { name: "Desativar" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Desativar" }).click();
      await expect.poll(async () => (await sql<{ ativo: boolean }>(`select ativo from "TipoDestino" where nome = 'Teste C1 Biblioteca'`))[0].ativo).toBe(false);
      await page.locator("#td-teste").fill("Biblioteca Municipal Central");
      await expect(page.locator("[data-resultado-teste]")).toContainText("Nenhum tipo");
    } finally {
      await sql(`delete from "TipoDestino" where nome = 'Teste C1 Biblioteca'`);
    }
  });

  test("Destinos por planilha: conferência antes de gravar; 2 novos, 1 atualizado (não duplica), 1 recusado", async ({ page }) => {
    try {
      await entrar(page, "admin");
      await page.goto("/config?aba=destinos");
      await page.getByRole("button", { name: "Importar planilha" }).click();
      const planilha = csv("destinos.csv", [
        "nome;execucao;unidade;unidade_repasse;endereco;populacao",
        "UBS Teste C1;direta;13.01;;Rua do Teste, 10;4000",
        "EMEF Teste C1;direta;11.01;;Rua do Teste, 20;",
        "Assoc. Ágape;indireta;;14.01;Rua Sidney Canavezzi, 121;150",
        ";direta;13.01;;Rua do Teste, 30;",
      ]);
      const conferencia = await conferir(page, "destinos", planilha);
      await expect(conferencia.locator("[data-resumo]")).toHaveText("2 novo(s), 1 atualizado(s), 0 sem mudança, 1 recusado(s).");
      await expect(conferencia.locator('[data-bloco="Atualizados"]')).toContainText("Associação Ágape");
      await expect(conferencia.locator('[data-bloco="Atualizados"]')).toContainText("Também grafado");
      await expect(conferencia.locator('[data-bloco="Recusados"]')).toContainText("Nome ausente");
      // Nada gravado antes da confirmação.
      expect((await sql(`select 1 from "Destino" where nome like '%Teste C1'`)).length).toBe(0);

      await page.getByRole("button", { name: "Gravar destinos" }).click();
      await expect(page.getByText("Planilha gravada: 2 destino(s) novo(s), 1 atualizado(s).")).toBeVisible();
      const novos = await sql<{ nome: string; subfuncaoSugerida: string | null }>(`select nome, "subfuncaoSugerida" from "Destino" where nome like '%Teste C1' order by nome`);
      expect(novos).toEqual([
        { nome: "EMEF Teste C1", subfuncaoSugerida: "361" },
        { nome: "UBS Teste C1", subfuncaoSugerida: "301" },
      ]);
      const [agape] = await sql<{ nome: string; populacaoReferencia: number; apelidos: string[] }>(`select nome, "populacaoReferencia", apelidos from "Destino" where nome = 'Associação Ágape'`);
      expect(agape).toMatchObject({ nome: "Associação Ágape", populacaoReferencia: 150 });
      expect(agape.apelidos).toContain("Assoc. Ágape");
      expect((await sql(`select 1 from "Destino" where nome = 'Assoc. Ágape'`)).length).toBe(0);
      expect((await sql(`select 1 from "AuditLog" where entidade = 'Destino' and acao in ('CRIAR_POR_PLANILHA','ATUALIZAR_POR_PLANILHA')`)).length).toBeGreaterThanOrEqual(3);
    } finally {
      await sql(`delete from "Destino" where nome like '%Teste C1'`);
      await sql(`update "Destino" set "populacaoReferencia" = null, apelidos = array_remove(apelidos, 'Assoc. Ágape') where nome = 'Associação Ágape'`);
    }
  });

  test("Emendas de anos anteriores por planilha: conferência, gravação, autor novo e portal", async ({ page }) => {
    try {
      await entrar(page, "admin");
      await page.goto("/config?aba=exercicio");
      await page.getByRole("button", { name: "Importar emendas de anos anteriores" }).click();
      const planilha = csv("historico.csv", [
        "ano;numero;autor;descricao;valor;parcela",
        "2026;9901;Vereadora Teste C1;Aquisição de cadeiras de rodas (teste C1);R$ 30.000,00;saúde",
        "2026;9902;Vereadora Teste C1;Material pedagógico (teste C1);15.000,00;demais",
        "2026;9903;Vereadora Teste C1;Reforma de praça (teste C1);10000;",
        "2019;9904;Vereadora Teste C1;Ano sem exercício;1000;",
      ]);
      const conferencia = await conferir(page, "historico", planilha);
      await expect(conferencia.locator("[data-resumo]")).toHaveText("3 nova(s), 0 atualizada(s), 0 sem mudança, 1 recusada(s).");
      await expect(conferencia).toContainText("Vereadora Teste C1");
      await expect(conferencia.locator('[data-bloco="Recusados"]')).toContainText("2019 não está cadastrado");
      await page.getByRole("button", { name: "Gravar emendas" }).click();
      await expect(page.getByText("Planilha gravada: 3 emenda(s) nova(s), 0 atualizada(s), 1 autor(es) novo(s).")).toBeVisible();
      const gravadas = await sql<{ numero: number; valor: string; parcela: string | null }>(
        `select numero, valor::text valor, parcela::text parcela from "EmendaImportada" where numero between 9901 and 9903 order by numero`
      );
      expect(gravadas).toEqual([
        { numero: 9901, valor: "30000.00", parcela: "SAUDE" },
        { numero: 9902, valor: "15000.00", parcela: "DEMAIS" },
        { numero: 9903, valor: "10000.00", parcela: null },
      ]);
      // No portal, como "apresentada fora do sistema".
      await page.context().addCookies([{ name: "exercicio-ativo", value: "2026", url: page.url() }]);
      await page.goto("/publica/emendas?q=cadeiras de rodas (teste C1)");
      await expect(page.getByText("Aquisição de cadeiras de rodas (teste C1)")).toBeVisible();
    } finally {
      await sql(`delete from "EmendaImportada" where numero between 9901 and 9904`);
      await sql(`delete from "Autor" where nome = 'Vereadora Teste C1'`);
    }
  });
});
