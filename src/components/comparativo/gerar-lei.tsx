"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { gerarLeiDoProjeto } from "@/lib/actions/planejamento";

export function GerarLei({ ano }: { ano: number }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      variant="surface"
      disabled={pendente}
      onClick={() => {
        if (!window.confirm("Gerar a base da lei aprovada a partir do projeto somado às emendas incorporadas?")) return;
        iniciar(async () => {
          const r = await gerarLeiDoProjeto(ano);
          if (!r.ok) return void toast.error(r.erro);
          toast(r.mensagem);
          router.refresh();
        });
      }}
    >
      {pendente ? "Gerando…" : "Gerar base da lei"}
    </Button>
  );
}
