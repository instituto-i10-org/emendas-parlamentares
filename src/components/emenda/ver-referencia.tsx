"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { verReferenciaPreco } from "@/lib/actions/referencia-preco";
import { INDISPONIVEL, type ConsultaBanco } from "@/lib/precos/banco-i10";
import { BRL } from "@/lib/riep";

// Referência do banco de preços i10 para o item da linha. Só mostra: o valor
// unitário continua sendo o que o autor pesquisou e informou.
export function VerReferencia({ item, urlBanco }: { item: string; urlBanco: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [r, setR] = useState<ConsultaBanco | null>(null);
  const [pendente, iniciar] = useTransition();
  const termo = item.trim();

  useEffect(() => {
    if (!aberto) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setR(null);
    iniciar(async () => {
      try {
        setR(await verReferenciaPreco(termo));
      } catch {
        setR({ ok: false, erro: INDISPONIVEL });
      }
    });
  }, [aberto, termo]);

  return (
    <>
      <button
        type="button"
        className="text-xs font-semibold text-navy underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        disabled={termo.length < 3}
        title={termo.length < 3 ? "Escreva o nome do item para ver a referência" : undefined}
        onClick={() => setAberto(true)}
      >
        Ver referência
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        {aberto ? (
          <DialogContent
            titulo="Referência de preço"
            largura="lg"
          >
            <p className="mb-3 text-sm text-muted-foreground">
              Banco de preços i10 para «<b className="text-foreground">{termo}</b>». É só uma referência: o valor da linha continua sendo o que
              você pesquisar e informar, com a fonte.
            </p>
            {pendente || !r ? (
              <p className="py-6 text-center text-sm text-muted-foreground" role="status">
                Consultando…
              </p>
            ) : !r.ok ? (
              <p className="rounded-box bg-soft px-4 py-3 text-sm" role="status">
                {r.erro}
              </p>
            ) : !r.resultados.length ? (
              <p className="rounded-box bg-soft px-4 py-3 text-sm" role="status">
                Nada encontrado para este nome. Tente um nome mais curto ou pesquise nas fontes oficiais.
              </p>
            ) : (
              <ul className="grid gap-2">
                {r.resultados.map((x, i) => (
                  <li key={i} className="rounded-box bg-soft px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="min-w-0 font-semibold">{x.item}</span>
                      <span className="text-md font-extrabold tnum">
                        {BRL(x.mediana)}
                        {x.unidade ? <span className="text-xs font-semibold text-muted-foreground"> / {x.unidade}</span> : null}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Mediana
                      {x.faixaMin !== null && x.faixaMax !== null && x.faixaMin !== x.faixaMax ? ` · faixa ${BRL(x.faixaMin)} a ${BRL(x.faixaMax)}` : ""}
                      {x.compras ? ` · ${x.compras} compra${x.compras > 1 ? "s" : ""}` : ""}
                      {x.municipios ? ` em ${x.municipios} município${x.municipios > 1 ? "s" : ""}` : ""}
                      {` · ${x.fonte}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {urlBanco ? (
              <a
                href={urlBanco}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-navy underline-offset-2 hover:underline"
              >
                Abrir o banco de preços i10
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
