"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/audit";
import { podeAtribuirPerfil, podeGerirExercicio, podeGerirPerfis, temPermissao, PERMISSOES } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "@/lib/session";

export type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

const erro = (e: z.ZodError) => ({ ok: false as const, erro: e.issues[0]?.message ?? "Dados inválidos." });
const duplicado = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

async function exigir(permissao: "administrarConfiguracoes" | "gerirExercicios"): Promise<SessionUser | Resultado> {
  const user = await getCurrentUser();
  if (!temPermissao(user, permissao)) return { ok: false, erro: "Sem permissão para esta configuração." };
  return user;
}
const falhou = (x: SessionUser | Resultado): x is Resultado => "ok" in x;

function pronto(mensagem?: string): Resultado {
  revalidatePath("/config", "layout");
  return { ok: true, mensagem };
}

// ============================================================================
// Exercício e parâmetros das emendas impositivas
// ============================================================================

const numeroOpcional = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().nonnegative().nullable());

const configuracaoSchema = z.object({
  exercicioId: z.string().min(1),
  cotaIndividual: numeroOpcional,
  percentualRcl: numeroOpcional,
  rclBase: numeroOpcional,
  rclAnoBase: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(2000).max(2100).nullable()),
  rclObservacao: z.string().max(1000).nullable(),
  numeroVereadores: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(200).nullable()),
  memoriaCota: z.string().max(2000).nullable(),
  percentualSaude: z.number().min(0).max(100),
  afericaoSaude: z.enum(["GLOBAL", "INDIVIDUAL"]),
  observacaoSaude: z.string().max(1000).nullable(),
  toleranciaValorPct: z.number().min(0).max(100),
  validadeReferenciaMeses: z.number().int().min(1).max(120),
  percentualAcessorio: z.number().min(0).max(100),
  fonteAudesp: z.string().max(20).nullable(),
  fonteAudespNome: z.string().max(200).nullable(),
  codigoAplicacao: z.string().max(20).nullable(),
  formatoVariacao: z.number().int().min(1).max(10),
  icEpVigente: z.boolean(),
  icEpCodigo: z.string().max(20).nullable(),
  orgaosForaDasEmendas: z.array(z.string().regex(/^\d{1,4}$/, "Código de órgão inválido.")).max(100),
  rotuloBase: z.string().max(200).nullable(),
  prazoProtocolo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  fontePrecoObrigatoria: z.boolean(),
  validadeLinkEntidadeDias: z.number().int().min(1, "A validade do link vai de 1 a 90 dias.").max(90, "A validade do link vai de 1 a 90 dias."),
});

export async function salvarConfiguracao(entrada: z.input<typeof configuracaoSchema>): Promise<Resultado> {
  const user = await exigir("gerirExercicios");
  if (falhou(user)) return user;
  const p = configuracaoSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const { exercicioId, prazoProtocolo, ...campos } = p.data;
  const dados = { ...campos, prazoProtocolo: prazoProtocolo ? new Date(`${prazoProtocolo}T23:59:59-03:00`) : null };
  const antes = await prisma.configuracaoExercicio.findUnique({ where: { exercicioId } });
  const salvo = await prisma.configuracaoExercicio.upsert({
    where: { exercicioId },
    update: dados,
    create: { ...dados, exercicioId },
  });
  await registrarAuditoria({ usuarioId: user.id, entidade: "ConfiguracaoExercicio", entidadeId: salvo.id, acao: "ATUALIZAR", dadosAntes: antes, dadosDepois: salvo });
  return pronto("Parâmetros do exercício salvos.");
}

export async function criarExercicio(ano: number): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirExercicio(user)) return { ok: false, erro: "Sem permissão para criar exercício." };
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { ok: false, erro: "Ano inválido." };
  try {
    const ex = await prisma.exercicio.create({ data: { ano, configuracao: { create: {} } } });
    await registrarAuditoria({ usuarioId: user.id, entidade: "Exercicio", entidadeId: ex.id, acao: "CRIAR", dadosDepois: { ano } });
  } catch (e) {
    if (duplicado(e)) return { ok: false, erro: "Exercício já existe." };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true, mensagem: `Exercício ${ano} criado.` };
}

export async function definirStatusExercicio(id: string, status: "ABERTO" | "ENCERRADO"): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirExercicio(user)) return { ok: false, erro: "Sem permissão." };
  const ex = await prisma.exercicio.update({ where: { id }, data: { status } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "Exercicio", entidadeId: id, acao: status === "ABERTO" ? "ABRIR" : "ENCERRAR", dadosDepois: { ano: ex.ano } });
  revalidatePath("/", "layout");
  return { ok: true };
}

