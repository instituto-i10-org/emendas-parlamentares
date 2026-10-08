import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { FiltrosEmendas, Paginacao } from "@/components/app/filtros-emendas";
import { FormFiltros } from "@/components/app/form-filtros";
import { dadosRelatorioTramitacao, periodoDoRelatorio } from "@/lib/emendas/relatorio-tramitacao-servidor";
import { Cartao, Kpi, Pagina, TabelaDados } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { DecidirEmenda, DevolverAoAutor, MarcarIncorporada, PedirAjuste, ReabrirEmenda, ReceberEmenda } from "@/components/tramitacao/acoes";
import { Button } from "@/components/ui/button";
import type { StatusEmenda } from "@/generated/prisma/enums";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { podeTramitar } from "@/lib/authz";
import { listarEmendas, orgaosDaArea, paginaDeEmendas, type EmendaLinha } from "@/lib/emendas/consultas";
import { POR_PAGINA, comFiltros, lerFiltros, ondeDosFiltros, type Filtros } from "@/lib/emendas/filtros";
import { RESULTADO_VIABILIDADE, STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL, DATA, DATA_HORA, type Checagem, type Verificacao } from "@/lib/riep";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tramitação — Emendas360" };

const ABAS = [
  { id: "parecer", titulo: "Parecer", situacoes: ["SUBMETIDA", "EM_TRAMITACAO"] },
  { id: "saneamento", titulo: "Saneamento", situacoes: ["INVALIDA", "EM_DILIGENCIA"] },
  { id: "decididas", titulo: "Decididas", situacoes: ["APROVADA", "REJEITADA"] },
  { id: "lei", titulo: "Lei aprovada", situacoes: ["APROVADA"] },
  { id: "programas", titulo: "Por programa", situacoes: ["SUBMETIDA", "EM_TRAMITACAO", "EM_DILIGENCIA", "APROVADA", "REJEITADA"] },
  { id: "relatorios", titulo: "Relatórios", situacoes: [] },
] as const;
type Aba = (typeof ABAS)[number]["id"];

// O que a última validação apontou: falhas (saneamento) e alertas (parecer).
function apontamentos(e: EmendaLinha) {
  const v = e.validacoes[0];
  const ver = (v?.verificacoes ?? []) as unknown as Verificacao[];
  const comp = (v?.itens ?? []) as unknown as Checagem[];
  return {
    falhas: [
      ...ver.filter((x) => x.estado === "falha").map((x) => `(${x.numero}) ${x.titulo}: ${x.razao}`),
      ...comp.filter((c) => c.nivel === "bad").map((c) => `${c.titulo}: ${c.detalhe}`),
    ],
    alertas: [...ver.filter((x) => x.estado === "alerta").map((x) => `(${x.numero}) ${x.titulo}`), ...comp.filter((c) => c.nivel === "warn").map((c) => c.titulo)],
  };
}

