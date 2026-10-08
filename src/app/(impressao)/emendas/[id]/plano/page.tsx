import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { podeGerirEmenda, podeVerTodasEmendas, temPermissao } from "@/lib/authz";
import { buscarEmenda } from "@/lib/emendas/carregar";
import { DATA, MODELOS, type Modelo } from "@/lib/riep";
import { ConteudoPlano } from "@/components/emenda/plano-trabalho";
import { getCurrentUser } from "@/lib/session";
import { BotaoImprimir } from "@/components/app/botao-imprimir";
import { naoRemetida } from "@/lib/emendas/situacoes";

export const metadata: Metadata = { title: "Plano de trabalho — Emendas360" };

// Plano de trabalho da emenda, na estrutura dos Modelos I a IV. Prévia para
// conferência e impressão, sempre com os dados gravados.
export default async function PlanoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const x = await buscarEmenda(id);
  if (!x) notFound();
  const ve =
    podeGerirEmenda(user, { autorUsuarioId: x.autor.usuarioId }) ||
    podeVerTodasEmendas(user) ||
    temPermissao(user, "analisarViabilidade", "registrarExecucao", "consultarTudo");
  if (!ve) notFound();

  const M = x.modelo ? MODELOS[x.modelo as Modelo] : null;
  return (
    <div className="min-h-dvh bg-page py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[860px] flex-wrap justify-end gap-2 px-4 print:hidden">
        <Button asChild variant="ghost">
          <Link href={`/emendas/${x.id}/documento`}>
            <FileText /> Documento da emenda
          </Link>
        </Button>
        <BotaoImprimir />
      </div>
      <article className="mx-auto max-w-[860px] rounded-card bg-surface p-10 shadow-card max-sm:p-5 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b border-hair pb-4">
          <p className="antena">
            Emendas360 · exercício {x.exercicio.ano}
          </p>
          <h1 className="mt-1 text-xl font-extrabold">Emenda e plano de trabalho</h1>
          <p className="mt-1 text-sm font-bold text-navy">{M ? `Modelo ${M.numero} — ${M.titulo}` : "Modelo a definir pela análise técnica"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {naoRemetida(x.status) ? "Rascunho — prévia para conferência." : `Emenda nº ${x.numero}/${x.exercicio.ano}, submetida em ${DATA(x.submetidaEm)}.`}{" "}
            A aprovação e as assinaturas permanecem pendentes.
          </p>
        </header>
        <ConteudoPlano x={x} />
      </article>
    </div>
  );
}

