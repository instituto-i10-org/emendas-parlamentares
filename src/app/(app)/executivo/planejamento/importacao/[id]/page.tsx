import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cartao, Kpi, Pagina, TabelaDados } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { AcoesConferencia, EditarLinha, LeituraEmAndamento, MapeamentoColunas, RetomarLeitura, TotalImpresso } from "@/components/planejamento/importacao";
import { Button } from "@/components/ui/button";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { resumoConferencia } from "@/lib/actions/importacao";
import { podeGerirPlanejamento } from "@/lib/authz";
import { CAMPOS, ROTULO_CARGA } from "@/lib/orcamento/colunas";
import type { Progresso } from "@/lib/orcamento/pdf/leitura";
import { prisma } from "@/lib/prisma";
import { BRL, DATA_HORA } from "@/lib/riep";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Importação da base — Emendas360" };

const POR_PAGINA = 50;
const FORMATO: Record<string, string> = { PLANILHA: "planilha", PDF_TEXTO: "PDF com texto", PDF_IMAGEM: "PDF digitalizado", IMAGEM: "foto" };
const SITUACAO: Record<string, [string, "ok" | "warn" | "bad" | "info" | "neutro"]> = {
  MAPEAR: ["colunas a ligar", "warn"],
  LENDO: ["lendo", "info"],
  LIDA: ["em conferência", "info"],
  GRAVADA: ["gravada", "ok"],
  CANCELADA: ["cancelada", "neutro"],
  ERRO: ["parada por erro", "bad"],
};

