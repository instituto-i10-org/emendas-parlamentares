"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Campo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { concluirPrimeiroAcesso } from "@/lib/actions/config";

// Primeiro acesso de conta criada pelo administrador: antes de qualquer tela,
// a pessoa confere nome e e-mail e troca a senha temporária. Obrigatório: não
// fecha até concluir, e volta em qualquer página enquanto não for concluído.
export function PrimeiroAcesso({ nome, email }: { nome: string; email: string }) {
  const router = useRouter();
  const [f, setF] = useState({ nome, email, nova: "", confirmacao: "" });
  const [pendente, iniciar] = useTransition();
  const concluir = () =>
    iniciar(async () => {
      const r = await concluirPrimeiroAcesso(f);
      if (!r.ok) return void toast.error(r.erro);
      toast(r.mensagem ?? "Tudo certo.");
      router.refresh();
    });
  return (
    <Dialog open>
      <DialogContent
        fixo
        titulo="Bem-vindo ao Emendas360"
        aviso="Antes de começar, confira os seus dados e troque a senha temporária que o administrador informou."
        acoes={
          <Button disabled={pendente} onClick={concluir}>
            {pendente ? "Salvando…" : "Concluir"}
          </Button>
        }
      >
        <form
          className="grid gap-4"
          // Enter num campo conclui, como o botão do rodapé.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              concluir();
            }
          }}
          onSubmit={(e) => e.preventDefault()}
        >
          <Campo rotulo="Seu nome" obrigatorio htmlFor="pa-nome">
            <input id="pa-nome" className="campo h-12 px-3.5" autoComplete="name" maxLength={200} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </Campo>
          <Campo rotulo="Seu e-mail" obrigatorio htmlFor="pa-email" dica="É o e-mail que você usa para entrar.">
            <input id="pa-email" type="email" className="campo h-12 px-3.5" autoComplete="email" maxLength={200} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Campo>
          <Campo rotulo="Nova senha" obrigatorio htmlFor="pa-nova" dica="Ao menos 10 caracteres, diferente da senha temporária.">
            <input id="pa-nova" type="password" className="campo h-12 px-3.5" autoComplete="new-password" value={f.nova} onChange={(e) => setF({ ...f, nova: e.target.value })} />
          </Campo>
          <Campo rotulo="Confirme a nova senha" obrigatorio htmlFor="pa-conf">
            <input id="pa-conf" type="password" className="campo h-12 px-3.5" autoComplete="new-password" value={f.confirmacao} onChange={(e) => setF({ ...f, confirmacao: e.target.value })} />
          </Campo>
        </form>
      </DialogContent>
    </Dialog>
  );
}
