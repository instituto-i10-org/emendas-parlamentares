"use server";

import { auditar } from "@/lib/audit";
import { resumoSha256 } from "@/lib/arquivos/armazenamento";
import { CHAVE_VALIDA, podeEnviarArquivo } from "@/lib/arquivos/permissao";
import { conferirArquivo, nomeSeguro, tipoDoArquivo, type UsoArquivo } from "@/lib/arquivos/regras";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export type ArquivoEnviado = { id: string; nome: string; tamanho: number };

// Depois do envio direto ao armazenamento: confere o que chegou (tamanho,
// tipo, resumo SHA-256) e registra no banco.
export async function registrarArquivo(entrada: {
  chave: string;
  nome: string;
  tipo: string;
  uso: UsoArquivo;
  publico?: boolean;
}): Promise<{ ok: true; arquivo: ArquivoEnviado } | { ok: false; erro: string }> {
  const user = await getCurrentUser();
  if (!podeEnviarArquivo(user, entrada.uso)) return { ok: false, erro: "Sem permissão para enviar este arquivo." };
  if (!CHAVE_VALIDA.test(entrada.chave) || !entrada.chave.startsWith(entrada.uso.toLowerCase() + "/")) {
    return { ok: false, erro: "Envio inválido." };
  }
  const nome = nomeSeguro(entrada.nome);
  const tipo = tipoDoArquivo(nome, entrada.tipo);
  let conferido: { sha256: string; tamanho: number };
  try {
    conferido = await resumoSha256(entrada.chave);
  } catch {
    return { ok: false, erro: "O arquivo não chegou ao armazenamento. Tente de novo." };
  }
  const erro = conferirArquivo(entrada.uso, { nome, tipo, tamanho: conferido.tamanho });
  if (erro) return { ok: false, erro };
  const arquivo = await prisma.$transaction(async (tx) => {
    const a = await tx.arquivo.create({
      data: { nome, tipo, tamanho: conferido.tamanho, sha256: conferido.sha256, chave: entrada.chave, uso: entrada.uso, publico: !!entrada.publico, enviadoPorId: user.id },
    });
    await auditar(tx, { usuarioId: user.id, entidade: "Arquivo", entidadeId: a.id, acao: "ENVIAR", dadosDepois: { nome, tipo, tamanho: a.tamanho, sha256: a.sha256, uso: a.uso } });
    return a;
  });
  return { ok: true, arquivo: { id: arquivo.id, nome: arquivo.nome, tamanho: arquivo.tamanho } };
}
