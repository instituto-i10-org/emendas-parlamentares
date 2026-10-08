import { z } from "zod";
import type { EstadoValidacao, Evento, Execucao, Instrumento, ReferenciaPreco, Selecao, TipoReferencia } from "@/lib/riep";

// ============================================================================
// Estado do formulário da emenda — o mesmo objeto no navegador, na gravação e
// na reabertura. Números digitados ficam como texto (com a máscara pt-BR) e
// são convertidos na hora de conferir.
// ============================================================================

export type MetaForm = { beneficiarios: string; unidade: string; quantidade: string };
export type ItemForm = { descricao: string; unidade: string; quantidade: string; valorUnitario: string; referencia: string | null };

export type EstadoEmenda = {
  id: string | null;
  revisao: number;
  execucao: Execucao;
  destinoId: string | null;
  objeto: string;
  pretendido: string;
  endereco: string;
  // Chave das entradas com que a classificação foi feita. Se as entradas
  // mudam, a classificação deixa de valer.
  classificadoCom: string | null;
  selecao: Selecao;
  agenteExecutor: string;
  justificativa: string;
  metaFinalistica: string;
  etapas: string;
  etapasEditadas: boolean;
  metas: MetaForm[];
  itens: ItemForm[];
  referencias: ReferenciaPreco[];
  parcelas: string[];
  quadro: Record<string, string>;
  instrumento: Instrumento | null;
  instrumentoOutro: string;
  evento: Evento | null;
  declaracao: boolean;
  declaracaoPrecos: boolean;
  // O proponente viu o aviso de possível duplicata e mandou seguir.
  confirmarDuplicata?: boolean;
};

export const estadoInicial = (): EstadoEmenda => ({
  id: null,
  revisao: 0,
  execucao: "DIRETA",
  destinoId: null,
  objeto: "",
  pretendido: "",
  endereco: "",
  classificadoCom: null,
  selecao: { escolha: null, dotacaoId: null },
  agenteExecutor: "",
  justificativa: "",
  metaFinalistica: "",
  etapas: "",
  etapasEditadas: false,
  metas: [{ beneficiarios: "", unidade: "", quantidade: "" }],
  itens: [{ descricao: "", unidade: "", quantidade: "1", valorUnitario: "", referencia: null }],
  referencias: [],
  parcelas: [],
  quadro: {},
  instrumento: null,
  instrumentoOutro: "",
  evento: null,
  declaracao: false,
  declaracaoPrecos: false,
});

