import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { GuiasProvider } from "@/components/app/guias";
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
  const [exercicio, autor, conta, guiasVistos, jar] = await Promise.all([
    getSeletorExercicio(),
    prisma.autor.findUnique({ where: { usuarioId: user.id }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { primeiroAcesso: true } }),
    prisma.guiaVisto.findMany({ where: { usuarioId: user.id }, select: { guia: true, versao: true } }),
    cookies(),
  ]);
  // Guias abrem sozinhos na primeira visita. Nos testes automáticos ficam
  // desligados (GUIAS_AUTOMATICOS=false), salvo o teste que liga pelo cookie.
  const automaticos = process.env.GUIAS_AUTOMATICOS !== "false" || jar.get("guias-automaticos")?.value === "1";
  return (
    <GuiasProvider
      vistos={Object.fromEntries(guiasVistos.map((g) => [g.guia, g.versao]))}
      automaticos={automaticos}
      bloqueado={!!conta?.primeiroAcesso}
    >
      <AppShell
        grupos={navegacaoVisivel(user, { apresenta: apresentaEmendas(user, !!autor) })}
        usuario={{ nome: user.nome, perfil: user.perfil?.nome ?? "" }}
        exercicio={exercicio}
      >
        {children}
        {conta?.primeiroAcesso ? <PrimeiroAcesso nome={user.nome} email={user.email} /> : null}
      </AppShell>
    </GuiasProvider>
  );
}
