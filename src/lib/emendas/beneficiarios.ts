// ============================================================================
// Beneficiários com grafias parecidas ou CNPJ repetido: candidatos à
// mesclagem, que o usuário confirma. Puro.
// ============================================================================

const ABREVIACOES: [RegExp, string][] = [
  [/\bassoc\b/g, "associacao"],
  [/\bbenef\b/g, "beneficente"],
  [/\bsta\b/g, "santa"],
  [/\bsto\b/g, "santo"],
  [/\bs\b/g, "sao"],
  [/\bn\s*s\b/g, "nossa senhora"],
  [/\bnsa\b/g, "nossa senhora"],
  [/\bprof\b/g, "professor"],
  [/\bprofa\b/g, "professora"],
  [/\bdr\b/g, "doutor"],
  [/\bdra\b/g, "doutora"],
  [/\bpe\b/g, "padre"],
  [/\bmun\b/g, "municipal"],
  [/\besc\b/g, "escola"],
  [/\bemef\b/g, "escola municipal de ensino fundamental"],
  [/\bemei\b/g, "escola municipal de educacao infantil"],
  [/\bubs\b/g, "unidade basica de saude"],
  [/\bapae\b/g, "associacao de pais e amigos dos excepcionais"],
  [/\binst\b/g, "instituto"],
  [/\bfund\b/g, "fundacao"],
  [/\bcia\b/g, "companhia"],
];
const VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);

// Nome reduzido ao que importa: sem acento, sem caixa, abreviações expandidas,
// sem pontuação e sem palavras de ligação.
export function chaveNome(nome: string): string {
  let s = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,;:()/\\\-–—"'ºª°]/g, " ");
  for (const [r, v] of ABREVIACOES) s = s.replace(r, v);
  return s
    .split(/\s+/)
    .filter((p) => p && !VAZIAS.has(p))
    .join(" ");
}

export type Beneficiario = { id: string; nome: string; cnpj: string | null; execucao: string; ativo: boolean; emendas: number };
export type ParDuplicado = { a: Beneficiario; b: Beneficiario; motivo: "NOME" | "CNPJ" };

export function possiveisDuplicados(lista: Beneficiario[]): ParDuplicado[] {
  const ativos = lista.filter((x) => x.ativo);
  const pares: ParDuplicado[] = [];
  const visto = new Set<string>();
  const add = (a: Beneficiario, b: Beneficiario, motivo: ParDuplicado["motivo"]) => {
    const k = [a.id, b.id].sort().join("|");
    if (visto.has(k)) return;
    visto.add(k);
    pares.push({ a, b, motivo });
  };
  const porCnpj = new Map<string, Beneficiario[]>();
  const porNome = new Map<string, Beneficiario[]>();
  for (const x of ativos) {
    const c = (x.cnpj ?? "").replace(/\D/g, "");
    if (c.length === 14) porCnpj.set(c, [...(porCnpj.get(c) ?? []), x]);
    const n = `${x.execucao}|${chaveNome(x.nome)}`;
    porNome.set(n, [...(porNome.get(n) ?? []), x]);
  }
  for (const g of porCnpj.values()) for (let i = 1; i < g.length; i++) add(g[0], g[i], "CNPJ");
  for (const g of porNome.values()) for (let i = 1; i < g.length; i++) add(g[0], g[i], "NOME");
  return pares;
}
