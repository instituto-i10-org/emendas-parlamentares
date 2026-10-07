import type { ReactNode } from "react";
import { AppShell } from "@/components/app/shell";
import { PrimeiroAcesso } from "@/components/conta/primeiro-acesso";
import { navegacaoVisivel } from "@/config/navegacao";
import { apresentaEmendas } from "@/lib/authz";
import { getSeletorExercicio } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Casca autenticada: menu lateral com os itens que o perfil alcança.
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const [exercicio, autor, conta] = await Promise.all([
    getSeletorExercicio(),
    prisma.autor.findUnique({ where: { usuarioId: user.id }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { primeiroAcesso: true } }),
  ]);
  return (
    <AppShell
      grupos={navegacaoVisivel(user, { apresenta: apresentaEmendas(user, !!autor) })}
      usuario={{ nome: user.nome, perfil: user.perfil?.nome ?? "" }}
      exercicio={exercicio}
    >
      {children}
      {conta?.primeiroAcesso ? <PrimeiroAcesso nome={user.nome} email={user.email} /> : null}
    </AppShell>
  );
}
