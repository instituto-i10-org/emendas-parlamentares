"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { z } from "zod";
import { auditar, registrarAuditoria } from "@/lib/audit";
import { podeGerirPlanejamento } from "@/lib/authz";
import { codigosDeExibicao } from "@/lib/orcamento/codigo-dotacao";
import { validarLinhas, type ErroLinha } from "@/lib/orcamento/importacao";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

// Ciclo de vida dos instrumentos: só avança (ou volta um passo, para corrigir).
const SEQUENCIA = ["EM_ELABORACAO", "ENVIADO", "EM_TRAMITACAO", "APROVADO", "SANCIONADO", "VIGENTE", "ENCERRADO"] as const;
type Status = (typeof SEQUENCIA)[number];

export async function definirStatusInstrumento(id: string, status: Status): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirPlanejamento(user)) return { ok: false, erro: "Sem permissão para gerir o planejamento." };
  const inst = await prisma.instrumentoPlanejamento.findUnique({ where: { id } });
  if (!inst) return { ok: false, erro: "Instrumento não encontrado." };
  const de = SEQUENCIA.indexOf(inst.status as Status);
  const para = SEQUENCIA.indexOf(status);
  if (para < 0 || Math.abs(para - de) !== 1) return { ok: false, erro: "O status só avança ou volta um passo por vez." };
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

