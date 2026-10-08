"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Ajuda } from "@/components/ui/ajuda";
import { melhorarTexto } from "@/lib/actions/servicos";
import { lerNumero } from "@/lib/emendas/estado";
import type { CampoTexto } from "@/lib/servicos/redacao";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------- texto rico

// Trechos entre ** viram destaque. Só para textos do próprio sistema.
export function TextoRico({ texto }: { texto: string }) {
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  return <>{partes.map((p, i) => (i % 2 ? <b key={i} className="font-bold">{p}</b> : p))}</>;
}

// ------------------------------------------------------------------- painel

export function Painel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-card bg-surface p-7 shadow-card max-md:px-4 max-md:py-5", className)}>{children}</section>;
}

export function Secao({
  titulo,
  ajuda,
  children,
  className,
  guia,
  id,
  semTitulo,
}: {
  titulo: string;
  ajuda?: ReactNode;
  children: ReactNode;
  className?: string;
  // Âncora do guia de ajuda (só o atributo data-guia; não muda a aparência).
  guia?: string;
  id?: string;
  // A seção da emenda já mostra o mesmo título: o h3 fica só para leitores de tela.
  semTitulo?: boolean;
}) {
  return (
    <div id={id} data-guia={guia} className={cn("mt-8 scroll-mt-4 first:mt-0", className)}>
      <h3 className={cn("mb-3 flex items-center gap-2 text-md font-bold", semTitulo && "sr-only")}>
        {titulo}
        {ajuda ? <Ajuda titulo={titulo}>{ajuda}</Ajuda> : null}
      </h3>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------- ajuda

export { Ajuda };

// ------------------------------------------------------------------- campo

// Erros da seção, por id do campo (validação ao avançar, padrão GOV.UK: a
// mensagem acima do campo, borda e fundo vermelhos).
export const ErrosDaSecao = createContext<Record<string, string>>({});
export const useErroDoCampo = (id?: string) => {
  const erros = useContext(ErrosDaSecao);
  return id ? erros[id] ?? null : null;
};

export function Campo({
  rotulo,
  obrigatorio,
  ajuda,
  dica,
  contador,
  htmlFor,
  children,
  className,
  guia,
}: {
  rotulo: ReactNode;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
  dica?: ReactNode;
  contador?: { atual: number; max: number };
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  // Âncora do guia de ajuda (só o atributo data-guia; não muda a aparência).
  guia?: string;
}) {
  const erro = useErroDoCampo(htmlFor);
  return (
    <div
      data-guia={guia}
      data-erro={erro ? "" : undefined}
      className={cn("flex min-w-0 flex-col gap-1.5", erro && "border-l-4 border-bad pl-3.5 [&_.campo]:border-bad [&_.campo]:bg-bad-bg", className)}
    >
      <div className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-label">
          {rotulo}
          {obrigatorio ? <span className="font-semibold text-muted-foreground"> *</span> : null}
        </label>
        {ajuda ? <Ajuda titulo={typeof rotulo === "string" ? rotulo : undefined}>{ajuda}</Ajuda> : null}
        {contador ? (
          <span className="ml-auto text-xs font-semibold text-muted-foreground tnum">
            {contador.atual}/{contador.max}
          </span>
        ) : null}
      </div>
      {erro ? (
        <p id={`${htmlFor}-erro`} className="text-sm font-bold text-bad-ink">
          <span className="sr-only">Erro: </span>
          {erro}
        </p>
      ) : null}
      {children}
      {dica ? <div className="text-xs leading-snug font-medium text-muted-foreground">{dica}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------ máscaras pt-BR

const agrupar = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Formata enquanto digita: dígitos e uma vírgula decimal.
export function formatarDigitado(bruto: string, casas: number, prefixo = ""): string {
  const texto = String(bruto || "").replace(/[^\d,]/g, "");
  const virgula = casas > 0 ? texto.indexOf(",") : -1;
  const inteiro = (virgula < 0 ? texto : texto.slice(0, virgula)).replace(/,/g, "").replace(/^0+(?=\d)/, "");
  const decimal = virgula < 0 ? null : texto.slice(virgula + 1).replace(/,/g, "").slice(0, casas);
  if (!inteiro && decimal === null) return "";
  return prefixo + agrupar(inteiro || "0") + (decimal === null ? "" : "," + decimal);
}

export function formatarFinal(valor: string, casas: number, prefixo = "", completar = true): string {
  const n = lerNumero(valor);
  if (!valor.trim() || !(n > 0)) return "";
  return prefixo + n.toLocaleString("pt-BR", { minimumFractionDigits: completar ? casas : 0, maximumFractionDigits: casas });
}

export function CampoNumero({
  valor,
  aoMudar,
  casas = 2,
  prefixo = "",
  completar = true,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  valor: string;
  aoMudar: (v: string) => void;
  casas?: number;
  prefixo?: string;
  completar?: boolean;
}) {
  return (
    <input
      {...props}
      inputMode="decimal"
      value={valor}
      onChange={(e) => aoMudar(formatarDigitado(e.target.value, casas, prefixo))}
      onBlur={(e) => {
        aoMudar(formatarFinal(valor, casas, prefixo, completar));
        props.onBlur?.(e);
      }}
      className={cn("campo h-12 px-3.5 tnum", className)}
    />
  );
}

// ------------------------------------------------------------------ veredito

export function Veredito({
  tipo,
  titulo,
  children,
}: {
  tipo: "ok" | "warn" | "bad";
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-box px-4 py-3.5",
        tipo === "ok" && "bg-ok-bg text-ok-ink",
        tipo === "warn" && "bg-warn-bg text-warn",
        tipo === "bad" && "bg-bad-bg text-bad-ink"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full text-xs font-extrabold text-white",
          tipo === "ok" && "bg-ok-ink",
          tipo === "warn" && "bg-warn",
          tipo === "bad" && "bg-bad"
        )}
      >
        {tipo === "ok" ? <Check className="size-3.5" strokeWidth={3} /> : "!"}
      </span>
      <div className="min-w-0">
        <h3 className="text-md font-bold">{titulo}</h3>
        {children ? <div className="mt-1 text-sm leading-relaxed font-medium">{children}</div> : null}
      </div>
    </div>
  );
}

export function Aviso({
  tipo,
  titulo,
  children,
}: {
  tipo: "warn" | "bad" | "info";
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-box px-4 py-3.5 text-sm leading-relaxed",
        tipo === "warn" && "border border-warn-line bg-warn-bg text-[#7A4A06]",
        tipo === "bad" && "border border-bad-line bg-bad-bg text-bad-ink",
        tipo === "info" && "bg-info-bg text-ink"
      )}
    >
      {titulo ? <h4 className="mb-1.5 text-xs font-bold">{titulo}</h4> : null}
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ detalhes

export function Detalhes({ titulo, children, aberto }: { titulo: string; children: ReactNode; aberto?: boolean }) {
  return (
    <details open={aberto} className="group rounded-box bg-soft">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3.5 py-3 text-sm font-bold text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" strokeWidth={2.6} />
        {titulo}
      </summary>
      <div className="border-t border-hair px-3.5 py-3">{children}</div>
    </details>
  );
}

// ------------------------------------------------------------------- pílulas

export function Pilulas<T extends string>({
  opcoes,
  valor,
  aoEscolher,
  rotulo,
  curto,
}: {
  opcoes: readonly T[];
  valor: T | null | undefined;
  aoEscolher: (v: T) => void;
  rotulo: string;
  curto?: (v: T) => string;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <button
          key={o}
          type="button"
          title={o}
          aria-pressed={valor === o}
          onClick={() => aoEscolher(o)}
          className={cn(
            "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-cyan",
            valor === o ? "bg-navy text-white" : "bg-page text-label hover:bg-hover hover:text-ink"
          )}
        >
          {curto ? curto(o) : o}
        </button>
      ))}
    </div>
  );
}

