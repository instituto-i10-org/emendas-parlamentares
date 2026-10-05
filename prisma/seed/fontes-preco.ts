import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { TipoReferenciaPreco } from "../../src/generated/prisma/enums";

type Fonte = { nome: string; url: string; orientacao: string; aplicaA: string[]; tipo: TipoReferenciaPreco };

// Fontes oficiais de preço indicadas ao autor. Valem para qualquer município:
// o arquivo fica em prisma/dados/comum. Edição posterior é por Configurações;
// o seed só cria o que falta, nunca sobrescreve o que foi ajustado na tela.
export async function semearFontesPreco(prisma: PrismaClient) {
  const fontes = JSON.parse(readFileSync(join(import.meta.dirname, "..", "dados", "comum", "fontes-preco.json"), "utf8")) as Fonte[];
  for (const [i, f] of fontes.entries()) {
    await prisma.fontePrecoOficial.upsert({
      where: { nome: f.nome },
      update: {},
      create: { ...f, ordem: (i + 1) * 10 },
    });
  }
  return fontes.length;
}
