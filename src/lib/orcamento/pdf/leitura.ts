import { cabecalhoVazio, lerLote, triar, type Cabecalho, type LinhaIa } from "./ler-ia";
import { recortar } from "./paginas";
import { lerValor as lerValorTexto } from "../importacao";
import { contarDotacoes, lotes, paginasComDespesa, reconciliarUnidades, somaDe, totalGeralImpresso, type LinhaLida, type TotalImpresso } from "./reconciliar";
import { textoDasPaginas } from "./texto";

// ============================================================================
// Leitura de um orçamento em PDF ou foto, um passo por chamada (cada passo
// cabe no tempo de uma requisição; o andamento fica guardado entre passos).
//
//   TRIAGEM        acha as páginas do quadro de despesa e o total impresso
//   LEITURA        lê um lote de páginas por passo, carregando o cabeçalho
//   RECONCILIACAO  soma por unidade contra o total impresso; relê uma vez a
//                  unidade que não fecha
//   CONCLUIDA      o que ainda não fecha fica apontado para correção na tela
// ============================================================================

export type Progresso = {
  fase: "TRIAGEM" | "LEITURA" | "RECONCILIACAO" | "CONCLUIDA";
  modo: "TEXTO" | "IMAGEM";
  paginas: number;
  triagemCursor: number;
  paginasQuadro: number[];
  lotes: [number, number][];
  loteAtual: number;
  contexto: Cabecalho;
  // Cabeçalho em vigor no começo de cada lote (para reler a partir dele).
  contextoNoLote: Record<string, Cabecalho>;
  totais: TotalImpresso[];
  totalGeral: number | null;
  releidas: string[];
  mensagem: string;
};

// Texto: uma página por chamada, com a contagem de linhas conferida. Imagem: duas.
export const TAMANHO_LOTE = { TEXTO: 1, IMAGEM: 2 } as const;
const TRIAGEM_IMAGEM = 20;

export function progressoInicial(modo: "TEXTO" | "IMAGEM", paginas: number, faixa: [number, number] | null): Progresso {
  const base: Progresso = {
    fase: "TRIAGEM",
    modo,
    paginas,
    triagemCursor: 1,
    paginasQuadro: [],
    lotes: [],
    loteAtual: 0,
    contexto: cabecalhoVazio(),
    contextoNoLote: {},
    totais: [],
    totalGeral: null,
    releidas: [],
    mensagem: "Procurando o quadro de despesa no documento…",
  };
  // Foto (uma página) ou faixa informada: vai direto à leitura.
  if (faixa || paginas === 1) {
    const [a, b] = faixa ?? [1, 1];
    const paginasQuadro = Array.from({ length: b - a + 1 }, (_, i) => a + i);
    return { ...base, fase: "LEITURA", paginasQuadro, lotes: lotes(paginasQuadro, TAMANHO_LOTE[modo]), mensagem: "Lendo o quadro de despesa…" };
  }
  return base;
}

export type Fonte = { tipo: "pdf"; bytes: Uint8Array } | { tipo: "imagem"; mime: string; bytes: Uint8Array };

export type ResultadoPasso = {
  progresso: Progresso;
  // Linhas novas lidas neste passo.
  linhas?: LinhaIa[];
  // Páginas cujas linhas antigas saem (releitura).
  substituirPaginas?: number[];
  erro?: string;
};

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

async function partesDoLote(fonte: Fonte, modo: Progresso["modo"], [a, b]: [number, number]) {
  if (fonte.tipo === "imagem") return [{ pagina: 1, imagem: { mime: fonte.mime, base64: b64(fonte.bytes) } }];
  if (modo === "TEXTO") return (await textoDasPaginas(fonte.bytes, a, b)).map((p) => ({ pagina: p.pagina, texto: p.texto }));
  // Digitalização: o recorte das páginas vai como PDF (a IA lê a imagem).
  const recorte = await recortar(fonte.bytes, a, b);
  return [{ pagina: a, texto: `(As páginas ${a} a ${b} estão no PDF anexo, na ordem.)`, pdfBase64: b64(recorte) }];
}

