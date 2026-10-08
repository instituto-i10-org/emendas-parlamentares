"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DigitarParaConfirmar, useDigitarParaConfirmar } from "./digitar-para-confirmar";

// Confirmação simples na janela do sistema, no lugar do window.confirm do
// navegador: `if (!(await confirmar({ ... }))) return;`. A janela vai junto
// na tela (`{janela}`).
export type OpcoesConfirmar = {
  titulo: string;
  mensagem: ReactNode;
  rotulo?: string;
  destrutiva?: boolean;
  // Exclusão: o botão só se libera depois de digitar EXCLUIR.
  exclusao?: boolean;
};

export function useConfirmar() {
  const [atual, setAtual] = useState<OpcoesConfirmar | null>(null);
  const resolver = useRef<((sim: boolean) => void) | null>(null);
  const digitado = useDigitarParaConfirmar();
  const { setTexto } = digitado;

  const confirmar = useCallback((o: OpcoesConfirmar) => {
    resolver.current?.(false);
    setTexto("");
    setAtual(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [setTexto]);

  const responder = (sim: boolean) => {
    resolver.current?.(sim);
    resolver.current = null;
    setAtual(null);
  };

  const janela = (
    <Dialog open={!!atual} onOpenChange={(aberto) => (aberto ? null : responder(false))}>
      {atual ? (
        <DialogContent
          titulo={atual.titulo}
          acoes={
            <>
              <Button variant={atual.destrutiva ? "destructive" : "default"} disabled={!!atual.exclusao && !digitado.liberado} onClick={() => responder(true)}>
                {atual.rotulo ?? "Confirmar"}
              </Button>
              <Button variant="ghost" onClick={() => responder(false)}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className="text-sm leading-relaxed">{atual.mensagem}</div>
          {atual.exclusao ? <DigitarParaConfirmar texto={digitado.texto} aoMudar={digitado.setTexto} /> : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );

  return { confirmar, janela };
}
