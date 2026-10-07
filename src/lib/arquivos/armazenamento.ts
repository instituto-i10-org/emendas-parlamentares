import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { del, get, put } from "@vercel/blob";
import { extensao } from "./regras";

// Onde o conteúdo dos arquivos fica. Na Vercel: Blob privado (o token vem da
// integração). Sem token (ambiente local e testes): pasta .armazenamento/.

export const usaBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const PASTA_LOCAL = path.join(process.cwd(), ".armazenamento");

// Caminho novo e imprevisível, com a extensão do original.
export function novaChave(uso: string, nome: string): string {
  const ext = extensao(nome);
  const dia = new Date().toISOString().slice(0, 10);
  return `${uso.toLowerCase()}/${dia}/${randomBytes(16).toString("hex")}${ext ? `.${ext}` : ""}`;
}

const caminhoLocal = (chave: string) => {
  const p = path.resolve(PASTA_LOCAL, chave);
  if (!p.startsWith(PASTA_LOCAL + path.sep)) throw new Error("Caminho de arquivo inválido.");
  return p;
};

export async function gravar(chave: string, conteudo: Buffer, tipo: string): Promise<void> {
  if (usaBlob()) {
    await put(chave, conteudo, { access: "private", contentType: tipo, addRandomSuffix: false });
    return;
  }
  const p = caminhoLocal(chave);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, conteudo);
}

export async function lerBuffer(chave: string): Promise<Buffer> {
  if (usaBlob()) {
    const r = await get(chave, { access: "private" });
    if (!r || r.statusCode !== 200) throw new Error("Arquivo não encontrado no armazenamento.");
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  return readFile(caminhoLocal(chave));
}

export async function lerStream(chave: string): Promise<{ stream: ReadableStream<Uint8Array>; tamanho: number }> {
  if (usaBlob()) {
    const r = await get(chave, { access: "private" });
    if (!r || r.statusCode !== 200) throw new Error("Arquivo não encontrado no armazenamento.");
    return { stream: r.stream, tamanho: r.blob.size };
  }
  const p = caminhoLocal(chave);
  const { size } = await stat(p);
  return { stream: Readable.toWeb(createReadStream(p)) as ReadableStream<Uint8Array>, tamanho: size };
}

export async function apagar(chave: string): Promise<void> {
  if (usaBlob()) await del(chave);
  else await unlink(caminhoLocal(chave)).catch(() => undefined);
}

export async function resumoSha256(chave: string): Promise<{ sha256: string; tamanho: number }> {
  const b = await lerBuffer(chave);
  return { sha256: createHash("sha256").update(b).digest("hex"), tamanho: b.length };
}
