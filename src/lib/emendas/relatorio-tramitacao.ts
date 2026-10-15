// ============================================================================
// Relatório de tramitação a partir do histórico: o que entrou em cada
// situação no período, por situação e por autor, em quantidade e valor. Puro.
// ============================================================================

// `de` igual a `para` é anotação (ex.: incorporação à lei), não passagem.
export type Passagem = { emendaId: string; de?: string | null; para: string; criadoEm: Date };
// `autor`: o nome para as linhas ("Fulano + 2" na coautoria); `partes`: cada
// vereador com a sua parte, para o quadro por autor (sem ela, tudo do autor).
export type EmendaDoRelatorio = { id: string; numero: number | null; autor: string; objeto: string; valor: number; partes?: { autor: string; valor: number }[] };

export type RelatorioTramitacao = {
  porSituacao: { situacao: string; qtd: number; valor: number }[];
  porAutor: { autor: string; remetidas: number; valorRemetido: number; aprovadas: number; valorAprovado: number; rejeitadas: number; valorRejeitado: number }[];
  linhas: { quando: Date; situacao: string; emenda: EmendaDoRelatorio }[];
  total: { qtd: number; valor: number };
};

// Situações que contam no relatório (o que a Câmara vê acontecer).
const CONTAM = ["SUBMETIDA", "EM_TRAMITACAO", "EM_DILIGENCIA", "APROVADA", "REJEITADA"];

export function relatorioTramitacao(passagens: Passagem[], emendas: Map<string, EmendaDoRelatorio>, de: Date, ate: Date): RelatorioTramitacao {
  const noPeriodo = passagens
    .filter((p) => p.de !== p.para && p.criadoEm >= de && p.criadoEm <= ate && CONTAM.includes(p.para) && emendas.has(p.emendaId))
    .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
  // Cada emenda conta uma vez por situação no período (a última passagem).
  const ultima = new Map<string, Passagem>();
  for (const p of noPeriodo) ultima.set(`${p.emendaId}|${p.para}`, p);
  const unicas = [...ultima.values()];

  const sit = new Map<string, { qtd: number; valor: number }>();
  const aut = new Map<string, RelatorioTramitacao["porAutor"][number]>();
  for (const p of unicas) {
    const e = emendas.get(p.emendaId)!;
    const s = sit.get(p.para) ?? { qtd: 0, valor: 0 };
    s.qtd++;
    s.valor = Math.round((s.valor + e.valor) * 100) / 100;
    sit.set(p.para, s);
    for (const parte of e.partes?.length ? e.partes : [{ autor: e.autor, valor: e.valor }]) {
      const a = aut.get(parte.autor) ?? { autor: parte.autor, remetidas: 0, valorRemetido: 0, aprovadas: 0, valorAprovado: 0, rejeitadas: 0, valorRejeitado: 0 };
      if (p.para === "SUBMETIDA") {
        a.remetidas++;
        a.valorRemetido = Math.round((a.valorRemetido + parte.valor) * 100) / 100;
      } else if (p.para === "APROVADA") {
        a.aprovadas++;
        a.valorAprovado = Math.round((a.valorAprovado + parte.valor) * 100) / 100;
      } else if (p.para === "REJEITADA") {
        a.rejeitadas++;
        a.valorRejeitado = Math.round((a.valorRejeitado + parte.valor) * 100) / 100;
      }
      aut.set(parte.autor, a);
    }
  }
  const distintas = new Set(unicas.map((p) => p.emendaId));
  return {
    porSituacao: CONTAM.filter((c) => sit.has(c)).map((c) => ({ situacao: c, ...sit.get(c)! })),
    porAutor: [...aut.values()].sort((a, b) => a.autor.localeCompare(b.autor, "pt-BR")),
    linhas: unicas.map((p) => ({ quando: p.criadoEm, situacao: p.para, emenda: emendas.get(p.emendaId)! })),
    total: { qtd: distintas.size, valor: Math.round([...distintas].reduce((s, id) => s + emendas.get(id)!.valor, 0) * 100) / 100 },
  };
}
