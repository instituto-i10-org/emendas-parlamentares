"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/audit";
import { podeCriarEmenda, podeGerirEmenda } from "@/lib/authz";
import { aplicadoDoAutor, carregarContexto } from "@/lib/emendas/contexto";
import { mesmaEmenda } from "@/lib/emendas/duplicidade";
import { mudarSituacao } from "@/lib/emendas/historico";
import { chaveClassificacao, estadoSchema, lerNumero, paraValidacao, type EstadoEmenda } from "@/lib/emendas/estado";
import { NAO_REMETIDAS, editavelPeloAutor } from "@/lib/emendas/situacoes";
import { aplicarDotacaoInformada } from "@/lib/emendas/dotacao-informada";
import { contextoVerificacao, verificarEmenda } from "@/lib/emendas/verificacao";
import { anoDaTela, exercicioHistorico } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  classificar,
  dotacaoDe,
  elementoDoInstrumento,
  eventoEfetivo,
  modeloDaDotacao,
  parcelaDaDotacao,
  podeAvancar,
  resumoValidacao,
  situacaoEfetiva,
  validar,
  type Checagem,
  type Classificacao,
  type Selecao,
  type Verificacao,
  valorDaEmenda,
  ID_INFORMADA,
} from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";

export type ResultadoGravacao =
  | { ok: true; id: string; revisao: number; numero: number | null; status: string }
  | {
      ok: false;
      erro: string;
      checks?: Checagem[];
      duplicata?: { numero: number | null; objeto: string; status: string };
      // Remessa recusada na conferência do servidor: a emenda foi gravada (a
      // tentativa fica no histórico de validações) e as treze voltam à tela.
      id?: string;
      revisao?: number;
      verificacoes?: Verificacao[];
      complementares?: Checagem[];
    };

// ============================================================================
// Gravação da emenda. O servidor refaz a classificação a partir do banco e só
// aceita a escolha de dotação se ela estiver entre as opções do motor.
// ============================================================================

