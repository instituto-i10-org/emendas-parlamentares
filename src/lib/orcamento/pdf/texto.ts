
// Texto de cada página de um PDF, com o leiaute preservado: os trechos são
// agrupados por linha (mesma altura) e separados por espaços proporcionais à
// distância entre eles. Assim as colunas do quadro de despesa continuam
// alinhadas e a leitura (pela IA) não troca valores de linha.

type Item = { str: string; transform: number[]; width: number };

export type PaginaTexto = { pagina: number; texto: string; caracteres: number };

async function pdfjs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export async function contarPaginas(bytes: Uint8Array): Promise<number> {
  const { getDocument } = await pdfjs();
  const tarefa = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const doc = await tarefa.promise;
  const n = doc.numPages;
  await tarefa.destroy();
  return n;
}

export async function textoDasPaginas(bytes: Uint8Array, inicio: number, fim: number): Promise<PaginaTexto[]> {
  const { getDocument } = await pdfjs();
  const tarefa = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const doc = await tarefa.promise;
  const saida: PaginaTexto[] = [];
  try {
    for (let p = inicio; p <= Math.min(fim, doc.numPages); p++) {
      const pagina = await doc.getPage(p);
      const conteudo = await pagina.getTextContent();
      const itens = (conteudo.items as Item[]).filter((i) => typeof i.str === "string" && i.str.trim());
      saida.push({ pagina: p, texto: montarLinhas(itens), caracteres: itens.reduce((s, i) => s + i.str.trim().length, 0) });
      pagina.cleanup();
    }
  } finally {
    await tarefa.destroy();
  }
  return saida;
}

// Agrupa por linha (tolerância de 2 pontos na altura) e espaça pela posição.
export function montarLinhas(itens: Item[]): string {
  const linhas: { y: number; itens: Item[] }[] = [];
  for (const it of itens) {
    const y = it.transform[5];
    const l = linhas.find((x) => Math.abs(x.y - y) <= 2);
    if (l) l.itens.push(it);
    else linhas.push({ y, itens: [it] });
  }
  linhas.sort((a, b) => b.y - a.y);
  const larguraCaractere = 4.5;
  return linhas
    .map((l) => {
      const ordenados = l.itens.sort((a, b) => a.transform[4] - b.transform[4]);
      let texto = "";
      let fimAnterior = 0;
      for (const it of ordenados) {
        const x = it.transform[4];
        const espacos = texto ? Math.max(1, Math.round((x - fimAnterior) / larguraCaractere)) : Math.max(0, Math.round(x / larguraCaractere));
        texto += " ".repeat(Math.min(espacos, 60)) + it.str;
        fimAnterior = x + it.width;
      }
      return texto.replace(/\s+$/, "");
    })
    .join("\n");
}

// Fração da página coberta por imagem. Digitalização (mesmo com camada de OCR)
// é uma imagem do tamanho da página; PDF nativo tem no máximo um brasão.
export async function coberturaDeImagem(bytes: Uint8Array, paginas: number[]): Promise<number[]> {
  const { getDocument, OPS } = await pdfjs();
  const tarefa = getDocument({ data: bytes.slice(), useSystemFonts: true });
  const doc = await tarefa.promise;
  const out: number[] = [];
  try {
    for (const p of paginas) {
      if (p < 1 || p > doc.numPages) continue;
      const pg = await doc.getPage(p);
      const ops = await pg.getOperatorList();
      const vp = pg.getViewport({ scale: 1 });
      let m = [1, 0, 0, 1, 0, 0];
      let area = 0;
      ops.fnArray.forEach((fn, i) => {
        if (fn === OPS.transform) m = ops.argsArray[i] as number[];
        if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) area += Math.abs(m[0] * m[3]);
      });
      out.push(Math.min(1, area / (vp.width * vp.height)));
      pg.cleanup();
    }
  } finally {
    await tarefa.destroy();
  }
  return out;
}

// Amostra de páginas espalhadas pelo documento (ou pela faixa informada).
export function amostra(inicio: number, fim: number, n = 5): number[] {
  if (fim <= inicio) return [inicio];
  return [...new Set(Array.from({ length: n }, (_, i) => Math.round(inicio + ((fim - inicio) * i) / (n - 1))))];
}
