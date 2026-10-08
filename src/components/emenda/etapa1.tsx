"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Building2, Check, CircleMinus, CirclePlus, Landmark, Loader2, MapPin, Pencil, Users, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Ajuda } from "@/components/ui/ajuda";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ContextoEmenda, DestinoTela } from "@/lib/emendas/contexto";
import { chaveClassificacao, chaveInformada, formatarNumero, informadaConferida, lerNumero, type EstadoEmenda } from "@/lib/emendas/estado";
import {
  BRL,
  DOTACAO_INFORMADA_VAZIA,
  audesp,
  derivaIcCo,
  derivaIcEp,
  lerDotacaoInformada,
  norm,
  parcelaDaDotacao,
  precisaAjuste,
  sinaisValor,
  sugerirDestinos,
  sugerirTextos,
  situacaoEfetiva,
  type Aplicado,
  type Candidata,
  type Classificacao,
  type DotacaoInformada,
  type DotacaoMotor,
  type SugestaoDestino,
  type SugestaoTexto,
} from "@/lib/riep";
import { nomeDoAlcance } from "@/lib/riep/destino";
import { cn } from "@/lib/utils";
import { DestinoDialog } from "./destino-dialog";
import type { Atualizar, DerivadoEmenda } from "./editor";
import { AreaTexto, Aviso, Campo, CampoNumero, Detalhes, Selo, TextoRico, Veredito } from "./ui";

export const ELEMENTOS: Record<string, string> = {
  "30": "30 — material de consumo",
  "39": "39 — outros serviços de terceiros",
  "40": "40 — serviços de TIC",
  "41": "41 — contribuições",
  "42": "42 — auxílios",
  "43": "43 — subvenções sociais",
  "51": "51 — obras e instalações",
  "52": "52 — equipamentos e material permanente",
};

// Rótulo curto de cada sinalização do motor; o texto inteiro fica no balão.
function rotuloSinal(texto: string): string {
  if (texto.includes("excede o valor autorizado")) return "Valor acima do autorizado";
  if (texto.includes("candidatas têm valor autorizado abaixo")) return "Candidatas abaixo do valor";
  if (texto.includes("instrumento da parceria não definido")) return "Instrumento da parceria pendente";
  if (texto.includes("fonte AUDESP")) return "AUDESP não parametrizado";
  if (texto.includes("Cota individual não parametrizada")) return "Cota não parametrizada";
  const parcela = texto.match(/consome a parcela de \*\*(.+?)\*\*/);
  if (parcela) return `Saldo de ${parcela[1]} insuficiente`;
  return texto.replace(/\*\*/g, "").split(/[.—]/)[0].slice(0, 48);
}

// Sinalizações: alertam, não bloqueiam. Selos curtos; o detalhe fica no balão.
// O valor acima do autorizado vem com o atalho para igualar os dois.
function Sinalizacoes({ sinais, ajustarAoAutorizado }: { sinais: string[]; ajustarAoAutorizado?: { valor: number; aplicar: () => void } }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {sinais.map((s, i) => (
        <span key={i} className="inline-flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-warn-line bg-warn-bg px-3 py-1.5 text-xs font-bold text-warn transition-colors hover:bg-[#FBEBCB] focus-visible:outline-2 focus-visible:outline-cyan"
            >
              <AlertTriangle className="size-3.5" aria-hidden />
              {rotuloSinal(s)}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[380px] text-sm">
            <TextoRico texto={s} />
          </TooltipContent>
        </Tooltip>
        {ajustarAoAutorizado && s.includes("excede o valor autorizado") ? (
          <Button type="button" variant="surface" size="sm" onClick={ajustarAoAutorizado.aplicar}>
            Ajustar ao autorizado ({BRL(ajustarAoAutorizado.valor)})
          </Button>
        ) : null}
        </span>
      ))}
      <Ajuda titulo="Sinalizações">
        Sinalização não é bloqueio: nada aqui impede o avanço. O valor conferido de verdade é a soma da memória de cálculo, no passo 2, e a
        reconferência acontece lá.
      </Ajuda>
    </div>
  );
}

