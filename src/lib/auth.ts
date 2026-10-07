import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { registrarAuditoria } from "./audit";
import { chaveFalhaEmail, chaveFalhaIp, loginBloqueado } from "./login-limite";
import { prisma } from "./prisma";
import { limparTentativas, registrarTentativa } from "./rate-limit";

const ipDe = (req: Request | undefined) =>
  (req?.headers.get("x-forwarded-for")?.split(",")[0] ?? req?.headers.get("x-real-ip") ?? "desconhecido").trim().slice(0, 64);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      async authorize(creds, req) {
        const email = String(creds?.email ?? "").trim().toLowerCase().slice(0, 200);
        const senha = String(creds?.senha ?? "");
        if (!email || !senha) return null;
        const ip = ipDe(req);

        // Bloqueio vale aqui, e não só na tela: a rota de login pode ser chamada direto.
        if (await loginBloqueado(email, ip)) {
          await registrarAuditoria({ entidade: "Login", entidadeId: email, acao: "LOGIN_BLOQUEADO", dadosDepois: { ip } });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const ok = !!user?.passwordHash && user.ativo && (await bcrypt.compare(senha, user.passwordHash));
        if (!ok) {
          await Promise.all([registrarTentativa(chaveFalhaEmail(email)), registrarTentativa(chaveFalhaIp(ip))]);
          await registrarAuditoria({
            usuarioId: user?.id ?? null,
            entidade: "Login",
            entidadeId: email,
            acao: user && !user.ativo ? "LOGIN_RECUSADO_CONTA_INATIVA" : "LOGIN_RECUSADO",
            dadosDepois: { ip },
          });
          return null;
        }

        await limparTentativas(chaveFalhaEmail(email));
        await registrarAuditoria({ usuarioId: user!.id, entidade: "Login", entidadeId: email, acao: "LOGIN", dadosDepois: { ip } });
        // O perfil não vai no token: a sessão o relê do banco a cada requisição.
        return { id: user!.id, name: user!.name, email: user!.email };
      },
    }),
  ],
});
