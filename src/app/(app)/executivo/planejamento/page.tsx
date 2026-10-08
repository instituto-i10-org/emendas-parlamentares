import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, Kpi, Pagina, TabelaDados } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { IndicadorEmendamento } from "@/components/emenda/indicador-emendamento";
import { EditarInstrumento, ExcluirInstrumento, ImportarBase, ListaDotacoes, NovoInstrumento, StatusInstrumento } from "@/components/planejamento/componentes";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { podeGerirPlanejamento } from "@/lib/authz";
import { getAnoAtivo } from "@/lib/exercicio";
import { NATUREZAS_EMENDAVEIS } from "@/lib/orcamento/codigo-dotacao";
import { prisma } from "@/lib/prisma";
import { lerEmendamento } from "@/lib/emendas/contexto";
import { formatarNumero } from "@/lib/emendas/estado";
import { BRL, DATA, DATA_HORA } from "@/lib/riep";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Planejamento — Emendas360" };

const ABAS = [
  { id: "instrumentos", titulo: "Instrumentos" },
  { id: "base", titulo: "Base de dotações" },
  { id: "comparacao", titulo: "PL × lei aprovada" },
] as const;

export default async function PlanejamentoPage({ searchParams }: { searchParams: Promise<{ aba?: string; instrumento?: string }> }) {
  const user = await requireAccess({ poder: Poder.EXECUTIVO, permissoes: ["gerirPlanejamento", "consultarTudo"] });
  const { aba: abaParam, instrumento: instParam } = await searchParams;
  const aba = ABAS.find((a) => a.id === abaParam)?.id ?? "instrumentos";
  const podeGerir = podeGerirPlanejamento(user);
  const ano = await getAnoAtivo();
  const exercicio = ano ? await prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true } }) : null;
  const instrumentos = exercicio
    ? await prisma.instrumentoPlanejamento.findMany({
        where: { exercicioId: exercicio.id },
        orderBy: [{ especie: "asc" }, { createdAt: "asc" }],
        include: { instrumentoOrigem: true, derivados: { select: { numero: true } }, arquivo: { select: { id: true, nome: true } }, _count: { select: { dotacoes: true } } },
      })
    : [];

  const projetos = instrumentos.filter((i) => i.especie === "PROJETO_LEI").map((i) => ({ id: i.id, rotulo: `${i.tipo} · ${i.numero}`, tipo: i.tipo }));
  const emendamento = ano ? await lerEmendamento(ano) : null;

  return (
    <Pagina
      titulo="Planejamento"
      guia="planejamento"
      descricao="Instrumentos de planejamento do exercício, a base de dotações sobre a qual as emendas são classificadas e a comparação entre o projeto e a lei aprovada."
      acoes={
        podeGerir && exercicio ? (
          <NovoInstrumento
            exercicioId={exercicio.id}
            projetos={projetos}
          />
        ) : null
      }
    >
      <nav data-guia="planejamento.abas" aria-label="Seções" className="mb-5 flex flex-wrap gap-1 rounded-box bg-surface p-1.5 shadow-[0_1px_2px_rgba(10,36,99,.06)]">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/executivo/planejamento?aba=${a.id}`}
            aria-current={a.id === aba ? "page" : undefined}
            className={cn("rounded-md px-3.5 py-2 text-sm font-semibold", a.id === aba ? "bg-navy text-white" : "text-muted-foreground hover:bg-soft")}
          >
            {a.titulo}
          </Link>
        ))}
      </nav>

      {aba === "instrumentos" ? (
        <Cartao guia="planejamento.instrumentos" titulo={`Instrumentos do exercício ${ano ?? ""}`}>
          <IndicadorEmendamento s={emendamento} />
          <TabelaDados
            vazio="Nenhum instrumento cadastrado."
            colunas={[{ titulo: "Instrumento" }, { titulo: "Envio / aprovação" }, { titulo: "Dotações", className: "text-right" }, { titulo: "Situação" }, { titulo: "" }]}
            linhas={instrumentos.map((i) => ({
              chave: i.id,
              celulas: [
                <div key="i">
                  <Selo>{i.especie === "PROJETO_LEI" ? "Projeto de lei" : "Lei aprovada"}</Selo>{" "}
                  <b>
                    {i.tipo} · {i.numero}
                  </b>
                  <span className="block max-w-lg text-xs text-muted-foreground">{i.ementa}</span>
                  {i.instrumentoOrigem ? <span className="block text-xs text-muted-foreground">Lei originada do {i.instrumentoOrigem.numero}</span> : null}
                  {i.derivados.length ? <span className="block text-xs text-muted-foreground">Originou: {i.derivados.map((d) => d.numero).join(", ")}</span> : null}
                  {i.arquivo ? (
                    <a href={`/api/arquivos/${i.arquivo.id}`} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline">
                      <FileText className="size-3.5" aria-hidden /> {i.arquivo.nome}
                    </a>
                  ) : i.arquivoUrl ? (
                    <a href={i.arquivoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs font-semibold text-navy hover:underline">
                      Documento (link externo)
                    </a>
                  ) : (
                    <span className="mt-1 block text-xs text-warn">Sem arquivo da peça</span>
                  )}
                </div>,
                <span key="dt" className="text-xs whitespace-nowrap tnum">
                  {DATA(i.especie === "LEI_APROVADA" ? i.dataAprovacao : i.dataEnvio)}
                  {i.totalImpresso ? <span className="block text-muted-foreground">total impresso {BRL(i.totalImpresso.toNumber())}</span> : null}
                </span>,
                <span key="d" className="tnum">{i._count.dotacoes}</span>,
                <div key="s" data-guia="planejamento.situacao">
                  <StatusInstrumento id={i.id} status={i.status} podeGerir={podeGerir} rotulo={i.numero} />
                </div>,
                <div key="a" data-guia="planejamento.acoes-instrumento" className="flex items-center justify-end gap-1">
                  {i._count.dotacoes ? (
                    <Button size="xs" variant="ghost" asChild>
                      <Link href={`/executivo/planejamento?aba=base&instrumento=${i.id}`}>Ver base</Link>
                    </Button>
                  ) : null}
                  {podeGerir ? <ImportarBase instrumentoId={i.id} rotulo={i.numero} tipo={i.tipo} /> : null}
                  {podeGerir && exercicio ? (
                    <EditarInstrumento
                      exercicioId={exercicio.id}
                      projetos={projetos}
                      inicial={{
                        id: i.id,
                        especie: i.especie,
                        tipo: i.tipo,
                        numero: i.numero,
                        ementa: i.ementa,
                        instrumentoOrigemId: i.instrumentoOrigemId ?? "",
                        arquivo: i.arquivo,
                        data: (i.especie === "LEI_APROVADA" ? i.dataAprovacao : i.dataEnvio)?.toISOString().slice(0, 10) ?? "",
                        totalImpresso: i.totalImpresso ? formatarNumero(i.totalImpresso.toNumber(), 2) : "",
                      }}
                    />
                  ) : null}
                  {podeGerir && !i._count.dotacoes && !i.derivados.length ? <ExcluirInstrumento id={i.id} rotulo={`${i.tipo} · ${i.numero}`} /> : null}
                </div>,
              ],
            }))}
          />
        </Cartao>
      ) : null}

      {aba === "instrumentos" && exercicio ? await importacoesRecentes(exercicio.id) : null}
      {aba === "base" ? await base(instParam, instrumentos, exercicio?.configuracao?.orgaosForaDasEmendas ?? []) : null}
      {aba === "comparacao" ? await comparacao(instrumentos) : null}
    </Pagina>
  );
}

type Instrumentos = Awaited<ReturnType<typeof prisma.instrumentoPlanejamento.findMany>>;

async function base(instParam: string | undefined, instrumentos: Instrumentos, fora: string[]) {
  const inst = instrumentos.find((i) => i.id === instParam) ?? instrumentos.find((i) => i.especie === "PROJETO_LEI");
  if (!inst) return <Cartao><p className="text-sm text-muted-foreground">Nenhum projeto de lei cadastrado.</p></Cartao>;
  const dotacoes = await prisma.dotacao.findMany({
    where: { instrumentoId: inst.id, ativo: true },
    orderBy: { ordem: "asc" },
    include: { acao: true, programa: true, unidadeOrcamentaria: true, orgao: true, funcao: true, subfuncao: true, naturezaDespesa: true, fonteRecurso: true, _count: { select: { emendas: true } } },
  });
  const total = dotacoes.reduce((s, d) => s + d.valorAutorizado.toNumber(), 0);
  const emendaveis = dotacoes.filter((d) => NATUREZAS_EMENDAVEIS.has(`${d.naturezaDespesa.grupo}|${d.naturezaDespesa.modalidadeAplicacao}`) && !fora.includes(d.orgao.codigo));
  return (
    <div className="grid gap-5">
      <div data-guia="planejamento.base" className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Kpi rotulo={`Base · ${inst.numero}`} valor={BRL(total)} detalhe={`${dotacoes.length} dotações`} tom="navy" />
        <Kpi rotulo="Recebem emenda" valor={emendaveis.length} detalhe="custeio ou investimento, aplicação direta ou a entidade" />
        <Kpi rotulo="Com emendas" valor={dotacoes.filter((d) => d._count.emendas).length} />
      </div>
      <Cartao>
        <ListaDotacoes
          linhas={dotacoes.map((d) => ({
            id: d.id,
            codigo: d.codigo,
            ficha: d.ficha,
            acao: d.acao.nome,
            programa: `${d.programa.codigo} — ${d.programa.nome}`,
            unidade: `${d.unidadeOrcamentaria.codigo} — ${d.unidadeOrcamentaria.nome}`,
            funcional: `${d.funcao.codigo}.${d.subfuncao.codigo} ${d.subfuncao.nome}`,
            natureza: d.naturezaDespesa.codigo,
            fonte: d.fonteRecurso.codigo,
            valor: d.valorAutorizado.toNumber(),
            emendas: d._count.emendas,
            emendavel: emendaveis.includes(d),
          }))}
        />
      </Cartao>
    </div>
  );
}

// Para cada lei aprovada: total do PL de origem, total da lei (se a base da lei
// foi importada) e as emendas aprovadas sobre dotações do PL.
async function comparacao(instrumentos: Instrumentos) {
  const leis = instrumentos.filter((i) => i.especie === "LEI_APROVADA" && i.instrumentoOrigemId);
  if (!leis.length) return <Cartao><p className="text-sm text-muted-foreground">Nenhuma lei aprovada vinculada a projeto de lei.</p></Cartao>;
  const blocos = await Promise.all(
    leis.map(async (lei) => {
      const [somaPl, somaLei, emendas] = await Promise.all([
        prisma.dotacao.aggregate({ where: { instrumentoId: lei.instrumentoOrigemId!, ativo: true }, _sum: { valorAutorizado: true } }),
        prisma.dotacao.aggregate({ where: { instrumentoId: lei.id }, _sum: { valorAutorizado: true }, _count: true }),
        prisma.emenda.findMany({
          where: { status: "APROVADA", dotacao: { instrumentoId: lei.instrumentoOrigemId! } },
          include: { autor: true, dotacao: { include: { acao: true } } },
          orderBy: { numero: "asc" },
        }),
      ]);
      return { lei, pl: somaPl._sum.valorAutorizado?.toNumber() ?? 0, total: somaLei._sum.valorAutorizado?.toNumber() ?? null, linhasLei: somaLei._count, emendas };
    })
  );
  return (
    <div data-guia="planejamento.comparacao" className="grid gap-5">
      {blocos.map((b) => (
        <Cartao key={b.lei.id} titulo={`${b.lei.numero} · origem ${instrumentos.find((i) => i.id === b.lei.instrumentoOrigemId)?.numero ?? ""}`}>
          <div className="mb-4 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
            <Kpi rotulo="Total do projeto" valor={BRL(b.pl)} />
            <Kpi rotulo="Total da lei" valor={b.linhasLei ? BRL(b.total ?? 0) : "base não importada"} detalhe={b.linhasLei ? `${b.linhasLei} dotações` : "importe a base da lei para comparar"} />
            <Kpi rotulo="Emendas aprovadas" valor={BRL(b.emendas.reduce((s, e) => s + e.valor.toNumber(), 0))} detalhe={`${b.emendas.length} emenda(s)`} tom="ok" />
          </div>
          <TabelaDados
            vazio="Nenhuma emenda aprovada sobre este projeto."
            colunas={[{ titulo: "Nº" }, { titulo: "Autor" }, { titulo: "Dotação" }, { titulo: "Valor", className: "text-right" }]}
            linhas={b.emendas.map((e) => ({
              chave: e.id,
              celulas: [
                <b key="n" className="tnum">{e.numero}</b>,
                e.autor.nome,
                e.dotacao ? `${e.dotacao.codigo} — ${e.dotacao.acao.nome}` : "—",
                <b key="v" className="whitespace-nowrap tnum">{BRL(e.valor.toNumber())}</b>,
              ],
            }))}
          />
        </Cartao>
      ))}
    </div>
  );
}

async function importacoesRecentes(exercicioId: string) {
  const lista = await prisma.importacao.findMany({
    where: { instrumento: { exercicioId } },
    orderBy: { criadoEm: "desc" },
    take: 10,
    include: { instrumento: { select: { tipo: true, numero: true } }, arquivo: { select: { nome: true } }, _count: { select: { linhas: true } } },
  });
  if (!lista.length) return null;
  const situacao: Record<string, string> = { MAPEAR: "colunas a ligar", LENDO: "lendo", LIDA: "em conferência", GRAVADA: "gravada", CANCELADA: "cancelada", ERRO: "parada por erro" };
  return (
    <Cartao guia="planejamento.importacoes" titulo="Importações recentes" className="mt-5">
      <TabelaDados
        vazio="—"
        colunas={[{ titulo: "Quando" }, { titulo: "Instrumento" }, { titulo: "Arquivo" }, { titulo: "Linhas", className: "text-right" }, { titulo: "Situação" }, { titulo: "" }]}
        linhas={lista.map((i) => ({
          chave: i.id,
          celulas: [
            <span key="q" className="text-xs whitespace-nowrap tnum">{DATA_HORA(i.criadoEm)}</span>,
            `${i.instrumento.tipo} · ${i.instrumento.numero}`,
            <span key="a" className="text-xs">{i.arquivo.nome}</span>,
            <span key="l" className="tnum">{i._count.linhas}</span>,
            <Selo key="s" tipo={i.situacao === "GRAVADA" ? "ok" : i.situacao === "ERRO" ? "bad" : i.situacao === "CANCELADA" ? "neutro" : "info"}>{situacao[i.situacao]}</Selo>,
            <Button key="v" size="xs" variant="ghost" asChild>
              <Link href={`/executivo/planejamento/importacao/${i.id}`}>Abrir</Link>
            </Button>,
          ],
        }))}
      />
    </Cartao>
  );
}
