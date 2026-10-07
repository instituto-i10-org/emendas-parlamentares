import { Client } from "pg";

// Apaga o que os testes criam (emendas, links, auditoria, usuários e perfis
// fora do seed), para cada rodada partir do mesmo estado. Só no emendas_test.
async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/\/emendas_test(\?|$)/.test(url)) throw new Error("Só zera o banco emendas_test.");

  const c = new Client({ connectionString: url });
  await c.connect();
  const tabelas = await c.query("select tablename from pg_tables where schemaname = 'public'");
  const existentes = new Set(tabelas.rows.map((r) => r.tablename as string));
  const zerar = ["Emenda", "ConviteEntidade", "AuditLog", "ContadorEmenda", "TentativaAcesso", "Arquivo", "UsoIA"].filter((t) => existentes.has(t));
  if (zerar.length) await c.query(`truncate ${zerar.map((t) => `"${t}"`).join(", ")} cascade`);
  if (existentes.has("User")) await c.query(`delete from "User" where email not like '%@emendas360.local'`);
  if (existentes.has("PerfilAcesso")) await c.query(`delete from "PerfilAcesso" where "perfilDoSistema" = false`);
  if (existentes.has("Destino")) await c.query(`delete from "Destino" where origem = 'CADASTRO' and nome like 'TESTE %'`);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
