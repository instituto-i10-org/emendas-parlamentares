import { expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "../playwright.config";

// Apoio comum aos testes de ponta a ponta: login, banco de teste e a emenda
// em rascunho que vários casos usam como ponto de partida.

export const SENHA = "senha-dos-testes-e2e";
export const CONTAS = {
  admin: "admin@emendas360.local",
  executivo: "executivo@emendas360.local",
  presidente: "presidente@emendas360.local",
  comissao: "comissao@emendas360.local",
  vereador: "vereador@emendas360.local",
} as const;

// Destinos da base carregada nos testes. Trocar a base do seed = trocar aqui.
export const DESTINOS = {
  saude: "CEO Centro de Especialidades Odontológicas de Mogi Guaçu",
  escola: "EMEF João Bueno Junior",
  entidade: "Associação Ágape",
} as const;

// Abre a tela de login e preenche e-mail e senha (sem enviar).
export async function preencherLogin(page: Page, email: string, senha: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  const campo = page.getByLabel("E-mail");
  if (!(await campo.isVisible().catch(() => false))) await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
  await campo.fill(email);
  await page.getByLabel("Senha").fill(senha);
}

export async function entrar(page: Page, conta: keyof typeof CONTAS | string, senha = SENHA) {
  const email = conta in CONTAS ? CONTAS[conta as keyof typeof CONTAS] : conta;
  await page.context().clearCookies();
  await page.goto("/login");
  // A tela pode abrir com o acesso rápido; o formulário por e-mail fica atrás de um botão.
  const campo = page.getByLabel("E-mail");
  if (!(await campo.isVisible().catch(() => false))) await page.getByRole("button", { name: "Entrar com e-mail e senha" }).click();
  await campo.fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Consulta direta ao banco de teste (para conferir o que a tela gravou).
export async function sql<T = Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: TEST_DATABASE_URL });
  await c.connect();
  try {
    return (await c.query(texto, valores)).rows as T[];
  } finally {
    await c.end();
  }
}

// Rascunho de emenda pela própria tela, até a classificação pronta.
export async function criarRascunho(
  page: Page,
  o: { execucao: "DIRETA" | "INDIRETA"; destino: string; objeto: string; valor: string; endereco?: string }
): Promise<string> {
  await page.goto("/emendas/nova");
  await page.locator(`input[name="execucao"][value="${o.execucao}"]`).check({ force: true });
  const campoDestino = page.locator("#f-dest");
  await campoDestino.fill(o.destino);
  await page.getByRole("option").filter({ hasText: o.destino }).first().click();
  await page.locator("#f-pre").fill(o.valor);
  await page.locator("#f-obj").fill(o.objeto);
  if (o.endereco) {
    const editar = page.getByRole("button", { name: "Editar endereço do local" });
    if (await editar.isVisible().catch(() => false)) await editar.click();
  }
  await page.getByRole("button", { name: /Analisar e classificar/ }).click();
  // VALIDAR: o motor oferece opções e o autor escolhe; usa a primeira.
  const ir = page.getByRole("button", { name: /Ir para o plano de trabalho/ });
  const usar = page.getByRole("button", { name: "Usar esta dotação" }).first();
  await expect(ir.or(usar)).toBeVisible({ timeout: 10_000 });
  if (!(await ir.isVisible())) await usar.click();
  await expect(ir).toBeVisible();
  await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
  await expect(page).toHaveURL(/\/emendas\/c[a-z0-9]+$/, { timeout: 15_000 });
  return page.url().split("/").pop()!;
}

// Dados da dotação de uma ficha do projeto de lei. A ficha se repete entre
// unidades em Mogi Guaçu: a unidade decide qual.
export async function dotacaoDaFicha(ficha: string, unidade: string) {
  const [d] = await sql<{ id: string; orgao: string; uo: string; prog: string; acao: string; autorizado: string }>(
    `select d.id, o.codigo orgao, u.codigo uo, p.codigo prog, a.codigo acao, d."valorAutorizado" autorizado
       from "Dotacao" d
       join "Orgao" o on o.id = d."orgaoId"
       join "UnidadeOrcamentaria" u on u.id = d."unidadeOrcamentariaId"
       join "Programa" p on p.id = d."programaId"
       join "Acao" a on a.id = d."acaoId"
       join "InstrumentoPlanejamento" i on i.id = d."instrumentoId"
       join "Exercicio" e on e.id = d."exercicioId"
      where d.ficha = $1 and u.codigo = $2 and d.ativo and i.especie = 'PROJETO_LEI'
      order by e.ano desc, i."createdAt" limit 1`,
    [ficha, unidade]
  );
  if (!d) throw new Error(`ficha ${ficha} da unidade ${unidade} não encontrada`);
  return d;
}

export const JUSTIFICATIVA =
  "A unidade atende a população do município e precisa do recurso para manter o atendimento regular ao longo de todo o exercício.";

// Emenda gravada direto no banco, para os casos de fila, filtro e paginação.
export async function inserirEmenda(o: {
  id: string;
  status: string;
  autorEmail?: string;
  autorId?: string;
  ficha?: { ficha: string; unidade: string };
  valor?: number;
  objeto?: string;
  numero?: number | null;
  submetidaEm?: string | null;
  verificacoes?: unknown[];
  itens?: unknown[];
}) {
  const [ex] = await sql<{ id: string }>(`select id from "Exercicio" order by ano desc limit 1`);
  const [autor] = o.autorId
    ? [{ id: o.autorId }]
    : await sql<{ id: string }>(`select a.id from "Autor" a join "User" u on u.id = a."usuarioId" where u.email = $1`, [o.autorEmail ?? "vereador@emendas360.local"]);
  const dot = o.ficha ? await dotacaoDaFicha(o.ficha.ficha, o.ficha.unidade) : null;
  await sql(
    `insert into "Emenda" (id, "exercicioId", "autorId", status, "dotacaoId", valor, objeto, execucao, numero, "submetidaEm", "updatedAt")
     values ($1, $2, $3, $4, $5, $6, $7, 'DIRETA', $8, $9, now())`,
    [o.id, ex.id, autor.id, o.status, dot?.id ?? null, o.valor ?? 30000, o.objeto ?? `Emenda de teste ${o.id}`, o.numero ?? null, o.submetidaEm ?? null]
  );
  if (o.verificacoes || o.itens) {
    await sql(
      `insert into "ValidacaoEmenda" (id, "emendaId", bloqueios, alertas, itens, verificacoes, valida, momento) values ($1, $2, 0, 0, $3, $4, $5, 'VALIDACAO')`,
      [`v-${o.id}`, o.id, JSON.stringify(o.itens ?? []), JSON.stringify(o.verificacoes ?? []), o.status !== "INVALIDA"]
    );
  }
}

export async function apagarEmendasDeTeste(prefixo: string) {
  await sql(`delete from "Emenda" where id like $1`, [`${prefixo}%`]);
}
