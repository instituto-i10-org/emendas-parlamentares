import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Banknote, Check, FileText, Search, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { LogoEmendas360 } from "@/components/logo-emendas360";
import { auth } from "@/lib/auth";
import { consolidar } from "@/lib/emendas/consultas";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL } from "@/lib/riep";

export const metadata: Metadata = { title: "Emendas360 — emendas impositivas do pedido à execução" };

const RECURSOS = [
  {
    icone: Wand2,
    titulo: "Escreva como fala",
    texto: "O vereador descreve a emenda em linguagem comum. O sistema reconhece o objeto e sugere a dotação da LOA.",
  },
  {
    icone: FileText,
    titulo: "Plano de trabalho pronto",
    texto: "Metas, memória de cálculo e o modelo certo de plano, montados a partir da própria emenda.",
  },
  {
    icone: ShieldCheck,
    titulo: "Conferência antes de enviar",
    texto: "Cota, reserva da saúde, preços e documentos checados antes de a emenda seguir.",
  },
  {
    icone: Banknote,
    titulo: "Execução à vista",
    texto: "Empenho, liquidação e pagamento registrados e publicados para qualquer cidadão.",
  },
];

const PASSOS = [
  { titulo: "Indica", texto: "O vereador indica o que será feito e onde, dentro da sua cota." },
  { titulo: "Tramita", texto: "A Câmara analisa e aprova; o Executivo se manifesta sobre a viabilidade." },
  { titulo: "Executa", texto: "A Prefeitura executa e cada etapa fica registrada no portal." },
];

