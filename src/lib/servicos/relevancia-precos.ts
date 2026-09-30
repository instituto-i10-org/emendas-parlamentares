import { norm } from "@/lib/riep/texto";

// Palavras que não distinguem um item de outro na busca de preços.
const FRACAS = new Set(["de", "da", "do", "das", "dos", "para", "com", "em", "e", "ou", "a", "o", "as", "os", "um", "uma", "material", "materiais"]);

const palavras = (s: string) =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !FRACAS.has(w));

// Ordena os resultados de uma fonte de preços pela relação com a consulta: só
// ficam os que mencionam ao menos uma palavra da consulta, os mais citados
// primeiro e, em empate, os de amostra maior. Sem nenhuma correspondência, a
// lista original volta inteira, marcada como aproximada — nunca "nada".
export function ordenarPorRelevancia<T extends { descricao: string; amostra: number }>(
  consulta: string,
  itens: T[],
  limite = 30
): { itens: T[]; aproximados: boolean } {
  const termos = palavras(consulta);
  if (!termos.length) return { itens: itens.slice(0, limite), aproximados: false };
  const pontuados = itens
    .map((it) => {
      const texto = norm(it.descricao);
      const escore = termos.filter((t) => texto.includes(t)).length;
      return { it, escore };
    })
    .filter((x) => x.escore > 0)
    .sort((a, b) => b.escore - a.escore || b.it.amostra - a.it.amostra);
  if (!pontuados.length) return { itens: itens.slice(0, Math.min(10, limite)), aproximados: true };
  return { itens: pontuados.slice(0, limite).map((x) => x.it), aproximados: false };
}
