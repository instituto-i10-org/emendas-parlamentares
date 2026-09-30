import { norm } from "@/lib/riep/texto";

// Duas emendas são "a mesma" quando têm o mesmo destino, a mesma forma de
// execução e o mesmo objeto, comparado sem caixa, acentos, pontuação e
// espaços repetidos. É o que aconteceu com a nº 355 do relatório de testes
// (duplicata da 362 por uma rotina interrompida) e o que um clique duplo faria.
export type ChaveEmenda = { destinoId: string | null; execucao: string; objeto: string };

export const objetoNormalizado = (objeto: string) =>
  norm(objeto)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function mesmaEmenda(a: ChaveEmenda, b: ChaveEmenda): boolean {
  if (!a.destinoId || !b.destinoId) return false;
  return a.destinoId === b.destinoId && a.execucao === b.execucao && objetoNormalizado(a.objeto) === objetoNormalizado(b.objeto);
}
