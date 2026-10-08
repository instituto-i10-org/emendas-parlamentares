"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirmarImpacto } from "@/components/app/confirmar-impacto";
import { Button } from "@/components/ui/button";
import type { Resultado } from "@/lib/actions/config";
import type { PedidoImpacto } from "@/lib/impacto/servidor";

// Botão que chama uma server action, avisa o resultado e recarrega a página.
// Com `impacto`, abre antes a janela de confirmação com o que muda e quantas
// emendas a alteração alcança; com `confirmar`, uma confirmação simples.
export function BotaoAcao({
  acao,
  children,
  variante = "ghost",
  tamanho = "xs",
  confirmar,
  impacto,
  titulo,
  rotulo,
  destrutiva,
  exclusao,
  desabilitado,
  guia,
}: {
  acao: (ciente: boolean) => Promise<Resultado>;
  children: ReactNode;
  variante?: "default" | "ghost" | "destructive" | "surface";
  tamanho?: "xs" | "sm" | "default";
  confirmar?: string;
  impacto?: PedidoImpacto;
  // Título e botão da janela de confirmação.
  titulo?: string;
  rotulo?: string;
  destrutiva?: boolean;
  // Exclusão: pede para digitar EXCLUIR antes de liberar.
  exclusao?: boolean;
  desabilitado?: boolean;
  // Âncora do guia de ajuda.
  guia?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const conf = useConfirmarImpacto();
  const pedeConfirmacao = !!(confirmar || impacto);
  return (
    <>
      <Button
        data-guia={guia}
        variant={variante}
        size={tamanho}
        disabled={pendente || conf.pendente || desabilitado}
        onClick={() => {
          if (pedeConfirmacao) {
            conf.pedir({ titulo: titulo ?? (typeof children === "string" ? children : "Confirmar"), mensagem: confirmar, impacto, rotulo, destrutiva, exclusao, acao });
            return;
          }
          iniciar(async () => {
            const r = await acao(false);
            if (!r.ok) return void toast.error(r.erro);
            if (r.mensagem) toast(r.mensagem);
            router.refresh();
          });
        }}
      >
        {children}
      </Button>
      {pedeConfirmacao ? conf.janela : null}
    </>
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
