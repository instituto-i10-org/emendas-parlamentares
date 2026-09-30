import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Apaga uma emenda de teste — e só ela. O autor e a conta de login ficam.
//
//   npx tsx prisma/apagar-emenda.ts <numero> <email-do-autor>            só lista
//   CONFIRMAR=1 npx tsx prisma/apagar-emenda.ts <numero> <email-do-autor> apaga
//
// Metas, itens, referências, parcelas, validações, pareceres e andamentos saem
// em cascata. A trilha de auditoria da emenda sai junto. Se a emenda for a
// última numerada do exercício, o contador volta um, para não deixar buraco.

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
  const [numeroArg, email] = process.argv.slice(2);
  const numero = Number(numeroArg);
  if (!Number.isInteger(numero) || !email) {
    console.error("Uso: npx tsx prisma/apagar-emenda.ts <numero> <email-do-autor>");
    process.exit(1);
  }

  const emendas = await prisma.emenda.findMany({
    where: { numero, autor: { usuario: { email: email.toLowerCase() } } },
    include: {
      autor: true,
      exercicio: true,
      pareceres: { select: { id: true } },
      andamentos: { select: { id: true } },
      _count: {
        select: { metas: true, itens: true, referencias: true, parcelas: true, validacoes: true },
      },
    },
  });
  if (emendas.length !== 1) {
    console.error(`Esperava 1 emenda nº ${numero} de ${email}; achei ${emendas.length}. Nada apagado.`);
    process.exit(1);
  }
  const e = emendas[0];
  const idsAuditados = [e.id, ...e.pareceres.map((p) => p.id), ...e.andamentos.map((a) => a.id)];
  const auditoria = await prisma.auditLog.count({ where: { entidadeId: { in: idsAuditados } } });
  const contador = await prisma.contadorEmenda.findUnique({ where: { exercicioId: e.exercicioId } });
  const voltaContador = contador?.ultimo === numero;

  console.log(`Emenda nº ${e.numero} (${e.status}) — exercício ${e.exercicio.ano}`);
  console.log(`  autor:  ${e.autor.nome} (fica)`);
  console.log(`  objeto: ${e.objeto.slice(0, 90)}${e.objeto.length > 90 ? "…" : ""}`);
  console.log(`  valor:  R$ ${e.valor.toFixed(2)}`);
  console.log(`  filhos: ${JSON.stringify(e._count)}, pareceres ${e.pareceres.length}, andamentos ${e.andamentos.length}`);
  console.log(`  auditoria: ${auditoria} registro(s)`);
  console.log(
    voltaContador
      ? `  contador: ${contador!.ultimo} → ${numero - 1}`
      : `  contador: fica em ${contador?.ultimo} (não é a última)`,
  );

  if (process.env.CONFIRMAR !== "1") {
    console.log("\nNada apagado. Rode de novo com CONFIRMAR=1 para apagar.");
    return;
  }

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { entidadeId: { in: idsAuditados } } }),
    prisma.emenda.delete({ where: { id: e.id } }),
    ...(voltaContador
      ? [prisma.contadorEmenda.update({ where: { exercicioId: e.exercicioId }, data: { ultimo: numero - 1 } })]
      : []),
  ]);
  console.log("\nEmenda apagada.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