const prazoSchema = z.object({
  exercicioId: z.string().min(1),
  descricao: z.string().trim().min(5, "Descreva o prazo.").max(1000),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  url: z.union([z.literal(""), z.url("Link inválido.")]).optional(),
});

export async function adicionarPrazo(entrada: z.input<typeof prazoSchema>): Promise<Resultado> {
  const user = await exigir("gerirExercicios");
  if (falhou(user)) return user;
  const p = prazoSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const prazo = await prisma.prazoExercicio.create({
    data: { exercicioId: p.data.exercicioId, descricao: p.data.descricao, data: new Date(`${p.data.data}T12:00:00Z`), url: p.data.url || null },
  });
  await registrarAuditoria({ usuarioId: user.id, entidade: "PrazoExercicio", entidadeId: prazo.id, acao: "CRIAR", dadosDepois: prazo });
  return pronto("Prazo adicionado.");
}

export async function excluirPrazo(id: string): Promise<Resultado> {
  const user = await exigir("gerirExercicios");
  if (falhou(user)) return user;
  const antes = await prisma.prazoExercicio.delete({ where: { id } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "PrazoExercicio", entidadeId: id, acao: "EXCLUIR", dadosAntes: antes });
  return pronto();
}

// ============================================================================
// Usuários e perfis
// ============================================================================

const usuarioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(200),
  email: z.email("E-mail inválido.").max(200),
  perfilId: z.string().min(1, "Escolha o perfil."),
  senha: z.string().min(10, "A senha precisa de ao menos 10 caracteres.").max(200),
  autorNome: z.string().trim().max(200).optional(),
});

export async function criarUsuario(entrada: z.input<typeof usuarioSchema>): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const p = usuarioSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const perfil = await prisma.perfilAcesso.findUnique({ where: { id: p.data.perfilId } });
  if (!perfil) return { ok: false, erro: "Perfil não encontrado." };
  if (!podeAtribuirPerfil(user, perfil)) return { ok: false, erro: "Você não pode atribuir este perfil." };
  try {
    const criado = await prisma.user.create({
      data: {
        name: p.data.nome,
        email: p.data.email.toLowerCase(),
        perfilId: perfil.id,
        passwordHash: await bcrypt.hash(p.data.senha, 10),
      },
    });
    if (p.data.autorNome) await vincular(criado.id, p.data.autorNome);
    await registrarAuditoria({ usuarioId: user.id, entidade: "User", entidadeId: criado.id, acao: "CRIAR", dadosDepois: { email: criado.email, perfil: perfil.nome } });
  } catch (e) {
    if (duplicado(e)) return { ok: false, erro: "Já existe um usuário com este e-mail." };
    throw e;
  }
  return pronto("Usuário criado.");
}

export async function reatribuirPerfil(usuarioId: string, perfilId: string | null): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const alvo = await prisma.user.findUnique({ where: { id: usuarioId }, include: { perfil: true } });
  if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
  if (alvo.perfil && !podeAtribuirPerfil(user, alvo.perfil)) return { ok: false, erro: "Você não pode alterar o perfil deste usuário." };
  const novo = perfilId ? await prisma.perfilAcesso.findUnique({ where: { id: perfilId } }) : null;
  if (perfilId && !novo) return { ok: false, erro: "Perfil não encontrado." };
  if (novo && !podeAtribuirPerfil(user, novo)) return { ok: false, erro: "Você não pode atribuir este perfil." };
  if (alvo.id === user.id && !novo) return { ok: false, erro: "Você não pode tirar o próprio acesso." };
  await prisma.user.update({ where: { id: usuarioId }, data: { perfilId: novo?.id ?? null } });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "User",
    entidadeId: usuarioId,
    acao: "REATRIBUIR_PERFIL",
    dadosAntes: { perfil: alvo.perfil?.nome ?? null },
    dadosDepois: { perfil: novo?.nome ?? null },
  });
  return pronto("Perfil alterado. Vale no próximo login do usuário.");
}

export async function definirSenha(usuarioId: string, senha: string): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  if (typeof senha !== "string" || senha.length < 10) return { ok: false, erro: "A senha precisa de ao menos 10 caracteres." };
  const alvo = await prisma.user.findUnique({ where: { id: usuarioId }, include: { perfil: true } });
  if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
  if (alvo.perfil && !podeAtribuirPerfil(user, alvo.perfil) && alvo.id !== user.id) return { ok: false, erro: "Você não pode alterar este usuário." };
  await prisma.user.update({ where: { id: usuarioId }, data: { passwordHash: await bcrypt.hash(senha, 10) } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "User", entidadeId: usuarioId, acao: "DEFINIR_SENHA" });
  return pronto("Senha definida.");
}

