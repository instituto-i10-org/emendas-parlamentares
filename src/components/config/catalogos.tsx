"use client";

import { useState } from "react";
import { Cartao, TabelaDados } from "@/components/app/pagina";
import { FiltroLista } from "@/components/app/filtro-lista";
import { Campo, Pilulas, Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  alternarDestinoAtivo,
  alternarNormaAtiva,
  alternarObjetoAtivo,
  criarNorma,
  definirPendenciaDestino,
  salvarArea,
  salvarObjeto,
} from "@/lib/actions/config";
import { formatarCnpj } from "@/lib/cnpj";
import { norm } from "@/lib/riep";
import { BotaoAcao, useAcao } from "./comum";

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
  emendas: number;
};

export function AbaDestinos({ destinos }: { destinos: DestinoConfig[] }) {
  const [pend, setPend] = useState<DestinoConfig | null>(null);
  return (
    <Cartao ajuda="Para onde as emendas podem ir. Os da base oficial vêm do CNES, Censo Escolar, SUAS e Receita; os demais foram cadastrados na tela da emenda. Pendência de habilitação bloqueia a submissão de emendas para a entidade." titulo={`Destinos (${destinos.length})`}>
      <FiltroLista
        itens={destinos}
        texto={(d) => `${d.nome} ${d.unidade ?? ""} ${d.cnpj ?? ""}`}
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
          <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-box bg-soft px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <b>{d.nome}</b>
              <span className="block text-xs text-muted-foreground">
                {d.execucao === "DIRETA" ? `Unidade ${d.unidade ?? "—"}` : `CNPJ ${formatarCnpj(d.cnpj)}`} · {d.endereco}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                <Selo tipo={d.origem === "CADASTRO" ? "info" : "neutro"}>{d.origem === "CADASTRO" ? "cadastrado" : "base oficial"}</Selo>
                {!d.ativo ? <Selo tipo="warn">inativo</Selo> : null}
                {d.pendencia ? <Selo tipo="bad">pendência: {d.pendencia}</Selo> : null}
                {d.emendas ? <Selo>{d.emendas} emenda(s)</Selo> : null}
              </span>
            </div>
            {d.execucao === "INDIRETA" ? (
              <Button size="xs" variant="ghost" onClick={() => setPend(d)}>
                Habilitação
              </Button>
            ) : null}
            <BotaoAcao acao={() => alternarDestinoAtivo(d.id)}>{d.ativo ? "Desativar" : "Ativar"}</BotaoAcao>
          </div>
        )}
      />
      <PendenciaDialog destino={pend} aoFechar={() => setPend(null)} />
    </Cartao>
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
      <Cartao ajuda="Quais órgãos orçamentários atendem cada área. É o que permite ao motor dizer que um objeto de área estrita não cabe num destino de outra área, e escolher a secretaria do repasse no terceiro setor." titulo="Áreas de aplicação">
        <div className="grid gap-2">
          {areas.map((a) => (
            <LinhaArea key={a.id} area={a} />
          ))}
        </div>
      </Cartao>
      <Cartao ajuda="O vocabulário que o motor reconhece no objeto da emenda. O termo mais longo define a natureza e o elemento; verbos de obra e marcadores de custeio podem prevalecer." titulo={`Biblioteca de objetos (${objetos.length})`} acoes={<Button size="sm" onClick={() => setEditando("novo")}>Novo objeto</Button>}>
        <TabelaDados
          colunas={[{ titulo: "Objeto" }, { titulo: "Natureza" }, { titulo: "Área", className: "max-md:hidden" }, { titulo: "" }]}
          linhas={objetos.map((o) => ({
            chave: o.id,
            celulas: [
              <div key="o" className={o.ativo ? "" : "opacity-50"}>
                <b>{o.rotulo}</b>
                <span className="block text-xs text-muted-foreground">{o.termos.join(" · ")}</span>
              </div>,
              <span key="n" className="whitespace-nowrap">
                {o.natureza === "CAPITAL" ? "Capital" : "Custeio"} · {o.elemento}
                {o.subfuncao ? ` · sf ${o.subfuncao}` : ""}
              </span>,
              <span key="a" className="max-md:hidden">
                {o.area ?? "—"}
                {o.estrito ? " (estrita)" : ""}
              </span>,
              <div key="b" className="flex items-center justify-end gap-1">
                <Button size="xs" variant="ghost" onClick={() => setEditando(o)}>
                  Editar
                </Button>
                <BotaoAcao acao={() => alternarObjetoAtivo(o.id)}>{o.ativo ? "Desativar" : "Ativar"}</BotaoAcao>
              </div>,
            ],
          }))}
        />
      </Cartao>
      <EditorObjeto objeto={editando} areas={areas} aoFechar={() => setEditando(null)} />
    </div>
  );
}