// Tramitação na Câmara: fila de parecer, saneamento, decisões, incorporação à
// lei, consolidado por programa e relatórios, com os mesmos filtros e paginação.
export default async function TramitacaoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAccess({ poder: Poder.LEGISLATIVO, permissoes: ["tramitarEmendas", "consultarTudo"] });
  const sp = await searchParams;
  const ano = await getAnoAtivo();
  const aba: Aba = (ABAS.find((a) => a.id === sp.aba)?.id ?? "parecer") as Aba;
  const decide = podeTramitar(user);
  const filtros = lerFiltros(sp);
  const defAba = ABAS.find((a) => a.id === aba)!;

  const [autores, areas, cfg, kpis] = await Promise.all([
    prisma.autor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.areaAplicacao.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
    ano ? prisma.configuracaoExercicio.findFirst({ where: { exercicio: { ano } }, select: { prazoDiligenciaDias: true } }) : null,
    ano ? prisma.emenda.groupBy({ by: ["status"], where: { exercicio: { ano } }, _count: { _all: true }, _sum: { valor: true } }) : [],
  ]);
  const k = (ss: string[]) => {
    const g = kpis.filter((x) => ss.includes(x.status));
    return { qtd: g.reduce((s, x) => s + x._count._all, 0), valor: g.reduce((s, x) => s + (x._sum.valor?.toNumber() ?? 0), 0) };
  };

  const situacoesDaAba = defAba.situacoes as readonly string[];
  // O filtro de situação só restringe dentro das situações da aba.
  const situacao = filtros.situacao.filter((s) => situacoesDaAba.includes(s));
  const f: Filtros = { ...filtros, situacao: (situacao.length ? situacao : [...situacoesDaAba]) as StatusEmenda[] };
  const pagina =
    ano && aba !== "relatorios" && aba !== "programas"
      ? await paginaDeEmendas(ano, ondeDosFiltros(f, await orgaosDaArea(filtros.areaId)), filtros.pagina, POR_PAGINA)
      : { total: 0, linhas: [] as EmendaLinha[] };

  const rotulo = (e: EmendaLinha) => (e.numero ? `Emenda nº ${e.numero}/${ano}` : "Emenda");
  const hoje = new Date();
  const celulaEmenda = (e: EmendaLinha, extra?: React.ReactNode) => (
    <div key="o" className="max-w-[440px] min-w-[220px] @max-[640px]:max-w-none">
      <Link href={`/emendas/${e.id}`} title={e.objeto || undefined} className="line-clamp-2 font-bold break-words hover:underline">
        {e.objeto || "(sem objeto)"}
      </Link>
      <span className="block text-xs text-muted-foreground">
        {e.autor.nome} · {e.destino?.nome ?? "—"} · {e.dotacao ? e.dotacao.codigo : "dotação a definir pela análise técnica"}
        {e.reenviadaEm ? ` · reenviada após diligência em ${DATA(e.reenviadaEm)}` : ""}
      </span>
      <span className="mt-1 flex flex-wrap gap-1">
        <Selo tipo={STATUS_EMENDA[e.status].tipo}>{STATUS_EMENDA[e.status].rotulo}</Selo>
      </span>
      {extra}
    </div>
  );
  const valor = (e: EmendaLinha) => (
    <span key="v" className="font-bold whitespace-nowrap tnum">
      {BRL(e.valor.toNumber())}
    </span>
  );
  const parecerExecutivo = (e: EmendaLinha) => {
    const p = e.pareceres[0];
    return p ? (
      <Selo tipo={RESULTADO_VIABILIDADE[p.resultado].tipo}>{RESULTADO_VIABILIDADE[p.resultado].rotulo}</Selo>
    ) : (
      <span className="text-xs text-muted-foreground">sem parecer</span>
    );
  };
  const aguardando = k(["SUBMETIDA", "EM_TRAMITACAO"]);
  const saneamento = k(["INVALIDA", "EM_DILIGENCIA"]);

  return (
    <Pagina
      titulo="Tramitação"
      guia="tramitacao"
      descricao="Parecer de mérito separado do saneamento. A Comissão recebe, pede ajuste ou decide com parecer escrito; tudo fica no histórico da emenda."
      acoes={
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" asChild>
            <a href={comFiltros("/api/export/emendas", filtros, { ano: ano ?? "", formato: "xlsx" })}>
              <Download /> Exportar XLSX
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a href={comFiltros("/api/export/emendas", filtros, { ano: ano ?? "", formato: "csv" })}>
              <Download /> CSV
            </a>
          </Button>
        </div>
      }
    >
      <div data-guia="tramitacao.totais" className="mb-5 grid grid-cols-4 gap-3.5 max-lg:grid-cols-2 print:hidden">
        <Kpi rotulo="Aguardando parecer" valor={aguardando.qtd} detalhe={BRL(aguardando.valor)} tom={aguardando.qtd ? "warn" : undefined} />
        <Kpi rotulo="Em saneamento" valor={saneamento.qtd} detalhe={BRL(saneamento.valor)} />
        <Kpi rotulo="Aprovadas" valor={k(["APROVADA"]).qtd} detalhe={BRL(k(["APROVADA"]).valor)} tom="ok" />
        <Kpi rotulo="Rejeitadas" valor={k(["REJEITADA"]).qtd} detalhe={BRL(k(["REJEITADA"]).valor)} />
      </div>

      <nav data-guia="tramitacao.abas" aria-label="Filas" className="mb-4 flex flex-wrap gap-1 rounded-box bg-surface p-1.5 shadow-[0_1px_2px_rgba(10,36,99,.06)] print:hidden">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/tramitacao?aba=${a.id}`}
            aria-current={a.id === aba ? "page" : undefined}
            className={cn("rounded-md px-3.5 py-2 text-sm font-semibold", a.id === aba ? "bg-navy text-white" : "text-muted-foreground hover:bg-soft")}
          >
            {a.titulo}
          </Link>
        ))}
      </nav>

      {aba === "relatorios" ? (
        await relatorios(ano, filtros)
      ) : aba === "programas" ? (
        await programas(ano, f, filtros.areaId, autores, areas)
      ) : (
        <Cartao titulo={`${defAba.titulo} (${pagina.total})`}>
          <FiltrosEmendas guia="tramitacao.filtros" acao="/tramitacao" filtros={filtros} autores={autores} areas={areas} situacoes={[...situacoesDaAba]} ocultos={{ aba }} />
          {aba === "parecer" ? (
            <TabelaDados
              vazio="Nenhuma emenda aguardando parecer."
              colunas={[
                { titulo: "Nº" },
                { titulo: "Emenda" },
                { titulo: "Alertas da validação", className: "@max-[760px]:hidden" },
                { titulo: "Viabilidade", className: "@max-[560px]:hidden" },
                { titulo: "Valor", className: "text-right" },
                { titulo: "" },
              ]}
              linhas={pagina.linhas.map((e) => {
                const a = apontamentos(e);
                return {
                  chave: e.id,
                  celulas: [
                    <b key="n" className="tnum">
                      {e.numero ?? "—"}
                    </b>,
                    celulaEmenda(e),
                    <ul key="al" className="max-w-xs text-xs text-muted-foreground" aria-label="Alertas da validação">
                      {a.alertas.length ? a.alertas.slice(0, 4).map((t) => <li key={t}>{t}</li>) : <li>Sem alertas.</li>}
                    </ul>,
                    <span key="p">
                      {parecerExecutivo(e)}
                    </span>,
                    valor(e),
                    decide ? (
                      <div key="d" data-guia="tramitacao.decidir" className="flex flex-nowrap justify-end gap-1.5 @max-[640px]:flex-wrap @max-[640px]:justify-start">
                        {e.status === "SUBMETIDA" ? <ReceberEmenda emendaId={e.id} rotulo={rotulo(e)} /> : null}
                        <PedirAjuste emendaId={e.id} rotulo={rotulo(e)} diasPadrao={cfg?.prazoDiligenciaDias ?? 5} />
                        <DecidirEmenda emendaId={e.id} rotulo={rotulo(e)} />
                      </div>
                    ) : null,
                  ],
                };
              })}
            />
          ) : aba === "saneamento" ? (
            <TabelaDados
              vazio="Nada em saneamento."
              colunas={[{ titulo: "Nº" }, { titulo: "Emenda" }, { titulo: "Apontamento", className: "@max-[700px]:hidden" }, { titulo: "Valor", className: "text-right" }, { titulo: "" }]}
              linhas={pagina.linhas.map((e) => {
                const a = apontamentos(e);
                const vencido = e.status === "EM_DILIGENCIA" && !!e.diligenciaAte && e.diligenciaAte < hoje;
                return {
                  chave: e.id,
                  celulas: [
                    <b key="n" className="tnum">
                      {e.numero ?? "—"}
                    </b>,
                    celulaEmenda(e),
                    <div key="ap" className="max-w-md text-xs">
                      {e.status === "EM_DILIGENCIA" ? (
                        <>
                          <p className="line-clamp-3">Pedido da Comissão: {e.diligenciaMotivo}</p>
                          <p className="mt-1">
                            Prazo {DATA(e.diligenciaAte)} {vencido ? <Selo tipo="bad">prazo vencido</Selo> : <Selo tipo="warn">aguardando o autor</Selo>}
                          </p>
                        </>
                      ) : (
                        <ul className="grid gap-1" aria-label="Verificações que falharam">
                          {a.falhas.slice(0, 5).map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      )}
                    </div>,
                    valor(e),
                    decide ? (
                      <div key="d" data-guia="tramitacao.sanear" className="flex flex-nowrap justify-end gap-1.5 @max-[640px]:flex-wrap @max-[640px]:justify-start">
                        {e.status === "INVALIDA" ? <DevolverAoAutor emendaId={e.id} rotulo={rotulo(e)} /> : null}
                        {vencido ? <DecidirEmenda emendaId={e.id} rotulo={rotulo(e)} /> : null}
                      </div>
                    ) : null,
                  ],
                };
              })}
            />
          ) : aba === "decididas" ? (
            <TabelaDados
              vazio="Nenhuma emenda decidida."
              colunas={[{ titulo: "Nº" }, { titulo: "Emenda" }, { titulo: "Parecer", className: "@max-[700px]:hidden" }, { titulo: "Valor", className: "text-right" }, { titulo: "" }]}
              linhas={pagina.linhas.map((e) => ({
                chave: e.id,
                celulas: [
                  <b key="n" className="tnum">
                    {e.numero ?? "—"}
                  </b>,
                  celulaEmenda(e, <span className="mt-1 block text-xs text-muted-foreground">decidida em {DATA(e.tramitadaEm)}</span>),
                  <p key="p" className="line-clamp-3 max-w-md text-xs text-muted-foreground">
                    {e.parecerTramitacao}
                  </p>,
                  valor(e),
                  decide && !e.andamentos.length ? (
                    <div key="r" data-guia="tramitacao.reabrir">
                      <ReabrirEmenda emendaId={e.id} />
                    </div>
                  ) : null,
                ],
              }))}
            />
          ) : (
            <TabelaDados
              vazio="Nenhuma emenda aprovada."
              colunas={[{ titulo: "Nº" }, { titulo: "Emenda" }, { titulo: "Incorporação à lei" }, { titulo: "Valor", className: "text-right" }, { titulo: "" }]}
              linhas={pagina.linhas.map((e) => ({
                chave: e.id,
                celulas: [
                  <b key="n" className="tnum">
                    {e.numero ?? "—"}
                  </b>,
                  celulaEmenda(e),
                  <span key="i" className="text-xs">
                    {e.incorporadaEm ? (
                      <>
                        <Selo tipo="ok">Incorporada</Selo>
                        <span className="mt-1 block text-muted-foreground">
                          {DATA_HORA(e.incorporadaEm)} · {e.incorporadaPor?.name ?? e.incorporadaPor?.email ?? "—"}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Acatada pela Comissão; ainda não marcada na lei.</span>
                    )}
                  </span>,
                  valor(e),
                  decide ? (
                    <div key="m" data-guia="tramitacao.incorporar">
                      <MarcarIncorporada emendaId={e.id} incorporada={!!e.incorporadaEm} />
                    </div>
                  ) : null,
                ],
              }))}
            />
          )}
          <Paginacao base="/tramitacao" filtros={filtros} total={pagina.total} porPagina={POR_PAGINA} extra={{ aba }} />
        </Cartao>
      )}
    </Pagina>
  );
}

// Relatório por situação, por autor e por período, a partir do histórico.
async function relatorios(ano: number | null, f: Filtros) {
  if (!ano) return <p className="text-sm text-muted-foreground">Nenhum exercício.</p>;
  const { de, ate, inicio, fim } = periodoDoRelatorio(f);
  const r = await dadosRelatorioTramitacao(ano, inicio, fim);
  const exportar = (formato: string) => `/api/relatorios/tramitacao?ano=${ano}&de=${de}&ate=${ate}&formato=${formato}`;
  return (
    <Cartao
      guia="tramitacao.relatorios"
      titulo={`Movimentação de ${DATA(inicio)} a ${DATA(fim)}`}
      acoes={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="ghost" size="sm" asChild>
            <a href={exportar("xlsx")}>
              <Download /> XLSX
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={exportar("csv")}>
              <Download /> CSV
            </a>
          </Button>
          {/* Imprimir abre a versão para impressão: só o relatório, sem o menu. */}
          <Button variant="ghost" size="sm" asChild>
            <a href={`/tramitacao/relatorio?de=${de}&ate=${ate}`} target="_blank" rel="noopener">
              <Printer /> Imprimir
            </a>
          </Button>
        </div>
      }
    >
      <FormFiltros guia="tramitacao.periodo" acao="/tramitacao" rotulo="Período do relatório" className="mb-4 flex flex-wrap items-end gap-2.5 print:hidden">
        <input type="hidden" name="aba" value="relatorios" />
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          De
          <input type="date" name="de" defaultValue={de} className="campo h-10 px-2.5 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Até
          <input type="date" name="ate" defaultValue={ate} className="campo h-10 px-2.5 text-sm" />
        </label>
      </FormFiltros>
      <h3 className="mb-2 text-sm font-bold">Por situação</h3>
      <TabelaDados
        vazio="Nenhuma movimentação no período."
        colunas={[{ titulo: "Situação" }, { titulo: "Emendas", className: "text-right" }, { titulo: "Valor", className: "text-right" }]}
        linhas={[
          ...r.porSituacao.map((s) => ({
            chave: s.situacao,
            celulas: [
              STATUS_EMENDA[s.situacao]?.rotulo ?? s.situacao,
              <span key="q" className="tnum">
                {s.qtd}
              </span>,
              <span key="v" className="tnum">
                {BRL(s.valor)}
              </span>,
            ],
          })),
          ...(r.porSituacao.length
            ? [
                {
                  chave: "total",
                  celulas: [
                    <b key="t">Emendas movimentadas</b>,
                    <b key="q" className="tnum">
                      {r.total.qtd}
                    </b>,
                    <b key="v" className="tnum">
                      {BRL(r.total.valor)}
                    </b>,
                  ],
                },
              ]
            : []),
        ]}
      />
      <h3 className="mt-6 mb-2 text-sm font-bold">Por autor</h3>
      <TabelaDados
        vazio="Nenhuma movimentação no período."
        colunas={[{ titulo: "Autor" }, { titulo: "Remetidas", className: "text-right" }, { titulo: "Aprovadas", className: "text-right" }, { titulo: "Rejeitadas", className: "text-right" }]}
        linhas={r.porAutor.map((a) => ({
          chave: a.autor,
          celulas: [
            a.autor,
            <span key="r" className="tnum">
              {a.remetidas} · {BRL(a.valorRemetido)}
            </span>,
            <span key="a" className="tnum">
              {a.aprovadas} · {BRL(a.valorAprovado)}
            </span>,
            <span key="j" className="tnum">
              {a.rejeitadas} · {BRL(a.valorRejeitado)}
            </span>,
          ],
        }))}
      />
      <h3 className="mt-6 mb-2 text-sm font-bold">Movimentações</h3>
      <TabelaDados
        vazio="Nenhuma movimentação no período."
        colunas={[{ titulo: "Quando" }, { titulo: "Emenda" }, { titulo: "Situação" }, { titulo: "Valor", className: "text-right" }]}
        linhas={r.linhas.map((l) => ({
          chave: `${l.emenda.id}-${l.situacao}`,
          celulas: [
            <span key="q" className="text-xs whitespace-nowrap">
              {DATA_HORA(l.quando)}
            </span>,
            <span key="e">
              {l.emenda.numero ? `nº ${l.emenda.numero} · ` : ""}
              {l.emenda.objeto} <span className="text-xs text-muted-foreground">({l.emenda.autor})</span>
            </span>,
            STATUS_EMENDA[l.situacao]?.rotulo ?? l.situacao,
            <span key="v" className="tnum">
              {BRL(l.emenda.valor)}
            </span>,
          ],
        }))}
      />
    </Cartao>
  );
}

// Consolidado por programa das emendas remetidas (com os filtros da tela).
async function programas(ano: number | null, f: Filtros, areaId: string | null, autores: { id: string; nome: string }[], areas: { id: string; nome: string }[]) {
  const emendas = ano ? await listarEmendas(ano, ondeDosFiltros(f, await orgaosDaArea(areaId))) : [];
  const porPrograma = new Map<string, { programa: string; qtd: number; total: number; aprovadas: number }>();
  for (const e of emendas) {
    const chave = e.dotacao ? `${e.dotacao.programa.codigo} — ${e.dotacao.programa.nome}` : "A definir pela análise técnica";
    const p = porPrograma.get(chave) ?? { programa: chave, qtd: 0, total: 0, aprovadas: 0 };
    p.qtd++;
    p.total += e.valor.toNumber();
    if (e.status === "APROVADA") p.aprovadas += e.valor.toNumber();
    porPrograma.set(chave, p);
  }
  return (
    <Cartao guia="tramitacao.programas" titulo="Por programa">
      <FiltrosEmendas acao="/tramitacao" filtros={f} autores={autores} areas={areas} situacoes={[...ABAS.find((a) => a.id === "programas")!.situacoes]} ocultos={{ aba: "programas" }} />
      <TabelaDados
        vazio="Sem emendas remetidas."
        colunas={[{ titulo: "Programa" }, { titulo: "Emendas", className: "text-right" }, { titulo: "Total", className: "text-right" }, { titulo: "Aprovado", className: "text-right" }]}
        linhas={[...porPrograma.values()]
          .sort((a, b) => b.total - a.total)
          .map((p) => ({
            chave: p.programa,
            celulas: [
              p.programa,
              <span key="q" className="tnum">
                {p.qtd}
              </span>,
              <span key="t" className="whitespace-nowrap tnum">
                {BRL(p.total)}
              </span>,
              <span key="a" className="font-bold whitespace-nowrap tnum">
                {BRL(p.aprovadas)}
              </span>,
            ],
          }))}
      />
    </Cartao>
  );
}
