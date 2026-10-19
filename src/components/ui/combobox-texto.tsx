"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// Campo de texto com lista de sugestões no visual do sistema (o mesmo do
// destino na etapa 1), no lugar do <datalist> nativo, que o navegador desenha
// do jeito dele. Filtra conforme se digita, anda com as setas, escolhe com
// Enter e fecha com Escape; um valor fora da lista continua valendo.
export function ComboboxTexto({
  id,
  value,
  onChange,
  opcoes,
  placeholder,
  className,
}: {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: string[];
  placeholder?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(-1);
  const listaId = `${useId()}-lista`;
  const termo = value.trim().toLocaleLowerCase("pt-BR");
  const lista = termo ? opcoes.filter((o) => o.toLocaleLowerCase("pt-BR").includes(termo)) : opcoes;
  const mostrar = aberto && lista.length > 0;

  const escolher = (opcao: string) => {
    onChange(opcao);
    setAberto(false);
    setDestaque(-1);
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        className={cn("campo h-12 px-3.5", className)}
        placeholder={placeholder}
        value={value}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 160)}
        onChange={(ev) => {
          onChange(ev.target.value);
          setAberto(true);
          setDestaque(-1);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
            ev.preventDefault();
            if (!lista.length) return;
            setAberto(true);
            setDestaque((i) => (i + (ev.key === "ArrowDown" ? 1 : -1) + lista.length) % lista.length);
          } else if (ev.key === "Enter") {
            if (mostrar && destaque >= 0 && destaque < lista.length) {
              ev.preventDefault();
              escolher(lista[destaque]);
            }
          } else if (ev.key === "Escape") {
            setAberto(false);
          }
        }}
      />
      {mostrar ? (
        <div
          id={listaId}
          role="listbox"
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 max-h-[280px] overflow-y-auto rounded-box bg-surface p-1.5 shadow-modal"
        >
          {lista.map((opcao, i) => (
            <button
              key={opcao}
              type="button"
              role="option"
              aria-selected={destaque === i}
              onMouseDown={(ev) => {
                ev.preventDefault();
                escolher(opcao);
              }}
              className={cn("block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-soft", destaque === i && "bg-soft")}
            >
              {opcao}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
