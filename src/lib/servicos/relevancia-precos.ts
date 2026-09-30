import { norm } from "@/lib/riep/texto";

// Palavras que não distinguem um item de outro na busca de preços.
const FRACAS = new Set(["de", "da", "do", "das", "dos", "para", "com", "em", "e", "ou", "a", "o", "as", "os", "um", "uma", "por", "sem"]);

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const palavras = (s: string) =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !FRACAS.has(w));

// Ordena os resultados de uma fonte de preços pela relação com a consulta.
//
// As descrições do PNIGP são fichas técnicas longas: "beterraba in natura…
// material terroso… adequadas para o consumo" contém "material" e "consumo"
// e não tem nada a ver com material de consumo. Por isso a palavra solta não
// basta: o que conta é a EXPRESSÃO — as palavras da consulta, na ordem, com
// no máximo duas palavras entre elas. Entre os que têm a expressão, os mais
// curtos e de amostra maior primeiro. Sem nenhuma expressão, a lista original
// volta inteira, marcada como aproximada — nunca "nada".
export function ordenarPorRelevancia<T extends { descricao: string; amostra: number }>(
  consulta: string,
  itens: T[],
  limite = 30
): { itens: T[]; aproximados: boolean } {
  const termos = palavras(consulta);
  if (!termos.length) return { itens: itens.slice(0, limite), aproximados: false };
  const expressao = new RegExp(
    `(^|[^a-z0-9])${termos.map((t) => `${escapar(t)}(?:s|es)?`).join("(?:[^a-z0-9]+[a-z0-9]+){0,2}[^a-z0-9]+")}([^a-z0-9]|$)`
  );
  const pontuados = itens
    .map((it) => {
      const texto = norm(it.descricao);
      const m = expressao.exec(texto);
      if (!m) return null;
      // Expressão no início da descrição vale mais; descrição longa vale menos.
      const escore = 100 + (m.index < 20 ? 20 : 0) - Math.min(40, Math.floor(texto.length / 60));
      return { it, escore };
    })
    .filter((x): x is { it: T; escore: number } => x !== null)
    .sort((a, b) => b.escore - a.escore || b.it.amostra - a.it.amostra);
  if (!pontuados.length) return { itens: itens.slice(0, Math.min(10, limite)), aproximados: true };
  return { itens: pontuados.slice(0, limite).map((x) => x.it), aproximados: false };
}
