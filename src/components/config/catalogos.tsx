"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DestinoDialog } from "@/components/emenda/destino-dialog";
import { mesclarDestinos } from "@/lib/actions/destinos";
import { consultarImpacto } from "@/lib/actions/impacto";
import { exigeCiencia, type Impacto } from "@/lib/impacto/tipos";
import { CorpoImpacto } from "@/components/app/confirmar-impacto";
import type { DestinoTela } from "@/lib/emendas/contexto";
import { possiveisDuplicados, type ParDuplicado } from "@/lib/emendas/beneficiarios";
import type { GrupoLegivel } from "@/lib/auditoria/legivel";
import { FormFiltros } from "@/components/app/form-filtros";
import { Cartao, TabelaDados } from "@/components/app/pagina";
import { FiltroLista } from "@/components/app/filtro-lista";
import { Campo, Pilulas, Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  alternarDestinoAtivo,
  alternarNormaAtiva,
  alternarObjetoAtivo,
  salvarNorma,
  definirPendenciaDestino,
  definirSubfuncaoDestino,
  salvarObjeto,
} from "@/lib/actions/config";
import { CampoArquivo, type ArquivoValor } from "@/components/app/campo-arquivo";
import { formatarCnpj } from "@/lib/cnpj";
import { BotaoAcao, useAcao } from "./comum";
import { ImportarPlanilha } from "./importar-planilha";

// ------------------------------------------------------------------ destinos

export type DestinoConfig = {
  id: string;
  nome: string;
  execucao: "DIRETA" | "INDIRETA";
  unidade: string | null;
  endereco: string;
  cnpj: string | null;
  origem: "BASE_OFICIAL" | "CADASTRO";
  ativo: boolean;
  pendencia: string | null;
  subfuncao: string | null;
  emendas: number;
  apelidos: string[];
  // Para editar pelo mesmo diálogo da tela da emenda (só os cadastrados).
  tela: DestinoTela | null;
};

// Subfunções que um equipamento público costuma sugerir (Portaria MOG 42/1999).
export const SUBFUNCOES_SUGERIDAS: [string, string][] = [
  ["", "Sem sugestão — o vereador escolhe"],
  ["301", "301 · Atenção básica"],
  ["302", "302 · Assistência hospitalar e ambulatorial"],
  ["303", "303 · Suporte profilático e terapêutico"],
  ["304", "304 · Vigilância sanitária"],
  ["305", "305 · Vigilância epidemiológica"],
  ["361", "361 · Ensino fundamental"],
  ["365", "365 · Educação infantil"],
  ["367", "367 · Educação especial"],
  ["241", "241 · Assistência ao idoso"],
  ["243", "243 · Assistência à criança e ao adolescente"],
  ["244", "244 · Assistência comunitária"],
  ["392", "392 · Difusão cultural"],
  ["812", "812 · Desporto comunitário"],
];

