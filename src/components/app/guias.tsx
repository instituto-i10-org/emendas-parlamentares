"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { toast } from "sonner";
import { deveAbrirSozinho, guiaDaRota, GUIAS, type Guia } from "@/config/guias";
import { pularTodosGuias, registrarGuia } from "@/lib/actions/guias";

// ============================================================================
// Guias de ajuda: balões sobre a tela, com o fundo escurecido de leve.
//
// - Abre sozinho na primeira visita da pessoa a cada módulo (ou quando o guia
//   ganhou versão nova); concluir, fechar ou pular grava e não abre mais.
// - "Ver ajuda", no menu, abre o guia da tela atual a qualquer momento.
// - ?guia=<id> na URL abre aquele guia (o "Mostrar onde" da primeira
//   configuração usa isso).
// - A tela pode declarar o próprio guia com data-guia-tela="<id>": a página
//   da emenda (visão ou editor no mesmo endereço) e as etapas da nova emenda,
//   que trocam sem mudar o endereço.
// ============================================================================

type Contexto = { abrir: () => void };

// Guia declarado pela própria tela, se houver.
const guiaDeclarado = (): Guia | null => {
  const id = document.querySelector("[data-guia-tela]")?.getAttribute("data-guia-tela");
  return id && GUIAS[id] ? GUIAS[id] : null;
};
const GuiasContexto = createContext<Contexto>({ abrir: () => {} });
export const useGuias = () => useContext(GuiasContexto);

const visivel = (el: Element | null): el is HTMLElement => {
  if (!el) return false;
  const h = el as HTMLElement & { checkVisibility?: (o?: object) => boolean };
  if (typeof h.checkVisibility === "function" && !h.checkVisibility({ checkVisibilityCSS: true })) return false;
  return h.getClientRects().length > 0;
};
// A mesma âncora pode existir no menu lateral e na barra do celular: vale a
// primeira visível; não havendo, a primeira encontrada.
const porAncora = (a: string): Element | null => {
  const todas = [...document.querySelectorAll(`[data-guia="${a}"]`)];
  return todas.find((el) => visivel(el)) ?? todas[0] ?? null;
};

// Passos do guia que fazem sentido agora. Âncora ausente para o perfil: pula.
// Âncora no menu fechado do celular: aponta o botão que abre o menu.
function passosVisiveis(guia: Guia): DriveStep[] {
  const passos: DriveStep[] = [];
  for (const p of guia.passos) {
    const popover = { title: p.titulo, description: p.texto };
    if (!p.ancora) {
      passos.push({ popover });
      continue;
    }
    const el = porAncora(p.ancora);
    if (visivel(el)) {
      passos.push({ element: el, popover });
      continue;
    }
    const botaoMenu = porAncora("menu.celular");
    if (el && el.closest("#menu-lateral") && visivel(botaoMenu)) {
      passos.push({ element: botaoMenu, popover: { title: p.titulo, description: `No menu (este botão): ${p.texto}` } });
    }
  }
  return passos;
}

