"use client";

import { ExternalLink } from "lucide-react";
import type { FontePreco } from "@/lib/riep";
import { Ajuda, TextoRico } from "./ui";

// Onde pesquisar o preço. O sistema não busca nem sugere valor: indica as
// fontes oficiais que servem a esta emenda, com o link. O autor pesquisa,
// digita o valor e informa de qual fonte o tirou.
export function FontesPreco({ fontes, orientacao }: { fontes: FontePreco[]; orientacao: string }) {
  return (
    <div className="rounded-box bg-soft p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="antena">Onde pesquisar o preço</span>
        <Ajuda titulo="Sobre os preços">
          <p>
            O valor de cada item é informado por você, a partir de uma fonte oficial. As fontes abaixo são as indicadas para o tipo de despesa
            desta emenda. Abra a fonte, pesquise o item, anote o valor unitário e a data da consulta, e informe a fonte na linha do item.
          </p>
          <p className="mt-2">
            O preço da emenda é uma estimativa para dimensioná-la. <b>Não substitui a pesquisa formal de preços</b>, que compete ao Poder
            Executivo na fase de contratação.
          </p>
        </Ajuda>
      </div>
      {orientacao ? (
        <p className="mb-3 text-sm text-muted-foreground">
          <TextoRico texto={orientacao} />
        </p>
      ) : null}
      {fontes.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {fontes.map((f) => (
            <li key={f.id} className="rounded-field bg-surface px-3.5 py-3">
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline-offset-2 hover:underline"
              >
                {f.nome}
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.orientacao}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma fonte oficial cadastrada. Peça à administração para cadastrar em Configurações.</p>
      )}
    </div>
  );
}
