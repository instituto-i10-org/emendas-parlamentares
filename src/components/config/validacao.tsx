"use client";

import { useState } from "react";
import { Cartao } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { salvarParametrosValidacao, salvarRegras } from "@/lib/actions/validacao";
import { VERIFICACOES } from "@/lib/riep/verificacoes";
import { useConfirmarImpacto } from "@/components/app/confirmar-impacto";

export type RegraTela = { codigo: string; modo: "BLOQUEANTE" | "ALERTA"; ativa: boolean; fundamento: string; normaId: string | null };
export type NormaTela = { id: string; rotulo: string };

// Parâmetros numéricos do exercício que levam fundamento por extenso.
const PARAMETROS: [string, string][] = [
  ["cotaIndividual", "Cota individual"],
  ["percentualSaude", "Percentual da saúde"],
  ["toleranciaValorPct", "Tolerância do valor"],
  ["validadeReferenciaMeses", "Validade das referências de preço"],
  ["prazoProtocolo", "Prazo de protocolo das emendas"],
  ["prazoDiligenciaDias", "Prazo da diligência"],
  ["validadeLinkEntidadeDias", "Validade do link da entidade"],
];

export function AbaValidacao({
  exercicioId,
  ano,
  regras,
  normas,
  prazoDiligenciaDias,
  fundamentos,
  podeEditar,
}: {
  exercicioId: string;
  ano: number;
  regras: RegraTela[];
  normas: NormaTela[];
  prazoDiligenciaDias: number;
  fundamentos: Record<string, { texto: string; normaId: string | null }>;
  podeEditar: boolean;
}) {
  const [dias, setDias] = useState(String(prazoDiligenciaDias));
  const inicial = (codigo: string, padrao: "BLOQUEANTE" | "ALERTA"): RegraTela =>
    regras.find((r) => r.codigo === codigo) ?? { codigo, modo: padrao, ativa: true, fundamento: "", normaId: null };
  const [lista, setLista] = useState<RegraTela[]>(() => VERIFICACOES.filter((v) => v.configuravel).map((v) => inicial(v.codigo, v.padrao)));
  const [fund, setFund] = useState(fundamentos);
  const conf = useConfirmarImpacto();
  const pendente = conf.pendente;
  const mudar = (codigo: string, parcial: Partial<RegraTela>) => setLista((l) => l.map((r) => (r.codigo === codigo ? { ...r, ...parcial } : r)));
  const regra = (codigo: string) => lista.find((r) => r.codigo === codigo)!;

  const seletorNorma = (id: string, valor: string | null, aoMudar: (v: string | null) => void) => (
    <span className="grid gap-1">
      <select id={id} className="campo h-10 px-2.5 text-sm" value={valor ?? ""} disabled={!podeEditar} onChange={(ev) => aoMudar(ev.target.value || null)}>
        <option value="">Sem norma vinculada</option>
        {normas.map((n) => (
          <option key={n.id} value={n.id}>
            {n.rotulo}
          </option>
        ))}
      </select>
      {valor ? (
        <a href={`/publica/manual#norma-${valor}`} target="_blank" rel="noopener" className="text-xs font-bold text-navy hover:underline">
          Ver a norma
        </a>
      ) : null}
    </span>
  );

  return (
    <div className="grid gap-5">
      {conf.janela}
      <Cartao guia="config.validacao.treze"
        titulo={`As treze verificações — exercício ${ano}`}
        ajuda="Bloqueante: a falha torna a emenda inválida. Alerta: aparece no relatório e não impede a remessa. A mudança vale na próxima validação, sem publicação nova."
      >
        <ol className="divide-y divide-hair">
          {VERIFICACOES.map((v) => {
            const r = v.configuravel ? regra(v.codigo) : null;
            return (
              <li key={v.codigo} className="grid gap-2 py-4" data-codigo={v.codigo}>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm">
                    ({v.numero}) {v.titulo}
                  </b>
                  {!v.configuravel ? <span data-guia="config.validacao.fixa"><Selo>fixa</Selo></span> : null}
                </div>
                {!v.configuravel || !r ? (
                  <p className="text-xs text-muted-foreground">
                    Sempre bloqueante. {v.porQueFixa} Fundamento: {v.fundamento}.
                  </p>
                ) : (
                  <div className="grid grid-cols-[180px_minmax(0,1fr)_minmax(0,260px)] items-start gap-2.5 max-lg:grid-cols-1">
                    <div data-guia="config.validacao.modo" className="grid gap-1.5">
                      <label className="sr-only" htmlFor={`modo-${v.codigo}`}>
                        Modo da verificação ({v.numero})
                      </label>
                      <select
                        id={`modo-${v.codigo}`}
                        className="campo h-10 px-2.5 text-sm"
                        value={r.modo}
                        disabled={!podeEditar}
                        onChange={(ev) => mudar(v.codigo, { modo: ev.target.value as RegraTela["modo"] })}
                      >
                        <option value="BLOQUEANTE">Bloqueante</option>
                        <option value="ALERTA">Só alerta</option>
                      </select>
                      {v.desligavel ? (
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={r.ativa} disabled={!podeEditar} onChange={(ev) => mudar(v.codigo, { ativa: ev.target.checked })} />
                          Prevista na Lei Orgânica
                        </label>
                      ) : null}
                    </div>
                    <label data-guia="config.validacao.fundamento" className="grid gap-1 text-xs text-muted-foreground">
                      Fundamento por extenso
                      <input
                        className="campo h-10 px-2.5 text-sm text-ink"
                        value={r.fundamento}
                        placeholder={v.fundamento}
                        disabled={!podeEditar}
                        onChange={(ev) => mudar(v.codigo, { fundamento: ev.target.value })}
                      />
                    </label>
                    <label data-guia="config.validacao.norma" className="grid gap-1 text-xs text-muted-foreground" htmlFor={`norma-${v.codigo}`}>
                      Norma citada
                      {seletorNorma(`norma-${v.codigo}`, r.normaId, (x) => mudar(v.codigo, { normaId: x }))}
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {podeEditar ? (
          <div className="mt-5">
            <Button
              data-guia="config.validacao.salvar"
              disabled={pendente}
              onClick={() =>
                conf.pedir({
                  titulo: `Salvar as regras de validação de ${ano}`,
                  impacto: { tipo: "regras", exercicioId, regras: lista },
                  rotulo: "Salvar regras",
                  acao: (ciente) => salvarRegras(exercicioId, lista, ciente),
                })
              }
            >
              Salvar regras
            </Button>
          </div>
        ) : null}
      </Cartao>

      <Cartao guia="config.validacao.parametros" titulo="Parâmetros da validação e da tramitação" ajuda="Cada parâmetro do exercício (os demais valores ficam na aba Exercício) leva o fundamento por extenso e, se houver, a norma citada. Parâmetro definido sem fundamento não é aceito.">
        <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
          <label className="grid gap-1 text-sm font-semibold text-label">
            Prazo padrão da diligência (dias)
            <input id="prazo-diligencia" type="number" min={1} max={30} className="campo h-11 px-3" value={dias} disabled={!podeEditar} onChange={(ev) => setDias(ev.target.value)} />
            <span className="text-xs font-medium text-muted-foreground">O Regimento Interno (art. 210-C, § 2º) prevê até 5 dias.</span>
          </label>
        </div>
        <h3 data-guia="config.validacao.fundamentos" className="mt-6 mb-2 text-sm font-bold">Fundamento de cada parâmetro</h3>
        <div className="grid gap-2.5">
          {PARAMETROS.map(([chave, rotulo]) => (
            <div key={chave} className="grid grid-cols-[200px_minmax(0,1fr)_minmax(0,260px)] items-center gap-2.5 max-lg:grid-cols-1">
              <span className="text-sm font-semibold">{rotulo}</span>
              <input
                aria-label={`Fundamento: ${rotulo}`}
                className="campo h-10 px-2.5 text-sm"
                value={fund[chave]?.texto ?? ""}
                disabled={!podeEditar}
                placeholder="Ex.: Lei Orgânica, art. 140"
                onChange={(ev) => setFund((f) => ({ ...f, [chave]: { texto: ev.target.value, normaId: f[chave]?.normaId ?? null } }))}
              />
              {seletorNorma(`fund-norma-${chave}`, fund[chave]?.normaId ?? null, (x) => setFund((f) => ({ ...f, [chave]: { texto: f[chave]?.texto ?? "", normaId: x } })))}
            </div>
          ))}
        </div>
        {podeEditar ? (
          <div className="mt-5">
            <Button
              disabled={pendente}
              onClick={() =>
                conf.pedir({
                  titulo: `Salvar os parâmetros da validação de ${ano}`,
                  impacto: { tipo: "parametrosValidacao", exercicioId, prazoDiligenciaDias: Number(dias), fundamentos: fund },
                  rotulo: "Salvar parâmetros",
                  acao: (ciente) => salvarParametrosValidacao(exercicioId, { prazoDiligenciaDias: Number(dias), fundamentos: fund }, ciente),
                })
              }
            >
              Salvar parâmetros da validação
            </Button>
          </div>
        ) : null}
      </Cartao>
    </div>
  );
}
