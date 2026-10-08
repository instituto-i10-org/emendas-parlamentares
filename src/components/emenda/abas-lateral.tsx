"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// A lateral da página da emenda em abas (validação, validações anteriores,
// situações): um cartão só, que não cresce com o histórico. Todas as abas
// ficam no HTML; só a escolhida aparece.
export function AbasLateral({ abas }: { abas: { id: string; rotulo: string; guia?: string; conteudo: ReactNode }[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.id);
  return (
    // Em coluna lateral, o cartão ocupa no máximo a altura visível da tela e o
    // conteúdo da aba rola por dentro; empilhado (≤ 1080 px), segue o fluxo.
    <div className="flex flex-col rounded-card bg-surface p-[22px] shadow-card min-h-0 min-[1081px]:max-h-full">
      <div role="tablist" aria-label="Validação e histórico" className="mb-4 flex shrink-0 flex-wrap gap-1 rounded-field bg-page p-1">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`aba-${a.id}`}
            aria-selected={a.id === ativa}
            aria-controls={`painel-${a.id}`}
            data-guia={a.guia}
            onClick={() => setAtiva(a.id)}
            className={cn(
              "flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors",
              a.id === ativa ? "bg-surface text-ink shadow-pop" : "text-muted-foreground hover:text-ink"
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {abas.map((a) => (
        <div
          key={a.id}
          role="tabpanel"
          id={`painel-${a.id}`}
          aria-labelledby={`aba-${a.id}`}
          hidden={a.id !== ativa}
          className="min-h-0 overflow-y-auto overscroll-contain min-[1081px]:-mr-2 min-[1081px]:pr-2"
        >
          {a.conteudo}
        </div>
      ))}
    </div>
  );
}
