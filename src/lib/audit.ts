import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

type Entrada = {
  usuarioId?: string | null;
  entidade: string;
  entidadeId: string;
  acao: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
};

const dados = (p: Entrada) => ({
  usuarioId: p.usuarioId ?? null,
  entidade: p.entidade,
  entidadeId: p.entidadeId,
  acao: p.acao,
  dadosAntes: (p.dadosAntes ?? undefined) as never,
  dadosDepois: (p.dadosDepois ?? undefined) as never,
});

// Auditoria na MESMA transação da alteração: se a alteração grava, o registro
// grava; se uma falha, a outra também. É o caminho para toda alteração de dado.
export async function auditar(tx: Prisma.TransactionClient, p: Entrada): Promise<void> {
  await tx.auditLog.create({ data: dados(p) });
}

// Registro fora de transação, para eventos que não alteram dado (login, saída,
// tentativa recusada). Nunca lança: o evento principal não pode cair por isso.
export async function registrarAuditoria(p: Entrada): Promise<void> {
  try {
    await prisma.auditLog.create({ data: dados(p) });
  } catch (e) {
    console.error("[audit] falha ao registrar auditoria:", e);
  }
}
