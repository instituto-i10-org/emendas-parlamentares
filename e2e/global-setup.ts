import { execFileSync } from "node:child_process";
import { TEST_DATABASE_URL } from "../playwright.config";

// Prepara o banco de teste antes da suíte: cria se não existir, aplica as
// migrações, recarrega a base e zera o que os testes criaram. Só roda contra
// banco cujo nome contém "emendas_test" — nunca contra desenvolvimento ou
// produção.

const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL, SEED_SENHA: "senha-dos-testes-e2e" };

function rodar(comando: string, args: string[], titulo: string) {
  process.stdout.write(`  ${titulo}… `);
  const t0 = Date.now();
  try {
    execFileSync(comando, args, { env, stdio: "pipe", cwd: process.cwd() });
    process.stdout.write(`ok (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
  } catch (e) {
    process.stdout.write("FALHOU\n");
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    console.error(err.stderr?.toString() || err.stdout?.toString() || e);
    throw new Error(`Falha ao preparar o banco de teste: ${titulo}`);
  }
}

export default function globalSetup() {
  if (/neon\.tech|vercel/.test(TEST_DATABASE_URL)) throw new Error("TEST_DATABASE_URL aponta para produção — abortando.");
  if (!/\/emendas_test(\?|$)/.test(TEST_DATABASE_URL)) throw new Error("TEST_DATABASE_URL precisa apontar para o banco emendas_test.");
  console.log("\nPreparando o banco de teste…");
  rodar("npx", ["tsx", "e2e/preparar-banco.ts"], "banco emendas_test");
  rodar("npx", ["prisma", "migrate", "deploy"], "migrações");
  rodar("npx", ["tsx", "e2e/zerar-dados-de-teste.ts"], "dados criados por testes anteriores");
  rodar("npx", ["tsx", "prisma/seed.ts"], "seed");
  console.log("Banco de teste pronto.\n");
}
