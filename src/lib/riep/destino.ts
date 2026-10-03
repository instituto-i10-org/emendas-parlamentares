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

// --- alcance orçamentário do destino -----------------------------------------
//
// O destino aponta para uma unidade orçamentária ("13.01") ou para o órgão
// inteiro ("20"), quando o órgão é o próprio equipamento e o orçamento dele se
// divide por serviço: o Hospital tem uma unidade para cada setor, e a emenda é
// para o Hospital. O cadastro de destinos é um só para todos os exercícios; por
// isso a unidade que não existe no exercício em uso vale pelo órgão dela.
export function unidadesDoDestino(uo: string | null | undefined, codigos: Iterable<string>): string[] {
  if (!uo) return [];
  const existentes = [...new Set(codigos)];
  if (uo.includes(".") && existentes.includes(uo)) return [uo];
  const orgao = uo.split(".")[0];
  const doOrgao = existentes.filter((u) => u.split(".")[0] === orgao).sort();
  return doOrgao.length ? doOrgao : [uo];
}

// O nome do alcance: o da unidade ou, quando são várias, o do órgão.
export function nomeDoAlcance(uo: string | null | undefined, unidades: Record<string, string>): string | null {
  const alvo = unidadesDoDestino(uo, Object.keys(unidades));
  if (!alvo.length) return null;
  if (alvo.length === 1) return unidades[alvo[0]] ?? null;
  const orgao = (unidades[alvo[0]] ?? "").split(" — ")[0];
  return `${orgao} (${alvo.length} unidades)`;
}
