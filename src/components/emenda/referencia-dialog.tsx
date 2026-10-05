"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { lerNumero } from "@/lib/emendas/estado";
import { TIPOS_REFERENCIA, referenciaCompleta, type FontePreco, type ReferenciaPreco, type TipoReferencia } from "@/lib/riep";
import { hojeIso } from "@/lib/utils";
import { Campo, CampoNumero } from "./ui";

const OUTRA = "__outra";

// De onde o autor tirou o preço de um item. A fonte vem da lista de fontes
// oficiais (com o link) ou é "outra fonte" (cotação, nota fiscal, contratação
// do Município...). Os campos próprios do tipo ajudam a conferir, mas não
// travam o registro.
export function ReferenciaDialog({
  aberto,
  codigo,
  indicadas,
  todas,
  item,
  aoFechar,
  aoRegistrar,
}: {
  aberto: boolean;
  codigo: string;
  // Fontes indicadas para esta emenda, mostradas primeiro.
  indicadas: FontePreco[];
  todas: FontePreco[];
  // A linha da memória de cálculo de onde o diálogo foi aberto.
  item: { descricao: string; unidade: string; valorUnitario: string } | null;
  aoFechar: () => void;
  aoRegistrar: (r: ReferenciaPreco) => void;
}) {
  const [fonte, setFonte] = useState("");
  const [tipoOutra, setTipoOutra] = useState<TipoReferencia | "">("");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [f, setF] = useState({ emissor: "", data: "", unidade: "", valor: "", link: "", objeto: "", observacao: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!aberto) return;
    // Formulário novo a cada abertura, já com o que a linha tem.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFonte("");
    setTipoOutra("");
    setCampos({});
    setF({
      emissor: "",
      data: hojeIso(),
      unidade: item?.unidade ?? "",
      valor: item?.valorUnitario ?? "",
      link: "",
      objeto: item?.descricao ?? "",
      observacao: "",
    });
    setMsg("");
  }, [aberto, item]);

  const oficial = fonte && fonte !== OUTRA ? todas.find((x) => x.id === fonte) ?? null : null;
  const tipo: TipoReferencia | "" = oficial ? oficial.tipo : fonte === OUTRA ? tipoOutra : "";
  const outras = todas.filter((x) => !indicadas.some((i) => i.id === x.id));

  function registrar() {
    if (!fonte) return setMsg("Escolha a fonte do preço.");
    if (fonte === OUTRA && !tipoOutra) return setMsg("Diga que tipo de fonte é.");
    if (fonte === OUTRA && !f.emissor.trim()) return setMsg("Diga quem emitiu o preço (fornecedor, órgão, tabela).");
    const r: ReferenciaPreco = {
      codigo,
      tipo: tipo as TipoReferencia,
      campos: Object.fromEntries(
        Object.entries(campos)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v)
      ),
      emissor: oficial ? oficial.nome : f.emissor.trim(),
      data: f.data || null,
      dataTexto: null,
      unidade: f.unidade.trim(),
      valor: lerNumero(f.valor),
      objeto: f.objeto.trim(),
      porte: "",
      link: f.link.trim(),
      observacao: f.observacao.trim(),
      procedencia: "INFORMADA",
      aprovadoPor: null,
      aprovadoEm: null,
      origemExterna: null,
      consultadoEm: null,
      fonteId: oficial?.id ?? null,
    };
    if (!referenciaCompleta(r)) return setMsg("Faltam a data da consulta, o item pesquisado, a unidade ou o valor unitário.");
    aoRegistrar(r);
    toast(`Fonte do preço registrada (${codigo}).`);
  }

  const m = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent
        titulo="Fonte do preço"
        descricao={item?.descricao ? `Item: ${item.descricao}` : undefined}
        largura="lg"
        acoes={
          <>
            <Button onClick={registrar}>Registrar fonte</Button>
            <Button variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            {msg ? (
              <span className="self-center text-xs text-bad-ink" role="status">
                {msg}
              </span>
            ) : null}
          </>
        }
      >
        <div className="grid gap-3.5">
          <Campo rotulo="De onde você tirou o preço" obrigatorio htmlFor="rf-fonte">
            <select
              id="rf-fonte"
              className="campo campo-select h-12 pr-9 pl-3.5"
              value={fonte}
              onChange={(e) => {
                setFonte(e.target.value);
                setCampos({});
              }}
              autoFocus
            >
              <option value="">selecione…</option>
              {indicadas.length ? (
                <optgroup label="Indicadas para esta emenda">
                  {indicadas.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {outras.length ? (
                <optgroup label="Outras fontes oficiais">
                  {outras.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value={OUTRA}>Outra fonte (cotação, nota fiscal, contratação do Município…)</option>
            </select>
          </Campo>

          {oficial ? (
            <div className="rounded-box bg-soft px-4 py-3 text-sm">
              <a
                href={oficial.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold text-navy underline-offset-2 hover:underline"
              >
                Abrir {oficial.nome}
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
              <p className="mt-1 text-xs text-muted-foreground">{oficial.orientacao}</p>
            </div>
          ) : null}

          {fonte === OUTRA ? (
            <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
              <Campo rotulo="Tipo de fonte" obrigatorio htmlFor="rf-tipo">
                <select
                  id="rf-tipo"
                  className="campo campo-select h-12 pr-9 pl-3.5"
                  value={tipoOutra}
                  onChange={(e) => {
                    setTipoOutra(e.target.value as TipoReferencia);
                    setCampos({});
                  }}
                >
                  <option value="">selecione…</option>
                  {Object.entries(TIPOS_REFERENCIA).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Quem emitiu o preço" obrigatorio htmlFor="rf-emissor">
                <input id="rf-emissor" className="campo h-12 px-3.5" placeholder="fornecedor, órgão ou tabela" {...m("emissor")} />
              </Campo>
            </div>
          ) : null}

          {fonte ? (
            <>
              <div className="grid grid-cols-3 gap-3.5 max-sm:grid-cols-1">
                <Campo rotulo="Data da consulta" obrigatorio htmlFor="rf-data">
                  <input id="rf-data" type="date" className="campo h-12 px-3.5" {...m("data")} />
                </Campo>
                <Campo rotulo="Unidade" obrigatorio htmlFor="rf-unid">
                  <input id="rf-unid" className="campo h-12 px-3.5" placeholder="unidade, m², caixa…" {...m("unidade")} />
                </Campo>
                <Campo rotulo="Valor unitário" obrigatorio htmlFor="rf-valor">
                  <CampoNumero id="rf-valor" valor={f.valor} aoMudar={(v) => setF({ ...f, valor: v })} placeholder="0,00" />
                </Campo>
              </div>
              <Campo
                rotulo="Item pesquisado"
                obrigatorio
                htmlFor="rf-objeto"
                dica="Como o item aparece na fonte. Ajuda a conferir se o preço é comparável."
              >
                <input id="rf-objeto" className="campo h-12 px-3.5" {...m("objeto")} />
              </Campo>
              {tipo ? (
                <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                  {TIPOS_REFERENCIA[tipo].campos.map(([k, rotulo]) => (
                    <Campo key={k} rotulo={`${rotulo} (opcional)`} htmlFor={`rf-${k}`}>
                      <input
                        id={`rf-${k}`}
                        className="campo h-12 px-3.5"
                        value={campos[k] ?? ""}
                        onChange={(e) => setCampos({ ...campos, [k]: e.target.value })}
                      />
                    </Campo>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
                <Campo rotulo="Link do resultado (opcional)" htmlFor="rf-link">
                  <input id="rf-link" className="campo h-12 px-3.5" placeholder="cole aqui o endereço da consulta" {...m("link")} />
                </Campo>
                <Campo rotulo="Observação (opcional)" htmlFor="rf-obs">
                  <input id="rf-obs" className="campo h-12 px-3.5" {...m("observacao")} />
                </Campo>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