// Vincula o usuário a um autor (vereador): o existente com esse nome, ou um novo.
async function vincular(usuarioId: string, autorNome: string) {
  const existente = await prisma.autor.findUnique({ where: { nome: autorNome } });
  if (existente) {
    if (existente.usuarioId && existente.usuarioId !== usuarioId) throw new Error("Este autor já está vinculado a outra conta.");
    await prisma.autor.update({ where: { id: existente.id }, data: { usuarioId } });
  } else {
    await prisma.autor.create({ data: { nome: autorNome, cargo: "Vereador", usuarioId } });
  }
}

export async function vincularAutor(usuarioId: string, autorNome: string | null): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const alvo = await prisma.user.findUnique({ where: { id: usuarioId }, include: { perfil: true, autor: true } });
  if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
  if (alvo.perfil && !podeAtribuirPerfil(user, alvo.perfil)) return { ok: false, erro: "Você não pode alterar este usuário." };
  try {
    if (alvo.autor) await prisma.autor.update({ where: { id: alvo.autor.id }, data: { usuarioId: null } });
    if (autorNome?.trim()) await vincular(usuarioId, autorNome.trim());
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível vincular." };
  }
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "User",
    entidadeId: usuarioId,
    acao: "VINCULAR_AUTOR",
    dadosAntes: { autor: alvo.autor?.nome ?? null },
    dadosDepois: { autor: autorNome?.trim() || null },
  });
  return pronto("Vínculo com o autor atualizado.");
}

const perfilSchema = z.object({
    id: z.string().optional(),
    nome: z.string().trim().min(3, "Informe o nome do perfil.").max(100),
    descricao: z.string().trim().max(500).optional(),
    poder: z.enum(["LEGISLATIVO", "EXECUTIVO"]).nullable(),
    permissoes: z.array(z.enum(PERMISSOES as [string, ...string[]])),
  });

export async function salvarPerfil(entrada: z.input<typeof perfilSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirPerfis(user)) return { ok: false, erro: "Só o Administrador Geral compõe perfis." };
  const p = perfilSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const flags = Object.fromEntries(PERMISSOES.map((k) => [k, p.data.permissoes.includes(k)]));
  const dados = { nome: p.data.nome, descricao: p.data.descricao || null, poder: p.data.poder, ...flags };
  try {
    if (p.data.id) {
      const atual = await prisma.perfilAcesso.findUnique({ where: { id: p.data.id } });
      if (!atual) return { ok: false, erro: "Perfil não encontrado." };
      if (atual.perfilDoSistema) return { ok: false, erro: "Perfis do sistema não se editam." };
      const salvo = await prisma.perfilAcesso.update({ where: { id: atual.id }, data: dados });
      await registrarAuditoria({ usuarioId: user.id, entidade: "PerfilAcesso", entidadeId: salvo.id, acao: "ATUALIZAR", dadosAntes: atual, dadosDepois: salvo });
    } else {
      const salvo = await prisma.perfilAcesso.create({ data: { ...dados, perfilDoSistema: false, adminGeral: false } });
      await registrarAuditoria({ usuarioId: user.id, entidade: "PerfilAcesso", entidadeId: salvo.id, acao: "CRIAR", dadosDepois: salvo });
    }
  } catch (e) {
    if (duplicado(e)) return { ok: false, erro: "Já existe um perfil com este nome." };
    throw e;
  }
  return pronto("Perfil salvo. Vale no próximo login de quem o usa.");
}

export async function excluirPerfil(id: string): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirPerfis(user)) return { ok: false, erro: "Só o Administrador Geral exclui perfis." };
  const perfil = await prisma.perfilAcesso.findUnique({ where: { id }, include: { _count: { select: { usuarios: true } } } });
  if (!perfil) return { ok: false, erro: "Perfil não encontrado." };
  if (perfil.perfilDoSistema) return { ok: false, erro: "Perfis do sistema não podem ser excluídos." };
  if (perfil._count.usuarios > 0) return { ok: false, erro: "Há usuários com este perfil. Reatribua antes de excluir." };
  await prisma.perfilAcesso.delete({ where: { id } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "PerfilAcesso", entidadeId: id, acao: "EXCLUIR", dadosAntes: perfil });
  return pronto();
}

// ============================================================================
// Destinos, biblioteca de objetos e áreas
// ============================================================================