export async function passo(fonte: Fonte, p: Progresso, linhasAtuais: LinhaLida[], usuarioId: string | null): Promise<ResultadoPasso> {
  if (p.fase === "TRIAGEM") {
    if (fonte.tipo === "imagem") return { progresso: { ...p, fase: "LEITURA", paginasQuadro: [1], lotes: [[1, 1]] } };
    if (p.modo === "TEXTO") {
      const todas = await textoDasPaginas(fonte.bytes, 1, p.paginas);
      const candidatas = paginasComDespesa(todas);
      if (!candidatas.length) return { progresso: { ...p, fase: "CONCLUIDA", mensagem: "Nenhuma página com quadro de despesa foi encontrada." }, erro: "O documento não parece ter o quadro de detalhamento da despesa. Informe as páginas do quadro e tente de novo." };
      // A triagem escolhe entre os quadros candidatos (o detalhado, com ficha).
      const resumo = todas
        .filter((x) => candidatas.includes(x.pagina))
        .map((x) => {
          const l = x.texto.split("\n");
          return { pagina: x.pagina, texto: [...l.slice(0, 8), ...l.filter((y) => /TOTAL/i.test(y)).slice(0, 4)].join("\n") };
        });
      const ultima = todas[todas.length - 1];
      const t = await triar({ resumo: [...resumo, ...(candidatas.includes(ultima.pagina) ? [] : [])], usuarioId });
      if (!t.ok) return { progresso: p, erro: t.erro };
      const paginasQuadro = t.paginas.filter((x) => candidatas.includes(x)).length ? t.paginas.filter((x) => candidatas.includes(x)) : candidatas;
      return {
        progresso: {
          ...p,
          fase: "LEITURA",
          paginasQuadro,
          lotes: lotes(paginasQuadro, TAMANHO_LOTE.TEXTO),
          totalGeral: t.totalGeral,
          mensagem: `Quadro de despesa nas páginas ${paginasQuadro[0]} a ${paginasQuadro[paginasQuadro.length - 1]}. Lendo…`,
        },
      };
    }
    // Digitalização: triagem por blocos de páginas.
    const a = p.triagemCursor;
    const b = Math.min(p.paginas, a + TRIAGEM_IMAGEM - 1);
    const t = await triar({ pdfBase64: { inicio: a, fim: b, base64: b64(await recortar(fonte.bytes, a, b)) }, usuarioId });
    if (!t.ok) return { progresso: p, erro: t.erro };
    const achadas = [...p.paginasQuadro, ...t.paginas.filter((x) => x >= a && x <= b)];
    const totalGeral = t.totalGeral ?? p.totalGeral;
    if (b < p.paginas) return { progresso: { ...p, triagemCursor: b + 1, paginasQuadro: achadas, totalGeral, mensagem: `Procurando o quadro de despesa (página ${b} de ${p.paginas})…` } };
    if (!achadas.length) return { progresso: { ...p, fase: "CONCLUIDA" }, erro: "O documento não parece ter o quadro de detalhamento da despesa. Informe as páginas do quadro e tente de novo." };
    return { progresso: { ...p, fase: "LEITURA", paginasQuadro: achadas, lotes: lotes(achadas, TAMANHO_LOTE.IMAGEM), totalGeral, mensagem: "Lendo o quadro de despesa…" } };
  }

  if (p.fase === "LEITURA") {
    const lote = p.lotes[p.loteAtual];
    if (!lote) return { progresso: { ...p, fase: "RECONCILIACAO", mensagem: "Conferindo os totais de cada unidade…" } };
    const partes = await partesDoLote(fonte, p.modo, lote);
    // No texto, o sistema conta as linhas de dotação da página; a leitura que
    // vier com outra contagem é refeita uma vez.
    const esperado = p.modo === "TEXTO" ? partes.reduce((s, x) => s + contarDotacoes("texto" in x ? x.texto : ""), 0) : undefined;
    let r = await lerLote({ partes, contexto: p.contexto, usuarioId, esperado });
    if (r.ok && esperado !== undefined && r.lote.linhas.length !== esperado) {
      const devolvidas = r.lote.linhas.length;
      const segunda = await lerLote({ partes, contexto: p.contexto, usuarioId, esperado, reforco: `a leitura anterior devolveu ${devolvidas} das ${esperado} linhas de dotação. Transcreva todas.` });
      if (segunda.ok && Math.abs(segunda.lote.linhas.length - esperado) < Math.abs(devolvidas - esperado)) r = segunda;
    }
    if (!r.ok) return { progresso: p, erro: r.erro };
    const proximo = p.loteAtual + 1;
    return {
      linhas: r.lote.linhas,
      progresso: {
        ...p,
        loteAtual: proximo,
        contextoNoLote: { ...p.contextoNoLote, [String(lote[0])]: p.contexto },
        contexto: r.lote.contexto_final,
        totais: [...p.totais, ...r.lote.totais],
        totalGeral: totalGeralImpresso([...p.totais, ...r.lote.totais]) ?? p.totalGeral,
        fase: proximo >= p.lotes.length ? "RECONCILIACAO" : "LEITURA",
        mensagem: proximo >= p.lotes.length ? "Conferindo os totais de cada unidade…" : `Lendo páginas ${lote[1] + 1} em diante (lote ${proximo + 1} de ${p.lotes.length})…`,
      },
    };
  }

  if (p.fase === "RECONCILIACAO") {
    const div = reconciliarUnidades(linhasAtuais, p.totais).filter((d) => !p.releidas.includes(d.codigo));
    // Código sem nenhuma linha lida se localiza pela página do total dele.
    const comPaginas = div.map((d) => ({ ...d, paginas: d.paginas.length ? d.paginas : p.totais.filter((t) => t.codigo === d.codigo).map((t) => t.pagina) }));
    const alvo = comPaginas.find((d) => d.paginas.length);
    if (!alvo) return { progresso: { ...p, fase: "CONCLUIDA", mensagem: "Leitura concluída." } };
    const releidas = [...p.releidas, alvo.codigo];
    // Relê do começo do lote em que o código começa até a última página dele (no máximo 6 páginas).
    const inicio = p.lotes.find(([a, b]) => alvo.paginas[0] >= a && alvo.paginas[0] <= b)?.[0] ?? alvo.paginas[0];
    const fim = Math.min(Math.max(alvo.paginas[alvo.paginas.length - 1], inicio), inicio + 5);
    const paginas = Array.from({ length: fim - inicio + 1 }, (_, i) => inicio + i);
    let contexto = p.contextoNoLote[String(inicio)] ?? cabecalhoVazio();
    const relidas: LinhaIa[] = [];
    for (const [a, b] of lotes(paginas, TAMANHO_LOTE[p.modo])) {
      const partes = await partesDoLote(fonte, p.modo, [a, b]);
      const esperado = p.modo === "TEXTO" ? partes.reduce((s, x) => s + contarDotacoes("texto" in x ? x.texto : ""), 0) : undefined;
      const r = await lerLote({
        partes,
        contexto,
        usuarioId,
        esperado,
        reforco: `a soma das dotações de ${alvo.codigo} deveria ser ${alvo.impresso.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} e a leitura anterior deu ${alvo.lido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Confira cada linha e cada valor.`,
      });
      if (!r.ok) return { progresso: { ...p, releidas }, erro: r.erro };
      relidas.push(...r.lote.linhas.filter((l) => paginas.includes(l.pagina)));
      contexto = r.lote.contexto_final;
    }
    // A releitura só substitui a anterior se fechar melhor o código conferido.
    const fora = linhasAtuais.filter((l) => !paginas.includes(l.pagina));
    const novas = relidas.map((l) => ({ pagina: l.pagina, unidade: l.unidade_codigo, valor: lerValorTexto(l.valor) ?? 0 }));
    const antes = Math.abs(somaDe(linhasAtuais, alvo.codigo) - alvo.impresso);
    const depois = Math.abs(somaDe([...fora, ...novas], alvo.codigo) - alvo.impresso);
    if (depois >= antes) return { progresso: { ...p, releidas, mensagem: `Releitura de ${alvo.codigo} não melhorou; mantida a primeira.` } };
    return { linhas: relidas, substituirPaginas: paginas, progresso: { ...p, releidas, mensagem: `Relido ${alvo.codigo}; conferindo de novo…` } };
  }
  return { progresso: p };
}

// LinhaIa → campos da importação (os mesmos nomes da planilha).
export function camposDaLinhaIa(l: LinhaIa): Record<string, string> {
  return {
    orgao_codigo: l.orgao_codigo,
    orgao_nome: l.orgao_nome,
    unidade_codigo: l.unidade_codigo,
    unidade_nome: l.unidade_nome,
    funcional: l.funcional,
    programa_nome: l.programa_nome,
    acao_nome: l.acao_nome,
    natureza_codigo: l.natureza_codigo,
    natureza_nome: l.natureza_nome,
    fonte_codigo: l.fonte_codigo,
    aplicacao_codigo: l.aplicacao_codigo,
    ficha: l.ficha,
    valor_autorizado: l.valor,
    pagina: String(l.pagina),
  };
}
