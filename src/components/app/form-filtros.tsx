"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Formulário de filtros que se aplica sozinho: seletor, data ou caixa marcada
// filtram na hora; a busca por texto filtra pouco depois de parar de digitar.
// Continua sendo um formulário GET (os filtros ficam na URL e Enter funciona
// sem JavaScript); com JavaScript, troca a URL sem recarregar a página.
export function FormFiltros({
  acao,
  className,
  children,
  rotulo,
  guia,
}: {
  acao: string;
  className?: string;
  children: ReactNode;
  rotulo?: string;
  guia?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  function aplicar() {
    const form = ref.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) {
      if (typeof v === "string" && v.trim() !== "") params.append(k, v.trim());
    }
    const qs = params.toString();
    router.replace(qs ? `${acao}?${qs}` : acao, { scroll: false });
  }

  return (
    <form
      ref={ref}
      data-guia={guia}
      method="get"
      action={acao}
      role="search"
      aria-label={rotulo}
      className={cn(className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (espera.current) clearTimeout(espera.current);
        aplicar();
      }}
      onChange={(e) => {
        const alvo = e.target as unknown as HTMLInputElement;
        const texto = alvo.tagName === "INPUT" && ["text", "search", ""].includes(alvo.type);
        if (espera.current) clearTimeout(espera.current);
        if (texto) espera.current = setTimeout(aplicar, 400);
        else aplicar();
      }}
    >
      {children}
    </form>
  );
}
