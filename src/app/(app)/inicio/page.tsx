import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  ClipboardCheck,
  FilePlus2,
  Folder,
  GitBranch,
  Landmark,
  LayoutDashboard,
  List,
  PencilLine,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Barra } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { Poder } from "@/generated/prisma/enums";
import {
  alcancaPoder,
  podeAdministrarConfiguracoes,
  podeAnalisarViabilidade,
  podeCriarEmenda,
  podeGerirPlanejamento,
  podeRegistrarExecucao,
  podeTramitar,
  podeVerTodasEmendas,
} from "@/lib/authz";
import { consolidar, listarEmendas, situacaoCota, type Consolidado } from "@/lib/emendas/consultas";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início — Emendas360" };

type Atalho = { titulo: string; texto: string; href: string; icone: LucideIcon; contador?: number; rotuloContador?: string };

// Grade dos atalhos sem sobra na última linha.
const COLUNAS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-3",
  7: "lg:grid-cols-4",
  8: "lg:grid-cols-4",
  9: "lg:grid-cols-5",
  10: "lg:grid-cols-5",
};

const saudacao = () => {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

// Página inicial de todos os perfis. Em cima, a ação principal e o resumo
// (a cota, para quem apresenta emendas); embaixo, os demais atalhos do perfil.
export default async function InicioPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const user = await getCurrentUser();
  const ano = await getAnoAtivo();
  const [autor, c, emendas] = await Promise.all([
    prisma.autor.findUnique({ where: { usuarioId: user.id } }),
    ano ? consolidar(ano) : null,
    ano ? listarEmendas(ano) : [],
  ]);

  const minhas = autor ? emendas.filter((e) => e.autorId === autor.id) : [];
  const rascunhos = minhas.filter((e) => e.status === "RASCUNHO").length;
  const submetidas = emendas.filter((e) => e.status === "SUBMETIDA").length;
  const semParecer = emendas.filter((e) => e.status !== "RASCUNHO" && !e.pareceres.length).length;
  const aExecutar = emendas.filter((e) => e.status === "APROVADA" && e.somasExec.pago < e.valor.toNumber()).length;

  // Ações do perfil, na ordem de importância. A primeira vira o destaque.
  const acoes: Atalho[] = [];
  if (podeCriarEmenda(user)) {
    acoes.push({ titulo: "Nova emenda", texto: "Descreva o que quer fazer; o sistema classifica e monta o plano.", href: "/emendas/nova", icone: FilePlus2 });
    if (rascunhos) {
      acoes.push({
        titulo: "Concluir rascunhos",
        texto: "Emendas começadas e ainda não submetidas.",
        href: "/emendas",
        icone: PencilLine,
        contador: rascunhos,
        rotuloContador: rascunhos === 1 ? "rascunho" : "rascunhos",
      });
    }
  }
  if (podeTramitar(user)) {
    acoes.push({ titulo: "Tramitar emendas", texto: "Aprove ou devolva as submetidas.", href: "/tramitacao", icone: GitBranch, contador: submetidas, rotuloContador: "aguardando" });
  }
  if (podeAnalisarViabilidade(user)) {
    acoes.push({
      titulo: "Manifestar viabilidade",
      texto: "Parecer técnico do Executivo.",
      href: "/executivo/viabilidade",
      icone: ClipboardCheck,
      contador: semParecer,
      rotuloContador: "sem parecer",
    });
  }
  if (podeRegistrarExecucao(user)) {
    acoes.push({
      titulo: "Lançar execução",
      texto: "Empenho, liquidação e pagamento.",
      href: "/executivo/execucao",
      icone: Banknote,
      contador: aExecutar,
      rotuloContador: "a executar",
    });
  }
  if (podeGerirPlanejamento(user)) {
    acoes.push({ titulo: "Planejamento", texto: "Instrumentos e base de dotações.", href: "/executivo/planejamento", icone: Landmark });
  }

  // Consultas, na mesma grade das ações.
  const verTodas = podeVerTodasEmendas(user);
  const consultas: Atalho[] = [
    ...(autor || verTodas || alcancaPoder(user, Poder.EXECUTIVO)
      ? [
          {
            titulo: autor ? "Minhas emendas" : "Emendas",
            texto: "A situação de cada emenda.",
            href: "/emendas",
            icone: Folder,
            contador: autor ? minhas.length : undefined,
            rotuloContador: "no exercício",
          },
        ]
      : []),
    ...(alcancaPoder(user, Poder.LEGISLATIVO) ? [{ titulo: "Vereador 360", texto: "Cota e emendas por vereador.", href: "/vereador360", icone: List }] : []),
    { titulo: "Resumo consolidado", texto: "Cotas e totais do exercício.", href: "/painel", icone: LayoutDashboard },
    { titulo: "Conformidade", texto: "O que a fiscalização confere.", href: "/conformidade", icone: ShieldCheck },
    ...(podeAdministrarConfiguracoes(user) ? [{ titulo: "Configurações", texto: "Parâmetros, acesso e catálogos.", href: "/config", icone: Settings }] : []),
  ];

  const [destaque, ...demais] = acoes;
  const atalhos = [...demais, ...consultas];
  const meu = autor && c ? c.porAutor.find((a) => a.autorId === autor.id) : null;

  return (
    <div className="px-7 pt-9 pb-11 max-md:px-4 max-md:pt-6">
      {erro === "acesso-negado" ? (
        <p role="alert" className="mb-4 rounded-box bg-warn-bg px-4 py-3 text-sm font-semibold text-warn">
          Seu perfil não tem acesso à página solicitada.
        </p>
      ) : null}

      <div className="mb-6">
        <p className="antena">
          {user.perfil?.nome}
          {ano ? ` · exercício ${ano}` : ""}
        </p>
        <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em]">
          {saudacao()}, {user.nome}.
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {destaque ? <AtalhoDestaque a={destaque} /> : null}
        {c ? (
          <section className={cn("flex flex-col rounded-card bg-surface p-6 shadow-card", !destaque && "lg:col-span-2")}>
            {meu ? <CotaResumo usado={meu} c={c} /> : <Exercicio c={c} submetidas={submetidas} />}
          </section>
        ) : null}
      </div>

      {atalhos.length ? (
        <div className={cn("mt-4 grid gap-4 sm:grid-cols-2", COLUNAS[atalhos.length])}>
          {atalhos.map((a) => (
            <AtalhoCartao key={a.titulo} a={a} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AtalhoDestaque({ a }: { a: Atalho }) {
  return (
    <Link
      href={a.href}
      className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-card bg-navy p-8 text-white shadow-side transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-cyan max-md:p-6"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-cyan/30 blur-3xl transition-opacity group-hover:opacity-80" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 left-16 size-72 rounded-full bg-ok/15 blur-3xl" aria-hidden />
      <span className="relative grid size-14 place-items-center rounded-box bg-cyan text-navy-deep shadow-[0_10px_30px_rgba(0,200,230,.35)]">
        <a.icone className="size-7" aria-hidden />
      </span>
      <span className="relative mt-6 block">
        <span className="flex items-center gap-3 text-[clamp(26px,2.4vw,34px)] leading-tight font-extrabold tracking-[-0.03em]">
          {a.titulo}
          <ArrowRight className="size-7 shrink-0 transition-transform group-hover:translate-x-1.5" aria-hidden />
        </span>
        <span className="mt-2 block max-w-md text-base text-white/70">{a.texto}</span>
        {a.contador ? (
          <span className="mt-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
            {a.contador} {a.rotuloContador}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function AtalhoCartao({ a }: { a: Atalho }) {
  return (
    <Link
      href={a.href}
      className="group flex min-h-[132px] flex-col justify-between gap-4 rounded-card bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-side focus-visible:outline-2 focus-visible:outline-cyan"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-field bg-navy text-cyan">
          <a.icone className="size-5" aria-hidden />
        </span>
        {a.contador ? (
          <span className="rounded-full bg-info-bg px-2.5 py-1 text-xs font-bold text-navy tnum">
            {a.contador} {a.rotuloContador}
          </span>
        ) : null}
      </span>
      <span>
        <span className="flex items-center gap-1.5 text-md font-bold">
          {a.titulo}
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-navy" aria-hidden />
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{a.texto}</span>
      </span>
    </Link>
  );
}

function CotaResumo({ usado, c }: { usado: { saude: number; demais: number; total: number }; c: Consolidado }) {
  if (c.cotaIndividual === null) return <p className="text-sm text-muted-foreground">A cota do exercício ainda não foi parametrizada.</p>;
  const parcelaSaude = (c.cotaIndividual * c.percentualSaude) / 100;
  const parcelaDemais = c.cotaIndividual - parcelaSaude;
  const s = situacaoCota(usado, c);
  const livre = Math.max(0, c.cotaIndividual - usado.total);
  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-md font-bold">Minha cota</h2>
          <Selo tipo={s.tom}>{s.rotulo}</Selo>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">Disponível</div>
        <div className="text-[clamp(26px,2.2vw,32px)] font-extrabold tracking-[-0.03em] text-navy tnum">{BRL(livre)}</div>
        <div className="text-sm text-muted-foreground">
          de {BRL(c.cotaIndividual)} · {c.percentualSaude}% reservado à saúde
        </div>
      </div>
      <div className="grid gap-4">
        <Faixa rotulo="Saúde" usado={usado.saude} total={parcelaSaude} tom="ok" />
        <Faixa rotulo="Demais áreas" usado={usado.demais} total={parcelaDemais} tom="cyan" />
      </div>
    </div>
  );
}

function Exercicio({ c, submetidas }: { c: Consolidado; submetidas: number }) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <h2 className="text-md font-bold">O exercício em números</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-6">
        <Numero rotulo="Total indicado" valor={BRL(c.total)} />
        <Numero rotulo="Para a saúde" valor={BRL(c.saude)} />
        <Numero rotulo="Aguardando tramitação" valor={String(submetidas)} />
        <Numero rotulo="Aprovadas" valor={String(c.porStatus.APROVADA?.qtd ?? 0)} />
      </dl>
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-[clamp(20px,1.8vw,26px)] font-extrabold tracking-[-0.02em] text-navy tnum">{valor}</dd>
    </div>
  );
}

function Faixa({ rotulo, usado, total, tom }: { rotulo: string; usado: number; total: number; tom: "ok" | "cyan" }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-3 text-sm">
        <span className="font-semibold">{rotulo}</span>
        <span className="tnum text-muted-foreground">
          {BRL(usado)} de {BRL(total)}
        </span>
      </div>
      <Barra valor={usado} total={total} tom={usado - total > 0.005 ? "bad" : tom} />
    </div>
  );
}
