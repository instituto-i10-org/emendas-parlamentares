"use server";

import { podeGerirPlanejamento, temPermissao } from "@/lib/authz";
import { calcularImpacto, type PedidoImpacto } from "@/lib/impacto/servidor";
import type { Impacto } from "@/lib/impacto/tipos";
import { getCurrentUser } from "@/lib/session";

// Consulta do impacto para a janela de confirmação. Só leitura; exige a mesma
// permissão da ação que a janela vai confirmar.
export async function consultarImpacto(pedido: PedidoImpacto): Promise<{ ok: true; impacto: Impacto } | { ok: false; erro: string }> {
  const user = await getCurrentUser();
  const pode = (() => {
    switch (pedido.tipo) {
      case "configuracao":
      case "statusExercicio":
      case "regras":
      case "parametrosValidacao":
        return temPermissao(user, "gerirExercicios");
      case "statusInstrumento":
      case "gerarLei":
        return podeGerirPlanejamento(user);
      default:
        return temPermissao(user, "administrarConfiguracoes");
    }
  })();
  if (!pode) return { ok: false, erro: "Sem permissão para esta alteração." };
  return { ok: true, impacto: await calcularImpacto(pedido) };
}
