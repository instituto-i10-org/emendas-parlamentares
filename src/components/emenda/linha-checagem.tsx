import type { Checagem } from "@/lib/riep";
import { MarcaChecagem } from "./ui";

export function LinhaChecagem({ c }: { c: Checagem }) {
  return (
    <div className="flex gap-3 py-3">
      <MarcaChecagem nivel={c.nivel} />
      <div className="min-w-0">
        <div className="text-sm font-bold">{c.titulo}</div>
        <div className="text-xs leading-relaxed break-words text-muted-foreground">{c.detalhe}</div>
      </div>
    </div>
  );
}
