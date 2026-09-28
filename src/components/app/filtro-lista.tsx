"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Pilulas } from "@/components/emenda/ui";
import { norm } from "@/lib/riep";

// Lista com busca textual e filtro em pílulas, feita no navegador.
export function FiltroLista<T>({
  itens,
  texto,
  filtros,
  render,
  vazio = "Nada encontrado.",
  porPagina = 20,
}: {
  itens: T[];
  texto: (i: T) => string;
  filtros?: { rotulo: string; opcoes: Record<string, (i: T) => boolean> };
  render: (i: T) => ReactNode;
  vazio?: string;
  porPagina?: number;
}) {
  const [q, setQ] = useState("");
  const primeiro = filtros ? Object.keys(filtros.opcoes)[0] : null;
  const [filtro, setFiltro] = useState<string | null>(primeiro);
  const [limite, setLimite] = useState(porPagina);
  const visiveis = useMemo(() => {
    const t = norm(q.trim());
    return itens.filter((i) => (!t || norm(texto(i)).includes(t)) && (!filtros || !filtro || filtros.opcoes[filtro](i)));
  }, [itens, q, filtro, filtros, texto]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <input className="campo h-11 pr-3.5 pl-11" placeholder="Buscar" aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filtros ? <Pilulas rotulo={filtros.rotulo} opcoes={Object.keys(filtros.opcoes)} valor={filtro} aoEscolher={setFiltro} /> : null}
      </div>
      {visiveis.length ? (
        <div className="grid gap-3">{visiveis.slice(0, limite).map(render)}</div>
      ) : (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      )}
      {visiveis.length > limite ? (
        <button type="button" onClick={() => setLimite((l) => l + porPagina)} className="mt-4 text-sm font-bold text-navy hover:underline">
          Mostrar mais ({visiveis.length - limite} restantes)
        </button>
      ) : null}
    </div>
  );
}
