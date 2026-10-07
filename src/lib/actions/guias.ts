"use server";

import { z } from "zod";
import { GUIAS } from "@/config/guias";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

const registroSchema = z.object({
  guia: z.string().min(1).max(80),
  como: z.enum(["CONCLUIDO", "PULADO"]),
});

// Guias de ajuda: registra que a pessoa concluiu ou pulou o guia na versão
// atual, para ele não abrir sozinho de novo. Só grava guias que existem.
export async function registrarGuia(entrada: z.input<typeof registroSchema>): Promise<Resultado> {
  const user = await getCurrentUser();
  const p = registroSchema.safeParse(entrada);
  if (!p.success) return { ok: false, erro: "Guia inválido." };
  const guia = GUIAS[p.data.guia];
  if (!guia) return { ok: false, erro: "Guia inválido." };
  const agora = new Date();
  const marca = p.data.como === "CONCLUIDO" ? { concluidoEm: agora, puladoEm: null } : { puladoEm: agora, concluidoEm: null };
  await prisma.guiaVisto.upsert({
    where: { usuarioId_guia: { usuarioId: user.id, guia: guia.id } },
    update: { versao: guia.versao, pulouTodos: false, ...marca },
    create: { usuarioId: user.id, guia: guia.id, versao: guia.versao, ...marca },
  });
  return { ok: true };
}

// "Pular todos": nenhum guia atual abre mais sozinho. Guia que mudar depois
// (versão nova) volta a abrir uma vez.
export async function pularTodosGuias(): Promise<Resultado> {
  const user = await getCurrentUser();
  const agora = new Date();
  await prisma.$transaction(
    Object.values(GUIAS).map((g) =>
      prisma.guiaVisto.upsert({
        where: { usuarioId_guia: { usuarioId: user.id, guia: g.id } },
        update: { versao: g.versao, puladoEm: agora, pulouTodos: true },
        create: { usuarioId: user.id, guia: g.id, versao: g.versao, puladoEm: agora, pulouTodos: true },
      })
    )
  );
  return { ok: true, mensagem: "Os guias não abrem mais sozinhos. Você pode vê-los em “Ver ajuda” ou revê-los em Minha conta." };
}

// "Rever todos os guias" (Minha conta): cada guia volta a abrir na próxima
// visita a cada tela.
export async function reverTodosGuias(): Promise<Resultado> {
  const user = await getCurrentUser();
  await prisma.guiaVisto.deleteMany({ where: { usuarioId: user.id } });
  return { ok: true, mensagem: "Pronto: cada guia abre de novo na sua próxima visita a cada tela." };
}
