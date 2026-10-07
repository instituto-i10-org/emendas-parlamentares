"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/audit";
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
  await prisma.instrumentoPlanejamento.update({ where: { id }, data: { status } });
  await registrarAuditoria({ usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: id, acao: "STATUS", dadosAntes: { status: inst.status }, dadosDepois: { status } });
  revalidatePath("/executivo/planejamento");
  return { ok: true };
}

const instrumentoSchema = z.object({
  exercicioId: z.string().min(1),
  tipo: z.enum(["PPA", "LDO", "LOA"]),
  especie: z.enum(["PROJETO_LEI", "LEI_APROVADA"]),
  numero: z.string().trim().min(2, "Informe o número.").max(60),
  ementa: z.string().trim().min(5, "Informe a ementa.").max(1000),
  instrumentoOrigemId: z.string().optional(),
  arquivoUrl: z.union([z.literal(""), z.url("Link inválido.")]).optional(),
  data: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
});

export async function criarInstrumento(entrada: z.input<typeof instrumentoSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!podeGerirPlanejamento(user)) return { ok: false, erro: "Sem permissão para gerir o planejamento." };
  const p = instrumentoSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: p.error.issues[0]?.message ?? "Dados inválidos." };
  const lei = p.data.especie === "LEI_APROVADA";
  if (lei && !p.data.instrumentoOrigemId) return { ok: false, erro: "Indique o projeto de lei de origem." };
  const data = p.data.data ? new Date(`${p.data.data}T12:00:00Z`) : null;
  const inst = await prisma.instrumentoPlanejamento.create({
    data: {
      exercicioId: p.data.exercicioId,
      tipo: p.data.tipo,
      especie: p.data.especie,
      numero: p.data.numero,
      ementa: p.data.ementa,
      arquivoUrl: p.data.arquivoUrl || null,
      status: lei ? "SANCIONADO" : "EM_ELABORACAO",
      instrumentoOrigemId: lei ? p.data.instrumentoOrigemId : null,
      dataEnvio: lei ? null : data,
      dataAprovacao: lei ? data : null,
    },
  });
  await registrarAuditoria({ usuarioId: user.id, entidade: "InstrumentoPlanejamento", entidadeId: inst.id, acao: "CRIAR", dadosDepois: inst });
  revalidatePath("/executivo/planejamento");
  return { ok: true, mensagem: "Instrumento cadastrado." };
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
