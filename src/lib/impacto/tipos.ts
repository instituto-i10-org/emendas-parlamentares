// ============================================================================
// Confirmação com impacto: o que uma alteração de configuração muda e quantas
// emendas ela alcança, calculado no servidor antes de gravar. Puro: tipos,
// comparação antes → depois e a regra da ciência. A consulta ao banco fica em
// `servidor.ts`; a janela, em `components/app/confirmar-impacto.tsx`.
// ============================================================================

export type Mudanca = { campo: string; antes: string; depois: string };

export type ContagemEmendas = {
  // Remetidas: submetidas, em tramitação, em diligência, aprovadas, rejeitadas.
  enviadas: number;
  // Aguardando a Comissão: submetidas, em tramitação, em diligência.
  emAnalise: number;
  aprovadas: number;
  // Não remetidas (rascunho e situações de validação).
  rascunhos: number;
};

export type Impacto = {
  mudancas: Mudanca[];
  emendas: ContagemEmendas;
  // Frases que precisam ser lidas antes de confirmar.
  avisos: string[];
  // Quando a alteração não é permitida: o motivo, e nada se grava.
  bloqueio: string | null;
};

export const SEM_EMENDAS: ContagemEmendas = { enviadas: 0, emAnalise: 0, aprovadas: 0, rascunhos: 0 };

export const impactoVazio = (extra: Partial<Impacto> = {}): Impacto => ({
  mudancas: [],
  emendas: SEM_EMENDAS,
  avisos: [],
  bloqueio: null,
  ...extra,
});

// A caixa "Entendo que esta alteração afeta emendas já enviadas" só aparece
// (e só é exigida) quando há emenda remetida alcançada.
export const exigeCiencia = (i: Impacto) => !i.bloqueio && i.emendas.enviadas > 0;

// A regra que o servidor aplica de novo, sem confiar no navegador.
export function conferirCiencia(i: Impacto, ciente: boolean | undefined): string | null {
  if (i.bloqueio) return i.bloqueio;
  if (exigeCiencia(i) && !ciente) {
    return `Esta alteração afeta ${plural(i.emendas.enviadas, "emenda já enviada", "emendas já enviadas")}. Confirme que está ciente do impacto.`;
  }
  return null;
}

export const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

// --- comparação antes → depois ----------------------------------------------

export type Formato = "texto" | "moeda" | "percentual" | "inteiro" | "dias" | "meses" | "data" | "sim-nao" | "lista";

export type CampoRotulado = { rotulo: string; formato?: Formato; opcoes?: Record<string, string> };

const vazio = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

const numero = (v: unknown): number | null => {
  if (vazio(v)) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v && "toNumber" in v && typeof (v as { toNumber: unknown }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const dataIso = (v: unknown): string | null => {
  if (vazio(v)) return null;
  if (v instanceof Date) return v.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};

// Forma canônica de um valor: o que se compara (e o que se mostra).
export function exibir(v: unknown, c: CampoRotulado): string {
  if (vazio(v)) return "não definido";
  switch (c.formato) {
    case "moeda": {
      const n = numero(v);
      return n === null ? "não definido" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    case "percentual": {
      const n = numero(v);
      return n === null ? "não definido" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
    }
    case "inteiro":
    case "dias":
    case "meses": {
      const n = numero(v);
      if (n === null) return "não definido";
      const sufixo = c.formato === "dias" ? (n === 1 ? " dia" : " dias") : c.formato === "meses" ? (n === 1 ? " mês" : " meses") : "";
      return `${n.toLocaleString("pt-BR")}${sufixo}`;
    }
    case "data": {
      const d = dataIso(v);
      return d ? d.split("-").reverse().join("/") : "não definido";
    }
    case "sim-nao":
      return v === true || v === "true" ? "sim" : "não";
    case "lista": {
      const itens = (Array.isArray(v) ? v : String(v).split(/[,\s]+/)).map(String).filter(Boolean);
      const nomes = itens.map((x) => c.opcoes?.[x] ?? x);
      return nomes.length ? [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ") : "não definido";
    }
    default: {
      const s = String(v).trim();
      return c.opcoes?.[s] ?? s;
    }
  }
}

// As mudanças entre dois estados, só nos campos rotulados e só nos que mudam.
export function diferencas(antes: Record<string, unknown> | null | undefined, depois: Record<string, unknown>, campos: Record<string, CampoRotulado>): Mudanca[] {
  const out: Mudanca[] = [];
  for (const [chave, c] of Object.entries(campos)) {
    if (!(chave in depois)) continue;
    const a = exibir(antes?.[chave], c);
    const d = exibir(depois[chave], c);
    if (a !== d) out.push({ campo: c.rotulo, antes: a, depois: d });
  }
  return out;
}

// --- contagem por situação --------------------------------------------------

const EM_ANALISE = ["SUBMETIDA", "EM_TRAMITACAO", "EM_DILIGENCIA"];
const REMETIDAS = [...EM_ANALISE, "APROVADA", "REJEITADA"];

export function contar(porSituacao: { status: string; n: number }[]): ContagemEmendas {
  const soma = (lista: string[]) => porSituacao.filter((s) => lista.includes(s.status)).reduce((t, s) => t + s.n, 0);
  const enviadas = soma(REMETIDAS);
  return {
    enviadas,
    emAnalise: soma(EM_ANALISE),
    aprovadas: soma(["APROVADA"]),
    rascunhos: porSituacao.reduce((t, s) => t + s.n, 0) - enviadas,
  };
}

export const ehRemetida = (status: string) => REMETIDAS.includes(status);
