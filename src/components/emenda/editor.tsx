"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Eye, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DigitarParaConfirmar, useDigitarParaConfirmar } from "@/components/app/digitar-para-confirmar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { excluirRascunho, salvarEmenda } from "@/lib/actions/emendas";
import type { ContextoEmenda, DestinoTela } from "@/lib/emendas/contexto";
import { chaveClassificacao, lerNumero, paraValidacao, type EstadoEmenda } from "@/lib/emendas/estado";
import { aplicarDotacaoInformada } from "@/lib/emendas/dotacao-informada";
import { contextoVerificacao, verificarEmenda } from "@/lib/emendas/verificacao";
import {
  MODELOS,
  classificacaoValida,
  classificar,
  conferirPlanilha,
  dotacaoDe,
  eventoEfetivo,
  modeloDaDotacao,
  podeAvancar,
  resumoValidacao,
  validar,
  valorDaEmenda,
  type Aplicado,
  type Checagem,
  type Verificacao,
} from "@/lib/riep";
import { cn } from "@/lib/utils";
import { Etapa1 } from "./etapa1";
import { Aviso, ErrosDaSecao } from "./ui";
import { ETAPAS, problemasDaSecao, secoesDa, type Problema, type Secao as SecaoEmenda } from "./secoes";
import { Etapa2 } from "./etapa2";
import { Etapa3 } from "./etapa3";
import { Resumo } from "./resumo";

export type Atualizar = (parcial: Partial<EstadoEmenda> | ((e: EstadoEmenda) => Partial<EstadoEmenda>)) => void;


export type DerivadoEmenda = ReturnType<typeof useDerivado>;