export function AbaDestinos({ destinos, unidades, exercicio, importar = false }: { destinos: DestinoConfig[]; unidades: { codigo: string; nome: string }[]; exercicio: number; importar?: boolean }) {
  const router = useRouter();
  const [pend, setPend] = useState<DestinoConfig | null>(null);
  const [dialogo, setDialogo] = useState<{ execucao: "DIRETA" | "INDIRETA"; editando: DestinoTela | null } | null>(null);
  const [mescla, setMescla] = useState<ParDuplicado | null>(null);
  const pares = possiveisDuplicados(destinos.map((d) => ({ id: d.id, nome: d.nome, cnpj: d.cnpj, execucao: d.execucao, ativo: d.ativo, emendas: d.emendas })));
  return (
    <div className="grid gap-5">
      {pares.length ? (
        <Cartao guia="config.destinos.duplicados" titulo={`Possíveis duplicados (${pares.length})`} ajuda="Grafias parecidas (acento, caixa, abreviação) ou o mesmo CNPJ. A mesclagem só acontece com confirmação.">
          <ul className="grid gap-2">
            {pares.map((p) => (
              <li key={`${p.a.id}|${p.b.id}`} className="flex flex-wrap items-center gap-2 rounded-box bg-soft px-4 py-3 text-sm" data-par={`${p.a.nome} | ${p.b.nome}`}>
                <span className="min-w-0 flex-1">
                  <b>{p.a.nome}</b> e <b>{p.b.nome}</b>
                  <span className="block text-xs text-muted-foreground">{p.motivo === "CNPJ" ? "mesmo CNPJ" : "nome parecido"}</span>
                </span>
                <Button size="xs" variant="surface" onClick={() => setMescla(p)}>
                  Mesclar
                </Button>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
      <Cartao guia="config.destinos.lista"
        ajuda="Para onde as emendas podem ir. Os da base oficial vêm do CNES, Censo Escolar, SUAS e Receita; os demais foram cadastrados aqui ou na tela da emenda. Pendência de habilitação bloqueia a submissão de emendas para a entidade."
        titulo={`Beneficiários (${destinos.length})`}
        acoes={
          <div className="flex flex-wrap gap-1.5">
            {importar ? <ImportarPlanilha tipo="destinos" /> : null}
            <Button size="sm" variant="surface" onClick={() => setDialogo({ execucao: "DIRETA", editando: null })}>
              Novo da administração
            </Button>
            <Button size="sm" variant="surface" onClick={() => setDialogo({ execucao: "INDIRETA", editando: null })}>
              Nova entidade
            </Button>
          </div>
        }
      >
        <FiltroLista
          itens={destinos}
          texto={(d) => `${d.nome} ${d.apelidos.join(" ")} ${d.unidade ?? ""} ${d.cnpj ?? ""}`}
          filtros={{
            rotulo: "Tipo",
            opcoes: {
              Todos: () => true,
              "Execução direta": (d) => d.execucao === "DIRETA",
              "Terceiro setor": (d) => d.execucao === "INDIRETA",
              "Cadastrados no sistema": (d) => d.origem === "CADASTRO",
              Inativos: (d) => !d.ativo,
            },
          }}
          render={(d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-box bg-soft px-4 py-3 text-sm" data-destino={d.nome}>
              <div className="min-w-0 flex-1">
                <b>{d.nome}</b>
                <span className="block text-xs text-muted-foreground">
                  {d.execucao === "DIRETA" ? `Unidade ${d.unidade ?? "—"}` : `CNPJ ${formatarCnpj(d.cnpj)}`} · {d.endereco}
                </span>
                {d.apelidos.length ? <span className="block text-xs text-muted-foreground">Também grafado: {d.apelidos.join("; ")}</span> : null}
                <span className="mt-1 flex flex-wrap gap-1">
                  <Selo tipo={d.origem === "CADASTRO" ? "info" : "neutro"}>{d.origem === "CADASTRO" ? "cadastrado" : "base oficial"}</Selo>
                  {!d.ativo ? <Selo tipo="warn">inativo</Selo> : null}
                  {d.pendencia ? <Selo tipo="bad">pendência: {d.pendencia}</Selo> : null}
                  {d.subfuncao ? <Selo tipo="info">subfunção {d.subfuncao}</Selo> : null}
                  {d.emendas ? <Selo>{d.emendas} emenda(s)</Selo> : null}
                </span>
              </div>
              {d.execucao === "DIRETA" ? <SubfuncaoDestino destino={d} /> : null}
              {d.execucao === "INDIRETA" ? (
                <Button size="xs" variant="ghost" onClick={() => setPend(d)}>
                  Habilitação
                </Button>
              ) : null}
              {d.tela ? (
                <Button size="xs" variant="ghost" onClick={() => setDialogo({ execucao: d.execucao, editando: d.tela })}>
                  Editar
                </Button>
              ) : null}
              <BotaoAcao acao={(ciente) => alternarDestinoAtivo(d.id, ciente)} impacto={{ tipo: "destinoAtivo", id: d.id }} titulo={`${d.ativo ? "Desativar" : "Ativar"} o destino`} rotulo={d.ativo ? "Desativar" : "Ativar"}>{d.ativo ? "Desativar" : "Ativar"}</BotaoAcao>
            </div>
          )}
        />
        <PendenciaDialog destino={pend} aoFechar={() => setPend(null)} />
        <DestinoDialog
          aberto={!!dialogo}
          execucao={dialogo?.execucao ?? "DIRETA"}
          nomeInicial={dialogo?.editando?.nome ?? ""}
          editando={dialogo?.editando ?? null}
          unidades={unidades}
          exercicio={exercicio}
          aoFechar={() => setDialogo(null)}
          aoSalvar={() => {
            setDialogo(null);
            router.refresh();
          }}
        />
      </Cartao>
      <MesclarDialog par={mescla} destinos={destinos} aoFechar={() => setMescla(null)} />
    </div>
  );
}

// Mesclagem: os dois lado a lado, qual fica e quantas emendas serão reapontadas.
function MesclarDialog({ par, destinos, aoFechar }: { par: ParDuplicado | null; destinos: DestinoConfig[]; aoFechar: () => void }) {
  const router = useRouter();
  const [manter, setManter] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [impacto, setImpacto] = useState<{ chave: string; valor: Impacto } | null>(null);
  const [ciente, setCiente] = useState(false);
  const lados = par ? [par.a, par.b].map((x) => destinos.find((d) => d.id === x.id)!) : [];
  const fica = par ? manter ?? (lados[0].emendas >= lados[1].emendas ? lados[0].id : lados[1].id) : null;
  const sai = lados.find((d) => d.id !== fica) ?? null;
  const chave = fica && sai ? `${fica}>${sai.id}` : null;
  useEffect(() => {
    if (!fica || !sai || !chave) return;
    let vivo = true;
    consultarImpacto({ tipo: "mesclar", manterId: fica, removerId: sai.id }).then((r) => {
      if (vivo && r.ok) setImpacto({ chave, valor: { ...r.impacto, mudancas: [] } });
    });
    return () => {
      vivo = false;
    };
  }, [chave, fica, sai]);
  if (!par || !fica || !sai) return null;
  const atual = impacto?.chave === chave ? impacto.valor : null;
  const exige = atual ? exigeCiencia(atual) : false;
  return (
    <Dialog open onOpenChange={(a) => !a && (setManter(null), aoFechar())}>
      <DialogContent
        titulo="Mesclar beneficiários"
        largura="lg"
        aviso={`${sai.emendas} emenda(s) de “${sai.nome}” passarão para o beneficiário mantido. A grafia removida vira apelido; a operação fica na auditoria.`}
        acoes={
          <>
            <Button
              disabled={pendente || !atual || (exige && !ciente)}
              onClick={() =>
                iniciar(async () => {
                  const r = await mesclarDestinos(fica, sai.id, ciente);
                  if (!r.ok) return void toast.error(r.erro);
                  toast(r.mensagem);
                  setManter(null);
                  setCiente(false);
                  aoFechar();
                  router.refresh();
                })
              }
            >
              Confirmar mesclagem
            </Button>
            <Button variant="ghost" onClick={() => (setManter(null), aoFechar())}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {lados.map((d) => (
            <label key={d.id} className={`grid cursor-pointer gap-1 rounded-box p-4 text-sm ${fica === d.id ? "bg-info-bg shadow-[inset_0_0_0_2px_var(--cyan)]" : "bg-soft"}`}>
              <span className="flex items-center gap-2">
                <input type="radio" name="manter" checked={fica === d.id} onChange={() => setManter(d.id)} />
                <b>{fica === d.id ? "Fica" : "Sai"}</b>
              </span>
              <b>{d.nome}</b>
              <span className="text-xs text-muted-foreground">{d.execucao === "DIRETA" ? `Unidade ${d.unidade ?? "—"}` : `CNPJ ${formatarCnpj(d.cnpj)}`}</span>
              <span className="text-xs text-muted-foreground">{d.endereco}</span>
              <span className="text-xs">{d.emendas} emenda(s)</span>
            </label>
          ))}
        </div>
        {atual ? (
          <div className="mt-4">
            <CorpoImpacto impacto={atual} consultado exige={exige} ciente={ciente} aoMarcar={setCiente} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Calculando o que esta mesclagem muda…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Seleção da subfunção sugerida, gravada ao mudar.
function SubfuncaoDestino({ destino }: { destino: DestinoConfig }) {
  const { pendente, executar } = useAcao();
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="sr-only">Subfunção sugerida de {destino.nome}</span>
      <select
        aria-label={`Subfunção sugerida de ${destino.nome}`}
        className="campo h-9 max-w-[260px] px-2 text-xs"
        value={destino.subfuncao ?? ""}
        disabled={pendente}
        onChange={(e) => executar(() => definirSubfuncaoDestino(destino.id, e.target.value))}
      >
        {SUBFUNCOES_SUGERIDAS.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </label>
  );
}

function PendenciaDialog({ destino, aoFechar }: { destino: DestinoConfig | null; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const { pendente, executar } = useAcao();
  return (
    <Dialog open={!!destino} onOpenChange={(a) => !a && aoFechar()}>
      {destino ? (
        <DialogContent
          titulo={`Habilitação — ${destino.nome}`}
          descricao="Documento pendente da entidade (arts. 33-39 da Lei 13.019/2014). Enquanto houver pendência, emendas para ela não podem ser submetidas."
          onOpenAutoFocus={() => setTexto(destino.pendencia ?? "")}
          acoes={
            <>
              <Button disabled={pendente} onClick={() => executar(() => definirPendenciaDestino(destino.id, texto), aoFechar)}>
                Salvar
              </Button>
              {destino.pendencia ? (
                <Button variant="ghost" disabled={pendente} onClick={() => executar(() => definirPendenciaDestino(destino.id, ""), aoFechar)}>
                  Remover pendência
                </Button>
              ) : null}
            </>
          }
        >
          <Campo rotulo="Pendência" htmlFor="pd-txt" dica="Ex.: Certidão de regularidade do FGTS vencida.">
            <input id="pd-txt" className="campo h-12 px-3.5" maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Campo>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------- biblioteca

export type AreaConfig = { id: string; nome: string; orgaos: string[]; unidadePadrao: string | null };
export type ObjetoConfig = {
  id: string;
  rotulo: string;
  termos: string[];
  natureza: "CUSTEIO" | "CAPITAL";
  elemento: string;
  divisibilidade: "DIVISIVEL" | "INDIVISIVEL";
  subfuncao: string | null;
  estrito: boolean;
  explicacao: string;
  areaId: string | null;
  area: string | null;
  ativo: boolean;
};

export function AbaBiblioteca({ areas, objetos }: { areas: AreaConfig[]; objetos: ObjetoConfig[] }) {
  const [editando, setEditando] = useState<ObjetoConfig | "novo" | null>(null);
  return (
    <div className="grid gap-5">
      <Cartao guia="config.biblioteca.lista" ajuda="O vocabulário que o motor reconhece no objeto da emenda. O termo mais longo define a natureza e o elemento; verbos de obra e marcadores de custeio podem prevalecer." titulo={`Biblioteca de objetos (${objetos.length})`} acoes={<Button data-guia="config.biblioteca.novo" size="sm" onClick={() => setEditando("novo")}>Novo objeto</Button>}>
        <TabelaDados
          colunas={[{ titulo: "Objeto" }, { titulo: "Natureza" }, { titulo: "Área", className: "max-md:hidden" }, { titulo: "" }]}
          linhas={objetos.map((o) => ({
            chave: o.id,
            celulas: [
              <div key="o" className={o.ativo ? "" : "opacity-50"}>
                <b>{o.rotulo}</b>
                <span className="block text-xs text-muted-foreground">{o.termos.join(" · ")}</span>
              </div>,
              <span key="n" data-guia="config.biblioteca.natureza" className="whitespace-nowrap">
                {o.natureza === "CAPITAL" ? "Capital" : "Custeio"} · {o.elemento}
                {o.subfuncao ? ` · sf ${o.subfuncao}` : ""}
              </span>,
              <span key="a" data-guia="config.biblioteca.area">
                {o.area ?? "—"}
                {o.estrito ? " (estrita)" : ""}
              </span>,
              <div key="b" data-guia="config.biblioteca.acoes" className="flex items-center justify-end gap-1">
                <Button size="xs" variant="ghost" onClick={() => setEditando(o)}>
                  Editar
                </Button>
                <BotaoAcao acao={() => alternarObjetoAtivo(o.id)} impacto={{ tipo: "objetoAtivo", id: o.id }} titulo={`${o.ativo ? "Desativar" : "Ativar"} o objeto`} rotulo={o.ativo ? "Desativar" : "Ativar"}>{o.ativo ? "Desativar" : "Ativar"}</BotaoAcao>
              </div>,
            ],
          }))}
        />
      </Cartao>
      <EditorObjeto objeto={editando} areas={areas} aoFechar={() => setEditando(null)} />
    </div>
  );
}

function EditorObjeto({ objeto, areas, aoFechar }: { objeto: ObjetoConfig | "novo" | null; areas: AreaConfig[]; aoFechar: () => void }) {
  const base = objeto && objeto !== "novo" ? objeto : null;
  const vazio = {
    rotulo: "",
    termos: "",
    natureza: "CUSTEIO" as ObjetoConfig["natureza"],
    elemento: "30",
    divisibilidade: "DIVISIVEL" as ObjetoConfig["divisibilidade"],
    subfuncao: "",
    estrito: false,
    explicacao: "",
    areaId: "",
  };
  const [f, setF] = useState(vazio);
  const { pendente, executar } = useAcao();
  return (
    <Dialog open={!!objeto} onOpenChange={(a) => !a && aoFechar()}>
      {objeto ? (
        <DialogContent
          titulo={base ? `Editar — ${base.rotulo}` : "Novo objeto da biblioteca"}
          largura="lg"
          onOpenAutoFocus={() =>
            setF(
              base
                ? { ...base, termos: base.termos.join(", "), subfuncao: base.subfuncao ?? "", areaId: base.areaId ?? "" }
                : vazio
            )
          }
          acoes={
            <Button
              disabled={pendente}
              onClick={() =>
                executar(
                  () =>
                    salvarObjeto({
                      id: base?.id,
                      ...f,
                      termos: f.termos.split(",").map((t) => t.trim()).filter(Boolean),
                      areaId: f.areaId || null,
                    }),
                  aoFechar
                )
              }
            >
              Salvar objeto
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
            <Campo rotulo="Rótulo" obrigatorio htmlFor="ob-rot">
              <input id="ob-rot" className="campo h-12 px-3.5" value={f.rotulo} onChange={(e) => setF({ ...f, rotulo: e.target.value })} />
            </Campo>
            <Campo rotulo="Área" htmlFor="ob-area">
              <select id="ob-area" className="campo campo-select h-12 pr-9 pl-3.5" value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value })}>
                <option value="">Sem área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Termos reconhecidos" obrigatorio htmlFor="ob-termos" className="col-span-full" dica="Separados por vírgula, sem acento (ex.: ambulancia, uti movel).">
              <input id="ob-termos" className="campo h-12 px-3.5" value={f.termos} onChange={(e) => setF({ ...f, termos: e.target.value })} />
            </Campo>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-label">Natureza</p>
              <Pilulas rotulo="Natureza" opcoes={["CUSTEIO", "CAPITAL"] as const} valor={f.natureza} curto={(v) => (v === "CAPITAL" ? "Capital" : "Custeio")} aoEscolher={(v) => setF({ ...f, natureza: v })} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-label">Divisibilidade</p>
              <Pilulas
                rotulo="Divisibilidade"
                opcoes={["DIVISIVEL", "INDIVISIVEL"] as const}
                valor={f.divisibilidade}
                curto={(v) => (v === "DIVISIVEL" ? "Divisível" : "Indivisível")}
                aoEscolher={(v) => setF({ ...f, divisibilidade: v })}
              />
            </div>
            <Campo rotulo="Elemento provável" obrigatorio htmlFor="ob-el">
              <input id="ob-el" maxLength={2} className="campo h-12 px-3.5 tnum" value={f.elemento} onChange={(e) => setF({ ...f, elemento: e.target.value })} />
            </Campo>
            <Campo rotulo="Subfunção" htmlFor="ob-sf">
              <input id="ob-sf" maxLength={3} className="campo h-12 px-3.5 tnum" value={f.subfuncao} onChange={(e) => setF({ ...f, subfuncao: e.target.value })} />
            </Campo>
            <Campo rotulo="Explicação" obrigatorio htmlFor="ob-ex" className="col-span-full">
              <input id="ob-ex" className="campo h-12 px-3.5" value={f.explicacao} onChange={(e) => setF({ ...f, explicacao: e.target.value })} />
            </Campo>
            <label className="col-span-full flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.estrito} onChange={(e) => setF({ ...f, estrito: e.target.checked })} />
              Área estrita — o objeto só cabe na sua própria área (ambulância é Saúde)
            </label>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

// -------------------------------------------------------------------- normas

export type NormaConfig = {
  id: string;
  tipo: string;
  titulo: string;
  numero: string | null;
  artigo: string | null;
  trecho: string | null;
  url: string | null;
  dataAto: string | null;
  dataVigencia: string | null;
  vigenciaFim: string | null;
  arquivo: { id: string; nome: string } | null;
  ativo: boolean;
};

const TIPOS_NORMA = ["LOM", "REGIMENTO_INTERNO", "LEI", "RESOLUCAO", "ATO_DA_MESA", "DECRETO", "PORTARIA", "COMUNICADO", "OUTRO"] as const;
const ROTULO_NORMA: Record<string, string> = {
  LOM: "Lei Orgânica",
  REGIMENTO_INTERNO: "Regimento Interno",
  LEI: "Lei",
  RESOLUCAO: "Resolução",
  ATO_DA_MESA: "Ato da Mesa",
  DECRETO: "Decreto",
  PORTARIA: "Portaria",
  COMUNICADO: "Comunicado",
  OUTRO: "Outro",
};
const dataBR = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);
const normaVazia = {
  id: "",
  tipo: "LEI" as (typeof TIPOS_NORMA)[number],
  titulo: "",
  numero: "",
  artigo: "",
  trecho: "",
  url: "",
  dataAto: "",
  dataVigencia: "",
  vigenciaFim: "",
  arquivo: null as ArquivoValor,
};

// Repositório normativo: o ato inteiro, com arquivo, vigência e edição.
export function AbaNormas({ normas }: { normas: NormaConfig[] }) {
  const [f, setF] = useState<typeof normaVazia | null>(null);
  const { pendente, executar } = useAcao();
  const editar = (n: NormaConfig) =>
    setF({
      id: n.id,
      tipo: n.tipo as (typeof TIPOS_NORMA)[number],
      titulo: n.titulo,
      numero: n.numero ?? "",
      artigo: n.artigo ?? "",
      trecho: n.trecho ?? "",
      url: n.url ?? "",
      dataAto: n.dataAto ?? "",
      dataVigencia: n.dataVigencia ?? "",
      vigenciaFim: n.vigenciaFim ?? "",
      arquivo: n.arquivo,
    });
  return (
    <Cartao guia="config.normas.lista" titulo="Base legal" acoes={<Button data-guia="config.normas.nova" size="sm" onClick={() => setF(normaVazia)}>Nova norma</Button>}>
      <div className="grid gap-3">
        {normas.map((n) => (
          <div key={n.id} className={`rounded-box bg-soft p-4 text-sm ${n.ativo ? "" : "opacity-60"}`} data-norma={n.id}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <Selo>{ROTULO_NORMA[n.tipo] ?? n.tipo}</Selo>{" "}
                <b>
                  {n.titulo}
                  {n.numero ? ` nº ${n.numero}` : ""}
                </b>
                {n.artigo ? <span className="block text-xs text-muted-foreground">{n.artigo}</span> : null}
                <span data-guia="config.normas.vigencia" className="block text-xs text-muted-foreground">
                  {n.dataAto ? `de ${dataBR(n.dataAto)} · ` : ""}
                  {n.dataVigencia ? `vigência desde ${dataBR(n.dataVigencia)}` : "vigência não informada"}
                  {n.vigenciaFim ? ` até ${dataBR(n.vigenciaFim)}` : ""}
                </span>
              </div>
              <div data-guia="config.normas.acoes" className="flex shrink-0 flex-wrap items-center gap-1">
                {n.arquivo ? (
                  <Button size="xs" variant="ghost" asChild>
                    <a href={`/api/arquivos/${n.arquivo.id}`}>Arquivo</a>
                  </Button>
                ) : null}
                {n.url ? (
                  <Button size="xs" variant="ghost" asChild>
                    <a href={n.url} target="_blank" rel="noopener noreferrer">
                      Abrir
                    </a>
                  </Button>
                ) : null}
                <Button size="xs" variant="ghost" onClick={() => editar(n)}>
                  Editar
                </Button>
                <BotaoAcao acao={() => alternarNormaAtiva(n.id)} impacto={{ tipo: "normaAtiva", id: n.id }} titulo={`${n.ativo ? "Desativar" : "Ativar"} a norma`} rotulo={n.ativo ? "Desativar" : "Ativar"}>{n.ativo ? "Desativar" : "Ativar"}</BotaoAcao>
              </div>
            </div>
            {n.trecho ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">“{n.trecho}”</p> : null}
          </div>
        ))}
      </div>
      <Dialog open={!!f} onOpenChange={(a) => !a && setF(null)}>
        {f ? (
          <DialogContent
            titulo={f.id ? "Editar norma" : "Nova norma"}
            largura="lg"
            acoes={
              <Button
                disabled={pendente}
                onClick={() => executar(() => salvarNorma({ ...f, id: f.id || undefined, arquivoId: f.arquivo?.id ?? null }), () => setF(null))}
              >
                {f.id ? "Salvar" : "Cadastrar"}
              </Button>
            }
          >
            <div className="grid grid-cols-3 gap-3.5 max-sm:grid-cols-1">
              <div className="col-span-full">
                <p className="mb-1.5 text-sm font-semibold text-label">Tipo</p>
                <Pilulas rotulo="Tipo" opcoes={TIPOS_NORMA} valor={f.tipo} curto={(v) => ROTULO_NORMA[v]} aoEscolher={(v) => setF({ ...f, tipo: v })} />
              </div>
              <Campo rotulo="Título" obrigatorio htmlFor="nm-t" className="col-span-full">
                <input id="nm-t" className="campo h-12 px-3.5" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
              </Campo>
              <Campo rotulo="Número" htmlFor="nm-n">
                <input id="nm-n" className="campo h-12 px-3.5" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
              </Campo>
              <Campo rotulo="Data do ato" htmlFor="nm-d">
                <input id="nm-d" type="date" className="campo h-12 px-3.5" value={f.dataAto} onChange={(e) => setF({ ...f, dataAto: e.target.value })} />
              </Campo>
              <span />
              <Campo rotulo="Início da vigência" htmlFor="nm-v">
                <input id="nm-v" type="date" className="campo h-12 px-3.5" value={f.dataVigencia} onChange={(e) => setF({ ...f, dataVigencia: e.target.value })} />
              </Campo>
              <Campo rotulo="Fim da vigência" htmlFor="nm-vf" dica="Em branco: em vigor.">
                <input id="nm-vf" type="date" className="campo h-12 px-3.5" value={f.vigenciaFim} onChange={(e) => setF({ ...f, vigenciaFim: e.target.value })} />
              </Campo>
              <span />
              <Campo rotulo="Arquivo do ato" htmlFor="nm-arq" className="col-span-full" dica="PDF do ato publicado. Fica disponível no manual público.">
                <CampoArquivo id="nm-arq" uso="NORMA" publico valor={f.arquivo} aoMudar={(v) => setF({ ...f, arquivo: v })} />
              </Campo>
              <Campo rotulo="Artigo (opcional)" htmlFor="nm-a" className="col-span-full" dica="Em branco, a norma vale como o ato inteiro.">
                <input id="nm-a" className="campo h-12 px-3.5" value={f.artigo} onChange={(e) => setF({ ...f, artigo: e.target.value })} />
              </Campo>
              <Campo rotulo="Trecho (opcional)" htmlFor="nm-tr" className="col-span-full">
                <textarea id="nm-tr" className="campo min-h-[90px] p-3.5" value={f.trecho} onChange={(e) => setF({ ...f, trecho: e.target.value })} />
              </Campo>
              <Campo rotulo="Link" htmlFor="nm-u" className="col-span-full">
                <input id="nm-u" className="campo h-12 px-3.5" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
              </Campo>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </Cartao>
  );
}

// ----------------------------------------------------------------- auditoria

export type AuditoriaLinha = {
  id: string;
  quando: string;
  usuario: string;
  entidade: string;
  acao: string;
  registro: string | null;
  grupos: GrupoLegivel[];
};

// Antes e depois lado a lado, só o que mudou, em linguagem simples (os nomes e
// valores já vêm traduzidos do servidor).
function Diferenca({ grupos }: { grupos: GrupoLegivel[] }) {
  if (!grupos.length) return <p className="text-sm text-muted-foreground">Nenhum dado mudou neste registro (por exemplo, uma entrada no sistema).</p>;
  return (
    <div className="grid gap-4">
      {grupos.map((g, i) => (
        <div key={i}>
          {g.titulo ? <h3 className="mb-1.5 text-sm font-bold">{g.titulo}</h3> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-2xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
                <tr className="border-b border-hair">
                  <th className="py-2 pr-3">Campo</th>
                  <th className="py-2 pr-3">Antes</th>
                  <th className="py-2">Depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {g.linhas.map((l) => (
                  <tr key={l.campo} className="align-top">
                    <td className="py-2 pr-3 font-semibold">{l.campo}</td>
                    <td className="py-2 pr-3 break-words text-muted-foreground">{l.antes}</td>
                    <td className="py-2 break-words">{l.depois}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AbaAuditoria({
  linhas,
  total,
  pagina,
  porPagina,
  filtros,
  usuarios,
  entidades,
  acoes,
}: {
  linhas: AuditoriaLinha[];
  total: number;
  pagina: number;
  porPagina: number;
  filtros: { de: string; ate: string; usuario: string; entidade: string; acao: string };
  usuarios: { id: string; nome: string }[];
  entidades: { valor: string; rotulo: string }[];
  acoes: { valor: string; rotulo: string }[];
}) {
  const [aberto, setAberto] = useState<AuditoriaLinha | null>(null);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const link = (n: number) => `/config?${new URLSearchParams({ aba: "auditoria", ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)), pagina: String(n) })}`;
  const caixa = "campo h-10 px-2.5 text-sm";
  return (
    <Cartao guia="config.auditoria.lista" titulo={`Auditoria (${total} registros)`}>
      <FormFiltros guia="config.auditoria.filtros" acao="/config" rotulo="Filtrar auditoria" className="mb-4 flex flex-wrap items-end gap-2.5 [&>label]:min-w-[150px] [&>label]:flex-1">
        <input type="hidden" name="aba" value="auditoria" />
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          De
          <input type="date" name="de" defaultValue={filtros.de} className={caixa} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Até
          <input type="date" name="ate" defaultValue={filtros.ate} className={caixa} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Usuário
          <select name="usuario" defaultValue={filtros.usuario} className={caixa}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Entidade
          <select name="entidade" defaultValue={filtros.entidade} className={caixa}>
            <option value="">Todas</option>
            {entidades.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Ação
          <select name="acao" defaultValue={filtros.acao} className={caixa}>
            <option value="">Todas</option>
            {acoes.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.rotulo}
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" asChild className="h-10">
          <Link href="/config?aba=auditoria">Limpar</Link>
        </Button>
      </FormFiltros>
      <TabelaDados
        vazio="Nenhum registro."
        colunas={[{ titulo: "Quando" }, { titulo: "Usuário", className: "@max-[520px]:hidden" }, { titulo: "Entidade", className: "@max-[680px]:hidden" }, { titulo: "Ação" }, { titulo: "" }]}
        linhas={linhas.map((l) => ({
          chave: l.id,
          celulas: [
            <span key="q" className="text-xs whitespace-nowrap tnum @max-[520px]:whitespace-normal">
              {l.quando}
            </span>,
            l.usuario,
            <span key="e" className="text-xs">
              {l.entidade}
              {l.registro ? <span className="block text-muted-foreground">{l.registro}</span> : null}
            </span>,
            <span key="a" className="text-sm font-semibold">
              {l.acao}
            </span>,
            <Button key="b" data-guia="config.auditoria.abrir" size="xs" variant="ghost" onClick={() => setAberto(l)}>
              Abrir
            </Button>,
          ],
        }))}
      />
      {paginas > 1 ? (
        <nav data-guia="config.auditoria.paginacao" aria-label="Paginação" className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">
            página {pagina} de {paginas}
          </span>
          <span className="ml-auto flex gap-1.5">
            {pagina > 1 ? (
              <a className="rounded-md bg-soft px-3 py-1.5 font-semibold" href={link(pagina - 1)}>
                Anterior
              </a>
            ) : null}
            {pagina < paginas ? (
              <a className="rounded-md bg-soft px-3 py-1.5 font-semibold" href={link(pagina + 1)}>
                Próxima
              </a>
            ) : null}
          </span>
        </nav>
      ) : null}
      <Dialog open={!!aberto} onOpenChange={(a) => !a && setAberto(null)}>
        {aberto ? (
          <DialogContent titulo={aberto.acao} largura="lg">
            <p className="mb-4 text-sm text-muted-foreground">
              {aberto.entidade}
              {aberto.registro ? ` · ${aberto.registro}` : ""} · {aberto.quando} · por {aberto.usuario}
            </p>
            <Diferenca grupos={aberto.grupos} />
          </DialogContent>
        ) : null}
      </Dialog>
    </Cartao>
  );
}
