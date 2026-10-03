import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApagarEmendaTeste } from "@/components/emenda/apagar-emenda-teste";
import { Pagina } from "@/components/emenda/avisos-pagina";
import { EditorEmenda } from "@/components/emenda/editor";
import { LinhaChecagem } from "@/components/emenda/etapa3";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { podeGerirEmenda, podeVerTodasEmendas, temPermissao } from "@/lib/authz";
import { buscarEmenda, paraEstado } from "@/lib/emendas/carregar";
import { aplicadoDoAutor, carregarContexto } from "@/lib/emendas/contexto";
import { somasExecucao } from "@/lib/emendas/execucao";
import { ETAPA_EXECUCAO, RESULTADO_VIABILIDADE, STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { BRL, MODELOS, type Checagem } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Emenda — Emendas360" };

export default async function EmendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const x = await buscarEmenda(id);
  if (!x) notFound();
  const gere = podeGerirEmenda(user, { autorUsuarioId: x.autor.usuarioId });
  const ve = gere || podeVerTodasEmendas(user) || temPermissao(user, "analisarViabilidade", "registrarExecucao") || x.autor.usuarioId === user.id;
  if (!ve) notFound();

  if ((x.status === "RASCUNHO" || x.status === "EM_DILIGENCIA") && gere) {
    const ctx = await carregarContexto(x.exercicio.ano);
    if (!ctx) notFound();
    const aplicado = await aplicadoDoAutor(ctx.exercicioId, x.autorId, ctx.config.percentualSaude, x.id);
    const diligencia =
      x.status === "EM_DILIGENCIA"
        ? { numero: x.numero, motivo: x.diligenciaMotivo ?? "", ate: x.diligenciaAte?.toLocaleDateString("pt-BR") ?? null }
        : null;
    return <EditorEmenda ctx={ctx} inicial={paraEstado(x)} aplicado={aplicado} autor={x.autor.nome} diligencia={diligencia} />;
  }

  const checks = (x.validacoes[0]?.itens ?? []) as Checagem[];
  const exec = somasExecucao(x.andamentos.map((a) => ({ etapa: a.etapa, valor: a.valor.toNumber() })));
  const d = x.dotacao;
  return (
    <Pagina
      titulo={x.numero ? `Emenda nº ${x.numero}/${x.exercicio.ano}` : "Emenda"}
      acoes={
        <div className="flex flex-wrap gap-2">
          {gere && x.autor.demonstracao ? (
            <ApagarEmendaTeste id={x.id} rotulo={x.numero ? `Emenda nº ${x.numero}/${x.exercicio.ano}` : "Esta emenda"} comoBotao />
          ) : null}
          <Button variant="ghost" asChild>
            <Link href="/emendas">Voltar</Link>
          </Button>
          <Button asChild>
            <a href={`/emendas/${x.id}/plano`} target="_blank" rel="noopener">
              Plano de trabalho
            </a>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5 max-[1080px]:grid-cols-1">
        <section className="rounded-card bg-surface p-7 shadow-card max-md:px-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Selo tipo={STATUS_EMENDA[x.status].tipo}>{STATUS_EMENDA[x.status].rotulo}</Selo>
            {x.modelo ? <Selo>Modelo {MODELOS[x.modelo].numero} — {MODELOS[x.modelo].titulo}</Selo> : null}
            {x.submetidaEm ? <span className="text-xs text-muted-foreground">submetida em {x.submetidaEm.toLocaleString("pt-BR")}</span> : null}
          </div>
          <h2 className="text-lg font-bold">{x.objeto}</h2>
          <dl className="mt-4 grid grid-cols-[minmax(150px,auto)_1fr] gap-x-4 gap-y-2 text-sm max-sm:grid-cols-1">
            <dt className="text-muted-foreground">Autor</dt>
            <dd>{x.autor.nome}</dd>
            <dt className="text-muted-foreground">Destino</dt>
            <dd>{x.destino?.nome ?? "—"}</dd>
            <dt className="text-muted-foreground">Endereço</dt>
            <dd>{x.endereco || "—"}</dd>
            <dt className="text-muted-foreground">Execução</dt>
            <dd>{x.execucao === "DIRETA" ? "Direta (Poder Executivo)" : "Indireta (OSC/Terceiro Setor)"}</dd>
            <dt className="text-muted-foreground">Dotação</dt>
            <dd>
              {d
                ? `${d.codigo} — ${d.acao.nome} · ${d.unidadeOrcamentaria.codigo} · ${d.naturezaDespesa.codigo}`
                : x.escolhaDotacao === "ANALISE_TECNICA"
                  ? "a definir pela análise técnica"
                  : "—"}
            </dd>
            <dt className="text-muted-foreground">Parcela da cota</dt>
            <dd>{x.parcela === "SAUDE" ? "Saúde (IC-CO 1002)" : x.parcela === "DEMAIS" ? "Demais áreas" : "—"}</dd>
            <dt className="text-muted-foreground">Valor</dt>
            <dd className="font-bold">{BRL(x.valor.toNumber())}</dd>
            <dt className="text-muted-foreground">Justificativa</dt>
            <dd className="whitespace-pre-line">{x.justificativa || "—"}</dd>
            <dt className="text-muted-foreground">Meta finalística</dt>
            <dd>{x.metaFinalistica || "—"}</dd>
          </dl>

          {x.status === "EM_DILIGENCIA" ? (
            <div className="mt-6 rounded-box bg-warn-bg p-4 text-sm">
              <div className="antena mb-1">Diligência da Comissão</div>
              <p className="text-xs text-muted-foreground">
                Pedida em {x.diligenciaEm?.toLocaleDateString("pt-BR") ?? "—"} · prazo {x.diligenciaAte?.toLocaleDateString("pt-BR") ?? "—"}
              </p>
              <p className="mt-1 whitespace-pre-line">{x.diligenciaMotivo}</p>
            </div>
          ) : null}
          {x.parecerTramitacao ? (
            <div className="mt-6 rounded-box bg-soft p-4 text-sm">
              <div className="antena mb-1">Parecer da Comissão</div>
              <p className="text-xs text-muted-foreground">
                {x.status === "APROVADA" ? "Aprovada" : "Rejeitada"} em {x.tramitadaEm?.toLocaleDateString("pt-BR")} por{" "}
                {x.tramitadaPor?.name ?? x.tramitadaPor?.email ?? "—"}
              </p>
              <p className="mt-1 whitespace-pre-line">{x.parecerTramitacao}</p>
            </div>
          ) : null}

          {x.pareceres.length ? (
            <div className="mt-4 rounded-box bg-soft p-4 text-sm">
              <div className="antena mb-2">Viabilidade técnica (Executivo)</div>
              <ul className="grid gap-3">
                {x.pareceres.map((p, i) => (
                  <li key={p.id} className={i ? "opacity-70" : ""}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Selo tipo={RESULTADO_VIABILIDADE[p.resultado].tipo}>{RESULTADO_VIABILIDADE[p.resultado].rotulo}</Selo>
                      <span className="text-xs text-muted-foreground">
                        {p.usuario?.name ?? p.usuario?.email ?? "—"} · {p.criadoEm.toLocaleString("pt-BR")}
                        {i ? " · anterior" : " · vigente"}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line">{p.justificativa}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {x.andamentos.length ? (
            <div className="mt-4 rounded-box bg-soft p-4 text-sm">
              <div className="antena mb-2">Execução orçamentária</div>
              <p className="mb-2 text-xs">
                Empenhado <b>{BRL(exec.empenhado)}</b> · liquidado <b>{BRL(exec.liquidado)}</b> · pago <b>{BRL(exec.pago)}</b>
              </p>
              <ul className="divide-y divide-hair text-xs">
                {x.andamentos.map((a) => (
                  <li key={a.id} className="flex flex-wrap gap-2 py-1.5">
                    <b>{ETAPA_EXECUCAO[a.etapa]}</b>
                    <span className="tnum">{BRL(a.valor.toNumber())}</span>
                    <span className="text-muted-foreground">{a.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                    {a.numeroDocumento ? <span className="text-muted-foreground">doc. {a.numeroDocumento}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        <aside className="rounded-card bg-surface p-[22px] shadow-card">
          <div className="mb-2 text-md font-bold">Validação na submissão</div>
          {checks.length ? (
            <div className="divide-y divide-hair">
              {checks
                .filter((c) => c.nivel !== "ok")
                .map((c, i) => (
                  <LinhaChecagem key={i} c={c} />
                ))}
              <p className="pt-3 text-xs text-muted-foreground">{checks.filter((c) => c.nivel === "ok").length} verificações concluídas sem pendência.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não submetida.</p>
          )}
        </aside>
      </div>
    </Pagina>
  );
}
