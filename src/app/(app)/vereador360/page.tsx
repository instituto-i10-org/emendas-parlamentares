import type { Metadata } from "next";
import Link from "next/link";
import { Barra, Cartao, Kpi, Pagina, TabelaDados } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { podeVerTodasEmendas } from "@/lib/authz";
import { consolidar, listarEmendas, situacaoCota } from "@/lib/emendas/consultas";
import { PARCELA, STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL, norm } from "@/lib/riep";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vereador 360 — Emendas360" };

// Visão de um vereador: cota, parcelas e cada item. O gabinete vê só o
// próprio autor; quem vê todas as emendas escolhe o vereador na lista.
export default async function Vereador360Page({ searchParams }: { searchParams: Promise<{ autor?: string; q?: string }> }) {
  const user = await requireAccess({ poder: Poder.LEGISLATIVO });
  const { autor: autorParam, q } = await searchParams;
  const ano = await getAnoAtivo();
  const c = ano ? await consolidar(ano) : null;
  const proprio = await prisma.autor.findUnique({ where: { usuarioId: user.id } });
  const vetodos = podeVerTodasEmendas(user);
  const autorId = vetodos ? autorParam ?? proprio?.id ?? c?.porAutor[0]?.autorId : proprio?.id;
  if (!c || !autorId) {
    return (
      <Pagina titulo="Vereador 360">
        <Cartao>
          <p className="text-sm text-muted-foreground">Sua conta não está vinculada a um vereador, ou não há exercício configurado.</p>
        </Cartao>
      </Pagina>
    );
  }
  const a = c.porAutor.find((x) => x.autorId === autorId) ?? {
    autorId,
    nome: proprio?.nome ?? "—",
    partido: null,
    itens: 0,
    saude: 0,
    demais: 0,
    total: 0,
    importadas: 0,
  };
  const [emendas, importadas] = await Promise.all([
    listarEmendas(ano!, { autorId }),
    prisma.emendaImportada.findMany({ where: { autorId, exercicio: { ano: ano! } }, orderBy: { numero: "asc" } }),
  ]);
  const s = situacaoCota(a, c);
  const parcelaSaude = c.cotaIndividual !== null ? (c.cotaIndividual * c.percentualSaude) / 100 : null;
  const parcelaDemais = c.cotaIndividual !== null && parcelaSaude !== null ? c.cotaIndividual - parcelaSaude : null;
  const lista = c.porAutor.filter((x) => !q || norm(x.nome).includes(norm(q)));

  return (
    <Pagina titulo="Vereador 360" descricao="A cota individual em duas parcelas — saúde e demais áreas — e cada emenda que a consome.">
      <div className={cn("grid items-start gap-5", vetodos && "grid-cols-[300px_minmax(0,1fr)] max-[1000px]:grid-cols-1")}>
        {vetodos ? (
          <Cartao titulo="Vereadores">
            <form className="mb-3">
              <input name="q" defaultValue={q} className="campo h-10 px-3" placeholder="Buscar vereador" aria-label="Buscar vereador" />
            </form>
            <ul className="grid grid-cols-1 gap-1">
              {lista.map((x) => {
                const sx = situacaoCota(x, c);
                return (
                  <li key={x.autorId}>
                    <Link
                      href={`/vereador360?autor=${x.autorId}`}
                      className={cn("block rounded-md px-3 py-2 text-sm hover:bg-soft", x.autorId === autorId && "bg-info-bg font-bold")}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate" title={x.nome}>{x.nome}</span>
                        {sx.tom !== "ok" ? <span className="shrink-0 text-2xs font-bold text-muted-foreground">{sx.rotulo}</span> : null}
                      </span>
                      {c.cotaIndividual ? (
                        <span className="mt-1 block">
                          <Barra valor={x.total} total={c.cotaIndividual} tom={sx.tom === "bad" ? "bad" : "cyan"} />
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Cartao>
        ) : null}

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Cartao>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-extrabold">{a.nome}</h2>
              {a.partido ? <Selo>{a.partido}</Selo> : null}
              <Selo tipo={s.tom}>{s.rotulo}</Selo>
            </div>
          </Cartao>
          <div className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-2">
            <Kpi rotulo="Cota individual" valor={c.cotaIndividual !== null ? BRL(c.cotaIndividual) : "não definida"} detalhe={parcelaSaude !== null ? `${BRL(parcelaSaude)} reservados à saúde` : undefined} tom="navy" />
            <Kpi rotulo="Comprometido" valor={BRL(a.total)} detalhe={`${a.itens} emenda${a.itens === 1 ? "" : "s"}${a.importadas ? `, ${a.importadas} fora do sistema` : ""}`} />
            <Kpi rotulo="Saldo da cota" valor={c.cotaIndividual !== null ? BRL(Math.max(0, c.cotaIndividual - a.total)) : "—"} tom={c.cotaIndividual !== null && a.total - c.cotaIndividual > 0.005 ? "bad" : "ok"} />
            <Kpi rotulo="Saúde" valor={BRL(a.saude)} detalhe={parcelaSaude !== null ? `mínimo ${BRL(parcelaSaude)}` : undefined} tom={parcelaSaude !== null && a.saude + 0.005 >= parcelaSaude ? "ok" : undefined} />
            <Kpi rotulo="Demais áreas" valor={BRL(a.demais)} detalhe={parcelaDemais !== null ? `limite ${BRL(parcelaDemais)}` : undefined} tom={parcelaDemais !== null && a.demais - parcelaDemais > 0.005 ? "bad" : undefined} />
          </div>

          <Cartao titulo="Emendas no sistema">
            <TabelaDados
              vazio="Nenhuma emenda elaborada no sistema."
              colunas={[{ titulo: "Nº" }, { titulo: "Objeto" }, { titulo: "Parcela" }, { titulo: "Situação" }, { titulo: "Valor", className: "text-right" }]}
              linhas={emendas.map((e) => ({
                chave: e.id,
                celulas: [
                  <b key="n" className="tnum">{e.numero ?? "—"}</b>,
                  <div key="o">
                    <Link href={`/emendas/${e.id}`} className="font-bold hover:underline">
                      {e.objeto || "Rascunho sem objeto"}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{e.destino?.nome ?? "—"}</span>
                  </div>,
                  e.parcelaEfetiva ? PARCELA[e.parcelaEfetiva] : "—",
                  <Selo key="s" tipo={STATUS_EMENDA[e.status].tipo}>{STATUS_EMENDA[e.status].rotulo}</Selo>,
                  <b key="v" className="whitespace-nowrap tnum">{BRL(e.valor.toNumber())}</b>,
                ],
              }))}
            />
          </Cartao>

          {importadas.length ? (
            <Cartao
              titulo={`Apresentadas fora do sistema (${importadas.length})`}
              ajuda="Lidas por OCR do documento da Câmara. Sem área identificada, dividem-se entre saúde e demais pela meação legal."
            >
              <TabelaDados
                colunas={[{ titulo: "Nº" }, { titulo: "Descrição" }, { titulo: "Valor", className: "text-right" }]}
                linhas={importadas.map((i) => ({
                  chave: i.id,
                  celulas: [
                    <b key="n" className="tnum">{i.numero}</b>,
                    <div key="d">
                      <p className="line-clamp-3 text-sm">{i.descricao}</p>
                      {i.observacao ? <p className="text-xs text-warn">{i.observacao}</p> : null}
                    </div>,
                    <b key="v" className="whitespace-nowrap tnum">{BRL(i.valor.toNumber())}</b>,
                  ],
                }))}
              />
            </Cartao>
          ) : null}
        </div>
      </div>
    </Pagina>
  );
}
