"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apagarEmendaDeTeste } from "@/lib/actions/emendas";

// Apagar uma emenda de teste (conta de demonstração) já submetida, com
// confirmação. Na lista é um ícone; na página da emenda, um botão.
export function ApagarEmendaTeste({ id, rotulo, comoBotao = false }: { id: string; rotulo: string; comoBotao?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      {comoBotao ? (
        <Button variant="ghost" onClick={() => setAberto(true)}>
          <Trash2 className="size-4" />
          Apagar emenda de teste
        </Button>
      ) : (
        <button
          type="button"
          aria-label={`Apagar a emenda de teste ${rotulo}`}
          title="Apagar emenda de teste"
          onClick={() => setAberto(true)}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-bad-bg hover:text-bad-ink focus-visible:outline-2 focus-visible:outline-cyan"
        >
          <Trash2 className="size-4" />
        </button>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo="Apagar esta emenda de teste?"
          largura="sm"
          acoes={
            <>
              <Button
                variant="destructive"
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await apagarEmendaDeTeste(id);
                    if (!r.ok) return void toast.error(r.erro ?? "Não foi possível apagar.");
                    toast("Emenda de teste apagada.");
                    setAberto(false);
                    if (comoBotao) router.push("/emendas");
                    router.refresh();
                  })
                }
              >
                {pendente ? "Apagando…" : "Apagar"}
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Manter emenda
              </Button>
            </>
          }
        >
          <p className="text-sm">
            <b>{rotulo}</b> será apagada com o plano de trabalho, os pareceres e os lançamentos de execução, e não poderá ser recuperada. O valor volta
            para a cota. Só emendas da conta de demonstração podem ser apagadas; a exclusão fica registrada na auditoria.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
