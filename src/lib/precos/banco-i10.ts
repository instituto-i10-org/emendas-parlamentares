// Banco de preços i10: mediana e faixa de preço de compras públicas do mesmo
// item. É só uma referência para o autor ver ao lado da linha: nunca preenche
// o valor unitário nem entra na conferência da emenda.

export type ReferenciaBanco = {
  item: string;
  unidade: string | null;
  mediana: number;
  faixaMin: number | null;
  faixaMax: number | null;
  // Quantas compras e quantos municípios entraram na mediana (quando há).
  compras: number | null;
  municipios: number | null;
  fonte: string;
};

export type ConsultaBanco = { ok: true; resultados: ReferenciaBanco[] } | { ok: false; erro: string };

export const BANCO_PRECOS_PADRAO = "https://pnigp.vercel.app";
export const INDISPONIVEL = "Referência indisponível agora. Pesquise nas fontes oficiais.";
const MAX_RESULTADOS = 5;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

// A resposta do banco como chega ({ resultados: [...] }), filtrada ao que se
// mostra: sem mediana não há referência; no máximo cinco linhas.
export function lerRespostaBanco(corpo: unknown): ReferenciaBanco[] {
  const lista = (corpo as { resultados?: unknown })?.resultados;
  if (!Array.isArray(lista)) return [];
  const saida: ReferenciaBanco[] = [];
  for (const r of lista as Record<string, unknown>[]) {
    const mediana = num(r?.mediana);
    const item = txt(r?.item);
    if (mediana === null || mediana <= 0 || !item) continue;
    const compras = num(r.n);
    saida.push({
      item,
      unidade: txt(r.unidade),
      mediana,
      faixaMin: num(r.faixaMin),
      faixaMax: num(r.faixaMax),
      compras: compras && compras > 0 ? compras : null,
      municipios: num(r.nMunis),
      fonte: txt(r.fonte) ?? "Banco de preços i10",
    });
    if (saida.length >= MAX_RESULTADOS) break;
  }
  return saida;
}

// Termo de busca: o nome do item, sem espaços sobrando, até 120 caracteres.
export const termoBusca = (item: string) => item.replace(/\s+/g, " ").trim().slice(0, 120);

// Consulta feita pelo servidor, com tempo limite de 5 s e cache de 10 min.
// Qualquer falha (rede, tempo, formato) vira o aviso de indisponível.
export async function consultarBancoI10(item: string, base = process.env.BANCO_PRECOS_URL ?? BANCO_PRECOS_PADRAO): Promise<ConsultaBanco> {
  const q = termoBusca(item);
  if (q.length < 3) return { ok: false, erro: "Escreva o nome do item (ao menos 3 letras) para ver a referência." };
  if (!base) return { ok: false, erro: INDISPONIVEL };
  try {
    const resp = await fetch(`${base.replace(/\/$/, "")}/api/banco-precos?q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 600 },
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return { ok: false, erro: INDISPONIVEL };
    return { ok: true, resultados: lerRespostaBanco(await resp.json()) };
  } catch {
    return { ok: false, erro: INDISPONIVEL };
  }
}
