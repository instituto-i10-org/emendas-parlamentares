// Normalização de texto do motor. Minúsculas e sem acentos; a pontuação fica,
// porque o casamento por palavra inteira depende dela.
export function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const escaparRegex = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Formas de plural aceitas para cada palavra do termo.
function alternativas(w: string): string[] {
  const a = [w];
  if (/ao$/.test(w)) a.push(w.replace(/ao$/, "oes")); // construção → construções
  if (/l$/.test(w)) a.push(w.replace(/l$/, "is")); // material → materiais
  if (/m$/.test(w)) a.push(w.replace(/m$/, "ns")); // homem → homens
  if (/r$/.test(w)) a.push(w + "es"); // mulher → mulheres
  return a.map(escaparRegex);
}

const cacheRegex = new Map<string, RegExp | null>();

// O texto (já normalizado) contém o termo como palavra inteira? "recursos" não
// casa com "curso"; "materiais escolares" casa com "material escolar".
export function contem(textoNormalizado: string, termo: string): boolean {
  let re = cacheRegex.get(termo);
  if (re === undefined) {
    const partes = norm(termo)
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `(?:${alternativas(w).join("|")})(?:s|es)?`);
    re = partes.length ? new RegExp(`(^|[^a-z0-9])${partes.join("\\s+")}([^a-z0-9]|$)`) : null;
    cacheRegex.set(termo, re);
  }
  return re ? re.test(textoNormalizado) : false;
}

export const BRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const NUM = (v: number | null | undefined) => (v == null ? "" : Number(v).toLocaleString("pt-BR"));

export const PCT = (v: number | null | undefined) => (v ?? 0).toFixed(1).replace(".", ",") + "%";

export const padEsquerda = (v: string | number | null | undefined, digitos: number) =>
  String(v ?? "").padStart(digitos, "0");

// Arredonda para centavos: toda comparação de dinheiro passa por aqui.
export const centavos = (v: number) => Math.round(v * 100);
