import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Proxy (novo nome do middleware no Next 16): edge-safe, protege as rotas em
// produção. Em desenvolvimento o callback `authorized` libera o acesso.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // /api/arquivos fica de fora: as rotas conferem a permissão elas mesmas, e
    // o proxy limitaria o tamanho do envio local.
    "/((?!_next/static|_next/image|favicon.ico|api/arquivos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
