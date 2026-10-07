// ============================================================================
// Comparativo entre o projeto de lei e a lei aprovada, dotação a dotação, com
// as emendas incorporadas que explicam a diferença. Puro.
//
// Em Mogi Guaçu a emenda impositiva não tem dotação de origem no sistema: ela
// soma na dotação de destino, e a lei fica maior que o projeto pelo valor das
// emendas incorporadas. Se a origem existir (reserva), ela é descontada.
// ============================================================================

export type LinhaOrcamento = { id: string; chave: string; ficha: string | null; codigo: string; nome: string; uo: string; orgao: string; natureza: string; fonte: string; valor: number };
export type EmendaIncorporada = { id: string; numero: number | null; valor: number; destinoId: string | null; origemId: string | null };
export type EfeitoEmenda = { id: string; numero: number | null; efeito: number };

export type LinhaComparativo = {
  chave: string;
  pl: LinhaOrcamento | null;
  lei: LinhaOrcamento | null;
  valorPl: number;
  valorLei: number;
  diferenca: number;
  // Explicado pelas emendas incorporadas (+ destino, − origem).
  explicado: number;
  marca: "NOVA" | "SUPRIMIDA" | null;
  emendas: EfeitoEmenda[];
};

const r2 = (x: number) => Math.round(x * 100) / 100;

// Efeito de cada emenda nas dotações do projeto: põe no destino e, havendo
// origem, tira dela.
export function efeitosDasEmendas(emendas: EmendaIncorporada[]): Map<string, EfeitoEmenda[]> {
  const m = new Map<string, EfeitoEmenda[]>();
  const add = (dot: string | null, e: EmendaIncorporada, efeito: number) => {
    if (!dot) return;
    const l = m.get(dot) ?? [];
    l.push({ id: e.id, numero: e.numero, efeito });
    m.set(dot, l);
  };
  for (const e of emendas) {
    add(e.destinoId, e, e.valor);
    add(e.origemId, e, -e.valor);
  }
  return m;
}

export function comparar(pl: LinhaOrcamento[], lei: LinhaOrcamento[], emendas: EmendaIncorporada[]): LinhaComparativo[] {
  const efeitos = efeitosDasEmendas(emendas);
  const porChave = new Map<string, LinhaComparativo>();
  for (const d of pl) {
    const ef = efeitos.get(d.id) ?? [];
    porChave.set(d.chave, { chave: d.chave, pl: d, lei: null, valorPl: d.valor, valorLei: 0, diferenca: 0, explicado: r2(ef.reduce((s, x) => s + x.efeito, 0)), marca: null, emendas: ef });
  }
  for (const d of lei) {
    const l = porChave.get(d.chave);
    if (l) {
      l.lei = d;
      l.valorLei = d.valor;
    } else porChave.set(d.chave, { chave: d.chave, pl: null, lei: d, valorPl: 0, valorLei: d.valor, diferenca: 0, explicado: 0, marca: "NOVA", emendas: [] });
  }
  for (const l of porChave.values()) {
    if (l.pl && !l.lei && lei.length) l.marca = "SUPRIMIDA";
    l.diferenca = r2(l.valorLei - l.valorPl);
  }
  return [...porChave.values()].sort((a, b) => ((a.pl ?? a.lei)!.uo + (a.pl ?? a.lei)!.codigo < (b.pl ?? b.lei)!.uo + (b.pl ?? b.lei)!.codigo ? -1 : 1));
}

// Base da lei quando ela ainda não foi importada: o projeto mais o efeito das
// emendas incorporadas, dotação a dotação.
export function leiDoProjeto(pl: LinhaOrcamento[], emendas: EmendaIncorporada[]): { id: string; valor: number }[] {
  const efeitos = efeitosDasEmendas(emendas);
  return pl.map((d) => ({ id: d.id, valor: r2(d.valor + (efeitos.get(d.id) ?? []).reduce((s, x) => s + x.efeito, 0)) }));
}
