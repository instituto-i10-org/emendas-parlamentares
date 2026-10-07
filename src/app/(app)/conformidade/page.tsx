import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, Kpi, Pagina } from "@/components/app/pagina";
import { conferirConformidade } from "@/lib/conformidade";
import { lerRegras } from "@/lib/emendas/contexto";
import { consultarPortal } from "@/lib/portal";
import { MarcaChecagem } from "@/components/emenda/ui";
import { Ajuda } from "@/components/ui/ajuda";
import { consolidar, listarEmendas, situacaoCota } from "@/lib/emendas/consultas";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { PCT, referenciaAntiga } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";
import { NAO_REMETIDAS } from "@/lib/emendas/situacoes";

export const metadata: Metadata = { title: "Conformidade — Emendas360" };

type Item = { nivel: "ok" | "warn" | "bad"; titulo: string; detalhe: string; fundamento: string; providencia?: string; link?: string };

const pct = (parte: number, todo: number) => (todo ? PCT((parte / todo) * 100) : "—");

// Espelho da fiscalização das emendas impositivas (TCE-SP): cada item é
// conferido nos dados, não declarado.
export default async function ConformidadePage() {
  await getCurrentUser();
  const ano = await getAnoAtivo();
  const [exercicio, normas, c, emendas] = await Promise.all([
    ano ? prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true, prazos: { orderBy: { data: "asc" } } } }) : null,
    prisma.documentoNormativo.findMany({ where: { ativo: true } }),
    ano ? consolidar(ano) : null,
    ano ? listarEmendas(ano, { status: { notIn: NAO_REMETIDAS } }) : [],
  ]);
  const cfg = exercicio?.configuracao;
  const itens: Item[] = [];
  const add = (i: Item) => itens.push(i);

  const leis = normas.filter((x) => x.tipo === "LEI").length;
  add({
    nivel: leis >= 2 ? "ok" : "warn",
    titulo: "LOA e LDO do exercício na base legal",
    providencia: "Cadastre a LOA e a LDO do exercício com os artigos sobre as emendas.",
    link: "/config?aba=normas",
    detalhe: leis >= 2 ? `${leis} leis cadastradas.` : "Menos de duas leis cadastradas na base legal.",
    fundamento: "LDO e LOA do exercício",
  });
  const faltamAudesp = [!cfg?.fonteAudesp && "fonte AUDESP", !cfg?.codigoAplicacao && "código de aplicação"].filter(Boolean);
  add({
    nivel: faltamAudesp.length ? "bad" : "ok",
    titulo: "Identificadores AUDESP parametrizados",
    providencia: "Informe a fonte e o código de aplicação AUDESP do exercício.",
    link: "/config?aba=exercicio",
    detalhe: faltamAudesp.length ? `Falta parametrizar: ${faltamAudesp.join(", ")}. O sistema não presume valores.` : `Fonte AUDESP ${cfg!.fonteAudesp} e aplicação ${cfg!.codigoAplicacao}.`,
    fundamento: "Comunicados Audesp 55/2025 e 09/2026",
  });

  const n = emendas.length;
  const comDestino = emendas.filter((e) => e.destinoId).length;
  add({
    nivel: !n ? "warn" : comDestino === n ? "ok" : comDestino / n >= 0.8 ? "warn" : "bad",
    titulo: "Rastreabilidade do destino",
    providencia: "Complete o beneficiário das emendas sem destino.",
    link: "/tramitacao",
    detalhe: n ? `${comDestino} de ${n} emendas com destino identificado (${pct(comDestino, n)}).` : "Nenhuma emenda submetida no sistema.",
    fundamento: "ADPF 854; Resolução TCE-SP 17/2025",
  });
  const comDotacao = emendas.filter((e) => e.dotacaoId).length;
  add({
    nivel: !n ? "warn" : comDotacao === n ? "ok" : "warn",
    titulo: "Classificação orçamentária definida",
    providencia: "Defina a dotação das emendas pendentes.",
    link: "/tramitacao?aba=saneamento",
    detalhe: n
      ? `${comDotacao} de ${n} com dotação definida; ${n - comDotacao} aguardando a análise técnica.`
      : "Nenhuma emenda submetida no sistema.",
    fundamento: "Lei 4.320/1964; Portaria STN 710/2021 (IC-CO)",
  });

  if (c && c.cotaIndividual !== null) {
    const problemas = c.porAutor.filter((a) => situacaoCota(a, c).tom === "bad");
    add({
      nivel: problemas.length ? "bad" : "ok",
      titulo: "Cota individual e reserva da saúde",
      providencia: "Revise as emendas dos vereadores apontados.",
      link: "/painel",
      detalhe: problemas.length
        ? `${problemas.length} vereador(es) com cota excedida ou reserva invadida: ${problemas.map((a) => `${a.nome} (${situacaoCota(a, c).rotulo})`).join("; ")}.`
        : "Todos os vereadores dentro da cota e da reserva mínima em saúde.",
      fundamento: "LOM art. 140 §§ 6º e 8º; LDO",
    });
  }

  const itensEmendas = await prisma.itemEmenda.findMany({
    where: { emenda: { exercicio: { ano: ano ?? -1 }, status: { notIn: NAO_REMETIDAS } } },
    include: { referencia: true },
  });
  const semRef = itensEmendas.filter((i) => !i.referenciaId).length;
  const antigas = itensEmendas.filter(
    (i) => i.referencia?.data && referenciaAntiga(i.referencia.data.toISOString().slice(0, 10), cfg?.validadeReferenciaMeses ?? 12)
  ).length;
  add({
    nivel: !itensEmendas.length ? "warn" : semRef ? "bad" : antigas ? "warn" : "ok",
    titulo: "Origem dos preços demonstrada",
    providencia: "Informe a fonte do preço nos itens sem fonte.",
    link: "/emendas",
    detalhe: itensEmendas.length
      ? `${itensEmendas.length - semRef} de ${itensEmendas.length} itens com a fonte do preço informada${antigas ? `; ${antigas} com consulta mais antiga que ${cfg?.validadeReferenciaMeses ?? 12} meses` : ""}.`
      : "Nenhum item de memória de cálculo em emenda submetida.",
    fundamento: "Lei 14.133/2021 art. 23; Comunicado SDG 28/2025",
  });

  const comParecer = emendas.filter((e) => e.pareceres.length).length;
  add({
    nivel: !n ? "warn" : comParecer === n ? "ok" : "warn",
    titulo: "Manifestação de viabilidade técnica",
    providencia: "O Executivo registra o parecer de viabilidade.",
    link: "/executivo/viabilidade",
    detalhe: n ? `${comParecer} de ${n} emendas com parecer do Executivo.` : "Nenhuma emenda submetida no sistema.",
    fundamento: "CF art. 166 § 13; LDO (impedimento técnico)",
  });

  const aprovadas = emendas.filter((e) => e.status === "APROVADA");
  const comExecucao = aprovadas.filter((e) => e.andamentos.length).length;
  add({
    nivel: !aprovadas.length ? "warn" : comExecucao === aprovadas.length ? "ok" : "warn",
    titulo: "Execução registrada",
    providencia: "O Executivo lança a execução das emendas aprovadas.",
    link: "/executivo/execucao",
    detalhe: aprovadas.length ? `${comExecucao} de ${aprovadas.length} emendas aprovadas com execução lançada.` : "Nenhuma emenda aprovada no sistema.",
    fundamento: "Lei 4.320/1964 arts. 58 a 65; Comunicado Audesp 55/2025",
  });

  const hoje = new Date();
  const [municipio, regras, semAutor, semValidacao, consulta] = await Promise.all([
    prisma.municipio.findFirst({ select: { manualAtoId: true, manualPublicadoEm: true } }),
    exercicio ? lerRegras(exercicio.id) : Promise.resolve({} as Awaited<ReturnType<typeof lerRegras>>),
    prisma.emenda.count({ where: { exercicio: { ano: ano ?? -1 }, status: { notIn: NAO_REMETIDAS }, autor: { nome: "" } } }),
    prisma.emenda.count({ where: { exercicio: { ano: ano ?? -1 }, status: { notIn: NAO_REMETIDAS }, validacoes: { none: {} } } }),
    conferirPortal(ano),
  ]);
  const todas = conferirConformidade({
    hoje,
    normas: normas.map((x) => ({ tipo: x.tipo, ativo: x.ativo, dataVigencia: x.dataVigencia, vigenciaFim: x.vigenciaFim, titulo: x.titulo })),
    manual: { atoInstituidor: !!municipio?.manualAtoId, publicadoEm: municipio?.manualPublicadoEm ?? null },
    portal: consulta,
    emendasRemetidas: n,
    semAutor,
    semValidacao,
    parametros: { cota: cfg?.cotaIndividual?.toNumber() ?? null, percentualSaude: cfg?.percentualSaude?.toNumber() ?? null, vereadores: cfg?.numeroVereadores ?? null },
    regraCota: { ativa: regras.COTA_AUTOR?.ativa ?? true, modo: regras.COTA_AUTOR?.modo ?? "BLOQUEANTE" },
    regraLimite: { ativa: regras.LIMITE_DEMAIS_AREAS?.ativa ?? true, modo: regras.LIMITE_DEMAIS_AREAS?.modo ?? "BLOQUEANTE" },
    extras: itens.map((x) => ({ id: x.titulo, nivel: x.nivel, titulo: x.titulo, detalhe: x.detalhe, fundamento: x.fundamento, providencia: x.nivel === "ok" ? null : x.providencia ?? null, link: x.nivel === "ok" ? null : x.link ?? null, principal: false })),
  });
  const proximos = (exercicio?.prazos ?? []).filter((p) => p.data >= new Date(hoje.getTime() - 86_400_000)).slice(0, 4);

  return (
    <Pagina titulo="Conformidade" descricao="Espelho da fiscalização das emendas impositivas. Cada item é conferido nos dados do sistema.">
      <div className="mb-5 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Kpi rotulo="Conformes" valor={todas.filter((i) => i.nivel === "ok").length} tom="ok" />
        <Kpi rotulo="Em atenção" valor={todas.filter((i) => i.nivel === "warn").length} tom="warn" />
        <Kpi rotulo="Pendentes" valor={todas.filter((i) => i.nivel === "bad").length} tom="bad" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5 max-[1000px]:grid-cols-1">
        <div className="grid gap-5">
          {[
            ["Requisitos do edital", todas.filter((i) => i.principal)],
            ["Outros itens da fiscalização", todas.filter((i) => !i.principal)],
          ].map(([titulo, lista]) => (
            <Cartao key={titulo as string} titulo={titulo as string}>
              <ul className="divide-y divide-hair">
                {(lista as typeof todas).map((i) => (
                  <li key={i.id} className="flex gap-3 py-3" data-item={i.id}>
                    <MarcaChecagem nivel={i.nivel} />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        {i.titulo}
                        <Ajuda titulo="Fundamento">{i.fundamento}</Ajuda>
                      </div>
                      <div className="text-sm text-muted-foreground">{i.detalhe}</div>
                      {i.providencia ? (
                        <p className="mt-1 text-sm">
                          <b>Providência:</b> {i.providencia}{" "}
                          {i.link ? (
                            <Link href={i.link} className="font-bold text-navy hover:underline">
                              Resolver
                            </Link>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Cartao>
          ))}
        </div>
        <Cartao titulo="Próximos prazos">
          {proximos.length ? (
            <ul className="grid gap-3 text-sm">
              {proximos.map((p) => (
                <li key={p.id}>
                  <b className="tnum">{p.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</b>
                  <p className="text-xs text-muted-foreground">{p.descricao}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum prazo futuro cadastrado para o exercício.</p>
          )}
        </Cartao>
      </div>
    </Pagina>
  );
}

// Consulta real ao portal: busca com filtro de situação; confere que a resposta
// só traz o que foi pedido.
async function conferirPortal(ano: number | null): Promise<{ ok: boolean; detalhe: string } | null> {
  const todas = await consultarPortal(ano, {});
  if (!todas) return null;
  const amostra = todas.find((l) => l.objeto.trim().split(/\s+/).length > 1);
  if (!amostra) return { ok: true, detalhe: "Portal no ar, com busca e filtros; ainda sem emendas apresentadas para conferir a resposta." };
  const palavra = amostra.objeto.trim().split(/\s+/).find((p) => p.length > 4) ?? amostra.objeto.trim().split(/\s+/)[0];
  const r = await consultarPortal(ano, { q: palavra, situacao: amostra.situacao });
  const ok = !!r && r.length > 0 && r.every((l) => l.situacao === amostra.situacao);
  return { ok, detalhe: ok ? `Consulta de teste: busca por “${palavra}” com a situação filtrada devolveu ${r!.length} emenda(s), todas na situação pedida.` : "A consulta de teste ao portal não devolveu o esperado." };
}
