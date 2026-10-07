"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { registrarAuditoria } from "@/lib/audit";
import { auth, signIn, signOut } from "@/lib/auth";
import { LOGIN_JANELA_MS, loginBloqueado } from "@/lib/login-limite";

export type LoginState = string | null;

export async function entrar(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "desconhecido").trim();
  if (email && (await loginBloqueado(email, ip))) {
    return `Muitas tentativas com senha errada. Por segurança, o acesso fica bloqueado por ${LOGIN_JANELA_MS / 60_000} minutos.`;
  }
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      senha: formData.get("senha"),
      redirectTo: "/inicio",
    });
    return null;
  } catch (e) {
    if (e instanceof AuthError) return "E-mail ou senha inválidos.";
    throw e; // deixa o redirect de sucesso propagar
  }
}

export async function sair() {
  const s = await auth();
  if (s?.user?.id) await registrarAuditoria({ usuarioId: s.user.id, entidade: "Login", entidadeId: s.user.email ?? s.user.id, acao: "LOGOUT" });
  await signOut({ redirectTo: "/login" });
}
