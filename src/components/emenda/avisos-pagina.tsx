import Link from "next/link";
import { Button } from "@/components/ui/button";

// Estados vazios das páginas de emenda, com o que falta para seguir.

export function Pagina({ titulo, children, acoes }: { titulo: string; children: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div className="px-7 pt-9 pb-11 max-md:px-4 max-md:pt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">{titulo}</h1>
        {acoes}
      </div>
      {children}
    </div>
  );
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Pagina titulo={titulo}>
      <div className="rounded-card bg-surface p-7 shadow-card">
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{texto}</p>
        <Button variant="ghost" asChild className="mt-5">
          <Link href="/emendas">Voltar às emendas</Link>
        </Button>
      </div>
    </Pagina>
  );
}

export const SemExercicio = () => (
  <Vazio titulo="Nova emenda" texto="Nenhum exercício orçamentário está configurado. Peça ao administrador para cadastrar o exercício e carregar a LOA." />
);
