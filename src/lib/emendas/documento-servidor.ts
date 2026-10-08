import "server-only";
import { prisma } from "@/lib/prisma";
import type { EmendaCompleta } from "./carregar";
import { informadaGravada } from "./dotacao-informada";
import { montarDocumento, type DotacaoDocumento } from "./documento";
import { naoRemetida } from "./situacoes";

type DotacaoComNomes = {
  ficha: string | null;
  orgao: { codigo: string; nome: string | null };
  unidadeOrcamentaria: { codigo: string; nome: string | null };
  funcao: { codigo: string };
  subfuncao: { codigo: string };
  programa: { codigo: string };
  acao: { codigo: string; nome: string | null };
  naturezaDespesa: { codigo: string; nome: string | null };
  fonteRecurso: { codigo: string };
};

const paraDocumento = (d: DotacaoComNomes): DotacaoDocumento => ({
  orgao: d.orgao,
  unidade: d.unidadeOrcamentaria,
  funcao: d.funcao.codigo,
  subfuncao: d.subfuncao.codigo,
  programa: d.programa.codigo,
  acao: d.acao,
  natureza: d.naturezaDespesa,
  fonte: d.fonteRecurso.codigo,
  ficha: d.ficha,
});

const comNomes = { orgao: true, unidadeOrcamentaria: true, funcao: true, subfuncao: true, programa: true, acao: true, naturezaDespesa: true, fonteRecurso: true } as const;

// Documento da emenda com os dados gravados: minuta enquanto não remetida,
// definitivo (com número e data de entrada) depois do envio.
export async function documentoDaEmenda(x: EmendaCompleta) {
  const [municipio, config, projeto] = await Promise.all([
    prisma.municipio.findFirst(),
    prisma.configuracaoExercicio.findUnique({ where: { exercicioId: x.exercicioId }, select: { fichaReserva: true, fundamentoDocumento: true } }),
    // O mesmo critério de projetoBase: o projeto de lei orçamentária do exercício com base de dotações.
    prisma.instrumentoPlanejamento.findFirst({
      where: { exercicioId: x.exercicioId, tipo: "LOA", especie: "PROJETO_LEI", dotacoes: { some: {} } },
      orderBy: { createdAt: "asc" },
      select: { id: true, numero: true, ementa: true },
    }),
  ]);
  const reserva =
    config?.fichaReserva && projeto
      ? await prisma.dotacao.findFirst({ where: { instrumentoId: projeto.id, ficha: config.fichaReserva }, include: comNomes })
      : null;
  const inf = informadaGravada(x.dotacaoInformada);
  return montarDocumento({
    ano: x.exercicio.ano,
    numero: x.numero,
    enviada: !naoRemetida(x.status),
    submetidaEm: x.submetidaEm,
    hoje: new Date(),
    camara: { nome: municipio?.nomeCamara ?? null, endereco: municipio?.enderecoCamara ?? null, rodape: municipio?.rodapeDocumentos ?? null },
    nomePrefeitura: municipio?.nomePrefeitura ?? null,
    projeto: projeto ? { numero: projeto.numero, ementa: projeto.ementa } : null,
    fundamento: config?.fundamentoDocumento ?? null,
    autor: { nome: x.autor.nome, partido: x.autor.partido, cargo: x.autor.cargo },
    objeto: x.objeto,
    execucao: x.execucao,
    agenteExecutor: x.agenteExecutor,
    destino: x.destino ? { nome: x.destino.nomeOficial || x.destino.nome, cnpj: x.destino.cnpj, endereco: x.destino.endereco } : null,
    // Rascunho antigo sem valor gravado: vale o informado.
    valor: x.valor.toNumber() || x.valorPretendido?.toNumber() || 0,
    parcela: x.parcela,
    dotacao: x.dotacao ? paraDocumento(x.dotacao) : null,
    informada: inf && !inf.naLoa ? { unidade: inf.unidade, funcional: inf.funcional, natureza: inf.natureza, fonte: inf.fonte, ficha: inf.ficha } : null,
    fichaReserva: config?.fichaReserva ?? null,
    reserva: reserva ? paraDocumento(reserva) : null,
  });
}
