import { defineConfig, devices } from "@playwright/test";

// ============================================================================
// Testes end-to-end.
//
// Rodam contra um BUILD DE PRODUÇÃO (`next build && next start`), como a
// Vercel serve. Cada caso do plano (docs/borborema/PLANO.md, seção 11) tem o
// código no nome do teste ("T-1.1-1 ...").
//
// Banco: `emendas_test`, no mesmo Postgres local (porta 5440), separado do
// banco de desenvolvimento e preparado pelo global setup a cada execução.
// ============================================================================

const PORTA = 3210;
export const BASE_URL = `http://localhost:${PORTA}`;

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://emendas:emendas@localhost:5440/emendas_test";

// AUTH_URL precisa apontar para a porta de teste: o Auth.js monta a URL de
// redirecionamento a partir dela, e um valor errado joga o navegador para
// outra porta no meio do login.
const envServidor = {
  DATABASE_URL: TEST_DATABASE_URL,
  DIRECT_URL: TEST_DATABASE_URL,
  AUTH_SECRET: "e2e-secret-determinista-nao-usar-em-producao",
  AUTH_URL: BASE_URL,
  AUTH_TRUST_HOST: "true",
  // Sem chave de IA nos testes: o que depende dela é testado com resposta simulada.
  OPENAI_API_KEY: "",
};

export default defineConfig({
  testDir: "./e2e",
  // O banco é preparado por `npm run test:e2e` antes do servidor subir (e2e/preparar.ts).
  // As specs compartilham um único banco: rodar em paralelo tornaria os
  // resultados dependentes de ordem.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    // Sem animação: a análise da etapa 1 conclui na hora.
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "on",
    video: "off",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: `npx next build && npx next start -p ${PORTA}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
    env: envServidor,
  },
});
