"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { anoPadrao, COOKIE_EXERCICIO, listarExercicios } from "@/lib/exercicio";

// Troca o exercício em exibição. É preferência de navegação, não permissão:
// vale também no portal público, e o que cada perfil pode fazer continua
// decidido em cada tela. A escolha dura a sessão do navegador — na visita
// seguinte volta a abrir o exercício padrão (o aberto mais recente).
export async function definirExercicioAtivo(ano: number): Promise<void> {
  const lista = await listarExercicios();
  if (!lista.some((e) => e.ano === ano)) return;
  const jar = await cookies();
  if (ano === anoPadrao(lista)) jar.delete(COOKIE_EXERCICIO);
  else jar.set(COOKIE_EXERCICIO, String(ano), { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}
