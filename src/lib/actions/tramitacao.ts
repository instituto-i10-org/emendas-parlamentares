"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/audit";
import { podeAnalisarViabilidade, podeRegistrarExecucao, podeTramitar } from "@/lib/authz";
import { conferirLancamento } from "@/lib/emendas/execucao";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

type Resultado = { ok: true } | { ok: false; erro: string };

// ============================================================================
// Tramitação na Câmara: a Comissão aprova ou rejeita a emenda submetida, com
// parecer. O parecer fica na própria emenda (e na auditoria).
// ============================================================================

const decisaoSchema = z.object({
  emendaId: z.string().min(1).max(40),
  decisao: z.enum(["APROVADA", "REJEITADA"]),
  parecer: z.string().trim().min(20, "Escreva o parecer (ao menos 20 caracteres).").max(4000),
});

export async function decidirTramitacao(entrada: z.input<typeof decisaoSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeTramitar(user)) return { ok: false, erro: "Sem permissão para tramitar emendas." };
  const p = decisaoSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const emenda = await prisma.emenda.findUnique({ where: { id: p.data.emendaId } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (emenda.status !== "SUBMETIDA") return { ok: false, erro: "Apenas emendas submetidas podem ser tramitadas." };
  const salvo = await prisma.emenda.update({
    where: { id: emenda.id },
    data: { status: p.data.decisao, parecerTramitacao: p.data.parecer, tramitadaEm: new Date(), tramitadaPorId: user.id },
  });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "Emenda",
    entidadeId: emenda.id,
    acao: p.data.decisao === "APROVADA" ? "APROVAR" : "REJEITAR",
    dadosAntes: { status: emenda.status },
    dadosDepois: { status: salvo.status, parecer: p.data.parecer },
  });
  revalidatePath("/tramitacao");
  revalidatePath(`/emendas/${emenda.id}`);
  return { ok: true };
}

// Diligência (Regimento Interno, art. 210-C, § 2º): a Comissão devolve a
// emenda ao autor para sanear vício formal ou completar o plano, por até 5
// dias. A emenda mantém o número e a cota; ao ser reenviada, volta à fila.
// O prazo é informado, não executado: vencido, a fila sinaliza e a Comissão
// decide (a emenda não saneada é inadmissível, mas quem rejeita é a Comissão).
const diligenciaSchema = z.object({
  emendaId: z.string().min(1).max(40),
  motivo: z.string().trim().min(20, "Descreva o que precisa ser sanado (ao menos 20 caracteres).").max(4000),
  dias: z.number().int().min(1).max(30),
});

export async function pedirDiligencia(entrada: z.input<typeof diligenciaSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeTramitar(user)) return { ok: false, erro: "Sem permissão para tramitar emendas." };
  const p = diligenciaSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const emenda = await prisma.emenda.findUnique({ where: { id: p.data.emendaId } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (emenda.status !== "SUBMETIDA") return { ok: false, erro: "Só emendas na fila da Comissão vão para diligência." };
  const ate = new Date();
  ate.setUTCDate(ate.getUTCDate() + p.data.dias);
  await prisma.emenda.update({
    where: { id: emenda.id },
    data: { status: "EM_DILIGENCIA", diligenciaMotivo: p.data.motivo, diligenciaAte: ate, diligenciaEm: new Date(), reenviadaEm: null },
  });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "Emenda",
    entidadeId: emenda.id,
    acao: "PEDIR_DILIGENCIA",
    dadosAntes: { status: emenda.status },
    dadosDepois: { status: "EM_DILIGENCIA", motivo: p.data.motivo, dias: p.data.dias },
  });
  revalidatePath("/tramitacao");
  revalidatePath("/emendas");
  revalidatePath(`/emendas/${emenda.id}`);
  return { ok: true };
}

// Devolve uma emenda decidida para a fila (erro de decisão). Só quem tramita.
export async function reabrirTramitacao(emendaId: string, motivo: string): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeTramitar(user)) return { ok: false, erro: "Sem permissão para tramitar emendas." };
  if (String(motivo ?? "").trim().length < 10) return { ok: false, erro: "Informe o motivo (ao menos 10 caracteres)." };
  const emenda = await prisma.emenda.findUnique({ where: { id: emendaId }, include: { andamentos: { take: 1 } } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (emenda.status !== "APROVADA" && emenda.status !== "REJEITADA") return { ok: false, erro: "A emenda não foi decidida." };
  if (emenda.andamentos.length) return { ok: false, erro: "A emenda já tem execução lançada: não volta à fila." };
  await prisma.emenda.update({
    where: { id: emendaId },
    data: { status: "SUBMETIDA", parecerTramitacao: null, tramitadaEm: null, tramitadaPorId: null },
  });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "Emenda",
    entidadeId: emendaId,
    acao: "REABRIR_TRAMITACAO",
    dadosAntes: { status: emenda.status, parecer: emenda.parecerTramitacao },
    dadosDepois: { status: "SUBMETIDA", motivo: motivo.trim() },
  });
  revalidatePath("/tramitacao");
  revalidatePath(`/emendas/${emendaId}`);
  return { ok: true };
}

