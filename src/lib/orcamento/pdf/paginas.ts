import { PDFDocument } from "pdf-lib";

// Recorta páginas de um PDF (1-based, inclusivas) num PDF novo: é o que vai
// para a leitura por imagem quando a página não tem texto (digitalização).
export async function recortar(bytes: Uint8Array, inicio: number, fim: number): Promise<Uint8Array> {
  const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const novo = await PDFDocument.create();
  const indices = Array.from({ length: fim - inicio + 1 }, (_, i) => inicio - 1 + i).filter((i) => i < origem.getPageCount());
  const paginas = await novo.copyPages(origem, indices);
  for (const p of paginas) novo.addPage(p);
  return novo.save();
}
