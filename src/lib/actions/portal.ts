"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/audit";
import { temPermissao } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

async function municipio() {
  const m = await prisma.municipio.findFirst();
  if (!m) throw new Error("Município não cadastrado.");
  return m;
}

// Liga ou desliga o portal público.
export async function definirPortal(ligado: boolean): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!temPermissao(user, "administrarConfiguracoes")) return { ok: false, erro: "Sem permissão." };
  const m = await municipio();
  await prisma.$transaction(async (tx) => {
    await tx.municipio.update({ where: { id: m.id }, data: { portalPublico: ligado } });
    await auditar(tx, { usuarioId: user.id, entidade: "Municipio", entidadeId: m.id, acao: "PORTAL_PUBLICO", dadosAntes: { portalPublico: m.portalPublico }, dadosDepois: { portalPublico: ligado } });
  });
  revalidatePath("/", "layout");
  return { ok: true, mensagem: ligado ? "Portal público ligado." : "Portal público desligado." };
}

// Ato que institui o manual (norma cadastrada) e publicação.
export async function definirManual(entrada: { atoId: string | null; publicar: boolean }): Promise<Resultado> {
  const user = await getCurrentUser();
  if (!temPermissao(user, "administrarConfiguracoes")) return { ok: false, erro: "Sem permissão." };
  const m = await municipio();
  if (entrada.atoId && !(await prisma.documentoNormativo.findUnique({ where: { id: entrada.atoId } }))) return { ok: false, erro: "Ato não encontrado nas normas." };
  if (entrada.publicar && !entrada.atoId) return { ok: false, erro: "Escolha o ato que institui o manual antes de publicar." };
  const dados = {
    manualAtoId: entrada.atoId,
    manualPublicadoEm: entrada.publicar ? m.manualPublicadoEm ?? new Date() : null,
    manualPublicadoPorId: entrada.publicar ? m.manualPublicadoPorId ?? user.id : null,
  };
  await prisma.$transaction(async (tx) => {
    await tx.municipio.update({ where: { id: m.id }, data: dados });
    await auditar(tx, {
      usuarioId: user.id,
      entidade: "Municipio",
      entidadeId: m.id,
      acao: "MANUAL",
      dadosAntes: { manualAtoId: m.manualAtoId, manualPublicadoEm: m.manualPublicadoEm },
      dadosDepois: dados,
    });
  });
  revalidatePath("/", "layout");
  return { ok: true, mensagem: entrada.publicar ? "Manual publicado." : "Manual salvo (não publicado)." };
}
