"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enviarArquivo } from "@/lib/arquivos/enviar";
import { REGRAS_ARQUIVO, type UsoArquivo } from "@/lib/arquivos/regras";

export type ArquivoValor = { id: string; nome: string } | null;

// Campo de arquivo: escolhe, envia, mostra o arquivo guardado e permite trocar.
export function CampoArquivo({
  id,
  uso,
  valor,
  aoMudar,
  publico,
  desabilitado,
}: {
  id: string;
  uso: UsoArquivo;
  valor: ArquivoValor;
  aoMudar: (v: ArquivoValor) => void;
  publico?: boolean;
  desabilitado?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  async function escolher(f: File | undefined) {
    if (!f) return;
    setErro("");
    setPct(0);
    try {
      const a = await enviarArquivo(f, uso, { publico, progresso: setPct });
      aoMudar({ id: a.id, nome: a.nome });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      setPct(null);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={entrada}
        id={id}
        type="file"
        className="sr-only"
        accept={REGRAS_ARQUIVO[uso].extensoes.map((e) => `.${e}`).join(",")}
        disabled={desabilitado || pct !== null}
        onChange={(e) => escolher(e.target.files?.[0])}
      />
      {valor ? (
        <div className="flex min-h-12 items-center gap-2 rounded-field bg-soft px-3.5 text-sm">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <a href={`/api/arquivos/${valor.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-semibold text-navy hover:underline">
            {valor.nome}
          </a>
          {!desabilitado ? (
            <>
              <Button type="button" size="xs" variant="ghost" onClick={() => entrada.current?.click()}>
                Trocar
              </Button>
              <Button type="button" size="xs" variant="ghost" aria-label="Retirar arquivo" onClick={() => aoMudar(null)}>
                <X />
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <Button type="button" variant="surface" className="h-12 w-full justify-start" disabled={desabilitado || pct !== null} onClick={() => entrada.current?.click()}>
          <Upload /> {pct !== null ? `Enviando… ${Math.round(pct)}%` : `Escolher arquivo (${REGRAS_ARQUIVO[uso].rotulo})`}
        </Button>
      )}
      {erro ? (
        <p role="alert" className="mt-1 text-xs text-bad-ink">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
