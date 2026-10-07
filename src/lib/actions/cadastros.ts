"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditar } from "@/lib/audit";
import { ehAdminGeral } from "@/lib/authz";
import { CAMPOS_DESTINOS, CAMPOS_HISTORICO, lerTabela, planejarDestinos, planejarHistorico, type PlanoDestinos, type PlanoHistorico } from "@/lib/cadastros/planilhas";
import { municipioSchema, type DadosMunicipio } from "@/lib/cadastros/municipio";
import { itensParaPadrao, padraoValido, type ItemReconhecimento } from "@/lib/cadastros/tipos-destino";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { subfuncaoDoDestino } from "@/lib/riep/destino";
import { getCurrentUser, type SessionUser } from "@/lib/session";

// ============================================================================
// Cadastros que configuram o município pela tela: dados do município, áreas,
// tipos de destino, destinos em lote e emendas de anos anteriores. Só o
// Administrador Geral grava; quem vê Configurações só consulta. Toda gravação
// sai auditada, com antes e depois, na mesma transação.
// ============================================================================

export type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

async function exigirAdmin(): Promise<SessionUser | Resultado> {
  const user = await getCurrentUser();
  if (!ehAdminGeral(user)) return { ok: false, erro: "Só o Administrador Geral altera este cadastro." };
  return user;
}
const falhou = (x: SessionUser | Resultado): x is Resultado => "ok" in x;
const erro = (e: z.ZodError) => ({ ok: false as const, erro: e.issues[0]?.message ?? "Dados inválidos." });
function pronto(mensagem?: string): Resultado {
  revalidatePath("/", "layout");
  return { ok: true, mensagem };
}

// ============================================================================
// Município
// ============================================================================

export async function salvarMunicipio(entrada: DadosMunicipio): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const p = municipioSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const dados = { ...p.data, codigoIbge: p.data.codigoIbge || null, nomeCamara: p.data.nomeCamara || null, nomePrefeitura: p.data.nomePrefeitura || null };
  await prisma.$transaction(async (tx) => {
    const antes = await tx.municipio.findFirst();
    const salvo = antes ? await tx.municipio.update({ where: { id: antes.id }, data: dados }) : await tx.municipio.create({ data: dados });
    const campos = (m: typeof salvo | null) => (m ? { nome: m.nome, uf: m.uf, codigoIbge: m.codigoIbge, nomeCamara: m.nomeCamara, nomePrefeitura: m.nomePrefeitura } : null);
    await auditar(tx, { usuarioId: user.id, entidade: "Municipio", entidadeId: salvo.id, acao: antes ? "ATUALIZAR" : "CRIAR", dadosAntes: campos(antes), dadosDepois: campos(salvo) });
  });
  return pronto("Dados do município salvos.");
}

// ============================================================================
// Áreas de aplicação
// ============================================================================

const nomeArea = z.string().trim().min(2, "Informe o nome da área.").max(80);
const orgaosSchema = z.array(z.string().regex(/^\d{1,4}$/, "Código de órgão inválido (ex.: 13)."));
const unidadeSchema = z.union([z.literal(""), z.string().regex(/^\d{1,4}\.\d{1,4}$/, "Unidade no formato 13.01.")]);

async function nomeAreaEmUso(nome: string, excetoId?: string) {
  const todas = await prisma.areaAplicacao.findMany({ where: excetoId ? { id: { not: excetoId } } : {}, select: { nome: true } });
  return todas.some((a) => a.nome.trim().toLocaleLowerCase("pt-BR") === nome.trim().toLocaleLowerCase("pt-BR"));
}

