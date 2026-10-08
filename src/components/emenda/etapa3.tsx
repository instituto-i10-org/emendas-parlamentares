"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  secao,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  atualizar: Atualizar;
  emendamento: SituacaoEmendamento;
  podeRemeter: boolean;
  // Remessa recusada pelo servidor: as treze como ele as conferiu.
  recusa?: { verificacoes: Verificacao[]; erro: string } | null;
  // Seção em exibição (secoes.ts): verificações ou declarações e envio.
  secao: string;
}) {
  const pendentes = d.checks.filter((c) => c.nivel !== "ok");
  const ok = d.checks.filter((c) => c.nivel === "ok");
  if (secao === "envio") return <Declaracoes e={e} d={d} atualizar={atualizar} emendamento={emendamento} podeRemeter={podeRemeter} />;
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

    </div>
  );
}

// Declarações exigidas para o envio; o botão de enviar fica no rodapé.
function Declaracoes({
  e,
  d,
  atualizar,
  emendamento,
  podeRemeter,
}: {
  e: EstadoEmenda;
  d: DerivadoEmenda;
  atualizar: Atualizar;
  emendamento: SituacaoEmendamento;
  podeRemeter: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {!podeRemeter ? (
        <Aviso tipo="bad" titulo="Remessa indisponível">
          {emendamento.explicacao} O rascunho continua salvo, mas não pode ser submetido agora.
        </Aviso>
      ) : null}
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
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
      <div data-guia="nova-emenda.documento" className="flex flex-wrap items-center gap-3 rounded-box border border-line p-4 text-sm">
        <FileText className="size-5 shrink-0 text-navy" aria-hidden />
        <div className="min-w-0 flex-1">
          <b>Documento da emenda — minuta.</b> Capa do processo, a emenda e o plano de trabalho anexo, como serão protocolados. O número e a data de
          entrada saem no envio. <span className="text-muted-foreground">Mostra o que está salvo.</span>
        </div>
        {e.id ? (
          <Button variant="ghost" asChild>
            <a href={`/emendas/${e.id}/documento`} target="_blank" rel="noopener">
              Ver minuta
            </a>
          </Button>
        ) : (
          <span className="text-muted-foreground">Salve o rascunho para ver a minuta.</span>
        )}
      </div>
      {d.resumo.bloqueios > 0 ? (
        <Aviso tipo="bad" titulo={`${d.resumo.bloqueios} bloqueio${d.resumo.bloqueios > 1 ? "s" : ""} impede${d.resumo.bloqueios > 1 ? "m" : ""} o envio`}>
          Volte às verificações para ver o que falta. As declarações acima também contam.
        </Aviso>
      ) : (
        <p className="rounded-box bg-ok-bg px-4 py-3 text-sm font-bold text-ok-ink">
          Nenhum bloqueio. {d.resumo.alertas > 0 ? `${d.resumo.alertas} alerta(s) não impedem o envio.` : "A emenda está pronta para enviar."}
        </p>
      )}
    </div>
  );
}
