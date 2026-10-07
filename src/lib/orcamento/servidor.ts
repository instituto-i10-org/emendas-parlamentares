import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { lerBuffer } from "@/lib/arquivos/armazenamento";
import { prisma } from "@/lib/prisma";
import { codigosDeExibicao } from "./codigo-dotacao";
import { aplicarMapa, type TipoCarga } from "./colunas";
import {
  planejarRecarga,
  validarDotacao,
  validarPrioridade,
  validarProgramaPpa,
  type BaseExistente,
  type DotacaoExistente,
  type LinhaDotacao,
  type LinhaPrioridade,
  type LinhaProgramaPpa,
  type PlanoRecarga,
} from "./importacao";
import { lerPlanilha } from "./planilha";

// ============================================================================
// Parte da importação que fala com o banco: a base existente do exercício, a
// validação das linhas guardadas e a gravação confirmada.
// ============================================================================

export async function baseDoExercicio(exercicioId: string): Promise<BaseExistente> {
  const [orgaos, unidades, programas, acoes] = await Promise.all([
    prisma.orgao.findMany({ where: { exercicioId }, select: { codigo: true, nome: true } }),
    prisma.unidadeOrcamentaria.findMany({ where: { exercicioId }, select: { codigo: true, nome: true } }),
    prisma.programa.findMany({ where: { exercicioId }, select: { codigo: true, nome: true } }),
    prisma.acao.findMany({ where: { exercicioId }, select: { codigo: true, nome: true, programa: { select: { codigo: true } } } }),
  ]);
  return {
    orgaos: Object.fromEntries(orgaos.map((x) => [x.codigo, x.nome])),
    unidades: Object.fromEntries(unidades.map((x) => [x.codigo, x.nome])),
    programas: Object.fromEntries(programas.map((x) => [x.codigo, x.nome])),
    acoes: Object.fromEntries(acoes.map((x) => [`${x.programa.codigo}|${x.codigo}`, x.nome])),
  };
}

export function validarCampos(tipo: TipoCarga, campos: Record<string, string>, base: BaseExistente) {
  if (tipo === "DOTACOES") return validarDotacao(campos, base);
  if (tipo === "PRIORIDADES_LDO") return validarPrioridade(campos, base);
  return validarProgramaPpa(campos, base);
}

// Planilha guardada → linhas da importação, já validadas.
export async function linhasDaPlanilha(imp: { id: string; tipoCarga: TipoCarga; arquivo: { chave: string; nome: string } }, mapa: Record<string, number>, base: BaseExistente) {
  const bytes = new Uint8Array(await lerBuffer(imp.arquivo.chave));
  const p = lerPlanilha(imp.tipoCarga, imp.arquivo.nome, bytes);
  return p.linhas.map((l) => {
    const campos = aplicarMapa(l.celulas, mapa);
    const r = validarCampos(imp.tipoCarga, campos, base);
    return { importacaoId: imp.id, numero: l.numero, campos, motivos: r.ok ? [] : r.motivos };
  });
}

export type Validadas = {
  dotacoes: { linhaId: string; numero: number; valor: LinhaDotacao }[];
  prioridades: { linhaId: string; valor: LinhaPrioridade }[];
  programas: { linhaId: string; valor: LinhaProgramaPpa }[];
  recusadas: number;
};

// Revalida todas as linhas guardadas (o que vale é o estado de agora).
export async function revalidar(importacaoId: string, tipo: TipoCarga, base: BaseExistente): Promise<Validadas> {
  const linhas = await prisma.linhaImportada.findMany({ where: { importacaoId }, orderBy: [{ pagina: "asc" }, { numero: "asc" }] });
  const v: Validadas = { dotacoes: [], prioridades: [], programas: [], recusadas: 0 };
  for (const l of linhas) {
    const r = validarCampos(tipo, l.campos as Record<string, string>, base);
    if (!r.ok) {
      v.recusadas++;
      continue;
    }
    if (tipo === "DOTACOES") v.dotacoes.push({ linhaId: l.id, numero: l.numero, valor: r.valor as LinhaDotacao });
    else if (tipo === "PRIORIDADES_LDO") v.prioridades.push({ linhaId: l.id, valor: r.valor as LinhaPrioridade });
    else v.programas.push({ linhaId: l.id, valor: r.valor as LinhaProgramaPpa });
  }
  return v;
}

