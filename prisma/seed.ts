import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { semearAcesso } from "./seed/acesso";
import { MUNICIPIO_SEED, lerMunicipio } from "./seed/dados";
import { anosComDados, semearExercicio, semearRegras } from "./seed/exercicio";
import { semearLoa } from "./seed/loa";
import { semearCatalogos } from "./seed/catalogos";
import { semearDestinos } from "./seed/destinos";
import { semearFontesPreco } from "./seed/fontes-preco";
import { semearEmendasImportadas } from "./seed/emendas-importadas";
import { semearVereadores } from "./seed/vereadores";

// Carga inicial do município (SEED_MUNICIPIO, padrão mogi-guacu): exercícios,
// projeto de lei com as dotações, catálogos, destinos, fontes de preço,
// vereadores e contas. Idempotente — rodar de novo realinha os dados sem
// duplicar e sem trocar senhas já definidas.
//
// Os dados ficam em prisma/dados/<município>/ (ver o FONTES.md da pasta).

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
  const municipio = lerMunicipio();
  console.log(`Município: ${municipio.nome}/${municipio.uf} (prisma/dados/${MUNICIPIO_SEED})`);
  const acesso = await semearAcesso(prisma);
  const resumo: Record<string, number> = { perfis: acesso.perfis, usuarios: acesso.usuarios };
  const exercicios: Record<number, string> = {};
  for (const ano of anosComDados()) {
    const exercicio = await semearExercicio(prisma, ano);
    exercicios[ano] = exercicio.id;
    const loa = await semearLoa(prisma, exercicio.id, ano);
    resumo[`dotacoes${ano}`] = loa.dotacoes;
    resumo[`metasPpa${ano}`] = loa.metas;
    resumo[`regras${ano}`] = await semearRegras(prisma, exercicio.id, ano);
  }
  const catalogos = await semearCatalogos(prisma);
  resumo.areas = catalogos.areas;
  resumo.objetos = catalogos.objetos;
  const mantidos = catalogos.pulados.areas + catalogos.pulados.objetos + catalogos.pulados.tiposDestino;
  if (mantidos) console.log(`Catálogos: ${mantidos} registro(s) editado(s) pela tela mantido(s) (SOBRESCREVER_EDICOES=1 para regravar).`);
  resumo.destinos = await semearDestinos(prisma);
  resumo.fontesPreco = await semearFontesPreco(prisma);
  resumo.vereadores = await semearVereadores(prisma);
  const imp = municipio.emendasImportadas;
  if (imp && exercicios[imp.ano]) {
    const importadas = await semearEmendasImportadas(prisma, exercicios[imp.ano]);
    resumo.autoresImportados = importadas.autores;
    resumo.emendasImportadas = importadas.emendas;
  }

  console.log("Seed concluído.");
  console.table(resumo);
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
