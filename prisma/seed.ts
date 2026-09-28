import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { semearAcesso } from "./seed/acesso";
import { semearExercicio } from "./seed/exercicio";
import { semearLoa } from "./seed/loa";
import { semearCatalogos } from "./seed/catalogos";
import { semearDestinos } from "./seed/destinos";
import { semearEmendasImportadas } from "./seed/emendas-importadas";

// Carga inicial: Mogi Guaçu, exercício 2026. Idempotente — rodar de novo
// realinha os dados sem duplicar e sem trocar senhas já definidas.
//
// Os dados reais ficam em prisma/dados/mogi-guacu/ (JSON extraído por OCR dos
// anexos da LOA, do PPA e das emendas; destinos do CNES, INEP, SUAS e Receita).

const url =
  process.env.Emendas_POSTGRES_URL_NON_POOLING ||
  process.env.Emendas_DATABASE_URL_UNPOOLED ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

if (!url) {
  console.error("Defina DATABASE_URL (ou DIRECT_URL) no .env antes de rodar o seed.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const acesso = await semearAcesso(prisma);
  const exercicio = await semearExercicio(prisma);
  const loa = await semearLoa(prisma, exercicio.id);
  const catalogos = await semearCatalogos(prisma);
  const destinos = await semearDestinos(prisma);
  const importadas = await semearEmendasImportadas(prisma, exercicio.id);

  console.log("Seed concluído.");
  console.table({
    perfis: acesso.perfis,
    usuarios: acesso.usuarios,
    dotacoes: loa.dotacoes,
    metasPpa: loa.metas,
    areas: catalogos.areas,
    objetos: catalogos.objetos,
    destinos,
    autores: importadas.autores,
    emendasImportadas: importadas.emendas,
  });
  if (acesso.senhasNovas.length) {
    console.log("\nContas criadas agora (anote: as senhas não são exibidas de novo):");
    console.table(acesso.senhasNovas);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
