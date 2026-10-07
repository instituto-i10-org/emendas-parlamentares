import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { lerDados, lerMunicipio } from "./seed/dados";
import { lerExercicio, semearExercicio, semearRegras } from "./seed/exercicio";
import { semearLoa } from "./seed/loa";

// Cria um exercício a partir dos arquivos de prisma/dados/mogi-guacu/
// (exercicio-<ano>.json, loa-<ano>.json, unidades-<ano>.json): parâmetros das
// emendas, prazos, base legal, projeto de lei e dotações. Não toca nos outros
// exercícios nem nas emendas.
//
//   npm run db:carregar-exercicio -- 2027               só lista o que faria
//   CONFIRMAR=1 npm run db:carregar-exercicio -- 2027   grava
//
// Contra banco remoto (Neon/Vercel) exige PERMITIR_BANCO_REMOTO=1.
//
// Se o exercício já tem emendas, este comando só realinha os parâmetros com o
// arquivo; a base orçamentária se atualiza por `db:recarregar-loa -- <ano>`,
// que tem a trava das emendas reais. Carga interrompida no meio (sem emendas)
// é completada na execução seguinte.
//
// Antes dele, `db:recarregar-catalogos`: os destinos da base oficial precisam
// apontar para as unidades que este exercício tem (o Hospital, por exemplo).

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

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const ano = Number(process.argv[2]);
  if (!Number.isInteger(ano)) {
    console.error("Informe o ano do exercício: npm run db:carregar-exercicio -- 2027");
    process.exit(1);
  }
  const ex = lerExercicio(ano);
  const loa = lerDados<{ titulo: string; geradoEm?: string; dotacoes: { autorizado: number; uo: string }[] }>(`loa-${ano}.json`);
  const destinosArquivo = lerDados<{ destinos: { nome: string; execucao: string; unidade?: string }[] }>(lerMunicipio().destinos).destinos;
  const total = loa.dotacoes.reduce((s, d) => s + Math.round(d.autorizado * 100), 0) / 100;

  console.log(`Exercício ${ano} · ${loa.titulo}${loa.geradoEm ? ` · gerado em ${loa.geradoEm}` : ""}`);
  console.log(`  base das emendas: ${ex.instruments.bill.number} (${ex.instruments.bill.status})${ex.instruments.law ? ` · ${ex.instruments.law.number}` : " · sem lei aprovada"}`);
  console.log(`  dotações no arquivo: ${loa.dotacoes.length} · ${new Set(loa.dotacoes.map((d) => d.uo)).size} unidades · ${BRL(total)}`);
  console.log(`  cota individual: ${BRL(ex.individualQuota)} · ${ex.rclPercent}% da RCL de ${ex.rclBase.year} (${BRL(ex.rclBase.value)}) · ${ex.councilors} vereadores · saúde ${ex.healthPercent}%`);
  console.log(`  AUDESP: fonte ${ex.audespSource} · aplicação ${ex.applicationCode} · IC-EP ${ex.icEp ?? "sem vigência"}`);
  console.log(`  rótulo da base: ${ex.baseLabel} · órgãos fora das emendas: ${ex.excludedOrgans.join(", ")}`);
  console.log(`  prazos: ${ex.deadlines.length} · normas: ${ex.legalBasis.length}`);

  const existente = await prisma.exercicio.findUnique({
    where: { ano },
    include: { _count: { select: { dotacoes: true, emendas: true } } },
  });
  const outros = await prisma.exercicio.findMany({ where: { ano: { not: ano } }, orderBy: { ano: "desc" }, select: { ano: true, status: true } });
  console.log(
    existente
      ? `\n  no banco: exercício ${ano} existe (${existente.status}) · ${existente._count.dotacoes} dotações · ${existente._count.emendas} emendas`
      : `\n  no banco: exercício ${ano} ainda não existe`
  );
  console.log(`  outros exercícios (não são alterados): ${outros.map((e) => `${e.ano} ${e.status}`).join(", ") || "nenhum"}`);
  const soParametros = !!existente && existente._count.emendas > 0;
  const incompleta = !!existente && !soParametros && existente._count.dotacoes > 0 && existente._count.dotacoes !== loa.dotacoes.length;
  if (soParametros) {
    console.log(`\n  O exercício já tem emendas: só os parâmetros, prazos e normas seriam realinhados com o arquivo.`);
    console.log(`  Para atualizar as dotações: npm run db:recarregar-loa -- ${ano}`);
  } else if (incompleta) {
    console.log(`\n  Carga anterior incompleta (${existente!._count.dotacoes} de ${loa.dotacoes.length} dotações): seria completada agora.`);
  }
  if (existente) {
    console.log(`  Parâmetros, prazos e normas do exercício seriam regravados a partir do arquivo (o que foi editado em Configurações volta ao arquivo).`);
  }

  // Destinos da base oficial que o arquivo põe em outra unidade: sinal de que
  // `db:recarregar-catalogos` ainda não rodou nesta base.
  const destinosDb = await prisma.destino.findMany({ where: { origem: "BASE_OFICIAL", execucao: "DIRETA" }, select: { nome: true, unidadeCodigo: true } });
  const desalinhados = destinosDb.filter((d) => {
    const u = destinosArquivo.find((x) => x.execucao === "DIRETA" && x.nome === d.nome)?.unidade;
    return u && u !== d.unidadeCodigo;
  });
  if (desalinhados.length) {
    console.log(`\n  ATENÇÃO: ${desalinhados.length} destino(s) da base oficial ainda apontam para unidade antiga (${desalinhados.map((d) => d.nome).join("; ")}).`);
    console.log(`  Rode antes: CONFIRMAR=1 npm run db:recarregar-catalogos`);
  }
  if (!existente && outros.some((e) => e.status === "ABERTO" && e.ano < ano)) {
    console.log(`\n  Depois da carga, ${ano} passa a ser o exercício que abre por padrão (o aberto mais recente).`);
  }

  if (process.env.CONFIRMAR !== "1") {
    console.log("\nNada gravado. Rode de novo com CONFIRMAR=1 para gravar.");
    return;
  }

  const exercicio = await semearExercicio(prisma, ano);
  if (soParametros) {
    const regras = await semearRegras(prisma, exercicio.id, ano);
    console.log(`\nGravado: parâmetros, prazos, normas e ${regras} regra(s) de validação do exercício ${ano}.`);
    return;
  }
  const r = await semearLoa(prisma, exercicio.id, ano);
  const regras = await semearRegras(prisma, exercicio.id, ano);
  console.log(`\nGravado: exercício ${ano} · ${r.criadas} dotações criadas · ${r.atualizadas} atualizadas · ${r.metas} metas do PPA · ${regras} regra(s) de validação.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
