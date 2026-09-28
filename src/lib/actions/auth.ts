"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

export type LoginState = string | null;

export async function entrar(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
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
  await signOut({ redirectTo: "/login" });
}