// Selo pequeno em pílula.
// Selo nunca quebra em duas linhas; se não couber, corta com reticências (o
// texto inteiro fica no title).
export function Selo({ tipo = "neutro", children }: { tipo?: "ok" | "warn" | "bad" | "info" | "neutro"; children: ReactNode }) {
  return (
    <span
      title={typeof children === "string" ? children : undefined}
      className={cn(
        "inline-block max-w-full truncate rounded-full px-2 py-0.5 align-middle text-2xs font-bold tracking-[0.04em] whitespace-nowrap uppercase",
        tipo === "ok" && "bg-ok-bg text-ok-ink",
        tipo === "warn" && "bg-warn-bg text-warn",
        tipo === "bad" && "bg-bad-bg text-bad-ink",
        tipo === "info" && "bg-info-bg text-[#0779A8]",
        tipo === "neutro" && "bg-page text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

// Ícone de alerta para checagens.
export function MarcaChecagem({ nivel }: { nivel: "ok" | "warn" | "bad" }) {
  return (
    <span
      className={cn(
        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-2xs font-extrabold text-white",
        nivel === "ok" && "bg-ok text-navy-deep",
        nivel === "warn" && "bg-warn",
        nivel === "bad" && "bg-bad"
      )}
    >
      {nivel === "ok" ? <Check className="size-3" strokeWidth={3.2} /> : nivel === "warn" ? "!" : <AlertTriangle className="size-2.5" strokeWidth={3} />}
    </span>
  );
}

// ------------------------------------------------------------ melhorar texto

// Área de texto com o botão "Melhorar texto". A sugestão abre para conferência
// e só substitui o original se for aplicada — e se o texto não mudou no meio.
export function AreaTexto({
  id,
  valor,
  aoMudar,
  max,
  campo,
  contexto,
  linhas = 4,
  linhaUnica,
  placeholder,
}: {
  id?: string;
  valor: string;
  aoMudar: (v: string) => void;
  max: number;
  campo: CampoTexto;
  contexto: { objeto: string; destino: string; execucao: "DIRETA" | "INDIRETA"; exercicio?: number };
  linhas?: number;
  linhaUnica?: boolean;
  placeholder?: string;
}) {
  const gerado = useId();
  const [pedindo, setPedindo] = useState(false);
  const [sugestao, setSugestao] = useState<{ original: string; texto: string } | null>(null);

  async function pedir() {
    const original = valor;
    if (original.trim().length < 8) {
      toast("Escreva o texto antes de pedir a sugestão.");
      return;
    }
    setPedindo(true);
    try {
      const r = await melhorarTexto({ campo, texto: original, ...contexto });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setSugestao({ original, texto: r.texto });
    } finally {
      setPedindo(false);
    }
  }

  return (
    <>
      <div className="campo relative flex flex-col focus-within:border-cyan">
        <textarea
          id={id ?? gerado}
          value={valor}
          maxLength={max}
          rows={linhaUnica ? 1 : linhas}
          placeholder={placeholder}
          onChange={(e) => aoMudar(linhaUnica ? e.target.value.replace(/\s*\n+\s*/g, " ") : e.target.value)}
          onKeyDown={(e) => linhaUnica && e.key === "Enter" && e.preventDefault()}
          className={cn(
            "w-full resize-none bg-transparent px-3.5 text-sm outline-none",
            linhaUnica ? "field-sizing-content min-h-12 py-3.5 pr-44 max-sm:pr-3.5 max-sm:pb-14" : "min-h-[120px] pt-3.5 pb-14"
          )}
        />
        <button
          type="button"
          onClick={pedir}
          disabled={pedindo}
          className={cn(
            "absolute right-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-sm font-bold text-ink shadow-pop transition-shadow hover:shadow-[0_2px_10px_rgba(10,36,99,.16)] disabled:opacity-60",
            linhaUnica ? "top-1.5 max-sm:top-auto max-sm:bottom-2" : "bottom-2"
          )}
        >
          <Sparkles className="size-4 text-cyan" />
          {pedindo ? "Preparando…" : "Melhorar texto"}
        </button>
      </div>

      <Dialog open={!!sugestao} onOpenChange={(a) => !a && setSugestao(null)}>
        {sugestao ? (
          <DialogContent
            titulo="Sugestão de texto"
            acoes={
              <>
                <Button
                  onClick={() => {
                    if (valor !== sugestao.original) {
                      toast("O texto mudou. Peça outra sugestão.");
                      return;
                    }
                    aoMudar(sugestao.texto);
                    setSugestao(null);
                    toast("Sugestão aplicada.");
                  }}
                >
                  Aplicar sugestão
                </Button>
                <Button variant="ghost" onClick={() => setSugestao(null)}>
                  Manter original
                </Button>
              </>
            }
          >
            <p className="antena mb-1.5">Original</p>
            <p className="mb-4 rounded-box bg-soft p-3 text-sm leading-relaxed text-muted-foreground">{sugestao.original}</p>
            <label className="antena mb-1.5 block" htmlFor={`${gerado}-sug`}>
              Sugestão
            </label>
            <textarea
              id={`${gerado}-sug`}
              value={sugestao.texto}
              maxLength={max}
              onChange={(e) => setSugestao({ ...sugestao, texto: e.target.value })}
              className="campo min-h-[160px] p-3.5 leading-relaxed"
            />
            <p className="mt-2 text-xs text-muted-foreground">O campo só muda se você aplicar. A sugestão foi conferida: não traz número, data, norma ou fonte que a emenda não tenha.</p>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
