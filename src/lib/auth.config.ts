import type { NextAuthConfig } from "next-auth";

// Configuração EDGE-SAFE (sem Prisma/adapter) — usada pelo middleware e
// estendida em auth.ts com o provedor de credenciais.
export const authConfig = {
  pages: { signIn: "/login" },
  // Sessão de 8 horas: um expediente.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
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
        pathname.startsWith("/api/auth") ||
        // As rotas de arquivo conferem a permissão elas mesmas: o arquivo
        // público baixa sem login.
        pathname.startsWith("/api/arquivos/")
      )
        return true;
      return !!auth?.user;
    },
    // O token guarda só quem é. O perfil é relido do banco a cada requisição
    // (src/lib/session.ts): permissão retirada vale na ação seguinte.
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = (token.id as string) ?? token.sub ?? "";
      return session;
    },
  },
} satisfies NextAuthConfig;