// ============================================================================
// Executivo: parecer de viabilidade técnica (informativo, não trava a
// tramitação; vale o mais recente) e lançamento da execução orçamentária.
// ============================================================================

const parecerSchema = z.object({
  emendaId: z.string().min(1).max(40),
  resultado: z.enum(["VIAVEL", "VIAVEL_COM_RESSALVA", "INVIAVEL"]),
  justificativa: z.string().trim().min(20, "Descreva a justificativa (ao menos 20 caracteres).").max(4000),
});

export async function registrarParecerViabilidade(entrada: z.input<typeof parecerSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeAnalisarViabilidade(user)) return { ok: false, erro: "Sem permissão para registrar parecer de viabilidade." };
  const p = parecerSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const emenda = await prisma.emenda.findUnique({ where: { id: p.data.emendaId } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (emenda.status === "RASCUNHO") return { ok: false, erro: "A emenda ainda não foi submetida: não cabe parecer nesta fase." };
  const parecer = await prisma.parecerViabilidade.create({
    data: { emendaId: emenda.id, resultado: p.data.resultado, justificativa: p.data.justificativa, usuarioId: user.id },
  });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "ParecerViabilidade",
    entidadeId: parecer.id,
    acao: "CRIAR",
    dadosDepois: { emenda: emenda.numero, resultado: parecer.resultado },
  });
  revalidatePath("/executivo/viabilidade");
  revalidatePath(`/emendas/${emenda.id}`);
  return { ok: true };
}

const andamentoSchema = z.object({
  emendaId: z.string().min(1).max(40),
  etapa: z.enum(["EMPENHO", "LIQUIDACAO", "PAGAMENTO"]),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  valor: z.number().finite().refine((v) => v !== 0, "Informe um valor diferente de zero."),
  numeroDocumento: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(1000).optional(),
});

export async function registrarAndamento(entrada: z.input<typeof andamentoSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeRegistrarExecucao(user)) return { ok: false, erro: "Sem permissão para lançar a execução." };
  const p = andamentoSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const data = new Date(`${p.data.data}T12:00:00Z`);
  if (data.getTime() > Date.now() + 86_400_000) return { ok: false, erro: "A data do lançamento não pode ser futura." };

  return prisma.$transaction(async (tx) => {
    const emenda = await tx.emenda.findUnique({ where: { id: p.data.emendaId }, include: { andamentos: true, exercicio: { select: { ano: true } } } });
    if (!emenda) return { ok: false as const, erro: "Emenda não encontrada." };
    if (emenda.status !== "APROVADA") return { ok: false as const, erro: "Só emendas aprovadas têm execução orçamentária a lançar." };
    // O orçamento só vigora a partir de 1º de janeiro do exercício; depois dele
    // pode (restos a pagar), antes não.
    if (data.getTime() < Date.UTC(emenda.exercicio.ano, 0, 1)) {
      return { ok: false as const, erro: `A emenda é do exercício ${emenda.exercicio.ano}: o lançamento só pode ter data a partir de 01/01/${emenda.exercicio.ano}.` };
    }
    const recusa = conferirLancamento(
      emenda.valor.toNumber(),
      emenda.andamentos.map((a) => ({ etapa: a.etapa, valor: a.valor.toNumber() })),
      { etapa: p.data.etapa, valor: p.data.valor }
    );
    if (recusa) return { ok: false as const, erro: recusa };
    const andamento = await tx.andamentoExecucao.create({
      data: {
        emendaId: emenda.id,
        etapa: p.data.etapa,
        data,
        valor: p.data.valor,
        numeroDocumento: p.data.numeroDocumento || null,
        observacao: p.data.observacao || null,
        usuarioId: user.id,
      },
    });
    await registrarAuditoria({
      usuarioId: user.id,
      entidade: "AndamentoExecucao",
      entidadeId: andamento.id,
      acao: "CRIAR",
      dadosDepois: { emenda: emenda.numero, etapa: andamento.etapa, valor: andamento.valor, documento: andamento.numeroDocumento },
    });
    revalidatePath("/executivo/execucao");
    revalidatePath(`/emendas/${emenda.id}`);
    return { ok: true as const };
  });
}
