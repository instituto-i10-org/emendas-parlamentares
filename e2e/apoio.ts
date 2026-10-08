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

// Rodapé da emenda: "Próximo" confere a seção e segue.
export async function proximo(page: Page) {
  await page.locator('[data-guia="nova-emenda.rodape"]').getByRole("button", { name: /^Próximo/ }).click();
}

// Quem executa: clica no bloco até a tela (já hidratada) registrar a escolha.
export async function escolherExecucao(page: Page, execucao: "DIRETA" | "INDIRETA") {
  const radio = page.locator(`input[name="execucao"][value="${execucao}"]`);
  await expect(async () => {
    await page.getByText(execucao === "DIRETA" ? "Execução direta" : "Execução indireta", { exact: true }).click();
    await expect(radio).toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

// Etapa 1 da nova emenda, seção por seção, até a dotação pronta (sem salvar).
export async function passo1(
  page: Page,
  o: { execucao: "DIRETA" | "INDIRETA"; destino: string; objeto: string; valor: string; endereco?: string },
  { analisar = true, ate }: { analisar?: boolean; ate?: "objeto" } = {}
) {
  await page.goto("/emendas/nova");
  await escolherExecucao(page, o.execucao);
  await proximo(page);
  await page.locator("#f-dest").fill(o.destino);
  await page.getByRole("option").filter({ hasText: o.destino }).first().click();
  if (o.endereco) {
    const editar = page.getByRole("button", { name: "Editar endereço do local" });
    if (await editar.isVisible().catch(() => false)) await editar.click();
    await page.locator("#f-loc").fill(o.endereco);
  }
  await proximo(page);
  if (ate === "objeto") return;
  await page.locator("#f-obj").fill(o.objeto);
  await page.locator("#f-pre").fill(o.valor);
  await proximo(page);
  if (!analisar) return;
  await page.getByRole("button", { name: /Analisar e classificar/ }).click();
  // VALIDAR: o motor oferece opções e o autor escolhe; usa a primeira.
  const pronta = page.locator('[data-pronta="sim"]');
  const usar = page.getByRole("button", { name: "Usar esta dotação" }).first();
  await expect(pronta.or(usar)).toBeVisible({ timeout: 10_000 });
  if (!(await pronta.isVisible())) await usar.click();
  await expect(pronta).toBeVisible();
}

// Da dotação pronta para o plano de trabalho.
export async function irParaPlano(page: Page) {
  await proximo(page);
  await expect(page.locator('[data-guia-tela="nova-emenda.etapa2"]')).toBeVisible();
}

// Id da emenda pelo endereço (que pode levar ?etapa= e ?secao=).
export const idDaUrl = (page: Page) => new URL(page.url()).pathname.split("/").pop()!;

// Rascunho de emenda pela própria tela, até a classificação pronta.
export async function criarRascunho(
  page: Page,
  o: { execucao: "DIRETA" | "INDIRETA"; destino: string; objeto: string; valor: string; endereco?: string }
): Promise<string> {
  await passo1(page, o);
  await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
  await expect(page).toHaveURL(/\/emendas\/c[a-z0-9]+(\?|$)/, { timeout: 15_000 });
  return idDaUrl(page);
}

// Emenda salva aberta direto na etapa 3 (verificações); "envio" vai à seção
// das declarações, onde fica o botão de submeter.
export async function irParaEtapa3(page: Page, id: string, secao: "verificacoes" | "envio" = "verificacoes") {
  await page.goto(`/emendas/${id}?etapa=3${secao === "envio" ? "&secao=2" : ""}`);
  await expect(page.locator('[data-guia-tela="nova-emenda.etapa3"]')).toBeVisible();
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

// Rascunho pela tela e plano completo pelo banco: uma emenda válida.
export async function emendaValida(page: Page, objeto: string): Promise<string> {
  const id = await criarRascunho(page, { execucao: "DIRETA", destino: DESTINOS.saude, objeto, valor: "3000" });
  await completarPlano(id);
  return id;
}

// Plano de trabalho completo pelo banco (R$ 3.000, duas cadeiras de rodas).
export async function completarPlano(id: string) {
  const [fonte] = await sql<{ id: string }>(`select id from "FontePrecoOficial" where ativo order by ordem limit 1`);
  await sql(
    `update "Emenda" set justificativa = $2, "metaFinalistica" = $3, "agenteExecutor" = 'Secretaria Municipal de Saúde',
       etapas = 'Planejamento → contratação → entrega', "declaracaoVinculo" = true, "declaracaoPrecos" = true, "quadroViabilidade" = $4, valor = 3000 where id = $1`,
    [id, JUSTIFICATIVA, "Ampliar a acessibilidade dos pacientes atendidos na unidade.", JSON.stringify({ "EQUIPAMENTOS-0": "Sim", "EQUIPAMENTOS-1": "Não", "EQUIPAMENTOS-2": "Sim" })]
  );
  await sql(`insert into "MetaEmenda" (id, "emendaId", ordem, beneficiarios, unidade, quantidade) values ($1 || 'm', $1, 0, 'Pacientes da unidade', 'cadeira', 2)`, [id]);
  await sql(
    `insert into "ReferenciaPreco" (id, "emendaId", codigo, tipo, emissor, data, unidade, valor, objeto, procedencia, "fonteId")
     values ($1 || 'r', $1, 'R1', 'ATA', 'PNCP', now(), 'unidade', 1500, 'Cadeira de rodas', 'INFORMADA', $2)`,
    [id, fonte.id]
  );
  await sql(
    `insert into "ItemEmenda" (id, "emendaId", ordem, descricao, unidade, quantidade, "valorUnitario", "referenciaId") values ($1 || 'i', $1, 0, 'Cadeira de rodas', 'unidade', 2, 1500, $1 || 'r')`,
    [id]
  );
  await sql(`insert into "ParcelaDesembolso" (id, "emendaId", ordem, valor) values ($1 || 'p', $1, 0, 3000)`, [id]);
}

// Janela de confirmação com impacto: espera o cálculo, marca a ciência quando
// ela é pedida (há emenda enviada alcançada) e confirma pelo botão principal.
export async function confirmarJanela(page: Page) {
  const janela = page.getByRole("dialog");
  await expect(janela.locator("[data-impacto]")).toBeVisible({ timeout: 15_000 });
  const ciencia = janela.getByRole("checkbox", { name: /Entendo que esta alteração afeta/ });
  if (await ciencia.isVisible()) await ciencia.check();
  await digitarExcluirSePedido(page);
  await janela.locator(":scope > div:last-child button").first().click();
}

// Exclusão: a janela só libera o botão depois de digitar EXCLUIR.
export async function digitarExcluirSePedido(page: Page) {
  const campo = page.getByRole("dialog").locator('[data-teste="digitar-excluir"] input');
  if (await campo.isVisible()) await campo.fill("EXCLUIR");
}

// Confirmação simples na janela do sistema (no lugar da do navegador):
// confirma pelo botão de ação da janela.
export async function confirmarNaJanela(page: Page, rotulo: string | RegExp) {
  const janela = page.getByRole("dialog");
  await expect(janela).toBeVisible();
  await digitarExcluirSePedido(page);
  await janela.getByRole("button", { name: rotulo, exact: typeof rotulo === "string" }).click();
  await expect(janela).toBeHidden();
}

// "Minha conta" é uma janela aberta pelo nome no menu.
export async function abrirMinhaConta(page: Page) {
  await page.locator('button[title="Minha conta e senha"]').first().click();
  await expect(page.getByRole("dialog", { name: "Minha conta" })).toBeVisible();
}
