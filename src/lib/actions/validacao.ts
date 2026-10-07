"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditar } from "@/lib/audit";
import { temPermissao } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { VERIFICACOES } from "@/lib/riep/verificacoes";
import { getCurrentUser } from "@/lib/session";

// ============================================================================
// Regras de validação do exercício: modo (bloqueante ou alerta), ligada ou
// não, fundamento por extenso e norma. Mudar aqui muda a próxima validação,
// sem publicação nova. As verificações fixas não aceitam mudança.
// ============================================================================

export type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

const regraSchema = z.object({
  codigo: z.string().min(1).max(40),
  modo: z.enum(["BLOQUEANTE", "ALERTA"]),
  ativa: z.boolean(),
  fundamento: z.string().trim().max(1000),
  normaId: z.string().max(40).nullable(),
});

export async function salvarRegras(exercicioId: string, regras: z.input<typeof regraSchema>[]): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!temPermissao(user, "gerirExercicios")) return { ok: false, erro: "Sem permissão para alterar as regras de validação." };
  const p = z.array(regraSchema).max(40).safeParse(regras);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const conhecidas = new Map(VERIFICACOES.map((v) => [v.codigo as string, v]));
  for (const r of p.data) {
    const def = conhecidas.get(r.codigo);
    if (!def) return { ok: false, erro: `Regra desconhecida: ${r.codigo}.` };
    if (!def.configuravel) return { ok: false, erro: "As verificações fixas não mudam de modo." };
    if (!def.desligavel && !r.ativa) return { ok: false, erro: "Só a (xii) pode ser desligada." };
  }
  if (!(await prisma.exercicio.findUnique({ where: { id: exercicioId }, select: { id: true } }))) return { ok: false, erro: "Exercício não encontrado." };
  await prisma.$transaction(async (tx) => {
    for (const r of p.data) {
      const antes = await tx.regraValidacao.findFirst({ where: { codigo: r.codigo, exercicioId } });
      const dados = { modo: r.modo, ativa: r.ativa, fundamento: r.fundamento || null, normaId: r.normaId };
      const depois = antes
        ? await tx.regraValidacao.update({ where: { id: antes.id }, data: dados })
        : await tx.regraValidacao.create({ data: { ...dados, codigo: r.codigo, exercicioId } });
      if (!antes || antes.modo !== depois.modo || antes.ativa !== depois.ativa || antes.fundamento !== depois.fundamento || antes.normaId !== depois.normaId) {
        await auditar(tx, { usuarioId: user.id, entidade: "RegraValidacao", entidadeId: depois.id, acao: antes ? "ATUALIZAR" : "CRIAR", dadosAntes: antes ?? undefined, dadosDepois: depois });
      }
    }
  });
  revalidatePath("/", "layout");
  return { ok: true, mensagem: "Regras de validação salvas. Valem a partir da próxima validação." };
}

const parametrosSchema = z.object({
  prazoDiligenciaDias: z.number().int("Prazo da diligência em dias inteiros.").min(1, "Prazo da diligência: ao menos 1 dia.").max(30, "Prazo da diligência: até 30 dias.").optional(),
  fundamentos: z.record(z.string(), z.object({ texto: z.string().trim().max(1000), normaId: z.string().max(40).nullable() })),
});

// Fundamento por extenso de cada parâmetro do exercício (item 12.1).
export async function salvarParametrosValidacao(exercicioId: string, entrada: z.input<typeof parametrosSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!temPermissao(user, "gerirExercicios")) return { ok: false, erro: "Sem permissão para alterar os parâmetros." };
  const p = parametrosSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  // Parâmetro definido sem fundamento por extenso é recusado.
  const cfg = await prisma.configuracaoExercicio.findUnique({ where: { exercicioId } });
  if (!cfg) return { ok: false, erro: "Exercício sem configuração." };
  const definidos: [string, string, boolean][] = [
    ["cotaIndividual", "cota individual", cfg.cotaIndividual != null],
    ["percentualSaude", "percentual da saúde", cfg.percentualSaude != null],
    ["prazoProtocolo", "prazo de protocolo", cfg.prazoProtocolo != null],
    ["prazoDiligenciaDias", "prazo da diligência", true],
  ];
  const semFundamento = definidos.filter(([k, , definido]) => definido && !p.data.fundamentos[k]?.texto?.trim()).map(([, rotulo]) => rotulo);
  if (semFundamento.length) return { ok: false, erro: `Informe o fundamento de: ${semFundamento.join(", ")}.` };
  await prisma.$transaction(async (tx) => {
    const depois = await tx.configuracaoExercicio.update({ where: { exercicioId }, data: { fundamentos: p.data.fundamentos, ...(p.data.prazoDiligenciaDias !== undefined ? { prazoDiligenciaDias: p.data.prazoDiligenciaDias } : {}) } });
    await auditar(tx, {
      usuarioId: user.id,
      entidade: "ConfiguracaoExercicio",
      entidadeId: depois.id,
      acao: "ATUALIZAR_VALIDACAO",
      dadosAntes: { fundamentos: cfg.fundamentos, prazoDiligenciaDias: cfg.prazoDiligenciaDias },
      dadosDepois: { fundamentos: depois.fundamentos, prazoDiligenciaDias: depois.prazoDiligenciaDias },
    });
  });
  revalidatePath("/", "layout");
  return { ok: true, mensagem: "Parâmetros da validação salvos." };
}
