"use server";

import { podeCriarEmenda } from "@/lib/authz";
import { consultarBancoI10, type ConsultaBanco } from "@/lib/precos/banco-i10";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

// "Ver referência" na linha da memória de cálculo: quem elabora emendas
// consulta o banco de preços i10 pelo nome do item. Só leitura; nada é gravado.
export async function verReferenciaPreco(item: string): Promise<ConsultaBanco> {
  const user = await getCurrentUser();
  if (!user || !podeCriarEmenda(user)) return { ok: false, erro: "Sem permissão para consultar referências." };
  if (typeof item !== "string") return { ok: false, erro: "Item inválido." };
  if (!(await rateLimit(`referencia-preco:${user.id}`, 30, 60_000))) {
    return { ok: false, erro: "Muitas consultas seguidas. Aguarde um minuto." };
  }
  return consultarBancoI10(item);
}
