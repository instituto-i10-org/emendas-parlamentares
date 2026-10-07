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

// --- código de órgão e de unidade --------------------------------------------
//
// O órgão é o código da unidade sem o último segmento: "13.01" é do órgão
// "13" (Mogi Guaçu, dois níveis); "02.04.02" é do "02.04" (Borborema, em que a
// unidade executora fica abaixo da unidade orçamentária).
export function orgaoDaUnidade(uo: string | null | undefined): string {
  const s = String(uo ?? "");
  const i = s.lastIndexOf(".");
  return i > 0 ? s.slice(0, i) : s;
}

// A unidade pertence ao órgão (ou é ele)? "02.04.02" pertence a "02.04" e a "02".
export function pertence(uo: string | null | undefined, orgao: string): boolean {
  const s = String(uo ?? "");
  return !!orgao && (s === orgao || s.startsWith(orgao + "."));
}

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
  if (existentes.includes(uo)) return [uo];
  // O destino aponta para um órgão ("20", "02.05"): todas as unidades dele. Se
  // aponta para unidade que não existe no exercício, vale o órgão da unidade.
  const prefixo = existentes.some((u) => pertence(u, uo)) ? uo : orgaoDaUnidade(uo);
  const doOrgao = existentes.filter((u) => pertence(u, prefixo)).sort();
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