export async function alternarDestinoAtivo(id: string): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const d = await prisma.destino.findUnique({ where: { id } });
  if (!d) return { ok: false, erro: "Destino não encontrado." };
  await prisma.destino.update({ where: { id }, data: { ativo: !d.ativo } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "Destino", entidadeId: id, acao: d.ativo ? "DESATIVAR" : "ATIVAR" });
  return pronto();
}

// Subfunção que o equipamento sugere quando o objeto da emenda não a define
// (EMEI → 365). Em branco, o motor oferece as subfunções da unidade.
export async function definirSubfuncaoDestino(id: string, subfuncao: string): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const codigo = /^\d{3}$/.test(subfuncao) ? subfuncao : null;
  const d = await prisma.destino.update({ where: { id }, data: { subfuncaoSugerida: codigo } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "Destino", entidadeId: id, acao: "SUBFUNCAO_SUGERIDA", dadosDepois: { subfuncao: codigo, destino: d.nome } });
  return pronto(codigo ? `Subfunção sugerida: ${codigo}.` : "Subfunção sugerida removida: o vereador escolhe entre as da unidade.");
}

export async function definirPendenciaDestino(id: string, pendencia: string): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const texto = String(pendencia ?? "").trim().slice(0, 500) || null;
  const antes = await prisma.destino.update({ where: { id }, data: { pendenciaHabilitacao: texto } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "Destino", entidadeId: id, acao: "PENDENCIA_HABILITACAO", dadosDepois: { pendencia: texto, destino: antes.nome } });
  return pronto(texto ? "Pendência registrada: bloqueia a submissão de emendas para esta entidade." : "Pendência removida.");
}

const objetoSchema = z.object({
  id: z.string().optional(),
  rotulo: z.string().trim().min(2, "Informe o rótulo.").max(120),
  termos: z.array(z.string().trim().min(2).max(80)).min(1, "Informe ao menos um termo."),
  natureza: z.enum(["CUSTEIO", "CAPITAL"]),
  elemento: z.string().regex(/^\d{2}$/, "Elemento com dois dígitos."),
  divisibilidade: z.enum(["DIVISIVEL", "INDIVISIVEL"]),
  subfuncao: z.union([z.literal(""), z.string().regex(/^\d{3}$/, "Subfunção com três dígitos.")]),
  estrito: z.boolean(),
  explicacao: z.string().trim().min(2).max(200),
  areaId: z.string().nullable(),
});

export async function salvarObjeto(entrada: z.input<typeof objetoSchema>): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const p = objetoSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const { id, subfuncao, ...resto } = p.data;
  const dados = { ...resto, subfuncao: subfuncao || null, termos: resto.termos.map((t) => t.toLowerCase()) };
  const salvo = id
    ? await prisma.objetoBiblioteca.update({ where: { id }, data: dados })
    : await prisma.objetoBiblioteca.create({ data: { ...dados, ordem: (await prisma.objetoBiblioteca.count()) + 1 } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "ObjetoBiblioteca", entidadeId: salvo.id, acao: id ? "ATUALIZAR" : "CRIAR", dadosDepois: salvo });
  return pronto("Objeto salvo. Vale para as próximas análises.");
}

export async function alternarObjetoAtivo(id: string): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const o = await prisma.objetoBiblioteca.findUnique({ where: { id } });
  if (!o) return { ok: false, erro: "Objeto não encontrado." };
  await prisma.objetoBiblioteca.update({ where: { id }, data: { ativo: !o.ativo } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "ObjetoBiblioteca", entidadeId: id, acao: o.ativo ? "DESATIVAR" : "ATIVAR" });
  return pronto();
}

const areaSchema = z.object({
  id: z.string().min(1),
  orgaos: z.array(z.string().regex(/^\d{1,4}$/, "Código de órgão inválido.")),
  unidadePadrao: z.union([z.literal(""), z.string().regex(/^\d{1,4}\.\d{1,4}$/, "Unidade no formato 13.01.")]),
});

export async function salvarArea(entrada: z.input<typeof areaSchema>): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const p = areaSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const antes = await prisma.areaAplicacao.findUnique({ where: { id: p.data.id } });
  const salvo = await prisma.areaAplicacao.update({
    where: { id: p.data.id },
    data: { orgaos: p.data.orgaos, unidadePadrao: p.data.unidadePadrao || null },
  });
  await registrarAuditoria({ usuarioId: user.id, entidade: "AreaAplicacao", entidadeId: salvo.id, acao: "ATUALIZAR", dadosAntes: antes, dadosDepois: salvo });
  return pronto("Área salva.");
}

// ============================================================================
// Normas
// ============================================================================

