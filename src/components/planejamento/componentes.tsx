"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { FiltroLista } from "@/components/app/filtro-lista";
import { Campo, CampoNumero, Pilulas, Selo } from "@/components/emenda/ui";
import { Ajuda } from "@/components/ui/ajuda";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CampoArquivo, type ArquivoValor } from "@/components/app/campo-arquivo";
import { criarInstrumento, definirStatusInstrumento, editarInstrumento, excluirInstrumento, importarBase } from "@/lib/actions/planejamento";
import { lerNumero } from "@/lib/emendas/estado";
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

// Avança ou volta um passo no ciclo de vida do instrumento.
export function StatusInstrumento({ id, status, podeGerir }: { id: string; status: string; podeGerir: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const i = SEQUENCIA.indexOf(status as (typeof SEQUENCIA)[number]);
  const mover = (para: (typeof SEQUENCIA)[number]) =>
    iniciar(async () => {
      const r = await definirStatusInstrumento(id, para);
      if (!r.ok) return void toast.error(r.erro);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Largura fixa: as setas ficam na mesma coluna em todas as linhas. */}
      <span className="w-[120px]">
        <Selo tipo={status === "EM_TRAMITACAO" ? "info" : status === "VIGENTE" ? "ok" : "neutro"}>{ROTULO_STATUS[status]}</Selo>
      </span>
      {podeGerir && i > 0 ? (
        <Button size="xs" variant="ghost" disabled={pendente} onClick={() => mover(SEQUENCIA[i - 1])} title={`Voltar para ${ROTULO_STATUS[SEQUENCIA[i - 1]]}`}>
          ←
        </Button>
      ) : null}
      {podeGerir && i < SEQUENCIA.length - 1 ? (
        <Button size="xs" variant="ghost" disabled={pendente} onClick={() => mover(SEQUENCIA[i + 1])}>
          {ROTULO_STATUS[SEQUENCIA[i + 1]]} →
        </Button>
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
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={pendente}
      onClick={() =>
        window.confirm(`Excluir ${rotulo}? Só é possível sem base de dotações e sem lei vinculada.`) &&
        iniciar(async () => {
          const r = await excluirInstrumento(id);
          if (!r.ok) return void toast.error(r.erro);
          toast(r.mensagem ?? "Instrumento excluído.");
          router.refresh();
        })
      }
    >
      Excluir
    </Button>
  );
}

export function ImportarBase({ instrumentoId, rotulo }: { instrumentoId: string; rotulo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erros, setErros] = useState<{ linha: number; motivo: string }[]>([]);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setAberto(true)}>
        <Upload className="size-3.5" /> Importar base
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent titulo={`Importar base de dotações — ${rotulo}`} largura="lg">
          <form
            action={(fd) =>
              iniciar(async () => {
                setErros([]);
                const r = await importarBase(instrumentoId, fd);
                if (!r.ok) {
                  toast.error(r.erro);
                  setErros(r.erros ?? []);
                  return;
                }
                toast(r.mensagem);
                setAberto(false);
                router.refresh();
              })
            }
            className="grid gap-4"
          >
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              Planilha CSV ou XLSX, uma linha por dotação.
              <Ajuda titulo="Colunas da planilha">
                Obrigatórias: orgao_codigo, orgao_nome, unidade_codigo, unidade_nome, funcao_codigo, subfuncao_codigo, subfuncao_nome,
                programa_codigo, programa_nome, acao_codigo, acao_nome, natureza_codigo, fonte_codigo, valor_autorizado. Opcionais: funcao_nome,
                acao_tipo, natureza_nome, fonte_nome, ficha, pagina. Qualquer erro rejeita o arquivo inteiro; dotações já usadas por emendas são
                preservadas.
              </Ajuda>
            </p>
            <input name="arquivo" type="file" accept=".csv,.xlsx,.xls" className="text-sm" required />
            <div>
              <Button type="submit" disabled={pendente}>
                {pendente ? "Importando…" : "Importar"}
              </Button>
            </div>
            {erros.length ? (
              <ul className="max-h-60 overflow-y-auto rounded-box bg-bad-bg p-3 text-xs text-bad-ink">
                {erros.map((e, i) => (
                  <li key={i}>
                    {e.linha ? `Linha ${e.linha}: ` : ""}
                    {e.motivo}
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
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