export default async function ImportacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filtro?: string; pagina?: string }> }) {
  const user = await requireAccess({ poder: Poder.EXECUTIVO, permissoes: ["gerirPlanejamento", "consultarTudo"] });
  const gere = podeGerirPlanejamento(user);
  const { id } = await params;
  const { filtro = "recusadas", pagina: pg } = await searchParams;
  const imp = await prisma.importacao.findUnique({ where: { id }, include: { instrumento: true, arquivo: true, _count: { select: { linhas: true } } } });
  if (!imp) notFound();
  const definicoes = CAMPOS[imp.tipoCarga];
  const [rotulo, tom] = SITUACAO[imp.situacao];
  const progresso = imp.progresso as unknown as Progresso | null;

  const onde =
    filtro === "recusadas"
      ? { importacaoId: id, motivos: { isEmpty: false } }
      : filtro === "avisos"
        ? { importacaoId: id, avisos: { isEmpty: false } }
        : { importacaoId: id };
  const pagina = Math.max(1, Number(pg) || 1);
  const [linhas, nFiltro, nRecusadas, nAvisos] = await Promise.all([
    prisma.linhaImportada.findMany({ where: onde, orderBy: [{ pagina: "asc" }, { numero: "asc" }], skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA }),
    prisma.linhaImportada.count({ where: onde }),
    prisma.linhaImportada.count({ where: { importacaoId: id, motivos: { isEmpty: false } } }),
    prisma.linhaImportada.count({ where: { importacaoId: id, avisos: { isEmpty: false } } }),
  ]);
  const resumo = imp.situacao === "LIDA" || imp.situacao === "GRAVADA" ? await resumoConferencia(id) : null;
  const paginas = Math.max(1, Math.ceil(nFiltro / POR_PAGINA));
  const link = (f: string, p = 1) => `/executivo/planejamento/importacao/${id}?filtro=${f}&pagina=${p}`;
  const editavel = gere && imp.situacao === "LIDA";

  return (
    <Pagina
      titulo={`Importação · ${imp.instrumento.tipo} ${imp.instrumento.numero}`}
      guia="importacao"
      trilha={[{ rotulo: "Planejamento", href: "/executivo/planejamento" }, { rotulo: "Importação" }]}
      descricao={`${ROTULO_CARGA[imp.tipoCarga]} de ${imp.arquivo.nome} (${FORMATO[imp.formato]}). Nada vai para a base antes da confirmação.`}
      acoes={
        <Button variant="ghost" asChild>
          <Link href="/executivo/planejamento">Voltar</Link>
        </Button>
      }
    >
      <div data-guia="importacao.situacao" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Selo tipo={tom}>{rotulo}</Selo>
        <span className="text-muted-foreground">Iniciada em {DATA_HORA(imp.criadoEm)}</span>
        {imp.gravadaEm ? <span className="text-muted-foreground">· gravada em {DATA_HORA(imp.gravadaEm)}</span> : null}
      </div>

      {imp.situacao === "LENDO" && gere ? (
        <Cartao guia="importacao.leitura" titulo="Leitura do documento">
          <LeituraEmAndamento id={id} mensagemInicial={progresso?.mensagem ?? ""} lidasInicial={imp.paginasLidas} total={progresso?.paginasQuadro.length || imp.paginas || 0} />
        </Cartao>
      ) : null}
      {imp.situacao === "ERRO" ? (
        <Cartao guia="importacao.leitura" titulo="Leitura parada">
          <p className="mb-3 text-sm text-bad-ink">{imp.erro}</p>
          {gere ? <RetomarLeitura id={id} /> : null}
        </Cartao>
      ) : null}
      {imp.situacao === "MAPEAR" && gere ? (
        <Cartao guia="importacao.mapa" titulo="Colunas da planilha">
          <MapeamentoColunas id={id} cabecalho={imp.cabecalho} campos={definicoes} inicial={(imp.mapa ?? {}) as Record<string, number>} />
        </Cartao>
      ) : null}

      {resumo ? (
        <div className="grid gap-5">
          <div data-guia="importacao.totais" className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <Kpi rotulo="Linhas válidas" valor={resumo.validas} tom="navy" />
            <Kpi rotulo="Linhas recusadas" valor={resumo.recusadas} detalhe={resumo.recusadas ? "não entram na base" : "nenhuma"} />
            {resumo.tipo === "DOTACOES" ? (
              <>
                <Kpi rotulo="Total lido" valor={BRL(resumo.totalLido)} />
                <Kpi
                  rotulo="Conferência"
                  valor={resumo.totalImpresso === null ? "sem total impresso" : resumo.bate ? "confere" : `diferença ${BRL(resumo.diferenca ?? 0)}`}
                  tom={resumo.bate ? "ok" : undefined}
                />
              </>
            ) : null}
          </div>

          {resumo.tipo === "DOTACOES" ? (
            <Cartao guia="importacao.conferencia" titulo="Conferência com a peça">
              <TotalImpresso id={id} valor={resumo.totalImpresso} editavel={editavel} />
              {resumo.recarga ? (
                <ul className="mt-4 grid gap-1 text-sm">
                  <li>
                    Base do instrumento: <b>{resumo.recarga.criar}</b> dotações novas, <b>{resumo.recarga.atualizar}</b> atualizadas no lugar ({resumo.recarga.mudamValor} com valor diferente),{" "}
                    <b>{resumo.recarga.desativar}</b> que saem da base.
                  </li>
                  <li>
                    Cadastros novos: {resumo.novos.orgaos} órgãos, {resumo.novos.unidades} unidades, {resumo.novos.programas} programas, {resumo.novos.acoes} ações.
                  </li>
                  {resumo.programasProvisorios ? (
                    <li className="text-warn">
                      {resumo.programasProvisorios} programa(s) sem nome no quadro ficam com nome provisório (“Programa 0009”); a carga do PPA completa os nomes.
                    </li>
                  ) : null}
                  {resumo.recarga.travas.map((t) => (
                    <li key={t} className="text-bad-ink">
                      {t}
                    </li>
                  ))}
                </ul>
              ) : null}
              {imp.situacao === "LIDA" && gere ? (
                <div data-guia="importacao.confirmar" className="mt-4">
                  <AcoesConferencia id={id} podeConfirmar={resumo.podeConfirmar} porQueNao={resumo.porQueNao} />
                </div>
              ) : null}
            </Cartao>
          ) : imp.situacao === "LIDA" && gere ? (
            <Cartao guia="importacao.confirmar">
              <AcoesConferencia id={id} podeConfirmar={resumo.podeConfirmar} porQueNao={resumo.porQueNao} />
            </Cartao>
          ) : null}

          {resumo.tipo === "DOTACOES" ? (
            <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
              <Cartao titulo="Total por órgão">
                <TabelaDados
                  vazio="—"
                  colunas={[{ titulo: "Órgão" }, { titulo: "Linhas", className: "text-right" }, { titulo: "Valor", className: "text-right" }]}
                  linhas={resumo.porOrgao.map((o) => ({
                    chave: o.codigo,
                    celulas: [`${o.codigo} — ${o.nome}`, <span key="l" className="tnum">{o.linhas}</span>, <b key="v" className="whitespace-nowrap tnum">{BRL(o.valor)}</b>],
                  }))}
                />
              </Cartao>
              <Cartao titulo="Total por unidade">
                <TabelaDados
                  vazio="—"
                  colunas={[{ titulo: "Unidade" }, { titulo: "Linhas", className: "text-right" }, { titulo: "Valor", className: "text-right" }]}
                  linhas={resumo.porUnidade.map((o) => ({
                    chave: o.codigo,
                    celulas: [`${o.codigo} — ${o.nome}`, <span key="l" className="tnum">{o.linhas}</span>, <b key="v" className="whitespace-nowrap tnum">{BRL(o.valor)}</b>],
                  }))}
                />
              </Cartao>
            </div>
          ) : null}
        </div>
      ) : null}

      {imp._count.linhas ? (
        <Cartao
          guia="importacao.linhas"
          titulo="Linhas lidas"
          className="mt-5"
          acoes={
            <div data-guia="importacao.relatorio" className="flex flex-wrap gap-2">
              {editavel ? <EditarLinha id={id} campos={{}} definicoes={definicoes} rotulo="Incluir linha" /> : null}
              <Button size="sm" variant="ghost" asChild>
                <a href={`/api/importacao/${id}/relatorio`}>Relatório de recusas (CSV)</a>
              </Button>
            </div>
          }
        >
          <nav data-guia="importacao.filtro" aria-label="Filtro" className="mb-3 flex flex-wrap gap-1">
            {[
              ["recusadas", `Recusadas (${nRecusadas})`],
              ["avisos", `Com aviso (${nAvisos})`],
              ["todas", `Todas (${imp._count.linhas})`],
            ].map(([f, t]) => (
              <Link key={f} href={link(f)} aria-current={filtro === f ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold", filtro === f ? "bg-navy text-white" : "text-muted-foreground hover:bg-soft")}>
                {t}
              </Link>
            ))}
          </nav>
          <TabelaDados
            vazio={filtro === "recusadas" ? "Nenhuma linha recusada." : filtro === "avisos" ? "Nenhuma linha com aviso." : "Nenhuma linha."}
            colunas={[{ titulo: "Linha" }, { titulo: "Conteúdo" }, { titulo: "Situação" }, { titulo: "" }]}
            linhas={linhas.map((l) => {
              const c = l.campos as Record<string, string>;
              return {
                chave: l.id,
                celulas: [
                  <span key="n" className="text-xs whitespace-nowrap tnum">
                    {l.pagina ? `p. ${l.pagina} · ` : ""}
                    {imp.formato === "PLANILHA" ? `linha ${l.numero}` : `#${l.numero}`}
                  </span>,
                  <span key="c" className="text-xs">
                    {[c.unidade_codigo, c.funcional || [c.funcao_codigo, c.subfuncao_codigo, c.programa_codigo, c.acao_codigo].filter(Boolean).join("."), c.natureza_codigo, c.fonte_codigo, c.ficha && `ficha ${c.ficha}`, c.valor_autorizado, c.programa_codigo && !c.unidade_codigo ? c.programa_codigo : "", c.descricao]
                      .filter(Boolean)
                      .join(" · ")}
                    {c.acao_nome ? <span className="block text-muted-foreground">{c.acao_nome}</span> : null}
                  </span>,
                  <div key="s" className="text-xs">
                    {l.motivos.map((m) => (
                      <span key={m} className="block text-bad-ink">
                        {m}
                      </span>
                    ))}
                    {l.avisos.map((m) => (
                      <span key={m} className="block text-warn">
                        {m}
                      </span>
                    ))}
                    {!l.motivos.length && !l.avisos.length ? <Selo tipo="ok">válida</Selo> : null}
                    {l.corrigidaEm ? <span className="block text-muted-foreground">{l.incluida ? "incluída" : "corrigida"} em {DATA_HORA(l.corrigidaEm)}</span> : null}
                  </div>,
                  editavel ? <EditarLinha key="e" id={id} linhaId={l.id} campos={c} definicoes={definicoes} rotulo="Corrigir" /> : null,
                ],
              };
            })}
          />
          {paginas > 1 ? (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Página {pagina} de {paginas}
              </span>
              <span className="flex gap-2">
                {pagina > 1 ? (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={link(filtro, pagina - 1)}>Anterior</Link>
                  </Button>
                ) : null}
                {pagina < paginas ? (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={link(filtro, pagina + 1)}>Próxima</Link>
                  </Button>
                ) : null}
              </span>
            </div>
          ) : null}
        </Cartao>
      ) : null}
    </Pagina>
  );
}
