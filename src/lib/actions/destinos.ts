"use server";

import { z } from "zod";
import { registrarAuditoria } from "@/lib/audit";
import { podeCriarEmenda, temPermissao } from "@/lib/authz";
import { cnpjValido, somenteDigitos } from "@/lib/cnpj";
import { paraDestinoMotor, type DestinoTela } from "@/lib/emendas/contexto";
import { anoDaTela } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { norm } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";
import { pertence } from "@/lib/riep/destino";

// ============================================================================
// Cadastro de destino a partir da tela da emenda. Na execução direta, o destino
// se vincula a uma unidade orçamentária (é por ela que o motor procura a
// dotação). Na indireta, a entidade precisa de CNPJ e responsável legal; a
// secretaria do repasse vem do objeto da emenda, não daqui.
// ============================================================================

const semTags = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !/[<>]/.test(v), "Caracteres inválidos.");

const destinoSchema = z.object({
  execucao: z.enum(["DIRETA", "INDIRETA"]),
  nome: semTags(300).min(2, "Informe o nome do destino."),
  endereco: semTags(500).min(1, "Informe o endereço."),
  unidadeCodigo: semTags(20).nullable(),
  // Exercício da tela: a lista de unidades válidas é a dele.
  exercicio: z.number().int().optional(),
  cnpj: semTags(20).nullable(),
  responsavelNome: semTags(200).nullable(),
  responsavelCargo: semTags(120).nullable(),
  telefone: semTags(20).nullable(),
  email: semTags(200).nullable(),
});

export type DadosDestino = z.input<typeof destinoSchema>;
type Resultado = { ok: true; destino: DestinoTela } | { ok: false; erro: string };

async function validarDados(dados: DadosDestino): Promise<{ ok: true; d: z.output<typeof destinoSchema>; unidades: Record<string, string> } | { ok: false; erro: string }> {
  const parsed = destinoSchema.safeParse(dados);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  const ano = await anoDaTela(d.exercicio);
  const unidadesDb = ano
    ? await prisma.unidadeOrcamentaria.findMany({ where: { exercicio: { ano } }, select: { codigo: true, nome: true } })
    : [];
  const unidades = Object.fromEntries(unidadesDb.map((u) => [u.codigo, u.nome]));
  if (d.execucao === "DIRETA") {
    // Vale uma unidade do exercício ou o órgão inteiro ("20", "02.05"), quando ele tem unidades.
    const orgaoInteiro = !!d.unidadeCodigo && !unidades[d.unidadeCodigo] && Object.keys(unidades).some((u) => pertence(u, d.unidadeCodigo!));
    if (!d.unidadeCodigo || (!unidades[d.unidadeCodigo] && !orgaoInteiro)) return { ok: false, erro: "Selecione a secretaria ou órgão responsável." };
  } else {
    if (!cnpjValido(d.cnpj)) return { ok: false, erro: "CNPJ inválido." };
    if (!d.responsavelNome) return { ok: false, erro: "Informe o responsável legal." };
    if (!d.responsavelCargo) return { ok: false, erro: "Informe o cargo do responsável." };
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return { ok: false, erro: "E-mail inválido." };
  }
  return { ok: true, d, unidades };
}

function dadosDoBanco(d: z.output<typeof destinoSchema>) {
  const direta = d.execucao === "DIRETA";
  return {
    nome: d.nome,
    endereco: d.endereco,
    unidadeCodigo: direta ? d.unidadeCodigo : null,
    cnpj: direta ? null : somenteDigitos(d.cnpj),
    responsavelNome: direta ? null : d.responsavelNome,
    responsavelCargo: direta ? null : d.responsavelCargo,
    telefone: direta ? null : d.telefone || null,
    email: direta ? null : d.email || null,
  };
}

async function nomeEmUso(execucao: "DIRETA" | "INDIRETA", nome: string, excetoId?: string) {
  const mesmos = await prisma.destino.findMany({ where: { execucao, ...(excetoId ? { id: { not: excetoId } } : {}) }, select: { nome: true } });
  return mesmos.some((x) => norm(x.nome) === norm(nome));
}

export async function cadastrarDestino(dados: DadosDestino): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeCriarEmenda(user) && !temPermissao(user, "administrarConfiguracoes")) {
    return { ok: false, erro: "Seu perfil não cadastra destinos." };
  }
  const v = await validarDados(dados);
  if (!v.ok) return v;
  if (await nomeEmUso(v.d.execucao, v.d.nome)) return { ok: false, erro: "Já existe um destino com esse nome." };
  const criado = await prisma.destino.create({
    data: { ...dadosDoBanco(v.d), execucao: v.d.execucao, origem: "CADASTRO", criadoPorId: user.id },
  });
  await registrarAuditoria({ usuarioId: user.id, entidade: "Destino", entidadeId: criado.id, acao: "CRIAR", dadosDepois: criado });
  return { ok: true, destino: paraDestinoMotor(criado, v.unidades) };
}

// Só destinos cadastrados por usuários se editam: a base oficial é somente leitura.
export async function atualizarDestino(id: string, dados: DadosDestino): Promise<Resultado> {
  const user = await getCurrentUser();
  const atual = await prisma.destino.findUnique({ where: { id } });
  if (!atual) return { ok: false, erro: "Destino não encontrado." };
  if (atual.origem !== "CADASTRO") return { ok: false, erro: "Destinos da base oficial não se editam por aqui." };
  if (atual.criadoPorId !== user.id && !temPermissao(user, "administrarConfiguracoes", "gerirTodasEmendas")) {
    return { ok: false, erro: "Só quem cadastrou o destino pode alterá-lo." };
  }
  const v = await validarDados({ ...dados, execucao: atual.execucao });
  if (!v.ok) return v;
  if (await nomeEmUso(atual.execucao, v.d.nome, id)) return { ok: false, erro: "Já existe um destino com esse nome." };
  const salvo = await prisma.destino.update({ where: { id }, data: dadosDoBanco(v.d) });
  await registrarAuditoria({ usuarioId: user.id, entidade: "Destino", entidadeId: id, acao: "ATUALIZAR", dadosAntes: atual, dadosDepois: salvo });
  return { ok: true, destino: paraDestinoMotor(salvo, v.unidades) };
}
