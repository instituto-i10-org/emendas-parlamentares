"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditar } from "@/lib/audit";
import { podeGerirPlanejamento } from "@/lib/authz";
import { recusaPorImpacto } from "@/lib/impacto/servidor";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { dadosComparativo } from "@/lib/orcamento/comparativo-servidor";
import { leiDoProjeto } from "@/lib/orcamento/comparativo";

type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

// Ciclo de vida dos instrumentos: só avança (ou volta um passo, para corrigir).
const SEQUENCIA = ["EM_ELABORACAO", "ENVIADO", "EM_TRAMITACAO", "APROVADO", "SANCIONADO", "VIGENTE", "ENCERRADO"] as const;
type Status = (typeof SEQUENCIA)[number];

export async function definirStatusInstrumento(id: string, status: Status, ciente = false): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirPlanejamento(user)) return { ok: false, erro: "Sem permissão para gerir o planejamento." };
  const inst = await prisma.instrumentoPlanejamento.findUnique({ where: { id } });
  if (!inst) return { ok: false, erro: "Instrumento não encontrado." };
  const de = SEQUENCIA.indexOf(inst.status as Status);
  const para = SEQUENCIA.indexOf(status);
  if (para < 0 || Math.abs(para - de) !== 1) return { ok: false, erro: "O status só avança ou volta um passo por vez." };
  const recusa = await recusaPorImpacto({ tipo: "statusInstrumento", id, status }, ciente);
  if (recusa) return { ok: false, erro: recusa };
  await prisma.$transaction(async (tx) => {
    await tx.instrumentoPlanejamento.update({ where: { id }, data: { status } });
    await auditar(tx, { usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: id, acao: "STATUS", dadosAntes: { status: inst.status }, dadosDepois: { status } });
  });
  revalidatePath("/executivo/planejamento");
  revalidatePath("/emendas");
  return { ok: true };
}

const dataOpcional = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional();

const instrumentoSchema = z.object({
  exercicioId: z.string().min(1),
  tipo: z.enum(["PPA", "LDO", "LOA"]),
  especie: z.enum(["PROJETO_LEI", "LEI_APROVADA"]),
  numero: z.string().trim().min(2, "Informe o número.").max(60),
  ementa: z.string().trim().min(5, "Informe a ementa.").max(1000),
  instrumentoOrigemId: z.string().optional(),
  arquivoId: z.string().max(40).nullable().optional(),
  data: dataOpcional,
  totalImpresso: z.number().nonnegative().max(1e13).nullable().optional(),
});

const paraData = (d?: string) => (d ? new Date(`${d}T12:00:00Z`) : null);

// A lei aprovada se liga ao projeto de lei de origem: mesmo tipo (LOA com LOA)
// e mesmo exercício.
async function conferirOrigem(exercicioId: string, tipo: string, origemId: string | undefined): Promise<string | null> {
  if (!origemId) return "Indique o projeto de lei de origem.";
  const o = await prisma.instrumentoPlanejamento.findUnique({ where: { id: origemId } });
  if (!o || o.especie !== "PROJETO_LEI") return "A origem precisa ser um projeto de lei.";
  if (o.tipo !== tipo) return `A origem precisa ser um projeto de ${tipo}.`;
  if (o.exercicioId !== exercicioId) return "A origem precisa ser do mesmo exercício.";
  return null;
}

async function conferirArquivoDaPeca(arquivoId: string | null | undefined): Promise<string | null> {
  if (!arquivoId) return null;
  const a = await prisma.arquivo.findUnique({ where: { id: arquivoId } });
  return !a || a.uso !== "PECA_ORCAMENTARIA" ? "Arquivo da peça inválido. Envie o PDF de novo." : null;
}

export async function criarInstrumento(entrada: z.input<typeof instrumentoSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirPlanejamento(user)) return { ok: false, erro: "Sem permissão para gerir o planejamento." };
  const p = instrumentoSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const lei = p.data.especie === "LEI_APROVADA";
  const erroOrigem = lei ? await conferirOrigem(p.data.exercicioId, p.data.tipo, p.data.instrumentoOrigemId) : null;
  if (erroOrigem) return { ok: false, erro: erroOrigem };
  const erroArquivo = await conferirArquivoDaPeca(p.data.arquivoId);
  if (erroArquivo) return { ok: false, erro: erroArquivo };
  const data = paraData(p.data.data);
  await prisma.$transaction(async (tx) => {
    const inst = await tx.instrumentoPlanejamento.create({
      data: {
        exercicioId: p.data.exercicioId,
        tipo: p.data.tipo,
        especie: p.data.especie,
        numero: p.data.numero,
        ementa: p.data.ementa,
        arquivoId: p.data.arquivoId ?? null,
        totalImpresso: p.data.totalImpresso ?? null,
        status: lei ? "SANCIONADO" : "EM_ELABORACAO",
        instrumentoOrigemId: lei ? p.data.instrumentoOrigemId : null,
        dataEnvio: lei ? null : data,
        dataAprovacao: lei ? data : null,
      },
    });
    // A peça orçamentária é pública: o portal e o manual podem apontá-la.
    if (p.data.arquivoId) await tx.arquivo.update({ where: { id: p.data.arquivoId }, data: { publico: true } });
    await auditar(tx, { usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: inst.id, acao: "CRIAR", dadosDepois: inst });
  });
  revalidatePath("/executivo/planejamento");
  return { ok: true, mensagem: "Instrumento cadastrado." };
}

const edicaoSchema = instrumentoSchema.omit({ exercicioId: true, tipo: true, especie: true }).extend({ id: z.string().min(1).max(40) });

