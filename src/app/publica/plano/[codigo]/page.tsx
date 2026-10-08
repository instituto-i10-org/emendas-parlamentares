import type { Metadata } from "next";
import { FormPlanoEntidade } from "@/components/entidade/form-plano";
import { abrirConvite } from "@/lib/actions/convite";
import { lerFontesPreco } from "@/lib/emendas/contexto";
import { BRL, DATA_HORA, fontesParaEmenda } from "@/lib/riep";

export const metadata: Metadata = { title: "Plano de trabalho da entidade — Emendas360", robots: { index: false, follow: false } };
// O link é pessoal: nada desta página vai para cache.
export const dynamic = "force-dynamic";

// Página que a entidade beneficiária abre pelo link do gabinete, sem cadastro.
export default async function PlanoEntidadePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const convite = await abrirConvite(codigo);
  if (!convite.ok) {
    return (
      <div className="mx-auto max-w-2xl rounded-card bg-surface p-8 shadow-card">
        <h1 className="mb-2 text-xl font-extrabold">Plano de trabalho da entidade</h1>
        <p className="text-sm leading-relaxed">{convite.erro}</p>
      </div>
    );
  }
  const fontes = await lerFontesPreco();
  const e = convite.emenda;
  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <section className="rounded-card bg-surface p-7 shadow-card max-md:px-4 max-md:py-5">
        <h1 className="mb-1 text-xl font-extrabold">Plano de trabalho da entidade</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Link válido até {DATA_HORA(new Date(convite.expiraEm))}, para um único envio. Depois de enviar, este link deixa de funcionar.
        </p>
        <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-1.5 text-sm max-sm:grid-cols-1">
          <dt className="text-muted-foreground">Emenda de</dt>
          <dd>{e.autor}</dd>
          <dt className="text-muted-foreground">Entidade</dt>
          <dd>{e.destino || "—"}</dd>
          <dt className="text-muted-foreground">Objeto</dt>
          <dd>{e.objeto || "—"}</dd>
          <dt className="text-muted-foreground">Exercício</dt>
          <dd>{e.exercicio}</dd>
          {e.valorPretendido ? (
            <>
              <dt className="text-muted-foreground">Valor da emenda</dt>
              <dd>{BRL(e.valorPretendido)}</dd>
            </>
          ) : null}
        </dl>
      </section>
      <FormPlanoEntidade
        codigo={codigo}
        etapasSugeridas={e.etapasSugeridas}
        valorPretendido={e.valorPretendido}
        tolerancia={e.tolerancia}
        indicadas={fontesParaEmenda(fontes, e.modelo, false)}
        todas={fontes}
      />
    </div>
  );
}
