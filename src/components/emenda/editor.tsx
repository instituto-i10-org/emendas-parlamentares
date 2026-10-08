"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { excluirRascunho, salvarEmenda } from "@/lib/actions/emendas";
import type { ContextoEmenda, DestinoTela } from "@/lib/emendas/contexto";
import { chaveClassificacao, lerNumero, paraValidacao, type EstadoEmenda } from "@/lib/emendas/estado";
import { contextoVerificacao, verificarEmenda } from "@/lib/emendas/verificacao";
import {
  MODELOS,
  classificacaoValida,
  classificar,
  dotacaoDe,
  eventoEfetivo,
  modeloDaDotacao,
  podeAvancar,
  resumoValidacao,
  validar,
  type Aplicado,
  type Checagem,
  type Verificacao,
} from "@/lib/riep";
import { cn } from "@/lib/utils";
import { Etapa1 } from "./etapa1";
import { Aviso } from "./ui";
import { Etapa2 } from "./etapa2";
import { Etapa3 } from "./etapa3";
import { Resumo } from "./resumo";

export type Atualizar = (parcial: Partial<EstadoEmenda> | ((e: EstadoEmenda) => Partial<EstadoEmenda>)) => void;

const ETAPAS = ["Descrever a emenda", "Plano de trabalho", "Validar e submeter"] as const;

export type DerivadoEmenda = ReturnType<typeof useDerivado>;

