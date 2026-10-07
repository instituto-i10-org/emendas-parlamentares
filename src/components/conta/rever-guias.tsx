"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reverTodosGuias } from "@/lib/actions/guias";

// Os guias de ajuda voltam a abrir na próxima visita a cada tela.
export function ReverGuias() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-xl text-sm text-muted-foreground">
        Cada tela tem um guia em balões que abre sozinho na primeira visita. Para vê-los de novo, clique abaixo; para ver só o da tela em que estiver, use
        “Ver ajuda” no menu.
      </p>
      <Button
        variant="surface"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await reverTodosGuias();
            if (!r.ok) return void toast.error(r.erro);
            toast(r.mensagem ?? "Pronto.");
            router.refresh();
          })
        }
      >
        Rever todos os guias
      </Button>
    </div>
  );
}
