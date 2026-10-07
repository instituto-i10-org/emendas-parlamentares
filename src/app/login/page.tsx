import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { LogoEmendas360 } from "@/components/logo-emendas360";

export const metadata: Metadata = { title: "Entrar — Emendas360" };

// Acesso rápido de demonstração: só existe com DEMO_SENHA definida no ambiente
// (a senha das contas do seed). Sem ela, o painel não aparece.
const SENHA_DEMO = process.env.DEMO_LOGIN === "false" ? undefined : process.env.DEMO_SENHA || undefined;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-cyan/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-ok/10 blur-3xl" aria-hidden />
        <Link href="/" className="relative w-fit">
          <LogoEmendas360 />
        </Link>
        <div className="relative max-w-[460px]">
          <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em]">
            A emenda descrita em linguagem comum, classificada contra a LOA do exercício.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            O sistema encontra a dotação, monta o plano de trabalho no modelo certo e confere cota, reserva da saúde e documentação antes de a emenda
            seguir.
          </p>
        </div>
        <div className="relative flex gap-8">
          {[
            ["Classificação", "dotação da LOA"],
            ["Plano de trabalho", "Modelos I a IV"],
            ["Validação", "antes de submeter"],
          ].map(([t, s]) => (
            <div key={t}>
              <div className="text-2xs font-bold tracking-[1.4px] text-ok uppercase">{t}</div>
              <div className="text-sm font-semibold text-white/80">{s}</div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex flex-col items-center justify-center gap-4 bg-page p-6 max-sm:p-4">
        <div className="w-full max-w-[440px]">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> Voltar ao site
          </Link>
        </div>
        <div className="w-full max-w-[440px] rounded-card bg-surface p-8 shadow-card max-sm:p-6">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em]">Entrar na plataforma</h1>
          <p className="mt-1.5 mb-6 text-sm text-muted-foreground">{SENHA_DEMO ? "Escolha um perfil para entrar." : "Use o e-mail e a senha da sua conta."}</p>
          <LoginForm senhaDemo={SENHA_DEMO} avisoSemPerfil={erro === "sem-perfil"} avisoInativa={erro === "inativo"} />
        </div>
      </main>
    </div>
  );
}
