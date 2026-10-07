import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Apaga, em lote, emendas de um autor de DEMONSTRAÇÃO — e só dele. O autor e a
// conta de login ficam.
//
//   npm run db:apagar-emendas -- 352-372 vereador@emendas360.local            só lista
//   CONFIRMAR=1 npm run db:apagar-emendas -- 352-372 vereador@emendas360.local apaga
//
// O intervalo é de números de emenda (inclusive); aceita também uma lista
// "352,355,360". Rascunhos sem número não entram. Contra banco remoto exige
// PERMITIR_BANCO_REMOTO=1. Metas, itens, referências, parcelas, validações,
// pareceres e andamentos saem em cascata; a auditoria dessas entidades sai
// junto. O contador do exercício só volta se as apagadas forem as últimas.

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

function numeros(arg: string): number[] {
  const faixa = /^(\d+)-(\d+)$/.exec(arg);
  if (faixa) {
    const [a, b] = [Number(faixa[1]), Number(faixa[2])];
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  return arg
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

async function main() {
  const [faixa, email] = process.argv.slice(2);
  const alvo = faixa ? numeros(faixa) : [];
  if (!alvo.length || !email) {
    console.error("Uso: npm run db:apagar-emendas -- <de-ate | n1,n2,...> <email-do-autor>");
    process.exit(1);
  }

  const autor = await prisma.autor.findFirst({ where: { usuario: { email: email.toLowerCase() } } });
  if (!autor) {
    console.error(`Nenhum autor vinculado a ${email}. Nada apagado.`);
    process.exit(1);
  }
  if (!autor.demonstracao) {
    console.error(`${autor.nome} não é autor de demonstração. Este script não apaga emendas de autor real. Nada apagado.`);
    process.exit(1);
  }

  const emendas = await prisma.emenda.findMany({
    where: { autorId: autor.id, numero: { in: alvo } },
    include: {
      exercicio: { select: { ano: true, id: true } },
      pareceres: { select: { id: true } },
      andamentos: { select: { id: true } },
      _count: { select: { metas: true, itens: true, referencias: true, parcelas: true, validacoes: true } },
    },
    orderBy: { numero: "asc" },
  });
  if (!emendas.length) {
    console.log(`Nenhuma emenda de ${autor.nome} com número em ${faixa}. Nada a fazer.`);
    return;
  }
  const naoEncontradas = alvo.filter((n) => !emendas.some((e) => e.numero === n));

  console.log(`Autor de demonstração: ${autor.nome} (fica)`);
  console.log(`Emendas a apagar (${emendas.length}):`);
  let total = 0;
  for (const e of emendas) {
    total += e.valor.toNumber();
    console.log(
      `  nº ${e.numero} · ${e.status} · R$ ${e.valor.toFixed(2)} · ${e.objeto.slice(0, 70)}${e.objeto.length > 70 ? "…" : ""}` +
        ` · filhos ${JSON.stringify(e._count)} · pareceres ${e.pareceres.length} · andamentos ${e.andamentos.length}`
    );
  }
  console.log(`  total: R$ ${total.toFixed(2)}`);
  if (naoEncontradas.length) console.log(`  não encontradas para este autor (ignoradas): ${naoEncontradas.join(", ")}`);

  const exercicioId = emendas[0].exercicio.id;
  const contador = await prisma.contadorEmenda.findUnique({ where: { exercicioId } });
  const maior = Math.max(...emendas.map((e) => e.numero ?? 0));
  // O contador só volta se nada numerado acima das apagadas continuar existindo.
  const restamAcima = await prisma.emenda.count({ where: { exercicioId, numero: { gt: maior } } });
  const menor = Math.min(...emendas.map((e) => e.numero ?? 0));
  const voltaContador = !!contador && contador.ultimo === maior && restamAcima === 0 && alvo.length === maior - menor + 1;
  console.log(voltaContador ? `  contador: ${contador!.ultimo} → ${menor - 1}` : `  contador: fica em ${contador?.ultimo ?? "—"}`);

  if (process.env.CONFIRMAR !== "1") {
    console.log("\nNada apagado. Rode de novo com CONFIRMAR=1 para apagar.");
    return;
  }

  await prisma.$transaction([
    prisma.emenda.deleteMany({ where: { id: { in: emendas.map((e) => e.id) } } }),
    ...(voltaContador ? [prisma.contadorEmenda.update({ where: { exercicioId }, data: { ultimo: menor - 1 } })] : []),
  ]);
  console.log(`\n${emendas.length} emenda(s) apagada(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
