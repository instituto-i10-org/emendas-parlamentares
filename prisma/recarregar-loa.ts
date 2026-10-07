import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { lerDados } from "./seed/dados";
import { semearLoa } from "./seed/loa";

// Recarrega a base orçamentária de um exercício a partir de
// prisma/dados/mogi-guacu/loa-<ano>.json, ficha a ficha, sem apagar nada.
//
//   npm run db:recarregar-loa                 só lista o que mudaria (2026)
//   npm run db:recarregar-loa -- 2027         idem, para o exercício 2027
//   CONFIRMAR=1 npm run db:recarregar-loa     grava
//
// Contra banco remoto (Neon/Vercel) exige PERMITIR_BANCO_REMOTO=1.
//
// Trava: se alguma emenda de autor real (não marcado como demonstração) aponta
// para ficha que vai sumir ou mudar de valor, a gravação é recusada e a lista
// é impressa. Emendas de demonstração são só informadas.

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

type Linha = { ficha: string; uo: string; autorizado: number; nome: string };

async function main() {
  const ano = Number(process.argv[2] ?? 2026);
  if (!Number.isInteger(ano)) {
    console.error("Informe o ano do exercício (ex.: 2027).");
    process.exit(1);
  }
  const loa = lerDados<{ titulo: string; geradoEm?: string; dotacoes: Linha[] }>(`loa-${ano}.json`);
  const exercicio = await prisma.exercicio.findUnique({ where: { ano } });
  if (!exercicio) {
    console.error(`Exercício ${ano} não existe no banco.`);
    process.exit(1);
  }

  const novas = new Map(loa.dotacoes.filter((d) => /^\d+$/.test(d.ficha)).map((d) => [`${d.uo.split(".")[0]}|${d.ficha}`, d]));
  // Só as do projeto de lei: a lei aprovada repete as fichas.
  const gravadas = await prisma.dotacao.findMany({
    where: { exercicioId: exercicio.id, instrumento: { tipo: "LOA", especie: "PROJETO_LEI" } },
    include: { orgao: { select: { codigo: true } }, acao: { select: { nome: true } }, _count: { select: { emendas: true } } },
  });
  const chaveDe = (g: (typeof gravadas)[number]) => (g.ficha ? `${g.orgao.codigo}|${g.ficha}` : null);

  let iguais = 0;
  const mudam: { chave: string; de: number; para: number; emendas: number }[] = [];
  const somem: { chave: string; nome: string; emendas: number }[] = [];
  for (const g of gravadas) {
    const k = chaveDe(g);
    const n = k ? novas.get(k) : undefined;
    if (!n) {
      if (g.ativo) somem.push({ chave: k ?? g.codigo, nome: g.acao.nome, emendas: g._count.emendas });
      continue;
    }
    if (Math.round(g.valorAutorizado.toNumber() * 100) === Math.round(n.autorizado * 100)) iguais++;
    else mudam.push({ chave: k!, de: g.valorAutorizado.toNumber(), para: n.autorizado, emendas: g._count.emendas });
  }
  const chavesGravadas = new Set(gravadas.map(chaveDe).filter(Boolean));
  const entram = [...novas.keys()].filter((k) => !chavesGravadas.has(k)).length;

  console.log(`${loa.titulo}${loa.geradoEm ? ` · gerado em ${loa.geradoEm}` : ""}`);
  console.log(`  no banco: ${gravadas.length} dotações · no arquivo: ${loa.dotacoes.length}`);
  console.log(`  iguais: ${iguais} · mudam de valor: ${mudam.length} · entram: ${entram} · saem (ficam inativas): ${somem.length}`);

  // Emendas apontando para o que muda ou some.
  const idsAfetados = gravadas
    .filter((g) => {
      const k = chaveDe(g);
      return (k && mudam.some((m) => m.chave === k)) || (g.ativo && somem.some((s) => s.chave === (k ?? g.codigo)));
    })
    .map((g) => g.id);
  const emendas = idsAfetados.length
    ? await prisma.emenda.findMany({
        where: { dotacaoId: { in: idsAfetados } },
        include: { autor: { select: { nome: true, demonstracao: true } }, dotacao: { select: { ficha: true, codigo: true } } },
        orderBy: { numero: "asc" },
      })
    : [];
  const reais = emendas.filter((e) => !e.autor.demonstracao);
  const demo = emendas.filter((e) => e.autor.demonstracao);
  if (demo.length) {
    console.log(`\n  ${demo.length} emenda(s) de demonstração apontam para fichas que mudam (seguem, o vínculo é preservado):`);
    for (const e of demo) console.log(`    nº ${e.numero ?? "rascunho"} · ${e.autor.nome} · ficha ${e.dotacao?.ficha} (${e.dotacao?.codigo}) · ${e.status}`);
  }
  if (reais.length) {
    console.log(`\n  TRAVA: ${reais.length} emenda(s) de autor real apontam para fichas que mudam ou somem:`);
    for (const e of reais) console.log(`    nº ${e.numero ?? "rascunho"} · ${e.autor.nome} · ficha ${e.dotacao?.ficha} (${e.dotacao?.codigo}) · ${e.status}`);
    console.log("\n  Nada gravado. Decida com o responsável antes de recarregar.");
    process.exit(3);
  }

  if (process.env.CONFIRMAR !== "1") {
    console.log("\nNada gravado. Rode de novo com CONFIRMAR=1 para gravar.");
    return;
  }
  const r = await semearLoa(prisma, exercicio.id, ano);
  console.log(`\nGravado: ${r.criadas} criadas · ${r.atualizadas} atualizadas · ${r.desativadas} desativadas · ${r.metas} metas do PPA.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
