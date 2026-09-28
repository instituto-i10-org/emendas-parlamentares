import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
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

export async function getAnoAtivo(): Promise<number | null> {
  const lista = await listarExercicios();
  const jar = await cookies();
  const cookieAno = Number(jar.get(COOKIE_EXERCICIO)?.value);
  if (cookieAno && lista.some((e) => e.ano === cookieAno)) return cookieAno;
  return (lista.find((e) => e.status === "ABERTO") ?? lista[0])?.ano ?? null;
}
