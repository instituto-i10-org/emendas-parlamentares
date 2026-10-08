import Link from "next/link";
import type { ReactNode } from "react";
import { Ajuda } from "@/components/ui/ajuda";
import { cn } from "@/lib/utils";

// Peças comuns das páginas da aplicação, no visual da Direção A.

export function Pagina({
  titulo,
  trilha,
  descricao,
  acoes,
  guia,
  children,
}: {
  titulo: string;
  trilha?: { rotulo: string; href?: string }[];
  descricao?: ReactNode;
  acoes?: ReactNode;
  // Prefixo das âncoras dos guias de ajuda: "<guia>.titulo" e "<guia>.acoes".
  guia?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-7 pt-9 pb-11 max-md:px-4 max-md:pt-6">
      {trilha?.length ? (
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {trilha.map((t, i) => (
            <span key={t.rotulo}>
              {i ? " › " : ""}
              {t.href ? (
                <Link href={t.href} className="hover:underline">
                  {t.rotulo}
                </Link>
              ) : (
                <b className="font-bold text-ink">{t.rotulo}</b>
              )}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 data-guia={guia ? `${guia}.titulo` : undefined} className="flex items-center gap-2.5 text-2xl font-extrabold tracking-[-0.02em]">
          {titulo}
          {descricao ? (
            <Ajuda titulo={titulo} className="size-6 bg-surface shadow-pop">
              {descricao}
            </Ajuda>
          ) : null}
        </h1>
        {acoes ? (
          <div data-guia={guia ? `${guia}.acoes` : undefined} className="flex flex-wrap gap-2">
            {acoes}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function Cartao({
  titulo,
  ajuda,
  acoes,
  children,
  className,
  guia,
}: {
  titulo?: ReactNode;
  // Orientação sobre o bloco, no "?" ao lado do título.
  ajuda?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  // Âncora do guia de ajuda (data-guia).
  guia?: string;
}) {
  return (
    <section data-guia={guia} className={cn("rounded-card bg-surface p-[22px] shadow-card", className)}>
      {titulo || acoes ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo ? (
            <h2 className="flex items-center gap-2 text-md font-bold">
              {titulo}
              {ajuda ? <Ajuda titulo={typeof titulo === "string" ? titulo : undefined}>{ajuda}</Ajuda> : null}
            </h2>
          ) : (
            <span />
          )}
          {acoes}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  tom,
  guia,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  tom?: "ok" | "warn" | "bad" | "navy";
  guia?: string;
}) {
  return (
    <div data-guia={guia} className={cn("rounded-card p-[22px] shadow-card", tom === "navy" ? "bg-navy-deep text-white" : "bg-surface")}>
      <div className={cn("text-2xs font-bold tracking-[0.04em] uppercase", tom === "navy" ? "text-on-navy" : "text-muted-foreground")}>{rotulo}</div>
      <div
        className={cn(
          "mt-1 text-[22px] font-extrabold tracking-[-0.02em] tnum",
          tom === "ok" && "text-ok-ink",
          tom === "warn" && "text-warn",
          tom === "bad" && "text-bad-ink"
        )}
      >
        {valor}
      </div>
      {detalhe ? <div className={cn("mt-1 text-xs", tom === "navy" ? "text-on-navy" : "text-muted-foreground")}>{detalhe}</div> : null}
    </div>
  );
}

// Tabela de leitura: cabeçalho discreto, linhas separadas por fio. Em largura
// pequena (o PRÓPRIO cartão abaixo de 640px, não a janela), cada linha vira um
// cartão: um campo embaixo do outro, cada um com o rótulo da coluna, e as ações
// no fim. Colunas que a tabela esconde por falta de espaço voltam a aparecer
// no cartão.
export const CARTAO_LINHA = {
  tabela: "w-full text-sm @max-[640px]:block",
  cabecalho: "text-left text-2xs font-bold tracking-[0.04em] text-muted-foreground uppercase @max-[640px]:hidden",
  corpo: "divide-y divide-hair @max-[640px]:grid @max-[640px]:gap-3 @max-[640px]:divide-y-0",
  linha: "align-middle @max-[640px]:block @max-[640px]:rounded-xl @max-[640px]:border @max-[640px]:border-hair @max-[640px]:p-3.5",
  // Só o que muda no cartão; o espaçamento normal da célula fica em cada tabela.
  celula:
    "@max-[640px]:!block @max-[640px]:!px-0 @max-[640px]:!py-1 @max-[640px]:!text-left @max-[640px]:before:mb-0.5 @max-[640px]:before:block @max-[640px]:before:text-2xs @max-[640px]:before:font-bold @max-[640px]:before:tracking-[0.04em] @max-[640px]:before:text-muted-foreground @max-[640px]:before:uppercase @max-[640px]:before:content-[attr(data-rotulo)]",
};

export function TabelaDados({
  colunas,
  linhas,
  vazio = "Nada a mostrar.",
}: {
  colunas: { titulo: string; className?: string }[];
  linhas: { chave: string; celulas: ReactNode[] }[];
  vazio?: string;
}) {
  if (!linhas.length) return <p className="p-2 text-sm text-muted-foreground">{vazio}</p>;
  // @container: as colunas podem se esconder pela largura do PRÓPRIO cartão
  // (className "@max-[760px]:hidden"), não pela da janela — vale igual com o
  // menu recolhido ou em coluna lateral.
  return (
    <div className="@container overflow-x-auto">
      <table className={CARTAO_LINHA.tabela}>
        <thead className={CARTAO_LINHA.cabecalho}>
          <tr className="border-b border-hair">
            {colunas.map((c, i) => (
              <th key={`${c.titulo}-${i}`} className={cn("px-3 py-2.5 first:pl-0 last:pr-0", c.className)}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={CARTAO_LINHA.corpo}>
          {linhas.map((l) => (
            <tr key={l.chave} className={CARTAO_LINHA.linha}>
              {l.celulas.map((c, i) => (
                <td key={i} data-rotulo={colunas[i]?.titulo ?? ""} className={cn("px-3 py-3 first:pl-0 last:pr-0", CARTAO_LINHA.celula, colunas[i]?.className)}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Barra de progresso horizontal simples.
export function Barra({ valor, total, tom = "cyan" }: { valor: number; total: number; tom?: "cyan" | "ok" | "bad" | "warn" }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-page" aria-hidden>
      <i
        className={cn(
          "block h-full rounded-full",
          tom === "cyan" && "bg-cyan",
          tom === "ok" && "bg-ok",
          tom === "bad" && "bg-bad",
          tom === "warn" && "bg-warn"
        )}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
