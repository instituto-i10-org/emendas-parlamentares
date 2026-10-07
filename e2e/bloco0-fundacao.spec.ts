import { expect, test } from "@playwright/test";
import { CONTAS, SENHA, entrar, preencherLogin, sql } from "./apoio";

// Fundação: permissão relida a cada ação, limite de tentativas no login,
// auditoria de entrada e saída, perfil de consulta e tela de login sem senha.

test.describe("Segurança de base", () => {
  test("T-0-1 permissão retirada vale na ação seguinte, sem novo login", async ({ page }) => {
    await entrar(page, "vereador");
    await page.goto("/emendas/nova");
    await expect(page.locator("#f-dest")).toBeVisible();
    await sql(`update "PerfilAcesso" set "apresentarEmendas" = false where nome = 'Vereador'`);
    try {
      await page.goto("/emendas/nova");
      await expect(page).toHaveURL(/acesso-negado|\/inicio/);
      await expect(page.locator("#f-dest")).toHaveCount(0);
    } finally {
      await sql(`update "PerfilAcesso" set "apresentarEmendas" = true where nome = 'Vereador'`);
    }
  });

  test("T-0-2 e T-0-3 cinco senhas erradas bloqueiam a conta, mesmo com a senha certa; o contador fica no banco", async ({ page }) => {
    const email = CONTAS.presidente;
    try {
      for (let i = 0; i < 5; i++) {
        await preencherLogin(page, email, "senha-errada-123");
        await page.getByRole("button", { name: "Entrar", exact: true }).click();
        await expect(page.getByText(/E-mail ou senha inválidos|Muitas tentativas/)).toBeVisible();
      }
      const t = await sql<{ n: string }>(`select count(*) n from "TentativaAcesso" where chave = $1`, [`login-falha:${email}`]);
      expect(Number(t[0].n)).toBe(5);

      await preencherLogin(page, email, SENHA);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page.getByText(/Muitas tentativas com senha errada/)).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await sql(`delete from "TentativaAcesso" where chave like 'login-falha%'`);
    }
  });

  test("T-0-4 entrada, saída e recusa ficam na auditoria", async ({ page }) => {
    await preencherLogin(page, CONTAS.comissao, "errada-errada");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
    await entrar(page, "comissao");
    await page.getByRole("button", { name: /Sair/ }).first().click();
    await expect(page).toHaveURL(/\/login/);
    const acoes = await sql<{ acao: string }>(`select acao from "AuditLog" where entidade = 'Login' and "entidadeId" = $1 order by "criadoEm"`, [CONTAS.comissao]);
    expect(acoes.map((a) => a.acao)).toEqual(expect.arrayContaining(["LOGIN_RECUSADO", "LOGIN", "LOGOUT"]));
    await sql(`delete from "TentativaAcesso" where chave like 'login-falha%'`);
  });

  test("T-0-5 perfil Somente consulta vê as telas de leitura e não escreve", async ({ page }) => {
    await entrar(page, "consulta@emendas360.local");
    const menu = page.getByRole("navigation");
    for (const item of ["Início", "Resumo consolidado", "Tramitação", "Emendas", "Planejamento", "Conformidade"]) {
      await expect(menu.getByRole("link", { name: item })).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: "Nova emenda" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Configurações" })).toHaveCount(0);
    for (const rota of ["/tramitacao", "/executivo/planejamento", "/executivo/viabilidade", "/executivo/execucao", "/conformidade", "/painel", "/emendas"]) {
      await page.goto(rota);
      await expect(page).toHaveURL(new RegExp(rota.replace(/\//g, "\\/")));
    }
    // Nenhum botão de ação nas telas de leitura.
    await page.goto("/executivo/planejamento");
    await expect(page.getByRole("button", { name: /Novo instrumento|Importar base/ })).toHaveCount(0);
    // Escrita direta pela URL é recusada no servidor.
    await page.goto("/emendas/nova");
    await expect(page).toHaveURL(/acesso-negado|\/inicio/);
    await page.goto("/config");
    await expect(page).toHaveURL(/acesso-negado|\/inicio/);
    const exp = await page.request.get(`/api/export/emendas?ano=2027&formato=csv`);
    expect(exp.status()).toBe(200);
  });

  test("T-0-8 tela de login sem senha no HTML", async ({ page }) => {
    await page.context().clearCookies();
    const r = await page.request.get("/login");
    const html = await r.text();
    expect(html).not.toContain("senha-dos-testes-e2e");
    expect(html).not.toMatch(/type="hidden"[^>]*name="senha"/);
  });

  test("conta desativada não entra", async ({ page }) => {
    await sql(`update "User" set ativo = false where email = $1`, [CONTAS.executivo]);
    try {
      await preencherLogin(page, CONTAS.executivo, SENHA);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
    } finally {
      await sql(`update "User" set ativo = true where email = $1`, [CONTAS.executivo]);
      await sql(`delete from "TentativaAcesso" where chave like 'login-falha%'`);
    }
  });
});
