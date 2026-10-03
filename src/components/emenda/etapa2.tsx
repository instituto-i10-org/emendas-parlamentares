"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ContextoEmenda } from "@/lib/emendas/contexto";
import { formatarNumero, lerNumero, type EstadoEmenda, type ItemForm, type MetaForm } from "@/lib/emendas/estado";
import {
  BRL,
  EVENTOS,
  INSTRUMENTOS,
  MODELOS,
  NUM,
  PCT,
  QUADROS,
  QUADRO_INSTRUMENTO,
  ROTULO_RESULTADO,
  TIPOS_REFERENCIA,
  analisaItens,
  audesp,
  bloqueia,
  chaveQuadro,
  elementoDoInstrumento,
  eventosDe,
  metodoQuantidade,
  proximoCodigoReferencia,
  quantidadeSugerida,
  referenciaAntiga,
  referenciaCombina,
  unidadeDiverge,
  rotuloReferencia,
  type Instrumento,
  type ReferenciaPreco,
} from "@/lib/riep";
import { cn } from "@/lib/utils";
import type { Atualizar, DerivadoEmenda } from "./editor";
import { PesquisaPreco } from "./pesquisa-preco";
import { ReferenciaDialog } from "./referencia-dialog";
import { Ajuda, AreaTexto, Aviso, Campo, CampoNumero, Detalhes, Pilulas, Secao, Selo, TextoRico } from "./ui";

