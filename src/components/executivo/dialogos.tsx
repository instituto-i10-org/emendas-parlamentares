"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Campo, CampoNumero, Pilulas } from "@/components/emenda/ui";
import { registrarAndamento, registrarParecerViabilidade } from "@/lib/actions/tramitacao";
import { lerNumero } from "@/lib/emendas/estado";

const RESULTADOS = { Viável: "VIAVEL", "Viável com ressalva": "VIAVEL_COM_RESSALVA", Inviável: "INVIAVEL" } as const;
type RotuloResultado = keyof typeof RESULTADOS;

// Parecer de viabilidade técnica: informativo, sempre um registro novo.
export function ParecerDialog({ emendaId, rotulo, jaTem }: { emendaId: string; rotulo: string; jaTem: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState<RotuloResultado>("Viável");
  const [justificativa, setJustificativa] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Button
        size="sm"
        variant={jaTem ? "ghost" : "default"}
        onClick={() => {
          setResultado("Viável");
          setJustificativa("");
          setAberto(true);
        }}
      >
        {jaTem ? "Novo parecer" : "Manifestar-se"}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo={`Parecer de viabilidade — ${rotulo}`}
          descricao="O parecer é informativo: não altera a emenda nem trava a tramitação. Vale o mais recente; o histórico é preservado."
          acoes={
            <>
              <Button
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await registrarParecerViabilidade({ emendaId, resultado: RESULTADOS[resultado], justificativa });
                    if (!r.ok) return void toast.error(r.erro);
                    toast("Parecer registrado.");
                    setAberto(false);
                    setJustificativa("");
                    router.refresh();
                  })
                }
              >
                {pendente ? "Registrando…" : "Registrar parecer"}
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-label">Resultado</p>
              <Pilulas rotulo="Resultado" opcoes={Object.keys(RESULTADOS) as RotuloResultado[]} valor={resultado} aoEscolher={setResultado} />
            </div>
            <Campo rotulo="Justificativa" obrigatorio htmlFor="just-viab">
              <textarea
                id="just-viab"
                className="campo min-h-[140px] p-3.5"
                maxLength={4000}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Fundamente o parecer (ao menos 20 caracteres)."
              />
            </Campo>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ETAPAS = { Empenho: "EMPENHO", Liquidação: "LIQUIDACAO", Pagamento: "PAGAMENTO" } as const;
type RotuloEtapa = keyof typeof ETAPAS;

// Lançamento de empenho, liquidação ou pagamento. Estorno é valor negativo.
export function AndamentoDialog({ emendaId, rotulo }: { emendaId: string; rotulo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<RotuloEtapa>("Empenho");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState("");
  const [estorno, setEstorno] = useState(false);
  const [documento, setDocumento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          // Cada lançamento começa limpo.
          setEtapa("Empenho");
          setData(new Date().toISOString().slice(0, 10));
          setValor("");
          setEstorno(false);
          setDocumento("");
          setObservacao("");
          setAberto(true);
        }}
      >
        Lançar andamento
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo={`Execução — ${rotulo}`}
          descricao="Cada etapa é cumulativa: não se liquida além do empenhado, nem se paga além do liquidado, e o empenho não passa do valor aprovado."
          acoes={
            <>
              <Button
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const v = lerNumero(valor) * (estorno ? -1 : 1);
                    const r = await registrarAndamento({
                      emendaId,
                      etapa: ETAPAS[etapa],
                      data,
                      valor: v,
                      numeroDocumento: documento,
                      observacao,
                    });
                    if (!r.ok) return void toast.error(r.erro);
                    toast(`${etapa}${estorno ? " (estorno)" : ""} lançado.`);
                    setAberto(false);
                    setValor("");
                    setDocumento("");
                    setObservacao("");
                    setEstorno(false);
                    router.refresh();
                  })
                }
              >
                {pendente ? "Lançando…" : "Lançar"}
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-label">Etapa</p>
              <Pilulas rotulo="Etapa" opcoes={Object.keys(ETAPAS) as RotuloEtapa[]} valor={etapa} aoEscolher={setEtapa} />
            </div>
            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <Campo rotulo="Data" obrigatorio htmlFor="and-data">
                <input id="and-data" type="date" className="campo h-12 px-3.5" value={data} onChange={(e) => setData(e.target.value)} />
              </Campo>
              <Campo rotulo="Valor" obrigatorio htmlFor="and-valor">
                <CampoNumero id="and-valor" valor={valor} aoMudar={setValor} prefixo="R$ " placeholder="R$ 0,00" />
              </Campo>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={estorno} onChange={(e) => setEstorno(e.target.checked)} /> Estorno (lança o valor como negativo)
            </label>
            <Campo rotulo="Número do documento" htmlFor="and-doc">
              <input
                id="and-doc"
                className="campo h-12 px-3.5"
                maxLength={120}
                placeholder="nº do empenho, da liquidação ou da ordem de pagamento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
              />
            </Campo>
            <Campo rotulo="Observação" htmlFor="and-obs">
              <input id="and-obs" className="campo h-12 px-3.5" maxLength={1000} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </Campo>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
