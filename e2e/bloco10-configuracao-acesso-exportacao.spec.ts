import { expect, test } from "@playwright/test";
import { JUSTIFICATIVA, SENHA, apagarEmendasDeTeste, dotacaoDaFicha, emendaValida, entrar, inserirEmenda, preencherLogin, sql } from "./apoio";

// Itens 12.1 a 12.4, 13.1, 13.3, 14.1, 14.2 e 15.1: normas com arquivo e
// vigência, beneficiários e mesclagem, usuários, auditoria com antes e depois,
// exportação, impressão e apoio à redação.

test.beforeEach(({ page }) => {
  page.on("dialog", (d) => d.accept());
});
test.afterEach(async () => {
  await apagarEmendasDeTeste("t10-");
});

function pdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
}

// Ficha da saúde no projeto de lei de 2027 (unidade 13.01).
const FICHA = { ficha: "444", unidade: "13.01" };

test.describe("Grupo 12 — configuração", () => {
  test("T-12.1-1 regra do exercício prevalece sobre a geral", async ({ page }) => {
    const [ex] = await sql<{ id: string }>(`select id from "Exercicio" order by ano desc limit 1`);
    await entrar(page, "vereador");
    const id = await emendaValida(page, "Aquisição de cadeira de rodas para a unidade de saúde");
    const [d] = await sql<{ programaId: string }>(`select d."programaId" from "Emenda" e join "Dotacao" d on d.id = e."dotacaoId" where e.id = $1`, [id]);
    await sql(`update "Programa" set "constaNoPPA" = false where id = $1`, [d.programaId]);
    await sql(`delete from "RegraValidacao" where codigo = 'PROGRAMA_NO_PPA'`);
    await sql(
      `insert into "RegraValidacao" (id, codigo, "exercicioId", modo, ativa, "updatedAt") values ('t10-g', 'PROGRAMA_NO_PPA', null, 'ALERTA', true, now()), ('t10-e', 'PROGRAMA_NO_PPA', $1, 'BLOQUEANTE', true, now())`,
      [ex.id]
    );
    try {
      await page.goto(`/emendas/${id}`);
      await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
      await page.getByRole("button", { name: /Ir para a validação/ }).click();
      const linha = page.locator('ol[aria-label="As treze verificações"]').first().locator('li[data-codigo="PROGRAMA_NO_PPA"]');
      await expect(linha).toContainText("Falha");
      // Sem a regra do exercício, vale a geral: só alerta.
      await sql(`delete from "RegraValidacao" where id = 't10-e'`);
      await page.reload();
      await page.getByRole("button", { name: /Ir para o plano de trabalho/ }).click();
      await page.getByRole("button", { name: /Ir para a validação/ }).click();
      await expect(linha).toContainText("Alerta");
    } finally {
      await sql(`update "Programa" set "constaNoPPA" = true where id = $1`, [d.programaId]);
      await sql(`delete from "RegraValidacao" where id in ('t10-g', 't10-e')`);
      await sql(`delete from "Emenda" where id = $1`, [id]);
    }
  });

  test("T-12.2-1 e T-12.2-2 Regimento com PDF e vigência; edição refletida e auditada", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=normas");
    await page.getByRole("button", { name: "Nova norma" }).click();
    await page.getByRole("button", { name: "Regimento Interno", exact: true }).click();
    await page.locator("#nm-t").fill("Regimento Interno de teste t10");
    await page.locator("#nm-v").fill("2024-01-01");
    await page.locator("#nm-vf").fill("2030-12-31");
    await page.locator("#nm-arq").setInputFiles({ name: "regimento.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(page.getByRole("link", { name: "regimento.pdf" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText(/Norma cadastrada/)).toBeVisible();
    const cartao = page.locator("[data-norma]", { hasText: "Regimento Interno de teste t10" });
    await expect(cartao).toContainText("vigência desde 01/01/2024 até 31/12/2030");
    const href = await cartao.getByRole("link", { name: "Arquivo" }).getAttribute("href");
    const r = await page.request.get(href!);
    expect(r.status()).toBe(200);
    expect((await r.body()).subarray(0, 5).toString()).toBe("%PDF-");

    await cartao.getByRole("button", { name: "Editar" }).click();
    await page.locator("#nm-t").fill("Regimento Interno de teste t10 (consolidado)");
    await page.locator("#nm-vf").fill("");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Norma atualizada.")).toBeVisible();
    await expect(page.locator("[data-norma]", { hasText: "(consolidado)" })).toContainText("vigência desde 01/01/2024");
    const [a] = await sql<{ antes: { titulo: string }; depois: { titulo: string } }>(
      `select "dadosAntes" antes, "dadosDepois" depois from "AuditLog" where entidade = 'DocumentoNormativo' and acao = 'ATUALIZAR' order by "criadoEm" desc limit 1`
    );
    expect(a.antes.titulo).toBe("Regimento Interno de teste t10");
    expect(a.depois.titulo).toBe("Regimento Interno de teste t10 (consolidado)");
    await sql(`delete from "DocumentoNormativo" where titulo like 'Regimento Interno de teste t10%'`);
  });

  test("T-12.3-1, T-12.3-2 e T-12.3-3 grafias parecidas marcadas; cancelar não muda; mesclar reaponta e audita", async ({ page }) => {
    await sql(
      `insert into "Destino" (id, nome, execucao, endereco, cnpj, origem, "updatedAt") values
       ('t10-d1', 'Assoc. Beneficente X t10', 'INDIRETA', 'Rua A, 1', null, 'CADASTRO', now()),
       ('t10-d2', 'Associação Beneficente X t10', 'INDIRETA', 'Rua A, 1', null, 'CADASTRO', now())`
    );
    await inserirEmenda({ id: "t10-em", status: "RASCUNHO", objeto: "Emenda para mesclar" });
    await sql(`update "Emenda" set "destinoId" = 't10-d1' where id = 't10-em'`);
    try {
      await entrar(page, "admin");
      await page.goto("/config?aba=destinos");
      const par = page.locator("[data-par]", { hasText: "Beneficente X t10" });
      await expect(par).toBeVisible();
      await par.getByRole("button", { name: "Mesclar" }).click();
      // Mostra quantas emendas serão reapontadas (fica o que tem mais emendas).
      await expect(page.getByRole("dialog").getByText(/emenda\(s\) de “Associação Beneficente X t10” passarão/)).toBeVisible();
      await page.getByRole("button", { name: "Cancelar" }).click();
      expect((await sql(`select 1 from "Destino" where id in ('t10-d1','t10-d2') and ativo`)).length).toBe(2);

      await par.getByRole("button", { name: "Mesclar" }).click();
      await page.getByRole("dialog").locator("label", { hasText: "Associação Beneficente X t10" }).click();
      await page.getByRole("button", { name: "Confirmar mesclagem" }).click();
      await expect(page.getByText(/Mesclado/)).toBeVisible();
      const [e] = await sql<{ destinoId: string }>(`select "destinoId" from "Emenda" where id = 't10-em'`);
      expect(e.destinoId).toBe("t10-d2");
      const [d1] = await sql<{ ativo: boolean; mescladoEmId: string }>(`select ativo, "mescladoEmId" from "Destino" where id = 't10-d1'`);
      expect(d1).toEqual({ ativo: false, mescladoEmId: "t10-d2" });
      const [d2] = await sql<{ apelidos: string[] }>(`select apelidos from "Destino" where id = 't10-d2'`);
      expect(d2.apelidos).toContain("Assoc. Beneficente X t10");
      const audit = await sql(`select 1 from "AuditLog" where entidade = 'Destino' and acao = 'MESCLAR' and "dadosAntes" is not null and "dadosDepois" is not null`);
      expect(audit.length).toBeGreaterThan(0);
    } finally {
      await sql(`delete from "Emenda" where id = 't10-em'`);
      await sql(`delete from "Destino" where id in ('t10-d1', 't10-d2')`);
    }
  });

  test("T-12.4-1, T-12.4-2, T-12.4-3 e T-13.1-3 usuário com Poder e perfil; troca a própria senha; desativado não entra; auditoria com antes e depois", async ({ page }) => {
    const email = `t10-${Date.now()}@emendas360.local`;
    await entrar(page, "admin");
    await page.goto("/config?aba=usuarios");
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await page.locator("#u-nome").fill("Usuária de Teste t10");
    await page.locator("#u-mail").fill(email);
    const opcao = await page.locator("#u-perfil option", { hasText: "Somente consulta" }).getAttribute("value");
    await page.locator("#u-perfil").selectOption(opcao!);
    await page.locator("#u-senha").fill(SENHA);
    await page.getByRole("button", { name: "Criar usuário" }).click();
    await expect(page.getByText("Usuário criado.")).toBeVisible();
    const linha = page.locator("tr", { hasText: email });
    await expect(linha).toContainText("Somente consulta");
    await expect(linha).toContainText(/Transversal|Legislativo|Executivo/);

    // A própria usuária troca a senha.
    await entrar(page, email, SENHA);
    await page.goto("/conta");
    await page.locator("#s-atual").fill(SENHA);
    await page.locator("#s-nova").fill("nova-senha-t10-123");
    await page.locator("#s-conf").fill("nova-senha-t10-123");
    await page.getByRole("button", { name: "Trocar senha" }).click();
    await expect(page.getByText(/Senha trocada/)).toBeVisible();
    await preencherLogin(page, email, SENHA);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
    await entrar(page, email, "nova-senha-t10-123");

    // Desativada, não entra.
    await entrar(page, "admin");
    await page.goto("/config?aba=usuarios");
    await page.locator("tr", { hasText: email }).getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByText(/Usuário desativado/)).toBeVisible();
    await preencherLogin(page, email, "nova-senha-t10-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();

    // Auditoria: filtro por período e usuário, registro com antes e depois.
    await entrar(page, "admin");
    const [admin] = await sql<{ id: string }>(`select id from "User" where email = 'admin@emendas360.local'`);
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    await page.goto(`/config?aba=auditoria&de=${hoje}&ate=${hoje}&usuario=${admin.id}&entidade=User`);
    const registro = page.locator("tr", { hasText: "DESATIVAR" }).first();
    await registro.getByRole("button", { name: "Abrir" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("columnheader", { name: "Antes" })).toBeVisible();
    await expect(dialogo.locator("tr", { hasText: "ativo" })).toContainText("true");
    await expect(dialogo.locator("tr", { hasText: "ativo" })).toContainText("false");
    const [{ hash }] = await sql<{ hash: string }>(`select "passwordHash" hash from "User" where email = $1`, [email]);
    expect(hash).toMatch(/^\$2[aby]\$/);
    await sql(`delete from "User" where email = $1`, [email]);
  });
});

test.describe("Grupos 13 e 14 — trilha, exportação e impressão", () => {
  test("T-13.3-2 apagar emenda de teste preserva a trilha", async ({ page }) => {
    await inserirEmenda({ id: "t10-ap", status: "SUBMETIDA", numero: 9990, objeto: "Emenda de teste para apagar" });
    await sql(`insert into "AuditLog" (id, "entidade", "entidadeId", acao) values ('t10-log', 'Emenda', 't10-ap', 'REMETER')`);
    await entrar(page, "vereador");
    await page.goto("/emendas/t10-ap");
    await page.getByRole("button", { name: /Apagar/ }).first().click();
    await page.getByRole("button", { name: /Apagar/ }).last().click();
    await expect.poll(async () => (await sql(`select 1 from "Emenda" where id = 't10-ap'`)).length).toBe(0);
    expect((await sql(`select 1 from "AuditLog" where id = 't10-log'`)).length).toBe(1);
    await sql(`delete from "AuditLog" where id = 't10-log'`);
  });

  test("T-14.1-1 e T-14.1-3 exportação filtrada por autor e situação, com todas as colunas", async ({ page }) => {
    const [outro] = await sql<{ id: string }>(`select id from "Autor" where "usuarioId" is null order by nome limit 1`);
    await inserirEmenda({ id: "t10-x1", status: "APROVADA", autorId: outro.id, ficha: FICHA, numero: 9981, objeto: "Exportar um" });
    await inserirEmenda({ id: "t10-x2", status: "SUBMETIDA", autorId: outro.id, ficha: FICHA, numero: 9982, objeto: "Exportar dois" });
    await entrar(page, "comissao");
    const [ex] = await sql<{ ano: number }>(`select ano from "Exercicio" order by ano desc limit 1`);
    const r = await page.request.get(`/api/export/emendas?ano=${ex.ano}&formato=csv&autor=${outro.id}&situacao=APROVADA&q=Exportar`);
    const texto = await r.text();
    expect(texto.startsWith("﻿")).toBe(true);
    const [cab, ...linhas] = texto.slice(1).trim().split("\r\n");
    for (const c of ["Situacao", "Orgao", "Unidade", "Funcao", "Subfuncao", "Programa", "Acao", "Natureza", "Fonte", "Remetida", "Decidida"]) expect(cab.split(";")).toContain(c);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toContain("Exportar um");
    const d = await dotacaoDaFicha(FICHA.ficha, FICHA.unidade);
    expect(linhas[0]).toContain(`;${d.uo};`);
    const x = await page.request.get(`/api/export/emendas?ano=${ex.ano}&formato=xlsx&autor=${outro.id}&situacao=APROVADA&q=Exportar`);
    expect(x.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("T-14.2-1 impressão da emenda inteira", async ({ page }) => {
    await inserirEmenda({ id: "t10-pr", status: "APROVADA", ficha: FICHA, numero: 9983, objeto: "Emenda para imprimir" });
    await sql(`update "Emenda" set "parecerTramitacao" = 'Parecer favorável da Comissão de teste.', "tramitadaEm" = now(), justificativa = $1 where id = 't10-pr'`, [JUSTIFICATIVA]);
    await entrar(page, "comissao");
    await page.goto("/emendas/t10-pr/plano");
    for (const t of ["Emenda e plano de trabalho", "Situação", "Dotação de destino", "Função", "Natureza da despesa", "Fonte de recurso", "Emenda para imprimir", "Tramitação e pareceres", "Parecer favorável da Comissão de teste."]) {
      await expect(page.getByText(t, { exact: false }).first()).toBeVisible();
    }
  });
});

test.describe("Grupo 15 — redação", () => {
  test("T-15.1-5 sem a chave de IA: aviso claro e o resto funciona", async ({ page }) => {
    test.skip(!!process.env.E2E_IA, "com a chave de IA configurada");
    await entrar(page, "vereador");
    await page.goto("/emendas/nova");
    await page.locator("#f-obj").fill("Aquisição de cadeira de rodas para a unidade de saúde");
    await page.getByRole("button", { name: "Melhorar texto" }).first().click();
    await expect(page.getByText(/apoio à redação está indisponível/)).toBeVisible();
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page).toHaveURL(/\/emendas\/c[a-z0-9]+$/, { timeout: 15_000 });
    const id = page.url().split("/").pop()!;
    await sql(`delete from "Emenda" where id = $1`, [id]);
  });
});
