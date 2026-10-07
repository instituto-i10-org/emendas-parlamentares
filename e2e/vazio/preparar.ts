import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { SENHA_VAZIO, VAZIO_DATABASE_URL } from "../../playwright.vazio.config";

// Banco do sistema vazio: recriado do zero a cada execução (emendas_vazio, no
// mesmo Postgres local), com as migrações e o comando db:iniciar-vazio — como
// num município novo. Nunca contra outro banco.

async function main() {
  const url = new URL(VAZIO_DATABASE_URL);
  if (url.pathname !== "/emendas_vazio" || /neon\.tech|vercel/.test(VAZIO_DATABASE_URL)) throw new Error("Só prepara o banco emendas_vazio local.");
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query("drop database if exists emendas_vazio with (force)");
  await c.query("create database emendas_vazio");
  await c.end();
  const env = { ...process.env, DATABASE_URL: VAZIO_DATABASE_URL, DIRECT_URL: VAZIO_DATABASE_URL, SENHA_INICIAL: SENHA_VAZIO };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  const saida = execFileSync("npx", ["tsx", "prisma/iniciar-vazio.ts", "admin@municipio-novo.local"], { env }).toString();
  if (!saida.includes("Sistema iniciado vazio.")) throw new Error(saida);
  // Segunda execução tem de recusar: o banco já tem usuário.
  try {
    execFileSync("npx", ["tsx", "prisma/iniciar-vazio.ts", "outro@municipio-novo.local"], { env, stdio: "pipe" });
    throw new Error("O comando deveria recusar banco com dados.");
  } catch (e) {
    const err = e as { stderr?: Buffer; message: string };
    if (!err.stderr?.toString().includes("já tem dados")) throw e;
  }
  console.log("Banco vazio pronto (emendas_vazio).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
