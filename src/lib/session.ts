import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { Poder } from "@/generated/prisma/enums";
import { auth } from "./auth";
import { PERMISSOES, type Ator, type Perfil } from "./authz";
import { prisma } from "./prisma";

// ============================================================================
// Sessão autenticada (Auth.js). O token diz QUEM é; o que a pessoa PODE vem do
// banco a cada requisição. Assim, uma permissão retirada deixa de valer na
// ação seguinte, sem esperar novo login, e conta desativada sai na hora.
//
// Sem sessão, volta ao login. Conta sem perfil ou desativada também volta,
// com aviso.
// ============================================================================

export type SessionUser = Ator & {
  nome: string;
  email: string;
  poder: Poder | null;
};

// Perfil lido do banco, uma vez por requisição.
const lerConta = cache(async (id: string) =>
  prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, ativo: true, perfil: true } })
);

export function paraPerfil(p: NonNullable<Awaited<ReturnType<typeof lerConta>>>["perfil"]): Perfil | null {
  if (!p) return null;
  return {
    id: p.id,
    nome: p.nome,
    poder: p.poder,
    adminGeral: p.adminGeral,
    perfilDoSistema: p.perfilDoSistema,
    ...(Object.fromEntries(PERMISSOES.map((k) => [k, p[k]])) as Record<(typeof PERMISSOES)[number], boolean>),
  };
}

// Para rotas de API: devolve nulo em vez de redirecionar.
export async function usuarioDaSessao(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const conta = await lerConta(session.user.id);
  const perfil = conta?.ativo ? paraPerfil(conta.perfil) : null;
  if (!conta || !perfil) return null;
  return { id: conta.id, nome: conta.name ?? conta.email ?? "Usuário", email: conta.email ?? "", poder: perfil.poder, perfil };
}

export async function getCurrentUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const conta = await lerConta(session.user.id);
  if (!conta) redirect("/login");
  if (!conta.ativo) redirect("/login?erro=inativo");
  const perfil = paraPerfil(conta.perfil);
  if (!perfil) redirect("/login?erro=sem-perfil");
  return {
    id: conta.id,
    nome: conta.name ?? conta.email ?? "Usuário",
    email: conta.email ?? "",
    poder: perfil.poder,
    perfil,
  };
}