export async function editarInstrumento(entrada: z.input<typeof edicaoSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirPlanejamento(user)) return { ok: false, erro: "Sem permissão para gerir o planejamento." };
  const p = edicaoSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const antes = await prisma.instrumentoPlanejamento.findUnique({ where: { id: p.data.id } });
  if (!antes) return { ok: false, erro: "Instrumento não encontrado." };
  const lei = antes.especie === "LEI_APROVADA";
  const erroOrigem = lei ? await conferirOrigem(antes.exercicioId, antes.tipo, p.data.instrumentoOrigemId) : null;
  if (erroOrigem) return { ok: false, erro: erroOrigem };
  const erroArquivo = await conferirArquivoDaPeca(p.data.arquivoId);
  if (erroArquivo) return { ok: false, erro: erroArquivo };
  const data = paraData(p.data.data);
  await prisma.$transaction(async (tx) => {
    const depois = await tx.instrumentoPlanejamento.update({
      where: { id: antes.id },
      data: {
        numero: p.data.numero,
        ementa: p.data.ementa,
        arquivoId: p.data.arquivoId ?? null,
        totalImpresso: p.data.totalImpresso ?? null,
        instrumentoOrigemId: lei ? p.data.instrumentoOrigemId : null,
        ...(lei ? { dataAprovacao: data } : { dataEnvio: data }),
      },
    });
    if (p.data.arquivoId) await tx.arquivo.update({ where: { id: p.data.arquivoId }, data: { publico: true } });
    await auditar(tx, { usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: antes.id, acao: "ATUALIZAR", dadosAntes: antes, dadosDepois: depois });
  });
  revalidatePath("/executivo/planejamento");
  return { ok: true, mensagem: "Instrumento atualizado." };
}

// Só sai instrumento sem dotações, sem emendas e sem lei derivada.
export async function excluirInstrumento(id: string): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirPlanejamento(user)) return { ok: false, erro: "Sem permissão para gerir o planejamento." };
  const inst = await prisma.instrumentoPlanejamento.findUnique({
    where: { id },
    include: { _count: { select: { dotacoes: true, derivados: true } } },
  });
  if (!inst) return { ok: false, erro: "Instrumento não encontrado." };
  if (inst._count.dotacoes) return { ok: false, erro: `O instrumento tem ${inst._count.dotacoes} dotações na base: não pode ser excluído.` };
  if (inst._count.derivados) return { ok: false, erro: "Há lei aprovada vinculada a este projeto: exclua a lei antes." };
  await prisma.$transaction(async (tx) => {
    await tx.instrumentoPlanejamento.delete({ where: { id } });
    await auditar(tx, { usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: id, acao: "EXCLUIR", dadosAntes: inst });
  });
  revalidatePath("/executivo/planejamento");
  return { ok: true, mensagem: "Instrumento excluído." };
}


// Base da lei aprovada gerada do projeto mais as emendas incorporadas, para
// quando a lei ainda não foi importada. Cria o instrumento "lei aprovada" com
// uma dotação para cada dotação do projeto.
export async function gerarLeiDoProjeto(ano: number): Promise<{ ok: true; mensagem: string } | { ok: false; erro: string }> {
  const user = await getCurrentUser();
  if (!podeGerirPlanejamento(user)) return { ok: false, erro: "Sem permissão para gerir o planejamento." };
  const dados = await dadosComparativo(ano);
  if (!dados?.projeto) return { ok: false, erro: "O exercício não tem projeto de lei com base carregada." };
  if (dados.temLei) return { ok: false, erro: "A lei aprovada já tem base. Para refazer, use a importação." };
  const valores = new Map(leiDoProjeto(dados.pl, dados.emendas).map((x) => [x.id, x.valor]));
  const origem = await prisma.dotacao.findMany({ where: { instrumentoId: dados.projeto.id, ativo: true } });
  const lei = await prisma.$transaction(async (tx) => {
    const lei =
      dados.lei ??
      (await tx.instrumentoPlanejamento.create({
        data: {
          tipo: "LOA",
          especie: "LEI_APROVADA",
          numero: `${dados.projeto!.numero} (lei gerada)`,
          ementa: `Gerada do ${dados.projeto!.numero} com ${dados.emendas.length} emenda(s) incorporada(s).`,
          exercicioId: dados.exercicioId,
          status: "APROVADO",
          instrumentoOrigemId: dados.projeto!.id,
        },
      }));
    await tx.dotacao.createMany({
      data: origem.map((d) => ({
        instrumentoId: lei.id,
        exercicioId: d.exercicioId,
        codigo: d.codigo,
        ficha: d.ficha,
        orgaoId: d.orgaoId,
        unidadeOrcamentariaId: d.unidadeOrcamentariaId,
        funcaoId: d.funcaoId,
        subfuncaoId: d.subfuncaoId,
        programaId: d.programaId,
        acaoId: d.acaoId,
        naturezaDespesaId: d.naturezaDespesaId,
        fonteRecursoId: d.fonteRecursoId,
        valorAutorizado: valores.get(d.id) ?? d.valorAutorizado.toNumber(),
        ordem: d.ordem,
      })),
    });
    await auditar(tx, { usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: lei.id, acao: "GERAR_LEI_DO_PROJETO", dadosDepois: { dotacoes: origem.length, emendas: dados.emendas.length } });
    return lei;
  });
  revalidatePath("/comparativo");
  revalidatePath("/executivo/planejamento");
  return { ok: true, mensagem: `Lei gerada (${lei.numero}): ${origem.length} dotações, ${dados.emendas.length} emenda(s) incorporada(s).` };
}