export async function criarArea(entrada: { nome: string; orgaos: string[]; unidadePadrao: string }): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const p = z.object({ nome: nomeArea, orgaos: orgaosSchema, unidadePadrao: unidadeSchema }).safeParse(entrada);
  if (!p.success) return erro(p.error);
  if (await nomeAreaEmUso(p.data.nome)) return { ok: false, erro: "Já existe uma área com esse nome." };
  await prisma.$transaction(async (tx) => {
    const ultima = await tx.areaAplicacao.findFirst({ orderBy: { ordem: "desc" }, select: { ordem: true } });
    const salvo = await tx.areaAplicacao.create({ data: { nome: p.data.nome, orgaos: p.data.orgaos, unidadePadrao: p.data.unidadePadrao || null, ordem: (ultima?.ordem ?? 0) + 1 } });
    await auditar(tx, { usuarioId: user.id, entidade: "AreaAplicacao", entidadeId: salvo.id, acao: "CRIAR", dadosDepois: salvo });
  });
  return pronto(`Área “${p.data.nome}” criada.`);
}

// Renomear não mexe em vínculo: objetos e painéis apontam para a área pelo id.
export async function renomearArea(id: string, nome: string): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const p = nomeArea.safeParse(nome);
  if (!p.success) return erro(p.error);
  const antes = await prisma.areaAplicacao.findUnique({ where: { id } });
  if (!antes) return { ok: false, erro: "Área não encontrada." };
  if (await nomeAreaEmUso(p.data, id)) return { ok: false, erro: "Já existe uma área com esse nome." };
  await prisma.$transaction(async (tx) => {
    const salvo = await tx.areaAplicacao.update({ where: { id }, data: { nome: p.data } });
    await auditar(tx, { usuarioId: user.id, entidade: "AreaAplicacao", entidadeId: id, acao: "RENOMEAR", dadosAntes: { nome: antes.nome }, dadosDepois: { nome: salvo.nome } });
  });
  return pronto("Área renomeada.");
}

export async function moverArea(id: string, direcao: "acima" | "abaixo"): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const todas = await prisma.areaAplicacao.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  const i = todas.findIndex((a) => a.id === id);
  const j = direcao === "acima" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= todas.length) return { ok: true };
  const nova = [...todas];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  await prisma.$transaction(async (tx) => {
    for (const [k, a] of nova.entries()) if (a.ordem !== k + 1) await tx.areaAplicacao.update({ where: { id: a.id }, data: { ordem: k + 1 } });
    await auditar(tx, { usuarioId: user.id, entidade: "AreaAplicacao", entidadeId: id, acao: "REORDENAR", dadosAntes: { ordem: todas.map((a) => a.nome) }, dadosDepois: { ordem: nova.map((a) => a.nome) } });
  });
  return pronto();
}

// Exclusão só sem objeto da biblioteca ligado; senão, a lista do que mudar.
export async function excluirArea(id: string): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const area = await prisma.areaAplicacao.findUnique({ where: { id }, include: { objetos: { select: { rotulo: true }, orderBy: { rotulo: "asc" } } } });
  if (!area) return { ok: false, erro: "Área não encontrada." };
  if (area.objetos.length) {
    const nomes = area.objetos.map((o) => o.rotulo);
    const lista = nomes.slice(0, 8).join(", ") + (nomes.length > 8 ? ` e mais ${nomes.length - 8}` : "");
    return { ok: false, erro: `A área “${area.nome}” tem ${nomes.length} objeto(s) da biblioteca ligado(s): ${lista}. Mude estes objetos de área antes de excluir.` };
  }
  await prisma.$transaction(async (tx) => {
    await tx.areaAplicacao.delete({ where: { id } });
    await auditar(tx, { usuarioId: user.id, entidade: "AreaAplicacao", entidadeId: id, acao: "EXCLUIR", dadosAntes: area });
  });
  return pronto(`Área “${area.nome}” excluída.`);
}

// ============================================================================
// Tipos de destino
// ============================================================================

const tipoSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(2, "Informe o nome do tipo.").max(80),
  // Ou a lista de palavras, ou a regra avançada.
  itens: z.array(z.object({ texto: z.string().max(120), inteira: z.boolean() })).max(60).optional(),
  regraAvancada: z.string().max(1000).optional(),
  pistas: z.array(z.string().trim().max(80)).max(30),
  subfuncao: z.union([z.literal(""), z.string().regex(/^\d{3}$/, "Subfunção com 3 dígitos (ex.: 301).")]),
});

