"use client";

import { ExternalLink } from "lucide-react";
import { ordenarFontes, urlDaFonte, type FontePreco } from "@/lib/riep";
import { cn } from "@/lib/utils";
import { Ajuda, Selo, TextoRico } from "./ui";

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
      <p data-guia="nova-emenda.responsabilidade" className="mb-3 rounded-field border-l-4 border-warn bg-surface px-3.5 py-2.5 text-sm leading-relaxed">
        <b>Os preços são de sua responsabilidade.</b> O sistema indica onde pesquisar e pode mostrar uma referência, mas não preenche nem
        confere valores. Ao enviar, você declara que pesquisou e informou os preços desta emenda.
      </p>
      {orientacao ? (
        <p className="mb-3 text-sm text-muted-foreground">
          <TextoRico texto={orientacao} />
        </p>
      ) : null}
      {fontes.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ordenarFontes(fontes).map((f) => (
            <li
              key={f.id}
              title={f.orientacao || undefined}
              className={cn("rounded-field bg-surface px-3.5 py-3", f.destaque && "border-2 border-cyan bg-info-bg sm:col-span-2")}
            >
              {f.destaque || f.assinaturaPaga ? (
                <div className="mb-1 flex flex-wrap gap-1">
                  {f.destaque ? (
                    <span className="inline-block rounded-full bg-cyan px-2 py-0.5 text-2xs font-bold tracking-[0.04em] whitespace-nowrap text-white uppercase">
                      Recomendado
                    </span>
                  ) : null}
                  {f.assinaturaPaga ? <Selo tipo="warn">assinatura paga</Selo> : null}
                </div>
              ) : null}
              <a
                href={urlDaFonte(f)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-navy underline-offset-2 hover:underline"
              >
                {f.nome}
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma fonte oficial cadastrada. Peça à administração para cadastrar em Configurações.</p>
      )}
    </div>
  );
}
