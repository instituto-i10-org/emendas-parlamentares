"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Resultado } from "@/lib/actions/config";

// Botão que chama uma server action, avisa o resultado e recarrega a página.
export function BotaoAcao({
  acao,
  children,
  variante = "ghost",
  tamanho = "xs",
  confirmar,
  desabilitado,
}: {
  acao: () => Promise<Resultado>;
  children: ReactNode;
  variante?: "default" | "ghost" | "destructive" | "surface";
  tamanho?: "xs" | "sm" | "default";
  confirmar?: string;
  desabilitado?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      variant={variante}
      size={tamanho}
      disabled={pendente || desabilitado}
      onClick={() => {
        if (confirmar && !window.confirm(confirmar)) return;
        iniciar(async () => {
          const r = await acao();
          if (!r.ok) return void toast.error(r.erro);
          if (r.mensagem) toast(r.mensagem);
          router.refresh();
        });
      }}
    >
      {children}
    </Button>
  );
}

// Executa uma action de formulário e devolve se deu certo.
export function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const executar = (acao: () => Promise<Resultado>, aoConcluir?: () => void) =>
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) return void toast.error(r.erro);
      if (r.mensagem) toast(r.mensagem);
      aoConcluir?.();
      router.refresh();
    });
  return { pendente, executar };
}
