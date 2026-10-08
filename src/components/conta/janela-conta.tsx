"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ReverGuias } from "./rever-guias";
import { TrocarSenha } from "./trocar-senha";

// "Minha conta" numa janela, aberta pelo nome no menu: trocar a senha e rever
// os guias de ajuda. O endereço antigo (/conta) chega aqui com ?conta=1.
export function JanelaConta({ nome, email, children }: { nome: string; email?: string | null; children: (abrir: () => void) => React.ReactNode }) {
  const [aberta, setAberta] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("conta") !== "1") return;
    url.searchParams.delete("conta");
    window.history.replaceState(window.history.state, "", url);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAberta(true);
  }, []);

  return (
    <>
      {children(() => setAberta(true))}
      <Dialog open={aberta} onOpenChange={setAberta}>
        {aberta ? (
          <DialogContent titulo="Minha conta" largura="md">
            <div className="grid gap-6">
              <p className="-mt-2 text-sm text-muted-foreground">
                {nome}
                {email ? ` · ${email}` : ""}
              </p>
              <section data-guia="conta.senha" className="grid gap-3">
                <h3 className="text-sm font-bold">Trocar a senha</h3>
                <TrocarSenha />
              </section>
              <section data-guia="conta.guias" className="grid gap-3 border-t border-hair pt-5">
                <h3 className="text-sm font-bold">Guias de ajuda</h3>
                <ReverGuias />
              </section>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
