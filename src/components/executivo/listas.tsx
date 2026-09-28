"use client";

import Link from "next/link";
import { Barra } from "@/components/app/pagina";
import { FiltroLista } from "@/components/app/filtro-lista";
import { Selo } from "@/components/emenda/ui";
import { ETAPA_EXECUCAO, RESULTADO_VIABILIDADE, STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { BRL } from "@/lib/riep";
import { AndamentoDialog, ParecerDialog } from "./dialogos";

export type LinhaExecutivo = {
  id: string;
  rotulo: string;
  objeto: string;
  autor: string;
  destino: string;
  dotacao: string;
  status: string;
  valor: number;
  parecer: { resultado: string; justificativa: string; por: string; em: string } | null;
  execucao: { empenhado: number; liquidado: number; pago: number };
  andamentos: { id: string; etapa: string; data: string; valor: number; documento: string | null; observacao: string | null }[];
};

const texto = (e: LinhaExecutivo) => `${e.rotulo} ${e.objeto} ${e.autor} ${e.destino}`;

export function ListaViabilidade({ linhas, podeAgir }: { linhas: LinhaExecutivo[]; podeAgir: boolean }) {
  return (
    <FiltroLista
      itens={linhas}
      texto={texto}
      vazio="Nenhuma emenda submetida neste exercício."
      filtros={{ rotulo: "Manifestação", opcoes: { Todas: () => true, "Sem parecer": (e) => !e.parecer, "Com parecer": (e) => !!e.parecer } }}
      render={(e) => (
        <article key={e.id} className="rounded-box bg-soft p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/emendas/${e.id}`} className="text-sm font-bold hover:underline">
                  {e.rotulo}
                </Link>
                <Selo tipo={STATUS_EMENDA[e.status]?.tipo ?? "neutro"}>{STATUS_EMENDA[e.status]?.rotulo ?? e.status}</Selo>
              </div>
              <p className="mt-1 text-sm">{e.objeto}</p>
              <p className="text-xs text-muted-foreground">
                {e.autor} · {e.destino} · {e.dotacao} · <b className="text-ink">{BRL(e.valor)}</b>
              </p>
            </div>
            {podeAgir ? <ParecerDialog emendaId={e.id} rotulo={e.rotulo} jaTem={!!e.parecer} /> : null}
          </div>
          {e.parecer ? (
            <div className="mt-3 rounded-md bg-surface p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Selo tipo={RESULTADO_VIABILIDADE[e.parecer.resultado].tipo}>{RESULTADO_VIABILIDADE[e.parecer.resultado].rotulo}</Selo>
                <span className="text-xs text-muted-foreground">
                  {e.parecer.por} · {e.parecer.em}
                </span>
              </div>
              <p className="whitespace-pre-line">{e.parecer.justificativa}</p>
            </div>
          ) : null}
        </article>
      )}
    />
  );
}

export function ListaExecucao({ linhas, podeAgir }: { linhas: LinhaExecutivo[]; podeAgir: boolean }) {
  return (
    <FiltroLista
      itens={linhas}
      texto={texto}
      vazio="Nenhuma emenda aprovada neste exercício."
      filtros={{
        rotulo: "Lançamentos",
        opcoes: { Todas: () => true, "Sem lançamento": (e) => !e.andamentos.length, "Com lançamento": (e) => !!e.andamentos.length },
      }}
      render={(e) => (
        <article key={e.id} className="rounded-box bg-soft p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <Link href={`/emendas/${e.id}`} className="text-sm font-bold hover:underline">
                {e.rotulo}
              </Link>
              <p className="mt-1 text-sm">{e.objeto}</p>
              <p className="text-xs text-muted-foreground">
                {e.autor} · {e.destino} · {e.dotacao} · aprovado <b className="text-ink">{BRL(e.valor)}</b>
              </p>
            </div>
            {podeAgir ? <AndamentoDialog emendaId={e.id} rotulo={e.rotulo} /> : null}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
            {(
              [
                ["Empenhado", e.execucao.empenhado],
                ["Liquidado", e.execucao.liquidado],
                ["Pago", e.execucao.pago],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-md bg-surface p-3">
                <div className="antena">{k}</div>
                <div className="text-sm font-bold tnum">{BRL(v)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Pago sobre o aprovado</span>
              <span className="tnum">{e.valor > 0 ? ((e.execucao.pago / e.valor) * 100).toFixed(1).replace(".", ",") : "0"}%</span>
            </div>
            <Barra valor={e.execucao.pago} total={e.valor} tom="ok" />
          </div>
          {e.andamentos.length ? (
            <ul className="mt-3 divide-y divide-hair text-xs">
              {e.andamentos.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Selo tipo={a.valor < 0 ? "warn" : "info"}>{ETAPA_EXECUCAO[a.etapa]}</Selo>
                  <b className="tnum">{BRL(a.valor)}</b>
                  <span className="text-muted-foreground">{a.data}</span>
                  {a.documento ? <span className="text-muted-foreground">doc. {a.documento}</span> : null}
                  {a.observacao ? <span className="text-muted-foreground">· {a.observacao}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      )}
    />
  );
}
