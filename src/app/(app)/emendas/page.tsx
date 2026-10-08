import type { Metadata } from "next";
import Link from "next/link";
import { Download, FilePlus2 } from "lucide-react";
import { Pagina } from "@/components/emenda/avisos-pagina";
import { ApagarEmendaTeste } from "@/components/emenda/apagar-emenda-teste";
import { DescartarRascunho } from "@/components/emenda/descartar-rascunho";
import { IndicadorEmendamento } from "@/components/emenda/indicador-emendamento";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import type { Prisma } from "@/generated/prisma/client";
import { apresentaEmendas, podeGerirEmenda, podeVerTodasEmendas } from "@/lib/authz";
import { FiltrosEmendas, Paginacao } from "@/components/app/filtros-emendas";
import { orgaosDaArea } from "@/lib/emendas/consultas";
import { lerEmendamento } from "@/lib/emendas/contexto";
import { POR_PAGINA, comFiltros, lerFiltros, ondeDosFiltros } from "@/lib/emendas/filtros";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { naoRemetida } from "@/lib/emendas/situacoes";
import { exercicioHistorico, getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL, DATA } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Emendas — Emendas360" };

// Situações que aparecem no filtro (em Mogi, "em validação" e "válida" não
// são usadas: a emenda vai do rascunho direto à remessa).
const SITUACOES_FILTRO = Object.keys(STATUS_EMENDA).filter((s) => s !== "EM_VALIDACAO" && s !== "VALIDA");

export default async function EmendasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : undefined;
  const filtros = lerFiltros(sp);
  const user = await getCurrentUser();
  const ano = await getAnoAtivo();
  const historico = ano !== null && (await exercicioHistorico(ano));
  const todas = podeVerTodasEmendas(user);
  const autor = await prisma.autor.findUnique({ where: { usuarioId: user.id } });

  const onde: Prisma.EmendaWhereInput = {
    exercicio: { ano: ano ?? -1 },
    ...(todas ? {} : { autorId: autor?.id ?? "-" }),
    ...ondeDosFiltros(filtros, await orgaosDaArea(filtros.areaId)),
  };
  const [emendas, total, importadas, autores, areas] = await Promise.all([
    prisma.emenda.findMany({
      where: onde,
      orderBy: [{ updatedAt: "desc" }],
      include: { destino: true, autor: true },
      skip: (filtros.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.emenda.count({ where: onde }),
    prisma.emendaImportada.aggregate({
      where: { exercicio: { ano: ano ?? -1 }, ...(todas ? {} : { autorId: autor?.id ?? "-" }) },
      _count: { _all: true },
      _sum: { valor: true },
    }),
    todas ? prisma.autor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [],
    prisma.areaAplicacao.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <Pagina
      titulo={todas ? "Emendas do exercício" : "Minhas emendas"}
      guia="emendas"
      acoes={
        apresentaEmendas(user, !!autor) && !historico ? (
          <Button asChild>
            <Link href="/emendas/nova">
              <FilePlus2 /> Nova emenda
            </Link>
          </Button>
        ) : null
      }
    >
      <IndicadorEmendamento s={ano ? await lerEmendamento(ano) : null} />
      {erro === "acesso-negado" ? (
        <p role="alert" className="mb-4 rounded-box bg-warn-bg px-4 py-3 text-sm font-semibold text-warn">
          Seu perfil não tem acesso à página solicitada.
        </p>
      ) : null}
      {erro === "sem-loa" ? (
        <p role="alert" className="mb-4 rounded-box bg-warn-bg px-4 py-3 text-sm font-semibold text-warn">
          O exercício ativo não tem LOA carregada. Não há dotação para classificar a emenda.
        </p>
      ) : null}

      <FiltrosEmendas guia="emendas.filtros" acao="/emendas" filtros={filtros} autores={autores} areas={areas} situacoes={SITUACOES_FILTRO} />
      <div data-guia="emendas.exportar" className="mb-3 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a href={comFiltros("/api/export/emendas", filtros, { ano: ano ?? "", formato: "xlsx", lista: 1 })}>
            <Download /> Exportar XLSX
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={comFiltros("/api/export/emendas", filtros, { ano: ano ?? "", formato: "csv", lista: 1 })}>
            <Download /> CSV
          </a>
        </Button>
      </div>
      <div data-guia="emendas.lista" className="overflow-hidden rounded-card bg-surface shadow-card">
        {emendas.length ? (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-soft text-left text-2xs font-bold tracking-[0.04em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3">Nº</th>
                  <th className="px-5 py-3">Objeto</th>
                  <th className="px-5 py-3 max-md:hidden">Destino</th>
                  {todas ? <th className="px-5 py-3 max-lg:hidden">Autor</th> : null}
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="w-12 px-3 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hair">
                {emendas.map((x) => (
                  <tr key={x.id} className="hover:bg-soft">
                    <td className="px-5 py-3.5 font-bold tnum">{x.numero ?? "—"}</td>
                    <td className="max-w-[420px] px-5 py-3.5">
                      <Link href={`/emendas/${x.id}`} className="font-bold hover:underline">
                        {x.objeto || "Rascunho sem objeto"}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        atualizada em {DATA(x.updatedAt)}
                        {x.parcela ? ` · ${x.parcela === "SAUDE" ? "saúde" : "demais áreas"}` : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-md:hidden">{x.destino?.nome ?? "—"}</td>
                    {todas ? <td className="px-5 py-3.5 max-lg:hidden">{x.autor.nome}</td> : null}
                    <td className="px-5 py-3.5 text-right font-bold whitespace-nowrap tnum">{x.valor.toNumber() > 0 ? BRL(x.valor.toNumber()) : "—"}</td>
                    <td className="px-5 py-3.5">
                      <Selo tipo={STATUS_EMENDA[x.status].tipo}>{STATUS_EMENDA[x.status].rotulo}</Selo>
                    </td>
                    <td className="px-3 py-2">
                      {!podeGerirEmenda(user, { autorUsuarioId: x.autor.usuarioId }) ? null : naoRemetida(x.status) ? (
                        <DescartarRascunho id={x.id} rotulo={x.objeto ? `“${x.objeto.slice(0, 80)}”` : "Este rascunho"} />
                      ) : x.autor.demonstracao ? (
                        <ApagarEmendaTeste id={x.id} rotulo={`Emenda nº ${x.numero ?? "—"}/${ano}`} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-7 text-sm text-muted-foreground">
            Nenhuma emenda elaborada no sistema neste exercício.
            {apresentaEmendas(user, !!autor) && !historico ? " Use “Nova emenda” para começar." : ""}
          </div>
        )}
      </div>

      <Paginacao base="/emendas" filtros={filtros} total={total} porPagina={POR_PAGINA} />
      {importadas._count._all ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Além destas, {importadas._count._all} emenda(s) apresentada(s) fora do sistema foram importadas para o exercício, somando{" "}
          {BRL(importadas._sum.valor?.toNumber() ?? 0)}. Elas contam para a cota individual.
        </p>
      ) : null}
    </Pagina>
  );
}
