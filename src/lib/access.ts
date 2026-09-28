import "server-only";
import { redirect } from "next/navigation";
import { Poder } from "@/generated/prisma/enums";
import { getCurrentUser, type SessionUser } from "./session";
import { alcancaPoder, temPermissao, type Permissao } from "./authz";

// ============================================================================
// Guards de rota no servidor. Ocultar o item do menu não é controle de acesso:
// toda página e toda server action passa por aqui. Poder e permissões são
// conjuntivos — ter a permissão não abre o módulo do outro Poder.
// ============================================================================

export async function requireAccess(opts: { poder?: Poder; permissoes?: Permissao[] } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (opts.poder && !alcancaPoder(user, opts.poder)) redirect("/inicio?erro=acesso-negado");
  if (opts.permissoes?.length && !temPermissao(user, ...opts.permissoes)) redirect("/inicio?erro=acesso-negado");
  return user;
}
