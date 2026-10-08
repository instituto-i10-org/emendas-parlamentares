"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Upload } from "lucide-react";
import { toast } from "sonner";
import { FiltroLista } from "@/components/app/filtro-lista";
import { Campo, CampoNumero, Pilulas, Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CampoArquivo, type ArquivoValor } from "@/components/app/campo-arquivo";
import { iniciarImportacao } from "@/lib/actions/importacao";
import { criarInstrumento, definirStatusInstrumento, editarInstrumento, excluirInstrumento } from "@/lib/actions/planejamento";
import { lerNumero } from "@/lib/emendas/estado";
import { DropdownMenu } from "radix-ui";
import { useConfirmarImpacto } from "@/components/app/confirmar-impacto";
import { BRL } from "@/lib/riep";

const SEQUENCIA = ["EM_ELABORACAO", "ENVIADO", "EM_TRAMITACAO", "APROVADO", "SANCIONADO", "VIGENTE", "ENCERRADO"] as const;
export const ROTULO_STATUS: Record<string, string> = {
  EM_ELABORACAO: "Em elaboração",
  ENVIADO: "Enviado",
  EM_TRAMITACAO: "Em tramitação",
  APROVADO: "Aprovado",
  SANCIONADO: "Sancionado",
  VIGENTE: "Vigente",
  ENCERRADO: "Encerrado",
};

