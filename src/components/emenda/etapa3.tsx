"use client";

import type { EstadoEmenda } from "@/lib/emendas/estado";
import type { Checagem } from "@/lib/riep";
import type { Atualizar, DerivadoEmenda } from "./editor";
import { Aviso, Detalhes, MarcaChecagem } from "./ui";

// Pré-checagem das condições de validade. Só as pendências pedem atenção
// imediata; o que já confere fica recolhido.
export function Etapa3({ e, d, atualizar, prazo }: { e: EstadoEmenda; d: DerivadoEmenda; atualizar: Atualizar; prazo?: { data: string; encerrado: boolean } | null }) {
  const pendentes = d.checks.filter((c) => c.nivel !== "ok");
  const ok = d.checks.filter((c) => c.nivel === "ok");
  const dataPrazo = prazo ? prazo.data.split("-").reverse().join("/") : null;
  return (
    <div className="flex flex-col gap-4">
      {prazo?.encerrado ? (
        <Aviso tipo="bad" titulo="Prazo de protocolo encerrado">
          O prazo para apresentar emendas terminou em {dataPrazo}. O rascunho continua salvo, mas não pode mais ser submetido.
        </Aviso>
      ) : prazo ? (
        <p className="text-xs text-muted-foreground">Prazo de protocolo das emendas: até {dataPrazo}.</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Pré-checagem das condições de validade. A remessa só é liberada quando nenhum bloqueio resta; alertas não impedem a submissão.
      </p>
      {pendentes.length ? (
        <div className="divide-y divide-hair">
          {pendentes.map((c, i) => (
            <LinhaChecagem key={i} c={c} />
          ))}
        </div>
      ) : (
        <p className="rounded-box bg-ok-bg px-4 py-3 text-sm font-bold text-ok-ink">Nenhuma pendência: a emenda está pronta para submeter.</p>
      )}
      {ok.length ? (
        <Detalhes titulo={`${ok.length} verificações concluídas`}>
          <div className="divide-y divide-hair">
            {ok.map((c, i) => (
              <LinhaChecagem key={i} c={c} />
            ))}
          </div>
        </Detalhes>
      ) : null}

      <label className="flex cursor-pointer gap-3 rounded-box bg-soft p-4 text-sm leading-relaxed">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={e.declaracao}
          onChange={(ev) => atualizar({ declaracao: ev.target.checked })}
        />
        <span>
          <b>Declaração de inexistência de vedação.</b> Declaro que não há, entre mim ou meus assessores e o beneficiário desta emenda, seus dirigentes
          ou subcontratados, vínculo conjugal, de união estável ou de parentesco até o terceiro grau (ADPF 854).
        </span>
      </label>
    </div>
  );
}

export function LinhaChecagem({ c }: { c: Checagem }) {
  return (
    <div className="flex gap-3 py-3">
      <MarcaChecagem nivel={c.nivel} />
      <div className="min-w-0">
        <div className="text-sm font-bold">{c.titulo}</div>
        <div className="text-xs leading-relaxed break-words text-muted-foreground">{c.detalhe}</div>
      </div>
    </div>
  );
}
