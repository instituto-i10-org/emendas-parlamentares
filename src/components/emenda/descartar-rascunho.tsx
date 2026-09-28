"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { excluirRascunho } from "@/lib/actions/emendas";

// Descartar um rascunho direto da lista de emendas, com confirmação.
export function DescartarRascunho({ id, rotulo }: { id: string; rotulo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <button
        type="button"
        aria-label={`Descartar o rascunho ${rotulo}`}
        title="Descartar rascunho"
        onClick={() => setAberto(true)}
        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-bad-bg hover:text-bad-ink focus-visible:outline-2 focus-visible:outline-cyan"
      >
        <Trash2 className="size-4" />
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo="Descartar este rascunho?"
          largura="sm"
          acoes={
            <>
              <Button
                variant="destructive"
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await excluirRascunho(id);
                    if (!r.ok) return void toast.error(r.erro ?? "Não foi possível descartar.");
                    toast("Rascunho descartado.");
                    setAberto(false);
                    router.refresh();
                  })
                }
              >
                {pendente ? "Descartando…" : "Descartar"}
              </Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Manter rascunho
              </Button>
            </>
          }
        >
          <p className="text-sm">
            <b>{rotulo}</b> será excluído e não poderá ser recuperado. A exclusão fica registrada na auditoria.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
