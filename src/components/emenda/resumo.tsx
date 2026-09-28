"use client";

import { Check, ChevronDown } from "lucide-react";
import type { ContextoEmenda } from "@/lib/emendas/contexto";
import { lerNumero, type EstadoEmenda } from "@/lib/emendas/estado";
import { BRL, audesp, parcelaDaDotacao, parcelaDemais, parcelaSaude, situacaoEfetiva, type Aplicado } from "@/lib/riep";
import { cn } from "@/lib/utils";
import type { DerivadoEmenda } from "./editor";

// Trilho da direita: o resumo como lista de verificação e a cota em duas
// parcelas, que acompanha o valor enquanto a emenda é montada.
export function Resumo({
  e,
  d,
  ctx,
  aplicado,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  ctx: ContextoEmenda;
  aplicado: Aplicado;
}) {
  const c = d.valida;
  const sit = situacaoEfetiva(c, e.selecao);
  const pretendido = lerNumero(e.pretendido);
  const parcela = parcelaDaDotacao(d.dotacao);
  const au = audesp(ctx.config);
  const linhas: [string, string | null][] = [
    ["Destino", d.destino?.nome ?? null],
    ["Execução", e.execucao === "DIRETA" ? "Execução direta (Poder Executivo)" : "Execução indireta (OSC/Terceiro Setor)"],
    ["Serve para", c ? (c.gnd === "4" ? "Investimento" : "Custeio") : null],
    [
      "Dotação",
      c && sit === "OK" && d.dotacao
        ? `${c.base}.${d.dotacao.elem} · ${d.dotacao.codigo} — ${d.dotacao.nome}`
        : c && sit === "VALIDAR"
          ? `${c.base} · ação em definição`
          : null,
    ],
    ["Pretendido", pretendido > 0 ? BRL(pretendido) : null],
    ["Valor", d.valor > 0 ? BRL(d.valor) : null],
    ["Parcela", parcela ? (parcela === "SAUDE" ? "Saúde — IC-CO 1002" : "Demais áreas") : null],
    ["AUDESP", d.dotacao ? (au ? `fonte ${au.fonte} · aplicação ${au.aplicacaoExibicao}` : "pendente de parametrização") : null],
  ];
  const definidos = linhas.filter(([, v]) => v).length;

  // O valor definitivo, quando existe, substitui a estimativa.
  const vigente = d.valor > 0 ? d.valor : pretendido;
  const cfg = ctx.config;

  return (
    <aside className="sticky top-4 grid gap-3.5 max-[1080px]:static">
      <div className="rounded-card bg-surface p-[22px] shadow-card">
        <div className="mb-2.5 text-md font-bold">Resumo</div>
        <div className="mb-4 grid gap-2.5">
          <span className="justify-self-start rounded-full bg-ok-bg px-2.5 py-1 text-xs font-bold text-ok-ink">
            {definidos} de {linhas.length} definidos
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-page" aria-hidden>
            <i className="block h-full rounded-full bg-ok transition-[width]" style={{ width: `${Math.round((definidos / linhas.length) * 100)}%` }} />
          </span>
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-3 text-sm">
          {linhas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="flex items-center gap-2.5 leading-tight text-muted-foreground">
                <span
                  className={cn(
                    "grid size-[18px] shrink-0 place-items-center rounded-full",
                    v ? "bg-ok text-navy-deep" : "border-[1.5px] border-dashed border-[#B8C3D6]"
                  )}
                >
                  {v ? <Check className="size-[11px]" strokeWidth={3.4} /> : null}
                </span>
                {k}
              </dt>
              <dd className="text-right font-bold break-words">{v ?? <span className="sr-only">a definir</span>}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[`Exercício ${cfg.exercicio}`, cfg.rotuloBase, "Impositiva"].filter(Boolean).map((x) => (
            <span key={x} className="rounded-full bg-page px-2.5 py-1 text-xs font-bold text-ink">
              {x}
            </span>
          ))}
        </div>
      </div>

      <details className="group rounded-card bg-navy-deep p-[22px] text-white shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-2xs font-bold tracking-[0.04em] text-on-navy uppercase">Cota individual</span>
            <span className="mt-1 block text-[20px] font-extrabold tracking-[-0.02em] tnum">
              {cfg.cotaIndividual === null ? "não parametrizada" : BRL(cfg.cotaIndividual)}
            </span>
          </span>
          <ChevronDown className="size-4 text-on-navy transition-transform group-open:rotate-180" />
        </summary>
        {cfg.cotaIndividual === null ? (
          <p className="mt-3 text-xs text-on-navy">
            Exercício {cfg.exercicio} sem cota configurada — conferência pendente, sem valor presumido.
          </p>
        ) : (
          <div className="mt-3 grid gap-4">
            <p className="text-xs text-on-navy">
              aplicado {BRL(aplicado.saude + aplicado.demais)}
              {vigente > 0 && parcela ? ` · com esta emenda ${BRL(aplicado.saude + aplicado.demais + vigente)}` : ""} · restam{" "}
              {BRL(Math.max(0, cfg.cotaIndividual - aplicado.saude - aplicado.demais - (parcela ? vigente : 0)))}
            </p>
            <BarraParcela
              nome="Saúde"
              aplicado={aplicado.saude}
              desta={parcela === "SAUDE" ? vigente : 0}
              total={parcelaSaude(cfg)!}
              destaque={parcela === "SAUDE"}
            />
            <BarraParcela
              nome="Demais áreas"
              aplicado={aplicado.demais}
              desta={parcela === "DEMAIS" ? vigente : 0}
              total={parcelaDemais(cfg)!}
              destaque={parcela === "DEMAIS"}
            />
          </div>
        )}
      </details>
    </aside>
  );
}

function BarraParcela({
  nome,
  aplicado,
  desta,
  total,
  destaque,
}: {
  nome: string;
  aplicado: number;
  desta: number;
  total: number;
  destaque: boolean;
}) {
  const soma = aplicado + desta;
  const excede = soma - total > 0.005;
  return (
    <div className={cn("transition-opacity", !destaque && "opacity-80")}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <b>{nome}</b>
        <span className="text-on-navy tnum">
          {BRL(soma)} de {BRL(total)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
        <i
          className={cn("block h-full rounded-full", excede ? "bg-bad" : nome === "Saúde" ? "bg-ok" : "bg-cyan")}
          style={{ width: `${Math.min(100, total > 0 ? (soma / total) * 100 : 0)}%` }}
        />
      </div>
      {excede ? (
        <p className="mt-1.5 text-xs font-semibold text-[#FF9EA1]">
          {desta > 0 ? `inclui ${BRL(desta)} desta emenda · ` : ""}excede em {BRL(soma - total)}
        </p>
      ) : null}
    </div>
  );
}
