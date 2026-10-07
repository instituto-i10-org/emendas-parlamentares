import type { PrismaClient } from "../../src/generated/prisma/client";
import type { Divisibilidade, NaturezaObjeto } from "../../src/generated/prisma/enums";
import { protecaoDosCatalogos, protecaoVazia, type Protecao } from "../../src/lib/cadastros/catalogos-protecao";
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
    pistas?: string[];
  }[];
  tiposDestino?: { nome: string; padrao: string; pistas: string[]; subfuncao: string | null }[];
};

// O que foi editado pela tela (auditoria feita por uma pessoa) e não deve ser
// regravado pelo arquivo. Com SOBRESCREVER_EDICOES=1, nada fica protegido.
export async function lerProtecaoCatalogos(prisma: PrismaClient): Promise<Protecao> {
  if (process.env.SOBRESCREVER_EDICOES === "1") return protecaoVazia();
  const [logs, areas, tipos, objetos] = await Promise.all([
    prisma.auditLog.findMany({
      where: { usuarioId: { not: null }, entidade: { in: ["AreaAplicacao", "TipoDestino", "ObjetoBiblioteca"] } },
      select: { entidade: true, entidadeId: true, acao: true, dadosAntes: true },
    }),
    prisma.areaAplicacao.findMany({ select: { id: true, nome: true } }),
    prisma.tipoDestino.findMany({ select: { id: true, nome: true } }),
    prisma.objetoBiblioteca.findMany({ select: { id: true, rotulo: true } }),
  ]);
  return protecaoDosCatalogos(logs, { areas, tipos, objetos });
}

// Áreas de aplicação, biblioteca de objetos e tipos de destino do motor de
// classificação. O arquivo é a fonte, EXCETO o que foi editado pela tela
// (criado, alterado, renomeado, excluído ou reordenado por uma pessoa): isso
// fica como está. Em banco novo não há edição pela tela e o arquivo vale
// inteiro. Para regravar também o editado: SOBRESCREVER_EDICOES=1.
export async function semearCatalogos(prisma: PrismaClient, protecao?: Protecao) {
  const b = lerDados<Biblioteca>("biblioteca-objetos.json");
  const p = protecao ?? (await lerProtecaoCatalogos(prisma));
  const pulados = { areas: 0, objetos: 0, tiposDestino: 0 };

  const areaId = new Map<string, string>();
  for (const a of b.areas) {
    if (p.areas.has(a.nome)) {
      pulados.areas++;
      const existente = await prisma.areaAplicacao.findUnique({ where: { nome: a.nome }, select: { id: true } });
      if (existente) areaId.set(a.nome, existente.id);
      continue;
    }
    const { ordem, ...resto } = a;
    const salvo = await prisma.areaAplicacao.upsert({
      where: { nome: a.nome },
      update: { orgaos: a.orgaos, unidadePadrao: a.unidadePadrao, ...(p.ordemAreas ? {} : { ordem }) },
      create: { ...resto, ordem },
    });
    areaId.set(a.nome, salvo.id);
  }

  // Objetos: saem e entram de novo só os que não foram editados pela tela; os
  // editados (inclusive os criados pela tela, que não estão no arquivo) ficam.
  const protegidos = [...p.objetos];
  await prisma.objetoBiblioteca.deleteMany({ where: { rotulo: { notIn: protegidos } } });
  const doArquivo = b.objetos.filter((o) => !p.objetos.has(o.rotulo));
  pulados.objetos = b.objetos.length - doArquivo.length;
  await prisma.objetoBiblioteca.createMany({
    data: doArquivo.map(({ area, pistas, ...o }) => ({ ...o, pistas: pistas ?? [], areaId: area ? areaId.get(area) ?? null : null })),
  });

  // Tipos de destino: o nome é a chave.
  const tipos = b.tiposDestino ?? [];
  for (const [i, t] of tipos.entries()) {
    if (p.tipos.has(t.nome)) {
      pulados.tiposDestino++;
      continue;
    }
    await prisma.tipoDestino.upsert({
      where: { nome: t.nome },
      update: { padrao: t.padrao, pistas: t.pistas, subfuncao: t.subfuncao, ativo: true, ...(p.ordemTipos ? {} : { ordem: i + 1 }) },
      create: { nome: t.nome, padrao: t.padrao, pistas: t.pistas, subfuncao: t.subfuncao, ordem: i + 1 },
    });
  }
  // Fora do arquivo e não criado pela tela: desativa.
  const nomes = new Set([...tipos.map((t) => t.nome), ...p.tipos]);
  await prisma.tipoDestino.updateMany({ where: { nome: { notIn: [...nomes] } }, data: { ativo: false } });

  return { areas: b.areas.length - pulados.areas, objetos: doArquivo.length, tiposDestino: tipos.length - pulados.tiposDestino, pulados };
}