// O que se deduz do estado: destino, classificação, dotação, modelo, meta,
// validação. Recalculado a cada mudança — o motor é rápido e puro.
function useDerivado(e: EstadoEmenda, ctx: ContextoEmenda, destinos: DestinoTela[], aplicado: Aplicado, reenvio: boolean) {
  const destino = useMemo(() => destinos.find((d) => d.id === e.destinoId) ?? null, [destinos, e.destinoId]);
  const chave = chaveClassificacao(e);
  const valida = !!e.classificadoCom && e.classificadoCom === chave;
  const obsoleta = !!e.classificadoCom && !valida;
  const motor = useMemo(
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
  // A dotação informada à mão, conferida na LOA, toma o lugar da escolhida.
  const informada = useMemo(() => aplicarDotacaoInformada(e, motor, destino, ctx.loa), [e, motor, destino, ctx.loa]);
  const classificacao = informada.classificacao;
  const dotacao = dotacaoDe(classificacao, e.selecao);
  const modelo = modeloDaDotacao(dotacao);
  const metaPlanejamento = dotacao ? ctx.metas[dotacao.id] ?? null : null;
  // A soma da planilha comprova o valor da emenda, que é o informado no passo 1.
  const somaPlanilha = e.itens.reduce((s, i) => s + lerNumero(i.quantidade) * lerNumero(i.valorUnitario), 0);
  const valor = valorDaEmenda(lerNumero(e.pretendido), somaPlanilha);
  const planilha = conferirPlanilha(lerNumero(e.pretendido), somaPlanilha, ctx.config.toleranciaValorPct);
  const checks: Checagem[] = useMemo(
    () =>
      validar(paraValidacao(e, { classificacao, metaPlanejamento, dotacaoInformada: informada.informada }), {
        config: ctx.config,
        aplicado,
        biblioteca: ctx.catalogo.objetos,
      }),
    [e, classificacao, metaPlanejamento, informada.informada, ctx, aplicado]
  );
  // As treze verificações, sobre as mesmas conferências.
  const ctxVerificacao = useMemo(() => contextoVerificacao(ctx, aplicado, reenvio), [ctx, aplicado, reenvio]);
  const treze = useMemo(
    () => verificarEmenda(e, valor, dotacao, ctxVerificacao, checks, informada.informada === "FORA"),
    [e, valor, dotacao, ctxVerificacao, checks, informada.informada]
  );
  const resumo = resumoValidacao(checks);
  const falhas = treze.verificacoes.filter((v) => v.estado === "falha").length;
  return {
    destino,
    classificacao,
    // A da análise, sem a dotação informada (o passo 1 mostra as duas).
    motor,
    informada: informada.informada,
    obsoleta,
    dotacao,
    modelo,
    metaPlanejamento,
    valor,
    somaPlanilha,
    planilha,
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
  secaoInicial = 0,
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
  secaoInicial?: number;
}) {
  const router = useRouter();
  const [e, setE] = useState<EstadoEmenda>(inicial);
  const [etapa, setEtapa] = useState(etapaInicial);
  const [secao, setSecao] = useState(() => Math.min(Math.max(0, secaoInicial), secoesDa(etapaInicial).length - 1));
  // Problemas da seção ao tentar avançar (validação GOV.UK).
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const quadroRef = useRef<HTMLDivElement>(null);
  // Rodapé preso no pé da janela (o cartão termina abaixo dela): só então
  // ganha a linha e a sombra. Um marcador logo depois do rodapé diz isso.
  const fimDoCartao = useRef<HTMLDivElement>(null);
  const [preso, setPreso] = useState(false);
  useEffect(() => {
    const el = fimDoCartao.current;
    if (!el) return;
    const obs = new IntersectionObserver(([x]) => setPreso(!x.isIntersecting && x.boundingClientRect.top > window.innerHeight));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
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

  // Etapa seguinte só com a dotação resolvida no passo 1.
  function irPara(n: number, sec = 0) {
    if (n > 1) {
      if (!d.classificacao) {
        toast("Rode a análise no passo 1 primeiro.");
        return;
      }
      if (!d.avanca) {
        toast("Reescreva o objeto ou escolha a dotação antes de seguir.");
        return;
      }
      if (etapa === 1) montarPlano();
    }
    setProblemas([]);
    setEtapa(n);
    setSecao(sec);
  }

  const secoes = secoesDa(etapa);
  const atual = secoes[secao] ?? secoes[0];
  const ultimaSecao = secao === secoes.length - 1;

  function mostrarProblemas(p: Problema[]) {
    setProblemas(p);
    requestAnimationFrame(() => {
      quadroRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      quadroRef.current?.focus({ preventScroll: true });
    });
  }

  // Próximo: confere a seção; com problema, não avança e mostra o quadro.
  function proximo() {
    const p = problemasDaSecao(etapa, atual.id, e, d);
    if (p.length) return mostrarProblemas(p);
    setProblemas([]);
    if (!ultimaSecao) setSecao(secao + 1);
    else if (etapa < 3) irPara(etapa + 1);
  }

  function voltar() {
    setProblemas([]);
    if (secao > 0) setSecao(secao - 1);
    else if (etapa > 1) {
      setEtapa(etapa - 1);
      setSecao(secoesDa(etapa - 1).length - 1);
    }
  }

  // Marcador de seção: navegação livre dentro da etapa (como no protótipo);
  // quem confere a seção é o "Próximo" e, no fim, a validação da etapa 3.
  function irParaSecao(alvo: number) {
    setProblemas([]);
    setSecao(alvo);
  }

  // Cada seção começa do topo. O endereço guarda etapa e seção da emenda já
  // salva, para recarregar ou voltar nelas.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (!e.id) return;
    const url = new URL(window.location.href);
    if (etapa > 1) url.searchParams.set("etapa", String(etapa));
    else url.searchParams.delete("etapa");
    if (secao > 0) url.searchParams.set("secao", String(secao + 1));
    else url.searchParams.delete("secao");
    window.history.replaceState(window.history.state, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, secao]);

  // Abriu numa etapa adiante sem classificação válida: volta ao passo 1.
  useEffect(() => {
    if (etapa > 1 && (!d.classificacao || !d.avanca)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEtapa(1);
      setSecao(secoesDa(1).length - 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Corrigido o campo, o quadro se atualiza sozinho (só some ao avançar).
  const problemasVivos = problemas.length ? problemasDaSecao(etapa, atual.id, e, d) : [];
  const erros = Object.fromEntries(problemasVivos.map((x) => [x.alvo, x.msg]));

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
        if (r.verificacoes) {
          setRecusa({ verificacoes: r.verificacoes, erro: r.erro });
          // As treze como o servidor as viu ficam na seção das verificações.
          if (etapa === 3) setSecao(0);
        }
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
        if (secao > 0) q.set("secao", String(secao + 1));
        if (opcoes.gerarLink) q.set("gerarLink", "1");
        router.replace(`/emendas/${r.id}${q.toString() ? `?${q}` : ""}`, { scroll: false });
      }
    } finally {
      setGravando(false);
    }
  }

  // Descartar: rascunho gravado é excluído; o que nunca foi salvo só é abandonado.
  const [confirmando, setConfirmando] = useState(false);
  const digitado = useDigitarParaConfirmar();
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
      <Button
        variant="ghost"
        size="lg"
        className={cn(
          "ml-auto bg-transparent text-bad-ink hover:bg-bad-bg hover:text-bad-ink max-md:w-[52px] max-md:px-0",
          etapa > 1 && "@max-[44rem]/rodape:w-[52px] @max-[44rem]/rodape:px-0"
        )}
        onClick={() => {
          digitado.limpar();
          setConfirmando(true);
        }}
        disabled={gravando}
        aria-label="Descartar rascunho"
        title="Descartar rascunho"
      >
        <Trash2 /> <span className={cn("max-md:hidden", etapa > 1 && "@max-[44rem]/rodape:hidden")}>Descartar rascunho</span>
      </Button>
      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent
          titulo="Descartar este rascunho?"
          largura="sm"
          acoes={
            <>
              <Button variant="destructive" disabled={descartando || !digitado.liberado} onClick={confirmarDescarte}>
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
          <DigitarParaConfirmar texto={digitado.texto} aoMudar={digitado.setTexto} />
        </DialogContent>
      </Dialog>
    </>
  );

  const enviar = etapa === 3 && ultimaSecao;
  const rotuloEnvio =
    d.resumo.bloqueios > 0
      ? `${diligencia ? "Reenviar" : "Submeter"} — ${d.resumo.bloqueios} bloqueio${d.resumo.bloqueios > 1 ? "s" : ""}`
      : d.resumo.alertas > 0
        ? `${diligencia ? "Reenviar" : "Submeter"} mesmo assim`
        : diligencia
          ? "Reenviar à Comissão"
          : "Submeter emenda";

  // Rodapé de ações: fixo no pé da janela enquanto a seção passa da tela
  // (sticky), no fim do cartão quando cabe.
  const rodape = (
    <div
      data-guia="nova-emenda.rodape"
      data-preso={preso ? "sim" : undefined}
      className={cn(
        "@container/rodape sticky bottom-0 z-10 -mx-8 mt-8 flex flex-wrap items-center gap-2.5 rounded-b-card border-t bg-surface px-8 py-5 transition-shadow max-md:-mx-4 max-md:px-4 max-md:py-4",
        preso ? "border-hair shadow-[0_-10px_18px_-10px_rgba(10,36,99,.18)]" : "border-transparent"
      )}
    >
      {duplicata ? (
        <div className="flex-[1_1_100%]">
          <Aviso tipo="warn">
            <b>Possível duplicata.</b> Você já submeteu a emenda nº {duplicata.numero ?? "sem número"} ({duplicata.status.toLowerCase()}) com o mesmo destino
            e o mesmo objeto: «{duplicata.objeto}». Se for outra emenda de fato, confirme para submeter mesmo assim.{" "}
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
      {enviar ? (
        <Button
          data-guia="nova-emenda.submeter"
          variant="ok"
          size="lg"
          disabled={!d.resumo.pode || gravando || !!duplicata || !podeRemeter}
          onClick={() => gravar(true)}
          className="max-md:flex-[1_1_100%]"
        >
          {rotuloEnvio}
        </Button>
      ) : (
        <Button size="lg" onClick={proximo} className="max-md:flex-[1_1_100%]">
          Próximo <ArrowRight />
        </Button>
      )}
      <Button variant="ghost" size="lg" onClick={voltar} disabled={etapa === 1 && secao === 0} className="max-md:flex-1">
        Voltar
      </Button>
      <Button variant="ghost" size="lg" onClick={() => gravar(false)} disabled={gravando} aria-label="Salvar rascunho" title="Salvar rascunho" className="max-md:w-[52px] max-md:px-0">
        <Save /> <span className="max-md:hidden">{gravando ? "Salvando…" : "Salvar rascunho"}</span>
      </Button>
      {etapa > 1 ? (
        <Button variant="ghost" size="lg" asChild className="max-md:w-[52px] max-md:px-0 @max-[56rem]/rodape:w-[52px] @max-[56rem]/rodape:px-0">
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
            <Eye /> <span className="@max-[56rem]/rodape:hidden">Visualizar plano</span>
          </a>
        </Button>
      ) : null}
      {diligencia ? null : descartar}
    </div>
  );

  const titulo = diligencia
    ? `Emenda nº ${diligencia.numero ?? "—"}/${ctx.config.exercicio}`
    : e.id
      ? "Editar emenda"
      : "Nova emenda";

  return (
    <div data-guia-tela={`nova-emenda.etapa${etapa}`} className="px-7 pt-9 pb-11 max-md:px-4 max-md:pt-6">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        Emendas › <b className="font-bold text-ink">{diligencia ? `${titulo} — ajuste pedido pela Comissão` : titulo}</b>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">{titulo}</h1>
        <div data-guia="nova-emenda.situacao" className="flex flex-wrap gap-1.5">
          {[diligencia ? "Em diligência" : devolucao ? "Devolvida" : "Rascunho", `Exercício ${ctx.config.exercicio}`].map((x, i) => (
            <span
              key={x}
              className={cn(
                "rounded-full px-2.5 py-1 text-2xs font-bold tracking-[0.04em] whitespace-nowrap uppercase",
                i === 0 && diligencia ? "bg-warn-bg text-warn" : "bg-hover text-ink"
              )}
            >
              {x}
            </span>
          ))}
        </div>
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
                Prazo para reenviar: <b>{diligencia.ate}</b>. A emenda mantém o número e a cota; corrija o que foi pedido e clique em “Reenviar à Comissão” na
                última seção.
              </span>
            ) : null}
          </Aviso>
        </div>
      ) : null}
      {devolucao ? (
        <div className="mb-5">
          <Aviso tipo="warn" titulo="A análise técnica devolveu esta emenda">
            <span className="whitespace-pre-line">{devolucao.texto}</span>
            <span className="mt-1.5 block text-xs">Devolvida em {devolucao.quando}. Corrija o que foi apontado e submeta de novo na última seção.</span>
          </Aviso>
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5 max-[1080px]:grid-cols-1">
        <section className="relative rounded-card bg-surface px-8 pt-8 shadow-card max-md:px-4 max-md:pt-5">
          <BarraFase etapa={etapa} secao={secao} secoes={secoes} />
          <Marcadores
            secoes={secoes}
            atual={secao}
            erro={problemasVivos.length > 0}
            pendentes={secoes.map((x) => problemasDaSecao(etapa, x.id, e, d).length > 0)}
            aoEscolher={irParaSecao}
          />
          <p className="mt-2 mb-6 text-sm text-muted-foreground">{atual.descricao}</p>
          {problemasVivos.length ? (
            <div
              ref={quadroRef}
              tabIndex={-1}
              role="alert"
              data-teste="problemas-secao"
              className="mb-6 rounded-box border-2 border-bad bg-surface p-4 outline-none"
            >
              <h3 className="mb-2 text-md font-bold">
                Há {problemasVivos.length} problema{problemasVivos.length > 1 ? "s" : ""} nesta seção
              </h3>
              <ul className="grid gap-1 text-sm">
                {problemasVivos.map((x) => (
                  <li key={x.alvo + x.msg}>
                    <a
                      href={`#${x.alvo}`}
                      className="font-bold text-bad-ink underline underline-offset-2"
                      onClick={(ev) => {
                        ev.preventDefault();
                        const el = document.getElementById(x.alvo);
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                        (el as HTMLElement | null)?.focus?.({ preventScroll: true });
                      }}
                    >
                      {x.msg}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ErrosDaSecao.Provider value={erros}>
            <div key={`${etapa}-${atual.id}`}>
              {etapa === 1 ? (
                <Etapa1
                  e={e}
                  d={d}
                  ctx={ctx}
                  aplicado={aplicado}
                  destinos={destinos}
                  aoCadastrarDestino={(novo) => setDestinos((l) => [...l.filter((x) => x.id !== novo.id), novo])}
                  atualizar={atualizar}
                  secao={atual.id}
                  irParaSecao={(id) => irParaSecao(Math.max(0, secoes.findIndex((x) => x.id === id)))}
                />
              ) : etapa === 2 ? (
                <Etapa2
                  e={e}
                  d={d}
                  ctx={ctx}
                  atualizar={atualizar}
                  autor={autor}
                  alterado={alterado}
                  salvarEGerarLink={() => gravar(false, false, { gerarLink: true })}
                  gravando={gravando}
                  secao={atual.id}
                />
              ) : (
                <Etapa3 e={e} d={d} atualizar={atualizar} emendamento={ctx.emendamento} podeRemeter={podeRemeter} recusa={recusa} secao={atual.id} />
              )}
            </div>
          </ErrosDaSecao.Provider>
          {rodape}
          <div ref={fimDoCartao} aria-hidden className="h-px" />
        </section>
        <Resumo e={e} d={d} ctx={ctx} aplicado={aplicado} etapas={<Etapas etapa={etapa} aoEscolher={(n) => irPara(n, 0)} />} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- indicadores

// As três etapas na lateral, em linha; só a atual leva o nome.
function Etapas({ etapa, aoEscolher }: { etapa: number; aoEscolher: (n: number) => void }) {
  return (
    <nav data-guia="nova-emenda.etapas" aria-label="Etapas da emenda" className="mb-5 border-b border-hair pb-5">
      <ol className="flex items-center">
        {ETAPAS.map((t, i) => {
          const n = i + 1;
          const atual = n === etapa;
          return (
            <li key={t} className={cn("flex items-center", i < ETAPAS.length - 1 && "flex-1")}>
              <button
                type="button"
                onClick={() => aoEscolher(n)}
                disabled={n >= etapa}
                aria-current={atual ? "step" : undefined}
                aria-label={`Etapa ${n} de 3: ${t}${n < etapa ? " (concluída)" : ""}`}
                className={cn(
                  "disabled:cursor-default",
                  "grid size-[26px] shrink-0 place-items-center rounded-full text-xs font-bold focus-visible:outline-2 focus-visible:outline-cyan",
                  atual ? "bg-navy text-white" : n < etapa ? "bg-ok text-navy-deep" : "border-[1.5px] border-line-3 bg-surface text-muted-foreground"
                )}
              >
                {n < etapa ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </button>
              {i < ETAPAS.length - 1 ? <span className={cn("mx-2 h-px flex-1", n < etapa ? "bg-ok" : "bg-line-3")} aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-sm font-bold">{ETAPAS[etapa - 1]}</p>
      <p className="text-center text-xs text-muted-foreground">Etapa {etapa} de 3 · em andamento</p>
    </nav>
  );
}

// Seções da etapa no topo do cartão: números ligados; a atual com o nome.
function Marcadores({
  secoes,
  atual,
  erro,
  pendentes,
  aoEscolher,
}: {
  secoes: SecaoEmenda[];
  atual: number;
  erro: boolean;
  // Seções com algo a preencher: antes da atual, borda vermelha.
  pendentes: boolean[];
  aoEscolher: (i: number) => void;
}) {
  return (
    <nav data-guia="nova-emenda.secoes" aria-label="Seções da etapa" className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {secoes.map((x, i) => {
        const eAtual = i === atual;
        const estado = i < atual ? (pendentes[i] ? "falta preencher" : "concluída") : "pendente";
        return (
          <span key={x.id} className="flex items-center gap-2">
            {i > 0 ? <span className="h-px w-4 bg-line-3" aria-hidden /> : null}
            {eAtual ? (
              <h2 aria-current="step" className={cn("flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]", erro && "text-bad-ink")}>
                <span className={cn("grid size-[26px] shrink-0 place-items-center rounded-full text-xs text-white", erro ? "bg-bad" : "bg-navy")}>{i + 1}</span>
                {x.titulo}
                <span className="sr-only">
                  {" "}
                  — seção {i + 1} de {secoes.length}
                </span>
              </h2>
            ) : (
              <button
                type="button"
                onClick={() => aoEscolher(i)}
                title={`${x.titulo} — ${estado}`}
                aria-label={`Seção ${i + 1}: ${x.titulo} (${estado})`}
                className={cn(
                  "grid size-[26px] place-items-center rounded-full text-xs font-bold focus-visible:outline-2 focus-visible:outline-cyan",
                  estado === "concluída"
                    ? "bg-ok text-navy-deep"
                    : estado === "falta preencher"
                      ? "border-2 border-bad bg-bad-bg text-bad-ink"
                      : "border-[1.5px] border-line-3 text-muted-foreground hover:border-navy"
                )}
              >
                {estado === "concluída" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// Celular: em que ponto do preenchimento a pessoa está.
function BarraFase({ etapa, secao, secoes }: { etapa: number; secao: number; secoes: SecaoEmenda[] }) {
  const total = secoesDa(1).length + secoesDa(2).length + secoesDa(3).length;
  const feitas = (etapa > 1 ? secoesDa(1).length : 0) + (etapa > 2 ? secoesDa(2).length : 0) + secao;
  return (
    <div className="mb-4 md:hidden" data-teste="barra-fase">
      <p className="text-xs font-bold">
        Etapa {etapa} de 3 · Seção {secao + 1} de {secoes.length}
      </p>
      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-page" aria-hidden>
        <i className="block h-full rounded-full bg-cyan" style={{ width: `${Math.round(((feitas + 1) / total) * 100)}%` }} />
      </span>
    </div>
  );
}