export function GuiasProvider({
  vistos,
  automaticos,
  bloqueado,
  children,
}: {
  vistos: Record<string, number>;
  automaticos: boolean;
  // Primeiro acesso pendente: nada de guia por cima do modal obrigatório.
  bloqueado: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const ativo = useRef<Driver | null>(null);
  const idAtivo = useRef<string | null>(null);
  // Vistos nesta sessão do navegador, para não reabrir antes do servidor saber.
  const [vistosAqui, setVistosAqui] = useState<Record<string, number>>({});

  const iniciar = useCallback((guia: Guia) => {
    if (ativo.current?.isActive()) {
      if (idAtivo.current === guia.id) return;
      ativo.current.destroy();
    }
    const steps = passosVisiveis(guia);
    if (!steps.length) return;
    let encerrado = false;
    // Grava o desfecho e fecha. Fechar por troca de tela (destroy programático)
    // não passa por aqui e não conta como visto.
    const finalizar = (resultado: "CONCLUIDO" | "PULADO" | "TODOS") => {
      if (encerrado) return;
      encerrado = true;
      if (resultado === "TODOS") {
        setVistosAqui(Object.fromEntries(Object.values(GUIAS).map((g) => [g.id, g.versao])));
        void pularTodosGuias().then((r) => {
          if (r.ok && r.mensagem) toast(r.mensagem);
        });
      } else {
        setVistosAqui((v) => ({ ...v, [guia.id]: guia.versao }));
        void registrarGuia({ guia: guia.id, como: resultado });
      }
      d.destroy();
    };
    const d = driver({
      steps,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      // Esc não fecha o guia (fechar sem querer marcava como pulado); as setas
      // continuam navegando pelo tratamento abaixo. Fechar só pelo X ou pelos
      // botões "Pular".
      allowKeyboardControl: false,
      // Clique fora do balão não fecha (evita perder o guia sem querer).
      overlayClickBehavior: () => {},
      overlayColor: "#061840",
      overlayOpacity: 0.45,
      stagePadding: 6,
      stageRadius: 14,
      popoverClass: "guia-balao",
      popoverOffset: 12,
      showProgress: steps.length > 1,
      progressText: "Passo {{current}} de {{total}}",
      nextBtnText: "Próximo",
      prevBtnText: "Voltar",
      doneBtnText: "Concluir",
      showButtons: ["next", "previous", "close"],
      onPopoverRender: (popover) => {
        popover.closeButton.setAttribute("aria-label", "Fechar o guia");
        popover.closeButton.setAttribute("title", "Fechar o guia");
        popover.wrapper.querySelector(".guia-pular")?.remove();
        const pular = document.createElement("div");
        pular.className = "guia-pular";
        const botao = (texto: string, resultado: "PULADO" | "TODOS") => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = texto;
          b.onclick = () => finalizar(resultado);
          return b;
        };
        pular.append(botao("Pular este guia", "PULADO"), botao("Pular todos", "TODOS"));
        popover.wrapper.append(pular);
      },
      onDoneClick: () => finalizar("CONCLUIDO"),
      // Fechar pelo X.
      onDestroyStarted: () => finalizar("PULADO"),
      onDestroyed: () => {
        window.removeEventListener("keydown", setas, true);
        ativo.current = null;
        idAtivo.current = null;
      },
    });
    // Setas avançam e voltam; Esc é ignorado.
    const setas = (ev: KeyboardEvent) => {
      if (!d.isActive()) return;
      if (ev.key === "Escape") {
        ev.stopPropagation();
        ev.preventDefault();
      } else if (ev.key === "ArrowRight") {
        if (d.hasNextStep()) d.moveNext();
      } else if (ev.key === "ArrowLeft") {
        if (d.hasPreviousStep()) d.movePrevious();
      }
    };
    window.addEventListener("keydown", setas, true);
    ativo.current = d;
    idAtivo.current = guia.id;
    d.drive();
  }, []);

  const abrir = useCallback(() => {
    const aba = new URLSearchParams(window.location.search).get("aba");
    const guia = guiaDeclarado() ?? guiaDaRota(window.location.pathname, aba) ?? GUIAS.inicio;
    if (guia) iniciar(guia);
  }, [iniciar]);

  // Trocou de tela com um guia aberto: fecha sem registrar.
  const pathname = usePathname();
  useEffect(() => {
    if (ativo.current?.isActive()) ativo.current.destroy();
  }, [pathname]);
  useEffect(() => () => ativo.current?.destroy(), []);

  return (
    <GuiasContexto.Provider value={{ abrir }}>
      {children}
      <Suspense fallback={null}>
        <AberturaAutomatica
          vistos={{ ...vistos, ...vistosAqui }}
          automaticos={automaticos && !bloqueado}
          iniciar={iniciar}
          limparParametro={(url) => router.replace(url, { scroll: false })}
        />
      </Suspense>
    </GuiasContexto.Provider>
  );
}

// Decide, a cada tela, se o guia abre sozinho; e atende ?guia=<id>.
function AberturaAutomatica({
  vistos,
  automaticos,
  iniciar,
  limparParametro,
}: {
  vistos: Record<string, number>;
  automaticos: boolean;
  iniciar: (g: Guia) => void;
  limparParametro: (url: string) => void;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const aba = params.get("aba");
  const pedido = params.get("guia");
  const vistosRef = useRef(vistos);
  useEffect(() => {
    vistosRef.current = vistos;
  }, [vistos]);

  // A tela pode trocar de guia sem trocar de endereço (etapas da emenda).
  const [tela, setTela] = useState<string | null>(null);
  useEffect(() => {
    const ler = () => setTela(document.querySelector("[data-guia-tela]")?.getAttribute("data-guia-tela") ?? null);
    ler();
    const obs = new MutationObserver(ler);
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-guia-tela"] });
    return () => obs.disconnect();
  }, [pathname]);

  useEffect(() => {
    let guia: Guia | null = null;
    let forcado = false;
    if (pedido && GUIAS[pedido]) {
      guia = GUIAS[pedido];
      forcado = true;
    } else if (automaticos) {
      const g = (tela && GUIAS[tela]) || guiaDaRota(pathname, aba);
      if (g && deveAbrirSozinho(g, vistosRef.current)) guia = g;
    }
    if (!guia) return;
    // Espera a tela assentar (dados, fontes) antes de medir os elementos.
    const t = window.setTimeout(() => {
      iniciar(guia);
      if (forcado) {
        const p = new URLSearchParams(window.location.search);
        p.delete("guia");
        const q = p.toString();
        limparParametro(`${window.location.pathname}${q ? `?${q}` : ""}`);
      }
    }, 700);
    return () => window.clearTimeout(t);
    // Só reage à troca de tela ou a um pedido explícito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, aba, pedido, automaticos, tela]);

  return null;
}
