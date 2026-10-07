import { expect, test, type Page } from "@playwright/test";
import { SENHA_VAZIO } from "../../playwright.vazio.config";

// Fumaça do sistema vazio: um município novo, logo depois de
// `npm run db:iniciar-vazio` — só o administrador e os seis perfis. O sistema
// tem de abrir em todas as telas sem erro e pedir o primeiro acesso.

const EMAIL = "admin@municipio-novo.local";
const NOVA = "nova-senha-do-administrador";

async function entrar(page: Page, senha: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  const campo = page.getByLabel("E-mail");
  if (!(await campo.isVisible().catch(() => false))) await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
  await campo.fill(EMAIL);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

const semErro = async (page: Page) => {
  await expect(page.getByText(/Application error|Algo deu errado|Unhandled Runtime Error/i)).toHaveCount(0);
};

test.describe.configure({ mode: "serial" });

test("primeiro acesso: troca obrigatória da senha temporária e conferência dos dados", async ({ page }) => {
  await entrar(page, SENHA_VAZIO);
  const modal = page.getByRole("dialog", { name: "Bem-vindo ao Emendas360" });
  await expect(modal).toBeVisible();
  // Obrigatório: sem fechar, e o Esc não fecha.
  await expect(modal.getByRole("button", { name: "Fechar" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  // Navegar sem concluir: o modal volta.
  await page.goto("/config");
  await expect(page.getByRole("dialog", { name: "Bem-vindo ao Emendas360" })).toBeVisible();
  // A senha temporária não serve como nova.
  await page.locator("#pa-nome").fill("Ana Administradora");
  await page.locator("#pa-nova").fill(SENHA_VAZIO);
  await page.locator("#pa-conf").fill(SENHA_VAZIO);
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByText("diferente da senha temporária")).toBeVisible();
  await page.locator("#pa-nova").fill(NOVA);
  await page.locator("#pa-conf").fill(NOVA);
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("dialog", { name: "Bem-vindo ao Emendas360" })).toBeHidden();
  // A senha temporária deixa de valer; a nova entra direto, sem modal.
  await entrar(page, NOVA);
  await expect(page.getByRole("dialog", { name: "Bem-vindo ao Emendas360" })).toHaveCount(0);
});

test("todas as telas abrem sem erro com o sistema vazio", async ({ page }) => {
  await entrar(page, NOVA);
  for (const url of ["/inicio", "/emendas", "/painel", "/comparativo", "/conformidade", "/executivo/planejamento", "/conta"]) {
    const r = await page.goto(url);
    expect(r?.status(), url).toBeLessThan(500);
    await expect(page.locator("main").first()).toBeVisible();
    await semErro(page);
  }
  for (const aba of ["municipio", "exercicio", "validacao", "portal", "usuarios", "perfis", "areas", "tipos-destino", "destinos", "biblioteca", "precos", "normas", "auditoria"]) {
    const r = await page.goto(`/config?aba=${aba}`);
    expect(r?.status(), aba).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
    await semErro(page);
  }
  // Os seis perfis padrão, sem outros usuários além do administrador.
  await page.goto("/config?aba=perfis");
  for (const p of ["Administrador Geral", "Poder Executivo", "Presidente da Câmara", "Comissão de Finanças e Orçamento", "Vereador", "Somente consulta"]) {
    await expect(page.getByText(p, { exact: true }).first()).toBeVisible();
  }
});

test("portal e cadastro do município: “Município não configurado” até preencher", async ({ page }) => {
  for (const url of ["/publica", "/publica/emendas", "/publica/manual", "/"]) {
    const r = await page.goto(url);
    expect(r?.status(), url).toBeLessThan(500);
  }
  await page.goto("/publica");
  await expect(page.getByText("Município não configurado").first()).toBeVisible();
  await semErro(page);
  await entrar(page, NOVA);
  await page.goto("/config?aba=municipio");
  await expect(page.getByText("O município ainda não foi configurado")).toBeVisible();
  await page.locator("#mu-nome").fill("Cidade Nova");
  await page.locator("#mu-uf").selectOption("SP");
  await page.locator("#mu-ibge").fill("3500000");
  await page.getByRole("button", { name: "Salvar dados do município" }).click();
  await expect(page.getByText("Dados do município salvos.")).toBeVisible();
  await page.goto("/publica");
  await expect(page.getByText("Cidade Nova/SP").first()).toBeVisible();
});