export async function salvarEmenda(entrada: EstadoEmenda, submeter = false, anoTela?: number): Promise<ResultadoGravacao> {
  const user = await getCurrentUser();
  const parsed = estadoSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: "Dados inválidos na emenda. Recarregue a página e tente de novo." };
  const e = parsed.data as EstadoEmenda;

  if (submeter && !(await rateLimit(`submeter:${user.id}`, 10, 60_000))) {
    return { ok: false, erro: "Muitas submissões seguidas. Aguarde um minuto." };
  }

  // Autoria e permissão.
  const existente = e.id
    ? await prisma.emenda.findUnique({ where: { id: e.id }, include: { autor: true, exercicio: { select: { ano: true } } } })
    : null;
  if (e.id && !existente) return { ok: false, erro: "Emenda não encontrada." };

  // A emenda gravada fica no exercício dela; a nova nasce no exercício da tela.
  // Nunca no exercício do cookie: outra aba pode tê-lo trocado no seletor.
  const ano = existente ? existente.exercicio.ano : await anoDaTela(anoTela);
  const ctx = ano ? await carregarContexto(ano) : null;
  if (!ctx) return { ok: false, erro: "Nenhum exercício ativo." };
  if (await exercicioHistorico(ctx.config.exercicio)) {
    return { ok: false, erro: `O exercício ${ctx.config.exercicio} é histórico: não recebe emenda nova nem alteração. Use o exercício em curso.` };
  }
  // Exercício encerrado: nem rascunho. Emendamento fechado (projeto de lei fora
  // de tramitação, prazo vencido): o rascunho ainda se salva; submeter, não. O
  // reenvio depois de diligência não é protocolo novo: o prazo não o alcança.
  const em = ctx.emendamento;
  if (em.motivo === "EXERCICIO_ENCERRADO") return { ok: false, erro: em.explicacao };
  if (submeter && !em.aberto && !(em.motivo === "PRAZO_ENCERRADO" && existente?.status === "EM_DILIGENCIA")) {
    return { ok: false, erro: `${em.explicacao} A emenda não pode ser submetida agora.` };
  }
  let autorId: string;
  if (existente) {
    if (!podeGerirEmenda(user, { autorUsuarioId: existente.autor.usuarioId })) {
      return { ok: false, erro: "Você não pode alterar esta emenda." };
    }
    if (!editavelPeloAutor(existente.status)) {
      return { ok: false, erro: "Emenda já submetida não se altera por aqui." };
    }
    if (existente.revisao !== e.revisao) {
      return { ok: false, erro: "Esta emenda foi alterada em outra aba. Reabra a versão salva antes de continuar." };
    }
    autorId = existente.autorId;
  } else {
    if (!podeCriarEmenda(user)) return { ok: false, erro: "Seu perfil não apresenta emendas." };
    const autor = await prisma.autor.findUnique({ where: { usuarioId: user.id } });
    if (!autor) return { ok: false, erro: "Sua conta não está vinculada a um autor (vereador)." };
    autorId = autor.id;
  }

  // Destino e classificação, refeitos aqui.
  const destino = e.destinoId ? ctx.destinos.find((d) => d.id === e.destinoId) ?? null : null;
  if (e.destinoId && (!destino || destino.execucao !== e.execucao)) {
    return { ok: false, erro: "O destino escolhido não vale para esta forma de execução." };
  }
  const pretendido = lerNumero(e.pretendido);
  let motor: Classificacao | null = null;
  if (destino && e.objeto.trim() && e.classificadoCom && e.classificadoCom === chaveClassificacao(e)) {
    motor = classificar({
      objeto: e.objeto,
      destino,
      execucao: e.execucao,
      pretendido,
      loa: ctx.loa,
      catalogo: ctx.catalogo,
    });
  }
  // A dotação informada à mão, conferida aqui de novo contra a LOA.
  const inf = aplicarDotacaoInformada(e, motor, destino, ctx.loa);
  const classificacao = inf.classificacao;
  const selecao: Selecao = inf.informada ? { escolha: "PROPONENTE", dotacaoId: inf.achada?.id ?? null } : selecaoValida(classificacao, e.selecao);
  const dotacao = dotacaoDe(classificacao, selecao);
  const situacao = situacaoEfetiva(classificacao, selecao);
  const modelo = modeloDaDotacao(dotacao);
  // O valor da emenda é o informado no passo 1; sem ele, a soma da planilha.
  const valor = valorDaEmenda(pretendido, e.itens.reduce((s, i) => s + lerNumero(i.quantidade) * lerNumero(i.valorUnitario), 0));

  // Reenvio depois de diligência: a emenda já tem número e volta à fila.
  const reenvio = existente?.status === "EM_DILIGENCIA";
  let validacao: { checks: Checagem[]; bloqueios: number; alertas: number; verificacoes: Verificacao[]; valida: boolean } | null = null;
  if (submeter) {
    if (!podeAvancar(classificacao, selecao)) {
      return { ok: false, erro: "A emenda precisa de classificação válida antes de ser submetida." };
    }
    // O servidor refaz tudo a partir do banco: o que o navegador calculou não vale.
    const aplicado = await aplicadoDoAutor(ctx.exercicioId, autorId, ctx.config.percentualSaude, e.id);
    const checks = validar(
      paraValidacao(e, { classificacao, metaPlanejamento: dotacao ? ctx.metas[dotacao.id] ?? null : null, dotacaoInformada: inf.informada }),
      { config: ctx.config, aplicado, biblioteca: ctx.catalogo.objetos }
    );
    const treze = verificarEmenda(e, valor, dotacao, contextoVerificacao(ctx, aplicado, reenvio), checks, inf.informada === "FORA");
    const resumo = resumoValidacao(checks);
    const falhas = treze.verificacoes.filter((v) => v.estado === "falha").length;
    validacao = {
      checks,
      bloqueios: resumo.bloqueios + falhas,
      alertas: resumo.alertas + treze.verificacoes.filter((v) => v.estado === "alerta").length,
      verificacoes: treze.verificacoes,
      valida: treze.valida,
    };
  }
  const recusada = !!validacao && !validacao.valida;
  if (validacao?.valida) {
    // Duplicidade: mesmo autor, mesmo destino e mesmo objeto de uma emenda já
    // submetida no exercício. Um clique duplo ou uma rotina interrompida não
    // podem numerar a mesma emenda duas vezes; o proponente pode confirmar.
    if (!e.confirmarDuplicata && destino) {
      const parecidas = await prisma.emenda.findMany({
        where: { exercicioId: ctx.exercicioId, autorId, destinoId: destino.id, status: { notIn: NAO_REMETIDAS }, ...(e.id ? { id: { not: e.id } } : {}) },
        select: { numero: true, objeto: true, status: true, execucao: true, destinoId: true },
        orderBy: { numero: "asc" },
      });
      const igual = parecidas.find((p) => mesmaEmenda({ destinoId: p.destinoId, execucao: p.execucao, objeto: p.objeto }, { destinoId: destino.id, execucao: e.execucao, objeto: e.objeto }));
      if (igual) {
        return {
          ok: false,
          erro: `Possível duplicata da emenda nº ${igual.numero ?? "sem número"}: mesmo destino e mesmo objeto. Confirme para submeter mesmo assim.`,
          duplicata: { numero: igual.numero, objeto: igual.objeto, status: igual.status },
        };
      }
    }
  }

  const dados = {
    execucao: e.execucao,
    destinoId: destino?.id ?? null,
    objeto: e.objeto.trim(),
    quantidade: null,
    valorPretendido: pretendido > 0 ? pretendido : null,
    endereco: e.endereco.trim(),
    situacao: classificacao ? situacao : null,
    dotacaoId: dotacao && situacao === "OK" && dotacao.id !== ID_INFORMADA ? dotacao.id : null,
    escolhaDotacao: selecao.escolha,
    classificacao: classificacao ? fotografia(classificacao, selecao) : Prisma.DbNull,
    parcela: parcelaDaDotacao(dotacao),
    modelo,
    agenteExecutor: e.agenteExecutor.trim(),
    justificativa: e.justificativa.trim(),
    metaFinalistica: e.metaFinalistica.trim(),
    etapas: e.etapas.trim(),
    etapasEditadas: e.etapasEditadas,
    quadroViabilidade: e.quadro,
    instrumento: modelo === "TERCEIRO_SETOR" ? e.instrumento : null,
    instrumentoOutro: modelo === "TERCEIRO_SETOR" && e.instrumento === "OUTRO" ? e.instrumentoOutro.trim() : "",
    elementoOsc: modelo === "TERCEIRO_SETOR" ? elementoDoInstrumento(e.instrumento, dotacao?.gnd ?? "3") : null,
    evento: eventoEfetivo(dotacao, e.evento),
    valor,
    declaracaoVinculo: e.declaracao,
    declaracaoPrecos: e.declaracaoPrecos,
    dotacaoInformada: inf.informada
      ? ({
          unidade: e.dotacaoInformada!.unidade.trim(),
          funcional: e.dotacaoInformada!.funcional.trim(),
          natureza: e.dotacaoInformada!.natureza.trim(),
          fonte: e.dotacaoInformada!.fonte.trim(),
          ficha: e.dotacaoInformada!.ficha.trim(),
          naLoa: inf.informada === "LOA",
          dotacaoCodigo: inf.achada?.codigo ?? null,
          porId: user.id,
          porNome: user.nome,
          em: new Date().toISOString(),
        } as Prisma.InputJsonValue)
      : Prisma.DbNull,
    declaracaoDotacao: inf.informada === "FORA" && e.declaracaoDotacao,
  };

  const salvo = await prisma.$transaction(async (tx) => {
    const emenda = existente
      ? await tx.emenda.update({ where: { id: existente.id }, data: { ...dados, revisao: { increment: 1 } } })
      : await tx.emenda.create({ data: { ...dados, exercicioId: ctx.exercicioId, autorId } });

    await tx.itemEmenda.deleteMany({ where: { emendaId: emenda.id } });
    await tx.referenciaPreco.deleteMany({ where: { emendaId: emenda.id } });
    await tx.metaEmenda.deleteMany({ where: { emendaId: emenda.id } });
    await tx.parcelaDesembolso.deleteMany({ where: { emendaId: emenda.id } });

    await tx.metaEmenda.createMany({
      data: e.metas
        .filter((m) => m.beneficiarios.trim() || m.unidade.trim() || lerNumero(m.quantidade))
        .map((m, ordem) => ({
          emendaId: emenda.id,
          ordem,
          beneficiarios: m.beneficiarios.trim(),
          unidade: m.unidade.trim(),
          quantidade: lerNumero(m.quantidade),
        })),
    });
    const refId = new Map<string, string>();
    // Fonte oficial só vale se existe no cadastro; senão a referência fica como "outra fonte".
    const fontesValidas = new Set(ctx.fontesPreco.map((f) => f.id));
    for (const r of e.referencias) {
      const criada = await tx.referenciaPreco.create({
        data: {
          emendaId: emenda.id,
          codigo: r.codigo,
          tipo: r.tipo,
          campos: r.campos,
          emissor: r.emissor,
          data: r.data ? new Date(`${r.data}T12:00:00Z`) : null,
          dataTexto: r.dataTexto,
          unidade: r.unidade,
          valor: r.valor,
          objeto: r.objeto,
          porte: r.porte || null,
          link: r.link || null,
          observacao: r.observacao || null,
          procedencia: r.procedencia,
          aprovadoPor: r.aprovadoPor,
          aprovadoEm: r.aprovadoEm ? new Date(r.aprovadoEm) : null,
          origemExterna: r.origemExterna,
          consultadoEm: r.consultadoEm ? new Date(r.consultadoEm) : null,
          fonteId: r.fonteId && fontesValidas.has(r.fonteId) ? r.fonteId : null,
        },
      });
      refId.set(r.codigo, criada.id);
    }
    await tx.itemEmenda.createMany({
      data: e.itens
        .filter((i) => i.descricao.trim() || lerNumero(i.valorUnitario))
        .map((i, ordem) => ({
          emendaId: emenda.id,
          ordem,
          descricao: i.descricao.trim(),
          unidade: (i.unidade ?? "").trim() || null,
          quantidade: lerNumero(i.quantidade),
          valorUnitario: lerNumero(i.valorUnitario),
          referenciaId: i.referencia ? refId.get(i.referencia) ?? null : null,
        })),
    });
    await tx.parcelaDesembolso.createMany({
      data: e.parcelas
        .map(lerNumero)
        .filter((v) => v > 0)
        .map((valor, ordem) => ({ emendaId: emenda.id, ordem, valor })),
    });

    if (!validacao) {
      // Alterar uma emenda recusada na remessa a devolve a rascunho.
      if (emenda.status === "INVALIDA" || emenda.status === "VALIDA") {
        return mudarSituacao(tx, { emendaId: emenda.id, de: emenda.status, para: "RASCUNHO", usuarioId: user.id, texto: "Alterada pelo autor." });
      }
      return emenda;
    }

    // Toda validação feita no servidor fica gravada, inclusive a reprovada.
    await tx.validacaoEmenda.create({
      data: {
        emendaId: emenda.id,
        bloqueios: validacao.bloqueios,
        alertas: validacao.alertas,
        itens: validacao.checks,
        verificacoes: validacao.verificacoes,
        valida: validacao.valida,
        momento: reenvio ? "REENVIO" : "REMESSA",
        revisao: emenda.revisao,
        usuarioId: user.id,
      },
    });
    if (recusada) {
      // Em diligência a emenda segue na diligência, com o número; a nova fica
      // inválida, com o autor, até ser corrigida.
      if (reenvio || emenda.status === "INVALIDA") return emenda;
      return mudarSituacao(tx, {
        emendaId: emenda.id,
        de: emenda.status,
        para: "INVALIDA",
        usuarioId: user.id,
        texto: `Remessa recusada: ${validacao.bloqueios} falha(s) na validação do servidor.`,
      });
    }

    // A emenda sai de rascunho: os links da entidade ainda abertos deixam de valer.
    await tx.conviteEntidade.updateMany({
      where: { emendaId: emenda.id, usadoEm: null, revogadoEm: null },
      data: { revogadoEm: new Date(), revogadoPorId: user.id },
    });

    // Reenvio depois de diligência: volta à fila com o número que já tinha.
    if (existente?.status === "EM_DILIGENCIA") {
      return mudarSituacao(tx, {
        emendaId: emenda.id,
        de: "EM_DILIGENCIA",
        para: "SUBMETIDA",
        usuarioId: user.id,
        texto: "Reenviada após diligência.",
        dados: { reenviadaEm: new Date() },
      });
    }
    // Número atribuído na submissão, em transação: nunca por contagem.
    const contador = await tx.contadorEmenda.upsert({
      where: { exercicioId: ctx.exercicioId },
      update: { ultimo: { increment: 1 } },
      create: { exercicioId: ctx.exercicioId, ultimo: 1 },
    });
    return mudarSituacao(tx, {
      emendaId: emenda.id,
      de: emenda.status,
      para: "SUBMETIDA",
      usuarioId: user.id,
      dados: { numero: contador.ultimo, submetidaEm: new Date() },
    });
  });

  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "Emenda",
    entidadeId: salvo.id,
    acao: recusada ? "REMESSA_RECUSADA" : submeter ? (reenvio ? "REENVIAR_APOS_DILIGENCIA" : "SUBMETER") : existente ? "ATUALIZAR_RASCUNHO" : "CRIAR_RASCUNHO",
    dadosAntes: existente ? { status: existente.status, revisao: existente.revisao, valor: existente.valor } : undefined,
    dadosDepois: { status: salvo.status, revisao: salvo.revisao, valor: salvo.valor, numero: salvo.numero },
  });
  revalidatePath("/emendas");
  if (recusada && validacao) {
    return {
      ok: false,
      erro: `A conferência do servidor encontrou ${validacao.bloqueios} falha(s): a emenda não foi remetida.`,
      id: salvo.id,
      revisao: salvo.revisao,
      checks: validacao.checks,
      verificacoes: validacao.verificacoes,
      complementares: validacao.checks,
    };
  }
  return { ok: true, id: salvo.id, revisao: salvo.revisao, numero: salvo.numero, status: salvo.status };
}

