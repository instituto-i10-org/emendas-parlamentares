"use client";

import { useId, useState } from "react";

// Exclusão com duplo check (pedido do Dr. Emerson): o botão de excluir só se
// libera depois de a pessoa digitar EXCLUIR. Vale para o que não volta mais
// (rascunho, perfil, área, prazo, instrumento, linha de importação). Desativar
// não é excluir e segue com a confirmação simples.

export const PALAVRA_EXCLUSAO = "EXCLUIR";

export const confereExclusao = (texto: string) => texto.trim().toUpperCase() === PALAVRA_EXCLUSAO;

export function useDigitarParaConfirmar() {
  const [texto, setTexto] = useState("");
  return { texto, setTexto, liberado: confereExclusao(texto), limpar: () => setTexto("") };
}

export function DigitarParaConfirmar({ texto, aoMudar }: { texto: string; aoMudar: (v: string) => void }) {
  const id = useId();
  return (
    <div className="mt-4 grid gap-1.5" data-teste="digitar-excluir">
      <label htmlFor={id} className="text-sm font-semibold text-label">
        Para confirmar, digite <b className="text-bad-ink">{PALAVRA_EXCLUSAO}</b>
      </label>
      <input
        id={id}
        className="campo h-11 px-3.5 font-bold tracking-[0.06em] uppercase"
        autoComplete="off"
        spellCheck={false}
        value={texto}
        onChange={(ev) => aoMudar(ev.target.value)}
      />
    </div>
  );
}