// Landing pública: a porta de entrada do sistema e do portal de transparência.
export default async function Landing() {
  const [sessao, ano, municipio] = await Promise.all([auth(), getAnoAtivo(), prisma.municipio.findFirst()]);
  const c = ano ? await consolidar(ano) : null;
  const logado = !!sessao?.user;
  const emendas = c ? ["SUBMETIDA", "APROVADA", "IMPORTADA"].reduce((s, k) => s + (c.porStatus[k]?.qtd ?? 0), 0) : 0;
  const numeros = c
    ? [
        { valor: BRL(c.total), rotulo: "indicados em emendas" },
        { valor: BRL(c.saude), rotulo: "destinados à saúde" },
        { valor: String(emendas), rotulo: "emendas no exercício" },
        { valor: String(c.numeroVereadores), rotulo: "vereadores" },
      ]
    : [];

  return (
    <div className="min-h-dvh bg-page">
      <section className="relative overflow-hidden bg-navy-deep text-white">
        {/* textura e brilhos */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -top-40 right-[-10%] size-[560px] rounded-full bg-cyan/25 blur-[120px]" aria-hidden />
        <div className="pointer-events-none absolute bottom-[-30%] left-[-10%] size-[520px] rounded-full bg-ok/15 blur-[120px]" aria-hidden />

        <header className="relative mx-auto flex max-w-6xl items-center gap-4 px-6 py-5 max-sm:px-4">
          <Link href="/" aria-label="Emendas360 — início">
            <LogoEmendas360 />
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm font-semibold">
            <Link href="/publica/emendas" className="rounded-md px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white max-sm:hidden">
              Consultar emendas
            </Link>
            <Link href="/publica/manual" className="rounded-md px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white max-sm:hidden">
              Como funciona
            </Link>
            <Link
              href={logado ? "/inicio" : "/login"}
              className="ml-2 rounded-field bg-white px-4 py-2 font-bold text-navy transition-transform hover:-translate-y-px"
            >
              {logado ? "Abrir o sistema" : "Entrar"}
            </Link>
          </nav>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pt-10 pb-28 max-sm:px-4 lg:grid-cols-[1.1fr_1fr] lg:pt-16 lg:pb-36">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur">
              <Sparkles className="size-3.5 text-cyan" aria-hidden />
              {municipio ? `${municipio.nome}/${municipio.uf}` : "Orçamento municipal"}
              {ano ? ` · exercício ${ano}` : ""}
            </span>
            <h1 className="mt-6 text-[clamp(34px,5.2vw,58px)] leading-[1.04] font-extrabold tracking-[-0.04em]">
              Emendas impositivas,
              <br />
              do pedido à{" "}
              <span className="bg-gradient-to-r from-cyan to-ok bg-clip-text text-transparent">obra entregue.</span>
            </h1>
            <p className="mt-5 max-w-[520px] text-lg leading-relaxed text-white/70">
              Um só lugar para o vereador indicar, a Câmara tramitar, a Prefeitura executar e o cidadão acompanhar cada real.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={logado ? "/inicio" : "/login"}
                className="group inline-flex h-13 items-center gap-2 rounded-field bg-cyan px-6 text-base font-bold text-navy-deep shadow-[0_10px_30px_rgba(0,200,230,.35)] transition-transform hover:-translate-y-0.5"
              >
                {logado ? "Abrir o sistema" : "Entrar no sistema"}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
              <Link
                href="/publica"
                className="inline-flex h-13 items-center gap-2 rounded-field border border-white/20 px-6 text-base font-bold text-white transition-colors hover:bg-white/10"
              >
                <Search className="size-5" aria-hidden /> Ver o portal público
              </Link>
            </div>
          </div>

          <DemoEmenda />
        </div>
      </section>

      {numeros.length ? (
        <section className="relative z-10 mx-auto -mt-16 max-w-6xl px-6 max-sm:px-4">
          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-card bg-hair shadow-modal max-md:grid-cols-2">
            {numeros.map((n) => (
              <div key={n.rotulo} className="bg-surface px-6 py-6">
                <div className="text-[clamp(20px,2.4vw,28px)] font-extrabold tracking-[-0.03em] text-navy tnum">{n.valor}</div>
                <div className="mt-1 text-sm text-muted-foreground">{n.rotulo}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 py-20 max-sm:px-4">
        <p className="antena text-center">Por que Emendas360</p>
        <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-extrabold tracking-[-0.03em]">
          A tecnologia faz a parte técnica. As pessoas decidem.
        </h2>
        <div className="mt-12 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="group rounded-card bg-surface p-6 shadow-card transition-transform hover:-translate-y-1">
              <div className="grid size-12 place-items-center rounded-box bg-gradient-to-br from-navy to-navy-soft text-cyan shadow-side">
                <r.icone className="size-6" aria-hidden />
              </div>
              <h3 className="mt-5 text-md font-bold">{r.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 max-sm:px-4">
        <div className="grid gap-4 md:grid-cols-3">
          {PASSOS.map((p, i) => (
            <div key={p.titulo} className="relative rounded-card border border-line bg-surface/60 p-6">
              <span className="text-5xl font-extrabold tracking-[-0.05em] text-cyan/40 tnum">0{i + 1}</span>
              <h3 className="mt-2 text-xl font-extrabold tracking-[-0.02em]">{p.titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 max-sm:px-4">
        <div className="relative overflow-hidden rounded-card bg-navy px-10 py-12 text-white max-sm:px-6">
          <div className="pointer-events-none absolute -right-20 -bottom-24 size-80 rounded-full bg-cyan/25 blur-3xl" aria-hidden />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Transparência não é relatório no fim do ano.</h2>
              <p className="mt-2 max-w-xl text-white/70">Qualquer pessoa consulta as emendas por vereador, objeto ou destino, sem login.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/publica/emendas" className="inline-flex h-12 items-center rounded-field bg-white px-5 font-bold text-navy">
                Consultar emendas
              </Link>
              <Link href={logado ? "/inicio" : "/login"} className="inline-flex h-12 items-center rounded-field border border-white/25 px-5 font-bold hover:bg-white/10">
                {logado ? "Abrir o sistema" : "Entrar"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-6 pb-10 text-xs text-muted-foreground max-sm:px-4">
        <span>Emendas360 · orçamento impositivo municipal</span>
        <span className="flex gap-4">
          <Link href="/publica" className="hover:underline">
            Portal público
          </Link>
          <Link href="/publica/manual" className="hover:underline">
            Como funciona
          </Link>
        </span>
      </footer>
    </div>
  );
}

// Cartão ilustrativo: a emenda escrita em linguagem comum virando classificação.
function DemoEmenda() {
  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-6 duration-1000 max-lg:hidden" aria-hidden>
      <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-cyan/20 to-transparent blur-2xl" />
      <div className="relative rounded-[24px] border border-white/10 bg-white/[0.06] p-6 shadow-modal backdrop-blur-xl">
        <div className="text-2xs font-bold tracking-[0.14em] text-white/50 uppercase">O vereador escreve</div>
        <p className="mt-2 rounded-box bg-white/10 px-4 py-3 text-[15px] text-white">
          “Comprar uma ambulância para o posto de saúde do Jardim Ypê”
          <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-cyan" />
        </p>
        <div className="my-4 flex items-center gap-2 text-xs font-semibold text-cyan">
          <Sparkles className="size-4" /> o sistema entende
        </div>
        <div className="grid gap-2">
          <Linha rotulo="Objeto" valor="Veículo · ambulância" />
          <Linha rotulo="Área" valor="Saúde · atenção básica" />
          <Linha rotulo="Dotação" valor="10.301 · equipamentos e material permanente" />
          <Linha rotulo="Plano" valor="Modelo de aquisição de bens" />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-box bg-ok/15 px-4 py-3">
          <span className="text-sm font-bold text-white">Dentro da cota e da reserva da saúde</span>
          <span className="grid size-7 place-items-center rounded-full bg-ok text-white">
            <Check className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 px-3.5 py-2.5 text-sm">
      <span className="text-white/55">{rotulo}</span>
      <span className="text-right font-semibold text-white">{valor}</span>
    </div>
  );
}
