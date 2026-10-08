import { Client } from "pg";

// Cria o banco emendas_test (ou emendas_test_<sufixo>, para rodar duas cópias
// do repositório ao mesmo tempo) no mesmo servidor, se ainda não existir.
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const nome = url.pathname.slice(1);
  if (!/^emendas_test(_[a-z0-9]+)?$/.test(nome)) throw new Error("Só cria o banco emendas_test.");
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";

  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  const existe = await c.query("select 1 from pg_database where datname = $1", [nome]);
  if (!existe.rowCount) await c.query(`create database ${nome}`);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
