// Reconciliação da leitura de um orçamento em PDF: a soma das linhas lidas
// de cada unidade tem de bater com o total que o próprio documento imprime.
// Puro: recebe linhas e totais lidos e devolve o que não fecha.

import { pertence } from "../../riep/destino";

export type LinhaLida = { pagina: number; unidade: string; valor: number };
export type NivelTotal = "UNIDADE_EXECUTORA" | "UNIDADE_ORCAMENTARIA" | "ORGAO" | "GERAL" | "OUTRO";
export type TotalImpresso = { pagina: number; nivel: NivelTotal; codigo: string | null; valor: number };

export type Divergencia = { codigo: string; nivel: NivelTotal; lido: number; impresso: number; diferenca: number; paginas: number[] };

const c = (v: number) => Math.round(v * 100);

// Cada total impresso com código (unidade executora, unidade orçamentária ou
// órgão) contra a soma das linhas lidas das unidades que pertencem a ele. Total
// repetido (quebra de página) vale pelo último. As divergências vêm da mais
// específica para a mais geral.
export function reconciliarUnidades(linhas: LinhaLida[], totais: TotalImpresso[]): Divergencia[] {
  const impresso = new Map<string, TotalImpresso>();
  for (const t of totais) if (t.codigo && t.nivel !== "GERAL" && t.nivel !== "OUTRO") impresso.set(t.codigo, t);
  const div: Divergencia[] = [];
  for (const [codigo, t] of impresso) {
    const dela = linhas.filter((l) => pertence(l.unidade, codigo));
    const lido = dela.reduce((s, l) => s + c(l.valor), 0);
    if (lido !== c(t.valor)) {
      div.push({ codigo, nivel: t.nivel, lido: lido / 100, impresso: t.valor, diferenca: (lido - c(t.valor)) / 100, paginas: [...new Set(dela.map((l) => l.pagina))].sort((a, b) => a - b) });
    }
  }
  return div.sort((a, b) => b.codigo.length - a.codigo.length || (a.codigo < b.codigo ? -1 : 1));
}

// Soma lida de um código (unidade ou órgão).
export const somaDe = (linhas: LinhaLida[], codigo: string) => linhas.filter((l) => pertence(l.unidade, codigo)).reduce((s, l) => s + c(l.valor), 0) / 100;

// O total geral impresso no documento (o maior valor de nível GERAL lido).
export function totalGeralImpresso(totais: TotalImpresso[]): number | null {
  const gerais = totais.filter((t) => t.nivel === "GERAL").map((t) => t.valor);
  return gerais.length ? Math.max(...gerais) : null;
}

// Lotes de páginas: faixas contíguas de até `tamanho` páginas.
export function lotes(paginas: number[], tamanho: number): [number, number][] {
  const ord = [...new Set(paginas)].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const p of ord) {
    const ult = out[out.length - 1];
    if (ult && p === ult[1] + 1 && p - ult[0] < tamanho) ult[1] = p;
    else out.push([p, p]);
  }
  return out;
}

// Linha de dotação no texto nativo: natureza da despesa e valor monetário no fim.
const LINHA_DESPESA = /(^|\s)[349]\.\d\.\d{2}\.\d{2}(\.\d{2})?\s.*\d{1,3}(\.\d{3})*,\d{2}\s*$/;

export const contarDotacoes = (texto: string) => texto.split("\n").filter((l) => LINHA_DESPESA.test(l)).length;

// Páginas com cara de quadro de despesa (texto nativo): várias linhas de dotação.
export function paginasComDespesa(paginas: { pagina: number; texto: string }[]): number[] {
  return paginas.filter((p) => contarDotacoes(p.texto) >= 3).map((p) => p.pagina);
}
