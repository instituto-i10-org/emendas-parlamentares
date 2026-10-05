import { z } from "zod";
import { TIPOS_REFERENCIA, type FontePreco, type ReferenciaPreco, type TipoReferencia } from "@/lib/riep";
import { formatarNumero, lerNumero, type EstadoEmenda } from "./estado";

// ============================================================================
// Link para a entidade beneficiária preencher o plano de trabalho, sem
// cadastro. Regras puras: o que torna o link válido e como o que a entidade
// enviou entra no rascunho da emenda.
// ============================================================================

export type SituacaoConvite = "VALIDO" | "USADO" | "REVOGADO" | "VENCIDO" | "EMENDA_REMETIDA";

export const MENSAGEM_CONVITE: Record<Exclude<SituacaoConvite, "VALIDO">, string> = {
  USADO: "Este link já foi utilizado. Cada link serve para um único envio; peça um novo ao gabinete do vereador se precisar corrigir.",
  REVOGADO: "Este link foi cancelado pelo gabinete do vereador.",
  VENCIDO: "Este link venceu. Peça um novo ao gabinete do vereador.",
  EMENDA_REMETIDA: "Este link não vale mais: a emenda já foi remetida à Câmara.",
};

export function situacaoConvite(
  c: { usadoEm: Date | null; revogadoEm: Date | null; expiraEm: Date },
  statusEmenda: string,
  agora = new Date()
): SituacaoConvite {
  if (c.usadoEm) return "USADO";
  if (c.revogadoEm) return "REVOGADO";
  if (statusEmenda !== "RASCUNHO") return "EMENDA_REMETIDA";
  if (c.expiraEm.getTime() <= agora.getTime()) return "VENCIDO";
  return "VALIDO";
}

// Validade a partir da criação, em dias corridos, até 23:59:59 de Brasília.
export function validadeConvite(dias: number, agora = new Date()): Date {
  const dia = new Date(agora.getTime() + dias * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dia}T23:59:59-03:00`);
}

// ---------------------------------------------------------------- o envio

const texto = (max: number) => z.string().trim().max(max);
const numero = z.string().max(40).regex(/^[\d.,\sR$-]*$/, "Número inválido.");

export const itemEntidadeSchema = z.object({
  descricao: texto(500).min(2, "Descreva cada item."),
  unidade: texto(60).min(1, "Informe a unidade de cada item."),
  quantidade: numero,
  valorUnitario: numero,
  // Fonte oficial da lista ou, sem ela, quem emitiu o preço.
  fonteId: z.string().max(40).nullable(),
  fonteOutra: texto(300),
  dataConsulta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da consulta de cada preço."),
  link: texto(1000),
});

export const planoEntidadeSchema = z.object({
  responsavelNome: texto(200).min(3, "Informe o nome de quem está preenchendo."),
  responsavelCargo: texto(200).min(2, "Informe o cargo de quem está preenchendo."),
  metaFinalistica: texto(500).min(10, "Descreva o resultado esperado (meta finalística)."),
  metas: z
    .array(z.object({ beneficiarios: texto(300).min(2), unidade: texto(120).min(1), quantidade: numero }))
    .min(1, "Informe ao menos uma meta.")
    .max(100),
  etapas: texto(3000),
  itens: z.array(itemEntidadeSchema).min(1, "Informe ao menos um item com preço.").max(100),
  parcelas: z.array(numero).max(24),
  observacao: texto(2000),
});
export type PlanoEntidade = z.infer<typeof planoEntidadeSchema>;
export type ItemEntidade = z.infer<typeof itemEntidadeSchema>;

// Conferências que o esquema não faz: números positivos e fonte em cada item.
export function errosPlanoEntidade(p: PlanoEntidade, fontes: Pick<FontePreco, "id">[]): string[] {
  const erros: string[] = [];
  p.metas.forEach((m, i) => {
    if (!(lerNumero(m.quantidade) > 0)) erros.push(`Meta ${i + 1}: informe a quantidade.`);
  });
  p.itens.forEach((it, i) => {
    const n = i + 1;
    if (!(lerNumero(it.quantidade) > 0)) erros.push(`Item ${n}: informe a quantidade.`);
    if (!(lerNumero(it.valorUnitario) > 0)) erros.push(`Item ${n}: informe o valor unitário.`);
    if (it.fonteId ? !fontes.some((f) => f.id === it.fonteId) : !it.fonteOutra) erros.push(`Item ${n}: informe de onde tirou o preço.`);
  });
  return erros;
}

export const totalPlanoEntidade = (p: Pick<PlanoEntidade, "itens">) =>
  Math.round(p.itens.reduce((s, i) => s + lerNumero(i.quantidade) * lerNumero(i.valorUnitario), 0) * 100) / 100;

// O que a entidade enviou, no formato do rascunho da emenda. Substitui o plano
// inteiro (metas, memória de cálculo, fontes, etapas e cronograma): é o plano
// dela. O gabinete revê e salva.
export function planoEntidadeParaEstado(p: PlanoEntidade, fontes: FontePreco[]): Partial<EstadoEmenda> {
  const referencias: ReferenciaPreco[] = [];
  const itens = p.itens.map((it, i) => {
    const codigo = `R${i + 1}`;
    const fonte = it.fonteId ? fontes.find((f) => f.id === it.fonteId) ?? null : null;
    const tipo: TipoReferencia = fonte?.tipo ?? "COTACAO";
    referencias.push({
      codigo,
      tipo: TIPOS_REFERENCIA[tipo] ? tipo : "COTACAO",
      campos: {},
      emissor: fonte?.nome ?? it.fonteOutra,
      data: it.dataConsulta,
      dataTexto: null,
      unidade: it.unidade,
      valor: lerNumero(it.valorUnitario),
      objeto: it.descricao,
      porte: "",
      link: it.link,
      observacao: "Informada pela entidade beneficiária.",
      procedencia: "INFORMADA",
      aprovadoPor: null,
      aprovadoEm: null,
      origemExterna: null,
      consultadoEm: null,
      fonteId: fonte?.id ?? null,
    });
    return {
      descricao: it.descricao,
      unidade: it.unidade,
      quantidade: it.quantidade,
      valorUnitario: formatarNumero(lerNumero(it.valorUnitario), 2),
      referencia: codigo,
    };
  });
  const parcial: Partial<EstadoEmenda> = {
    metaFinalistica: p.metaFinalistica,
    metas: p.metas.map((m) => ({ beneficiarios: m.beneficiarios, unidade: m.unidade, quantidade: m.quantidade })),
    itens,
    referencias,
    parcelas: p.parcelas.filter((v) => lerNumero(v) > 0).map((v) => formatarNumero(lerNumero(v), 2)),
  };
  if (p.etapas.trim()) {
    parcial.etapas = p.etapas;
    parcial.etapasEditadas = true;
  }
  return parcial;
}
