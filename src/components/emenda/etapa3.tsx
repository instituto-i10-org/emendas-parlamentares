"use client";

import type { SituacaoEmendamento } from "@/lib/emendas/emendamento";
import type { EstadoEmenda } from "@/lib/emendas/estado";
import type { Verificacao } from "@/lib/riep";
import type { Atualizar, DerivadoEmenda } from "./editor";
import { LinhaChecagem } from "./linha-checagem";
import { ListaVerificacoes } from "./relatorio-verificacoes";
import { Aviso, Detalhes } from "./ui";

export { LinhaChecagem };

// Pré-checagem das condições de validade. Só as pendências pedem atenção
// imediata; o que já confere fica recolhido.
export function Etapa3({
  e,
  d,
  atualizar,
  emendamento,
  podeRemeter,
  recusa = null,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  atualizar: Atualizar;
  emendamento: SituacaoEmendamento;
  podeRemeter: boolean;
  // Remessa recusada pelo servidor: as treze como ele as conferiu.
  recusa?: { verificacoes: Verificacao[]; erro: string } | null;
}) {
  const pendentes = d.checks.filter((c) => c.nivel !== "ok");
  const ok = d.checks.filter((c) => c.nivel === "ok");
  return (
    <div className="flex flex-col gap-4">
      {!podeRemeter ? (
        <Aviso tipo="bad" titulo="Remessa indisponível">
          {emendamento.explicacao} O rascunho continua salvo, mas não pode ser submetido agora.
        </Aviso>
      ) : (
        <p className="text-xs text-muted-foreground">{emendamento.explicacao}</p>
      )}
      {recusa ? (
        <Aviso tipo="bad" titulo="Remessa recusada na conferência do servidor">
          {recusa.erro} A tentativa ficou registrada no histórico de validações da emenda.
        </Aviso>
      ) : null}
      <div data-guia="nova-emenda.treze">
        <ListaVerificacoes verificacoes={recusa?.verificacoes ?? d.verificacoes} />
      </div>
      <p className="text-sm text-muted-foreground">
        Pré-checagem das condições de validade. A remessa só é liberada quando nenhum bloqueio resta; alertas não impedem a submissão.
      </p>
      {pendentes.length ? (
        <div data-guia="nova-emenda.pendencias" className="divide-y divide-hair">
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

      <label data-guia="nova-emenda.declaracao" className="flex cursor-pointer gap-3 rounded-box bg-soft p-4 text-sm leading-relaxed">
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

      <label data-guia="nova-emenda.declaracao-precos" className="flex cursor-pointer gap-3 rounded-box bg-soft p-4 text-sm leading-relaxed">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={e.declaracaoPrecos}
          onChange={(ev) => atualizar({ declaracaoPrecos: ev.target.checked })}
        />
        <span>
          <b>Declaração dos preços.</b> Declaro que pesquisei e informei os preços desta emenda. <span className="text-muted-foreground">Obrigatória para enviar.</span>
        </span>
      </label>
    </div>
  );
}