// "R$ 1.234,56" → 1234.56. Aceita também número já sem máscara.
export function lerNumero(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/R\$|\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function formatarNumero(v: number | null | undefined, casas = 2, prefixo = ""): string {
  if (v == null || !Number.isFinite(v)) return "";
  return prefixo + v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// As entradas que determinam a classificação. O valor pretendido fica de fora:
// ele não muda a dotação escolhida, só sinaliza — e ajustá-lo (no passo 1 ou
// pela memória de cálculo) não pode derrubar a análise.
export const chaveClassificacao = (e: Pick<EstadoEmenda, "execucao" | "destinoId" | "objeto">) =>
  JSON.stringify([e.execucao, e.destinoId, e.objeto.trim()]);

// Parte do estado que o motor confere na etapa 3.
export function paraValidacao(
  e: EstadoEmenda,
  extra: Pick<EstadoValidacao, "classificacao" | "metaPlanejamento">
): EstadoValidacao {
  return {
    ...extra,
    selecao: e.selecao,
    pretendido: lerNumero(e.pretendido),
    endereco: e.endereco,
    agenteExecutor: e.agenteExecutor,
    justificativa: e.justificativa,
    metaFinalistica: e.metaFinalistica,
    etapas: e.etapas,
    metas: e.metas.map((m) => ({
      beneficiarios: m.beneficiarios,
      unidade: m.unidade,
      quantidade: lerNumero(m.quantidade),
    })),
    itens: e.itens.map((i) => ({
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: lerNumero(i.quantidade),
      valorUnitario: lerNumero(i.valorUnitario),
      referencia: i.referencia,
    })),
    referencias: e.referencias,
    parcelas: e.parcelas.map(lerNumero),
    quadro: e.quadro,
    instrumento: e.instrumento,
    instrumentoOutro: e.instrumentoOutro,
    evento: e.evento,
    declaracao: e.declaracao,
    declaracaoPrecos: e.declaracaoPrecos,
  };
}

// ============================================================================
// Esquema de entrada no servidor. O cliente não é confiável: limites de
// tamanho em tudo, e a classificação é refeita no servidor.
// ============================================================================

const texto = (max: number) => z.string().max(max);
const numeroTexto = z.string().max(40).regex(/^[\d.,\sR$-]*$/, "Número inválido.");
const tiposReferencia = [
  "ATA", "CONTRATACAO_MUNICIPIO", "CONTRATACAO_OUTRO_ORGAO", "PAINEL", "BANCO_PRECOS_SAUDE",
  "TABELA_OFICIAL", "COTACAO", "NOTA_FISCAL", "TERMO_PARCERIA", "ESTIMATIVA",
] as const satisfies readonly TipoReferencia[];

export const referenciaSchema = z.object({
  codigo: z.string().regex(/^R\d{1,4}$/),
  tipo: z.enum(tiposReferencia),
  campos: z.record(z.string().max(40), texto(300)),
  emissor: texto(300),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dataTexto: texto(120).nullable(),
  unidade: texto(120),
  valor: z.number().nonnegative().max(1e12),
  objeto: texto(500),
  porte: texto(200),
  link: texto(1000),
  observacao: texto(1000),
  procedencia: z.enum(["INFORMADA", "CONFERIDA"]),
  aprovadoPor: texto(200).nullable(),
  aprovadoEm: texto(40).nullable(),
  origemExterna: texto(40).nullable(),
  consultadoEm: texto(40).nullable(),
  fonteId: z.string().max(40).nullable().optional(),
});

export const estadoSchema = z.object({
  id: z.string().max(40).nullable(),
  revisao: z.number().int().nonnegative(),
  execucao: z.enum(["DIRETA", "INDIRETA"]),
  destinoId: z.string().max(40).nullable(),
  objeto: texto(500),
  pretendido: numeroTexto,
  endereco: texto(500),
  classificadoCom: z.string().max(2000).nullable(),
  selecao: z.object({
    escolha: z.enum(["SISTEMA", "PROPONENTE", "ANALISE_TECNICA"]).nullable(),
    dotacaoId: z.string().max(40).nullable(),
  }),
  agenteExecutor: texto(300),
  justificativa: texto(2000),
  metaFinalistica: texto(500),
  etapas: texto(3000),
  etapasEditadas: z.boolean(),
  metas: z.array(z.object({ beneficiarios: texto(300), unidade: texto(120), quantidade: numeroTexto })).max(100),
  itens: z
    .array(
      z.object({
        descricao: texto(500),
        unidade: texto(60).optional().default(""),
        quantidade: numeroTexto,
        valorUnitario: numeroTexto,
        referencia: z.string().max(8).nullable(),
      })
    )
    .max(100),
  referencias: z.array(referenciaSchema).max(200),
  parcelas: z.array(numeroTexto).max(100),
  quadro: z.record(z.string().max(40), texto(200)),
  instrumento: z.enum(["PARCERIA_MROSC", "CONTRIBUICAO_LEI", "OUTRO"]).nullable(),
  instrumentoOutro: texto(300),
  evento: z
    .enum([
      "PATRIMONIO", "ALMOXARIFADO", "LIQUIDACAO", "RECEBIMENTO_DEFINITIVO", "RECEBIMENTO_ETAPA",
      "PRESTACAO_CONTAS", "PRESTACAO_CONTAS_DOACAO",
    ])
    .nullable(),
  declaracao: z.boolean(),
  declaracaoPrecos: z.boolean().default(false),
  confirmarDuplicata: z.boolean().optional(),
});