export async function salvarTipoDestino(entrada: z.input<typeof tipoSchema>): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const p = tipoSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const padrao = p.data.regraAvancada !== undefined ? p.data.regraAvancada.trim() : itensParaPadrao((p.data.itens ?? []) as ItemReconhecimento[]);
  const invalido = padraoValido(padrao);
  if (invalido) return { ok: false, erro: invalido };
  const outros = await prisma.tipoDestino.findMany({ where: p.data.id ? { id: { not: p.data.id } } : {}, select: { nome: true } });
  if (outros.some((t) => t.nome.toLocaleLowerCase("pt-BR") === p.data.nome.toLocaleLowerCase("pt-BR"))) return { ok: false, erro: "Já existe um tipo com esse nome." };
  const dados = { nome: p.data.nome, padrao, pistas: p.data.pistas.filter(Boolean), subfuncao: p.data.subfuncao || null };
  await prisma.$transaction(async (tx) => {
    if (p.data.id) {
      const antes = await tx.tipoDestino.findUnique({ where: { id: p.data.id } });
      if (!antes) throw new Error("Tipo não encontrado.");
      const salvo = await tx.tipoDestino.update({ where: { id: p.data.id }, data: dados });
      await auditar(tx, { usuarioId: user.id, entidade: "TipoDestino", entidadeId: salvo.id, acao: "ATUALIZAR", dadosAntes: antes, dadosDepois: salvo });
    } else {
      const ultima = await tx.tipoDestino.findFirst({ orderBy: { ordem: "desc" }, select: { ordem: true } });
      const salvo = await tx.tipoDestino.create({ data: { ...dados, ordem: (ultima?.ordem ?? 0) + 1 } });
      await auditar(tx, { usuarioId: user.id, entidade: "TipoDestino", entidadeId: salvo.id, acao: "CRIAR", dadosDepois: salvo });
    }
  });
  return pronto(p.data.id ? "Tipo de destino salvo." : `Tipo “${p.data.nome}” criado.`);
}

export async function alternarTipoDestino(id: string): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const t = await prisma.tipoDestino.findUnique({ where: { id } });
  if (!t) return { ok: false, erro: "Tipo não encontrado." };
  await prisma.$transaction(async (tx) => {
    await tx.tipoDestino.update({ where: { id }, data: { ativo: !t.ativo } });
    await auditar(tx, { usuarioId: user.id, entidade: "TipoDestino", entidadeId: id, acao: t.ativo ? "DESATIVAR" : "ATIVAR", dadosAntes: { nome: t.nome, ativo: t.ativo }, dadosDepois: { nome: t.nome, ativo: !t.ativo } });
  });
  return pronto();
}

// A ordem importa: o primeiro tipo que reconhece o nome vale.
export async function moverTipoDestino(id: string, direcao: "acima" | "abaixo"): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const todos = await prisma.tipoDestino.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  const i = todos.findIndex((t) => t.id === id);
  const j = direcao === "acima" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= todos.length) return { ok: true };
  const nova = [...todos];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  await prisma.$transaction(async (tx) => {
    for (const [k, t] of nova.entries()) if (t.ordem !== k + 1) await tx.tipoDestino.update({ where: { id: t.id }, data: { ordem: k + 1 } });
    await auditar(tx, { usuarioId: user.id, entidade: "TipoDestino", entidadeId: id, acao: "REORDENAR", dadosAntes: { ordem: todos.map((t) => t.nome) }, dadosDepois: { ordem: nova.map((t) => t.nome) } });
  });
  return pronto();
}

// ============================================================================
// Planilhas: conferir (só lê) e confirmar (grava). O arquivo vai de novo na
// confirmação: nada fica guardado entre os dois passos, e a gravação refaz o
// plano sobre o banco daquele momento.
// ============================================================================

const LIMITE_ARQUIVO = 5 * 1024 * 1024;

