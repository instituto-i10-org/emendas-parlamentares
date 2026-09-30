import { norm } from "./texto";
import type { TipoDestino } from "./tipos";

// Tipo de equipamento público, pelo nome do destino. O padrão é aplicado ao
// nome comum ("EMEI Aida Rocha") e ao nome oficial ("AIDA ROCHA EMEI"), os
// dois sem acentos e em minúsculas. O primeiro tipo que casa vale.
export function tipoDoDestino(
  nome: string,
  nomeOficial: string | null | undefined,
  tipos: TipoDestino[] | undefined
): TipoDestino | null {
  if (!tipos?.length) return null;
  const textos = [norm(nome), norm(nomeOficial ?? "")].filter(Boolean);
  for (const t of tipos) {
    let re: RegExp;
    try {
      re = new RegExp(t.padrao, "i");
    } catch {
      continue;
    }
    if (textos.some((x) => re.test(x))) return t;
  }
  return null;
}

export const subfuncaoDoDestino = (nome: string, nomeOficial: string | null | undefined, tipos: TipoDestino[] | undefined) =>
  tipoDoDestino(nome, nomeOficial, tipos)?.subfuncao ?? null;

export const pistasDoDestino = (nome: string, nomeOficial: string | null | undefined, tipos: TipoDestino[] | undefined) =>
  tipoDoDestino(nome, nomeOficial, tipos)?.pistas ?? [];
