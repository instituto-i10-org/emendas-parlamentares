import { CalendarCheck, CalendarX } from "lucide-react";
import type { SituacaoEmendamento } from "@/lib/emendas/emendamento";

// Faixa permanente: o emendamento está aberto ou fechado, e por quê.
export function IndicadorEmendamento({ s }: { s: SituacaoEmendamento | null }) {
  if (!s) return null;
  const Icone = s.aberto ? CalendarCheck : CalendarX;
  return (
    <p
      role="status"
      className={
        "mb-4 flex items-start gap-2 rounded-box px-4 py-3 text-sm " + (s.aberto ? "bg-info-bg text-ink" : "border border-warn-line bg-warn-bg text-[#7A4A06]")
      }
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <b>{s.aberto ? "Emendamento aberto." : "Emendamento fechado."}</b> {s.explicacao}
      </span>
    </p>
  );
}
