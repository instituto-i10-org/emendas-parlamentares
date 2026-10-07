import type { PrismaClient } from "../../src/generated/prisma/client";
import { lerDados, lerMunicipio } from "./dados";

// Vereadores da legislatura, como autores (sem conta no sistema até o
// administrador vincular um usuário). Idempotente por nome.
export async function semearVereadores(prisma: PrismaClient) {
  const arquivo = lerMunicipio().vereadores;
  if (!arquivo) return 0;
  const { vereadores } = lerDados<{ vereadores: { nome: string; partido: string | null }[] }>(arquivo);
  for (const v of vereadores) {
    await prisma.autor.upsert({
      where: { nome: v.nome },
      update: { partido: v.partido },
      create: { nome: v.nome, partido: v.partido, cargo: "Vereador" },
    });
  }
  return vereadores.length;
}
