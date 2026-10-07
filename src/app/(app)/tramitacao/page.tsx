import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Cartao, Kpi, Pagina, TabelaDados } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { DecidirEmenda, PedirAjuste, ReabrirEmenda } from "@/components/tramitacao/acoes";
import { Button } from "@/components/ui/button";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { podeTramitar } from "@/lib/authz";
import { listarEmendas } from "@/lib/emendas/consultas";
import { RESULTADO_VIABILIDADE, STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { getAnoAtivo } from "@/lib/exercicio";
import { BRL, DATA } from "@/lib/riep";
import { NAO_REMETIDAS } from "@/lib/emendas/situacoes";

export const metadata: Metadata = { title: "Tramitação — Emendas360" };

// Tramitação na Câmara: o que está na fila da Comissão, o que já foi decidido
// e o consolidado por programa.
export default async function TramitacaoPage() {
  const user = await requireAccess({ poder: Poder.LEGISLATIVO, permissoes: ["tramitarEmendas", "consultarTudo"] });
  const ano = await getAnoAtivo();
  const emendas = ano ? await listarEmendas(ano, { status: { notIn: NAO_REMETIDAS } }) : [];
  const decide = podeTramitar(user);
  const fila = emendas.filter((e) => e.status === "SUBMETIDA");
  const emDiligencia = emendas.filter((e) => e.status === "EM_DILIGENCIA");
  const hoje = new Date();
  const decididas = emendas.filter((e) => e.status === "APROVADA" || e.status === "REJEITADA");
  const soma = (l: typeof emendas) => l.reduce((s, e) => s + e.valor.toNumber(), 0);

  const porPrograma = new Map<string, { programa: string; qtd: number; total: number; aprovadas: number }>();
  for (const e of emendas) {
    const chave = e.dotacao ? `${e.dotacao.programa.codigo} — ${e.dotacao.programa.nome}` : "A definir pela análise técnica";
    const p = porPrograma.get(chave) ?? { programa: chave, qtd: 0, total: 0, aprovadas: 0 };
    p.qtd++;
    p.total += e.valor.toNumber();
    if (e.status === "APROVADA") p.aprovadas += e.valor.toNumber();
    porPrograma.set(chave, p);
  }

  const rotulo = (e: (typeof emendas)[number]) => (e.numero ? `Emenda nº ${e.numero}/${ano}` : "Emenda");
  const parecerExecutivo = (e: (typeof emendas)[number]) => {
    const p = e.pareceres[0];
    return p ? <Selo tipo={RESULTADO_VIABILIDADE[p.resultado].tipo}>{RESULTADO_VIABILIDADE[p.resultado].rotulo}</Selo> : <span className="text-xs text-muted-foreground">sem parecer</span>;
  };

  return (
    <Pagina
      titulo="Tramitação"
      descricao="A Comissão decide sobre as emendas submetidas, com parecer escrito. O parecer de viabilidade do Executivo é informativo: não trava a decisão."
      acoes={
        <Button variant="ghost" asChild>
          <a href={`/api/export/emendas?ano=${ano ?? ""}&formato=xlsx`}>
            <Download /> Exportar planilha
          </a>
        </Button>
      }
    >
      <div className="mb-5 grid grid-cols-4 gap-3.5 max-lg:grid-cols-2">
        <Kpi rotulo="Aguardando decisão" valor={fila.length} detalhe={BRL(soma(fila))} tom={fila.length ? "warn" : undefined} />
        <Kpi rotulo="Aprovadas" valor={decididas.filter((e) => e.status === "APROVADA").length} detalhe={BRL(soma(decididas.filter((e) => e.status === "APROVADA")))} tom="ok" />
        <Kpi rotulo="Rejeitadas" valor={decididas.filter((e) => e.status === "REJEITADA").length} detalhe={BRL(soma(decididas.filter((e) => e.status === "REJEITADA")))} />
        <Kpi rotulo="Total submetido" valor={emendas.length} detalhe={BRL(soma(emendas))} tom="navy" />
      </div>

      <div className="grid gap-5">
        <Cartao titulo={`Fila da Comissão (${fila.length})`}>
          <TabelaDados
            vazio="Nenhuma emenda aguardando decisão."
            colunas={[{ titulo: "Nº" }, { titulo: "Emenda" }, { titulo: "Autor", className: "max-md:hidden" }, { titulo: "Viabilidade" }, { titulo: "Valor", className: "text-right" }, { titulo: "" }]}
            linhas={fila.map((e) => ({
              chave: e.id,
              celulas: [
                <b key="n" className="tnum">{e.numero ?? "—"}</b>,
                <div key="o">
                  <Link href={`/emendas/${e.id}`} className="font-bold hover:underline">
                    {e.objeto}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {e.destino?.nome ?? "—"} · {e.dotacao ? e.dotacao.codigo : "dotação a definir pela análise técnica"}
                    {e.reenviadaEm ? ` · reenviada após diligência em ${DATA(e.reenviadaEm)}` : ""}
                  </span>
                </div>,
                <span key="a" className="max-md:hidden">{e.autor.nome}</span>,
                parecerExecutivo(e),
                <span key="v" className="font-bold whitespace-nowrap tnum">{BRL(e.valor.toNumber())}</span>,
                decide ? (
                  <div key="d" className="flex flex-wrap justify-end gap-1.5">
                    <PedirAjuste emendaId={e.id} rotulo={rotulo(e)} />
                    <DecidirEmenda emendaId={e.id} rotulo={rotulo(e)} />
                  </div>
                ) : null,
              ],
            }))}
          />
        </Cartao>

        {emDiligencia.length ? (
          <Cartao titulo={`Em diligência (${emDiligencia.length})`}>
            <TabelaDados
              vazio=""
              colunas={[{ titulo: "Nº" }, { titulo: "Emenda" }, { titulo: "Pedido da Comissão", className: "max-lg:hidden" }, { titulo: "Prazo" }, { titulo: "Valor", className: "text-right" }, { titulo: "" }]}
              linhas={emDiligencia.map((e) => ({
                chave: e.id,
                celulas: [
                  <b key="n" className="tnum">{e.numero ?? "—"}</b>,
                  <div key="o">
                    <Link href={`/emendas/${e.id}`} className="font-bold hover:underline">
                      {e.objeto}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{e.autor.nome}</span>
                  </div>,
                  <p key="p" className="line-clamp-2 max-w-md text-xs text-muted-foreground max-lg:hidden">{e.diligenciaMotivo}</p>,
                  <div key="z">
                    <span className="block text-xs">{DATA(e.diligenciaAte)}</span>
                    {e.diligenciaAte && e.diligenciaAte < hoje ? <Selo tipo="bad">prazo vencido</Selo> : <Selo tipo="warn">aguardando o autor</Selo>}
                  </div>,
                  <span key="v" className="font-bold whitespace-nowrap tnum">{BRL(e.valor.toNumber())}</span>,
                  decide && e.diligenciaAte && e.diligenciaAte < hoje ? <DecidirEmenda key="d" emendaId={e.id} rotulo={rotulo(e)} /> : null,
                ],
              }))}
            />
          </Cartao>
        ) : null}

        <Cartao titulo={`Decididas (${decididas.length})`}>
          <TabelaDados
            vazio="Nenhuma emenda decidida ainda."
            colunas={[{ titulo: "Nº" }, { titulo: "Emenda" }, { titulo: "Decisão" }, { titulo: "Parecer", className: "max-lg:hidden" }, { titulo: "Valor", className: "text-right" }, { titulo: "" }]}
            linhas={decididas.map((e) => ({
              chave: e.id,
              celulas: [
                <b key="n" className="tnum">{e.numero ?? "—"}</b>,
                <div key="o">
                  <Link href={`/emendas/${e.id}`} className="font-bold hover:underline">
                    {e.objeto}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{e.autor.nome}</span>
                </div>,
                <div key="s">
                  <Selo tipo={STATUS_EMENDA[e.status].tipo}>{STATUS_EMENDA[e.status].rotulo}</Selo>
                  <span className="mt-1 block text-xs text-muted-foreground">{DATA(e.tramitadaEm)}</span>
                </div>,
                <p key="p" className="line-clamp-2 max-w-md text-xs text-muted-foreground max-lg:hidden">{e.parecerTramitacao}</p>,
                <span key="v" className="font-bold whitespace-nowrap tnum">{BRL(e.valor.toNumber())}</span>,
                decide && !e.andamentos.length ? <ReabrirEmenda key="r" emendaId={e.id} /> : null,
              ],
            }))}
          />
        </Cartao>

        <Cartao titulo="Por programa">
          <TabelaDados
            vazio="Sem emendas submetidas."
            colunas={[{ titulo: "Programa" }, { titulo: "Emendas", className: "text-right" }, { titulo: "Total", className: "text-right" }, { titulo: "Aprovado", className: "text-right" }]}
            linhas={[...porPrograma.values()]
              .sort((a, b) => b.total - a.total)
              .map((p) => ({
                chave: p.programa,
                celulas: [
                  p.programa,
                  <span key="q" className="tnum">{p.qtd}</span>,
                  <span key="t" className="whitespace-nowrap tnum">{BRL(p.total)}</span>,
                  <span key="a" className="font-bold whitespace-nowrap tnum">{BRL(p.aprovadas)}</span>,
                ],
              }))}
          />
        </Cartao>
      </div>
    </Pagina>
  );
}
