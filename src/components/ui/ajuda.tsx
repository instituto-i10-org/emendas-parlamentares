"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Botão "?" com a orientação num balão: o texto explicativo sai da tela e fica
// a um passe de mouse (ou foco do teclado) de distância.
export function Ajuda({ children, titulo = "Orientação", className }: { children: ReactNode; titulo?: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Ajuda: ${titulo}`}
          className={cn(
            "grid size-[22px] shrink-0 place-items-center rounded-full bg-page text-2xs font-bold text-muted-foreground transition-colors hover:bg-[#E0F6FB] hover:text-ink focus-visible:outline-2 focus-visible:outline-cyan",
            className
          )}
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[360px] text-sm">{children}</TooltipContent>
    </Tooltip>
  );
}

