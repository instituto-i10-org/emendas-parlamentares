import { temPermissao, type Ator } from "@/lib/authz";
import type { UsoArquivo } from "./regras";

// Quem envia arquivo para cada uso.
export function podeEnviarArquivo(a: Ator, uso: UsoArquivo): boolean {
  if (uso === "NORMA") return temPermissao(a, "administrarConfiguracoes");
  return temPermissao(a, "gerirPlanejamento");
}

// Caminho que o navegador pode usar no envio direto: o prefixo do uso, a data
// e um nome aleatório. O servidor confere antes de aceitar.
export const CHAVE_VALIDA = /^(peca_orcamentaria|norma|importacao)\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{32}(\.[a-z0-9]{1,5})?$/;
