import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, TabelaDados } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL, norm } from "@/lib/riep";

export const metadata: Metadata = { title: "Emendas — portal público" };

const POR_PAGINA = 25;

type Linha = { chave: string; numero: number | null; autor: string; objeto: string; destino: string; valor: number; situacao: string; href: string | null };

// Todas as emendas do exercício já apresentadas: as do sistema (nunca
// rascunho) e as apresentadas fora dele.
export default async function EmendasPublicasPage({ searchParams }: { searchParams: Promise<{ q?: string; autor?: string; pagina?: string }> }) {
  const { q = "", autor = "", pagina = "1" } = await searchParams;
  const ano = await getAnoAtivo();
  const [sistema, importadas, autores] = await Promise.all([
    prisma.emenda.findMany({ where: { exercicio: { ano: ano ?? -1 }, status: { not: "RASCUNHO" } }, include: { autor: true, destino: true } }),
    prisma.emendaImportada.findMany({ where: { exercicio: { ano: ano ?? -1 } }, include: { autor: true } }),
    prisma.autor.findMany({ orderBy: { nome: "asc" }, where: { OR: [{ emendas: { some: { status: { not: "RASCUNHO" } } } }, { emendasImportadas: { some: {} } }] } }),
  ]);
  const todas: (Linha & { autorId: string })[] = [
    ...sistema.map((e) => ({
      chave: e.id,
      autorId: e.autorId,
      numero: e.numero,
      autor: e.autor.nome,
      objeto: e.objeto,
      destino: e.destino?.nome ?? "—",
      valor: e.valor.toNumber(),
      situacao: e.status,
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
  const t = norm(q.trim());
  const filtradas = todas.filter((l) => (!autor || l.autorId === autor) && (!t || norm(`${l.objeto} ${l.destino} ${l.autor} ${l.numero}`).includes(t)));
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const p = Math.min(paginas, Math.max(1, Number(pagina) || 1));
  const visiveis = filtradas.slice((p - 1) * POR_PAGINA, p * POR_PAGINA);
  const link = (n: number) => `/publica/emendas?${new URLSearchParams({ ...(q ? { q } : {}), ...(autor ? { autor } : {}), pagina: String(n) })}`;

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Emendas do exercício {ano}</h1>
      <form className="flex flex-wrap gap-2" action="/publica/emendas">
        <input name="q" defaultValue={q} className="campo h-11 min-w-[240px] flex-1 px-3.5" placeholder="Buscar por objeto, destino, vereador ou número" />
        <select name="autor" defaultValue={autor} className="campo campo-select h-11 max-w-[300px] pr-9 pl-3.5" aria-label="Vereador">
          <option value="">Todos os vereadores</option>
          {autores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <Button type="submit">Filtrar</Button>
      </form>
      <Cartao titulo={`${filtradas.length} emenda(s)`}>
        <TabelaDados
          vazio="Nenhuma emenda encontrada."
          colunas={[{ titulo: "Nº" }, { titulo: "Vereador", className: "max-md:hidden" }, { titulo: "Objeto" }, { titulo: "Valor", className: "text-right" }, { titulo: "Situação" }]}
          linhas={visiveis.map((l) => ({
            chave: l.chave,
            celulas: [
              <b key="n" className="tnum">{l.numero ?? "—"}</b>,
              <span key="a" className="max-md:hidden">{l.autor}</span>,
              <div key="o" className="max-w-xl">
                {l.href ? (
                  <Link href={l.href} className="font-semibold hover:underline">
                    {l.objeto}
                  </Link>
                ) : (
                  <span className="line-clamp-3">{l.objeto}</span>
                )}
                {l.destino !== "—" ? <span className="block text-xs text-muted-foreground">{l.destino}</span> : null}
              </div>,
              <b key="v" className="whitespace-nowrap tnum">{BRL(l.valor)}</b>,
              <Selo key="s" tipo={l.situacao === "IMPORTADA" ? "neutro" : STATUS_EMENDA[l.situacao].tipo}>
                {l.situacao === "IMPORTADA" ? "apresentada" : STATUS_EMENDA[l.situacao].rotulo}
              </Selo>,
            ],
          }))}
        />
        {paginas > 1 ? (
          <div className="mt-4 flex items-center gap-2 text-sm">
            {p > 1 ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={link(p - 1)}>Anterior</Link>
              </Button>
            ) : null}
            <span className="text-muted-foreground">
              Página {p} de {paginas}
            </span>
            {p < paginas ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={link(p + 1)}>Próxima</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </Cartao>
    </div>
  );
}
