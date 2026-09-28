import { cn } from "@/lib/utils";

// Ícone da marca: um documento com a dobra, em ciano (aprovado em 28/09/2026).
export function MarcaDocumento({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-[26px] shrink-0", className)}>
      <path className="fill-cyan" d="M6 2h7v5a2 2 0 0 0 2 2h5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path className="fill-cyan/60" d="M14.5 2.6l5 5h-4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

// Marca completa, sobre superfície navy.
export function LogoEmendas360({ className, classeTexto }: { className?: string; classeTexto?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <MarcaDocumento />
      <span className={cn("flex min-w-0 flex-col whitespace-nowrap", classeTexto)}>
        <span className="text-sm leading-none font-extrabold tracking-[-0.03em] text-white">
          Emendas<b className="text-cyan">360</b>
        </span>
        <span className="mt-[3px] text-[7.5px] font-semibold tracking-[0.14em] text-on-navy uppercase">
          Orçamento impositivo
        </span>
      </span>
    </span>
  );
}