// O que se deduz do estado: destino, classificação, dotação, modelo, meta,
// validação. Recalculado a cada mudança — o motor é rápido e puro.
function useDerivado(e: EstadoEmenda, ctx: ContextoEmenda, destinos: DestinoTela[], aplicado: Aplicado, reenvio: boolean) {
  const destino = useMemo(() => destinos.find((d) => d.id === e.destinoId) ?? null, [destinos, e.destinoId]);
  const chave = chaveClassificacao(e);
  const valida = !!e.classificadoCom && e.classificadoCom === chave;
  const obsoleta = !!e.classificadoCom && !valida;
  const classificacao = useMemo(
    () =>
      valida && destino
        ? classificar({
            objeto: e.objeto,
            destino,
            execucao: e.execucao,
            pretendido: lerNumero(e.pretendido),
            loa: ctx.loa,
            catalogo: ctx.catalogo,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valida, destino, chave, ctx, e.pretendido]
  );
  const dotacao = dotacaoDe(classificacao, e.selecao);
  const modelo = modeloDaDotacao(dotacao);
  const metaPlanejamento = dotacao ? ctx.metas[dotacao.id] ?? null : null;
  const valor = e.itens.reduce((s, i) => s + lerNumero(i.quantidade) * lerNumero(i.valorUnitario), 0);
  const checks: Checagem[] = useMemo(
    () =>
      validar(paraValidacao(e, { classificacao, metaPlanejamento }), {
        config: ctx.config,
        aplicado,
        biblioteca: ctx.catalogo.objetos,
      }),
    [e, classificacao, metaPlanejamento, ctx, aplicado]
  );
  // As treze verificações, sobre as mesmas conferências.
  const ctxVerificacao = useMemo(() => contextoVerificacao(ctx, aplicado, reenvio), [ctx, aplicado, reenvio]);
  const treze = useMemo(
    () => verificarEmenda(e, valor, dotacao, ctxVerificacao, checks),
    [e, valor, dotacao, ctxVerificacao, checks]
  );
  const resumo = resumoValidacao(checks);
  const falhas = treze.verificacoes.filter((v) => v.estado === "falha").length;
  return {
    destino,
    classificacao,
    obsoleta,
    dotacao,
    modelo,
    metaPlanejamento,
    valor,
    checks,
    verificacoes: treze.verificacoes,
    // Falha numa das treze também conta como bloqueio da remessa.
    resumo: { ...resumo, bloqueios: resumo.bloqueios + falhas, pode: resumo.pode && falhas === 0 },
    avanca: podeAvancar(classificacao, e.selecao),
    valida: classificacaoValida(classificacao),
  };
}

export function EditorEmenda({
  ctx,
  inicial,
  aplicado,
  autor,
  diligencia = null,
  devolucao = null,
  etapaInicial = 1,
}: {
  ctx: ContextoEmenda;
  inicial: EstadoEmenda;
  aplicado: Aplicado;
  autor: string;
  // Emenda devolvida pela Comissão para sanear: o pedido, o prazo e o número.
  diligencia?: { numero: number | null; motivo: string; ate: string | null } | null;
  // Devolvida ao autor pela análise técnica (saneamento), com o apontamento.
  devolucao?: { texto: string; quando: string } | null;
  // Etapa em que o editor abre (o salvamento leva a etapa no endereço).
  etapaInicial?: number;
}) {
  const router = useRouter();
  const [e, setE] = useState<EstadoEmenda>(inicial);
  const [etapa, setEtapa] = useState(etapaInicial);
  const [destinos, setDestinos] = useState(ctx.destinos);
  const [gravando, setGravando] = useState(false);
  const [duplicata, setDuplicata] = useState<{ numero: number | null; objeto: string; status: string } | null>(null);
  const [alterado, setAlterado] = useState(false);
  const executorAuto = useRef<string | null>(null);

  const atualizar: Atualizar = useCallback((parcial) => {
    setE((atual) => ({ ...atual, ...(typeof parcial === "function" ? parcial(atual) : parcial) }));
    setAlterado(true);
  }, []);

  const d = useDerivado(e, ctx, destinos, aplicado, !!diligencia);
  // Resultado da remessa recusada pelo servidor (as treze como ele as viu).
  const [recusa, setRecusa] = useState<{ verificacoes: Verificacao[]; erro: string } | null>(null);
  // Remessa liberada com o emendamento aberto; com o prazo vencido, só o
  // reenvio depois de diligência (a emenda já foi apresentada no prazo).
  const podeRemeter = ctx.emendamento.aberto || (!!diligencia && ctx.emendamento.motivo === "PRAZO_ENCERRADO");

  // Aviso ao sair com alterações não salvas.
  useEffect(() => {
    if (!alterado) return;
    const aviso = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  // Ao montar o plano: executor sugerido, etapas do modelo e evento de
  // comprovação — sem sobrescrever o que o proponente escreveu.
  const montarPlano = useCallback(() => {
    if (!d.classificacao || !d.dotacao) return;
    const sugerido =
      e.execucao === "INDIRETA" ? d.destino?.nome ?? "" : ctx.catalogo.unidades[d.dotacao.uo] ?? d.destino?.nome ?? "";
    const parcial: Partial<EstadoEmenda> = {};
    if (!e.agenteExecutor || e.agenteExecutor === executorAuto.current) {
      parcial.agenteExecutor = sugerido;
      executorAuto.current = sugerido;
    }
    if (!e.etapasEditadas && d.modelo) parcial.etapas = MODELOS[d.modelo].etapas;
    const ev = eventoEfetivo(d.dotacao, e.evento);
    if (ev !== e.evento) parcial.evento = ev;
    if (Object.keys(parcial).length) setE((atual) => ({ ...atual, ...parcial }));
  }, [d.classificacao, d.dotacao, d.destino, d.modelo, e.agenteExecutor, e.etapasEditadas, e.evento, e.execucao, ctx.catalogo.unidades]);

  function irPara(n: number) {
    if (n > 1) {
      if (!d.classificacao) {
        toast("Rode a análise no passo 1 primeiro.");
        return;
      }
      if (!d.avanca) {
        toast("Reescreva o objeto ou escolha a dotação antes de seguir.");
        return;
      }
      montarPlano();
    }
    setEtapa(n);
  }

  // Cada etapa começa do topo. O endereço guarda a etapa da emenda já salva,
  // para recarregar ou voltar nela.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (!e.id) return;
    const url = new URL(window.location.href);
    if (etapa > 1) url.searchParams.set("etapa", String(etapa));
    else url.searchParams.delete("etapa");
    window.history.replaceState(window.history.state, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa]);

  // Abriu numa etapa adiante sem classificação válida: volta ao passo 1.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (etapa > 1 && (!d.classificacao || !d.avanca)) setEtapa(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function gravar(submeter = false, confirmarDuplicata = false, opcoes: { gerarLink?: boolean } = {}) {
    if (gravando) return;
    if (submeter && !d.resumo.pode) {
      toast("Revise as pendências antes de submeter.");
      return;
    }
    setGravando(true);
    try {
      const r = await salvarEmenda(confirmarDuplicata ? { ...e, confirmarDuplicata: true } : e, submeter, ctx.config.exercicio);
      if (!r.ok) {
        if (r.duplicata) {
          setDuplicata(r.duplicata);
          return;
        }
        // Recusada na remessa: o servidor gravou a tentativa e devolveu as treze.
        if (r.id && r.revisao !== undefined) {
          const { id, revisao } = r;
          setE((atual) => ({ ...atual, id, revisao }));
          setAlterado(false);
          if (!e.id) router.replace(`/emendas/${id}`, { scroll: false });
        }
        if (r.verificacoes) setRecusa({ verificacoes: r.verificacoes, erro: r.erro });
        toast.error(r.erro);
        return;
      }
      setRecusa(null);
      setDuplicata(null);
      setE((atual) => ({ ...atual, id: r.id, revisao: r.revisao }));
      setAlterado(false);
      if (submeter) {
        toast(`Emenda submetida com o número ${r.numero}.`);
        router.push(`/emendas/${r.id}`);
        return;
      }
      toast("Rascunho salvo.");
      // Primeiro salvamento: o endereço passa a ser o da emenda, mantendo a
      // etapa em que a pessoa estava (e, se pedido, gerando o link da entidade).
      if (!e.id) {
        const q = new URLSearchParams();
        if (etapa > 1) q.set("etapa", String(etapa));
        if (opcoes.gerarLink) q.set("gerarLink", "1");
        router.replace(`/emendas/${r.id}${q.toString() ? `?${q}` : ""}`, { scroll: false });
      }
    } finally {
      setGravando(false);
    }
  }

  // Descartar: rascunho gravado é excluído; o que nunca foi salvo só é abandonado.
  const [confirmando, setConfirmando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  async function confirmarDescarte() {
    if (e.id) {
      setDescartando(true);
      const r = await excluirRascunho(e.id);
      setDescartando(false);
      if (!r.ok) return void toast.error(r.erro ?? "Não foi possível descartar.");
    }
    setAlterado(false);
    setConfirmando(false);
    toast("Rascunho descartado.");
    router.push("/emendas");
  }
  const descartar = (
    <>
      {/* Na barra estreita, em que os botões quebrariam de linha, fica só a lixeira. */}
      <Button
        variant="ghost"
        className="ml-auto text-bad-ink hover:text-bad-ink @max-xl/acoes1:w-11 @max-xl/acoes1:px-0 @max-3xl/acoes:w-11 @max-3xl/acoes:px-0"
        onClick={() => setConfirmando(true)}
        disabled={gravando}
        aria-label="Descartar rascunho"
        title="Descartar rascunho"
      >
        <Trash2 /> <span className="hidden @xl/acoes1:inline @3xl/acoes:inline">Descartar rascunho</span>
      </Button>
      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent
          titulo="Descartar este rascunho?"
          largura="sm"
          acoes={
            <>
              <Button variant="destructive" disabled={descartando} onClick={confirmarDescarte}>
                {descartando ? "Descartando…" : "Descartar"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmando(false)}>
                Manter rascunho
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {e.id
              ? "O rascunho será excluído e não poderá ser recuperado. A exclusão fica registrada na auditoria."
              : "O que foi preenchido nesta emenda será perdido."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );

  const rodape = (
    <div data-guia="nova-emenda.rodape" className="@container/acoes sticky bottom-0 z-10 -mx-7 rounded-b-card mt-7 flex flex-wrap items-center gap-2 bg-surface px-7 py-4 shadow-[0_-12px_16px_var(--surface)] max-md:-mx-4 max-md:px-4">
      {etapa === 1 ? null : etapa === 2 ? (
        <>
          <Button onClick={() => irPara(3)} className="max-md:flex-[1_1_100%]">
            Ir para a validação →
          </Button>
          <Button variant="ghost" onClick={() => irPara(1)}>
            Voltar
          </Button>
        </>
      ) : (
        <>
          {duplicata ? (
            <div className="flex-[1_1_100%]">
            <Aviso tipo="warn">
              <b>Possível duplicata.</b> Você já submeteu a emenda nº {duplicata.numero ?? "sem número"} ({duplicata.status.toLowerCase()}) com o mesmo
              destino e o mesmo objeto: «{duplicata.objeto}». Se for outra emenda de fato, confirme para submeter mesmo assim.{" "}
              <button type="button" className="font-bold text-navy underline-offset-2 hover:underline" disabled={gravando} onClick={() => gravar(true, true)}>
                Submeter mesmo assim
              </button>
              {" · "}
              <button type="button" className="font-bold text-navy underline-offset-2 hover:underline" onClick={() => setDuplicata(null)}>
                Cancelar
              </button>
            </Aviso>
            </div>
          ) : null}
          <Button
            data-guia="nova-emenda.submeter"
            variant="ok"
            disabled={!d.resumo.pode || gravando || !!duplicata || !podeRemeter}
            onClick={() => gravar(true)}
            className="max-md:flex-[1_1_100%]"
          >
            {d.resumo.bloqueios > 0
              ? `${diligencia ? "Reenviar" : "Submeter"} — ${d.resumo.bloqueios} bloqueio${d.resumo.bloqueios > 1 ? "s" : ""}`
              : d.resumo.alertas > 0
                ? `${diligencia ? "Reenviar" : "Submeter"} mesmo assim`
                : diligencia
                  ? "Reenviar à Comissão"
                  : "Submeter emenda"}
          </Button>
          <Button variant="ghost" onClick={() => irPara(2)}>
            Voltar
          </Button>
        </>
      )}
      {/* Na barra estreita, em que os botões quebrariam de linha, fica só o disquete. */}
      <Button
        variant="ghost"
        className="@max-xl/acoes1:w-11 @max-xl/acoes1:px-0 @max-3xl/acoes:w-11 @max-3xl/acoes:px-0"
        onClick={() => gravar(false)}
        disabled={gravando}
        aria-label="Salvar rascunho"
        title="Salvar rascunho"
      >
        <Save className="@xl/acoes1:hidden @3xl/acoes:hidden" />
        <span className="hidden @xl/acoes1:inline @3xl/acoes:inline">{gravando ? "Salvando…" : "Salvar rascunho"}</span>
      </Button>
      {diligencia ? null : descartar}
      {etapa > 1 ? (
        <Button variant="ghost" asChild className="@max-3xl/acoes:w-11 @max-3xl/acoes:px-0">
          <a
            href={e.id ? `/emendas/${e.id}/plano` : "#"}
            target="_blank"
            rel="noopener"
            aria-disabled={!e.id}
            aria-label="Visualizar plano"
            title="Visualizar plano"
            onClick={(ev) => {
              if (!e.id || alterado) {
                ev.preventDefault();
                toast("Salve o rascunho para visualizar o plano.");
              }
            }}
          >
            <Eye className="@3xl/acoes:hidden" />
            <span className="hidden @3xl/acoes:inline">Visualizar plano</span>
          </a>
        </Button>
      ) : null}
    </div>
  );

  return (
    <div data-guia-tela={`nova-emenda.etapa${etapa}`} className="px-7 pt-9 pb-11 max-md:px-4 max-md:pt-6">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        Emendas › <b className="font-bold text-ink">{diligencia ? `Emenda nº ${diligencia.numero ?? "—"}/${ctx.config.exercicio} — ajuste pedido pela Comissão` : e.id ? "Editar emenda" : "Nova emenda"}</b>
      </div>
      {!ctx.emendamento.aberto ? (
        <div className="mb-5">
          <Aviso tipo={podeRemeter ? "warn" : "bad"} titulo="Emendamento fechado">
            {ctx.emendamento.explicacao}{" "}
            {podeRemeter ? "O reenvio depois de diligência continua permitido." : "O rascunho pode ser salvo, mas não remetido."}
          </Aviso>
        </div>
      ) : null}
      {diligencia ? (
        <div className="mb-5">
          <Aviso tipo="warn" titulo="A Comissão de Finanças pediu ajuste nesta emenda">
            <span className="whitespace-pre-line">{diligencia.motivo}</span>
            {diligencia.ate ? (
              <span className="mt-1.5 block text-xs">
                Prazo para reenviar: <b>{diligencia.ate}</b>. A emenda mantém o número e a cota; corrija o que foi pedido e clique em “Reenviar à Comissão” no passo 3.
              </span>
            ) : null}
          </Aviso>
        </div>
      ) : null}
      {devolucao ? (
        <div className="mb-5">
          <Aviso tipo="warn" titulo="A análise técnica devolveu esta emenda">
            <span className="whitespace-pre-line">{devolucao.texto}</span>
            <span className="mt-1.5 block text-xs">Devolvida em {devolucao.quando}. Corrija o que foi apontado e submeta de novo no passo 3.</span>
          </Aviso>
        </div>
      ) : null}
      <div className="mb-5 flex items-center justify-between gap-4 max-md:flex-col-reverse max-md:items-stretch">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">{ETAPAS[etapa - 1]}</h1>
        <nav data-guia="nova-emenda.etapas" aria-label="Etapas" className="flex gap-1 rounded-box bg-surface p-1.5 shadow-[0_1px_2px_rgba(10,36,99,.06)]">
          {ETAPAS.map((t, i) => {
            const n = i + 1;
            const atual = n === etapa;
            return (
              <button
                key={t}
                type="button"
                aria-current={atual ? "step" : undefined}
                onClick={() => irPara(n)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-cyan max-md:flex-1 max-md:justify-center",
                  atual ? "bg-navy font-bold text-white" : "hover:bg-soft",
                  !atual && n < etapa && "text-ink"
                )}
              >
                <span className={cn("grid size-[22px] place-items-center rounded-full text-xs", atual ? "bg-cyan text-navy-deep" : "bg-page")}>{n}</span>
                <span className="sr-only">Etapa {n} de 3: </span>
                <span className={cn(!atual && "max-[1180px]:sr-only")}>{t}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5 max-[1080px]:grid-cols-1">
        <section className="relative rounded-card bg-surface p-7 pb-0 shadow-card max-md:px-4 max-md:pt-5">
          {etapa === 1 ? (
            <Etapa1
              e={e}
              d={d}
              ctx={ctx}
              aplicado={aplicado}
              destinos={destinos}
              aoCadastrarDestino={(novo) => setDestinos((l) => [...l.filter((x) => x.id !== novo.id), novo])}
              atualizar={atualizar}
              irParaPlano={() => irPara(2)}
              gravar={() => gravar(false)}
              gravando={gravando}
              descartar={diligencia ? null : descartar}
            />
          ) : etapa === 2 ? (
            <Etapa2 e={e} d={d} ctx={ctx} atualizar={atualizar} autor={autor} alterado={alterado} salvarEGerarLink={() => gravar(false, false, { gerarLink: true })} gravando={gravando} />
          ) : (
            <Etapa3 e={e} d={d} atualizar={atualizar} emendamento={ctx.emendamento} podeRemeter={podeRemeter} recusa={recusa} />
          )}
          {etapa > 1 ? rodape : <div className="h-7" />}
        </section>
        <Resumo e={e} d={d} ctx={ctx} aplicado={aplicado} />
      </div>
    </div>
  );
}
