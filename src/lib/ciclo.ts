// ---------------------------------------------------------------------------
// Ciclo orçamentário — funções puras, usadas no servidor E no cliente.
//
// Um exercício envolve DOIS anos: a emenda de 2027 é elaborada durante 2026,
// sobre o projeto de lei que o Executivo manda naquele ano. Mostrar só "2027"
// no seletor faz parecer que estamos no ano de 2027 — foi exatamente a
// confusão apontada pelo jurídico do cliente. O rótulo "2026/2027"
// (elaboração/execução) desfaz a ambiguidade.
//
// Sem "server-only" de propósito: a topbar é client component.
// ---------------------------------------------------------------------------

export function anoElaboracao(anoExercicio: number): number {
  return anoExercicio - 1;
}

/** "2026/2027" — ano em que a emenda é elaborada / ano em que é executada. */
export function rotuloCiclo(anoExercicio: number): string {
  return `${anoElaboracao(anoExercicio)}/${anoExercicio}`;
}

/** O que o seletor de exercício mostra: o ano em exibição, o padrão e os disponíveis. */
export type SeletorExercicioDados = { ativo: number; padrao: number; anos: number[] };

/** "Histórico" quando o ano em exibição é anterior ao que abre por padrão. */
export function rotuloExercicio({ ativo, padrao }: Pick<SeletorExercicioDados, "ativo" | "padrao">): string {
  return ativo < padrao ? "Histórico" : "Exercício";
}

/** Frase por extenso, para tooltip e cabeçalho. */
export function descricaoCiclo(anoExercicio: number): string {
  return `emendas elaboradas em ${anoElaboracao(anoExercicio)} para o orçamento de ${anoExercicio}`;
}
