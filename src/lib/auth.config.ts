import type { NextAuthConfig } from "next-auth";
import type { Perfil } from "./authz";

// Configuração EDGE-SAFE (sem Prisma/adapter) — usada pelo middleware e
// estendida em auth.ts com o provedor de credenciais.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // "/" é a landing e /publica/* o portal do cidadão: consulta sem login
      // (transparência ativa — STF/TCE). Todo o resto exige sessão.
      if (
        pathname === "/" ||
        pathname === "/login" ||
        pathname === "/publica" ||
        pathname.startsWith("/publica/") ||
        pathname.startsWith("/api/auth")
      )
        return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      // Só no login: o perfil é fotografado aqui e não é relido a cada
      // requisição. Mudança de perfil vale no PRÓXIMO login do afetado.
      if (user) {
        token.id = user.id;
        token.perfil = user.perfil ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        // Token anterior à implantação não traz perfil: fica nulo e o guard de
        // sessão devolve ao login com aviso, uma única vez.
        session.user.perfil = (token.perfil as Perfil | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
