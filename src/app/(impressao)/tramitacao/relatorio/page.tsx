import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BotaoImprimir } from "@/components/app/botao-imprimir";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { dadosRelatorioTramitacao, periodoDoRelatorio } from "@/lib/emendas/relatorio-tramitacao-servidor";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL, DATA, DATA_HORA } from "@/lib/riep";

export const metadata: Metadata = { title: "Relatório da tramitação — Emendas360" };

const data = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

// Versão para impressão do relatório da tramitação: título, período e as três
// tabelas, sem menu nem filtros.
export default async function RelatorioImpressaoPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  await requireAccess({ poder: Poder.LEGISLATIVO, permissoes: ["tramitarEmendas", "consultarTudo"] });
  const sp = await searchParams;
  const ano = await getAnoAtivo();
  const { inicio, fim } = periodoDoRelatorio({ de: data(sp.de), ate: data(sp.ate) });
  const [r, municipio] = await Promise.all([
    ano ? dadosRelatorioTramitacao(ano, inicio, fim) : null,
    prisma.municipio.findFirst({ select: { nome: true, uf: true, nomeCamara: true } }),
  ]);

  return (
    <div className="min-h-dvh bg-page py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[860px] justify-end gap-2 px-4 print:hidden">
        <BotaoImprimir />
      </div>
      <article className="mx-auto max-w-[860px] rounded-card bg-surface p-10 shadow-card max-sm:p-5 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b border-hair pb-4">
          <p className="antena">
            Emendas360 · {municipio?.nomeCamara || (municipio?.nome ? `${municipio.nome}/${municipio.uf}` : "")} · exercício {ano ?? "—"}
          </p>
          <h1 className="mt-1 text-xl font-extrabold">Relatório da tramitação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Movimentação de {DATA(inicio)} a {DATA(fim)} · emitido em {DATA_HORA(new Date())}
          </p>
        </header>

        {!r ? (
          <p className="mt-6 text-sm text-muted-foreground">Nenhum exercício.</p>
        ) : (
          <>
            <Secao titulo="Por situação">
              <Tabela
                colunas={["Situação", "Emendas", "Valor"]}
                direita={[1, 2]}
                linhas={[
                  ...r.porSituacao.map((s) => [STATUS_EMENDA[s.situacao]?.rotulo ?? s.situacao, s.qtd, BRL(s.valor)]),
                  ...(r.porSituacao.length ? [[<b key="t">Emendas movimentadas</b>, <b key="q">{r.total.qtd}</b>, <b key="v">{BRL(r.total.valor)}</b>]] : []),
                ]}
              />
            </Secao>
            <Secao titulo="Por autor">
              <Tabela
                colunas={["Autor", "Remetidas", "Aprovadas", "Rejeitadas"]}
                direita={[1, 2, 3]}
                linhas={r.porAutor.map((a) => [
                  a.autor,
                  `${a.remetidas} · ${BRL(a.valorRemetido)}`,
                  `${a.aprovadas} · ${BRL(a.valorAprovado)}`,
                  `${a.rejeitadas} · ${BRL(a.valorRejeitado)}`,
                ])}
              />
            </Secao>
            <Secao titulo="Movimentações">
              <Tabela
                colunas={["Quando", "Emenda", "Situação", "Valor"]}
                direita={[3]}
                linhas={r.linhas.map((l) => [
                  DATA_HORA(l.quando),
                  `${l.emenda.numero ? `nº ${l.emenda.numero} · ` : ""}${l.emenda.objeto} (${l.emenda.autor})`,
                  STATUS_EMENDA[l.situacao]?.rotulo ?? l.situacao,
                  BRL(l.emenda.valor),
                ])}
              />
            </Secao>
          </>
        )}
      </article>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 text-md font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

function Tabela({ colunas, linhas, direita = [] }: { colunas: string[]; linhas: ReactNode[][]; direita?: number[] }) {
  if (!linhas.length) return <p className="text-sm text-muted-foreground">Nenhuma movimentação no período.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-2xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
        <tr className="border-b border-hair">
          {colunas.map((c, i) => (
            <th key={c} className={`py-2 pr-3 last:pr-0 ${direita.includes(i) ? "text-right" : ""}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-hair">
        {linhas.map((l, i) => (
          <tr key={i} className="break-inside-avoid">
            {l.map((c, j) => (
              <td key={j} className={`py-2 pr-3 align-top last:pr-0 ${direita.includes(j) ? "text-right whitespace-nowrap tnum" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
