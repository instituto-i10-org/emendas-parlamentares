import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Marca (ou desmarca) um autor como conta de DEMONSTRAÇÃO, pelo e-mail do
// usuário vinculado. Autor de demonstração continua real dentro do sistema,
// some do portal público e é o único cujas emendas podem ser apagadas em lote.
//
//   npm run db:marcar-demonstracao -- vereador@emendas360.local            só lista
//   CONFIRMAR=1 npm run db:marcar-demonstracao -- vereador@emendas360.local marca
//   CONFIRMAR=1 DESMARCAR=1 npm run db:marcar-demonstracao -- <email>       desmarca
//
// Contra banco remoto exige PERMITIR_BANCO_REMOTO=1.

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
  const [email] = process.argv.slice(2);
  if (!email) {
    console.error("Uso: npm run db:marcar-demonstracao -- <email-do-usuario>");
    process.exit(1);
  }
  const marcar = process.env.DESMARCAR !== "1";
  const autor = await prisma.autor.findFirst({
    where: { usuario: { email: email.toLowerCase() } },
    include: { _count: { select: { emendas: true, emendasImportadas: true } } },
  });
  if (!autor) {
    console.error(`Nenhum autor vinculado a ${email}. Nada alterado.`);
    process.exit(1);
  }
  console.log(`${autor.nome} · demonstração hoje: ${autor.demonstracao ? "sim" : "não"} · ${autor._count.emendas} emenda(s) no sistema · ${autor._count.emendasImportadas} importada(s)`);
  if (autor._count.emendasImportadas && marcar) {
    console.error("Este autor tem emendas importadas da base oficial: é vereador real. Não marcado.");
    process.exit(3);
  }
  if (autor.demonstracao === marcar) {
    console.log("Já está assim. Nada a fazer.");
    return;
  }
  if (process.env.CONFIRMAR !== "1") {
    console.log(`\nNada alterado. Rode de novo com CONFIRMAR=1 para ${marcar ? "marcar" : "desmarcar"}.`);
    return;
  }
  await prisma.autor.update({ where: { id: autor.id }, data: { demonstracao: marcar } });
  console.log(`\n${autor.nome} ${marcar ? "marcado" : "desmarcado"} como demonstração.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