function LinhaArea({ area }: { area: AreaConfig }) {
  const [orgaos, setOrgaos] = useState(area.orgaos.join(", "));
  const [unidade, setUnidade] = useState(area.unidadePadrao ?? "");
  const { pendente, executar } = useAcao();
  return (
    <div className="grid grid-cols-[160px_1fr_140px_auto] items-end gap-2 rounded-md bg-soft p-3 max-md:grid-cols-1">
      <b className="self-center text-sm">{area.nome}</b>
      <Campo rotulo="Órgãos" htmlFor={`ar-o-${area.id}`}>
        <input id={`ar-o-${area.id}`} className="campo h-10 px-3" value={orgaos} onChange={(e) => setOrgaos(e.target.value)} />
      </Campo>
      <Campo rotulo="Unidade padrão" htmlFor={`ar-u-${area.id}`}>
        <input id={`ar-u-${area.id}`} className="campo h-10 px-3" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
      </Campo>
      <Button
        size="sm"
        variant="ghost"
        disabled={pendente}
        onClick={() => executar(() => salvarArea({ id: area.id, orgaos: orgaos.split(/[,\s]+/).filter(Boolean), unidadePadrao: unidade.trim() }))}
      >
        Salvar
      </Button>
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
  ativo: boolean;
};

const TIPOS_NORMA = ["LOM", "REGIMENTO_INTERNO", "LEI", "PORTARIA", "COMUNICADO", "OUTRO"] as const;
const ROTULO_NORMA: Record<string, string> = {
  LOM: "Lei Orgânica",
  REGIMENTO_INTERNO: "Regimento Interno",
  LEI: "Lei",
  PORTARIA: "Portaria",
  COMUNICADO: "Comunicado",
  OUTRO: "Outro",
};

export function AbaNormas({ normas }: { normas: NormaConfig[] }) {
  const [nova, setNova] = useState(false);
  const [f, setF] = useState({ tipo: "LEI" as (typeof TIPOS_NORMA)[number], titulo: "", numero: "", artigo: "", trecho: "", url: "", dataVigencia: "" });
  const { pendente, executar } = useAcao();
  return (
    <Cartao titulo="Base legal" acoes={<Button size="sm" onClick={() => setNova(true)}>Nova norma</Button>}>
      <div className="grid gap-3">
        {normas.map((n) => (
          <div key={n.id} className={`rounded-box bg-soft p-4 text-sm ${n.ativo ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <Selo>{ROTULO_NORMA[n.tipo]}</Selo> <b>{n.titulo}</b>
                {n.artigo ? <span className="block text-xs text-muted-foreground">{n.artigo}</span> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {n.url ? (
                  <Button size="xs" variant="ghost" asChild>
                    <a href={n.url} target="_blank" rel="noopener noreferrer">
                      Abrir
                    </a>
                  </Button>
                ) : null}
                <BotaoAcao acao={() => alternarNormaAtiva(n.id)}>{n.ativo ? "Desativar" : "Ativar"}</BotaoAcao>
              </div>
            </div>
            {n.trecho ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">“{n.trecho}”</p> : null}
          </div>
        ))}
      </div>
      <Dialog open={nova} onOpenChange={setNova}>
        <DialogContent
          titulo="Nova norma"
          largura="lg"
          acoes={
            <Button disabled={pendente} onClick={() => executar(() => criarNorma(f), () => setNova(false))}>
              Cadastrar
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
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
            <Campo rotulo="Vigência" htmlFor="nm-v">
              <input id="nm-v" type="date" className="campo h-12 px-3.5" value={f.dataVigencia} onChange={(e) => setF({ ...f, dataVigencia: e.target.value })} />
            </Campo>
            <Campo rotulo="Artigo" htmlFor="nm-a" className="col-span-full">
              <input id="nm-a" className="campo h-12 px-3.5" value={f.artigo} onChange={(e) => setF({ ...f, artigo: e.target.value })} />
            </Campo>
            <Campo rotulo="Trecho" htmlFor="nm-tr" className="col-span-full">
              <textarea id="nm-tr" className="campo min-h-[90px] p-3.5" value={f.trecho} onChange={(e) => setF({ ...f, trecho: e.target.value })} />
            </Campo>
            <Campo rotulo="Link" htmlFor="nm-u" className="col-span-full">
              <input id="nm-u" className="campo h-12 px-3.5" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
            </Campo>
          </div>
        </DialogContent>
      </Dialog>
    </Cartao>
  );
}

// ----------------------------------------------------------------- auditoria

export type AuditoriaLinha = { id: string; quando: string; usuario: string; entidade: string; entidadeId: string; acao: string };

export function AbaAuditoria({ linhas }: { linhas: AuditoriaLinha[] }) {
  const [q, setQ] = useState("");
  const visiveis = linhas.filter((l) => !q || norm(`${l.usuario} ${l.entidade} ${l.acao}`).includes(norm(q)));
  return (
    <Cartao titulo="Auditoria (últimos 300 registros)">
      <input className="campo mb-4 h-11 px-3.5" placeholder="Filtrar por usuário, entidade ou ação" value={q} onChange={(e) => setQ(e.target.value)} />
      <TabelaDados
        vazio="Nenhum registro."
        colunas={[{ titulo: "Quando" }, { titulo: "Usuário" }, { titulo: "Entidade" }, { titulo: "Ação" }]}
        linhas={visiveis.map((l) => ({
          chave: l.id,
          celulas: [
            <span key="q" className="whitespace-nowrap text-xs tnum">{l.quando}</span>,
            l.usuario,
            <span key="e" className="text-xs">
              {l.entidade} <span className="text-muted-foreground">{l.entidadeId.slice(-8)}</span>
            </span>,
            <Selo key="a">{l.acao}</Selo>,
          ],
        }))}
      />
    </Cartao>
  );
}