export function Etapa1({
  e,
  d,
  ctx,
  aplicado,
  destinos,
  aoCadastrarDestino,
  atualizar,
  secao,
  irParaSecao,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  ctx: ContextoEmenda;
  aplicado: Aplicado;
  destinos: DestinoTela[];
  aoCadastrarDestino: (d: DestinoTela) => void;
  atualizar: Atualizar;
  // Seção em exibição (secoes.ts): uma por vez.
  secao: string;
  irParaSecao: (id: string) => void;
}) {
  const [analisando, setAnalisando] = useState<number | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  function analisar() {
    if (!d.destino) return toast("Escolha para onde vai a emenda.");
    if (!e.objeto.trim()) return toast("Descreva o objeto da emenda.");
    if (!(lerNumero(e.pretendido) > 0)) return toast("Informe o valor da emenda.");
    if (!e.endereco.trim()) return toast("Informe o endereço do local.");
    const concluir = () => {
      setAnalisando(null);
      atualizar({ classificadoCom: chaveClassificacao(e), selecao: { escolha: null, dotacaoId: null } });
      requestAnimationFrame(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return concluir();
    // Os três passos da análise, visíveis, como no protótipo.
    setAnalisando(0);
    [1, 2, 3].forEach((n) => setTimeout(() => (n === 3 ? concluir() : setAnalisando(n)), n * 400));
  }

  const c = d.classificacao;
  // Dotação informada à mão: o painel toma o lugar do resultado da análise.
  const manual = e.dotacaoInformada !== null;
  const bloqueado = !!c && !d.avanca && (c.situacao === "OBICE" || c.situacao === "CONFLITO" || c.situacao === "INDETERMINADO");

  if (secao === "tipo") {
    return (
      <div className="flex flex-col gap-7">
        <TipoDeEmenda />
        <EscolhaExecucao
          valor={e.execucao}
          aoMudar={(v) => {
            if (v === e.execucao) return;
            if (e.destinoId) toast("Forma de execução alterada — escolha o destino novamente.");
            atualizar({ execucao: v, destinoId: null, endereco: "" });
          }}
        />
      </div>
    );
  }

  if (secao === "destino") {
    return (
      <div className="flex flex-col gap-6">
        <div data-guia="nova-emenda.destino">
          <CampoDestino e={e} destino={d.destino} destinos={destinos} ctx={ctx} atualizar={atualizar} aoCadastrar={aoCadastrarDestino} />
        </div>
        <CampoEndereco valor={e.endereco} cadastro={d.destino?.endereco ?? ""} temDestino={!!d.destino} aoMudar={(v) => atualizar({ endereco: v })} />
      </div>
    );
  }

  if (secao === "objeto") {
    return (
      <div className="flex flex-col gap-6">
        <div data-guia="nova-emenda.objeto">
          <Campo
            rotulo="Objeto da emenda"
            obrigatorio
            htmlFor="f-obj"
            contador={{ atual: e.objeto.length, max: 500 }}
            ajuda="Linguagem comum. O motor reconhece termos como ambulância, ultrassom, reforma, pavimentação, oficinas, merenda, trator, câmeras, playground."
          >
            <AreaTexto
              id="f-obj"
              valor={e.objeto}
              aoMudar={(v) => atualizar({ objeto: v })}
              max={500}
              campo="objeto"
              placeholder="Ex.: aquisição de uma ambulância para transporte de pacientes"
              contexto={{ objeto: e.objeto, destino: d.destino?.nome ?? "", execucao: e.execucao, exercicio: ctx.config.exercicio }}
            />
          </Campo>
        </div>
        <div data-guia="nova-emenda.valor" className="max-w-sm">
          <Campo rotulo="Valor da emenda" obrigatorio htmlFor="f-pre" ajuda="É o valor da emenda. A planilha do plano de trabalho comprova esse valor." dica="Digite só os números; o sistema formata em reais.">
            <CampoNumero id="f-pre" valor={e.pretendido} aoMudar={(v) => atualizar({ pretendido: v })} prefixo="R$ " placeholder="R$ 0,00" />
          </Campo>
        </div>
      </div>
    );
  }

  // Dotação: a análise automática ou a dotação informada à mão.
  return (
    <div className="flex flex-col gap-5" data-pronta={d.avanca && (manual ? !!d.informada : !d.obsoleta) ? "sim" : "nao"}>
      {manual ? (
        <DotacaoManual e={e} d={d} atualizar={atualizar} />
      ) : (
        <>
          {analisando !== null ? <Processando passo={analisando} rotuloBase={ctx.config.rotuloBase ?? "LOA"} /> : null}
          <div id="nova-emenda-resultado" ref={resultadoRef} data-guia="nova-emenda.resultado" className="scroll-mt-4">
            {d.obsoleta && analisando === null ? (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-box bg-warn-bg px-4 py-3.5 text-sm text-warn">
                <span className="flex-1">
                  <b className="block">A classificação anterior não vale mais</b>
                  Os dados da emenda mudaram — rode a análise de novo para o sistema reenquadrar a emenda.
                </span>
              </div>
            ) : null}
            {c && !d.obsoleta && analisando === null ? <ResultadoClassificacao c={c} e={e} d={d} ctx={ctx} aplicado={aplicado} atualizar={atualizar} /> : null}
            {c && !d.obsoleta && analisando === null && precisaAjuste(c) && situacaoEfetiva(c, e.selecao) !== "OK" && e.selecao.escolha !== "ANALISE_TECNICA" ? (
              <AjusteAutomatico
                key={chaveClassificacao(e)}
                c={c}
                e={e}
                d={d}
                ctx={ctx}
                destinos={destinos}
                aplicar={(parcial, aviso) => {
                  atualizar({ ...parcial, classificadoCom: chaveClassificacao({ ...e, ...parcial }), selecao: { escolha: null, dotacaoId: null } });
                  toast(aviso);
                  requestAnimationFrame(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
              />
            ) : null}
          </div>
          <div data-guia="nova-emenda.avancar" className="flex flex-wrap items-center gap-3">
            {!c || d.obsoleta ? (
              <Button id="b-analisar" size="lg" onClick={analisar} disabled={analisando !== null} className="max-sm:w-full">
                {d.obsoleta ? "Analisar novamente →" : "Analisar e classificar →"}
              </Button>
            ) : bloqueado ? (
              <Button size="lg" variant="surface" onClick={() => irParaSecao("objeto")} className="max-sm:w-full">
                Reescrever o objeto
              </Button>
            ) : null}
          </div>
        </>
      )}
      {!manual && analisando === null ? (
        <p className="text-sm text-muted-foreground">
          Já sabe a dotação?{" "}
          <button
            type="button"
            className="font-bold text-navy underline underline-offset-2"
            onClick={() => atualizar({ dotacaoInformada: { ...DOTACAO_INFORMADA_VAZIA, conferidaCom: null }, declaracaoDotacao: false })}
          >
            Informar a dotação manualmente
          </button>
        </p>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------- tipo de emenda

// Só a impositiva existe hoje; as demais aparecem para quem conhece o
// processo, desabilitadas (anotação 1 do Dr. Emerson).
function TipoDeEmenda() {
  const opcoes = [
    { titulo: "Impositiva", origem: "Indicação individual", texto: "Execução obrigatória pelo Município.", Icone: Landmark, ativo: true },
    { titulo: "Acréscimo", origem: "Em breve", texto: "Aumenta uma dotação existente.", Icone: CirclePlus, ativo: false },
    { titulo: "Anulação", origem: "Em breve", texto: "Reduz uma dotação existente.", Icone: CircleMinus, ativo: false },
    { titulo: "Remanejamento", origem: "Em breve", texto: "Move valor de uma dotação para outra.", Icone: ArrowLeftRight, ativo: false },
  ];
  return (
    <fieldset data-guia="nova-emenda.tipo">
      <legend className="mb-2.5 text-sm font-bold text-label">Tipo de emenda</legend>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {opcoes.map(({ titulo, origem, texto, Icone, ativo }) => (
          <div
            key={titulo}
            aria-disabled={!ativo || undefined}
            className={cn(
              "relative flex items-center gap-3.5 rounded-box p-[18px]",
              ativo ? "bg-info-bg shadow-[inset_0_0_0_2px_var(--cyan)]" : "bg-soft text-muted-foreground opacity-60"
            )}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-field bg-surface">
              <Icone className="size-[22px] text-navy" strokeWidth={1.7} />
            </span>
            <span className="pr-6">
              <b className="flex items-center gap-1.5 text-md">
                {titulo}
                {!ativo ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="grid size-4.5 place-items-center rounded-full bg-page text-2xs font-bold" aria-label={`${titulo}: disponível futuramente`}>
                        ?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Disponível futuramente</TooltipContent>
                  </Tooltip>
                ) : null}
              </b>
              <span className="block text-xs font-semibold text-muted-foreground">{origem}</span>
              <span className="block text-xs leading-snug">{texto}</span>
            </span>
            {ativo ? (
              <span className="absolute top-3 right-3 grid size-[22px] place-items-center rounded-full bg-cyan text-navy-deep">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

// ------------------------------------------------- dotação informada à mão

const CAMPOS_DOTACAO: { k: keyof DotacaoInformada; rotulo: string; ex: string; dica?: string }[] = [
  { k: "unidade", rotulo: "Unidade orçamentária", ex: "02.01" },
  { k: "funcional", rotulo: "Funcional", ex: "10.301.0010.2001", dica: "função.subfunção.programa.ação" },
  { k: "natureza", rotulo: "Natureza da despesa", ex: "3.3.90.30" },
  { k: "fonte", rotulo: "Fonte de recurso", ex: "01.1100000" },
  { k: "ficha", rotulo: "Ficha (opcional)", ex: "559" },
];

// O vereador digita a classificação; "Conferir na LOA" procura a combinação.
// Fora da LOA, a emenda segue sob a declaração de responsabilidade dele.
function DotacaoManual({ e, d, atualizar }: { e: EstadoEmenda; d: DerivadoEmenda; atualizar: Atualizar }) {
  const inf = e.dotacaoInformada!;
  const conferida = informadaConferida(inf);
  const dot = d.dotacao;
  const mudar = (k: keyof DotacaoInformada, v: string) => atualizar({ dotacaoInformada: { ...inf, [k]: v } });

  function conferir() {
    const { faltas } = lerDotacaoInformada(inf);
    if (faltas.length) return toast(`Confira: ${faltas.join("; ")}.`);
    atualizar({ dotacaoInformada: { ...inf, conferidaCom: chaveInformada(inf) } });
  }

  const parcela = parcelaDaDotacao(dot);
  return (
    <section data-teste="dotacao-manual" className="rounded-box border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-md font-bold">Informar a dotação manualmente</h3>
        <Button variant="ghost" size="sm" onClick={() => atualizar({ dotacaoInformada: null, declaracaoDotacao: false })}>
          Voltar à análise automática
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        {CAMPOS_DOTACAO.map((f) => (
          <Campo key={f.k} rotulo={f.rotulo} htmlFor={`f-dot-${f.k}`} dica={f.dica}>
            <input
              id={`f-dot-${f.k}`}
              className="campo h-12 px-3.5 tnum"
              maxLength={f.k === "funcional" ? 40 : 20}
              placeholder={`Ex.: ${f.ex}`}
              value={inf[f.k]}
              onChange={(ev) => mudar(f.k, ev.target.value)}
            />
          </Campo>
        ))}
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button variant="surface" onClick={conferir} className="max-sm:w-full">
          Conferir na LOA
        </Button>
        {!conferida && inf.conferidaCom ? <span className="text-sm text-muted-foreground">Os campos mudaram: confira de novo.</span> : null}
      </div>

      {conferida && d.informada === "LOA" && dot ? (
        <div className="mt-3.5">
          <Aviso tipo="info" titulo="Encontrada na LOA">
            <b>
              {dot.codigo} — {dot.nome}
            </b>
            {dot.ficha ? ` · ficha ${dot.ficha}` : ""} · {BRL(dot.autorizado)} autorizados ·{" "}
            {parcela === "SAUDE" ? "parcela da saúde" : "parcela das demais áreas"}. A emenda segue com esta dotação.
          </Aviso>
        </div>
      ) : null}
      {conferida && d.informada === "FORA" ? (
        <div className="mt-3.5 grid gap-3">
          <Aviso tipo="warn" titulo="Não encontrada na LOA">
            Esta combinação não está entre as dotações que recebem emenda. A emenda pode seguir com a classificação informada, sob sua responsabilidade:
            as verificações que dependem da LOA ficam como não conferíveis e a Comissão vê a declaração. Parcela pela funcional informada:{" "}
            <b>{parcela === "SAUDE" ? "saúde" : "demais áreas"}</b>.
          </Aviso>
          <label className="flex cursor-pointer gap-3 rounded-box bg-soft p-4 text-sm leading-relaxed">
            <input
              id="f-dec-dotacao"
              type="checkbox"
              className="mt-1 size-4 shrink-0"
              checked={e.declaracaoDotacao}
              onChange={(ev) => atualizar({ declaracaoDotacao: ev.target.checked })}
            />
            <span>
              <b>Declaração da dotação.</b> A classificação foi informada por mim e é de minha responsabilidade.{" "}
              <span className="text-muted-foreground">Obrigatória para enviar.</span>
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}

// --------------------------------------------------------------- execução

// Quando a análise não acha dotação: explica o motivo e propõe um ajuste que o
// próprio motor confirma — outro texto para o objeto ou outro destino.
function AjusteAutomatico({
  c,
  e,
  d,
  ctx,
  destinos,
  aplicar,
}: {
  c: Classificacao;
  e: EstadoEmenda;
  d: DerivadoEmenda;
  ctx: ContextoEmenda;
  destinos: DestinoTela[];
  aplicar: (parcial: Partial<EstadoEmenda>, aviso: string) => void;
}) {
  const [r, setR] = useState<{ textos: SugestaoTexto[]; destinos: { sugestoes: SugestaoDestino[]; total: number } } | null>(null);
  const o = c.objeto;
  const unidade = nomeDoAlcance(c.uoAlvo, ctx.catalogo.unidades) ?? c.destino.nome;
  const motivo =
    c.situacao === "CONFLITO" && o
      ? `“${o.rotulo}” é despesa de ${o.area}; o destino escolhido é de outra área.`
      : c.situacao === "OBICE"
        ? `${unidade} não tem, na ${ctx.config.rotuloBase ?? "LOA"}, dotação de ${ELEMENTOS[c.objeto?.elemento ?? ""]?.replace(/^\d+ — /, "") ?? "despesa"} para este objeto.`
        : c.naoReconhecido
          ? "O texto não cita nenhum objeto que o sistema conheça — só deu para saber a natureza da despesa."
          : "Nenhuma ação da unidade trata do que a emenda entrega.";

  function ajustar() {
    if (!d.destino) return;
    const x = { objeto: e.objeto, destino: d.destino, execucao: e.execucao, pretendido: lerNumero(e.pretendido), loa: ctx.loa, catalogo: ctx.catalogo };
    const textos = sugerirTextos(x);
    setR({ textos, destinos: textos.length ? { sugestoes: [], total: 0 } : sugerirDestinos({ ...x, destinos }) });
  }

  const onde = (s: { situacao: "OK" | "VALIDAR"; dotacao: Candidata; opcoes: number }) =>
    s.situacao === "OK" ? `enquadra em ${s.dotacao.codigo} — ${s.dotacao.nome}` : `${s.opcoes} dotações compatíveis para você escolher`;

  return (
    <div className="mt-3 rounded-box border border-cyan/40 bg-info-bg p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-field bg-navy text-cyan">
          <Wand2 className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Não encontrou a dotação?</div>
          <div className="text-xs text-muted-foreground">{motivo}</div>
        </div>
        {!r ? (
          <Button size="sm" onClick={ajustar}>
            <Wand2 /> Ajustar automaticamente
          </Button>
        ) : null}
      </div>

      {r ? (
        <div className="mt-4 grid gap-2">
          {r.textos.length ? (
            <>
              <div className="antena">Textos que o sistema enquadra</div>
              {r.textos.map((t) => (
                <div key={t.texto} className="flex flex-wrap items-center gap-3 rounded-md bg-surface px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">“{t.texto}”</div>
                    <div className="text-xs text-muted-foreground">{onde(t)}</div>
                  </div>
                  <Button size="xs" variant="surface" onClick={() => aplicar({ objeto: t.texto }, "Objeto ajustado — análise refeita.")}>
                    Usar este texto
                  </Button>
                </div>
              ))}
            </>
          ) : null}
          {r.destinos.sugestoes.length ? (
            <>
              <div className="antena">O texto está certo — o destino é que não comporta. Onde ele cabe:</div>
              {r.destinos.sugestoes.map((s) => (
                <div key={s.destino.id} className="flex flex-wrap items-center gap-3 rounded-md bg-surface px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{s.destino.nome}</div>
                    <div className="text-xs text-muted-foreground">{onde(s)}</div>
                  </div>
                  <Button
                    size="xs"
                    variant="surface"
                    onClick={() => aplicar({ destinoId: s.destino.id, endereco: s.destino.endereco }, "Destino trocado — análise refeita.")}
                  >
                    Usar este destino
                  </Button>
                </div>
              ))}
              {r.destinos.total > r.destinos.sugestoes.length ? (
                <p className="text-xs text-muted-foreground">
                  E mais {r.destinos.total - r.destinos.sugestoes.length} destino(s) onde o objeto cabe — escolha no campo “Para onde vai”.
                </p>
              ) : null}
            </>
          ) : null}
          {!r.textos.length && !r.destinos.sugestoes.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum ajuste de texto ou de destino enquadra este objeto na {ctx.config.rotuloBase ?? "LOA"}. O caminho é pedir ao Executivo a
              inclusão da ação por alteração da lei.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EscolhaExecucao({ valor, aoMudar }: { valor: "DIRETA" | "INDIRETA"; aoMudar: (v: "DIRETA" | "INDIRETA") => void }) {
  const opcoes = [
    { v: "DIRETA" as const, titulo: "Execução direta", origem: "Poder Executivo", texto: "O Município contrata e paga.", Icone: Building2 },
    {
      v: "INDIRETA" as const,
      titulo: "Execução indireta",
      origem: "OSC / Terceiro Setor",
      texto: "O recurso é repassado a uma entidade sem fins lucrativos.",
      Icone: Users,
    },
  ];
  return (
    <fieldset data-guia="nova-emenda.execucao">
      <legend className="mb-1.5 text-sm font-semibold text-label">
        Quem executa<span className="text-muted-foreground"> *</span>
      </legend>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {opcoes.map(({ v, titulo, origem, texto, Icone }) => {
          const sel = valor === v;
          return (
            <label
              key={v}
              className={cn(
                "relative flex cursor-pointer items-center gap-3.5 rounded-box p-[18px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan",
                sel ? "bg-info-bg shadow-[inset_0_0_0_2px_var(--cyan)]" : "bg-soft hover:bg-field-hover"
              )}
            >
              <input type="radio" name="execucao" value={v} checked={sel} onChange={() => aoMudar(v)} className="sr-only" />
              <span className="grid size-11 shrink-0 place-items-center rounded-field bg-surface">
                <Icone className="size-[22px] text-navy" strokeWidth={1.7} />
              </span>
              <span className="pr-6">
                <b className="block text-md">{titulo}</b>
                <span className="block text-xs font-semibold text-muted-foreground">{origem}</span>
                <span className="block text-xs leading-snug">{texto}</span>
              </span>
              {sel ? (
                <span className="absolute top-3 right-3 grid size-[22px] place-items-center rounded-full bg-cyan text-navy-deep">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------- destino

function CampoDestino({
  e,
  destino,
  destinos,
  ctx,
  atualizar,
  aoCadastrar,
}: {
  e: EstadoEmenda;
  destino: DestinoTela | null;
  destinos: DestinoTela[];
  ctx: ContextoEmenda;
  atualizar: Atualizar;
  aoCadastrar: (d: DestinoTela) => void;
}) {
  const [texto, setTexto] = useState(destino?.nome ?? "");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(-1);
  const [dialogo, setDialogo] = useState<{ nome: string; editando: DestinoTela | null } | null>(null);

  useEffect(() => {
    // Mantém o texto alinhado ao destino escolhido (troca de execução, reabertura).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTexto(destino?.nome ?? "");
  }, [destino?.id, destino?.nome]);

  const q = norm(texto.trim());
  const lista = useMemo(
    () =>
      destinos
        .filter((x) => x.execucao === e.execucao && (!q || norm(x.nome).includes(q) || norm(x.unidadeNome).includes(q) || x.apelidos.some((a) => norm(a).includes(q))))
        .slice(0, 8),
    [destinos, e.execucao, q]
  );
  const exato = destinos.some((x) => x.execucao === e.execucao && norm(x.nome) === q);
  const podeCadastrar = texto.trim().length >= 2 && !destino && !exato;
  const opcoes = lista.length + (podeCadastrar ? 1 : 0);

  function escolher(x: DestinoTela) {
    atualizar({ destinoId: x.id, endereco: x.endereco });
    setTexto(x.nome);
    setAberto(false);
  }
  const cadastrar = () => {
    setAberto(false);
    setDialogo({ nome: texto.trim(), editando: null });
  };

  const indireta = e.execucao === "INDIRETA";
  return (
    <Campo
      rotulo="Para onde vai"
      obrigatorio
      htmlFor="f-dest"
      dica={
        destino ? (
          <span className="flex flex-wrap items-center gap-2">
            {destino.execucao === "INDIRETA"
              ? `CNPJ ${destino.cnpj ?? "—"}${destino.responsavel ? ` · responsável: ${destino.responsavel}${destino.cargo ? ` (${destino.cargo})` : ""}` : ""} · a secretaria do repasse vem do objeto`
              : `Vinculado a ${destino.uo} — ${destino.unidadeNome ?? ""}`}
            {destino.novo ? (
              <button
                type="button"
                onClick={() => setDialogo({ nome: destino.nome, editando: destino })}
                className="inline-flex items-center gap-1 font-bold text-navy underline-offset-2 hover:underline"
              >
                <Pencil className="size-3" /> Editar cadastro
              </button>
            ) : null}
          </span>
        ) : (
          "Não encontrou? Cadastre pela própria lista."
        )
      }
    >
      <div className="relative">
        <input
          id="f-dest"
          role="combobox"
          aria-expanded={aberto && opcoes > 0}
          aria-controls="f-dest-lista"
          aria-autocomplete="list"
          autoComplete="off"
          className="campo h-12 px-3.5"
          placeholder={indireta ? "Digite o nome da entidade sem fins lucrativos" : "Digite o nome do órgão ou equipamento público"}
          value={texto}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 160)}
          onChange={(ev) => {
            setTexto(ev.target.value);
            setAberto(true);
            setDestaque(-1);
            if (e.destinoId) atualizar({ destinoId: null, endereco: "" });
          }}
          onKeyDown={(ev) => {
            if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
              ev.preventDefault();
              if (!opcoes) return;
              setDestaque((i) => (i + (ev.key === "ArrowDown" ? 1 : -1) + opcoes) % opcoes);
            } else if (ev.key === "Enter") {
              ev.preventDefault();
              if (destaque >= 0 && destaque < lista.length) escolher(lista[destaque]);
              else if ((destaque === lista.length || destaque < 0) && podeCadastrar) cadastrar();
            } else if (ev.key === "Escape") setAberto(false);
          }}
        />
        {aberto && opcoes > 0 ? (
          <div
            id="f-dest-lista"
            role="listbox"
            className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 max-h-[320px] overflow-y-auto rounded-box bg-surface p-1.5 shadow-modal"
          >
            {lista.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="option"
                aria-selected={destaque === i}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  escolher(x);
                }}
                className={cn("block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-soft", destaque === i && "bg-soft")}
              >
                {x.nome}
                <span className="block text-xs font-medium text-muted-foreground">
                  {x.execucao === "DIRETA" ? `Administração — ${x.uo} ${x.unidadeNome ?? ""}` : "Entidade do terceiro setor"}
                  {x.novo ? " · cadastrado no sistema" : ""}
                </span>
              </button>
            ))}
            {podeCadastrar ? (
              <button
                type="button"
                role="option"
                aria-selected={destaque === lista.length}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  cadastrar();
                }}
                className={cn(
                  "block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-navy hover:bg-info-bg",
                  destaque === lista.length && "bg-info-bg"
                )}
              >
                ＋ Cadastrar “{texto.trim()}”
                <span className="block text-xs font-medium text-muted-foreground">
                  {indireta ? "Nova entidade do terceiro setor" : "Novo órgão ou equipamento público"}
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <DestinoDialog
        aberto={!!dialogo}
        execucao={e.execucao}
        nomeInicial={dialogo?.nome ?? ""}
        editando={dialogo?.editando ?? null}
        unidades={ctx.unidades}
        exercicio={ctx.config.exercicio}
        aoFechar={() => setDialogo(null)}
        aoSalvar={(novo) => {
          const enderecoManual = dialogo?.editando && e.endereco.trim() && e.endereco.trim() !== dialogo.editando.endereco.trim();
          aoCadastrar(novo);
          atualizar({ destinoId: novo.id, endereco: enderecoManual ? e.endereco : novo.endereco });
          setTexto(novo.nome);
          setDialogo(null);
        }}
      />
    </Campo>
  );
}

// --------------------------------------------------------------- endereço

// O endereço vem do cadastro do destino; editar é uma ação explícita.
function CampoEndereco({ valor, cadastro, temDestino, aoMudar }: { valor: string; cadastro: string; temDestino: boolean; aoMudar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const alterado = !!valor.trim() && !!cadastro && valor.trim() !== cadastro.trim();
  return (
    <Campo
      rotulo="Endereço do local"
      obrigatorio
      htmlFor="f-loc"
      ajuda="Vem do cadastro do destino. Corrija se a entrega for em outro endereço da mesma unidade."
      dica={
        alterado && !editando ? (
          <span>
            Endereço alterado manualmente.{" "}
            <button type="button" className="font-bold text-navy underline-offset-2 hover:underline" onClick={() => aoMudar(cadastro)}>
              Restaurar do cadastro
            </button>
          </span>
        ) : null
      }
    >
      {editando || (!valor && (cadastro || temDestino)) ? (
        <input
          id="f-loc"
          autoFocus={editando}
          className="campo h-12 px-3.5"
          value={valor}
          placeholder="Rua, número — bairro · CEP"
          onChange={(ev) => aoMudar(ev.target.value)}
          onBlur={() => valor.trim() && setEditando(false)}
          onKeyDown={(ev) => (ev.key === "Enter" || ev.key === "Escape") && (ev.preventDefault(), setEditando(false))}
        />
      ) : valor ? (
        <div className="flex min-h-12 items-center gap-3 rounded-field bg-soft py-1.5 pr-1.5 pl-3.5 text-sm">
          <span className="flex-1">{valor}</span>
          <Button variant="surface" size="sm" onClick={() => setEditando(true)} aria-label="Editar endereço do local">
            <Pencil /> Editar
          </Button>
        </div>
      ) : (
        <div className="flex min-h-12 items-center gap-2.5 rounded-field bg-soft px-3.5 text-sm text-muted-foreground">
          <MapPin className="size-[18px]" strokeWidth={1.8} />
          Preenchido automaticamente ao escolher “Para onde vai”.
        </div>
      )}
    </Campo>
  );
}

// ------------------------------------------------------------ processando

function Processando({ passo, rotuloBase }: { passo: number; rotuloBase: string }) {
  const passos = ["Interpretando o objeto", `Procurando dotação compatível na ${rotuloBase}`, "Conferindo cota, reserva da saúde e vedações"];
  return (
    <div className="grid gap-2 rounded-box bg-soft px-4 py-3.5" role="status">
      {passos.map((p, i) => (
        <div key={p} className={cn("flex items-center gap-2.5 text-sm", i > passo ? "text-muted-foreground" : "font-semibold")}>
          {i < passo ? (
            <span className="grid size-[18px] place-items-center rounded-full bg-ok text-navy-deep">
              <Check className="size-3" strokeWidth={3} />
            </span>
          ) : i === passo ? (
            <Loader2 className="size-[18px] animate-spin text-cyan" />
          ) : (
            <span className="size-[18px] rounded-full border-[1.5px] border-line-3" />
          )}
          {p}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- resultado

// A, B, …, Z, AA, AB… — a lista pode passar de 26 quando o destino cobre um órgão.
function letraCandidata(i: number): string {
  return (i >= 26 ? letraCandidata(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26));
}

function LinhaDotacao({
  d,
  selo,
  ambar,
  selecionada,
  unidade,
  children,
}: {
  d: Candidata | DotacaoMotor;
  selo?: string;
  ambar?: boolean;
  selecionada?: boolean;
  // Nome da unidade da dotação: só aparece quando a busca cobre mais de uma.
  unidade?: string | null;
  children?: React.ReactNode;
}) {
  const abaixo = "abaixoDoPretendido" in d && d.abaixoDoPretendido;
  return (
    <div
      className={cn(
        "flex gap-4 rounded-box px-4 py-3.5 max-sm:flex-col",
        selecionada ? "bg-ok-bg shadow-[inset_0_0_0_2px_var(--green)]" : ambar ? "bg-surface shadow-[inset_3px_0_0_var(--amber)]" : "bg-soft"
      )}
    >
      <div className="min-w-0 flex-1">
        {selo ? (
          <div className="mb-1.5">
            <Selo tipo={ambar ? "warn" : "ok"}>{selo}</Selo>
          </div>
        ) : null}
        <div className="text-sm font-bold">
          {d.codigo} — {d.nome}
        </div>
        <div className="text-xs text-muted-foreground">
          {d.uo}
          {unidade ? ` — ${unidade}` : ""} · função {d.funcao}.{d.subf} — {d.subfn} · programa {d.prog}
        </div>
        <div className="text-xs text-muted-foreground">
          {d.gnd}.{d.gnd}.{d.mod}.{d.elem} · fonte {d.fonte}
        </div>
        {abaixo ? (
          <div className="mt-1.5">
            <Selo tipo="warn">autorizado abaixo do valor da emenda</Selo>
          </div>
        ) : null}
        {children}
      </div>
      <div className="text-right max-sm:text-left">
        <div className="antena">Autorizado</div>
        <div className="text-sm font-bold tnum">{BRL(d.autorizado)}</div>
      </div>
    </div>
  );
}

function ResultadoClassificacao({
  c,
  e,
  d,
  ctx,
  aplicado,
  atualizar,
}: {
  c: Classificacao;
  e: EstadoEmenda;
  d: DerivadoEmenda;
  ctx: ContextoEmenda;
  aplicado: Aplicado;
  atualizar: Atualizar;
}) {
  const o = c.objeto;
  const sit = situacaoEfetiva(c, e.selecao);
  const manual = c.situacao === "VALIDAR" && sit === "OK";
  const rotuloBase = ctx.config.rotuloBase ?? "LOA";
  // Destino que cobre o órgão inteiro (Hospital): cada dotação diz de que unidade é.
  const nomeSeVarias = (uo: string) =>
    c.unidadesAlvo.length > 1 || !c.unidadesAlvo.includes(uo) ? (ctx.catalogo.unidades[uo] ?? "").split(" — ").pop() || null : null;
  const unidadeDestino = (nomeDoAlcance(c.uoAlvo, ctx.catalogo.unidades) ?? c.destino.nome).split(" — ")[0];
  // Obra que o orçamento põe em outra secretaria: a tela diz onde a dotação está e por quê.
  const avisoObra = c.unidadeDaObra ? (
    <Aviso tipo="info">
      {unidadeDestino} não tem dotação de obra na {rotuloBase}. As obras desta área estão em{" "}
      <b>{(ctx.catalogo.unidades[c.unidadeDaObra] ?? c.unidadeDaObra).split(" — ")[0]}</b>, em linha própria da área — é dela a dotação abaixo.
    </Aviso>
  ) : null;

  if (c.situacao === "CONFLITO" && o) {
    return (
      <div className="grid gap-3">
        <Veredito tipo="bad" titulo="Objeto incompatível com o destino">
          “{o.rotulo}” é despesa de {o.area}, e o destino escolhido pertence a {c.destino.nome}. Não há como enquadrar este objeto nessa unidade.
        </Veredito>
        <Aviso tipo="bad" titulo="O que fazer">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Indicar um destino de {c.uoAreaNome}, se a intenção é entregar {o.rotulo.toLowerCase()};
            </li>
            <li>ou manter o destino e descrever um objeto compatível com ele.</li>
          </ul>
        </Aviso>
      </div>
    );
  }
  if (c.situacao === "INDETERMINADO" || !o) {
    return (
      <Veredito tipo="bad" titulo="Objeto indeterminado">
        Não foi possível reconhecer o que a emenda entrega. Descreva o bem, o serviço ou a obra de forma mais concreta.
      </Veredito>
    );
  }

  const sinais = sinaisValor({
    classificacao: c,
    selecao: e.selecao,
    pretendido: lerNumero(e.pretendido),
    instrumento: e.instrumento,
    instrumentoOutro: e.instrumentoOutro,
    config: ctx.config,
    aplicado,
  });
  const natureza = c.gnd === "4" ? "capital" : "custeio";
  const elemTxt = ELEMENTOS[o.elemento] ?? o.elemento;
  const parcela = parcelaDaDotacao(d.dotacao);

  return (
    <div className="grid gap-3">
      {sit === "OK" && d.dotacao ? (
        <>
          <Veredito tipo="ok" titulo={manual ? "Dotação escolhida" : "Dotação encontrada"}>
            {manual ? `Escolha registrada entre as ${c.opcoes.length} dotações compatíveis.` : `Uma dotação da ${rotuloBase} comporta este objeto neste destino.`}
          </Veredito>
          {avisoObra}
          <LinhaDotacao d={d.dotacao} selo={manual ? "escolhida pelo proponente" : "selecionada pelo sistema"} unidade={nomeSeVarias(d.dotacao.uo)}>
            {manual ? (
              <Button variant="surface" size="sm" className="mt-2.5" onClick={() => atualizar({ selecao: { escolha: null, dotacaoId: null } })}>
                Rever as outras {c.opcoes.length - 1} compatíveis
              </Button>
            ) : null}
          </LinhaDotacao>
        </>
      ) : null}

      {c.situacao === "VALIDAR" && sit !== "OK" ? (
        <>
          <Veredito
            tipo="warn"
            titulo={
              c.semAderencia ? "Nenhuma ação corresponde ao objeto" : c.naoReconhecido ? "Objeto não reconhecido" : "Mais de uma dotação comporta este objeto"
            }
          >
            {c.semAderencia ? (
              c.opcoes.length ? (
                <>
                  Existem {c.opcoes.length} dotações da unidade com o elemento de despesa do objeto, mas <b>nenhuma delas trata do que a emenda entrega</b>.
                  O sistema não enquadra por semelhança de natureza. Reescreva o objeto, indique outro destino, ou escolha assumindo a responsabilidade
                  pelo enquadramento.
                </>
              ) : (
                <>
                  <b>Nenhuma dotação da unidade tem relação com o objeto</b> nem o elemento de despesa que ele pede. O sistema não oferece candidatas
                  sem relação. Reescreva o objeto, indique outro destino, ou deixe a definição para a análise técnica.
                </>
              )
            ) : c.naoReconhecido ? (
              <>
                O sistema identificou apenas que a despesa é de <b>{natureza}</b> — não reconheceu <i>o que</i> a emenda entrega, então não pode escolher a
                dotação por você. Reescreva o objeto de forma mais concreta, ou escolha entre as {c.opcoes.length} dotações da unidade que aceitam despesa
                desta natureza.
              </>
            ) : (
              <>
                {c.opcoes.length} dotações da LOA aceitam o objeto, o destino e a natureza da despesa. Escolha qual usar — todas são válidas — ou deixe a
                definição para a análise técnica.
              </>
            )}
          </Veredito>
          {avisoObra}
          {c.naoReconhecido || c.semAderencia ? (
            <p className="text-xs text-muted-foreground">Ex.: em vez de “material”, diga “material escolar” ou “material hospitalar”.</p>
          ) : null}
          {e.selecao.escolha === "ANALISE_TECNICA" ? (
            <Aviso tipo="info">
              A definição da dotação ficou com a <b>análise técnica</b>. Você pode seguir para o plano de trabalho.{" "}
              {c.opcoes.length ? (
                <button type="button" className="font-bold text-navy underline-offset-2 hover:underline" onClick={() => atualizar({ selecao: { escolha: null, dotacaoId: null } })}>
                  Escolher uma dotação
                </button>
              ) : null}
            </Aviso>
          ) : !c.opcoes.length ? null : (
            <div className="overflow-hidden rounded-box bg-soft">
              <div className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                {c.naoReconhecido || c.semAderencia ? (
                  <>
                    Dotações da unidade que aceitam despesa de {natureza} — <b className="text-ink">nenhuma foi verificada contra o objeto</b>
                  </>
                ) : (
                  <>
                    Dotações compatíveis — <b className="text-ink">escolha uma</b>
                  </>
                )}
              </div>
              {c.unidadesAlvo.length > 1 ? (
                // Destino que cobre o órgão inteiro: as opções vêm agrupadas por unidade (setor).
                <div className="grid gap-2 px-3">
                  {c.unidadesAlvo
                    .map((uo) => ({ uo, itens: c.opcoes.map((x, i) => ({ x, i })).filter(({ x }) => x.uo === uo) }))
                    .filter((g) => g.itens.length)
                    .map((g, gi) => (
                      <details key={g.uo} open={gi === 0} className="group rounded-box bg-surface">
                        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
                          <span className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
                          {g.uo} — {(ctx.catalogo.unidades[g.uo] ?? "").split(" — ").pop()}
                          <span className="ml-auto text-xs font-semibold text-muted-foreground">
                            {g.itens.length} {g.itens.length === 1 ? "dotação" : "dotações"}
                          </span>
                        </summary>
                        <div className="grid gap-2.5 px-3 pb-3">
                          {g.itens.map(({ x, i }) => (
                            <LinhaDotacao key={x.id} d={x} selo={`candidata ${letraCandidata(i)}`} ambar>
                              <Button
                                size="sm"
                                className="mt-2.5"
                                onClick={() => {
                                  atualizar({ selecao: { escolha: "PROPONENTE", dotacaoId: x.id } });
                                  toast(`Dotação escolhida: ${x.codigo}.`);
                                }}
                              >
                                Usar esta dotação
                              </Button>
                            </LinhaDotacao>
                          ))}
                        </div>
                      </details>
                    ))}
                </div>
              ) : (
                <div className="grid gap-2.5 px-3">
                  {c.opcoes.map((x, i) => (
                    <LinhaDotacao key={x.id} d={x} selo={`candidata ${letraCandidata(i)}`} ambar unidade={nomeSeVarias(x.uo)}>
                      <Button
                        size="sm"
                        className="mt-2.5"
                        onClick={() => {
                          atualizar({ selecao: { escolha: "PROPONENTE", dotacaoId: x.id } });
                          toast(`Dotação escolhida: ${x.codigo}.`);
                        }}
                      >
                        Usar esta dotação
                      </Button>
                    </LinhaDotacao>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-4">
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => {
                    atualizar({ selecao: { escolha: "ANALISE_TECNICA", dotacaoId: null } });
                    toast("A análise técnica definirá a dotação.");
                  }}
                >
                  Deixar a análise técnica decidir
                </Button>
                <span className="text-xs text-muted-foreground">
                  {c.naoReconhecido ? "O termo fica registrado para a curadoria da biblioteca de objetos." : "A escolha fica registrada em seu nome no histórico da emenda."}
                </span>
              </div>
            </div>
          )}
        </>
      ) : null}

      {c.situacao === "OBICE" ? (
        <>
          <Veredito tipo="bad" titulo="Nenhuma dotação comporta este objeto">
            {c.estrito && !c.uoAlvo
              ? `A ${rotuloBase} não tem, em ${c.uoAreaNome}, dotação de ${c.gnd === "4" ? "investimento" : "custeio"} por transferência a entidade sem fins lucrativos.`
              : c.uoAlvo
                ? `A ${rotuloBase} não tem, em ${c.destino.nome}, dotação de ${c.gnd === "4" ? "investimento" : "custeio"} por aplicação direta.`
                : `A ${rotuloBase} não tem dotação de ${c.gnd === "4" ? "investimento" : "custeio"} por transferência a entidade sem fins lucrativos compatível com este objeto.`}
          </Veredito>
          <Aviso tipo="bad" titulo="Potencial óbice de natureza orçamentário-financeira">
            <p>
              Código-base requerido: <b>{c.base}</b> · elemento {elemTxt}
              {c.subfuncao ? ` · subfunção ${c.subfuncao}` : ""}. Nenhuma linha da LOA atende a essa combinação nesta unidade.
            </p>
            {c.proximas.length ? (
              <>
                <p className="mt-2 font-bold">Dotações mais próximas</p>
                <ul className="list-disc pl-5">
                  {c.proximas.map((x) => (
                    <li key={x.id}>
                      {x.codigo} — {x.nome} · {x.gnd}.{x.gnd}.{x.mod}.{x.elem} · {x.uo} · autorizado {BRL(x.autorizado)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="mt-2">
              <b>O que você pode fazer:</b> ajustar o objeto para algo que caiba numa dessas linhas, indicar outra unidade beneficiária, ou pedir ao
              Executivo a inclusão de ação por alteração da LOA.
            </p>
          </Aviso>
        </>
      ) : null}

      {sinais.length ? (
        <Sinalizacoes
          sinais={sinais}
          ajustarAoAutorizado={
            d.dotacao && d.dotacao.autorizado > 0
              ? {
                  valor: d.dotacao.autorizado,
                  aplicar: () => {
                    atualizar({ pretendido: formatarNumero(d.dotacao!.autorizado, 2, "R$ ") });
                    toast("Valor da emenda ajustado ao autorizado da dotação.");
                  },
                }
              : undefined
          }
        />
      ) : null}

      {c.situacao !== "OBICE" && d.dotacao ? <Camadas c={c} dot={d.dotacao} ctx={ctx} /> : null}
      <Matriz gnd={c.gnd} mod={c.mod} elemento={elemTxt} requerido={c.situacao === "OBICE"} />

      <Detalhes titulo="Por que esta classificação">
        <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-2 text-sm max-sm:grid-cols-1">
          <Par k="Objeto reconhecido">
            {o.rotulo}
            <Mini>
              {o.explicacao}
              {o.confianca === "inferido" ? " · sem termo na biblioteca" : ""}
            </Mini>
          </Par>
          <Par k="Natureza">{o.natureza === "CAPITAL" ? "Investimento (GND 4)" : "Custeio (GND 3)"}</Par>
          <Par k="Execução">
            {c.mod === "90" ? "Direta — aplicação direta (modalidade 90)" : "Indireta — transferência a instituição privada sem fins lucrativos (modalidade 50)"}
          </Par>
          <Par k="Código-base">
            <b>{c.base}</b>
            <Mini>elemento provável {elemTxt}</Mini>
          </Par>
          <Par k={c.uoAlvo ? "Unidade pesquisada" : "Secretaria do repasse"}>
            {c.uoAlvo
              ? `${c.uoAlvo} — ${nomeDoAlcance(c.uoAlvo, ctx.catalogo.unidades) ?? ""}`
              : d.dotacao && sit === "OK"
                ? `${d.dotacao.uo} — ${ctx.catalogo.unidades[d.dotacao.uo] ?? ""}`
                : `deduzida do objeto — ${o.area ?? "área não identificada"}`}
            {!c.uoAlvo ? <Mini>deduzida do objeto ({o.area ?? "área não identificada"}), não do cadastro da entidade</Mini> : null}
          </Par>
          <Par k="Dotações examinadas">
            {ctx.loa.length} linhas da LOA · {c.candidatas.length} compatíve{c.candidatas.length === 1 ? "l" : "is"}
            {c.estrito ? (
              <Mini>
                busca restrita a {o.area}: objeto desta natureza não cabe em dotação de outra área
                {c.elementoRestringiu ? `; ao elemento ${o.elemento}` : ""}
                {c.subfuncaoRestringiu ? `; e à subfunção ${c.subfuncao}` : ""}
              </Mini>
            ) : null}
          </Par>
          {parcela ? (
            <Par k="Parcela da cota">
              {parcela === "SAUDE" ? "Saúde" : "Demais áreas"}
              <Mini>
                decidida pelo identificador de custo IC-CO {parcela === "SAUDE" ? "1002 — ações e serviços públicos de saúde" : "diverso de 1002"}; é
                consequência do enquadramento, não há escolha do proponente
              </Mini>
            </Par>
          ) : null}
          {lerNumero(e.pretendido) > 0 ? (
            <Par k="Valor da emenda">
              {BRL(lerNumero(e.pretendido))}
              <Mini>informado no passo 1 — a planilha do passo 2 comprova esse valor</Mini>
            </Par>
          ) : null}
          {c.situacao === "OK" ? <Par k="Aderência">{c.porQue}</Par> : null}
          {manual ? (
            <Par k="Quem escolheu">
              O proponente, entre {c.opcoes.length} dotações compatíveis
              <Mini>o sistema ofereceu apenas dotações válidas para este objeto; a escolha fica no histórico</Mini>
            </Par>
          ) : null}
          {c.situacao === "VALIDAR" && !manual ? <Par k="Por que não decidiu">{c.motivo}</Par> : null}
          {o.confianca === "inferido" ? (
            <Par k="Reconhecimento">
              Nenhum termo da biblioteca casou com o texto
              <Mini>só a natureza da despesa foi deduzida; o enquadramento depende de escolha humana</Mini>
            </Par>
          ) : null}
        </dl>
      </Detalhes>
    </div>
  );
}

const Par = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <>
    <dt className="font-semibold text-muted-foreground">{k}</dt>
    <dd className="max-sm:mb-1.5">{children}</dd>
  </>
);
const Mini = ({ children }: { children: React.ReactNode }) => <span className="mt-0.5 block text-xs text-muted-foreground">{children}</span>;

// As três camadas da classificação: A e B saem da dotação; C, da
// parametrização do exercício.
function Camadas({ c, dot, ctx }: { c: Classificacao; dot: Candidata; ctx: ContextoEmenda }) {
  const au = audesp(ctx.config);
  const ic = derivaIcCo(dot);
  const ep = derivaIcEp(ctx.config);
  const el = ELEMENTOS[dot.elem]?.split(" — ")[1] ?? dot.elem;
  void c;
  return (
    <Detalhes titulo="Classificação orçamentária">
      <div className="grid gap-4 text-sm">
        <Camada titulo="Camada A · funcional, programática e fonte — da dotação da LOA">
          <Par k="Órgão e unidade">
            {dot.uo} — {ctx.catalogo.unidades[dot.uo]}
          </Par>
          <Par k="Funcional">
            {dot.funcao}.{dot.subf} — {dot.subfn}
          </Par>
          <Par k="Programa e ação">
            {dot.prog} · {dot.codigo} — {dot.nome}
          </Par>
          <Par k="Fonte">
            {dot.fonte} — {dot.fonten}
            <Mini>atributo da dotação, não identificador da emenda</Mini>
          </Par>
        </Camada>
        <Camada titulo="Camada B · natureza da despesa — da dotação da LOA">
          <Par k="Código completo">
            {dot.gnd}.{dot.gnd}.{dot.mod}.{dot.elem}
          </Par>
          <Par k="Categoria e GND">{dot.gnd === "4" ? "Despesas de capital · Investimentos" : "Despesas correntes · Outras despesas correntes"}</Par>
          <Par k="Modalidade">
            {dot.mod} — {dot.mod === "50" ? "transferência a instituição privada sem fins lucrativos" : "aplicações diretas"}
          </Par>
          <Par k="Elemento">
            {dot.elem} — {el}
          </Par>
        </Camada>
        <Camada titulo="Camada C · identificadores da emenda — da parametrização do exercício">
          {!au ? (
            <Par k="Parâmetros">
              <span className="text-warn">Exercício {ctx.config.exercicio} sem parametrização de emendas — fonte AUDESP e código de aplicação pendentes</span>
            </Par>
          ) : (
            <>
              <Par k="Fonte AUDESP">
                {au.fonte} — {au.nome}
                <Mini>codificação do AUDESP/TCE-SP, distinta da fonte da camada A</Mini>
              </Par>
              <Par k="Código de aplicação">{au.aplicacaoExibicao}</Par>
              <Par k="Variação">
                atribuída na submissão
                <Mini>sequencial da emenda no exercício</Mini>
              </Par>
              <Par k="IC-CO">
                {ic ? (
                  <>
                    {ic.codigo} — {ic.nome}
                    <Mini>derivado da função e da subfunção da dotação · é ele que decide a parcela da cota consumida</Mini>
                  </>
                ) : (
                  <span className="text-muted-foreground">não aplicável a esta funcional</span>
                )}
              </Par>
              <Par k="IC-EP">
                {ep ? (
                  `${ep.codigo} — ${ep.nome}`
                ) : (
                  <span className="text-muted-foreground">
                    sem vigência no exercício de {ctx.config.exercicio}
                    <Mini>a identificação por IC-EP vigora a partir de 2027 (art. 2º da Portaria STN/MF 636/2026)</Mini>
                  </span>
                )}
              </Par>
            </>
          )}
        </Camada>
        <p className="text-xs text-muted-foreground">
          Nenhum destes códigos está fixo no sistema: todos vêm da parametrização do exercício, porque as tabelas do AUDESP são revistas a cada ano.
        </p>
      </div>
    </Detalhes>
  );
}

function Camada({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="antena mb-2">{titulo}</div>
      <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-1.5 max-sm:grid-cols-1">{children}</dl>
    </div>
  );
}

function Matriz({ gnd, mod, elemento, requerido }: { gnd: string; mod: string; elemento: string; requerido: boolean }) {
  const ativo = `${gnd === "4" ? "4.4" : "3.3"}.${mod}`;
  const celulas: Record<string, [string, string]> = {
    "3.3.90": ["Outras Despesas Correntes", "aplicação direta"],
    "4.4.90": ["Investimentos", "aplicação direta"],
    "3.3.50": ["Outras Despesas Correntes", "transferência a instituição privada sem fins lucrativos"],
    "4.4.50": ["Investimentos", "transferência a instituição privada sem fins lucrativos"],
  };
  return (
    <Detalhes titulo="Natureza da despesa">
      <p className="mb-3 text-sm">
        <b>{mod === "90" ? "Execução direta (Poder Executivo)" : "Execução indireta (OSC/Terceiro Setor)"}</b> × <b>{gnd === "3" ? "custeio" : "investimento"}</b> →{" "}
        <b>{ativo}</b>
      </p>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-px overflow-hidden rounded-md bg-hair text-xs">
        <div className="bg-soft p-2" />
        <div className="bg-soft p-2 font-bold tracking-[0.04em]">CUSTEIO</div>
        <div className="bg-soft p-2 font-bold tracking-[0.04em]">INVESTIMENTO</div>
        {(
          [
            ["90", "Execução direta · Poder Executivo"],
            ["50", "Execução indireta · OSC / Terceiro Setor"],
          ] as const
        ).map(([m, rotulo]) => (
          <div key={m} className="contents">
            <div className="bg-soft p-2 font-bold">{rotulo}</div>
            {(["3.3", "4.4"] as const).map((g) => {
              const codigo = `${g}.${m}`;
              const on = codigo === ativo;
              return (
                <div key={codigo} className={cn("bg-surface p-2", on && (requerido ? "bg-bad-bg" : "bg-ok-bg"))}>
                  <div className="font-bold">{codigo}</div>
                  <div className="text-muted-foreground">
                    {celulas[codigo][0]} · {celulas[codigo][1]}
                  </div>
                  {on ? <div className="mt-1 font-bold">{requerido ? "requerido — sem dotação" : "aplicável a esta emenda"}</div> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">O elemento de despesa — {elemento} — vem da dotação da LOA, não desta matriz.</p>
    </Detalhes>
  );
}
