import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { comFiltros, type Filtros } from "@/lib/emendas/filtros";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";

// Barra de filtros das listas de emendas. Formulário GET: a lista filtrada fica
// na URL e funciona sem JavaScript. Sem autores (o vereador), sem seletor de autor.
export function FiltrosEmendas({
  acao,
  filtros,
  autores,
  areas,
  situacoes,
  ocultos = {},
  guia,
}: {
  acao: string;
  filtros: Filtros;
  autores: { id: string; nome: string }[];
  areas: { id: string; nome: string }[];
  situacoes: string[];
  ocultos?: Record<string, string>;
  // Âncora do guia de ajuda.
  guia?: string;
}) {
  const caixa = "campo h-10 px-2.5 text-sm";
  return (
    <form data-guia={guia} method="get" action={acao} role="search" aria-label="Filtrar emendas" className="mb-4 grid gap-2.5">
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input name="q" defaultValue={filtros.q} className="campo h-10 pr-3 pl-9 text-sm" placeholder="Buscar por número, objeto, beneficiário ou autor" aria-label="Buscar" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Situação
          <select name="situacao" defaultValue={filtros.situacao[0] ?? ""} className={caixa}>
            <option value="">Todas</option>
            {situacoes.map((s) => (
              <option key={s} value={s}>
                {STATUS_EMENDA[s]?.rotulo ?? s}
              </option>
            ))}
          </select>
        </label>
        {autores.length ? (
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Autor
            <select name="autor" defaultValue={filtros.autorId ?? ""} className={caixa}>
              <option value="">Todos</option>
              {autores.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Área
          <select name="area" defaultValue={filtros.areaId ?? ""} className={caixa}>
            <option value="">Todas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          De
          <input type="date" name="de" defaultValue={filtros.de ?? ""} className={caixa} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Até
          <input type="date" name="ate" defaultValue={filtros.ate ?? ""} className={caixa} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={comFiltros(acao, {}, ocultos)}>Limpar</Link>
        </Button>
      </div>
    </form>
  );
}

// Paginação por links (a página é parte da URL).
export function Paginacao({ base, filtros, total, porPagina, extra = {} }: { base: string; filtros: Filtros; total: number; porPagina: number; extra?: Record<string, string> }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return total ? <p className="mt-3 text-xs text-muted-foreground">{total} emenda{total > 1 ? "s" : ""}.</p> : null;
  const atual = Math.min(filtros.pagina, paginas);
  const link = (n: number) => comFiltros(base, filtros, { ...extra, pagina: n });
  return (
    <nav aria-label="Paginação" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs text-muted-foreground">
        {total} emendas · página {atual} de {paginas}
      </span>
      <span className="ml-auto flex gap-1.5">
        {atual > 1 ? (
          <Link className="rounded-md bg-soft px-3 py-1.5 font-semibold hover:bg-field-hover" href={link(atual - 1)}>
            Anterior
          </Link>
        ) : null}
        {atual < paginas ? (
          <Link className="rounded-md bg-soft px-3 py-1.5 font-semibold hover:bg-field-hover" href={link(atual + 1)}>
            Próxima
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