const normaSchema = z.object({
  tipo: z.enum(["LOM", "REGIMENTO_INTERNO", "LEI", "PORTARIA", "COMUNICADO", "OUTRO"]),
  titulo: z.string().trim().min(3, "Informe o título.").max(300),
  numero: z.string().trim().max(60).optional(),
  artigo: z.string().trim().max(200).optional(),
  trecho: z.string().trim().max(3000).optional(),
  url: z.union([z.literal(""), z.url("Link inválido.")]).optional(),
  dataVigencia: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
});

export async function criarNorma(entrada: z.input<typeof normaSchema>): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const p = normaSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const norma = await prisma.documentoNormativo.create({
    data: {
      tipo: p.data.tipo,
      titulo: p.data.titulo,
      numero: p.data.numero || null,
      artigo: p.data.artigo || null,
      trecho: p.data.trecho || null,
      url: p.data.url || null,
      dataVigencia: p.data.dataVigencia ? new Date(`${p.data.dataVigencia}T12:00:00Z`) : null,
    },
  });
  await registrarAuditoria({ usuarioId: user.id, entidade: "DocumentoNormativo", entidadeId: norma.id, acao: "CRIAR", dadosDepois: norma });
  return pronto("Norma cadastrada.");
}

export async function alternarNormaAtiva(id: string): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const n = await prisma.documentoNormativo.findUnique({ where: { id } });
  if (!n) return { ok: false, erro: "Norma não encontrada." };
  await prisma.documentoNormativo.update({ where: { id }, data: { ativo: !n.ativo } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "DocumentoNormativo", entidadeId: id, acao: n.ativo ? "DESATIVAR" : "ATIVAR" });
  return pronto();
}

// ============================================================================
// Fontes oficiais de preço
// ============================================================================

const APLICA_A = ["CUSTEIO", "OBRAS", "EQUIPAMENTOS", "TERCEIRO_SETOR", "SAUDE"] as const;
const TIPOS_REF = [
  "ATA", "CONTRATACAO_MUNICIPIO", "CONTRATACAO_OUTRO_ORGAO", "PAINEL", "BANCO_PRECOS_SAUDE",
  "TABELA_OFICIAL", "COTACAO", "NOTA_FISCAL", "TERMO_PARCERIA", "ESTIMATIVA",
] as const;

const fonteSchema = z.object({
  id: z.string().max(40).optional(),
  nome: z.string().trim().min(3, "Informe o nome da fonte.").max(200),
  url: z.url("Link inválido.").max(1000),
  orientacao: z.string().trim().min(10, "Diga em uma frase como pesquisar nesta fonte.").max(600),
  aplicaA: z.array(z.enum(APLICA_A)).max(APLICA_A.length),
  tipo: z.enum(TIPOS_REF),
  ordem: z.number().int().min(0).max(10000),
});

export async function salvarFontePreco(entrada: z.input<typeof fonteSchema>): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const p = fonteSchema.safeParse(entrada);
  if (!p.success) return erro(p.error);
  const { id, ...dados } = p.data;
  try {
    if (id) {
      const antes = await prisma.fontePrecoOficial.findUnique({ where: { id } });
      if (!antes) return { ok: false, erro: "Fonte não encontrada." };
      const depois = await prisma.fontePrecoOficial.update({ where: { id }, data: dados });
      await registrarAuditoria({ usuarioId: user.id, entidade: "FontePrecoOficial", entidadeId: id, acao: "ATUALIZAR", dadosAntes: antes, dadosDepois: depois });
      return pronto("Fonte de preço salva.");
    }
    const criada = await prisma.fontePrecoOficial.create({ data: dados });
    await registrarAuditoria({ usuarioId: user.id, entidade: "FontePrecoOficial", entidadeId: criada.id, acao: "CRIAR", dadosDepois: criada });
    return pronto("Fonte de preço cadastrada.");
  } catch (e) {
    if (duplicado(e)) return { ok: false, erro: "Já existe uma fonte com esse nome." };
    throw e;
  }
}

export async function alternarFontePrecoAtiva(id: string): Promise<Resultado> {
  const user = await exigir("administrarConfiguracoes");
  if (falhou(user)) return user;
  const antes = await prisma.fontePrecoOficial.findUnique({ where: { id } });
  if (!antes) return { ok: false, erro: "Fonte não encontrada." };
  const depois = await prisma.fontePrecoOficial.update({ where: { id }, data: { ativo: !antes.ativo } });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "FontePrecoOficial",
    entidadeId: id,
    acao: antes.ativo ? "DESATIVAR" : "ATIVAR",
    dadosAntes: antes,
    dadosDepois: depois,
  });
  return pronto(antes.ativo ? "Fonte desativada: deixa de aparecer para o autor." : "Fonte ativada.");
}
