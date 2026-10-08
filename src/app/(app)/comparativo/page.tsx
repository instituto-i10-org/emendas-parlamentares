import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { BotaoImprimir } from "@/components/app/botao-imprimir";
import { FormFiltros } from "@/components/app/form-filtros";
import { Cartao, Kpi, Pagina, TabelaDados } from "@/components/app/pagina";
import { GerarLei } from "@/components/comparativo/gerar-lei";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { podeGerirPlanejamento } from "@/lib/authz";
import { somasExecucao } from "@/lib/emendas/execucao";
import { getAnoAtivo } from "@/lib/exercicio";
import { dadosComparativo } from "@/lib/orcamento/comparativo-servidor";
import { prisma } from "@/lib/prisma";
import { BRL } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projeto × lei — Emendas360" };

const POR_PAGINA = 50;

// Comparativo entre o projeto de lei e a lei aprovada, por dotação, com as
// emendas incorporadas; e a execução das dotações emendadas.
export default async function ComparativoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const ano = await getAnoAtivo();
  const aba = sp.aba === "execucao" ? "execucao" : "comparativo";
  const dados = ano ? await dadosComparativo(ano) : null;
  if (!ano || !dados) {
    return (
      <Pagina titulo="Projeto × lei">
        <Cartao>
          <p className="text-sm text-muted-foreground">Nenhum exercício configurado.</p>
        </Cartao>
      </Pagina>
    );
  }
  const orgao = sp.orgao ?? "";
  const uo = sp.uo ?? "";
  const soEmendadas = sp.emendadas === "1";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const filtradas = dados.linhas.filter((l) => {
    const d = (l.pl ?? l.lei)!;
    return (!orgao || d.orgao === orgao) && (!uo || d.uo === uo) && (!soEmendadas || l.emendas.length || (dados.temLei && l.diferenca !== 0));
  });
  const orgaos = [...new Set(dados.linhas.map((l) => (l.pl ?? l.lei)!.orgao))].sort();
  const unidades = [...new Set(dados.linhas.filter((l) => !orgao || (l.pl ?? l.lei)!.orgao === orgao).map((l) => (l.pl ?? l.lei)!.uo))].sort();
  const total = (f: (l: (typeof filtradas)[number]) => number) => filtradas.reduce((s, l) => s + f(l), 0);
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(orgao ? { orgao } : {}), ...(uo ? { uo } : {}), ...(soEmendadas ? { emendadas: "1" } : {}), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
    return `/comparativo?${p}`;
  };
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));

  return (
    <Pagina
      titulo="Projeto × lei"
      guia="comparativo"
      descricao="Cada dotação no projeto de lei e na lei aprovada, a diferença e as emendas incorporadas que a explicam. A emenda impositiva soma na dotação de destino: a lei fica maior que o projeto pelo valor das emendas incorporadas."
      acoes={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="ghost" asChild>
            <a href={`/api/relatorios/comparativo?ano=${ano}&orgao=${orgao}&uo=${uo}&formato=xlsx`}>
              <Download /> XLSX
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a href={`/api/relatorios/comparativo?ano=${ano}&orgao=${orgao}&uo=${uo}&formato=csv`}>
              <Download /> CSV
            </a>
          </Button>
          <BotaoImprimir variante="ghost" />
          {!dados.temLei && podeGerirPlanejamento(user) ? <GerarLei ano={ano} /> : null}
        </div>
      }
    >
      <nav data-guia="comparativo.visoes" aria-label="Visões" className="mb-4 flex flex-wrap gap-1 rounded-box bg-surface p-1.5 shadow-[0_1px_2px_rgba(10,36,99,.06)] print:hidden">
        {[
          ["comparativo", "Comparativo por dotação"],
          ["execucao", "Execução das dotações emendadas"],
        ].map(([id, t]) => (
          <Link key={id} href={`/comparativo?aba=${id}`} aria-current={id === aba ? "page" : undefined} className={cn("rounded-md px-3.5 py-2 text-sm font-semibold", id === aba ? "bg-navy text-white" : "text-muted-foreground hover:bg-soft")}>
            {t}
          </Link>
        ))}
      </nav>

      {aba === "execucao" ? (
        await execucao(ano)
      ) : (
        <>
          {!dados.temLei ? (
            <p className="mb-4 rounded-box bg-warn-bg px-4 py-3 text-sm text-warn">
              A lei aprovada ainda não tem base carregada. Importe-a em Planejamento ou gere a base a partir do projeto e das emendas incorporadas.
            </p>
          ) : null}
          <div data-guia="comparativo.totais" className="mb-5 grid grid-cols-3 gap-3.5 max-lg:grid-cols-1">
            <Kpi rotulo="Projeto de lei" valor={BRL(total((l) => l.valorPl))} detalhe={dados.projeto?.numero ?? "—"} />
            <Kpi rotulo="Lei aprovada" valor={BRL(total((l) => l.valorLei))} detalhe={dados.lei?.numero ?? "não carregada"} tom="navy" />
            <Kpi rotulo="Diferença" valor={dados.temLei ? BRL(total((l) => l.diferenca)) : "—"} detalhe={!dados.temLei ? "sem lei carregada para comparar" : `${dados.emendas.length} emenda(s) incorporada(s) somam ${BRL(dados.emendas.reduce((x, e) => x + e.valor, 0))}`} />
          </div>
          <Cartao guia="comparativo.dotacoes" titulo={`Dotações (${filtradas.length})`}>
            <FormFiltros guia="comparativo.filtros" acao="/comparativo" rotulo="Filtrar dotações" className="mb-4 flex flex-wrap items-end gap-2.5 print:hidden">
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Órgão
                <select name="orgao" defaultValue={orgao} className="campo h-10 px-2.5 text-sm">
                  <option value="">Todos</option>
                  {orgaos.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Unidade
                <select name="uo" defaultValue={uo} className="campo h-10 px-2.5 text-sm">
                  <option value="">Todas</option>
                  {unidades.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="emendadas" value="1" defaultChecked={soEmendadas} /> Só as que mudaram ou têm emenda
              </label>
              <Button variant="ghost" asChild className="h-10">
                <Link href="/comparativo">Limpar</Link>
              </Button>
            </FormFiltros>
            <TabelaDados
              vazio="Nenhuma dotação."
              colunas={[
                { titulo: "Dotação" },
                { titulo: "Projeto", className: "text-right" },
                { titulo: "Lei", className: "text-right" },
                { titulo: "Diferença", className: "text-right" },
                { titulo: "Emendas incorporadas", className: "@max-[700px]:hidden" },
              ]}
              linhas={filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map((l) => {
                const d = (l.pl ?? l.lei)!;
                return {
                  chave: l.chave,
                  celulas: [
                    <div key="d" className="min-w-0">
                      <b className="break-words">
                        {d.codigo} — {d.nome}
                      </b>
                      <span className="block text-xs text-muted-foreground">
                        {d.uo} · {d.natureza} · fonte {d.fonte}
                        {d.ficha ? ` · ficha ${d.ficha}` : ""}
                      </span>
                      {l.marca ? <Selo tipo={l.marca === "NOVA" ? "info" : "warn"}>{l.marca === "NOVA" ? "Só na lei" : "Só no projeto"}</Selo> : null}
                    </div>,
                    <span key="p" className="whitespace-nowrap tnum">{l.pl ? BRL(l.valorPl) : "—"}</span>,
                    <span key="l" className="whitespace-nowrap tnum">{l.lei ? BRL(l.valorLei) : "—"}</span>,
                    <b key="x" className="whitespace-nowrap tnum">{dados.temLei ? BRL(l.diferenca) : "—"}</b>,
                    <ul key="e" className="text-xs">
                      {l.emendas.map((e) => (
                        <li key={`${e.id}${e.efeito}`}>
                          <Link href={`/emendas/${e.id}`} className="font-semibold hover:underline">
                            nº {e.numero ?? "—"}
                          </Link>{" "}
                          {e.efeito > 0 ? "+" : ""}
                          {BRL(e.efeito)}
                        </li>
                      ))}
                    </ul>,
                  ],
                };
              })}
            />
            {paginas > 1 ? (
              <nav aria-label="Paginação" className="mt-4 flex items-center gap-2 text-sm print:hidden">
                <span className="text-xs text-muted-foreground">
                  página {pagina} de {paginas}
                </span>
                <span className="ml-auto flex gap-1.5">
                  {pagina > 1 ? <Link className="rounded-md bg-soft px-3 py-1.5 font-semibold" href={qs({ pagina: pagina - 1 })}>Anterior</Link> : null}
                  {pagina < paginas ? <Link className="rounded-md bg-soft px-3 py-1.5 font-semibold" href={qs({ pagina: pagina + 1 })}>Próxima</Link> : null}
                </span>
              </nav>
            ) : null}
          </Cartao>
        </>
      )}
    </Pagina>
  );
}

// Execução das dotações que receberam emendas aprovadas: emendas, empenhado,
// liquidado e pago.
async function execucao(ano: number) {
  const emendas = await prisma.emenda.findMany({
    where: { exercicio: { ano }, status: "APROVADA", dotacaoId: { not: null } },
    include: { dotacao: { include: { acao: true, unidadeOrcamentaria: true, naturezaDespesa: true } }, andamentos: true },
    orderBy: { numero: "asc" },
  });
  const porDot = new Map<string, { nome: string; detalhe: string; emendas: { id: string; numero: number | null; valor: number }[]; valor: number; empenhado: number; liquidado: number; pago: number }>();
  for (const e of emendas) {
    const d = e.dotacao!;
    const s = somasExecucao(e.andamentos.map((a) => ({ etapa: a.etapa, valor: a.valor.toNumber() })));
    const x = porDot.get(d.id) ?? { nome: `${d.codigo} — ${d.acao.nome}`, detalhe: `${d.unidadeOrcamentaria.codigo} · ${d.naturezaDespesa.codigo}${d.ficha ? ` · ficha ${d.ficha}` : ""}`, emendas: [], valor: 0, empenhado: 0, liquidado: 0, pago: 0 };
    x.emendas.push({ id: e.id, numero: e.numero, valor: e.valor.toNumber() });
    x.valor += e.valor.toNumber();
    x.empenhado += s.empenhado;
    x.liquidado += s.liquidado;
    x.pago += s.pago;
    porDot.set(d.id, x);
  }
  const linhas = [...porDot.entries()];
  return (
    <Cartao guia="comparativo.execucao" titulo={`Dotações emendadas (${linhas.length})`} ajuda="Soma, por dotação, das emendas aprovadas e da execução lançada pelo Executivo em cada uma.">
      <TabelaDados
        vazio="Nenhuma emenda aprovada com dotação definida."
        colunas={[
          { titulo: "Dotação" },
          { titulo: "Emendas", className: "@max-[700px]:hidden" },
          { titulo: "Aprovado", className: "text-right" },
          { titulo: "Empenhado", className: "text-right" },
          { titulo: "Liquidado", className: "text-right @max-[560px]:hidden" },
          { titulo: "Pago", className: "text-right" },
        ]}
        linhas={linhas.map(([id, x]) => ({
          chave: id,
          celulas: [
            <div key="d">
              <b>{x.nome}</b>
              <span className="block text-xs text-muted-foreground">{x.detalhe}</span>
            </div>,
            <span key="e" className="text-xs">
              {x.emendas.map((e, i) => (
                <span key={e.id}>
                  {i ? ", " : ""}
                  <Link href={`/emendas/${e.id}`} className="font-semibold hover:underline">
                    nº {e.numero ?? "—"}
                  </Link>
                </span>
              ))}
            </span>,
            <span key="v" className="whitespace-nowrap tnum">{BRL(x.valor)}</span>,
            <span key="m" className="whitespace-nowrap tnum">{BRL(x.empenhado)}</span>,
            <span key="l" className="whitespace-nowrap tnum">{BRL(x.liquidado)}</span>,
            <b key="p" className="whitespace-nowrap tnum">{BRL(x.pago)}</b>,
          ],
        }))}
      />
    </Cartao>
  );
}
