import { chamarIA, type ParteEntrada } from "@/lib/servicos/ia";
import type { TotalImpresso } from "./reconciliar";

// ============================================================================
// Leitura do quadro de despesa por IA. Cada chamada lê um lote de páginas (o
// texto, quando o PDF tem texto; a imagem da página, quando é digitalização
// ou foto) e devolve as linhas, os totais impressos e o cabeçalho em vigor no
// fim do lote — que entra no lote seguinte, porque a unidade e a ação são
// impressas uma vez e valem para as linhas de baixo.
// ============================================================================

export type Cabecalho = {
  orgao_codigo: string;
  orgao_nome: string;
  unidade_codigo: string;
  unidade_nome: string;
  funcional: string;
  programa_nome: string;
  acao_nome: string;
};

export const cabecalhoVazio = (): Cabecalho => ({ orgao_codigo: "", orgao_nome: "", unidade_codigo: "", unidade_nome: "", funcional: "", programa_nome: "", acao_nome: "" });

export type LinhaIa = Cabecalho & {
  pagina: number;
  natureza_codigo: string;
  natureza_nome: string;
  fonte_codigo: string;
  aplicacao_codigo: string;
  ficha: string;
  valor: string;
};

export type LoteLido = { linhas: LinhaIa[]; totais: TotalImpresso[]; contexto_final: Cabecalho };

const texto = { type: "string" } as const;
const CAMPOS_CABECALHO = ["orgao_codigo", "orgao_nome", "unidade_codigo", "unidade_nome", "funcional", "programa_nome", "acao_nome"] as const;
const cabecalhoSchema = {
  type: "object",
  additionalProperties: false,
  required: [...CAMPOS_CABECALHO],
  properties: Object.fromEntries(CAMPOS_CABECALHO.map((c) => [c, texto])),
};

// Resposta agrupada por ação: o cabeçalho uma vez, as dotações abaixo. Menos
// repetição na saída e menos chance de a leitura pular linhas.
const ESQUEMA_LOTE = {
  nome: "lote_quadro_despesa",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["blocos", "totais", "contexto_final"],
    properties: {
      blocos: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [...CAMPOS_CABECALHO, "pagina", "dotacoes"],
          properties: {
            ...cabecalhoSchema.properties,
            pagina: { type: "integer" },
            dotacoes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["natureza_codigo", "natureza_nome", "fonte_codigo", "aplicacao_codigo", "ficha", "valor"],
                properties: { natureza_codigo: texto, natureza_nome: texto, fonte_codigo: texto, aplicacao_codigo: texto, ficha: texto, valor: texto },
              },
            },
          },
        },
      },
      totais: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["pagina", "nivel", "codigo", "valor"],
          properties: {
            pagina: { type: "integer" },
            nivel: { type: "string", enum: ["UNIDADE_EXECUTORA", "UNIDADE_ORCAMENTARIA", "ORGAO", "GERAL", "OUTRO"] },
            codigo: { type: ["string", "null"] },
            valor: { type: "number" },
          },
        },
      },
      contexto_final: cabecalhoSchema,
    },
  },
};

type Bloco = Cabecalho & { pagina: number; dotacoes: Omit<LinhaIa, keyof Cabecalho | "pagina">[] };

