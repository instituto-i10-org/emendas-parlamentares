import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { Pagina } from "@/components/emenda/avisos-pagina";
import { DescartarRascunho } from "@/components/emenda/descartar-rascunho";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import type { Prisma } from "@/generated/prisma/client";
import { podeCriarEmenda, podeGerirEmenda, podeVerTodasEmendas } from "@/lib/authz";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Emendas — Emendas360" };

const STATUS: Record<string, { rotulo: string; tipo: "ok" | "warn" | "bad" | "info" | "neutro" }> = {
  RASCUNHO: { rotulo: "Rascunho", tipo: "neutro" },
  SUBMETIDA: { rotulo: "Submetida", tipo: "info" },
  APROVADA: { rotulo: "Aprovada", tipo: "ok" },
  REJEITADA: { rotulo: "Rejeitada", tipo: "bad" },
};

export default async function EmendasPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const user = await getCurrentUser();
  const ano = await getAnoAtivo();
  const todas = podeVerTodasEmendas(user);
  const autor = await prisma.autor.findUnique({ where: { usuarioId: user.id } });

  const onde: Prisma.EmendaWhereInput = {
    exercicio: { ano: ano ?? -1 },
    ...(todas ? {} : { autorId: autor?.id ?? "-" }),
  };
  const [emendas, importadas] = await Promise.all([
    prisma.emenda.findMany({
      where: onde,
      orderBy: [{ updatedAt: "desc" }],
      include: { destino: true, autor: true },
      take: 200,
    }),
    prisma.emendaImportada.aggregate({
      where: { exercicio: { ano: ano ?? -1 }, ...(todas ? {} : { autorId: autor?.id ?? "-" }) },
      _count: { _all: true },
      _sum: { valor: true },
    }),
  ]);

  return (
    <Pagina
      titulo={todas ? "Emendas do exercício" : "Minhas emendas"}
      acoes={
        podeCriarEmenda(user) ? (
          <Button asChild>
            <Link href="/emendas/nova">
              <FilePlus2 /> Nova emenda
            </Link>
          </Button>
        ) : null
      }
    >
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

      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        {emendas.length ? (
          <div className="overflow-x-auto">
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
                        atualizada em {x.updatedAt.toLocaleDateString("pt-BR")}
                        {x.parcela ? ` · ${x.parcela === "SAUDE" ? "saúde" : "demais áreas"}` : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-md:hidden">{x.destino?.nome ?? "—"}</td>
                    {todas ? <td className="px-5 py-3.5 max-lg:hidden">{x.autor.nome}</td> : null}
                    <td className="px-5 py-3.5 text-right font-bold whitespace-nowrap tnum">{x.valor.toNumber() > 0 ? BRL(x.valor.toNumber()) : "—"}</td>
                    <td className="px-5 py-3.5">
                      <Selo tipo={STATUS[x.status].tipo}>{STATUS[x.status].rotulo}</Selo>
                    </td>
                    <td className="px-3 py-2">
                      {x.status === "RASCUNHO" && podeGerirEmenda(user, { autorUsuarioId: x.autor.usuarioId }) ? (
                        <DescartarRascunho id={x.id} rotulo={x.objeto ? `“${x.objeto.slice(0, 80)}”` : "Este rascunho"} />
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
            {podeCriarEmenda(user) ? " Use “Nova emenda” para começar." : ""}
          </div>
        )}
      </div>

      {importadas._count._all ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Além destas, {importadas._count._all} emenda(s) apresentada(s) fora do sistema foram importadas para o exercício, somando{" "}
          {BRL(importadas._sum.valor?.toNumber() ?? 0)}. Elas contam para a cota individual.
        </p>
      ) : null}
    </Pagina>
  );
}