export async function existentesDoInstrumento(instrumentoId: string): Promise<DotacaoExistente[]> {
  const dots = await prisma.dotacao.findMany({
    where: { instrumentoId, ativo: true },
    include: {
      unidadeOrcamentaria: { select: { codigo: true } },
      programa: { select: { codigo: true } },
      acao: { select: { codigo: true } },
      naturezaDespesa: { select: { codigo: true } },
      fonteRecurso: { select: { codigo: true } },
      emendas: { select: { numero: true, status: true } },
    },
  });
  return dots.map((d) => ({
    id: d.id,
    unidade: d.unidadeOrcamentaria.codigo,
    programa: d.programa.codigo,
    acao: d.acao.codigo,
    natureza: d.naturezaDespesa.codigo,
    fonte: d.fonteRecurso.codigo,
    ficha: d.ficha,
    valor: d.valorAutorizado.toNumber(),
    emendas: d.emendas.map((e) => (e.numero ? `nº ${e.numero}` : "rascunho")),
  }));
}

// Gravação das dotações conforme o plano de recarga: atualiza no lugar (o id
// fica, e com ele as emendas), cria o que é novo e desativa o que saiu.
export async function gravarDotacoes(tx: Prisma.TransactionClient, instrumentoId: string, exercicioId: string, linhas: LinhaDotacao[], plano: PlanoRecarga) {
  const cache = new Map<string, string>();
  const uma = async (chave: string, fn: () => Promise<{ id: string }>) => {
    const achado = cache.get(chave);
    if (achado) return achado;
    const { id } = await fn();
    cache.set(chave, id);
    return id;
  };
  const codigos = codigosDeExibicao(
    linhas.map((d) => ({ actionCode: d.acao.codigo, elem: d.natureza.elemento, ficha: d.ficha ?? "", pagina: d.pagina ?? 0 })),
    new Set()
  );
  // Códigos provisórios: os novos não podem colidir com os antigos no índice único.
  const doInstrumento = await tx.dotacao.findMany({ where: { instrumentoId }, select: { id: true } });
  for (const d of doInstrumento) await tx.dotacao.update({ where: { id: d.id }, data: { codigo: `~${d.id}` } });

  const componentes = async (d: LinhaDotacao) => {
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
      tx.funcao.upsert({ where: { exercicioId_codigo: { exercicioId, codigo: d.funcao.codigo } }, update: { nome: d.funcao.nome }, create: { exercicioId, ...d.funcao } })
    );
    const subfuncaoId = await uma(`s:${d.funcao.codigo}.${d.subfuncao.codigo}`, () =>
      tx.subfuncao.upsert({
        where: { exercicioId_funcaoId_codigo: { exercicioId, funcaoId, codigo: d.subfuncao.codigo } },
        update: { nome: d.subfuncao.nome },
        create: { exercicioId, funcaoId, ...d.subfuncao },
      })
    );
    const programaId = await uma(`p:${d.programa.codigo}`, () =>
      tx.programa.upsert({
        where: { exercicioId_codigo: { exercicioId, codigo: d.programa.codigo } },
        // Nome provisório ("Programa 0009") não apaga o nome já conhecido.
        update: /^Programa \d+$/.test(d.programa.nome) ? {} : { nome: d.programa.nome },
        create: { exercicioId, ...d.programa },
      })
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
    return { orgaoId, unidadeOrcamentariaId: unidadeId, funcaoId, subfuncaoId, programaId, acaoId, naturezaDespesaId, fonteRecursoId };
  };

  const idPorIndice = new Map(plano.atualizar.map((a) => [a.indice, a.id]));
  for (let i = 0; i < linhas.length; i++) {
    const d = linhas[i];
    const dados = {
      exercicioId,
      ...(await componentes(d)),
      ficha: d.ficha,
      valorAutorizado: d.valor,
      paginaFonte: d.pagina,
      ordem: i,
      ativo: true,
      codigo: codigos[i],
    };
    const id = idPorIndice.get(i);
    if (id) await tx.dotacao.update({ where: { id }, data: dados });
    else await tx.dotacao.create({ data: { ...dados, instrumentoId } });
  }
  for (const id of plano.desativar) {
    await tx.dotacao.update({ where: { id }, data: { ativo: false, codigo: `~inativo-${id}` } });
  }
}

