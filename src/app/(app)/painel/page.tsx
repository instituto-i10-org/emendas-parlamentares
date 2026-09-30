import type { Metadata } from "next";
import Link from "next/link";
import { Barra, Cartao, Kpi, Pagina, TabelaDados } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { BotaoImprimir } from "@/components/app/botao-imprimir";
import { consolidar, situacaoCota } from "@/lib/emendas/consultas";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { getAnoAtivo } from "@/lib/exercicio";
import { BRL, PCT } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Resumo consolidado — Emendas360" };

// Resumo consolidado do exercício: o teto global, a divisão saúde × demais
// áreas e a situação da cota de cada vereador. Mesmo critério de parcela do
// motor (IC-CO 1002).
export default async function PainelPage() {
  await getCurrentUser();
  const ano = await getAnoAtivo();
  const c = ano ? await consolidar(ano) : null;
  if (!c) {
    return (
      <Pagina titulo="Resumo consolidado">
        <Cartao>
          <p className="text-sm text-muted-foreground">Nenhum exercício configurado.</p>
        </Cartao>
      </Pagina>
    );
  }
  const pisoSaude = c.tetoGlobal !== null ? (c.tetoGlobal * c.percentualSaude) / 100 : null;
  const alertas = c.porAutor.filter((a) => situacaoCota(a, c).tom !== "ok");
  const status = Object.entries(c.porStatus);

  return (
    <Pagina
      titulo="Resumo consolidado"
      descricao={`Emendas impositivas do exercício ${c.ano}. Contam submetidas, aprovadas e as apresentadas fora do sistema; rascunhos e rejeitadas não consomem cota.`}
      acoes={
        <BotaoImprimir variante="ghost" />
      }
    >
      <div className="mb-5 grid grid-cols-4 gap-3.5 max-lg:grid-cols-2">
        <Kpi
          rotulo="Teto global"
          valor={c.tetoGlobal !== null ? BRL(c.tetoGlobal) : "não parametrizado"}
          detalhe={c.cotaIndividual !== null ? `${BRL(c.cotaIndividual)} × ${c.numeroVereadores} vereadores` : "defina a cota do exercício"}
          tom="navy"
        />
        <Kpi
          rotulo="Indicado"
          valor={BRL(c.total)}
          detalhe={c.tetoGlobal ? `${PCT((c.total / c.tetoGlobal) * 100)} do teto` : undefined}
        />
        <Kpi
          rotulo="Saúde (IC-CO 1002)"
          valor={BRL(c.saude)}
          detalhe={pisoSaude !== null ? `mínimo de ${c.percentualSaude}% = ${BRL(pisoSaude)}` : undefined}
          tom={pisoSaude !== null && c.saude + 0.005 < pisoSaude && c.total >= (c.tetoGlobal ?? 0) ? "bad" : "ok"}
        />
        <Kpi rotulo="Demais áreas" valor={BRL(c.demais)} detalhe={c.total ? `${PCT((c.demais / c.total) * 100)} do indicado` : undefined} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-5 max-[1100px]:grid-cols-1">
        <Cartao titulo="Cota por vereador" ajuda={c.memoriaCota ?? undefined} acoes={alertas.length ? <Selo tipo="bad">{alertas.length} com alerta</Selo> : <Selo tipo="ok">todas conformes</Selo>}>
          <TabelaDados
            colunas={[
              { titulo: "Vereador" },
              { titulo: "Itens", className: "text-right" },
              { titulo: "Saúde", className: "text-right max-md:hidden" },
              { titulo: "Demais", className: "text-right max-md:hidden" },
              { titulo: "Total", className: "text-right" },
              { titulo: "Situação" },
            ]}
            linhas={c.porAutor.map((a) => {
              const s = situacaoCota(a, c);
              return {
                chave: a.autorId,
                celulas: [
                  <div key="n">
                    <Link href={`/vereador360?autor=${a.autorId}`} className="font-bold hover:underline">
                      {a.nome}
                    </Link>
                    {a.partido ? <span className="text-xs text-muted-foreground"> · {a.partido}</span> : null}
                    {c.cotaIndividual ? (
                      <div className="mt-1.5 max-w-[220px]">
                        <Barra valor={a.total} total={c.cotaIndividual} tom={s.tom === "bad" ? "bad" : "cyan"} />
                      </div>
                    ) : null}
                  </div>,
                  <span key="i" className="tnum">{a.itens}</span>,
                  <span key="s" className="whitespace-nowrap tnum">{BRL(a.saude)}</span>,
                  <span key="d" className="whitespace-nowrap tnum">{BRL(a.demais)}</span>,
                  <b key="t" className="whitespace-nowrap tnum">{BRL(a.total)}</b>,
                  <Selo key="st" tipo={s.tom}>{s.rotulo}</Selo>,
                ],
              };
            })}
          />
        </Cartao>

        {/* minmax(0,1fr): sem isso a coluna cresce até o texto mais longo (nome de
            destino truncado) e estoura a tela para a direita. */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Cartao titulo="Saúde × demais áreas">
            {c.total > 0 ? (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-page">
                  <i className="block bg-ok" style={{ width: `${(c.saude / c.total) * 100}%` }} />
                  <i className="block bg-cyan" style={{ width: `${(c.demais / c.total) * 100}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span>
                    <i className="mr-1 inline-block size-2 rounded-full bg-ok" />
                    Saúde {PCT((c.saude / c.total) * 100)}
                  </span>
                  <span>
                    <i className="mr-1 inline-block size-2 rounded-full bg-cyan" />
                    Demais {PCT((c.demais / c.total) * 100)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem valores indicados.</p>
            )}
          </Cartao>
          <Cartao titulo="Situação das emendas">
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 text-sm">
              {status.map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span>{k === "IMPORTADA" ? "Apresentadas fora do sistema" : STATUS_EMENDA[k]?.rotulo ?? k}</span>
                  <span className="shrink-0 whitespace-nowrap tnum">
                    {v.qtd} · <b>{BRL(v.valor)}</b>
                  </span>
                </li>
              ))}
            </ul>
          </Cartao>
          <Cartao titulo="Maiores destinos (no sistema)">
            {c.porDestino.length ? (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 text-sm">
                {c.porDestino.slice(0, 7).map((d) => (
                  <li key={d.nome}>
                    <div className="flex min-w-0 justify-between gap-2">
                      <span className="min-w-0 truncate">{d.nome}</span>
                      <b className="shrink-0 whitespace-nowrap tnum">{BRL(d.valor)}</b>
                    </div>
                    <Barra valor={d.valor} total={c.porDestino[0].valor} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">As emendas importadas não trazem destino estruturado.</p>
            )}
          </Cartao>
        </div>
      </div>
    </Pagina>
  );
}
