"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Campo, CampoNumero } from "@/components/emenda/ui";
import { useConfirmar } from "@/components/app/confirmar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  avancarLeitura,
  cancelarImportacao,
  confirmarImportacao,
  corrigirLinha,
  definirTotalImpresso,
  excluirLinha,
  incluirLinha,
  retomarLeitura,
  salvarMapa,
} from "@/lib/actions/importacao";
import { formatarNumero, lerNumero } from "@/lib/emendas/estado";
import type { Campo as CampoCarga } from "@/lib/orcamento/colunas";

// Leitura do PDF ou da foto em andamento: pede o próximo passo até acabar. Se a
// aba fechar, a leitura retoma do ponto em que parou quando a página reabrir.
export function LeituraEmAndamento({ id, mensagemInicial, lidasInicial, total }: { id: string; mensagemInicial: string; lidasInicial: number; total: number }) {
  const router = useRouter();
  const [estado, setEstado] = useState({ mensagem: mensagemInicial, lidas: lidasInicial, total, linhas: 0 });
  const [erro, setErro] = useState("");
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    (async () => {
      for (let i = 0; i < 2000 && ativo.current; i++) {
        const r = await avancarLeitura(id);
        if (!ativo.current) return;
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        setEstado({ mensagem: r.mensagem, lidas: r.lidas, total: r.total || total, linhas: r.linhas });
        if (r.situacao !== "LENDO") {
          router.refresh();
          return;
        }
      }
    })();
    return () => {
      ativo.current = false;
    };
  }, [id, router, total]);

  const pct = estado.total ? Math.min(100, Math.round((estado.lidas / estado.total) * 100)) : 0;
  return (
    <div className="grid gap-3">
      <p className="text-sm" role="status">
        {estado.mensagem || "Lendo…"}
      </p>
      <div className="h-2.5 overflow-hidden rounded-full bg-soft" aria-label={`Progresso: ${pct}%`}>
        <div className="h-full rounded-full bg-cyan transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tnum">
        {estado.lidas} de {estado.total || "…"} páginas do quadro · {estado.linhas} linhas lidas. Pode fechar a página: a leitura continua de onde parou quando você voltar.
      </p>
      {erro ? (
        <div className="rounded-box border border-bad-line bg-bad-bg px-4 py-3 text-sm text-bad-ink" role="alert">
          {erro}
          <div className="mt-2">
            <Button
              size="sm"
              variant="surface"
              onClick={async () => {
                const r = await retomarLeitura(id);
                if (!r.ok) return void toast.error(r.erro);
                window.location.reload();
              }}
            >
              Tentar de novo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RetomarLeitura({ id }: { id: string }) {
  return (
    <Button
      size="sm"
      onClick={async () => {
        const r = await retomarLeitura(id);
        if (!r.ok) return void toast.error(r.erro);
        window.location.reload();
      }}
    >
      Retomar a leitura
    </Button>
  );
}

// Planilha em formato próprio: o usuário liga cada campo a uma coluna.
export function MapeamentoColunas({ id, cabecalho, campos, inicial }: { id: string; cabecalho: string[]; campos: CampoCarga[]; inicial: Record<string, number> }) {
  const router = useRouter();
  const [mapa, setMapa] = useState<Record<string, number>>(inicial);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Algumas colunas obrigatórias não foram reconhecidas pelo nome. Diga em qual coluna da sua planilha está cada informação.
      </p>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {campos.map((c) => (
          <Campo key={c.campo} rotulo={c.rotulo} obrigatorio={c.obrigatorio} htmlFor={`map-${c.campo}`}>
            <select
              id={`map-${c.campo}`}
              className="campo campo-select h-11 pr-9 pl-3"
              value={mapa[c.campo] ?? -1}
              onChange={(e) => setMapa({ ...mapa, [c.campo]: Number(e.target.value) })}
            >
              <option value={-1}>— sem coluna —</option>
              {cabecalho.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Coluna ${i + 1}`}
                </option>
              ))}
            </select>
          </Campo>
        ))}
      </div>
      <div>
        <Button
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await salvarMapa(id, mapa);
              if (!r.ok) return void toast.error(r.erro);
              toast("Colunas ligadas. Planilha lida.");
              router.refresh();
            })
          }
        >
          Ler a planilha com estas colunas
        </Button>
      </div>
    </div>
  );
}

export function TotalImpresso({ id, valor, editavel }: { id: string; valor: number | null; editavel: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(valor !== null ? formatarNumero(valor, 2) : "");
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Campo rotulo="Total da despesa impresso na peça (R$)" obrigatorio htmlFor="tot-imp" dica="A soma das linhas válidas tem de bater com este valor, ao centavo.">
        <CampoNumero id="tot-imp" valor={v} aoMudar={setV} disabled={!editavel} className="w-60" />
      </Campo>
      {editavel ? (
        <Button
          variant="surface"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await definirTotalImpresso(id, v ? lerNumero(v) : null);
              if (!r.ok) return void toast.error(r.erro);
              router.refresh();
            })
          }
        >
          Conferir
        </Button>
      ) : null}
    </div>
  );
}

export function AcoesConferencia({ id, podeConfirmar, porQueNao }: { id: string; podeConfirmar: boolean; porQueNao: string | null }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { confirmar, janela } = useConfirmar();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {janela}
      <Button
        variant="ok"
        disabled={!podeConfirmar || pendente}
        onClick={async () => {
          if (!(await confirmar({ titulo: "Gravar a base conferida", mensagem: "As dotações conferidas passam a valer para as emendas.", rotulo: "Confirmar carga" }))) return;
          iniciar(async () => {
            const r = await confirmarImportacao(id);
            if (!r.ok) return void toast.error(r.erro);
            toast(r.mensagem);
            router.refresh();
          });
        }}
      >
        {pendente ? "Gravando…" : "Confirmar carga"}
      </Button>
      <Button
        variant="ghost"
        disabled={pendente}
        onClick={async () => {
          if (!(await confirmar({ titulo: "Cancelar esta importação", mensagem: "Nada foi gravado na base; a importação é descartada.", rotulo: "Cancelar importação", destrutiva: true }))) return;
          iniciar(async () => {
            const r = await cancelarImportacao(id);
            if (!r.ok) return void toast.error(r.erro);
            router.push("/executivo/planejamento");
          });
        }}
      >
        Cancelar importação
      </Button>
      {porQueNao ? <span className="text-sm text-warn">{porQueNao}</span> : null}
    </div>
  );
}

// Corrigir uma linha lida (ou incluir a que faltou). Revalida no servidor.
export function EditarLinha({
  id,
  linhaId,
  campos,
  definicoes,
  rotulo,
}: {
  id: string;
  linhaId?: string;
  campos: Record<string, string>;
  definicoes: CampoCarga[];
  rotulo: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState(campos);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [pendente, iniciar] = useTransition();
  const { confirmar, janela } = useConfirmar();
  return (
    <>
      {janela}
      <Button size="xs" variant={linhaId ? "ghost" : "surface"} onClick={() => (setF(campos), setMotivos([]), setAberto(true))}>
        {rotulo}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          titulo={linhaId ? "Corrigir linha" : "Incluir linha"}
          largura="lg"
          acoes={
            <>
              <Button
                disabled={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = linhaId ? await corrigirLinha(id, linhaId, f) : await incluirLinha(id, f);
                    if (!r.ok) return void toast.error(r.erro);
                    setMotivos(r.motivos);
                    if (!r.motivos.length) {
                      toast(linhaId ? "Linha corrigida." : "Linha incluída.");
                      setAberto(false);
                    }
                    router.refresh();
                  })
                }
              >
                Salvar
              </Button>
              {linhaId ? (
                <Button
                  variant="ghost"
                  disabled={pendente}
                  onClick={async () => {
                    if (!(await confirmar({ titulo: "Excluir esta linha", mensagem: "A linha sai desta importação.", rotulo: "Excluir linha", destrutiva: true }))) return;
                    iniciar(async () => {
                      const r = await excluirLinha(id, linhaId);
                      if (!r.ok) return void toast.error(r.erro);
                      setAberto(false);
                      router.refresh();
                    });
                  }}
                >
                  Excluir linha
                </Button>
              ) : null}
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {definicoes.map((d) => (
              <Campo key={d.campo} rotulo={d.rotulo} obrigatorio={d.obrigatorio} htmlFor={`ln-${d.campo}`}>
                <input id={`ln-${d.campo}`} className="campo h-11 px-3" value={f[d.campo] ?? ""} onChange={(e) => setF({ ...f, [d.campo]: e.target.value })} />
              </Campo>
            ))}
          </div>
          {motivos.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-bad-ink" role="alert">
              {motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