async function lerArquivo(form: FormData): Promise<{ nome: string; bytes: Uint8Array } | { erro: string }> {
  const f = form.get("arquivo");
  if (!(f instanceof File) || !f.size) return { erro: "Escolha a planilha (CSV ou XLSX)." };
  if (f.size > LIMITE_ARQUIVO) return { erro: "A planilha passa de 5 MB." };
  if (!/\.(csv|txt|xlsx|xls)$/i.test(f.name)) return { erro: "A planilha precisa ser CSV ou XLSX." };
  return { nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) };
}

async function planoDeDestinos(nome: string, bytes: Uint8Array): Promise<PlanoDestinos> {
  const ano = await getAnoAtivo();
  const [existentes, unidades] = await Promise.all([
    prisma.destino.findMany({ where: { mescladoEmId: null } }),
    ano ? prisma.unidadeOrcamentaria.findMany({ where: { exercicio: { ano } }, select: { codigo: true } }) : [],
  ]);
  return planejarDestinos(
    lerTabela(CAMPOS_DESTINOS, nome, bytes),
    existentes.map((d) => ({
      id: d.id,
      nome: d.nome,
      nomeOficial: d.nomeOficial,
      execucao: d.execucao,
      unidadeCodigo: d.unidadeCodigo,
      unidadeRepasseCodigo: d.unidadeRepasseCodigo,
      endereco: d.endereco,
      cnpj: d.cnpj,
      cnes: d.cnes,
      inep: d.inep,
      populacaoReferencia: d.populacaoReferencia,
      fontePopulacao: d.fontePopulacao,
      ativo: d.ativo,
      apelidos: d.apelidos,
    })),
    new Set(unidades.map((u) => u.codigo))
  );
}

export async function conferirPlanilhaDestinos(form: FormData): Promise<{ ok: true; plano: PlanoDestinos } | { ok: false; erro: string }> {
  const user = await exigirAdmin();
  if (falhou(user)) return user as { ok: false; erro: string };
  const a = await lerArquivo(form);
  if ("erro" in a) return { ok: false, erro: a.erro };
  return { ok: true, plano: await planoDeDestinos(a.nome, a.bytes) };
}

export async function confirmarPlanilhaDestinos(form: FormData): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const a = await lerArquivo(form);
  if ("erro" in a) return { ok: false, erro: a.erro };
  const plano = await planoDeDestinos(a.nome, a.bytes);
  if (plano.faltam.length) return { ok: false, erro: `Faltam colunas: ${plano.faltam.join(", ")}.` };
  if (!plano.novos.length && !plano.atualizados.length) return { ok: false, erro: "Nada a gravar: nenhuma linha nova ou alterada." };
  const tipos = await prisma.tipoDestino.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } });
  await prisma.$transaction(
    async (tx) => {
      for (const n of plano.novos) {
        const criado = await tx.destino.create({
          data: { ...n.dados, origem: "CADASTRO", criadoPorId: user.id, subfuncaoSugerida: subfuncaoDoDestino(n.dados.nome, n.dados.nomeOficial, tipos) },
        });
        await auditar(tx, { usuarioId: user.id, entidade: "Destino", entidadeId: criado.id, acao: "CRIAR_POR_PLANILHA", dadosDepois: criado });
      }
      for (const u of plano.atualizados) {
        const antes = await tx.destino.findUnique({ where: { id: u.id } });
        if (!antes) continue;
        const { nome: _nome, ...dados } = u.dados;
        void _nome;
        const salvo = await tx.destino.update({
          where: { id: u.id },
          data: { ...dados, apelidos: u.apelido && !antes.apelidos.includes(u.apelido) ? [...antes.apelidos, u.apelido] : antes.apelidos },
        });
        await auditar(tx, { usuarioId: user.id, entidade: "Destino", entidadeId: u.id, acao: "ATUALIZAR_POR_PLANILHA", dadosAntes: antes, dadosDepois: salvo });
      }
    },
    { timeout: 120_000 }
  );
  return pronto(`Planilha gravada: ${plano.novos.length} destino(s) novo(s), ${plano.atualizados.length} atualizado(s).`);
}