// Avança ou volta um passo no ciclo de vida do instrumento: um botão só,
// "Mudar situação", com as opções escritas por extenso; escolher abre a
// janela de confirmação com o impacto.
export function StatusInstrumento({ id, status, podeGerir, rotulo }: { id: string; status: string; podeGerir: boolean; rotulo?: string }) {
  const conf = useConfirmarImpacto();
  const pendente = conf.pendente;
  const i = SEQUENCIA.indexOf(status as (typeof SEQUENCIA)[number]);
  const mover = (para: (typeof SEQUENCIA)[number]) =>
    conf.pedir({
      titulo: `Mudar a situação${rotulo ? ` do ${rotulo}` : ""}`,
      impacto: { tipo: "statusInstrumento", id, status: para },
      rotulo: `Mudar para ${ROTULO_STATUS[para].toLowerCase()}`,
      acao: (ciente) => definirStatusInstrumento(id, para, ciente),
    });
  const opcoes = [
    ...(i > 0 ? [{ para: SEQUENCIA[i - 1], texto: `Voltar para ${ROTULO_STATUS[SEQUENCIA[i - 1]]}` }] : []),
    ...(i < SEQUENCIA.length - 1 ? [{ para: SEQUENCIA[i + 1], texto: `Avançar para ${ROTULO_STATUS[SEQUENCIA[i + 1]]}` }] : []),
  ];
  return (
    <div className="flex flex-nowrap items-center gap-2">
      {conf.janela}
      <Selo tipo={status === "EM_TRAMITACAO" ? "info" : status === "VIGENTE" ? "ok" : "neutro"}>{ROTULO_STATUS[status]}</Selo>
      {podeGerir && opcoes.length ? (
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button size="xs" variant="ghost" disabled={pendente}>
              Mudar situação <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-[220px] rounded-box bg-surface p-1.5 shadow-[0_12px_32px_rgba(6,24,64,.18)] outline-none"
            >
              {opcoes.map((o) => (
                <DropdownMenu.Item
                  key={o.para}
                  onSelect={() => mover(o.para)}
                  className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm font-semibold text-ink outline-none select-none data-[highlighted]:bg-soft"
                >
                  {o.texto}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}
    </div>
  );
}

export type InstrumentoForm = {
  id?: string;
  especie: "PROJETO_LEI" | "LEI_APROVADA";
  tipo: "PPA" | "LDO" | "LOA";
  numero: string;
  ementa: string;
  instrumentoOrigemId: string;
  arquivo: ArquivoValor;
  data: string;
  totalImpresso: string;
};

const vazio: InstrumentoForm = {
  especie: "PROJETO_LEI",
  tipo: "LOA",
  numero: "",
  ementa: "",
  instrumentoOrigemId: "",
  arquivo: null,
  data: "",
  totalImpresso: "",
};

// Cadastro e edição do instrumento: número, ementa, data de envio (ou de
// aprovação), o arquivo da peça e, na lei aprovada, o projeto de origem.
export function FormInstrumento({
  exercicioId,
  projetos,
  inicial,
  gatilho,
}: {
  exercicioId: string;
  projetos: { id: string; rotulo: string; tipo: string }[];
  inicial?: InstrumentoForm;
  gatilho: (abrir: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState<InstrumentoForm>(inicial ?? vazio);
  const [pendente, iniciar] = useTransition();
  const editando = !!f.id;
  const origens = projetos.filter((p) => p.tipo === f.tipo);

  function salvar() {
    iniciar(async () => {
      const comum = {
        numero: f.numero,
        ementa: f.ementa,
        instrumentoOrigemId: f.instrumentoOrigemId || undefined,
        arquivoId: f.arquivo?.id ?? null,
        data: f.data,
        totalImpresso: f.totalImpresso ? lerNumero(f.totalImpresso) : null,
      };
      const r = editando ? await editarInstrumento({ id: f.id!, ...comum }) : await criarInstrumento({ exercicioId, tipo: f.tipo, especie: f.especie, ...comum });
      if (!r.ok) return void toast.error(r.erro);
      toast(r.mensagem ?? "Instrumento salvo.");
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      {gatilho(() => {
        setF(inicial ?? vazio);
        setAberto(true);
      })}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo={editando ? `Editar ${f.tipo} · ${f.numero}` : "Novo instrumento"}
          largura="lg"
          acoes={
            <Button disabled={pendente} onClick={salvar}>
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          }
        >
          <div className="grid gap-3.5">
            {!editando ? (
              <>
                <Pilulas
                  rotulo="Espécie"
                  opcoes={["PROJETO_LEI", "LEI_APROVADA"] as const}
                  valor={f.especie}
                  curto={(v) => (v === "PROJETO_LEI" ? "Projeto de lei" : "Lei aprovada")}
                  aoEscolher={(v) => setF({ ...f, especie: v })}
                />
                <Pilulas rotulo="Tipo" opcoes={["PPA", "LDO", "LOA"] as const} valor={f.tipo} aoEscolher={(v) => setF({ ...f, tipo: v, instrumentoOrigemId: "" })} />
              </>
            ) : null}
            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <Campo rotulo="Número" obrigatorio htmlFor="in-num">
                <input id="in-num" className="campo h-12 px-3.5" placeholder="PL 264/2026" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} />
              </Campo>
              <Campo rotulo={f.especie === "LEI_APROVADA" ? "Data de aprovação" : "Data de envio"} htmlFor="in-dt">
                <input id="in-dt" type="date" className="campo h-12 px-3.5" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
              </Campo>
            </div>
            <Campo rotulo="Ementa" obrigatorio htmlFor="in-em">
              <textarea id="in-em" className="campo min-h-[80px] p-3.5" value={f.ementa} onChange={(e) => setF({ ...f, ementa: e.target.value })} />
            </Campo>
            {f.especie === "LEI_APROVADA" ? (
              <Campo rotulo="Projeto de lei de origem" obrigatorio htmlFor="in-or" dica={`Só projetos de ${f.tipo} deste exercício.`}>
                <select id="in-or" className="campo campo-select h-12 pr-9 pl-3.5" value={f.instrumentoOrigemId} onChange={(e) => setF({ ...f, instrumentoOrigemId: e.target.value })}>
                  <option value="">Selecione…</option>
                  {origens.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : null}
            <Campo rotulo="Arquivo da peça (PDF)" htmlFor="in-arq">
              <CampoArquivo id="in-arq" uso="PECA_ORCAMENTARIA" valor={f.arquivo} aoMudar={(arquivo) => setF({ ...f, arquivo })} publico />
            </Campo>
            {f.tipo === "LOA" ? (
              <Campo
                rotulo="Total da despesa impresso na peça (R$)"
                htmlFor="in-tot"
                dica="A importação da base confere a soma das dotações contra este valor e para se não bater."
              >
                <CampoNumero id="in-tot" valor={f.totalImpresso} aoMudar={(v) => setF({ ...f, totalImpresso: v })} placeholder="0,00" />
              </Campo>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NovoInstrumento({ exercicioId, projetos }: { exercicioId: string; projetos: { id: string; rotulo: string; tipo: string }[] }) {
  return (
    <FormInstrumento
      exercicioId={exercicioId}
      projetos={projetos}
      gatilho={(abrir) => (
        <Button size="sm" onClick={abrir}>
          Novo instrumento
        </Button>
      )}
    />
  );
}

export function EditarInstrumento({ exercicioId, projetos, inicial }: { exercicioId: string; projetos: { id: string; rotulo: string; tipo: string }[]; inicial: InstrumentoForm }) {
  return (
    <FormInstrumento
      exercicioId={exercicioId}
      projetos={projetos}
      inicial={inicial}
      gatilho={(abrir) => (
        <Button size="xs" variant="ghost" onClick={abrir}>
          Editar
        </Button>
      )}
    />
  );
}

export function ExcluirInstrumento({ id, rotulo }: { id: string; rotulo: string }) {
  const conf = useConfirmarImpacto();
  return (
    <>
      {conf.janela}
      <Button
        size="xs"
        variant="ghost"
        disabled={conf.pendente}
        onClick={() =>
          conf.pedir({
            titulo: `Excluir ${rotulo}`,
            mensagem: `Excluir ${rotulo}? Só é possível sem base de dotações e sem lei vinculada.`,
            rotulo: "Excluir",
            destrutiva: true,
            acao: () => excluirInstrumento(id),
          })
        }
      >
        Excluir
      </Button>
    </>
  );
}

// Importação da base: o arquivo (PDF, foto, CSV ou XLSX) vai para a área de
// conferência, onde nada se grava antes da confirmação.
export function ImportarBase({ instrumentoId, rotulo, tipo }: { instrumentoId: string; rotulo: string; tipo: "PPA" | "LDO" | "LOA" }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<ArquivoValor>(null);
  const [faixa, setFaixa] = useState({ de: "", ate: "" });
  const [pendente, iniciar] = useTransition();
  const carga = tipo === "LOA" ? "DOTACOES" : tipo === "LDO" ? "PRIORIDADES_LDO" : "PROGRAMAS_PPA";
  const pdf = !!arquivo && /\.pdf$/i.test(arquivo.nome);
  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setAberto(true)}>
        <Upload /> Importar base
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo={`Importar base · ${rotulo}`}
          descricao={
            tipo === "LOA"
              ? "Dotações do orçamento: PDF (digital ou digitalizado), foto, CSV ou XLSX. Nada é gravado antes da conferência."
              : `${tipo === "LDO" ? "Prioridades e metas da LDO" : "Programas e metas do PPA"} por planilha (CSV ou XLSX).`
          }
          largura="lg"
          acoes={
            <Button
              disabled={pendente || !arquivo}
              onClick={() =>
                iniciar(async () => {
                  const r = await iniciarImportacao({
                    instrumentoId,
                    arquivoId: arquivo!.id,
                    paginaInicial: pdf && faixa.de ? Number(faixa.de) : null,
                    paginaFinal: pdf && faixa.ate ? Number(faixa.ate) : null,
                  });
                  if (!r.ok) return void toast.error(r.erro);
                  router.push(`/executivo/planejamento/importacao/${r.id}`);
                })
              }
            >
              {pendente ? "Abrindo…" : "Ler e conferir"}
            </Button>
          }
        >
          <div className="grid gap-3.5">
            <Campo rotulo="Arquivo" obrigatorio htmlFor="imp-arq">
              <CampoArquivo id="imp-arq" uso="IMPORTACAO" valor={arquivo} aoMudar={setArquivo} />
            </Campo>
            {pdf ? (
              <div className="grid grid-cols-2 gap-3.5">
                <Campo rotulo="Quadro de despesa a partir da página (opcional)" htmlFor="imp-de" dica="Sem páginas, o sistema procura o quadro sozinho.">
                  <input id="imp-de" inputMode="numeric" className="campo h-12 px-3.5 tnum" value={faixa.de} onChange={(e) => setFaixa({ ...faixa, de: e.target.value.replace(/\D/g, "") })} />
                </Campo>
                <Campo rotulo="até a página" htmlFor="imp-ate">
                  <input id="imp-ate" inputMode="numeric" className="campo h-12 px-3.5 tnum" value={faixa.ate} onChange={(e) => setFaixa({ ...faixa, ate: e.target.value.replace(/\D/g, "") })} />
                </Campo>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Planilha em outro formato? Tudo bem: as colunas são reconhecidas pelo nome e o que faltar você liga na tela seguinte.{" "}
              <a className="font-semibold text-navy underline" href={`/api/importacao/modelo?tipo=${carga}`}>
                Baixar a planilha-modelo
              </a>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type DotacaoLinha = {
  id: string;
  codigo: string;
  ficha: string | null;
  acao: string;
  programa: string;
  unidade: string;
  funcional: string;
  natureza: string;
  fonte: string;
  valor: number;
  emendas: number;
  emendavel: boolean;
};

export function ListaDotacoes({ linhas }: { linhas: DotacaoLinha[] }) {
  return (
    <FiltroLista
      itens={linhas}
      porPagina={40}
      texto={(d) => `${d.codigo} ${d.ficha ?? ""} ${d.acao} ${d.programa} ${d.unidade} ${d.natureza}`}
      filtros={{
        rotulo: "Recorte",
        opcoes: {
          Todas: () => true,
          "Recebem emenda": (d) => d.emendavel,
          "Com emendas": (d) => d.emendas > 0,
        },
      }}
      render={(d) => (
        <div key={d.id} className="flex flex-wrap items-start gap-3 rounded-box bg-soft px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <b>
              {d.codigo} — {d.acao}
            </b>
            <span className="block text-xs text-muted-foreground">
              {d.unidade} · {d.funcional} · {d.programa}
            </span>
            <span className="block text-xs text-muted-foreground">
              {d.natureza} · fonte {d.fonte}
              {d.ficha ? ` · ficha ${d.ficha}` : ""}
            </span>
          </div>
          <div className="text-right">
            <b className="tnum">{BRL(d.valor)}</b>
            <div className="mt-1 flex justify-end gap-1">
              {d.emendavel ? <Selo tipo="info">recebe emenda</Selo> : null}
              {d.emendas ? <Selo tipo="ok">{d.emendas} emenda(s)</Selo> : null}
            </div>
          </div>
        </div>
      )}
    />
  );
}
