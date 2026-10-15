"use client";

import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Parte = { autorId: string; nome: string; partido: string | null; valor: number; principal: boolean };

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Célula de autoria nas tabelas: o autor e um selo "+N" com os coautores. O
// balão (passar o mouse ou tocar) traz todos os nomes e valores; a linha não
// cresce nem quebra, com qualquer número de coautores.
export function AutoresEmenda({ autores, className }: { autores: Parte[]; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [autor, ...co] = autores;
  if (!autor) return <span>—</span>;
  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle", className)}>
      <span className="min-w-0 truncate" title={autor.nome}>
        {autor.nome}
      </span>
      {co.length ? (
        <Tooltip open={aberto} onOpenChange={setAberto}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-label={`Mais ${co.length} ${co.length === 1 ? "coautor" : "coautores"}: ${co.map((c) => c.nome).join(", ")}`}
              className="shrink-0 rounded-full border border-line bg-soft px-2 py-0.5 text-xs font-bold whitespace-nowrap text-navy tnum hover:bg-page focus-visible:outline-2 focus-visible:outline-cyan"
            >
              +{co.length}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[360px]">
            <p className="antena mb-1.5">Emenda em coautoria</p>
            <ul className="grid gap-1">
              {autores.map((a) => (
                <li key={a.autorId} className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0">
                    {a.nome}
                    {a.partido ? <span className="text-muted-foreground"> ({a.partido})</span> : null}
                    {a.principal ? <span className="text-xs text-muted-foreground"> · autor</span> : null}
                  </span>
                  <span className="shrink-0 font-bold tnum">{BRL(a.valor)}</span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}

// Etiqueta das visões de um vereador: a emenda é dele em coautoria (o valor
// mostrado ao lado é a parte dele).
export function EtiquetaCoautoria({ principal }: { principal: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-line bg-soft px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-navy">
      {principal ? "coautoria" : "coautor"}
    </span>
  );
}
