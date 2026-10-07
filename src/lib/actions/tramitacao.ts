"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditar, registrarAuditoria } from "@/lib/audit";
import { podeAnalisarViabilidade, podeRegistrarExecucao, podeTramitar } from "@/lib/authz";
import { conferirLancamento } from "@/lib/emendas/execucao";
import { mudarSituacao } from "@/lib/emendas/historico";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { naoRemetida } from "@/lib/emendas/situacoes";

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
  if (emenda.status !== "SUBMETIDA" && emenda.status !== "EM_TRAMITACAO") return { ok: false, erro: "Apenas emendas remetidas ou em tramitação podem ser decididas." };
  await prisma.$transaction(async (tx) => {
    const salvo = await mudarSituacao(tx, {
      emendaId: emenda.id,
      de: emenda.status,
      para: p.data.decisao,
      usuarioId: user.id,
      texto: p.data.parecer,
      dados: { parecerTramitacao: p.data.parecer, tramitadaEm: new Date(), tramitadaPor: { connect: { id: user.id } } },
    });
    await auditar(tx, {
      usuarioId: user.id,
      entidade: "Emenda",
      entidadeId: emenda.id,
      acao: p.data.decisao === "APROVADA" ? "APROVAR" : "REJEITAR",
      dadosAntes: { status: emenda.status, parecer: emenda.parecerTramitacao },
      dadosDepois: { status: salvo.status, parecer: salvo.parecerTramitacao },
    });
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
  if (emenda.status !== "SUBMETIDA" && emenda.status !== "EM_TRAMITACAO") return { ok: false, erro: "Só emendas na fila da Comissão vão para diligência." };
  const ate = new Date();
  ate.setUTCDate(ate.getUTCDate() + p.data.dias);
  await prisma.$transaction(async (tx) => {
    await mudarSituacao(tx, {
      emendaId: emenda.id,
      de: emenda.status,
      para: "EM_DILIGENCIA",
      usuarioId: user.id,
      texto: p.data.motivo,
      dados: { diligenciaMotivo: p.data.motivo, diligenciaAte: ate, diligenciaEm: new Date(), reenviadaEm: null },
    });
    await auditar(tx, {
      usuarioId: user.id,
      entidade: "Emenda",
      entidadeId: emenda.id,
      acao: "PEDIR_DILIGENCIA",
      dadosAntes: { status: emenda.status, diligenciaMotivo: emenda.diligenciaMotivo, diligenciaAte: emenda.diligenciaAte },
      dadosDepois: { status: "EM_DILIGENCIA", diligenciaMotivo: p.data.motivo, diligenciaAte: ate, dias: p.data.dias },
    });
  });
  revalidatePath("/tramitacao");
  revalidatePath("/emendas");
  revalidatePath(`/emendas/${emenda.id}`);
  return { ok: true };
}

// Recebimento pela Comissão: a emenda remetida passa a "em tramitação".
export async function receberEmenda(emendaId: string): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeTramitar(user)) return { ok: false, erro: "Sem permissão para tramitar emendas." };
  const emenda = await prisma.emenda.findUnique({ where: { id: emendaId } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (emenda.status !== "SUBMETIDA") return { ok: false, erro: "Só a emenda remetida é recebida." };
  await prisma.$transaction(async (tx) => {
    await mudarSituacao(tx, { emendaId, de: "SUBMETIDA", para: "EM_TRAMITACAO", usuarioId: user.id, texto: "Recebida pela Comissão." });
    await auditar(tx, { usuarioId: user.id, entidade: "Emenda", entidadeId: emendaId, acao: "RECEBER", dadosAntes: { status: "SUBMETIDA" }, dadosDepois: { status: "EM_TRAMITACAO" } });
  });
  revalidatePath("/tramitacao");
  revalidatePath(`/emendas/${emendaId}`);
  return { ok: true };
}

// Saneamento: a análise técnica devolve ao autor a emenda inválida, com o
// apontamento por escrito. Ela volta a rascunho; o texto fica no histórico e
// aparece no editor do autor. Emenda já remetida vai pela diligência.
export async function devolverAoAutor(emendaId: string, texto: string): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeTramitar(user)) return { ok: false, erro: "Sem permissão para tramitar emendas." };
  const t = String(texto ?? "").trim();
  if (t.length < 20) return { ok: false, erro: "Escreva o que o autor precisa corrigir (ao menos 20 caracteres)." };
  if (t.length > 4000) return { ok: false, erro: "Texto longo demais (até 4.000 caracteres)." };
  const emenda = await prisma.emenda.findUnique({ where: { id: emendaId } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (emenda.status !== "INVALIDA") return { ok: false, erro: "Só a emenda inválida volta ao autor por aqui; a remetida vai pela diligência." };
  await prisma.$transaction(async (tx) => {
    await mudarSituacao(tx, { emendaId, de: "INVALIDA", para: "RASCUNHO", usuarioId: user.id, texto: `Devolvida ao autor: ${t}` });
    await auditar(tx, { usuarioId: user.id, entidade: "Emenda", entidadeId: emendaId, acao: "DEVOLVER_AO_AUTOR", dadosAntes: { status: "INVALIDA" }, dadosDepois: { status: "RASCUNHO", texto: t } });
  });
  revalidatePath("/tramitacao");
  return { ok: true };
}

// Incorporação ao texto da lei aprovada: marcada uma a uma, com data e quem.
// Só a emenda aprovada pela Comissão é incorporada.
export async function marcarIncorporada(emendaId: string, incorporada: boolean): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeTramitar(user)) return { ok: false, erro: "Sem permissão para tramitar emendas." };
  const emenda = await prisma.emenda.findUnique({ where: { id: emendaId } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (incorporada && emenda.status !== "APROVADA") return { ok: false, erro: "Só a emenda aprovada é incorporada à lei." };
  const lei = incorporada
    ? await prisma.instrumentoPlanejamento.findFirst({ where: { exercicioId: emenda.exercicioId, tipo: "LOA", especie: "LEI_APROVADA" }, orderBy: { createdAt: "desc" } })
    : null;
  await prisma.$transaction(async (tx) => {
    const depois = await tx.emenda.update({
      where: { id: emendaId },
      data: incorporada
        ? { incorporadaEm: new Date(), incorporadaPorId: user.id, incorporadaLeiId: lei?.id ?? null }
        : { incorporadaEm: null, incorporadaPorId: null, incorporadaLeiId: null },
    });
    await tx.historicoEmenda.create({
      data: { emendaId, de: emenda.status, para: emenda.status, usuarioId: user.id, texto: incorporada ? `Incorporada à lei${lei?.numero ? ` ${lei.numero}` : ""}.` : "Incorporação à lei desfeita." },
    });
    await auditar(tx, {
      usuarioId: user.id,
      entidade: "Emenda",
      entidadeId: emendaId,
      acao: incorporada ? "INCORPORAR_LEI" : "DESFAZER_INCORPORACAO",
      dadosAntes: { incorporadaEm: emenda.incorporadaEm, incorporadaLeiId: emenda.incorporadaLeiId },
      dadosDepois: { incorporadaEm: depois.incorporadaEm, incorporadaLeiId: depois.incorporadaLeiId },
    });
  });
  revalidatePath("/tramitacao");
  revalidatePath(`/emendas/${emendaId}`);
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
  await prisma.$transaction(async (tx) => {
    await mudarSituacao(tx, {
      emendaId,
      de: emenda.status,
      para: "SUBMETIDA",
      usuarioId: user.id,
      texto: `Reaberta: ${motivo.trim()}`,
      dados: { parecerTramitacao: null, tramitadaEm: null, tramitadaPor: { disconnect: true } },
    });
    await auditar(tx, {
      usuarioId: user.id,
      entidade: "Emenda",
      entidadeId: emendaId,
      acao: "REABRIR_TRAMITACAO",
      dadosAntes: { status: emenda.status, parecer: emenda.parecerTramitacao, tramitadaEm: emenda.tramitadaEm },
      dadosDepois: { status: "SUBMETIDA", parecer: null, tramitadaEm: null, motivo: motivo.trim() },
    });
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
  if (naoRemetida(emenda.status)) return { ok: false, erro: "A emenda ainda não foi submetida: não cabe parecer nesta fase." };
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
    await auditar(tx, {
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
