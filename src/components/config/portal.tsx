"use client";

import { useState } from "react";
import { Cartao } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { definirManual, definirPortal } from "@/lib/actions/portal";
import { useAcao } from "./comum";

export function AbaPortal({
  portalPublico,
  atoId,
  publicadoEm,
  publicadoPor,
  atos,
  podeEditar,
}: {
  portalPublico: boolean;
  atoId: string | null;
  publicadoEm: string | null;
  publicadoPor: string | null;
  atos: { id: string; rotulo: string }[];
  podeEditar: boolean;
}) {
  const [ato, setAto] = useState(atoId ?? "");
  const { pendente, executar } = useAcao();
  return (
    <div className="grid gap-5">
      <Cartao guia="config.portal.portal" titulo="Portal público" ajuda="Desligado, o portal mostra que está indisponível e a conformidade aponta a pendência. O link da entidade continua funcionando.">
        <div className="flex flex-wrap items-center gap-3">
          <Selo tipo={portalPublico ? "ok" : "warn"}>{portalPublico ? "Ligado" : "Desligado"}</Selo>
          {podeEditar ? (
            <Button variant="surface" size="sm" disabled={pendente} onClick={() => executar(() => definirPortal(!portalPublico))}>
              {portalPublico ? "Desligar portal" : "Ligar portal"}
            </Button>
          ) : null}
        </div>
      </Cartao>
      <Cartao guia="config.portal.manual" titulo="Manual orientativo" ajuda="O manual público lê os parâmetros do sistema. Instituído por um ato cadastrado nas normas, e publicado.">
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-semibold text-label" htmlFor="ato-manual">
            Ato que institui o manual
            <select id="ato-manual" className="campo h-11 px-3 font-normal" value={ato} disabled={!podeEditar} onChange={(e) => setAto(e.target.value)}>
              <option value="">Nenhum (cadastre o ato em Base legal)</option>
              {atos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.rotulo}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm">
            Situação: {publicadoEm ? <Selo tipo="ok">Publicado em {publicadoEm} por {publicadoPor}</Selo> : <Selo tipo="warn">Não publicado</Selo>}
          </p>
          {podeEditar ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={pendente} onClick={() => executar(() => definirManual({ atoId: ato || null, publicar: true }))}>
                {publicadoEm ? "Salvar ato" : "Publicar manual"}
              </Button>
              {publicadoEm ? (
                <Button variant="ghost" disabled={pendente} onClick={() => executar(() => definirManual({ atoId: ato || null, publicar: false }))}>
                  Retirar publicação
                </Button>
              ) : null}
              <Button variant="ghost" asChild>
                <a href="/publica/manual" target="_blank" rel="noopener">
                  Ver o manual
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </Cartao>
    </div>
  );
}
