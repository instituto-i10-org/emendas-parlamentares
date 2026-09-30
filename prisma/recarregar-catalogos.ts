import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { subfuncaoDoDestino } from "../src/lib/riep/destino";
import type { TipoDestino } from "../src/lib/riep/tipos";
import { semearCatalogos } from "./seed/catalogos";
import { lerDados } from "./seed/dados";

// Recarrega os catálogos do motor a partir de prisma/dados/mogi-guacu/
// biblioteca-objetos.json: áreas de aplicação, biblioteca de objetos (com
// pistas), tipos de destino e a subfunção sugerida dos destinos.
//
//   npm run db:recarregar-catalogos                 só lista
//   CONFIRMAR=1 npm run db:recarregar-catalogos     grava
//
// A biblioteca é substituída inteira (o arquivo é a fonte). A subfunção
// sugerida só é preenchida onde está vazia — quem editou um destino à mão não
// é sobrescrito. Contra banco remoto exige PERMITIR_BANCO_REMOTO=1.

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env.");
  process.exit(1);
}
if (/neon\.tech|vercel/.test(url) && process.env.PERMITIR_BANCO_REMOTO !== "1") {
  console.error("Banco remoto: rode com PERMITIR_BANCO_REMOTO=1 se for de propósito.");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const b = lerDados<{ areas: unknown[]; objetos: { rotulo: string }[]; tiposDestino?: TipoDestino[] }>("biblioteca-objetos.json");
  const [objetosDb, tiposDb, destinos] = await Promise.all([
    prisma.objetoBiblioteca.findMany({ select: { rotulo: true } }),
    prisma.tipoDestino.count({ where: { ativo: true } }),
    prisma.destino.findMany({ select: { id: true, nome: true, nomeOficial: true, execucao: true, subfuncaoSugerida: true } }),
  ]);
  const novos = b.objetos.filter((o) => !objetosDb.some((x) => x.rotulo === o.rotulo)).map((o) => o.rotulo);
  const somem = objetosDb.filter((x) => !b.objetos.some((o) => o.rotulo === x.rotulo)).map((x) => x.rotulo);
  const tipos = b.tiposDestino ?? [];
  const preencher = destinos.filter((d) => d.execucao === "DIRETA" && !d.subfuncaoSugerida && subfuncaoDoDestino(d.nome, d.nomeOficial, tipos));

  console.log(`Biblioteca: ${objetosDb.length} objetos no banco · ${b.objetos.length} no arquivo`);
  if (novos.length) console.log(`  entram: ${novos.join(", ")}`);
  if (somem.length) console.log(`  saem: ${somem.join(", ")}`);
  console.log(`Tipos de destino: ${tiposDb} ativos no banco · ${tipos.length} no arquivo`);
  console.log(`Destinos que ganham subfunção sugerida: ${preencher.length}`);

  if (process.env.CONFIRMAR !== "1") {
    console.log("\nNada gravado. Rode de novo com CONFIRMAR=1 para gravar.");
    return;
  }
  const r = await semearCatalogos(prisma);
  let n = 0;
  for (const d of preencher) {
    await prisma.destino.update({ where: { id: d.id }, data: { subfuncaoSugerida: subfuncaoDoDestino(d.nome, d.nomeOficial, tipos) } });
    n++;
  }
  console.log(`\nGravado: ${r.areas} áreas · ${r.objetos} objetos · ${r.tiposDestino} tipos de destino · ${n} destinos com subfunção sugerida.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
