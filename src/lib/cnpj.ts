// CNPJ: dígitos verificadores e formatação.

export const somenteDigitos = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

export function cnpjValido(valor: string | null | undefined): boolean {
  const n = somenteDigitos(valor);
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const digito = (tamanho: number) => {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(n[i]) * peso--;
      if (peso === 1) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digito(12) === Number(n[12]) && digito(13) === Number(n[13]);
}

// Máscara progressiva: "12345678000190" → "12.345.678/0001-90".
export function formatarCnpj(valor: string | null | undefined): string {
  const v = somenteDigitos(valor).slice(0, 14);
  if (v.length > 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  if (v.length > 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  if (v.length > 5) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length > 2) return `${v.slice(0, 2)}.${v.slice(2)}`;
  return v;
}

export function formatarTelefone(valor: string | null | undefined): string {
  const v = somenteDigitos(valor).slice(0, 11);
  if (v.length > 10) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  if (v.length > 6) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return v;
}
