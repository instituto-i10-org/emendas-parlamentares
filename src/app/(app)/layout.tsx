import type { ReactNode } from "react";
import { AppShell } from "@/components/app/shell";
import { navegacaoVisivel } from "@/config/navegacao";
import { getAnoAtivo } from "@/lib/exercicio";
import { getCurrentUser } from "@/lib/session";

// Casca autenticada: menu lateral com os itens que o perfil alcança.
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const ano = await getAnoAtivo();
  return (
    <AppShell
      grupos={navegacaoVisivel(user)}
      usuario={{ nome: user.nome, perfil: user.perfil?.nome ?? "" }}
      exercicio={ano}
    >
      {children}
    </AppShell>
  );
}
