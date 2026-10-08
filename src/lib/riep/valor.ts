// Valor da emenda e conferência da planilha.
//
// O valor da emenda é o que o vereador informa no passo 1. A memória de
// cálculo comprova esse valor: a soma das linhas é conferida contra ele, com a
// tolerância do exercício. Sem valor informado, vale a soma da planilha.

const centavos = (v: number) => Math.round(v * 100);

export function valorDaEmenda(informado: number, somaPlanilha: number): number {
  return centavos(informado) > 0 ? centavos(informado) / 100 : centavos(somaPlanilha) / 100;
}

export type ConferenciaPlanilha = {
  // sem-valor: nada informado no passo 1 (vale a soma); vazia: planilha sem
  // preço; igual: soma = valor; dentro: difere, até a tolerância (aviso);
  // fora: difere acima da tolerância (trava).
  estado: "sem-valor" | "vazia" | "igual" | "dentro" | "fora";
  valor: number;
  soma: number;
  // soma − valor: negativo quando a planilha fica abaixo do valor.
  diferenca: number;
  pct: number;
};

export function conferirPlanilha(informado: number, soma: number, toleranciaPct: number): ConferenciaPlanilha {
  const v = centavos(informado);
  const s = centavos(soma);
  const base = { valor: v / 100, soma: s / 100, diferenca: (s - v) / 100, pct: v > 0 ? (Math.abs(s - v) / v) * 100 : 0 };
  if (v <= 0) return { ...base, estado: "sem-valor", diferenca: 0, pct: 0 };
  if (s <= 0) return { ...base, estado: "vazia" };
  if (s === v) return { ...base, estado: "igual" };
  return { ...base, estado: base.pct <= toleranciaPct ? "dentro" : "fora" };
}
