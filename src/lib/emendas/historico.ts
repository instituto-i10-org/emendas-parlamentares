import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { StatusEmenda } from "@/generated/prisma/enums";

// Toda mudança de situação da emenda passa por aqui, na mesma transação da
// mudança: grava a situação nova e a linha do histórico (de, para, quem,
// quando, texto). Os relatórios por período leem o histórico.
export async function mudarSituacao(
  tx: Prisma.TransactionClient,
  p: { emendaId: string; de: StatusEmenda | null; para: StatusEmenda; usuarioId: string | null; texto?: string | null; dados?: Prisma.EmendaUpdateInput }
) {
  const emenda = await tx.emenda.update({ where: { id: p.emendaId }, data: { ...(p.dados ?? {}), status: p.para } });
  await tx.historicoEmenda.create({
    data: { emendaId: p.emendaId, de: p.de, para: p.para, usuarioId: p.usuarioId, texto: p.texto ?? null },
  });
  return emenda;
}
