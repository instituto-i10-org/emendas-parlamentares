import "server-only";
import { prisma } from "@/lib/prisma";
import type { Evento, Instrumento, ReferenciaPreco } from "@/lib/riep";
import { chaveClassificacao, estadoInicial, formatarNumero, type EstadoEmenda } from "./estado";

// Emenda gravada, com tudo o que a tela e o plano de trabalho precisam.
export async function buscarEmenda(id: string) {
  return prisma.emenda.findUnique({
    where: { id },
    include: {
      autor: true,
      destino: true,
      exercicio: true,
      dotacao: { include: { acao: true, unidadeOrcamentaria: true, naturezaDespesa: true, programa: true, funcao: true, subfuncao: true, fonteRecurso: true } },
      metas: { orderBy: { ordem: "asc" } },
      itens: { orderBy: { ordem: "asc" }, include: { referencia: true } },
      referencias: { orderBy: { codigo: "asc" } },
      parcelas: { orderBy: { ordem: "asc" } },
      validacoes: { orderBy: { executadaEm: "desc" }, take: 1 },
      pareceres: { orderBy: { criadoEm: "desc" }, include: { usuario: { select: { name: true, email: true } } } },
      andamentos: { orderBy: [{ data: "asc" }, { criadoEm: "asc" }] },
      tramitadaPor: { select: { name: true, email: true } },
    },
  });
}
export type EmendaCompleta = NonNullable<Awaited<ReturnType<typeof buscarEmenda>>>;

const dataIso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
// Quantidade: até duas casas, sem completar com zeros.
const qtd = (v: { toNumber(): number }) => v.toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Emenda gravada → estado do formulário. A classificação é refeita no cliente
// a partir das mesmas entradas; a escolha do proponente vem da gravação.
export function paraEstado(x: EmendaCompleta): EstadoEmenda {
  const base = estadoInicial();
  const referencias: ReferenciaPreco[] = x.referencias.map((r) => ({
    codigo: r.codigo,
    tipo: r.tipo,
    campos: (r.campos ?? {}) as Record<string, string>,
    emissor: r.emissor,
    data: dataIso(r.data),
    dataTexto: r.dataTexto,
    unidade: r.unidade,
    valor: r.valor.toNumber(),
    objeto: r.objeto,
    porte: r.porte ?? "",
    link: r.link ?? "",
    observacao: r.observacao ?? "",
    procedencia: r.procedencia,
    aprovadoPor: r.aprovadoPor,
    aprovadoEm: r.aprovadoEm?.toISOString() ?? null,
    origemExterna: r.origemExterna,
    consultadoEm: r.consultadoEm?.toISOString() ?? null,
    fonteId: r.fonteId,
  }));
  const e: EstadoEmenda = {
    ...base,
    id: x.id,
    revisao: x.revisao,
    execucao: x.execucao,
    destinoId: x.destinoId,
    objeto: x.objeto,
    pretendido: x.valorPretendido ? formatarNumero(x.valorPretendido.toNumber(), 2, "R$ ") : "",
    endereco: x.endereco,
    selecao: {
      escolha: x.escolhaDotacao,
      dotacaoId: x.escolhaDotacao === "PROPONENTE" ? x.dotacaoId : null,
    },
    agenteExecutor: x.agenteExecutor,
    justificativa: x.justificativa,
    metaFinalistica: x.metaFinalistica,
    etapas: x.etapas,
    etapasEditadas: x.etapasEditadas,
    metas: x.metas.length
      ? x.metas.map((m) => ({ beneficiarios: m.beneficiarios, unidade: m.unidade, quantidade: qtd(m.quantidade) }))
      : base.metas,
    itens: x.itens.length
      ? x.itens.map((i) => ({
          descricao: i.descricao,
          // Emendas anteriores à unidade no item herdam a da referência.
          unidade: i.unidade ?? i.referencia?.unidade ?? "",
          quantidade: qtd(i.quantidade),
          valorUnitario: formatarNumero(i.valorUnitario.toNumber(), 2),
          referencia: i.referencia?.codigo ?? null,
        }))
      : base.itens,
    referencias,
    parcelas: x.parcelas.map((p) => formatarNumero(p.valor.toNumber(), 2)),
    quadro: (x.quadroViabilidade ?? {}) as Record<string, string>,
    instrumento: x.instrumento as Instrumento | null,
    instrumentoOutro: x.instrumentoOutro,
    evento: x.evento as Evento | null,
    declaracao: x.declaracaoVinculo,
  };
  // Só volta classificada se foi classificada quando gravou.
  e.classificadoCom = x.situacao ? chaveClassificacao(e) : null;
  return e;
}
