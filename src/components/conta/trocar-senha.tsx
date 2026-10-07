"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Campo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { trocarMinhaSenha } from "@/lib/actions/config";

export function TrocarSenha() {
  const [f, setF] = useState({ atual: "", nova: "", confirma: "" });
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="grid max-w-md gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.nova !== f.confirma) return void toast.error("A confirmação não confere com a nova senha.");
        iniciar(async () => {
          const r = await trocarMinhaSenha(f.atual, f.nova);
          if (!r.ok) return void toast.error(r.erro);
          toast(r.mensagem ?? "Senha trocada.");
          setF({ atual: "", nova: "", confirma: "" });
        });
      }}
    >
      <Campo rotulo="Senha atual" obrigatorio htmlFor="s-atual">
        <input id="s-atual" type="password" autoComplete="current-password" className="campo h-12 px-3.5" value={f.atual} onChange={(e) => setF({ ...f, atual: e.target.value })} />
      </Campo>
      <Campo rotulo="Nova senha" obrigatorio htmlFor="s-nova" dica="Ao menos 10 caracteres.">
        <input id="s-nova" type="password" autoComplete="new-password" className="campo h-12 px-3.5" value={f.nova} onChange={(e) => setF({ ...f, nova: e.target.value })} />
      </Campo>
      <Campo rotulo="Confirme a nova senha" obrigatorio htmlFor="s-conf">
        <input id="s-conf" type="password" autoComplete="new-password" className="campo h-12 px-3.5" value={f.confirma} onChange={(e) => setF({ ...f, confirma: e.target.value })} />
      </Campo>
      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Trocando…" : "Trocar senha"}
        </Button>
      </div>
    </form>
  );
}
