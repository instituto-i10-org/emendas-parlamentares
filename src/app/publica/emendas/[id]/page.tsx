import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cartao } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { somasExecucao } from "@/lib/emendas/execucao";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { prisma } from "@/lib/prisma";
import { BRL, MODELOS } from "@/lib/riep";

export const metadata: Metadata = { title: "Emenda — portal público" };

// Ficha pública da emenda. Rascunhos não existem para o portal.
export default async function EmendaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.emenda.findFirst({
    where: { id, status: { not: "RASCUNHO" } },
    include: {
      autor: true,
      destino: true,
      exercicio: true,
      dotacao: { include: { acao: true, programa: true, unidadeOrcamentaria: true, naturezaDespesa: true } },
      metas: { orderBy: { ordem: "asc" } },
      andamentos: true,
    },
  });
  if (!e) notFound();
  const exec = somasExecucao(e.andamentos.map((a) => ({ etapa: a.etapa, valor: a.valor.toNumber() })));
  return (
    <div className="grid gap-5">
      <Link href="/publica/emendas" className="text-sm font-semibold text-muted-foreground hover:underline">
        ← Todas as emendas
      </Link>
      <Cartao>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Selo tipo={STATUS_EMENDA[e.status].tipo}>{STATUS_EMENDA[e.status].rotulo}</Selo>
          {e.modelo ? <Selo>{MODELOS[e.modelo].titulo}</Selo> : null}
        </div>
        <h1 className="text-xl font-extrabold">
          Emenda nº {e.numero}/{e.exercicio.ano}
        </h1>
        <p className="mt-2 text-md">{e.objeto}</p>
        <dl className="mt-5 grid grid-cols-[minmax(150px,auto)_1fr] gap-x-4 gap-y-2 text-sm max-sm:grid-cols-1">
          <dt className="text-muted-foreground">Vereador</dt>
          <dd>{e.autor.nome}{e.autor.partido ? ` — ${e.autor.partido}` : ""}</dd>
          <dt className="text-muted-foreground">Destino</dt>
          <dd>{e.destino?.nome ?? "—"}</dd>
          <dt className="text-muted-foreground">Local</dt>
          <dd>{e.endereco || "—"}</dd>
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-bold">{BRL(e.valor.toNumber())}</dd>
          <dt className="text-muted-foreground">Área</dt>
          <dd>{e.parcela === "SAUDE" ? "Saúde" : e.parcela === "DEMAIS" ? "Demais áreas" : "—"}</dd>
          <dt className="text-muted-foreground">Dotação</dt>
          <dd>
            {e.dotacao
              ? `${e.dotacao.unidadeOrcamentaria.nome} · ${e.dotacao.programa.nome} · ${e.dotacao.acao.nome} (${e.dotacao.naturezaDespesa.codigo})`
              : "a definir pela análise técnica"}
          </dd>
          <dt className="text-muted-foreground">Justificativa</dt>
          <dd className="whitespace-pre-line">{e.justificativa || "—"}</dd>
          <dt className="text-muted-foreground">Meta</dt>
          <dd>
            {e.metaFinalistica || "—"}
            {e.metas.map((m) => (
              <span key={m.id} className="block text-xs text-muted-foreground">
                {m.quantidade.toNumber().toLocaleString("pt-BR")} {m.unidade} — {m.beneficiarios}
              </span>
            ))}
          </dd>
          <dt className="text-muted-foreground">Execução</dt>
          <dd>
            Empenhado {BRL(exec.empenhado)} · liquidado {BRL(exec.liquidado)} · pago <b>{BRL(exec.pago)}</b>
          </dd>
          <dt className="text-muted-foreground">Apresentada em</dt>
          <dd>{e.submetidaEm?.toLocaleDateString("pt-BR") ?? "—"}</dd>
        </dl>
      </Cartao>
    </div>
  );
}
