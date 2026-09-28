import type { PrismaClient } from "../../src/generated/prisma/client";
import type { Divisibilidade, NaturezaObjeto } from "../../src/generated/prisma/enums";
import { lerDados } from "./dados";

type Biblioteca = {
  areas: { nome: string; orgaos: string[]; unidadePadrao: string | null; ordem: number }[];
  objetos: {
    rotulo: string;
    termos: string[];
    natureza: NaturezaObjeto;
    elemento: string;
    divisibilidade: Divisibilidade;
    subfuncao: string | null;
    estrito: boolean;
    explicacao: string;
    area: string | null;
    ordem: number;
  }[];
};

// Áreas de aplicação e biblioteca de objetos do motor de classificação.
// O arquivo é a fonte: reaplicar o seed substitui a biblioteca inteira.
export async function semearCatalogos(prisma: PrismaClient) {
  const b = lerDados<Biblioteca>("biblioteca-objetos.json");

  const areaId = new Map<string, string>();
  for (const a of b.areas) {
    const salvo = await prisma.areaAplicacao.upsert({
      where: { nome: a.nome },
      update: { orgaos: a.orgaos, unidadePadrao: a.unidadePadrao, ordem: a.ordem },
      create: a,
    });
    areaId.set(a.nome, salvo.id);
  }

  await prisma.objetoBiblioteca.deleteMany({});
  await prisma.objetoBiblioteca.createMany({
    data: b.objetos.map(({ area, ...o }) => ({ ...o, areaId: area ? areaId.get(area) ?? null : null })),
  });

  return { areas: b.areas.length, objetos: b.objetos.length };
}
