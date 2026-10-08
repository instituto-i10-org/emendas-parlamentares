"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type SecaoConfig = { id: string; titulo: string };
export type GrupoConfig = { titulo: string; secoes: SecaoConfig[] };

// Menu das Configurações: lista agrupada à esquerda; no celular, um seletor.
// O endereço continua com ?aba= (links, guias e "Mostrar onde").
export function MenuSecoes({ grupos, atual }: { grupos: GrupoConfig[]; atual: string }) {
  const router = useRouter();
  return (
    <>
      <nav data-guia="config.abas" aria-label="Seções das configurações" className="sticky top-4 rounded-card bg-surface p-3 shadow-card max-lg:hidden">
        {grupos.map((g) => (
          <div key={g.titulo} className="mb-3 last:mb-0">
            <div className="px-3 pt-1 pb-1.5 text-2xs font-bold tracking-[0.06em] text-muted-foreground uppercase">{g.titulo}</div>
            <ul className="grid gap-0.5">
              {g.secoes.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/config?aba=${a.id}`}
                    aria-current={a.id === atual ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-cyan",
                      a.id === atual ? "bg-navy text-white" : "text-ink hover:bg-soft"
                    )}
                  >
                    {a.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div data-guia="config.abas" className="lg:hidden">
        <label htmlFor="config-secao" className="mb-1.5 block text-sm font-semibold text-label">
          Seção
        </label>
        <select id="config-secao" className="campo campo-select h-12 pr-10 pl-3.5" value={atual} onChange={(ev) => router.push(`/config?aba=${ev.target.value}`)}>
          {grupos.map((g) => (
            <optgroup key={g.titulo} label={g.titulo}>
              {g.secoes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titulo}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </>
  );
}
