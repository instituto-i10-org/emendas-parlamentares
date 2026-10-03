"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { definirExercicioAtivo } from "@/lib/actions/exercicio";
import type { SeletorExercicioDados } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

// Troca o exercício em exibição. Os anos anteriores ao padrão ficam como
// histórico: continuam consultáveis, mas o sistema abre sempre no padrão.
export function SeletorExercicio({
  ativo,
  anos,
  destino,
  className,
}: SeletorExercicioDados & {
  // Para onde ir depois da troca; sem destino, a página atual é recarregada.
  destino?: string;
  className?: string;
}) {
  const router = useRouter();
  const [trocando, iniciar] = useTransition();

  if (anos.length < 2) return <b className={cn("font-bold", className)}>{ativo}</b>;

  return (
    <select
      aria-label="Exercício em exibição"
      value={ativo}
      disabled={trocando}
      onChange={(e) => {
        const ano = Number(e.target.value);
        iniciar(async () => {
          await definirExercicioAtivo(ano);
          if (destino) router.push(destino);
          router.refresh();
        });
      }}
      className={cn(
        "cursor-pointer rounded-md bg-transparent py-0.5 pr-1 font-bold text-white focus-visible:outline-2 focus-visible:outline-cyan disabled:cursor-wait disabled:opacity-60",
        className
      )}
    >
      {anos.map((a) => (
        <option key={a} value={a} className="bg-white font-semibold text-navy-deep">
          {a}
        </option>
      ))}
    </select>
  );
}