// Importa (ou reimporta) a base de dotações de um instrumento a partir de
// planilha. Tudo ou nada: qualquer erro rejeita o arquivo inteiro.
export async function importarBase(
  instrumentoId: string,
  formData: FormData
): Promise<{ ok: true; mensagem: string } | { ok: false; erro: string; erros?: ErroLinha[] }> {
  const user = await getCurrentUser();
  if (!podeGerirPlanejamento(user)) return { ok: false, erro: "Sem permissão para gerir o planejamento." };
  if (!(await rateLimit(`importacao:${user.id}`, 10, 60_000))) return { ok: false, erro: "Muitas importações seguidas. Aguarde um minuto." };
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size) return { ok: false, erro: "Escolha o arquivo." };
  if (!/\.(csv|xlsx|xls)$/i.test(arquivo.name)) return { ok: false, erro: "Use CSV ou XLSX." };
  if (arquivo.size > 10 * 1024 * 1024) return { ok: false, erro: "Arquivo acima de 10 MB." };
  const inst = await prisma.instrumentoPlanejamento.findUnique({ where: { id: instrumentoId } });
  if (!inst) return { ok: false, erro: "Instrumento não encontrado." };

  const livro = XLSX.read(Buffer.from(await arquivo.arrayBuffer()), { type: "buffer", raw: false });
  const aba = livro.SheetNames.find((n) => /dota[cç](ao|oes|ões)|base/i.test(n)) ?? livro.SheetNames[0];
  const linhas = XLSX.utils.sheet_to_json<Record<string, string>>(livro.Sheets[aba], { defval: "", raw: false });
  const { dotacoes, erros } = validarLinhas(linhas);
  if (erros.length) return { ok: false, erro: `${erros.length} erro(s) na planilha. Nada foi importado.`, erros: erros.slice(0, 50) };

  const exercicioId = inst.exercicioId;
  const codigos = codigosDeExibicao(
    dotacoes.map((d) => ({ actionCode: d.acao.codigo, elem: d.natureza.elemento, ficha: d.ficha ?? "", pagina: d.pagina ?? 0 })),
    new Set()
  );
  await prisma.$transaction(
    async (tx) => {
      const cache = new Map<string, string>();
      const uma = async (chave: string, fn: () => Promise<{ id: string }>) => {
        const achado = cache.get(chave);
        if (achado) return achado;
        const { id } = await fn();
        cache.set(chave, id);
        return id;
      };
      await tx.dotacao.deleteMany({ where: { instrumentoId, emendas: { none: {} } } });
      for (let i = 0; i < dotacoes.length; i++) {
        const d = dotacoes[i];
        const orgaoId = await uma(`o:${d.orgao.codigo}`, () =>
          tx.orgao.upsert({ where: { exercicioId_codigo: { exercicioId, codigo: d.orgao.codigo } }, update: { nome: d.orgao.nome }, create: { exercicioId, ...d.orgao } })
        );
        const unidadeId = await uma(`u:${d.unidade.codigo}`, () =>
          tx.unidadeOrcamentaria.upsert({
            where: { exercicioId_codigo: { exercicioId, codigo: d.unidade.codigo } },
            update: { nome: d.unidade.nome, orgaoId },
            create: { exercicioId, orgaoId, ...d.unidade },
          })
        );
        const funcaoId = await uma(`f:${d.funcao.codigo}`, () =>
          tx.funcao.upsert({
            where: { exercicioId_codigo: { exercicioId, codigo: d.funcao.codigo } },
            update: d.funcao.nome ? { nome: d.funcao.nome } : {},
            create: { exercicioId, codigo: d.funcao.codigo, nome: d.funcao.nome ?? `Função ${d.funcao.codigo}` },
          })
        );
        const subfuncaoId = await uma(`s:${d.funcao.codigo}.${d.subfuncao.codigo}`, () =>
          tx.subfuncao.upsert({
            where: { exercicioId_funcaoId_codigo: { exercicioId, funcaoId, codigo: d.subfuncao.codigo } },
            update: { nome: d.subfuncao.nome },
            create: { exercicioId, funcaoId, ...d.subfuncao },
          })
        );
        const programaId = await uma(`p:${d.programa.codigo}`, () =>
          tx.programa.upsert({ where: { exercicioId_codigo: { exercicioId, codigo: d.programa.codigo } }, update: { nome: d.programa.nome }, create: { exercicioId, ...d.programa } })
        );
        const acaoId = await uma(`a:${d.programa.codigo}|${d.acao.codigo}`, () =>
          tx.acao.upsert({
            where: { exercicioId_programaId_codigo: { exercicioId, programaId, codigo: d.acao.codigo } },
            update: { nome: d.acao.nome, tipo: d.acao.tipo },
            create: { exercicioId, programaId, ...d.acao },
          })
        );
        const naturezaDespesaId = await uma(`n:${d.natureza.codigo}`, () =>
          tx.naturezaDespesa.upsert({
            where: { exercicioId_codigo: { exercicioId, codigo: d.natureza.codigo } },
            update: d.natureza.nome ? { nome: d.natureza.nome } : {},
            create: {
              exercicioId,
              codigo: d.natureza.codigo,
              categoriaEconomica: d.natureza.categoria,
              grupo: d.natureza.grupo,
              modalidadeAplicacao: d.natureza.modalidade,
              elemento: d.natureza.elemento,
              nome: d.natureza.nome,
            },
          })
        );
        const fonteRecursoId = await uma(`r:${d.fonte.codigo}`, () =>
          tx.fonteRecurso.upsert({ where: { exercicioId_codigo: { exercicioId, codigo: d.fonte.codigo } }, update: { nome: d.fonte.nome }, create: { exercicioId, ...d.fonte } })
        );
        const dados = {
          exercicioId,
          orgaoId,
          unidadeOrcamentariaId: unidadeId,
          funcaoId,
          subfuncaoId,
          programaId,
          acaoId,
          naturezaDespesaId,
          fonteRecursoId,
          ficha: d.ficha,
          valorAutorizado: d.valor,
          paginaFonte: d.pagina,
          ordem: i,
        };
        await tx.dotacao.upsert({
          where: { instrumentoId_codigo: { instrumentoId, codigo: codigos[i] } },
          update: dados,
          create: { ...dados, instrumentoId, codigo: codigos[i] },
        });
      }
    },
    { timeout: 120_000 }
  );
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "InstrumentoPlanejamento",
    entidadeId: instrumentoId,
    acao: "IMPORTAR_BASE",
    dadosDepois: { arquivo: arquivo.name, dotacoes: dotacoes.length },
  });
  revalidatePath("/executivo/planejamento");
  return { ok: true, mensagem: `${dotacoes.length} dotação(ões) importada(s).` };
}
