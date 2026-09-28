import "server-only";
import { redirect } from "next/navigation";
import { Poder } from "@/generated/prisma/enums";
import { auth } from "./auth";
import type { Ator } from "./authz";

// ============================================================================
// Sessão autenticada (Auth.js). O perfil de acesso — Poder + permissões — é
// gravado no token no login: alterações de perfil valem no próximo login.
//
// Sem sessão, volta ao login, em qualquer ambiente. Conta sem perfil também
// volta, com aviso.
// ============================================================================

export type SessionUser = Ator & {
  nome: string;
  email: string;
  poder: Poder | null;
};

export async function getCurrentUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const perfil = session.user.perfil ?? null;
  if (!perfil) redirect("/login?erro=sem-perfil");
  return {
    id: session.user.id,
    nome: session.user.name ?? session.user.email ?? "Usuário",
    email: session.user.email ?? "",
    poder: perfil.poder,
    perfil,
  };
}
