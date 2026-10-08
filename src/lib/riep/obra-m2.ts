import type { FontePreco, ReferenciaPreco } from "./referencias";

// Obra por m²: em vez de orçar serviço a serviço, a emenda de obra pode trazer
// um item único "área × custo de referência do m²" (SINAPI/IBGE). O valor vem
// do parâmetro do exercício; a área é do autor. Nada se aplica sozinho.

export type CustoM2 = { valor: number; competencia: string | null; fonte: string | null; url: string | null };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "ago/2026" → "2026-08-01"; "08/2026" também. Outro formato: nulo.
export function competenciaIso(competencia: string | null | undefined): string | null {
  const m = (competencia ?? "").trim().toLowerCase().match(/^([a-zç]{3})[a-zç]*\.?\s*\/\s*(\d{4})$|^(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!m) return null;
  const mes = m[1] ? MESES.indexOf(m[1]) + 1 : Number(m[3]);
  const ano = Number(m[2] ?? m[4]);
  if (mes < 1 || mes > 12) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

// A referência e a linha do item único, prontas para entrar na memória de
// cálculo. A fonte oficial "Custo médio do m²" é usada quando cadastrada.
export function itemObraM2({
  objeto,
  area,
  custo,
  fonte,
  codigo,
}: {
  objeto: string;
  area: number;
  custo: CustoM2;
  fonte: Pick<FontePreco, "id" | "nome"> | null;
  codigo: string;
}): { referencia: ReferenciaPreco; item: { descricao: string; unidade: string; quantidade: number; valorUnitario: number; referencia: string } } {
  const data = competenciaIso(custo.competencia);
  const descricao = `${objeto.trim() || "Obra"} — área construída`;
  const referencia: ReferenciaPreco = {
    codigo,
    tipo: "TABELA_OFICIAL",
    campos: {
      sistema: "Custo médio do m² SINAPI/IBGE",
      ...(custo.competencia ? { databse: custo.competencia } : {}),
      ...(custo.fonte && /desonera/i.test(custo.fonte) ? { deson: /sem desonera/i.test(custo.fonte) ? "Sem desoneração" : "Com desoneração" } : {}),
    },
    emissor: fonte?.nome ?? custo.fonte ?? "Custo médio do m² — SINAPI/IBGE",
    data,
    dataTexto: data ? null : custo.competencia || "competência não informada",
    unidade: "m²",
    valor: custo.valor,
    objeto: "Custo médio do m² de construção",
    porte: "",
    link: custo.url ?? "",
    observacao: custo.fonte ? `Parâmetro do exercício: ${custo.fonte}.` : "Parâmetro do exercício.",
    procedencia: "INFORMADA",
    aprovadoPor: null,
    aprovadoEm: null,
    origemExterna: null,
    consultadoEm: null,
    fonteId: fonte?.id ?? null,
  };
  return { referencia, item: { descricao, unidade: "m²", quantidade: area, valorUnitario: custo.valor, referencia: codigo } };
}