const INSTRUCOES_LOTE = `Você transcreve o quadro de detalhamento da despesa de uma lei orçamentária municipal brasileira (QDD, "quadro detalhado da despesa", "dotações por ficha").

Agrupe por ação: cada item de "blocos" é um projeto/atividade com o cabeçalho em vigor e TODAS as dotações dele que aparecem nesta entrada, na ordem. No cabeçalho:
- pagina: o número N do marcador "PÁGINA N" desta entrada em que as dotações do bloco aparecem (NÃO use a numeração impressa no documento, como "Página: 2/13"); se a ação continua na página seguinte, abra outro bloco para a outra página;
- orgao_codigo, orgao_nome, unidade_codigo, unidade_nome: órgão e unidade (executora, quando houver). unidade_codigo é o código COMPLETO, com o órgão na frente: se o documento imprime "02.04.02", use "02.04.02"; se imprime o órgão "01" e a unidade "001" em lugares separados, use "01.001";
- funcional: função.subfunção.programa.ação no formato 00.000.0000.0000 (ex.: "12.361.0009.1007"), montada mesmo que o documento imprima função, subfunção, programa e ação em colunas ou linhas separadas, ou com ponto dentro da ação ("2.082" → "2082");
- programa_nome: o nome do programa se estiver impresso; senão "";
- acao_nome: o nome do projeto/atividade (junte as continuações em mais de uma linha).
Em cada dotação: natureza_codigo (ex.: "3.3.90.30"), natureza_nome, fonte_codigo (ex.: "1"), aplicacao_codigo (ex.: "110.0000"; "" se não houver), ficha ("" se não houver) e valor exatamente como impresso (ex.: "1.000.000,00").

TRANSCREVA TODAS AS LINHAS DE DOTAÇÃO, uma por uma, sem resumir, sem pular e sem juntar. Cada linha que tem natureza da despesa e valor é uma dotação.

Os cabeçalhos são impressos uma vez e valem para as linhas abaixo até mudarem, inclusive de uma página para a outra. O cabeçalho em vigor no início desta entrada está em "CONTEXTO INICIAL".

Em "totais", cada total impresso, com:
- nivel: UNIDADE_EXECUTORA ("TOTAL UNIDADE EXECUTORA" ou "TOTAL DA UNIDADE" quando a unidade é a última divisão), UNIDADE_ORCAMENTARIA ("TOTAL UNIDADE ORÇAMENTÁRIA"), ORGAO ("TOTAL ÓRGÃO"), GERAL ("TOTAL GERAL") ou OUTRO;
- codigo: o código do nível que o total fecha, como impresso no cabeçalho daquele nível. O total da unidade executora 02.01.03 tem código "02.01.03"; o total da unidade orçamentária a que ela pertence tem código "02.01" (a unidade sem o último segmento); o do órgão, "02". null no total geral;
- valor como número (1.000.000,00 → 1000000).

Em "contexto_final", o cabeçalho em vigor no fim desta entrada.

Não invente nem corrija valores. Linhas que não sejam dotação (títulos, cabeçalhos de coluna, rodapés, totais) não são dotações. Página sem quadro de despesa: listas vazias e o contexto inicial repetido.`;

export async function lerLote(p: {
  partes: { pagina: number; texto?: string; pdfBase64?: string; imagem?: { mime: string; base64: string } }[];
  contexto: Cabecalho;
  usuarioId: string | null;
  // Quantas linhas de dotação a entrada tem (contadas no texto), quando se sabe.
  esperado?: number;
  reforco?: string;
}): Promise<{ ok: true; lote: LoteLido } | { ok: false; erro: string }> {
  const entrada: ParteEntrada[] = [{ tipo: "texto", texto: `CONTEXTO INICIAL: ${JSON.stringify(p.contexto)}` }];
  for (const parte of p.partes) {
    entrada.push({ tipo: "texto", texto: `PÁGINA ${parte.pagina}${parte.texto ? `\n${parte.texto}` : ""}` });
    if (parte.pdfBase64) entrada.push({ tipo: "pdf", nome: `pagina-${parte.pagina}.pdf`, base64: parte.pdfBase64 });
    if (parte.imagem) entrada.push({ tipo: "imagem", mime: parte.imagem.mime, base64: parte.imagem.base64 });
  }
  if (p.esperado !== undefined) entrada.push({ tipo: "texto", texto: `Esta entrada tem exatamente ${p.esperado} linhas de dotação. Devolva as ${p.esperado}.` });
  if (p.reforco) entrada.push({ tipo: "texto", texto: `ATENÇÃO NESTA RELEITURA: ${p.reforco}` });
  const r = await chamarIA({
    operacao: "importacao-lote",
    instrucoes: INSTRUCOES_LOTE,
    entrada,
    esquema: ESQUEMA_LOTE,
    maxSaida: 32_000,
    timeoutMs: 240_000,
    unidades: p.partes.length,
    usuarioId: p.usuarioId,
  });
  if (!r.ok) return r;
  const j = r.json as { blocos: Bloco[]; totais: TotalImpresso[]; contexto_final: Cabecalho };
  // Entrada de uma página: a página é a dela, seja qual for a que a leitura
  // anotou (o documento costuma imprimir uma numeração própria).
  const unica = p.partes.length === 1 && !p.partes[0].pdfBase64 ? p.partes[0].pagina : null;
  const linhas: LinhaIa[] = j.blocos.flatMap(({ dotacoes, ...cab }) => dotacoes.map((d) => ({ ...cab, ...d, pagina: unica ?? cab.pagina })));
  const totais = j.totais.map((t) => ({ ...t, pagina: unica ?? t.pagina }));
  return { ok: true, lote: { linhas, totais, contexto_final: j.contexto_final } };
}

