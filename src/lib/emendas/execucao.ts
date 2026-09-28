// Execução orçamentária da emenda (Lei 4.320/1964): empenho → liquidação →
// pagamento. Cada etapa é cumulativa sobre a anterior: não se liquida além do
// empenhado, nem se paga além do liquidado, e o empenho não passa do valor
// aprovado. Estornos entram como lançamento negativo.

export type Etapa = "EMPENHO" | "LIQUIDACAO" | "PAGAMENTO";
export type Lancamento = { etapa: Etapa; valor: number };

const cent = (v: number) => Math.round(v * 100);

export function somasExecucao(lancamentos: Lancamento[]) {
  const soma = (e: Etapa) => lancamentos.filter((l) => l.etapa === e).reduce((s, l) => s + cent(l.valor), 0) / 100;
  return { empenhado: soma("EMPENHO"), liquidado: soma("LIQUIDACAO"), pago: soma("PAGAMENTO") };
}

// Confere um novo lançamento contra os já feitos. Devolve o motivo da recusa,
// ou null quando o lançamento cabe.
export function conferirLancamento(valorEmenda: number, anteriores: Lancamento[], novo: Lancamento): string | null {
  if (!Number.isFinite(novo.valor) || novo.valor === 0) return "Informe um valor diferente de zero.";
  const s = somasExecucao([...anteriores, novo]);
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (cent(s.empenhado) < 0 || cent(s.liquidado) < 0 || cent(s.pago) < 0) {
    return "O estorno deixaria a etapa com saldo negativo.";
  }
  if (cent(s.empenhado) > cent(valorEmenda)) {
    return `O empenhado chegaria a ${brl(s.empenhado)}, acima do valor aprovado da emenda (${brl(valorEmenda)}).`;
  }
  if (cent(s.liquidado) > cent(s.empenhado)) {
    return `O liquidado chegaria a ${brl(s.liquidado)}, acima do empenhado (${brl(s.empenhado)}).`;
  }
  if (cent(s.pago) > cent(s.liquidado)) {
    return `O pago chegaria a ${brl(s.pago)}, acima do liquidado (${brl(s.liquidado)}).`;
  }
  return null;
}
