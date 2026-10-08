// Valores e datas por extenso, como pedem os documentos oficiais
// ("R$ 1.250,00 (um mil, duzentos e cinquenta reais)").

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

// 0 a 999.
function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) {
    if (r < 20) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

const ESCALAS: [string, string][] = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
];

// Inteiro por extenso (até 999 bilhões). O "e" entre os grupos segue o uso
// corrente: "mil e duzentos", "um milhão, duzentos mil e quinhentos".
export function inteiroPorExtenso(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("Inteiro não negativo esperado.");
  if (n === 0) return "zero";
  const grupos: number[] = [];
  for (let x = n; x > 0; x = Math.floor(x / 1000)) grupos.push(x % 1000);
  if (grupos.length > ESCALAS.length) throw new Error("Valor grande demais.");
  const partes: { texto: string; valor: number }[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    const [sing, plur] = ESCALAS[i];
    const base = i === 1 && g === 1 ? "um" : ate999(g);
    partes.push({ texto: i === 0 ? base : `${base} ${g === 1 ? sing : plur}`, valor: g });
  }
  return partes
    .map((p, i) => {
      if (i === 0) return p.texto;
      // Último grupo: "e" quando é menor que 100 ou centena redonda.
      const ultimo = i === partes.length - 1;
      return (ultimo && (p.valor < 100 || p.valor % 100 === 0) ? " e " : ", ") + p.texto;
    })
    .join("");
}

// Valor em reais por extenso: "duzentos e oitenta e seis mil, novecentos e
// quarenta e quatro reais e onze centavos".
export function reaisPorExtenso(valor: number): string {
  const centavosTotal = Math.round(valor * 100);
  if (centavosTotal < 0) throw new Error("Valor negativo.");
  const reais = Math.floor(centavosTotal / 100);
  const centavos = centavosTotal % 100;
  const partes: string[] = [];
  if (reais) {
    const txt = inteiroPorExtenso(reais);
    // "um milhão de reais", "dois mil reais".
    const de = reais % 1_000_000 === 0 ? " de" : "";
    partes.push(`${txt}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.length ? partes.join(" e ") : "zero real";
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// "8 de outubro de 2026", no fuso de Brasília.
export function dataPorExtenso(d: Date): string {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return `${v("day")} de ${MESES[v("month") - 1]} de ${v("year")}`;
}