export function Etapa2({
  e,
  d,
  ctx,
  atualizar,
  autor,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  ctx: ContextoEmenda;
  atualizar: Atualizar;
  autor: string;
}) {
  const c = d.classificacao;
  const dot = d.dotacao;
  const m = d.modelo;
  if (!c || !dot || !m) return <p className="pb-7 text-sm text-muted-foreground">Rode a análise no passo 1 primeiro.</p>;
  const M = MODELOS[m];
  const au = audesp(ctx.config);
  const contextoIA = { objeto: e.objeto, destino: d.destino?.nome ?? "", execucao: e.execucao, exercicio: ctx.config.exercicio };

  return (
    <div className="flex flex-col pb-2">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-navy px-3.5 py-1.5 text-sm font-bold text-white">
          <i className="text-2xs font-semibold tracking-[0.08em] text-on-navy not-italic">MODELO</i> {M.numero} — {M.titulo}
        </span>
        {m === "TERCEIRO_SETOR" ? (
          <Ajuda titulo="Plano da parceria">
            O Plano de Trabalho da parceria, do art. 22 da Lei 13.019/2014, é documento distinto: quem o elabora é a entidade, na fase de celebração.
          </Ajuda>
        ) : null}
      </div>

      <Detalhes titulo="Dados da emenda — vêm do passo 1">
        <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-1.5 text-sm max-sm:grid-cols-1">
          <dt className="text-muted-foreground">Autor</dt>
          <dd>{autor}</dd>
          <dt className="text-muted-foreground">Beneficiário</dt>
          <dd>{d.destino?.nome}</dd>
          <dt className="text-muted-foreground">Objeto</dt>
          <dd>{e.objeto}</dd>
          <dt className="text-muted-foreground">Endereço do local</dt>
          <dd>{e.endereco || "—"}</dd>
          <dt className="text-muted-foreground">Dotação</dt>
          <dd>
            {dot.codigo} — {dot.nome}
            <br />
            {dot.uo} · {dot.funcao}.{dot.subf} · programa {dot.prog}
          </dd>
          <dt className="text-muted-foreground">Natureza da despesa</dt>
          <dd>
            {dot.gnd === "4" ? "Despesa de capital" : "Despesa corrente"} — {dot.gnd}.{dot.gnd}.{dot.mod}.{dot.elem}
          </dd>
          <dt className="text-muted-foreground">Fonte</dt>
          <dd>{dot.fonte}</dd>
          {au ? (
            <>
              <dt className="text-muted-foreground">AUDESP</dt>
              <dd>
                fonte {au.fonte} · aplicação {au.aplicacaoExibicao}
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Valor pretendido</dt>
          <dd>{lerNumero(e.pretendido) > 0 ? BRL(lerNumero(e.pretendido)) : "não informado"}</dd>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Para mudar qualquer linha deste quadro, volte ao passo 1 e reclassifique.</p>
      </Detalhes>

      <div className="mt-6 grid gap-5">
        <Campo
          rotulo="Agente executor"
          obrigatorio
          ajuda={
            e.execucao === "INDIRETA"
              ? "Execução indireta: quem executa é a entidade parceira; o repasse sai da unidade da dotação."
              : "Execução direta: quem executa é a unidade orçamentária da dotação."
          }
        >
          <div className="flex min-h-12 items-center rounded-field bg-soft px-3.5 text-sm font-semibold">
            {e.agenteExecutor || <span className="text-muted-foreground">Definido após a análise da etapa 1.</span>}
          </div>
        </Campo>

        <Campo rotulo="Justificativa da emenda" obrigatorio htmlFor="f-just" contador={{ atual: e.justificativa.length, max: 2000 }}>
          <AreaTexto
            id="f-just"
            valor={e.justificativa}
            aoMudar={(v) => atualizar({ justificativa: v })}
            max={2000}
            campo="justificativa"
            placeholder="Por que ela é necessária"
            contexto={contextoIA}
          />
        </Campo>
      </div>

      <Metas e={e} d={d} atualizar={atualizar} contextoIA={contextoIA} />
      <MemoriaCalculo e={e} d={d} ctx={ctx} atualizar={atualizar} orientacao={M.cotacao} />
      <Viabilidade e={e} d={d} atualizar={atualizar} contextoIA={contextoIA} />
      <Etapas e={e} atualizar={atualizar} sugestao={M.etapas} />
      <Cronograma e={e} valor={d.valor} atualizar={atualizar} />
    </div>
  );
}

// ------------------------------------------------------------------- metas

function Metas({
  e,
  d,
  atualizar,
  contextoIA,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  atualizar: Atualizar;
  contextoIA: { objeto: string; destino: string; execucao: "DIRETA" | "INDIRETA" };
}) {
  const pl = d.metaPlanejamento;
  const mq = metodoQuantidade({
    classificacao: d.classificacao,
    dotacao: d.dotacao,
    meta: pl,
    destino: d.destino,
    valor: d.valor,
    pretendido: lerNumero(e.pretendido),
  });
  const sugerida = quantidadeSugerida(mq);
  const v = d.valor > 0 ? d.valor : lerNumero(e.pretendido);
  const eventos = eventosDe(d.dotacao);
  const evento = e.evento && eventos.includes(e.evento) ? e.evento : eventos[0];

  const mudarMeta = (i: number, parcial: Partial<MetaForm>) =>
    atualizar((x) => ({ metas: x.metas.map((mt, j) => (j === i ? { ...mt, ...parcial } : mt)) }));

  function usarSugestao() {
    if (!pl) return;
    atualizar((x) => {
      const metas = x.metas.length ? [...x.metas] : [{ beneficiarios: "", unidade: "", quantidade: "" }];
      const primeira = { ...metas[0] };
      if (!primeira.beneficiarios.trim() && pl.publico) primeira.beneficiarios = pl.publico;
      primeira.unidade = pl.unidade ?? primeira.unidade;
      primeira.quantidade = sugerida && sugerida >= 1 ? formatarNumero(Math.round(sugerida), 0) : "";
      metas[0] = primeira;
      return { metaFinalistica: pl.produto, metas };
    });
    toast("Preenchido a partir das peças — confira e ajuste se precisar.");
  }

  return (
    <Secao
      titulo="Metas"
      ajuda="Quem será atendido e quanto será entregue. Sem meta física e sem forma de comprovação a linha não serve para prestar contas."
    >
      {pl ? (
        <div className="caixa mb-4 rounded-box bg-info-bg p-4">
          <div className="mb-2 antena">Sugestão de metas</div>
          <Detalhes titulo="Referências do PPA e da LDO">
            <dl className="grid grid-cols-[minmax(120px,auto)_1fr] gap-x-4 gap-y-1.5 text-sm max-sm:grid-cols-1">
              <dt className="text-muted-foreground">PPA</dt>
              <dd>{pl.produto}</dd>
              <dt className="text-muted-foreground">Público-alvo</dt>
              <dd>{pl.publico ?? "—"}</dd>
              <dt className="text-muted-foreground">Unidade</dt>
              <dd>{pl.unidade ?? "—"}</dd>
              <dt className="text-muted-foreground">Meta do PPA</dt>
              <dd>
                {NUM(pl.quantidadePpa)} {pl.unidade} <span className="text-muted-foreground">no quadriênio</span>
              </dd>
              <dt className="text-muted-foreground">LDO</dt>
              <dd>{pl.notaLdo}</dd>
              <dt className="text-muted-foreground">Meta do exercício</dt>
              <dd>
                {NUM(pl.quantidadeExercicio)} {pl.unidade}
              </dd>
            </dl>
          </Detalhes>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">
              {sugerida == null
                ? "Sem quantidade sugerida. Informe a meta física."
                : sugerida < 1
                  ? "Esta emenda equivale a menos de 1 unidade da meta do PPA. Informe a meta física."
                  : `Meta sugerida: ${NUM(Math.round(sugerida))}`}
            </p>
            <Button size="sm" onClick={usarSugestao}>
              Usar sugestão
            </Button>
          </div>
          {mq ? <ContaSugestao mq={mq} /> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Preenche a redação, o público-alvo e a unidade. Os números do quadro são do programa inteiro — a emenda entrega uma fração deles. Tudo
            fica editável.
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-box bg-warn-bg p-4 text-sm">
          <div className="mb-1 antena text-warn">Sem meta vinculada</div>
          <p className="font-bold">A ação {d.dotacao?.codigo} não tem meta vinculada no PPA nem prioridade correspondente na LDO importados para o exercício.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pendência de importação, registrada e nomeada. O campo de meta segue livre — o sistema não presume meta.
            {mq && mq.metodo === "populacao_referencia" && !mq.falta
              ? ` Ainda assim, o cadastro do destino informa ${NUM(mq.beneficiarios)} como população de referência (${mq.fonte}, ${mq.data}).`
              : ""}
          </p>
        </div>
      )}

      <Tabela
        cabecalho={[
          ["Beneficiários *", ""],
          ["Unidade *", ""],
          ["Meta física *", "text-right"],
        ]}
        linhas={e.metas.map((mt, i) => [
          <input
            key="b"
            className="campo h-10 px-3"
            placeholder="Quem será atendido"
            value={mt.beneficiarios}
            onChange={(ev) => mudarMeta(i, { beneficiarios: ev.target.value })}
          />,
          <input key="u" className="campo h-10 px-3" placeholder="unidade" value={mt.unidade} onChange={(ev) => mudarMeta(i, { unidade: ev.target.value })} />,
          <CampoNumero key="q" className="h-10 px-3 text-right" casas={2} completar={false} valor={mt.quantidade} aoMudar={(q) => mudarMeta(i, { quantidade: q })} />,
        ])}
        aoRemover={(i) => atualizar((x) => ({ metas: x.metas.length > 1 ? x.metas.filter((_, j) => j !== i) : [{ beneficiarios: "", unidade: "", quantidade: "" }] }))}
        aoAdicionar={(i) =>
          atualizar((x) => {
            const metas = [...x.metas];
            metas.splice(i + 1, 0, { beneficiarios: "", unidade: "", quantidade: "" });
            return { metas };
          })
        }
      />
      {d.dotacao && v > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {BRL(v)} — {d.dotacao.autorizado ? <><b className="text-ink">{PCT((v / d.dotacao.autorizado) * 100)}</b> da dotação autorizada da ação.</> : "dotação autorizada não informada na carga."}
        </p>
      ) : null}

      {evento ? (
        <div className="mt-4 rounded-box bg-soft p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="antena">Comprovação da meta</span>
            {eventos.length === 1 ? <span className="text-sm font-bold">{EVENTOS[evento].nome}</span> : null}
          </div>
          {eventos.length > 1 ? (
            <Pilulas
              rotulo="Evento que encerra a meta"
              opcoes={eventos}
              valor={evento}
              curto={(k) => EVENTOS[k].nome}
              aoEscolher={(k) => atualizar({ evento: k })}
            />
          ) : null}
          <p className="mt-2 text-sm">
            <TextoRico texto={EVENTOS[evento].frase} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ato do Poder Executivo, praticado na execução · registro em {EVENTOS[evento].onde}. O plano não pede documento ao proponente.
          </p>
        </div>
      ) : null}

      <Campo
        rotulo="Meta finalística"
        obrigatorio
        htmlFor="f-finalistica"
        className="mt-4"
        ajuda="Uma linha, sobre o resultado — não sobre a entrega. A entrega já está nas metas físicas acima."
      >
        <AreaTexto
          id="f-finalistica"
          valor={e.metaFinalistica}
          aoMudar={(v2) => atualizar({ metaFinalistica: v2 })}
          max={500}
          campo="finalistica"
          linhaUnica
          placeholder="o resultado que a emenda pretende alcançar"
          contexto={contextoIA}
        />
      </Campo>
    </Secao>
  );
}

function ContaSugestao({ mq }: { mq: NonNullable<ReturnType<typeof metodoQuantidade>> }) {
  return (
    <div className="mt-3 rounded-md bg-surface p-3 text-xs leading-relaxed">
      <Selo tipo="info">{mq.metodo === "proporcao_valor" ? "objeto divisível · proporção pelo valor" : "objeto indivisível · população de referência"}</Selo>
      <div className="mt-2">
        {mq.falta ? (
          <>
            <b>Sem sugestão:</b> {mq.pendencia}. O campo fica livre e o sistema não presume número.
          </>
        ) : mq.metodo === "proporcao_valor" ? (
          <>
            <i>custo unitário médio da ação</i> = {BRL(mq.dotacao.autorizado)} ÷ {NUM(mq.meta.quantidadeExercicio)} {mq.meta.unidade} ={" "}
            <b>{BRL(mq.custoMedio)}</b> por {mq.meta.unidade}
            <br />
            {mq.quantidade ? (
              <>
                <i>quantidade sugerida</i> = {BRL(mq.valor)} ÷ {BRL(mq.custoMedio)} ={" "}
                <b>
                  {NUM(Math.round(mq.quantidade))} {mq.meta.unidade}
                </b>
              </>
            ) : (
              <i>Informe o valor pretendido ou lance a memória de cálculo para o sistema sugerir a quantidade.</i>
            )}
            <span className="mt-1.5 block text-muted-foreground">Custo unitário médio da ação — não é preço do item, e não entra na memória de cálculo.</span>
          </>
        ) : (
          <>
            <i>beneficiários</i> = população de referência do destino = <b>{NUM(mq.beneficiarios)}</b>
            <br />
            <i>fonte</i>: {mq.fonte} · atualizado em {mq.data}
            <span className="mt-1.5 block text-muted-foreground">
              Bem indivisível: o alcance não é proporcional ao valor — quem recebe o bem é a unidade inteira.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------- memória de cálculo

function MemoriaCalculo({
  e,
  d,
  ctx,
  atualizar,
  orientacao,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  ctx: ContextoEmenda;
  atualizar: Atualizar;
  orientacao: string;
}) {
  const [novaRefPara, setNovaRefPara] = useState<number | null>(null);
  const [quadroAberto, setQuadroAberto] = useState(false);
  const biblioteca = ctx.catalogo.objetos;
  const itensNum = e.itens.map((i) => ({
    descricao: i.descricao,
    quantidade: lerNumero(i.quantidade),
    valorUnitario: lerNumero(i.valorUnitario),
    referencia: i.referencia,
  }));
  const ac = analisaItens({
    classificacao: d.classificacao,
    dotacao: d.dotacao,
    itens: itensNum,
    biblioteca,
    percentualAcessorio: ctx.config.percentualAcessorio,
  });
  const resultadoLinha = (i: number) => ac?.linhas.find((l) => l.indice === i) ?? null;
  const ref = (cod: string | null) => (cod ? e.referencias.find((r) => r.codigo === cod) ?? null : null);
  const pretendido = lerNumero(e.pretendido);

  const mudarItem = (i: number, parcial: Partial<ItemForm>) =>
    atualizar((x) => ({ itens: x.itens.map((it, j) => (j === i ? { ...it, ...parcial } : it)) }));

  function registrarReferencia(r: ReferenciaPreco, linha: number | null) {
    atualizar((x) => ({
      referencias: [...x.referencias, r],
      itens: linha === null ? x.itens : x.itens.map((it, j) => (j === linha ? { ...it, referencia: r.codigo } : it)),
    }));
  }

  const problemas = ac?.linhas.filter((l) => bloqueia(l.resultado)) ?? [];
  const acessorios = ac?.linhas.filter((l) => l.resultado === "acessorio") ?? [];
  const mudos = ac?.linhas.filter((l) => !l.resultado) ?? [];
  const divergencia = pretendido > 0 && d.valor > 0 ? d.valor - pretendido : 0;
  const foraTolerancia = pretendido > 0 && d.valor > 0 && (Math.abs(divergencia) / pretendido) * 100 > ctx.config.toleranciaValorPct;

  return (
    <Secao titulo="Memória de cálculo" ajuda="As mesmas linhas das metas, agora com preço. Toda linha precisa apontar de onde veio o valor.">
      <PesquisaPreco
        objeto={e.objeto}
        exercicio={ctx.config.exercicio}
        orientacao={orientacao}
        aoAprovar={(p, unidade, consulta) => {
          const agora = new Date();
          atualizar((x) => {
            const codigo = proximoCodigoReferencia(x.referencias);
            const r: ReferenciaPreco = {
              codigo,
              tipo: p.tipo,
              campos:
                p.tipo === "TABELA_OFICIAL"
                  ? { sistema: p.fonte, composicao: p.identificacao, databse: p.periodo ?? "Não informada", deson: p.fonte }
                  : { consulta: p.identificacao, recorte: p.periodo ?? "Período não informado", amostra: p.amostra ? String(p.amostra) : "Não informada" },
              emissor: p.fonte,
              data: null,
              dataTexto: p.periodo ?? "Não informada",
              unidade,
              valor: p.preco,
              objeto: p.descricao,
              porte: p.amostra ? `${p.amostra} compras` : "Não informado",
              link: p.url,
              observacao: `Consulta: ${consulta} · realizada em ${new Date(p.consultadoEm).toLocaleString("pt-BR")}`,
              procedencia: "CONFERIDA",
              aprovadoPor: "proponente",
              aprovadoEm: agora.toISOString(),
              origemExterna: "PNIGP",
              consultadoEm: p.consultadoEm,
            };
            // Linha vazia intocada é substituída pelo item aprovado.
            const itens = x.itens.filter((it) => it.descricao.trim() || lerNumero(it.valorUnitario));
            return {
              referencias: [...x.referencias, r],
              itens: [...itens, { descricao: p.descricao, unidade, quantidade: "1", valorUnitario: formatarNumero(p.preco, 2), referencia: codigo }],
            };
          });
        }}
      />

      <div className="mt-4">
        <Tabela
          cabecalho={[
            ["Item *", ""],
            ["Un.", "w-[96px]"],
            ["Qtd *", "text-right w-[90px]"],
            ["Valor unitário *", "text-right w-[140px]"],
            ["Valor total", "text-right w-[120px]"],
            ["Origem do preço *", "w-[220px]"],
          ]}
          linhas={e.itens.map((it, i) => {
            const L = resultadoLinha(i);
            const r = ref(it.referencia);
            const total = lerNumero(it.quantidade) * lerNumero(it.valorUnitario);
            return [
              <div key="d">
                <input
                  className={cn("campo h-10 px-3", L && bloqueia(L.resultado) && "border-bad bg-bad-bg")}
                  placeholder="Item"
                  value={it.descricao}
                  onChange={(ev) => mudarItem(i, { descricao: ev.target.value })}
                />
                {L?.resultado ? (
                  <div className="mt-1">
                    <Selo tipo={bloqueia(L.resultado) ? "bad" : L.resultado === "acessorio" ? "info" : "ok"}>
                      {ROTULO_RESULTADO[L.resultado]}
                      {bloqueia(L.resultado) ? " · bloqueia" : ""}
                    </Selo>
                  </div>
                ) : null}
              </div>,
              <input
                key="u"
                className={cn("campo h-10 px-3", r && unidadeDiverge(it.unidade, r.unidade) && "border-warn")}
                placeholder={r?.unidade || "un."}
                aria-label="Unidade do item"
                maxLength={60}
                value={it.unidade}
                onChange={(ev) => mudarItem(i, { unidade: ev.target.value })}
              />,
              <CampoNumero key="q" className="h-10 px-3 text-right" casas={2} completar={false} valor={it.quantidade} aoMudar={(q) => mudarItem(i, { quantidade: q })} />,
              <CampoNumero key="v" className="h-10 px-3 text-right" valor={it.valorUnitario} aoMudar={(vu) => mudarItem(i, { valorUnitario: vu })} placeholder="0,00" />,
              <div key="t" className="pt-2.5 text-right text-sm font-bold tnum">
                {BRL(total)}
              </div>,
              <div key="o">
                <select
                  className="campo campo-select h-10 pr-9 pl-3"
                  value={it.referencia ?? ""}
                  onChange={(ev) => {
                    if (ev.target.value === "__nova") setNovaRefPara(i);
                    else mudarItem(i, { referencia: ev.target.value || null });
                  }}
                >
                  <option value="">sem referência…</option>
                  {e.referencias.map((x) => (
                    <option key={x.codigo} value={x.codigo}>
                      {rotuloReferencia(x)}
                    </option>
                  ))}
                  <option value="__nova">+ Nova referência…</option>
                </select>
                {r ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Selo tipo={r.procedencia === "CONFERIDA" ? "ok" : "info"}>{r.procedencia === "CONFERIDA" ? "conferida" : "informada"}</Selo>
                    {referenciaAntiga(r.data, ctx.config.validadeReferenciaMeses) ? (
                      <Selo tipo="warn">mais de {ctx.config.validadeReferenciaMeses} meses</Selo>
                    ) : null}
                    {!referenciaCombina(r, it.descricao, biblioteca) ? <Selo tipo="warn">objeto da referência diverge</Selo> : null}
                    {unidadeDiverge(it.unidade, r.unidade) ? <Selo tipo="warn">unidade da referência: {r.unidade}</Selo> : null}
                  </div>
                ) : null}
              </div>,
            ];
          })}
          aoRemover={(i) =>
            atualizar((x) => ({
              itens: x.itens.length > 1 ? x.itens.filter((_, j) => j !== i) : [{ descricao: "", unidade: "", quantidade: "1", valorUnitario: "", referencia: null }],
            }))
          }
          aoAdicionar={(i) =>
            atualizar((x) => {
              const itens = [...x.itens];
              itens.splice(i + 1, 0, { descricao: "", unidade: "", quantidade: "1", valorUnitario: "", referencia: null });
              return { itens };
            })
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hair pt-3">
        <span className="text-md font-bold">Valor da emenda</span>
        <span className="text-xs text-muted-foreground">
          Total dos itens
          {ac && !problemas.length
            ? ` · ${ac.linhas.length} linha${ac.linhas.length > 1 ? "s" : ""} · ${ac.linhas.filter((l) => l.resultado === "compativel").length} compatível(eis)` +
              (acessorios.length ? ` · ${acessorios.length} acessório(s) dentro do limite de ${ctx.config.percentualAcessorio}%` : "") +
              (mudos.length ? ` · ${mudos.length} não reconhecida(s) pela biblioteca` : "")
            : ""}
        </span>
        {e.referencias.length ? (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setQuadroAberto(true)}>
            Quadro de origem ({e.referencias.length})
          </Button>
        ) : null}
        <span className={cn("text-lg font-extrabold tnum", !e.referencias.length && "ml-auto")}>{BRL(d.valor)}</span>
      </div>

      {problemas.length ? (
        <div className="mt-3">
          <Aviso tipo="bad">
            {problemas.map((L) => (
              <p key={L.indice}>
                {L.principal ? <b>Item principal: </b> : null}«{L.descricao}» é{" "}
                {L.resultado === "nat"
                  ? `despesa de ${L.objeto?.natureza === "CAPITAL" ? "capital" : "custeio"} e a dotação é ${ac!.gnd === "4" ? "de capital" : "de custeio"} — ${ac!.gnd}.${ac!.gnd}.${d.dotacao!.mod}.${d.dotacao!.elem}`
                  : `despesa de ${L.objeto?.area} e o objeto da emenda é de ${ac!.area}`}
                .
              </p>
            ))}
            <p className="mt-1">
              Enquanto a linha permanecer, a emenda não pode ser submetida. Divergência de natureza ou de área não é atenuada pelo valor: retire o item,
              ou reescreva o objeto no passo 1 para a finalidade que ele serve.
            </p>
          </Aviso>
        </div>
      ) : null}
      {ac && !ac.entrega ? (
        <div className="mt-3">
          <Aviso tipo="warn">Nenhuma linha corresponde a «{ac.objeto?.rotulo}». A emenda entrega o objeto declarado?</Aviso>
        </div>
      ) : null}

      <div className="mt-3 text-xs text-muted-foreground">
        {!pretendido ? (
          "Nenhum valor pretendido informado no passo 1."
        ) : !d.valor ? (
          <>
            Valor pretendido no passo 1: <b className="text-ink">{BRL(pretendido)}</b>. Lance a memória de cálculo para o sistema reconciliar.
          </>
        ) : foraTolerancia ? (
          <div className="flex flex-wrap items-center gap-2 rounded-box bg-warn-bg p-3 text-sm text-warn">
            <span className="flex-1">
              {divergencia < 0 ? (
                <>
                  Faltam <b>{BRL(-divergencia)}</b> para chegar ao valor pretendido ({BRL(pretendido)}). Amplie o atendimento ou ajuste o valor.
                </>
              ) : (
                <>
                  A soma ficou <b>{BRL(divergencia)}</b> acima do valor pretendido ({BRL(pretendido)}).
                </>
              )}
            </span>
            {divergencia < 0 ? (
              <Button
                variant="surface"
                size="sm"
                onClick={() => atualizar((x) => ({ itens: [...x.itens, { descricao: "", unidade: "", quantidade: "1", valorUnitario: "", referencia: null }] }))}
              >
                <Plus /> Adicionar item
              </Button>
            ) : null}
            <Button
              variant="surface"
              size="sm"
              onClick={() => {
                atualizar({ pretendido: formatarNumero(d.valor, 2, "R$ ") });
                toast("Valor pretendido atualizado.");
              }}
            >
              Ajustar valor pretendido para {BRL(d.valor)}
            </Button>
          </div>
        ) : (
          `Dentro da tolerância de ${ctx.config.toleranciaValorPct}% em relação ao valor pretendido (${BRL(pretendido)}).`
        )}
      </div>

      <ReferenciaDialog
        aberto={novaRefPara !== null}
        codigo={proximoCodigoReferencia(e.referencias)}
        aoFechar={() => setNovaRefPara(null)}
        aoRegistrar={(r) => {
          registrarReferencia(r, novaRefPara);
          setNovaRefPara(null);
        }}
      />
      <QuadroOrigem aberto={quadroAberto} aoFechar={() => setQuadroAberto(false)} e={e} biblioteca={biblioteca} meses={ctx.config.validadeReferenciaMeses} />
    </Secao>
  );
}

function QuadroOrigem({
  aberto,
  aoFechar,
  e,
  biblioteca,
  meses,
}: {
  aberto: boolean;
  aoFechar: () => void;
  e: EstadoEmenda;
  biblioteca: ContextoEmenda["catalogo"]["objetos"];
  meses: number;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent titulo="Quadro de origem dos preços" descricao="Anexo do plano de trabalho — uma entrada por referência." largura="lg">
        <div className="grid gap-3">
          {e.referencias.map((r) => {
            const t = TIPOS_REFERENCIA[r.tipo];
            const usos = e.itens.filter((i) => i.referencia === r.codigo && i.descricao.trim()).map((i) => i.descricao.trim());
            const diverge = usos.filter((it) => !referenciaCombina(r, it, biblioteca));
            return (
              <div key={r.codigo} className="rounded-box bg-soft p-4 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2 font-bold">
                  {r.codigo} · {t.nome}
                  <Selo tipo={r.procedencia === "CONFERIDA" ? "ok" : "info"}>{r.procedencia === "CONFERIDA" ? "conferida" : "informada"}</Selo>
                </div>
                <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-1 max-sm:grid-cols-1">
                  {t.campos.map(([k, rot]) =>
                    r.campos[k] ? (
                      <div key={k} className="contents">
                        <dt className="text-muted-foreground">{rot}</dt>
                        <dd>{r.campos[k]}</dd>
                      </div>
                    ) : null
                  )}
                  <dt className="text-muted-foreground">Emissor</dt>
                  <dd>{r.emissor}</dd>
                  <dt className="text-muted-foreground">Data</dt>
                  <dd>
                    {r.data ? new Date(`${r.data}T12:00:00`).toLocaleDateString("pt-BR") : r.dataTexto}
                    {referenciaAntiga(r.data, meses) ? <span className="text-warn"> · mais de {meses} meses</span> : null}
                  </dd>
                  <dt className="text-muted-foreground">Objeto da referência</dt>
                  <dd>{r.objeto}</dd>
                  <dt className="text-muted-foreground">Unidade</dt>
                  <dd>{r.unidade}</dd>
                  <dt className="text-muted-foreground">Valor unitário</dt>
                  <dd>{BRL(r.valor)}</dd>
                  {r.porte ? (
                    <>
                      <dt className="text-muted-foreground">Porte na origem</dt>
                      <dd>{r.porte}</dd>
                    </>
                  ) : null}
                  {r.observacao ? (
                    <>
                      <dt className="text-muted-foreground">Observação</dt>
                      <dd>{r.observacao}</dd>
                    </>
                  ) : null}
                </dl>
                <p className="mt-2 text-xs">
                  Itens que a utilizam: {usos.length ? <b>{usos.join(" · ")}</b> : "nenhum ainda"}
                </p>
                {diverge.length ? (
                  <p className="mt-1 text-xs text-warn">
                    A referência é de «{r.objeto}» e o item é «{diverge[0]}» — confira se o preço é comparável, ou justifique na observação.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------- viabilidade

function Viabilidade({
  e,
  d,
  atualizar,
  contextoIA,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  atualizar: Atualizar;
  contextoIA: { objeto: string; destino: string; execucao: "DIRETA" | "INDIRETA" };
}) {
  const m = d.modelo!;
  if (m === "TERCEIRO_SETOR") {
    const opcoes = Object.keys(INSTRUMENTOS) as Instrumento[];
    const elemento = elementoDoInstrumento(e.instrumento, d.dotacao?.gnd ?? "3");
    return (
      <Secao titulo={QUADRO_INSTRUMENTO.titulo} ajuda={QUADRO_INSTRUMENTO.orientacao}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair pb-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            {QUADRO_INSTRUMENTO.pergunta}
          </span>
          <Pilulas
            rotulo={QUADRO_INSTRUMENTO.pergunta}
            opcoes={opcoes}
            valor={e.instrumento}
            curto={(k) => INSTRUMENTOS[k].curto}
            aoEscolher={(k) => {
              atualizar({ instrumento: k });
              const el = elementoDoInstrumento(k, d.dotacao?.gnd ?? "3");
              toast(el ? `Instrumento registrado — elemento ${el}.` : "Instrumento atípico — o elemento será definido pela análise técnica.");
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{QUADRO_INSTRUMENTO.ajuda}</p>
        {e.instrumento === "OUTRO" ? (
          <Campo
            rotulo="Especifique o instrumento"
            obrigatorio
            htmlFor="f-instr-outro"
            className="mt-4"
            dica="Descreva o ajuste pretendido. Enquanto não for especificado, o elemento fica pendente e a classificação permanece em amarelo."
          >
            <AreaTexto
              id="f-instr-outro"
              valor={e.instrumentoOutro}
              aoMudar={(v) => atualizar({ instrumentoOutro: v })}
              max={300}
              linhas={3}
              campo="instrumento"
              placeholder="ex.: acordo de cooperação, sem transferência de recursos"
              contexto={contextoIA}
            />
          </Campo>
        ) : null}
        {e.instrumento && elemento ? <p className="mt-3 text-sm">Elemento de despesa: <b>{elemento}</b></p> : null}
      </Secao>
    );
  }
  const Q = QUADROS[m];
  if (!Q) return null;
  return (
    <Secao titulo={Q.titulo} ajuda={Q.orientacao}>
      <div className="divide-y divide-hair">
        {Q.itens.map((it, i) => {
          const k = chaveQuadro(m, i);
          return (
            <div key={k} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-2 text-sm font-bold">
                {it.pergunta}
                {it.ajuda ? <AjudaCurta>{it.ajuda}</AjudaCurta> : null}
              </span>
              <Pilulas rotulo={it.pergunta} opcoes={it.opcoes} valor={e.quadro[k]} aoEscolher={(v) => atualizar((x) => ({ quadro: { ...x.quadro, [k]: v } }))} />
            </div>
          );
        })}
      </div>
    </Secao>
  );
}

function AjudaCurta({ children }: { children: string }) {
  return <span className="text-xs font-medium text-muted-foreground">— {children}</span>;
}

// ----------------------------------------------------------------- etapas

// Etapas em blocos ("A → B → C"). O texto guardado é a sequência com setas.
function Etapas({ e, atualizar, sugestao }: { e: EstadoEmenda; atualizar: Atualizar; sugestao: string }) {
  const [nova, setNova] = useState<string | null>(null);
  const etapas = e.etapas.split(/\s*→\s*/).map((s) => s.trim()).filter(Boolean);
  const gravar = (lista: string[]) => atualizar({ etapas: lista.join(" → "), etapasEditadas: true });
  const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <Secao titulo="Etapas" ajuda="Sequência sugerida pelo modelo. Ajuste se a execução desta emenda for diferente.">
      <div role="list" className="flex flex-wrap items-center gap-2">
        {etapas.map((s, i) => (
          <span key={`${s}-${i}`} role="listitem" className="contents">
            {i ? <span className="text-muted-foreground" aria-hidden>→</span> : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-3 bg-surface py-1.5 pr-1.5 pl-3 text-sm font-semibold">
              {maiuscula(s)}
              <button
                type="button"
                aria-label={`Remover etapa ${maiuscula(s)}`}
                onClick={() => gravar(etapas.filter((_, j) => j !== i))}
                className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-page hover:text-bad-ink"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </span>
        ))}
        {nova !== null ? (
          <input
            autoFocus
            className="campo h-9 w-44 rounded-full px-3"
            maxLength={80}
            placeholder="Nome da etapa"
            aria-label="Nome da nova etapa"
            value={nova}
            onChange={(ev) => setNova(ev.target.value)}
            onBlur={() => {
              if (nova.trim()) gravar([...etapas, nova.trim().replace(/→/g, "-")]);
              setNova(null);
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") ev.currentTarget.blur();
              if (ev.key === "Escape") setNova(null);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setNova("")}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3 py-1.5 text-sm font-bold text-ink hover:bg-soft"
          >
            <Plus className="size-4" /> Adicionar etapa
          </button>
        )}
      </div>
      {!etapas.length ? (
        <p className="mt-2 text-xs text-warn">
          Etapas em branco.{" "}
          <button type="button" className="font-bold underline-offset-2 hover:underline" onClick={() => atualizar({ etapas: sugestao, etapasEditadas: false })}>
            Restaurar a sugestão do modelo
          </button>
        </p>
      ) : null}
    </Secao>
  );
}

// ------------------------------------------------------------- cronograma

function Cronograma({ e, valor, atualizar }: { e: EstadoEmenda; valor: number; atualizar: Atualizar }) {
  const [quantidade, setQuantidade] = useState(String(e.parcelas.length || 1));
  const total = e.parcelas.reduce((s, p) => s + lerNumero(p), 0);
  const diferenca = Math.round((total - valor) * 100) / 100;

  function distribuir() {
    const n = Number(quantidade);
    const centavos = Math.round(valor * 100);
    if (centavos <= 0) return toast("Preencha a memória de cálculo para definir o valor da emenda.");
    if (!Number.isInteger(n) || n < 1 || n > 100) return toast("Informe de 1 a 100 parcelas.");
    if (n > centavos) return toast("Cada parcela precisa ter pelo menos R$ 0,01.");
    const base = Math.floor(centavos / n);
    const resto = centavos % n;
    atualizar({ parcelas: Array.from({ length: n }, (_, i) => formatarNumero((base + (i < resto ? 1 : 0)) / 100, 2)) });
  }

  return (
    <Secao titulo="Cronograma de desembolso previsto" ajuda="A soma tem de bater com o valor da emenda. As datas se definem na execução, não aqui.">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="n-parcelas" className="text-sm font-semibold text-label">
          Quantidade de parcelas
        </label>
        <input
          id="n-parcelas"
          inputMode="numeric"
          maxLength={3}
          className="campo h-12 w-20 px-3.5 tnum"
          value={quantidade}
          onChange={(ev) => setQuantidade(ev.target.value.replace(/\D/g, ""))}
        />
        <Button variant="ghost" onClick={distribuir}>
          Distribuir parcelas
        </Button>
      </div>
      {e.parcelas.length ? (
        <>
          <div className="mt-3 grid gap-2">
            {e.parcelas.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex-1 text-sm font-bold">{i + 1}ª parcela</span>
                <CampoNumero
                  className="h-10 max-w-[200px] px-3 text-right"
                  valor={p}
                  aoMudar={(v) => atualizar((x) => ({ parcelas: x.parcelas.map((q, j) => (j === i ? v : q)) }))}
                  placeholder="0,00"
                />
                <button
                  type="button"
                  aria-label="Remover parcela"
                  onClick={() => atualizar((x) => ({ parcelas: x.parcelas.filter((_, j) => j !== i) }))}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-page hover:text-bad-ink"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-hair pt-3">
            <span className="text-md font-bold">Total do cronograma</span>
            <span className={cn("text-xs", valor > 0 && diferenca !== 0 ? "font-bold text-bad-ink" : "text-muted-foreground")}>
              {valor === 0
                ? "informe o valor da emenda para conferir"
                : diferenca === 0
                  ? "confere com o valor da emenda"
                  : diferenca > 0
                    ? `excede em ${BRL(diferenca)}`
                    : `faltam ${BRL(-diferenca)}`}
            </span>
            <span className={cn("mr-11 ml-auto text-lg font-extrabold tnum", valor > 0 && diferenca !== 0 && "text-bad-ink")}>{BRL(total)}</span>
          </div>
        </>
      ) : null}
    </Secao>
  );
}

// ---------------------------------------------------------------- tabela

// Tabela editável: vira cartões no celular. Cada linha tem lixeira e "+".
function Tabela({
  cabecalho,
  linhas,
  aoRemover,
  aoAdicionar,
}: {
  cabecalho: [string, string][];
  linhas: React.ReactNode[][];
  aoRemover: (i: number) => void;
  aoAdicionar: (i: number) => void;
}) {
  return (
    <div className="overflow-x-auto max-sm:overflow-visible">
      <table className="w-full border-separate border-spacing-x-2 border-spacing-y-1.5 max-sm:block">
        <thead className="max-sm:hidden">
          <tr>
            {cabecalho.map(([t, cls]) => (
              <th key={t} className={cn("px-0 text-left text-2xs font-bold tracking-[0.04em] text-muted-foreground uppercase", cls)}>
                {t}
              </th>
            ))}
            <th className="w-[72px]" />
          </tr>
        </thead>
        <tbody className="max-sm:grid max-sm:gap-2.5">
          {linhas.map((cels, i) => (
            <tr key={i} className="align-top max-sm:grid max-sm:grid-cols-2 max-sm:gap-2.5 max-sm:rounded-box max-sm:bg-soft max-sm:p-3">
              {cels.map((cel, j) => (
                <td key={j} className="p-0 max-sm:first:col-span-2">
                  <span className="mb-1 hidden text-2xs font-bold tracking-[0.04em] text-muted-foreground uppercase max-sm:block">
                    {cabecalho[j][0].replace(" *", "")}
                  </span>
                  {cel}
                </td>
              ))}
              <td className="p-0 pt-1.5 whitespace-nowrap max-sm:col-span-2 max-sm:text-right">
                <button
                  type="button"
                  aria-label="Remover linha"
                  title="Remover linha"
                  onClick={() => aoRemover(i)}
                  className="inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-page hover:text-bad-ink"
                >
                  <Trash2 className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Adicionar linha abaixo"
                  title="Adicionar linha abaixo"
                  onClick={() => aoAdicionar(i)}
                  className="ml-1 inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-page hover:text-ink"
                >
                  <Plus className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