// Prioridades da LDO: a carga substitui as do mesmo instrumento.
export async function gravarPrioridades(tx: Prisma.TransactionClient, instrumentoId: string, exercicioId: string, linhas: LinhaPrioridade[]) {
  const programas = new Map((await tx.programa.findMany({ where: { exercicioId } })).map((p) => [p.codigo, p.id]));
  const acoes = new Map((await tx.acao.findMany({ where: { exercicioId }, include: { programa: true } })).map((a) => [`${a.programa.codigo}|${a.codigo}`, a.id]));
  await tx.prioridadeLdo.deleteMany({ where: { instrumentoId } });
  await tx.prioridadeLdo.createMany({
    data: linhas.map((l) => ({
      exercicioId,
      instrumentoId,
      programaId: programas.get(l.programa)!,
      acaoId: l.acao ? acoes.get(`${l.programa}|${l.acao}`) ?? null : null,
      descricao: l.descricao,
      meta: l.meta,
      unidadeMedida: l.unidadeMedida,
    })),
  });
}

// Programas do PPA: marcam constaNoPPA (e só os da carga ficam marcados),
// completam o nome e gravam a meta da ação nas unidades que a executam.
export async function gravarProgramasPpa(tx: Prisma.TransactionClient, exercicioId: string, linhas: LinhaProgramaPpa[], nota: string) {
  const codigos = new Set(linhas.map((l) => l.programa.codigo));
  await tx.programa.updateMany({ where: { exercicioId, codigo: { notIn: [...codigos] } }, data: { constaNoPPA: false } });
  for (const l of linhas) {
    await tx.programa.upsert({
      where: { exercicioId_codigo: { exercicioId, codigo: l.programa.codigo } },
      update: { nome: l.programa.nome, constaNoPPA: true },
      create: { exercicioId, codigo: l.programa.codigo, nome: l.programa.nome, constaNoPPA: true },
    });
  }
  let metas = 0;
  for (const l of linhas) {
    if (!l.acao || l.metaExercicio === null) continue;
    const acao = await tx.acao.findFirst({ where: { exercicioId, codigo: l.acao.codigo, programa: { codigo: l.programa.codigo } } });
    if (!acao) continue;
    const unidades = l.unidade
      ? await tx.unidadeOrcamentaria.findMany({ where: { exercicioId, codigo: l.unidade } })
      : await tx.unidadeOrcamentaria.findMany({ where: { exercicioId, dotacoes: { some: { acaoId: acao.id } } } });
    for (const u of unidades) {
      const meta = {
        exercicioId,
        produto: l.produto ?? l.acao.nome ?? acao.nome,
        unidadeMedida: l.unidadeMedida,
        publicoAlvo: l.publico,
        quantidadePpa: l.metaPpa,
        quantidadeExercicio: l.metaExercicio,
        notaLdo: nota,
      };
      await tx.metaAcao.upsert({
        where: { unidadeId_programaId_acaoId: { unidadeId: u.id, programaId: acao.programaId, acaoId: acao.id } },
        update: meta,
        create: { ...meta, unidadeId: u.id, programaId: acao.programaId, acaoId: acao.id },
      });
      metas++;
    }
  }
  return { programas: codigos.size, metas };
}

export { planejarRecarga };
