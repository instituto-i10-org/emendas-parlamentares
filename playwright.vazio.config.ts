import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// ============================================================================
// Fumaça do sistema vazio: um município novo logo depois de
// `npm run db:iniciar-vazio`. Banco próprio (`emendas_vazio`, recriado a cada
// execução por e2e/vazio/preparar.ts) e servidor próprio (porta 3211).
// ============================================================================

const PORTA = 3211;
export const BASE_URL_VAZIO = `http://localhost:${PORTA}`;
export const VAZIO_DATABASE_URL = process.env.VAZIO_DATABASE_URL ?? "postgresql://emendas:emendas@localhost:5440/emendas_vazio";
export const SENHA_VAZIO = "senha-temporaria-vazio";

export default defineConfig({
  testDir: "./e2e/vazio",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL_VAZIO,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORTA}`,
    url: `${BASE_URL_VAZIO}/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: VAZIO_DATABASE_URL,
      DIRECT_URL: VAZIO_DATABASE_URL,
      AUTH_SECRET: "e2e-secret-determinista-nao-usar-em-producao",
      AUTH_URL: BASE_URL_VAZIO,
      AUTH_TRUST_HOST: "true",
      OPENAI_API_KEY: "",
      DEMO_LOGIN: "false",
      DEMO_SENHA: "",
      // Guias de ajuda não abrem sozinhos nos testes.
      GUIAS_AUTOMATICOS: "false",
    },
  },
});
