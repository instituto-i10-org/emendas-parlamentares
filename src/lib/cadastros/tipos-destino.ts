import { tipoDoDestino } from "@/lib/riep/destino";
import { norm } from "@/lib/riep/texto";
import type { TipoDestino } from "@/lib/riep/tipos";

// ============================================================================
// Tipos de destino na tela. A regra de reconhecimento é guardada como padrão
// técnico (expressão regular sobre o nome sem acentos, em minúsculas); na tela
// ela aparece como uma lista de palavras ou expressões, cada uma marcada como
// "palavra inteira" ou não. A ida e a volta são exatas: um padrão que sai de
// uma lista volta à mesma lista. O que não cabe numa lista (grupos, pontos
// opcionais) fica como "regra avançada", editada como texto.
// ============================================================================

export type ItemReconhecimento = { texto: string; inteira: boolean };

const ESPECIAIS = /[.*+?^${}()|[\]\\]/;
const escapar = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Texto de um item, normalizado como o nome do destino é normalizado.
export const normalizarItem = (t: string) => norm(t).replace(/\s+/g, " ").trim();

export function itensParaPadrao(itens: ItemReconhecimento[]): string {
  return itens
    .map((i) => ({ ...i, texto: normalizarItem(i.texto) }))
    .filter((i) => i.texto)
    .map((i) => (i.inteira ? `\\b${escapar(i.texto)}\\b` : escapar(i.texto)))
    .join("|");
}

// Padrão → lista, quando dá. Cada alternativa precisa ser texto simples
// (letras, números e espaços), com ou sem \b nas duas pontas.
export function padraoParaItens(padrao: string): ItemReconhecimento[] | null {
  if (!padrao.trim()) return [];
  if (/[()[\]]/.test(padrao)) return null;
  const itens: ItemReconhecimento[] = [];
  for (const alt of padrao.split("|")) {
    const m = /^\\b(.*)\\b$/.exec(alt);
    const texto = m ? m[1] : alt;
    if (!texto || ESPECIAIS.test(texto) || texto.includes("\\")) return null;
    if (!/^[a-z0-9 ]+$/.test(texto) || texto !== texto.trim()) return null;
    itens.push({ texto, inteira: !!m });
  }
  // A volta tem de dar o mesmo padrão; se não der, é regra avançada.
  return itensParaPadrao(itens) === padrao ? itens : null;
}

export function padraoValido(padrao: string): string | null {
  if (!padrao.trim()) return "Informe ao menos uma palavra ou expressão.";
  try {
    new RegExp(padrao, "i");
    return null;
  } catch {
    return "A regra avançada não é uma expressão válida.";
  }
}

// Novo item: uma palavra só vale como palavra inteira por padrão (sigla ou
// nome curto); expressão com espaço, como parte do texto.
export const novoItem = (texto = ""): ItemReconhecimento => ({ texto, inteira: !/\s/.test(texto.trim()) });

// Teste na tela: qual tipo reconhece o nome digitado.
export function testarNome(nome: string, tipos: TipoDestino[]): TipoDestino | null {
  return tipoDoDestino(nome, null, tipos);
}
