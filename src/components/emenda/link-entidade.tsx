"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { aplicarPlanoEntidade, gerarConvite, listarConvites, revogarConvite, type ConviteTela } from "@/lib/actions/convite";
import { totalPlanoEntidade } from "@/lib/emendas/convite";
import { BRL, DATA_HORA } from "@/lib/riep";
import type { Atualizar } from "./editor";
import { Aviso, Secao, Selo } from "./ui";

const ROTULO: Record<ConviteTela["situacao"], string> = {
  VALIDO: "aguardando a entidade",
  USADO: "enviado pela entidade",
  REVOGADO: "cancelado",
  VENCIDO: "vencido",
  EMENDA_REMETIDA: "sem efeito: emenda remetida",
};

// Link para a entidade beneficiária preencher o plano sem cadastro. De uso
// único, com validade, revogável a qualquer tempo e sem efeito depois que a
// emenda sai de rascunho. O gabinete vê o envio e decide trazê-lo ao rascunho.
export function LinkEntidade({ emendaId, alterado, atualizar }: { emendaId: string | null; alterado: boolean; atualizar: Atualizar }) {
  const [convites, setConvites] = useState<ConviteTela[] | null>(null);
  const [novo, setNovo] = useState<{ url: string; expiraEm: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const recarregar = useCallback(() => {
    if (!emendaId) return;
    iniciar(async () => {
      const r = await listarConvites(emendaId);
      if (r.ok) setConvites(r.convites);
      else toast.error(r.erro);
    });
  }, [emendaId]);

  useEffect(recarregar, [recarregar]);

  if (!emendaId) {
    return (
      <Secao titulo="Preenchimento pela entidade">
        <Aviso tipo="info">Salve o rascunho para gerar o link que a entidade usa para preencher este plano de trabalho.</Aviso>
      </Secao>
    );
  }

  const ativo = convites?.find((c) => c.situacao === "VALIDO") ?? null;
  const enviados = convites?.filter((c) => c.situacao === "USADO") ?? [];

  function gerar() {
    if (!emendaId) return;
    if (ativo && !window.confirm("Já existe um link aguardando a entidade. Gerar outro cancela o anterior. Continuar?")) return;
    iniciar(async () => {
      const r = await gerarConvite(emendaId);
      if (!r.ok) return void toast.error(r.erro);
      setNovo({ url: `${window.location.origin}/publica/plano/${r.codigo}`, expiraEm: r.expiraEm });
      recarregar();
    });
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copiado. Envie à entidade por e-mail ou mensagem.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o endereço e copie manualmente.");
    }
  }

  return (
    <Secao
      titulo="Preenchimento pela entidade"
      ajuda="A entidade recebe um link, preenche metas, itens com a fonte de cada preço, etapas e cronograma, e envia. O link serve para um único envio, vence na data indicada e pode ser cancelado aqui. Depois que a emenda é remetida, nenhum link vale mais."
    >
      <div className="grid gap-3">
        {novo ? (
          <div className="rounded-box border border-hair bg-surface p-4">
            <p className="mb-2 text-sm font-bold">Link gerado. Copie agora: ele não é exibido de novo.</p>
            <div className="flex gap-2 max-sm:flex-col">
              <input readOnly className="campo h-11 flex-1 px-3 text-xs" value={novo.url} onFocus={(e) => e.currentTarget.select()} aria-label="Link para a entidade" />
              <Button size="sm" onClick={() => copiar(novo.url)}>
                <Copy /> Copiar link
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Vale até {DATA_HORA(new Date(novo.expiraEm))}, para um único envio.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="surface" onClick={gerar} disabled={pendente}>
            <Link2 /> {ativo ? "Gerar novo link" : "Gerar link para a entidade"}
          </Button>
          {ativo ? (
            <>
              <span className="text-xs text-muted-foreground">
                Link aguardando a entidade, válido até {DATA_HORA(new Date(ativo.expiraEm))}.
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pendente}
                onClick={() =>
                  window.confirm("Cancelar o link? A entidade não poderá mais usá-lo.") &&
                  iniciar(async () => {
                    const r = await revogarConvite(ativo.id);
                    if (!r.ok) return void toast.error(r.erro);
                    setNovo(null);
                    toast("Link cancelado.");
                    recarregar();
                  })
                }
              >
                Cancelar link
              </Button>
            </>
          ) : null}
        </div>

        {enviados.map((c) => (
          <div key={c.id} className="rounded-box bg-soft p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b>Plano enviado pela entidade</b>
              <Selo tipo="ok">{ROTULO[c.situacao]}</Selo>
              {c.aplicadoEm ? <Selo tipo="info">trazido ao rascunho em {DATA_HORA(new Date(c.aplicadoEm))}</Selo> : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Preenchido por {c.responsavel ?? "—"} em {c.usadoEm ? DATA_HORA(new Date(c.usadoEm)) : "—"}
              {c.conteudo ? ` · ${c.conteudo.metas.length} meta(s) · ${c.conteudo.itens.length} item(ns) · ${BRL(totalPlanoEntidade(c.conteudo))}` : ""}
            </p>
            {c.conteudo?.observacao ? <p className="mt-2 text-xs">Observação da entidade: “{c.conteudo.observacao}”</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={pendente}
                onClick={() => {
                  if (alterado && !window.confirm("O plano da entidade substitui metas, itens, fontes, etapas e cronograma deste rascunho. Continuar?")) return;
                  iniciar(async () => {
                    const r = await aplicarPlanoEntidade(c.id);
                    if (!r.ok) return void toast.error(r.erro);
                    atualizar(r.parcial);
                    toast("Plano da entidade trazido para o rascunho. Revise e salve.");
                    recarregar();
                  });
                }}
              >
                Trazer para o plano
              </Button>
              <span className="text-xs text-muted-foreground">Substitui metas, itens, fontes, etapas e cronograma. Revise e salve.</span>
            </div>
          </div>
        ))}

        {convites && convites.some((c) => c.situacao !== "VALIDO" && c.situacao !== "USADO") ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Links anteriores</summary>
            <ul className="mt-2 grid gap-1">
              {convites
                .filter((c) => c.situacao !== "VALIDO" && c.situacao !== "USADO")
                .map((c) => (
                  <li key={c.id}>
                    Gerado em {DATA_HORA(new Date(c.criadoEm))} · {ROTULO[c.situacao]}
                  </li>
                ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Secao>
  );
}