// A escolha do proponente só vale entre as opções; OK automático é do sistema.
function selecaoValida(c: Classificacao | null, s: Selecao): Selecao {
  if (!c) return { escolha: null, dotacaoId: null };
  if (c.situacao === "OK") return { escolha: "SISTEMA", dotacaoId: c.selecionada?.id ?? null };
  if (c.situacao !== "VALIDAR") return { escolha: null, dotacaoId: null };
  if (s.escolha === "PROPONENTE" && s.dotacaoId && c.opcoes.some((d) => d.id === s.dotacaoId)) return s;
  if (s.escolha === "ANALISE_TECNICA") return { escolha: "ANALISE_TECNICA", dotacaoId: null };
  return { escolha: null, dotacaoId: null };
}

// O que explica, depois, por que a dotação é esta.
function fotografia(c: Classificacao, s: Selecao) {
  const d = dotacaoDe(c, s);
  return {
    situacao: c.situacao,
    objeto: c.objeto,
    base: c.base,
    motivo: c.motivo,
    porQue: c.porQue,
    escolha: s.escolha,
    dotacao: d ? { codigo: d.codigo, nome: d.nome, uo: d.uo, natureza: `${d.gnd}.${d.gnd}.${d.mod}.${d.elem}` } : null,
    opcoes: c.opcoes.map((o) => o.codigo),
  } as Prisma.InputJsonValue;
}

