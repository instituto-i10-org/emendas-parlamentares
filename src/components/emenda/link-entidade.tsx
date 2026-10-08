"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Copy, Link2, Save } from "lucide-react";
import { useConfirmar } from "@/components/app/confirmar";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { aplicarPlanoEntidade, gerarConvite, listarConvites, revogarConvite, type ConviteTela } from "@/lib/actions/convite";
import { totalPlanoEntidade } from "@/lib/emendas/convite";
import { BRL, DATA_HORA } from "@/lib/riep";
import type { Atualizar } from "./editor";
import { Secao, Selo } from "./ui";

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
export function LinkEntidade({
  emendaId,
  alterado,
  atualizar,
  salvarEGerar,
  gravando = false,
}: {
  emendaId: string | null;
  alterado: boolean;
  atualizar: Atualizar;
  // Antes do primeiro salvamento: salva o rascunho e gera o link em seguida.
  salvarEGerar?: () => void;
  gravando?: boolean;
}) {
  const [convites, setConvites] = useState<ConviteTela[] | null>(null);
  const [novo, setNovo] = useState<{ url: string; expiraEm: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const { confirmar, janela } = useConfirmar();
  const gerouSozinho = useRef(false);

  const recarregar = useCallback(() => {
    if (!emendaId) return;
    iniciar(async () => {
      const r = await listarConvites(emendaId);
      if (r.ok) setConvites(r.convites);
      else toast.error(r.erro);
    });
  }, [emendaId]);

  useEffect(recarregar, [recarregar]);

  const ativo = convites?.find((c) => c.situacao === "VALIDO") ?? null;
  const enviados = convites?.filter((c) => c.situacao === "USADO") ?? [];

  async function gerar(automatico = false) {
    if (!emendaId) return;
    if (
      !automatico &&
      ativo &&
      !(await confirmar({
        titulo: "Gerar novo link",
        mensagem: "Já existe um link aguardando a entidade. Gerar outro cancela o anterior.",
        rotulo: "Gerar novo link",
      }))
    )
      return;
    iniciar(async () => {
      const r = await gerarConvite(emendaId);
      if (!r.ok) return void toast.error(r.erro);
      setNovo({ url: `${window.location.origin}/publica/plano/${r.codigo}`, expiraEm: r.expiraEm });
      recarregar();
    });
  }

  // Veio de "Salvar rascunho e gerar link": gera assim que a emenda tem número
  // de rascunho, uma vez, e tira o pedido do endereço.
  useEffect(() => {
    if (!emendaId || gerouSozinho.current || convites === null) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("gerarLink") !== "1") return;
    gerouSozinho.current = true;
    url.searchParams.delete("gerarLink");
    window.history.replaceState(window.history.state, "", url);
    void gerar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emendaId, convites]);

  if (!emendaId) {
    return (
      <Secao guia="nova-emenda.entidade" titulo="Preenchimento pela entidade">
        <div className="grid gap-3 rounded-box bg-info-bg p-4 text-sm">
          <p>
            A entidade pode preencher este plano de trabalho por um link, sem precisar de cadastro. Para gerar o link, o rascunho precisa estar
            salvo.
          </p>
          {salvarEGerar ? (
            <div>
              <Button size="sm" onClick={salvarEGerar} disabled={gravando}>
                <Save /> Salvar rascunho e gerar link
              </Button>
            </div>
          ) : null}
        </div>
      </Secao>
    );
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
      guia="nova-emenda.entidade"
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
            <p className="mt-2 text-xs text-muted-foreground">
              Envie este link à entidade por e-mail ou mensagem. Ela preenche o plano sem cadastro; quando enviar, o plano aparece aqui, nesta
              seção, para você trazer ao rascunho. Vale até {DATA_HORA(new Date(novo.expiraEm))}, para um único envio.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="surface" onClick={() => void gerar()} disabled={pendente}>
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
                onClick={async () => {
                  if (!(await confirmar({ titulo: "Cancelar o link", mensagem: "A entidade não poderá mais usar este link.", rotulo: "Cancelar link", destrutiva: true }))) return;
                  iniciar(async () => {
                    const r = await revogarConvite(ativo.id);
                    if (!r.ok) return void toast.error(r.erro);
                    setNovo(null);
                    toast("Link cancelado.");
                    recarregar();
                  });
                }}
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
                onClick={async () => {
                  if (
                    alterado &&
                    !(await confirmar({
                      titulo: "Trazer o plano da entidade",
                      mensagem: "O plano da entidade substitui metas, itens, fontes, etapas e cronograma deste rascunho.",
                      rotulo: "Trazer para o plano",
                    }))
                  )
                    return;
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
      {janela}
    </Secao>
  );
}
