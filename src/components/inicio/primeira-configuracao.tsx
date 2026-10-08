"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { Barra } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { PassoPrimeiraConfiguracao } from "@/lib/cadastros/primeira-configuracao";
import { cn } from "@/lib/utils";

// Primeira configuração (só para quem administra as configurações): na página,
// só a barra com o progresso; os oito passos abrem numa janela. Somente
// leitura, conferido nos dados.
export function PrimeiraConfiguracao({ passos }: { passos: PassoPrimeiraConfiguracao[] }) {
  const [aberto, setAberto] = useState(false);
  const feitos = passos.filter((p) => p.ok).length;
  const completo = feitos === passos.length;
  return (
    <>
      <button
        type="button"
        data-guia="inicio.primeira-configuracao"
        onClick={() => setAberto(true)}
        className="mb-4 flex w-full items-center gap-4 rounded-card bg-surface px-6 py-4 text-left shadow-card transition-shadow hover:shadow-pop focus-visible:outline-2 focus-visible:outline-cyan max-sm:flex-wrap max-sm:px-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-md font-bold">{completo ? "Configuração completa" : "Primeira configuração"}</span>
          <span className="block text-xs text-muted-foreground">
            {feitos} de {passos.length} passos feitos
          </span>
        </span>
        <span className="w-40 max-sm:order-last max-sm:w-full">
          <Barra valor={feitos} total={passos.length} tom={completo ? "ok" : "cyan"} />
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-navy">
          Ver passos <ChevronRight className="size-4" aria-hidden />
        </span>
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent titulo={completo ? "Configuração completa" : "Primeira configuração"} largura="lg">
          <p className="mb-3 text-sm text-muted-foreground">
            {completo ? "Os oito passos estão feitos." : `${feitos} de ${passos.length} passos feitos. Siga na ordem; “Mostrar onde” leva à tela certa e abre o guia dela.`}
          </p>
          <ol data-teste="passos-primeira-configuracao" className="grid gap-px overflow-hidden rounded-box border border-hair">
            {passos.map((p, i) => (
              <li key={p.id} data-passo={p.id} className="flex items-center gap-3 bg-surface px-4 py-3 max-sm:flex-wrap">
                <span
                  className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold", p.ok ? "bg-ok-bg text-ok-ink" : "bg-page text-navy")}
                  aria-hidden
                >
                  {p.ok ? <Check className="size-4" strokeWidth={2.6} /> : i + 1}
                </span>
                {/* No celular, o texto do passo pendente ocupa a linha e "Mostrar onde" desce. */}
                <span className={cn("min-w-0 flex-1", !p.ok && "max-sm:basis-[calc(100%-2.5rem)]")}>
                  <span className="block text-sm font-bold">
                    {p.titulo}
                    <span className="sr-only">{p.ok ? " (feito)" : " (pendente)"}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">{p.texto}</span>
                </span>
                {p.ok ? (
                  <Selo tipo="ok">Feito</Selo>
                ) : (
                  <Link
                    href={`${p.href}${p.href.includes("?") ? "&" : "?"}guia=${p.guia}`}
                    onClick={() => setAberto(false)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-navy px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-navy-soft focus-visible:outline-2 focus-visible:outline-cyan max-sm:ml-10"
                  >
                    Mostrar onde
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