export async function excluirRascunho(id: string): Promise<{ ok: boolean; erro?: string }> {
  const user = await getCurrentUser();
  const emenda = await prisma.emenda.findUnique({ where: { id }, include: { autor: true } });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (!podeGerirEmenda(user, { autorUsuarioId: emenda.autor.usuarioId })) return { ok: false, erro: "Sem permissão." };
  if (emenda.status !== "RASCUNHO" && emenda.status !== "INVALIDA") return { ok: false, erro: "Só rascunhos podem ser excluídos." };
  await prisma.emenda.delete({ where: { id } });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "Emenda",
    entidadeId: id,
    acao: "EXCLUIR_RASCUNHO",
    dadosAntes: { objeto: emenda.objeto, valor: emenda.valor },
  });
  revalidatePath("/emendas");
  return { ok: true };
}

// Apaga uma emenda de teste já submetida — só da conta de demonstração. É o
// mesmo que `prisma/apagar-emenda.ts` faz pelo terminal: a emenda sai com tudo
// o que pende dela (metas, itens, referências, parcelas, validações, pareceres,
// andamentos); se for a última numerada do exercício, o contador volta um,
// para o teste não deixar buraco na numeração. A trilha de auditoria da
// emenda fica: apagar o teste não apaga o rastro.
export async function apagarEmendaDeTeste(id: string): Promise<{ ok: boolean; erro?: string }> {
  const user = await getCurrentUser();
  const emenda = await prisma.emenda.findUnique({
    where: { id },
    include: { autor: true, exercicio: true },
  });
  if (!emenda) return { ok: false, erro: "Emenda não encontrada." };
  if (!podeGerirEmenda(user, { autorUsuarioId: emenda.autor.usuarioId })) return { ok: false, erro: "Sem permissão." };
  if (!emenda.autor.demonstracao) return { ok: false, erro: "Só emendas da conta de demonstração podem ser apagadas." };

  await prisma.$transaction(async (tx) => {
    await tx.emenda.delete({ where: { id } });
    if (emenda.numero !== null) {
      // Só volta se ninguém numerou depois: a condição vai no próprio update.
      await tx.contadorEmenda.updateMany({
        where: { exercicioId: emenda.exercicioId, ultimo: emenda.numero },
        data: { ultimo: emenda.numero - 1 },
      });
    }
  });
  await registrarAuditoria({
    usuarioId: user.id,
    entidade: "Emenda",
    entidadeId: id,
    acao: "APAGAR_EMENDA_DE_TESTE",
    dadosAntes: { numero: emenda.numero, exercicio: emenda.exercicio.ano, status: emenda.status, objeto: emenda.objeto, valor: emenda.valor, autor: emenda.autor.nome },
  });
  revalidatePath("/emendas");
  return { ok: true };
}
