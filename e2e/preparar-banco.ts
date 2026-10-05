import { Client } from "pg";

// Cria o banco emendas_test no mesmo servidor, se ainda não existir.
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.pathname !== "/emendas_test") throw new Error("Só cria o banco emendas_test.");
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";

  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  const existe = await c.query("select 1 from pg_database where datname = 'emendas_test'");
  if (!existe.rowCount) await c.query("create database emendas_test");
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