async function planoDeHistorico(nome: string, bytes: Uint8Array): Promise<PlanoHistorico> {
  const [exercicios, existentes, autores] = await Promise.all([
    prisma.exercicio.findMany({ select: { ano: true } }),
    prisma.emendaImportada.findMany({ include: { exercicio: { select: { ano: true } }, autor: { select: { nome: true } } } }),
    prisma.autor.findMany({ select: { nome: true } }),
  ]);
  return planejarHistorico(
    lerTabela(CAMPOS_HISTORICO, nome, bytes),
    existentes.map((e) => ({ ano: e.exercicio.ano, numero: e.numero, autor: e.autor.nome, descricao: e.descricao, valor: e.valor.toNumber(), parcela: e.parcela })),
    new Set(exercicios.map((e) => e.ano)),
    autores.map((a) => a.nome)
  );
}

export async function conferirPlanilhaHistorico(form: FormData): Promise<{ ok: true; plano: PlanoHistorico } | { ok: false; erro: string }> {
  const user = await exigirAdmin();
  if (falhou(user)) return user as { ok: false; erro: string };
  const a = await lerArquivo(form);
  if ("erro" in a) return { ok: false, erro: a.erro };
  return { ok: true, plano: await planoDeHistorico(a.nome, a.bytes) };
}

export async function confirmarPlanilhaHistorico(form: FormData): Promise<Resultado> {
  const user = await exigirAdmin();
  if (falhou(user)) return user;
  const a = await lerArquivo(form);
  if ("erro" in a) return { ok: false, erro: a.erro };
  const plano = await planoDeHistorico(a.nome, a.bytes);
  if (plano.faltam.length) return { ok: false, erro: `Faltam colunas: ${plano.faltam.join(", ")}.` };
  const gravar = [...plano.novas, ...plano.atualizadas];
  if (!gravar.length) return { ok: false, erro: "Nada a gravar: nenhuma emenda nova ou alterada." };
  const exercicios = new Map((await prisma.exercicio.findMany({ select: { id: true, ano: true } })).map((e) => [e.ano, e.id]));
  await prisma.$transaction(
    async (tx) => {
      const autorId = new Map<string, string>();
      for (const g of gravar) {
        const chave = g.dados.autor.toLocaleLowerCase("pt-BR");
        if (autorId.has(chave)) continue;
        const existente = await tx.autor.findFirst({ where: { nome: { equals: g.dados.autor, mode: "insensitive" } } });
        const autor = existente ?? (await tx.autor.create({ data: { nome: g.dados.autor, cargo: "Vereador" } }));
        if (!existente) await auditar(tx, { usuarioId: user.id, entidade: "Autor", entidadeId: autor.id, acao: "CRIAR_POR_PLANILHA", dadosDepois: autor });
        autorId.set(chave, autor.id);
      }
      for (const g of gravar) {
        const exercicioId = exercicios.get(g.dados.ano)!;
        const dados = {
          autorId: autorId.get(g.dados.autor.toLocaleLowerCase("pt-BR"))!,
          descricao: g.dados.descricao,
          valor: g.dados.valor,
          parcela: g.dados.parcela,
          fonte: `Planilha ${a.nome}`,
        };
        const antes = await tx.emendaImportada.findUnique({ where: { exercicioId_numero: { exercicioId, numero: g.dados.numero } } });
        const salvo = await tx.emendaImportada.upsert({
          where: { exercicioId_numero: { exercicioId, numero: g.dados.numero } },
          update: dados,
          create: { ...dados, exercicioId, numero: g.dados.numero },
        });
        await auditar(tx, { usuarioId: user.id, entidade: "EmendaImportada", entidadeId: salvo.id, acao: antes ? "ATUALIZAR_POR_PLANILHA" : "CRIAR_POR_PLANILHA", dadosAntes: antes, dadosDepois: salvo });
      }
    },
    { timeout: 120_000 }
  );
  return pronto(`Planilha gravada: ${plano.novas.length} emenda(s) nova(s), ${plano.atualizadas.length} atualizada(s)${plano.autoresNovos.length ? `, ${plano.autoresNovos.length} autor(es) novo(s)` : ""}.`);
}
