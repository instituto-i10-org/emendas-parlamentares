import "server-only";
import { cache } from "react";
import { NAO_REMETIDAS } from "@/lib/emendas/situacoes";
import { prisma } from "@/lib/prisma";
import { norm } from "@/lib/riep";

// Portal público ligado? (Configurações; a conformidade confere com consulta real.)
export const portalAtivo = cache(async () => (await prisma.municipio.findFirst({ select: { portalPublico: true } }))?.portalPublico ?? true);

export type LinhaPortal = {
  chave: string;
  autorId: string;
  numero: number | null;
  autor: string;
  objeto: string;
  destino: string;
  valor: number;
  situacao: string;
  href: string | null;
};

// A consulta do portal: emendas apresentadas (nunca rascunho nem de conta de
// demonstração) e as apresentadas fora do sistema, com busca e filtros.
// Portal desligado: null.
export async function consultarPortal(ano: number | null, f: { q?: string; autor?: string; situacao?: string }): Promise<LinhaPortal[] | null> {
  if (!(await portalAtivo())) return null;
  const [sistema, importadas] = await Promise.all([
    prisma.emenda.findMany({ where: { exercicio: { ano: ano ?? -1 }, status: { notIn: NAO_REMETIDAS }, autor: { demonstracao: false } }, include: { autor: true, destino: true } }),
    prisma.emendaImportada.findMany({ where: { exercicio: { ano: ano ?? -1 }, autor: { demonstracao: false } }, include: { autor: true } }),
  ]);
  const todas: LinhaPortal[] = [
    ...sistema.map((e) => ({
      chave: e.id,
      autorId: e.autorId,
      numero: e.numero,
      autor: e.autor.nome,
      objeto: e.objeto,
      destino: e.destino?.nome ?? "—",
      valor: e.valor.toNumber(),
      situacao: e.status as string,
      href: `/publica/emendas/${e.id}`,
    })),
    ...importadas.map((i) => ({
      chave: i.id,
      autorId: i.autorId,
      numero: i.numero,
      autor: i.autor.nome,
      objeto: i.descricao,
      destino: "—",
      valor: i.valor.toNumber(),
      situacao: "IMPORTADA",
      href: null,
    })),
  ].sort((a, b) => (a.numero ?? 1e9) - (b.numero ?? 1e9));
  const t = norm((f.q ?? "").trim());
  return todas.filter(
    (l) => (!f.autor || l.autorId === f.autor) && (!f.situacao || l.situacao === f.situacao) && (!t || norm(`${l.objeto} ${l.destino} ${l.autor} ${l.numero}`).includes(t))
  );
}
