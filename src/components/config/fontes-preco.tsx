"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Cartao } from "@/components/app/pagina";
import { Campo, Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { alternarFontePrecoAtiva, salvarFontePreco } from "@/lib/actions/config";
import { TIPOS_REFERENCIA, type TipoReferencia } from "@/lib/riep";
import { BotaoAcao, useAcao } from "./comum";

export type FontePrecoConfig = {
  id: string;
  nome: string;
  url: string;
  orientacao: string;
  aplicaA: string[];
  tipo: TipoReferencia;
  ordem: number;
  ativo: boolean;
  usos: number;
};

const APLICA: [string, string][] = [
  ["CUSTEIO", "Custeio (Modelo I)"],
  ["OBRAS", "Obras (Modelo II)"],
  ["EQUIPAMENTOS", "Equipamentos (Modelo IV)"],
  ["TERCEIRO_SETOR", "Terceiro setor (Modelo III)"],
  ["SAUDE", "Saúde"],
];
const rotuloAplica = (k: string) => APLICA.find(([c]) => c === k)?.[1] ?? k;

const vazia = { id: "", nome: "", url: "", orientacao: "", aplicaA: [] as string[], tipo: "PAINEL" as TipoReferencia, ordem: "100" };

// Fontes oficiais de preço que a tela da emenda indica ao autor, com o link.
export function AbaFontesPreco({ fontes, podeEditar }: { fontes: FontePrecoConfig[]; podeEditar: boolean }) {
  const [f, setF] = useState<typeof vazia | null>(null);
  const { pendente, executar } = useAcao();

  return (
    <Cartao guia="config.precos.lista"
      titulo="Fontes oficiais de preço"
      ajuda="O sistema não busca preço: mostra ao autor onde pesquisar. Cada fonte aparece para os tipos de despesa marcados; sem marca, aparece sempre."
      acoes={podeEditar ? <Button data-guia="config.precos.nova" size="sm" onClick={() => setF(vazia)}>Nova fonte</Button> : null}
    >
      <div className="grid gap-3">
        {fontes.map((x) => (
          <div key={x.id} className={`rounded-box bg-soft p-4 text-sm ${x.ativo ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-navy hover:underline">
                  {x.nome}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{x.orientacao}</p>
                <div data-guia="config.precos.aplica" className="mt-2 flex flex-wrap gap-1">
                  <Selo>{TIPOS_REFERENCIA[x.tipo].nome.split(" (")[0]}</Selo>
                  {x.aplicaA.length ? x.aplicaA.map((a) => <Selo key={a} tipo="info">{rotuloAplica(a)}</Selo>) : <Selo tipo="info">Todas as despesas</Selo>}
                  {!x.ativo ? <Selo tipo="warn">desativada</Selo> : null}
                  <span className="text-2xs text-muted-foreground">{x.usos} uso(s) em emendas</span>
                </div>
              </div>
              {podeEditar ? (
                <div data-guia="config.precos.acoes" className="flex shrink-0 items-center gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setF({ id: x.id, nome: x.nome, url: x.url, orientacao: x.orientacao, aplicaA: x.aplicaA, tipo: x.tipo, ordem: String(x.ordem) })}
                  >
                    Editar
                  </Button>
                  <BotaoAcao acao={() => alternarFontePrecoAtiva(x.id)}>{x.ativo ? "Desativar" : "Ativar"}</BotaoAcao>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {!fontes.length ? <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p> : null}
      </div>

      <Dialog open={!!f} onOpenChange={(a) => !a && setF(null)}>
        {f ? (
          <DialogContent
            titulo={f.id ? "Editar fonte de preço" : "Nova fonte de preço"}
            largura="lg"
            acoes={
              <Button
                disabled={pendente}
                onClick={() =>
                  executar(
                    () =>
                      salvarFontePreco({
                        id: f.id || undefined,
                        nome: f.nome,
                        url: f.url.trim(),
                        orientacao: f.orientacao,
                        aplicaA: f.aplicaA as never,
                        tipo: f.tipo,
                        ordem: Number(f.ordem) || 0,
                      }),
                    () => setF(null)
                  )
                }
              >
                Salvar
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <Campo rotulo="Nome" obrigatorio htmlFor="fp-n" className="col-span-full">
                <input id="fp-n" className="campo h-12 px-3.5" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
              </Campo>
              <Campo rotulo="Endereço (link)" obrigatorio htmlFor="fp-u" className="col-span-full">
                <input id="fp-u" className="campo h-12 px-3.5" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
              </Campo>
              <Campo rotulo="Como pesquisar" obrigatorio htmlFor="fp-o" className="col-span-full">
                <textarea id="fp-o" className="campo min-h-[80px] p-3.5" value={f.orientacao} onChange={(e) => setF({ ...f, orientacao: e.target.value })} />
              </Campo>
              <Campo rotulo="Tipo de referência" obrigatorio htmlFor="fp-t">
                <select id="fp-t" className="campo campo-select h-12 pr-9 pl-3.5" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoReferencia })}>
                  {Object.entries(TIPOS_REFERENCIA).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Ordem" htmlFor="fp-or">
                <input id="fp-or" className="campo h-12 px-3.5 tnum" value={f.ordem} onChange={(e) => setF({ ...f, ordem: e.target.value })} />
              </Campo>
              <fieldset className="col-span-full">
                <legend className="mb-1.5 text-sm font-semibold text-label">Aparece para (nenhum marcado: todas as despesas)</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {APLICA.map(([k, rot]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={f.aplicaA.includes(k)}
                        onChange={(e) => setF({ ...f, aplicaA: e.target.checked ? [...f.aplicaA, k] : f.aplicaA.filter((a) => a !== k) })}
                      />
                      {rot}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </Cartao>
  );
}
