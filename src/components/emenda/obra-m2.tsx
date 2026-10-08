"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useConfirmar } from "@/components/app/confirmar";
import { Button } from "@/components/ui/button";
import { formatarNumero, lerNumero } from "@/lib/emendas/estado";
import { BRL, itemObraM2, type CustoM2, type FontePreco, type ReferenciaPreco } from "@/lib/riep";
import { CampoNumero } from "./ui";

// Emenda de obra: sugestão de item único "área × custo de referência do m²".
// Só entra na memória de cálculo quando o autor clica; se já há itens, pede
// confirmação antes de trocá-los.
export function SugestaoObraM2({
  objeto,
  custo,
  fonte,
  codigo,
  temItens,
  aoAplicar,
}: {
  objeto: string;
  custo: CustoM2;
  fonte: Pick<FontePreco, "id" | "nome"> | null;
  codigo: string;
  temItens: boolean;
  aoAplicar: (r: ReferenciaPreco, item: { descricao: string; unidade: string; quantidade: string; valorUnitario: string; referencia: string }) => void;
}) {
  const [area, setArea] = useState("");
  const { confirmar, janela } = useConfirmar();
  const m2 = lerNumero(area);

  async function aplicar() {
    if (m2 <= 0) return;
    if (
      temItens &&
      !(await confirmar({
        titulo: "Trocar os itens pelo item único em m²",
        mensagem: "Os itens já informados na memória de cálculo saem e ficam só a linha da obra em m². As fontes já registradas continuam no quadro de origem.",
        rotulo: "Trocar itens",
      }))
    )
      return;
    const { referencia, item } = itemObraM2({ objeto, area: m2, custo, fonte, codigo });
    aoAplicar(referencia, {
      ...item,
      quantidade: formatarNumero(item.quantidade, 2),
      valorUnitario: formatarNumero(item.valorUnitario, 2),
    });
  }

  return (
    <div data-guia="nova-emenda.obra-m2" className="mt-4 rounded-box border border-hair bg-surface p-4">
      {janela}
      <p className="antena mb-1">Obra: orçamento por m²</p>
      <p className="text-sm text-muted-foreground">
        Para obra, basta um item: a área construída ou reformada multiplicada pelo custo de referência do m²,{" "}
        <b className="text-foreground">{BRL(custo.valor)}</b>
        {custo.competencia ? ` (${custo.competencia})` : ""}
        {custo.fonte ? ` — ${custo.fonte}` : ""}.
        {custo.url ? (
          <>
            {" "}
            <a href={custo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-navy hover:underline">
              Ver a fonte
              <ExternalLink className="size-3" aria-hidden />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </>
        ) : null}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-semibold text-label" htmlFor="obra-m2-area">
          Área (m²)
          <CampoNumero id="obra-m2-area" className="h-10 w-36 px-3 text-right" casas={2} completar={false} valor={area} aoMudar={setArea} placeholder="0,00" />
        </label>
        <div className="pb-2 text-sm">
          {m2 > 0 ? (
            <>
              Total: <b className="tnum">{BRL(Math.round(m2 * custo.valor * 100) / 100)}</b>
            </>
          ) : (
            <span className="text-muted-foreground">Informe a área para ver o total.</span>
          )}
        </div>
        <Button size="sm" variant="outline" className="ml-auto max-sm:ml-0" disabled={m2 <= 0} onClick={aplicar}>
          Usar item único em m²
        </Button>
      </div>
    </div>
  );
}
