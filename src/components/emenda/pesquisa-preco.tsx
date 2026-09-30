"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { buscarPrecos } from "@/lib/actions/servicos";
import { BRL } from "@/lib/riep";
import type { ResultadoPreco } from "@/lib/servicos/precos";
import { cn } from "@/lib/utils";
import { Ajuda, TextoRico } from "./ui";

// Pesquisa de preço: resultados do PNIGP (e das tabelas de engenharia). Nada
// entra na memória de cálculo sem conferência: o resultado abre para revisão e
// só a aprovação cria a referência e a linha.
export function PesquisaPreco({
  objeto,
  orientacao,
  aoAprovar,
}: {
  objeto: string;
  orientacao: string | null;
  aoAprovar: (p: ResultadoPreco, unidade: string, consulta: string) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<{ consulta: string; itens: ResultadoPreco[]; indisponiveis: string[]; aproximados: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState<ResultadoPreco | null>(null);
  const [unidade, setUnidade] = useState("");
  const pedido = useRef(0);

  async function pesquisar() {
    const q = consulta.trim();
    if (q.length < 3 || q.length > 160) {
      setErro("Digite de 3 a 160 caracteres para pesquisar.");
      return;
    }
    const n = ++pedido.current;
    setBuscando(true);
    setErro(null);
    try {
      const r = await buscarPrecos(q, objeto);
      if (n !== pedido.current) return;
      if (!r.ok) {
        setErro(r.erro);
        setResultado(null);
        return;
      }
      setResultado({ consulta: q, itens: r.resultados, indisponiveis: r.indisponiveis, aproximados: r.aproximados });
    } finally {
      if (n === pedido.current) setBuscando(false);
    }
  }

  return (
    <div className="caixa rounded-box bg-soft p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="antena">Pesquisa de preço</span>
        <Ajuda titulo="Sobre os preços de referência">
          <p>
            <b>Estimativa preliminar.</b> Os valores vêm de contratações e tabelas públicas de outros órgãos e períodos e servem apenas para
            dimensionar a emenda. <b>Não substituem a pesquisa formal de preços</b>, que compete ao Poder Executivo na fase preparatória da
            contratação. Confira cada valor na fonte antes de aprová-lo.
          </p>
          {orientacao ? (
            <p className="mt-2">
              <b>Onde buscar preço para este tipo de objeto:</b> <TextoRico texto={orientacao} />
            </p>
          ) : null}
        </Ajuda>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">Busque uma referência e confira antes de adicionar.</p>
      <div className="flex gap-2 max-sm:flex-col">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            className="campo h-12 pr-3.5 pl-11"
            placeholder="Buscar produto ou serviço"
            aria-label="Produto ou serviço para pesquisar preços"
            maxLength={160}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), pesquisar())}
          />
        </div>
        <Button onClick={pesquisar} disabled={buscando}>
          {buscando ? "Pesquisando…" : "Pesquisar"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Valores de referência. Confira a fonte antes de usar.</p>

      <div aria-live="polite">
        {erro ? <p className="mt-3 text-sm text-bad-ink">{erro}</p> : null}
        {resultado ? (
          <div className="mt-3 overflow-hidden rounded-field border border-line bg-surface">
            <p className="border-b border-line px-3.5 py-3 text-xs text-muted-foreground">
              {resultado.itens.length
                ? resultado.aproximados
                  ? `Nenhuma referência menciona "${resultado.consulta}". Estes ${resultado.itens.length} resultados são aproximados — confira a descrição antes de usar, ou refine a consulta.`
                  : `${resultado.itens.length} referências encontradas, as que mencionam a consulta primeiro. Confira a descrição e a unidade de cada resultado.`
                : "Nenhuma referência encontrada para este termo. Tente uma descrição mais curta ou um sinônimo."}
              {resultado.indisponiveis.length ? ` Fontes indisponíveis nesta consulta: ${resultado.indisponiveis.join(", ")}.` : ""}
            </p>
            <div className="max-h-[228px] overflow-y-auto">
              {resultado.itens.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setConferindo(p);
                    setUnidade(p.unidade);
                  }}
                  className="flex w-full items-center gap-4 border-b border-line px-3.5 py-3 text-left last:border-b-0 hover:bg-info-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan"
                >
                  <span className="min-w-0 flex-1">
                    <strong className="line-clamp-2 text-sm font-bold">{p.descricao}</strong>
                    <span className="block text-xs text-muted-foreground">
                      {p.fonte} · {p.unidade || "Unidade não informada"}
                      {p.amostra ? ` · ${p.amostra} compras` : ""}
                      {p.periodo ? ` · ${p.periodo}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 text-sm font-bold tnum">
                    {BRL(p.preco)}
                    <span className="text-xs text-navy underline underline-offset-3">Conferir →</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={!!conferindo} onOpenChange={(a) => !a && setConferindo(null)}>
        {conferindo ? (
          <DialogContent
            titulo="Conferir referência de preço"
            acoes={
              <>
                <Button
                  onClick={() => {
                    if (!unidade.trim()) {
                      toast("Informe a unidade conferida na fonte.");
                      return;
                    }
                    aoAprovar(conferindo, unidade.trim(), resultado?.consulta ?? consulta);
                    setConferindo(null);
                    setResultado(null);
                    toast("Item e referência adicionados à memória de cálculo.");
                  }}
                >
                  Conferi a fonte e aprovo o lançamento
                </Button>
                <Button variant="ghost" onClick={() => setConferindo(null)}>
                  Descartar
                </Button>
              </>
            }
          >
            <p className="mb-3 text-md font-bold">{conferindo.descricao}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Fonte</dt>
              <dd>{conferindo.fonte}</dd>
              <dt className="text-muted-foreground">Identificação</dt>
              <dd>{conferindo.identificacao}</dd>
              <dt className="text-muted-foreground">Período da referência</dt>
              <dd>{conferindo.periodo ?? "Não informado pela fonte"}</dd>
              <dt className="text-muted-foreground">Consulta realizada em</dt>
              <dd>{new Date(conferindo.consultadoEm).toLocaleString("pt-BR")}</dd>
              <dt className="text-muted-foreground">Amostra</dt>
              <dd>
                {conferindo.amostra ? `${conferindo.amostra} compras` : "Não informada"}
                {conferindo.municipios ? ` · ${conferindo.municipios} município(s)` : ""}
              </dd>
            </dl>
            <label className="mt-4 mb-1.5 block text-sm font-semibold text-label" htmlFor="pr-unidade">
              Unidade da referência
            </label>
            <input
              id="pr-unidade"
              className={cn("campo h-12 px-3.5", conferindo.unidade && "opacity-80")}
              maxLength={120}
              readOnly={!!conferindo.unidade}
              placeholder="Informe a unidade após conferir a fonte"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
            />
            <p className="mt-3 text-xl font-extrabold tnum">
              {BRL(conferindo.preco)} <span className="text-sm font-semibold text-muted-foreground">por {unidade || "unidade a conferir"}</span>
            </p>
            {/^https?:\/\//i.test(conferindo.url) ? (
              <p className="mt-2 text-sm">
                <a href={conferindo.url} target="_blank" rel="noopener noreferrer" className="font-bold text-navy underline underline-offset-3">
                  Consultar no PNIGP / fonte
                </a>
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {conferindo.tipo === "PAINEL" ? "Mediana dos valores encontrados para esta descrição. " : ""}
              Confira se o serviço ou material corresponde ao que pretende contratar.
            </p>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
