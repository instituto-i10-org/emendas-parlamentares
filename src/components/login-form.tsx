"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Building2, ChevronDown, Landmark, ShieldCheck, UserRound, UsersRound, type LucideIcon, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type LoginState } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

// Contas criadas pelo seed (prisma/seed/acesso.ts).
const CONTAS: { grupo: string; contas: { nome: string; papel: string; email: string; icone: LucideIcon }[] }[] = [
  { grupo: "Acesso master", contas: [{ nome: "Administrador Geral", papel: "acesso total; compõe os perfis", email: "admin@emendas360.local", icone: ShieldCheck }] },
  {
    grupo: "Câmara",
    contas: [
      { nome: "Vereador Exemplo", papel: "gabinete: a própria cota", email: "vereador@emendas360.local", icone: UserRound },
      { nome: "Presidente da Câmara", papel: "apresenta, tramita e administra", email: "presidente@emendas360.local", icone: Landmark },
      { nome: "Comissão de Finanças", papel: "gere e tramita; não apresenta", email: "comissao@emendas360.local", icone: UsersRound },
    ],
  },
  { grupo: "Prefeitura", contas: [{ nome: "Poder Executivo", papel: "planejamento, viabilidade e execução", email: "executivo@emendas360.local", icone: Building2 }] },
  { grupo: "Fiscalização", contas: [{ nome: "Controle Interno", papel: "somente consulta: vê tudo, não altera", email: "consulta@emendas360.local", icone: Eye }] },
];

export function LoginForm({
  senhaDemo,
  avisoSemPerfil = false,
  avisoInativa = false,
}: {
  senhaDemo?: string;
  avisoSemPerfil?: boolean;
  avisoInativa?: boolean;
}) {
  const [erro, action, pending] = useActionState<LoginState, FormData>(entrar, null);
  const [aberto, setAberto] = useState(false);

  const formulario = (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );

  return (
    <div className="space-y-5">
      {avisoInativa && !erro ? (
        <p role="status" className="rounded-field bg-warn-bg px-3 py-2.5 text-sm font-semibold text-warn">
          Sua conta está desativada. Procure o administrador do sistema.
        </p>
      ) : null}
      {avisoSemPerfil && !erro ? (
        <p role="status" className="rounded-field bg-warn-bg px-3 py-2.5 text-sm font-semibold text-warn">
          Sua conta ainda não tem um perfil de acesso. Procure o administrador do sistema.
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="rounded-field bg-bad-bg px-3 py-2.5 text-sm font-semibold text-bad-ink">
          {erro}
        </p>
      ) : null}

      {senhaDemo ? (
        <>
          {/* Acesso rápido: cada perfil é um botão de envio deste formulário. Funciona
              antes de o JavaScript carregar — o clique nunca se perde. */}
          <form action={action} className="space-y-4">
            <input type="hidden" name="senha" value={senhaDemo} />
            {CONTAS.map((g) => (
              <div key={g.grupo}>
                <div className="antena pb-1.5">{g.grupo}</div>
                <div className="grid gap-2">
                  {g.contas.map((c) => {
                    const Icone = c.icone;
                    return (
                      <button
                        key={c.email}
                        type="submit"
                        name="email"
                        value={c.email}
                        disabled={pending}
                        className="group flex w-full items-center gap-3 rounded-box border border-line bg-surface px-3.5 py-3 text-left transition-all hover:-translate-y-px hover:border-cyan hover:shadow-card focus-visible:outline-2 focus-visible:outline-cyan disabled:opacity-50"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-field bg-navy text-cyan">
                          <Icone className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{c.nome}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.papel}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-navy" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </form>
          <div className="rounded-box bg-soft p-1.5">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-bold"
            >
              Entrar com e-mail e senha
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} aria-hidden />
            </button>
            {aberto ? <div className="px-3 pt-1 pb-3">{formulario}</div> : null}
          </div>
        </>
      ) : (
        formulario
      )}
    </div>
  );
}
