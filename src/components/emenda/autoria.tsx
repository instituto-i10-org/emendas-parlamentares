"use client";

import { Lock, Plus, Trash2 } from "lucide-react";
import { Ajuda } from "@/components/ui/ajuda";
import { Button } from "@/components/ui/button";
import type { VereadorCota } from "@/lib/emendas/autoria";
import { formatarNumero, totalDasPartes, type EstadoEmenda } from "@/lib/emendas/estado";
import { BRL, type Aplicado } from "@/lib/riep";
import { cn } from "@/lib/utils";
import type { Atualizar } from "./editor";
import { CampoNumero } from "./ui";

// Vereadores e valores (coautoria, pedido do Dr. Emerson). A primeira linha é
// o autor, fixa; cada coautor entra com a sua parte, que sai da cota dele. O
// valor da emenda é a soma das partes.
export function CampoAutoria({
  e,
  atualizar,
  autor,
  aplicado,
  vereadores,
  cota,
}: {
  e: EstadoEmenda;
  atualizar: Atualizar;
  autor: string;
  aplicado: Aplicado;
  vereadores: VereadorCota[];
  cota: number | null;
}) {
  const co = e.coautores;
  const saldo = (a: Aplicado) => (cota === null ? null : cota - a.saude - a.demais);
  const total = totalDasPartes(e);

  // Sem coautores, a parte do autor é o próprio valor da emenda.
  const mudarParteAutor = (v: string) =>
    atualizar((x) => (x.coautores.length ? { parteAutor: v, pretendido: formatarNumero(totalDasPartes({ ...x, parteAutor: v }), 2, "R$ ") } : { parteAutor: v, pretendido: v }));
  const mudarCoautor = (i: number, parcial: Partial<{ autorId: string; valor: string }>) =>
    atualizar((x) => {
      const coautores = x.coautores.map((c, j) => (j === i ? { ...c, ...parcial } : c));
      return { coautores, pretendido: formatarNumero(totalDasPartes({ ...x, coautores }), 2, "R$ ") };
    });
  const adicionar = () =>
    atualizar((x) => ({
      // Ao abrir a coautoria, o valor que estava digitado vira a parte do autor.
      parteAutor: x.coautores.length ? x.parteAutor : x.pretendido,
      coautores: [...x.coautores, { autorId: "", valor: "" }],
    }));
  const remover = (i: number) =>
    atualizar((x) => {
      const coautores = x.coautores.filter((_, j) => j !== i);
      const parteAutor = x.coautores.length ? x.parteAutor : x.pretendido;
      return {
        coautores,
        parteAutor,
        pretendido: coautores.length ? formatarNumero(totalDasPartes({ ...x, coautores, parteAutor }), 2, "R$ ") : parteAutor,
      };
    });

  const usados = new Set(co.map((c) => c.autorId));
  const restantes = vereadores.filter((v) => !usados.has(v.id)).length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <span id="f-autoria" className="text-sm font-semibold text-label">
          Vereadores e valores<span className="font-semibold text-muted-foreground"> *</span>
        </span>
        <Ajuda titulo="Vereadores e valores">
          O valor de cada vereador sai da cota dele. A primeira linha é a sua, autor da emenda. Para dividir a emenda com outros vereadores, use
          &ldquo;Adicionar vereador&rdquo;: o valor da emenda passa a ser a soma das partes. Só o autor edita e envia; os coautores acompanham.
        </Ajuda>
      </div>

      <ul className="flex flex-col gap-2.5" aria-labelledby="f-autoria">
        <li className="grid gap-x-2.5 gap-y-1 sm:grid-cols-[minmax(0,1fr)_220px_36px] sm:items-center">
          <div className="campo flex h-12 min-w-0 items-center gap-2 px-3.5 text-muted-foreground" aria-label="Autor da emenda">
            <span className="truncate font-semibold text-foreground">{autor}</span>
            <Lock className="ml-auto size-4 shrink-0" aria-hidden />
            <span className="sr-only">(autor da emenda, fixo)</span>
          </div>
          <CampoNumero
            id="f-pre"
            aria-label={`Valor de ${autor}`}
            valor={co.length ? e.parteAutor : e.pretendido}
            aoMudar={mudarParteAutor}
            prefixo="R$ "
            placeholder="R$ 0,00"
          />
          <span className="hidden sm:block" />
          <Saldo valor={saldo(aplicado)} />
        </li>

        {co.map((c, i) => {
          const v = vereadores.find((x) => x.id === c.autorId);
          return (
            <li key={i} className="grid gap-x-2.5 gap-y-1 sm:grid-cols-[minmax(0,1fr)_220px_36px] sm:items-center">
              <select
                aria-label={`Coautor ${i + 1}`}
                value={c.autorId}
                onChange={(ev) => mudarCoautor(i, { autorId: ev.target.value })}
                className={cn("campo h-12 min-w-0 px-3", !c.autorId && "text-muted-foreground")}
              >
                <option value="">Selecione o vereador</option>
                {vereadores
                  .filter((x) => x.id === c.autorId || !usados.has(x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.partido ? `${x.nome} (${x.partido})` : x.nome}
                    </option>
                  ))}
              </select>
              <div className="flex items-center gap-2.5 sm:contents">
                <CampoNumero
                  aria-label={`Valor de ${v?.nome ?? `coautor ${i + 1}`}`}
                  valor={c.valor}
                  aoMudar={(valor) => mudarCoautor(i, { valor })}
                  prefixo="R$ "
                  placeholder="R$ 0,00"
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  aria-label={`Retirar ${v?.nome ?? `coautor ${i + 1}`}`}
                  onClick={() => remover(i)}
                  className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-page hover:text-bad-ink focus-visible:outline-2 focus-visible:outline-cyan"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {v ? <Saldo valor={saldo(v.aplicado)} /> : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="surface" size="sm" onClick={adicionar} disabled={restantes === 0}>
          <Plus className="size-4" aria-hidden />
          Adicionar vereador
        </Button>
        {co.length ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Valor da emenda: <b className="text-foreground tnum">{BRL(total)}</b> (soma das partes)
          </p>
        ) : (
          <p className="text-xs font-medium text-muted-foreground">Digite só os números; o sistema formata em reais.</p>
        )}
      </div>
    </div>
  );
}

// Saldo da cota do vereador antes desta emenda: só informa; a conferência que
// trava é a da validação.
function Saldo({ valor }: { valor: number | null }) {
  if (valor === null) return null;
  return <p className="text-xs font-medium text-muted-foreground sm:col-span-3">Saldo na cota: {BRL(Math.max(0, valor))}</p>;
}

