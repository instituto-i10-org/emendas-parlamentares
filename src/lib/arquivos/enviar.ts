"use client";

import { upload } from "@vercel/blob/client";
import { registrarArquivo, type ArquivoEnviado } from "@/lib/actions/arquivos";
import { conferirArquivo, extensao, type UsoArquivo } from "./regras";

// Envia um arquivo: direto ao Blob privado em produção, ou ao disco no
// ambiente local. Em seguida o servidor confere e registra.
export async function enviarArquivo(
  arquivo: File,
  uso: UsoArquivo,
  opcoes: { publico?: boolean; progresso?: (pct: number) => void } = {}
): Promise<ArquivoEnviado> {
  const erro = conferirArquivo(uso, { nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size });
  if (erro) throw new Error(erro);

  const modo = (await (await fetch("/api/arquivos/envio")).json()) as { blob: boolean };
  let chave: string;
  if (modo.blob) {
    const ext = extensao(arquivo.name);
    const aleatorio = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    chave = `${uso.toLowerCase()}/${new Date().toISOString().slice(0, 10)}/${aleatorio}${ext ? `.${ext}` : ""}`;
    await upload(chave, arquivo, {
      access: "private",
      handleUploadUrl: "/api/arquivos/envio",
      clientPayload: JSON.stringify({ uso }),
      multipart: arquivo.size > 8 * 1024 * 1024,
      onUploadProgress: (e) => opcoes.progresso?.(e.percentage),
    });
  } else {
    const form = new FormData();
    form.set("uso", uso);
    form.set("arquivo", arquivo);
    const r = await fetch("/api/arquivos/local", { method: "POST", body: form });
    const j = (await r.json()) as { chave?: string; error?: string };
    if (!r.ok || !j.chave) throw new Error(j.error ?? "Não foi possível enviar o arquivo.");
    chave = j.chave;
    opcoes.progresso?.(100);
  }
  const r = await registrarArquivo({ chave, nome: arquivo.name, tipo: arquivo.type, uso, publico: opcoes.publico });
  if (!r.ok) throw new Error(r.erro);
  return r.arquivo;
}
