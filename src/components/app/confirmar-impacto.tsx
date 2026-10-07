"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { consultarImpacto } from "@/lib/actions/impacto";
import type { PedidoImpacto } from "@/lib/impacto/servidor";
import { exigeCiencia, impactoVazio, type Impacto } from "@/lib/impacto/tipos";

// ============================================================================
// Confirmação com impacto: antes de gravar uma alteração sensível, a janela
// mostra o que muda (antes → depois) e quantas emendas a alteração alcança,
// calculado no servidor. Com emenda enviada alcançada, a pessoa precisa marcar
// que está ciente; com bloqueio, nada se grava. O servidor confere de novo.
// ============================================================================

type Resposta = { ok: true; mensagem?: string } | { ok: false; erro: string };

export type PedidoConfirmacao = {
  titulo: string;
  // Sem `impacto`, é uma confirmação simples (só a mensagem).
  impacto?: PedidoImpacto;
  mensagem?: ReactNode;
  rotulo?: string;
  destrutiva?: boolean;
  acao: (ciente: boolean) => Promise<Resposta>;
  aoConcluir?: () => void;
};

export function useConfirmarImpacto() {
  const router = useRouter();
  const [atual, setAtual] = useState<PedidoConfirmacao | null>(null);
  const [impacto, setImpacto] = useState<Impacto | null>(null);
  const [ciente, setCiente] = useState(false);
  const [pendente, iniciar] = useTransition();

  const fechar = () => {
    setAtual(null);
    setImpacto(null);
  };

  function pedir(p: PedidoConfirmacao) {
    setCiente(false);
    setImpacto(p.impacto ? null : impactoVazio());
    setAtual(p);
    if (!p.impacto) return;
    const pedido = p.impacto;
    iniciar(async () => {
      const r = await consultarImpacto(pedido);
      if (!r.ok) {
        fechar();
        toast.error(r.erro);
        return;
      }
      setImpacto(r.impacto);
    });
  }

  function confirmar() {
    if (!atual) return;
    const p = atual;
    iniciar(async () => {
      const r = await p.acao(ciente);
      if (!r.ok) return void toast.error(r.erro);
      if (r.mensagem) toast(r.mensagem);
      fechar();
      p.aoConcluir?.();
      router.refresh();
    });
  }

  const exige = impacto ? exigeCiencia(impacto) : false;
  const bloqueado = !!impacto?.bloqueio;

  const janela = (
    <Dialog open={!!atual} onOpenChange={(aberto) => (aberto ? null : fechar())}>
      {atual ? (
        <DialogContent
          titulo={atual.titulo}
          acoes={
            bloqueado ? (
              <Button variant="surface" onClick={fechar}>
                Fechar
              </Button>
            ) : (
              <>
                <Button variant={atual.destrutiva ? "destructive" : "default"} disabled={!impacto || pendente || (exige && !ciente)} onClick={confirmar}>
                  {pendente && impacto ? "Gravando…" : atual.rotulo ?? "Confirmar"}
                </Button>
                <Button variant="ghost" onClick={fechar}>
                  Cancelar
                </Button>
              </>
            )
          }
        >
          {!impacto ? (
            <p className="text-sm text-muted-foreground">Calculando o que esta alteração muda…</p>
          ) : (
            <CorpoImpacto impacto={impacto} mensagem={atual.mensagem} consultado={!!atual.impacto} exige={exige} ciente={ciente} aoMarcar={setCiente} />
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );

  return { pedir, janela, pendente };
}

export function CorpoImpacto({
  impacto,
  mensagem,
  consultado,
  exige,
  ciente,
  aoMarcar,
}: {
  impacto: Impacto;
  mensagem?: ReactNode;
  consultado: boolean;
  exige: boolean;
  ciente: boolean;
  aoMarcar: (v: boolean) => void;
}) {
  const e = impacto.emendas;
  const detalhe = [e.emAnalise ? `${e.emAnalise.toLocaleString("pt-BR")} em análise` : null, e.aprovadas ? `${e.aprovadas.toLocaleString("pt-BR")} aprovada${e.aprovadas === 1 ? "" : "s"}` : null].filter(Boolean);
  return (
    <div className="grid gap-4 text-sm" data-impacto>
      {mensagem ? <p>{mensagem}</p> : null}
      {impacto.mudancas.length ? (
        <dl className="grid gap-2" aria-label="O que muda">
          {impacto.mudancas.map((m, i) => (
            <div key={i} className="grid gap-0.5 rounded-md bg-page px-3 py-2">
              <dt className="text-xs font-semibold text-label">{m.campo}</dt>
              <dd className="break-words">
                <span className="text-muted-foreground">{m.antes}</span>
                <span className="px-1.5 text-muted-foreground" aria-label="passa a">
                  →
                </span>
                <b>{m.depois}</b>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {impacto.bloqueio ? (
        <p className="font-semibold" role="alert">
          {impacto.bloqueio}
        </p>
      ) : (
        <>
          {e.enviadas ? (
            <p data-emendas-afetadas={e.enviadas}>
              Esta alteração alcança{" "}
              <b>
                {e.enviadas.toLocaleString("pt-BR")} emenda{e.enviadas === 1 ? "" : "s"} já enviada{e.enviadas === 1 ? "" : "s"}
              </b>
              {detalhe.length ? ` (${detalhe.join(", ")})` : ""}.
            </p>
          ) : consultado && impacto.mudancas.length && !impacto.avisos.length ? (
            <p className="text-muted-foreground">Nenhuma emenda enviada é alcançada por esta alteração.</p>
          ) : null}
          {impacto.avisos.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
          {consultado && !impacto.mudancas.length && !impacto.avisos.length && !mensagem ? <p className="text-muted-foreground">Nada muda em relação ao que está gravado.</p> : null}
          {exige ? (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line px-3 py-2.5 font-semibold">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={ciente} onChange={(ev) => aoMarcar(ev.target.checked)} />
              Entendo que esta alteração afeta emendas já enviadas
            </label>
          ) : null}
        </>
      )}
    </div>
  );
}
