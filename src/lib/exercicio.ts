import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { SeletorExercicioDados } from "./ciclo";
import { prisma } from "./prisma";

// Helpers de ciclo vivem em ./ciclo (módulo puro, usado também no cliente).
export { anoElaboracao, rotuloCiclo, descricaoCiclo } from "./ciclo";

// ============================================================================
// Exercício (ano orçamentário) ativo. Fica em cookie; sem cookie válido, vale
// o exercício aberto mais recente.
// ============================================================================

export const COOKIE_EXERCICIO = "exercicio-ativo";

export type ExercicioOpcao = { id: string; ano: number; status: string };

export const listarExercicios = cache(async (): Promise<ExercicioOpcao[]> => {
  const rows = await prisma.exercicio.findMany({
    orderBy: { ano: "desc" },
    select: { id: true, ano: true, status: true },
  });
  return rows;
});

// O exercício que abre para quem não escolheu outro: o aberto mais recente.
export function anoPadrao(lista: ExercicioOpcao[]): number | null {
  return (lista.find((e) => e.status === "ABERTO") ?? lista[0])?.ano ?? null;
}

export async function getAnoAtivo(): Promise<number | null> {
  const lista = await listarExercicios();
  const jar = await cookies();
  const cookieAno = Number(jar.get(COOKIE_EXERCICIO)?.value);
  if (cookieAno && lista.some((e) => e.ano === cookieAno)) return cookieAno;
  return anoPadrao(lista);
}

// Histórico: exercício anterior ao que abre por padrão. Continua consultável,
// com tramitação e execução, mas não recebe emenda nova nem alteração de
// rascunho — a elaboração é do exercício em curso.
export async function exercicioHistorico(ano: number): Promise<boolean> {
  const padrao = anoPadrao(await listarExercicios());
  return padrao !== null && ano < padrao;
}

// O ano que a tela está editando. A tela manda o seu; sem ele, ou com ano que
// não existe, vale o ativo. É o que impede uma aba gravar no ano que outra aba
// escolheu no seletor: a emenda de 2026 continua em 2026.
export async function anoDaTela(ano?: number | null): Promise<number | null> {
  if (ano && (await listarExercicios()).some((e) => e.ano === ano)) return ano;
  return getAnoAtivo();
}

// O que o seletor de exercício precisa: o ano em exibição, o padrão e os anos
// disponíveis, do mais recente para o mais antigo.
export async function getSeletorExercicio(): Promise<SeletorExercicioDados | null> {
  const lista = await listarExercicios();
  const [ativo, padrao] = [await getAnoAtivo(), anoPadrao(lista)];
  if (ativo === null || padrao === null) return null;
  return { ativo, padrao, anos: lista.map((e) => e.ano) };
}
