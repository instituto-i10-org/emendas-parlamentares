"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { lerNumero } from "@/lib/emendas/estado";
import { TIPOS_REFERENCIA, referenciaCompleta, type ReferenciaPreco, type TipoReferencia } from "@/lib/riep";
import { Campo, CampoNumero } from "./ui";

// Cadastro de uma referência de preço, com os campos próprios do tipo. É o que
// torna a origem conferível por terceiro.
export function ReferenciaDialog({
  aberto,
  codigo,
  aoFechar,
  aoRegistrar,
}: {
  aberto: boolean;
  codigo: string;
  aoFechar: () => void;
  aoRegistrar: (r: ReferenciaPreco) => void;
}) {
  const [tipo, setTipo] = useState<TipoReferencia | "">("");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [f, setF] = useState({ emissor: "", data: "", unidade: "", valor: "", porte: "", link: "", objeto: "", observacao: "" });
  const [msg, setMsg] = useState("Campo próprio em branco impede o registro.");

  useEffect(() => {
    if (!aberto) return;
    // Formulário limpo a cada abertura.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTipo("");
    setCampos({});
    setF({ emissor: "", data: "", unidade: "", valor: "", porte: "", link: "", objeto: "", observacao: "" });
    setMsg("Campo próprio em branco impede o registro.");
  }, [aberto]);

  function registrar() {
    if (!tipo) return setMsg("Escolha o tipo da referência.");
    const falta = TIPOS_REFERENCIA[tipo].campos.find(([k]) => !campos[k]?.trim());
    if (falta) return setMsg(`Campo próprio em branco: ${falta[1]}.`);
    const r: ReferenciaPreco = {
      codigo,
      tipo,
      campos: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v.trim()])),
      emissor: f.emissor.trim(),
      data: f.data || null,
      dataTexto: null,
      unidade: f.unidade.trim(),
      valor: lerNumero(f.valor),
      objeto: f.objeto.trim(),
      porte: f.porte.trim(),
      link: f.link.trim(),
      observacao: f.observacao.trim(),
      procedencia: "INFORMADA",
      aprovadoPor: null,
      aprovadoEm: null,
      origemExterna: null,
      consultadoEm: null,
    };
    if (!referenciaCompleta(r)) return setMsg("Faltam emissor, data, objeto da referência, unidade ou valor unitário.");
    aoRegistrar(r);
    toast(`Referência ${codigo} registrada.`);
  }

  const m = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent
        titulo="Nova referência de preço"
        largura="lg"
        acoes={
          <>
            <Button onClick={registrar}>Registrar referência</Button>
            <Button variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <span className="self-center text-xs text-muted-foreground" role="status">
              {msg}
            </span>
          </>
        }
      >
        <div className="grid gap-3.5">
          <Campo rotulo="Tipo da referência" obrigatorio htmlFor="rf-tipo">
            <select
              id="rf-tipo"
              className="campo campo-select h-12 pr-9 pl-3.5"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoReferencia);
                setCampos({});
              }}
              autoFocus
            >
              <option value="">selecione…</option>
              {Object.entries(TIPOS_REFERENCIA).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          {tipo ? (
            <div className="grid grid-cols-3 gap-3.5 max-sm:grid-cols-1">
              {TIPOS_REFERENCIA[tipo].campos.map(([k, rotulo]) => (
                <Campo key={k} rotulo={rotulo} obrigatorio htmlFor={`rf-${k}`}>
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
          <div className="grid grid-cols-3 gap-3.5 max-sm:grid-cols-1">
            <Campo rotulo="Emissor ou órgão" obrigatorio htmlFor="rf-emissor">
              <input id="rf-emissor" className="campo h-12 px-3.5" {...m("emissor")} />
            </Campo>
            <Campo rotulo="Data da referência" obrigatorio htmlFor="rf-data">
              <input id="rf-data" type="date" className="campo h-12 px-3.5" {...m("data")} />
            </Campo>
            <Campo rotulo="Unidade" obrigatorio htmlFor="rf-unid">
              <input id="rf-unid" className="campo h-12 px-3.5" placeholder="unidade, m², h/aula..." {...m("unidade")} />
            </Campo>
            <Campo rotulo="Valor unitário" obrigatorio htmlFor="rf-valor">
              <CampoNumero id="rf-valor" valor={f.valor} aoMudar={(v) => setF({ ...f, valor: v })} placeholder="0,00" />
            </Campo>
            <Campo rotulo="Quantidade ou porte na origem" htmlFor="rf-porte">
              <input id="rf-porte" className="campo h-12 px-3.5" placeholder="4 unidades, 38 contratações..." {...m("porte")} />
            </Campo>
            <Campo rotulo="Link ou anexo" htmlFor="rf-link">
              <input id="rf-link" className="campo h-12 px-3.5" placeholder="opcional" {...m("link")} />
            </Campo>
          </div>
          <Campo
            rotulo="Objeto da referência"
            obrigatorio
            htmlFor="rf-objeto"
            dica="É este campo que permite dizer se o preço é comparável ao item da emenda."
          >
            <input id="rf-objeto" className="campo h-12 px-3.5" placeholder="o que foi contratado, tabelado ou cotado na origem" {...m("objeto")} />
          </Campo>
          <Campo rotulo="Observação" htmlFor="rf-obs">
            <input id="rf-obs" className="campo h-12 px-3.5" placeholder="opcional" {...m("observacao")} />
          </Campo>
        </div>
      </DialogContent>
    </Dialog>
  );
}
