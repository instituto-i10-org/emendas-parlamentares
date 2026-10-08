"use client";

import { JanelaConta } from "@/components/conta/janela-conta";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  FilePlus2,
  Folder,
  GitBranch,
  House,
  LayoutDashboard,
  Landmark,
  List,
  LogOut,
  Menu,
  Settings,
  Banknote,
  ClipboardCheck,
  ShieldCheck,
  CircleHelp,
} from "lucide-react";
import type { GrupoNav, Icone } from "@/config/navegacao";
import { useGuias } from "@/components/app/guias";
import { SeletorExercicio } from "@/components/app/seletor-exercicio";
import { LogoEmendas360, MarcaDocumento } from "@/components/logo-emendas360";
import { sair } from "@/lib/actions/auth";
import { rotuloExercicio, type SeletorExercicioDados } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

const ICONES: Record<Icone, typeof Folder> = {
  inicio: House,
  pasta: Folder,
  nova: FilePlus2,
  lista: List,
  tramitacao: GitBranch,
  painel: LayoutDashboard,
  planejamento: Landmark,
  execucao: Banknote,
  viabilidade: ClipboardCheck,
  conformidade: ShieldCheck,
  config: Settings,
};

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

// Casca da aplicação: menu lateral navy flutuante, recolhível no desktop e em
// gaveta no celular. A escolha de recolher é conveniência do navegador.
export function AppShell({
  grupos,
  usuario,
  exercicio,
  children,
}: {
  grupos: GrupoNav[];
  usuario: { nome: string; perfil: string; email?: string | null };
  exercicio: SeletorExercicioDados | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [recolhido, setRecolhido] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const guias = useGuias();

  useEffect(() => {
    try {
      // Preferência salva no navegador; aplicada depois da hidratação.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecolhido(localStorage.getItem("menu-recolhido") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (!gaveta) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setGaveta(false);
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [gaveta]);

  function alternar() {
    if (window.matchMedia("(max-width: 860px)").matches) {
      setGaveta(false);
      return;
    }
    setRecolhido((r) => {
      try {
        localStorage.setItem("menu-recolhido", r ? "0" : "1");
      } catch {}
      return !r;
    });
  }

  // O item mais específico que casa com o caminho fica ativo.
  const ativo = grupos
    .flatMap((g) => g.itens)
    .filter((i) => pathname === i.href || (i.prefixo && pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.id;

  return (
    <div className="min-h-dvh md:flex">
      {/* barra do celular */}
      <div className="sticky top-2 z-30 mx-2 mt-2 flex items-center gap-2.5 rounded-box bg-navy py-1.5 pr-4 pl-1.5 text-white shadow-side md:hidden">
        <button
          type="button"
          data-guia="menu.celular"
          aria-label="Abrir menu"
          aria-expanded={gaveta}
          aria-controls="menu-lateral"
          onClick={() => setGaveta(true)}
          className="grid size-11 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-cyan"
        >
          <Menu className="size-[22px]" />
        </button>
        <MarcaDocumento className="size-[22px]" />
        <span className="text-lg font-extrabold tracking-[-0.03em]">
          Emendas<b className="text-cyan">360</b>
        </span>
        {exercicio ? (
          <span data-guia="menu.exercicio" className="ml-auto flex items-center gap-1.5 text-sm">
            <CalendarDays className="size-4 text-cyan" strokeWidth={1.6} aria-hidden />
            <SeletorExercicio {...exercicio} destino="/inicio" />
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-navy-deep/40 transition-opacity md:hidden",
          gaveta ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setGaveta(false)}
        aria-hidden
      />

      <aside
        id="menu-lateral"
        className={cn(
          "fixed top-0 left-0 z-50 m-2 flex h-[calc(100dvh-16px)] w-[min(280px,calc(100vw-48px))] flex-col overflow-x-hidden overflow-y-auto rounded-2xl bg-navy text-white shadow-side transition-[transform,width] duration-200",
          "max-md:transition-transform",
          gaveta ? "max-md:translate-x-0" : "max-md:invisible max-md:-translate-x-[calc(100%+16px)]",
          "md:sticky md:top-3 md:m-3 md:mr-0 md:h-[calc(100dvh-24px)] md:shrink-0",
          recolhido ? "md:w-[92px]" : "md:w-[232px]"
        )}
      >
        <div className={cn("flex items-center px-[18px] pt-[18px] pb-[22px]", recolhido && "md:justify-center md:gap-1 md:px-0")}>
          <Link href="/inicio" className="min-w-0 focus-visible:outline-2 focus-visible:outline-cyan">
            <LogoEmendas360 classeTexto={cn(recolhido && "md:hidden")} />
          </Link>
          <button
            type="button"
            onClick={alternar}
            aria-label={gaveta ? "Fechar menu" : recolhido ? "Expandir menu" : "Recolher menu"}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "ml-auto grid size-7 shrink-0 place-items-center rounded-md text-on-navy transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-cyan",
              recolhido && "md:ml-0"
            )}
          >
            <ChevronLeft className={cn("size-3.5 transition-transform", recolhido && "md:rotate-180")} strokeWidth={2.4} />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5" aria-label="Principal">
          {grupos.map((g) => (
            <div key={g.titulo} className="mb-2">
              <div className={cn("px-[18px] pt-1 pb-1.5 text-2xs font-bold tracking-[0.16em] text-on-navy uppercase", recolhido && "md:sr-only")}>
                {g.titulo}
              </div>
              {g.itens.map((i) => {
                const Icone = ICONES[i.icone];
                const atual = ativo === i.id;
                return (
                  <Link
                    key={i.id}
                    href={i.href}
                    title={i.titulo}
                    aria-current={atual ? "page" : undefined}
                    onClick={() => setGaveta(false)}
                    className={cn(
                      "mx-2.5 flex items-center gap-2.5 rounded-md px-3 py-[9px] text-sm font-semibold text-[#DCE6F6] transition-colors hover:bg-white/7 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan",
                      atual && "bg-white/14 text-white",
                      recolhido && "md:justify-center md:px-0 md:py-2.5"
                    )}
                  >
                    <Icone className="size-[18px] shrink-0" strokeWidth={1.8} />
                    <span className={cn("truncate", recolhido && "md:hidden")}>{i.titulo}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {exercicio ? (
          <div
            data-guia="menu.exercicio"
            title={`${rotuloExercicio(exercicio)} ${exercicio.ativo}`}
            className={cn("mx-2.5 mt-auto mb-3 flex items-center gap-2.5 rounded-md bg-white/6 px-3 py-2", recolhido && "md:justify-center md:px-0")}
          >
            <CalendarDays className="size-[18px] shrink-0 text-cyan" strokeWidth={1.6} />
            <span className="flex items-baseline gap-1.5 text-sm">
              <small className={cn("text-sm font-semibold text-on-navy", recolhido && "md:hidden")}>{rotuloExercicio(exercicio)}</small>
              <SeletorExercicio {...exercicio} destino="/inicio" />
            </span>
          </div>
        ) : (
          <div className="mt-auto" />
        )}

        <button
          type="button"
          data-guia="menu.ajuda"
          title="Ver ajuda desta tela"
          onClick={() => {
            setGaveta(false);
            // Com a gaveta do celular fechando, o guia mede a tela já sem ela.
            window.setTimeout(guias.abrir, 250);
          }}
          className={cn(
            "mx-2.5 mb-3 flex items-center gap-2.5 rounded-md px-3 py-[9px] text-left text-sm font-semibold text-[#DCE6F6] transition-colors hover:bg-white/7 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan",
            recolhido && "md:justify-center md:px-0 md:py-2.5"
          )}
        >
          <CircleHelp className="size-[18px] shrink-0" strokeWidth={1.8} />
          <span className={cn("truncate", recolhido && "md:hidden")}>Ver ajuda</span>
        </button>

        <div data-guia="menu.conta" className={cn("flex items-center gap-2.5 border-t border-white/10 px-[18px] py-4", recolhido && "md:flex-col md:px-0")}>
          <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-ok text-xs font-extrabold text-navy-deep">
            {iniciais(usuario.nome)}
          </span>
          <span className={cn("min-w-0 flex-1", recolhido && "md:hidden")}>
            <JanelaConta nome={usuario.nome} email={usuario.email}>
              {(abrir) => (
                <button type="button" onClick={abrir} className="block max-w-full cursor-pointer truncate text-left text-xs leading-tight font-bold hover:underline" title="Minha conta e senha">
                  {usuario.nome}
                </button>
              )}
            </JanelaConta>
            <span className="block truncate text-xs text-on-navy">{usuario.perfil}</span>
          </span>
          <form action={sair}>
            <button
              type="submit"
              title="Sair"
              aria-label="Sair"
              className="grid size-7 place-items-center rounded-md text-on-navy transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-cyan"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
