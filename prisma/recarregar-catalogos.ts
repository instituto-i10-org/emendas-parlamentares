import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { subfuncaoDoDestino } from "../src/lib/riep/destino";
import type { TipoDestino } from "../src/lib/riep/tipos";
import { descreverProtecao, totalProtegido } from "../src/lib/cadastros/catalogos-protecao";
import { lerProtecaoCatalogos, semearCatalogos } from "./seed/catalogos";
import { lerDados } from "./seed/dados";

// Recarrega os catálogos do motor a partir de prisma/dados/mogi-guacu/
// biblioteca-objetos.json: áreas de aplicação, biblioteca de objetos (com
// pistas), tipos de destino e a subfunção sugerida dos destinos. Realinha
// também a unidade orçamentária dos destinos da base oficial com
// destinos-2026.json (o Hospital, por exemplo, aponta para o órgão inteiro).
//
//   npm run db:recarregar-catalogos                 só lista
//   CONFIRMAR=1 npm run db:recarregar-catalogos     grava
//
// O arquivo é a fonte, EXCETO áreas, tipos de destino e objetos editados pela
// tela (há registro de auditoria feito por uma pessoa: criar, alterar,
// renomear, excluir, reordenar). Esses ficam como estão e a listagem diz
// quais são; para regravá-los também a partir do arquivo:
//
//   SOBRESCREVER_EDICOES=1 CONFIRMAR=1 npm run db:recarregar-catalogos
//
// A subfunção
// sugerida só é preenchida onde está vazia — quem editou um destino à mão não
// é sobrescrito. A unidade só muda em destino da base oficial; os cadastrados
// por usuários não são tocados. Contra banco remoto exige PERMITIR_BANCO_REMOTO=1.

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
    prisma.destino.findMany({
      select: { id: true, nome: true, nomeOficial: true, execucao: true, subfuncaoSugerida: true, unidadeCodigo: true, origem: true },
    }),
  ]);
  const doArquivo = lerDados<{ destinos: { nome: string; execucao: string; unidade?: string }[] }>("destinos-2026.json").destinos;
  const mudamDeUnidade = destinos.flatMap((d) => {
    if (d.origem !== "BASE_OFICIAL" || d.execucao !== "DIRETA") return [];
    const unidade = doArquivo.find((x) => x.execucao === d.execucao && x.nome === d.nome)?.unidade;
    return unidade && unidade !== d.unidadeCodigo ? [{ id: d.id, nome: d.nome, de: d.unidadeCodigo, para: unidade }] : [];
  });
  const protecao = await lerProtecaoCatalogos(prisma);
  const novos = b.objetos.filter((o) => !objetosDb.some((x) => x.rotulo === o.rotulo)).map((o) => o.rotulo);
  const somem = objetosDb.filter((x) => !b.objetos.some((o) => o.rotulo === x.rotulo)).map((x) => x.rotulo);
  const tipos = b.tiposDestino ?? [];
  const preencher = destinos.filter((d) => d.execucao === "DIRETA" && !d.subfuncaoSugerida && subfuncaoDoDestino(d.nome, d.nomeOficial, tipos));

  console.log(`Biblioteca: ${objetosDb.length} objetos no banco · ${b.objetos.length} no arquivo`);
  if (novos.length) console.log(`  entram: ${novos.join(", ")}`);
  if (somem.length) console.log(`  saem: ${somem.join(", ")}`);
  console.log(`Tipos de destino: ${tiposDb} ativos no banco · ${tipos.length} no arquivo`);
  console.log(`Destinos que ganham subfunção sugerida: ${preencher.length}`);
  console.log(`Destinos da base oficial que mudam de unidade: ${mudamDeUnidade.length}`);
  for (const m of mudamDeUnidade) console.log(`  ${m.nome}: ${m.de ?? "—"} → ${m.para}`);

  const editados = descreverProtecao(protecao);
  if (editados.length) {
    console.log(`\nEstes ${totalProtegido(protecao)} registros foram editados pela tela e NÃO serão regravados pelo arquivo:`);
    for (const l of editados) console.log(l);
    console.log("Para sobrescrevê-los também, rode com SOBRESCREVER_EDICOES=1 (o que foi feito pela tela se perde).");
  } else if (process.env.SOBRESCREVER_EDICOES === "1") {
    console.log("\nSOBRESCREVER_EDICOES=1: edições feitas pela tela também serão regravadas a partir do arquivo.");
  }

  if (process.env.CONFIRMAR !== "1") {
    console.log("\nNada gravado. Rode de novo com CONFIRMAR=1 para gravar.");
    return;
  }
  const r = await semearCatalogos(prisma, protecao);
  let n = 0;
  for (const d of preencher) {
    await prisma.destino.update({ where: { id: d.id }, data: { subfuncaoSugerida: subfuncaoDoDestino(d.nome, d.nomeOficial, tipos) } });
    n++;
  }
  for (const m of mudamDeUnidade) await prisma.destino.update({ where: { id: m.id }, data: { unidadeCodigo: m.para } });
  console.log(
    `\nGravado: ${r.areas} áreas · ${r.objetos} objetos · ${r.tiposDestino} tipos de destino · ${n} destinos com subfunção sugerida · ${mudamDeUnidade.length} com unidade realinhada.` +
      (r.pulados.areas + r.pulados.objetos + r.pulados.tiposDestino
        ? ` Mantidos por edição pela tela: ${r.pulados.areas} áreas, ${r.pulados.objetos} objetos, ${r.pulados.tiposDestino} tipos.`
        : "")
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