// --------------------------------------------------------------- triagem

const ESQUEMA_TRIAGEM = {
  nome: "triagem_paginas",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["paginas_quadro", "total_geral"],
    properties: {
      paginas_quadro: { type: "array", items: { type: "integer" } },
      total_geral: { type: ["number", "null"] },
    },
  },
};

// Quais páginas trazem o quadro de detalhamento da despesa (linha a linha, com
// ficha ou natureza e valor), e o total geral da despesa impresso. Recebe um
// resumo por página (texto) ou as próprias páginas (imagem).
export async function triar(p: {
  resumo?: { pagina: number; texto: string }[];
  pdfBase64?: { inicio: number; fim: number; base64: string };
  usuarioId: string | null;
}): Promise<{ ok: true; paginas: number[]; totalGeral: number | null } | { ok: false; erro: string }> {
  const entrada: ParteEntrada[] = [];
  if (p.resumo) entrada.push({ tipo: "texto", texto: p.resumo.map((x) => `PÁGINA ${x.pagina}\n${x.texto}`).join("\n\n") });
  if (p.pdfBase64) {
    entrada.push({ tipo: "texto", texto: `O arquivo anexo contém as páginas ${p.pdfBase64.inicio} a ${p.pdfBase64.fim} do documento, na ordem.` });
    entrada.push({ tipo: "pdf", nome: `paginas-${p.pdfBase64.inicio}-${p.pdfBase64.fim}.pdf`, base64: p.pdfBase64.base64 });
  }
  const r = await chamarIA({
    operacao: "importacao-triagem",
    instrucoes:
      "Você recebe páginas de uma lei ou projeto de lei orçamentária municipal. Indique em paginas_quadro os números das páginas que contêm o QUADRO DE DETALHAMENTO DA DESPESA linha a linha (dotações com natureza da despesa, fonte e valor, normalmente com ficha). " +
      "Não inclua anexos consolidados (por função, por categoria econômica, por órgão sem linhas de natureza), nem a receita. Se houver mais de uma versão do mesmo quadro, escolha a mais detalhada (com ficha). " +
      "Em total_geral, o valor total da despesa fixada impresso no documento (número; null se não aparecer nestas páginas).",
    entrada,
    esquema: ESQUEMA_TRIAGEM,
    maxSaida: 4_000,
    unidades: p.resumo?.length ?? (p.pdfBase64 ? p.pdfBase64.fim - p.pdfBase64.inicio + 1 : 1),
    usuarioId: p.usuarioId,
  });
  if (!r.ok) return r;
  const j = r.json as { paginas_quadro: number[]; total_geral: number | null };
  return { ok: true, paginas: j.paginas_quadro, totalGeral: j.total_geral };
}
