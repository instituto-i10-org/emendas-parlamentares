import type { DefaultSession } from "next-auth";

// O token leva só o id da conta; o perfil é relido do banco a cada requisição.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
