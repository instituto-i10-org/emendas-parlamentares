"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Pilulas } from "@/components/emenda/ui";
import { decidirTramitacao, pedirDiligencia, reabrirTramitacao } from "@/lib/actions/tramitacao";

// Decisão da Comissão sobre uma emenda submetida: aprovar ou rejeitar, sempre
// com parecer escrito.
export function DecidirEmenda({ emendaId, rotulo }: { emendaId: string; rotulo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [decisao, setDecisao] = useState<"Aprovar" | "Rejeitar" | null>(null);
  const [parecer, setParecer] = useState("");
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    if (!decisao) return toast("Escolha aprovar ou rejeitar.");
    iniciar(async () => {
      const r = await decidirTramitacao({ emendaId, decisao: decisao === "Aprovar" ? "APROVADA" : "REJEITADA", parecer });
      if (!r.ok) return void toast.error(r.erro);
      toast(decisao === "Aprovar" ? "Emenda aprovada." : "Emenda rejeitada.");
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setAberto(true)}>
        Decidir
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo={`Decidir — ${rotulo}`}
          acoes={
            <>
              <Button variant={decisao === "Rejeitar" ? "destructive" : "default"} onClick={confirmar} disabled={pendente}>
                {pendente ? "Registrando…" : decisao ? `${decisao} emenda` : "Registrar decisão"}
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-label">Decisão</p>
              <Pilulas rotulo="Decisão" opcoes={["Aprovar", "Rejeitar"] as const} valor={decisao} aoEscolher={setDecisao} />
            </div>
            <div>
              <label htmlFor="parecer" className="mb-1.5 block text-sm font-semibold text-label">
                Parecer <span className="text-muted-foreground">*</span>
              </label>
              <textarea
                id="parecer"
                className="campo min-h-[140px] p-3.5"
                maxLength={4000}
                value={parecer}
                onChange={(e) => setParecer(e.target.value)}
                placeholder="Fundamente a decisão da Comissão (ao menos 20 caracteres)."
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Diligência: a Comissão devolve a emenda ao autor para sanear, com prazo
// (Regimento Interno, art. 210-C, § 2º — até 5 dias).
export function PedirAjuste({ emendaId, rotulo }: { emendaId: string; rotulo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState(5);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setAberto(true)}>
        Pedir ajuste
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo={`Pedir ajuste — ${rotulo}`}
          acoes={
            <>
              <Button
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await pedirDiligencia({ emendaId, motivo, dias });
                    if (!r.ok) return void toast.error(r.erro);
                    toast("Emenda devolvida ao autor para ajuste.");
                    setAberto(false);
                    router.refresh();
                  })
                }
              >
                {pendente ? "Registrando…" : "Devolver para ajuste"}
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              A emenda volta ao autor para sanear vício formal ou completar o plano de trabalho. Ela mantém o número e a cota; ao ser
              reenviada, volta à fila. Vencido o prazo sem reenvio, a Comissão decide.
            </p>
            <div>
              <label htmlFor="dil-motivo" className="mb-1.5 block text-sm font-semibold text-label">
                O que precisa ser sanado <span className="text-muted-foreground">*</span>
              </label>
              <textarea
                id="dil-motivo"
                className="campo min-h-[120px] p-3.5"
                maxLength={4000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o vício ou o que falta no plano de trabalho (ao menos 20 caracteres)."
              />
            </div>
            <div>
              <label htmlFor="dil-dias" className="mb-1.5 block text-sm font-semibold text-label">
                Prazo em dias
              </label>
              <input id="dil-dias" type="number" min={1} max={30} className="campo h-12 w-28 px-3.5" value={dias} onChange={(e) => setDias(Number(e.target.value) || 5)} />
              <span className="ml-2 text-xs text-muted-foreground">O Regimento prevê até 5 dias.</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Devolve à fila uma emenda decidida por engano. Exige motivo.
export function ReabrirEmenda({ emendaId }: { emendaId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setAberto(true)}>
        Reabrir
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo="Devolver à fila de decisão"
          largura="sm"
          aviso="A decisão e o parecer atuais saem da emenda (ficam na auditoria). Só é possível antes de haver execução lançada."
          acoes={
            <>
              <Button
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await reabrirTramitacao(emendaId, motivo);
                    if (!r.ok) return void toast.error(r.erro);
                    toast("Emenda devolvida à fila.");
                    setAberto(false);
                    router.refresh();
                  })
                }
              >
                Devolver à fila
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </>
          }
        >
          <label htmlFor="motivo" className="mb-1.5 block text-sm font-semibold text-label">
            Motivo
          </label>
          <textarea id="motivo" className="campo min-h-[100px] p-3.5" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
