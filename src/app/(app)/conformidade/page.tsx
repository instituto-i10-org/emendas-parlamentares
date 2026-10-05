import type { Metadata } from "next";
import { Cartao, Kpi, Pagina } from "@/components/app/pagina";
import { MarcaChecagem } from "@/components/emenda/ui";
import { Ajuda } from "@/components/ui/ajuda";
import { consolidar, listarEmendas, situacaoCota } from "@/lib/emendas/consultas";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { PCT, referenciaAntiga } from "@/lib/riep";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Conformidade — Emendas360" };

type Item = { nivel: "ok" | "warn" | "bad"; titulo: string; detalhe: string; fundamento: string };

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
    ano ? listarEmendas(ano, { status: { not: "RASCUNHO" } }) : [],
  ]);
  const cfg = exercicio?.configuracao;
  const itens: Item[] = [];
  const add = (i: Item) => itens.push(i);

  const lom = normas.some((n) => n.tipo === "LOM");
  add({
    nivel: lom ? "ok" : "bad",
    titulo: "Lei Orgânica prevê o regime impositivo",
    detalhe: lom ? "Dispositivo da LOM cadastrado na base legal." : "Cadastre o artigo da LOM que institui as emendas impositivas.",
    fundamento: "CF art. 166 §§ 9º a 20 (simetria); LOM",
  });
  const leis = normas.filter((n) => n.tipo === "LEI").length;
  add({
    nivel: leis >= 2 ? "ok" : "warn",
    titulo: "LOA e LDO do exercício na base legal",
    detalhe: leis >= 2 ? `${leis} leis cadastradas.` : "Cadastre a LOA e a LDO do exercício com os artigos sobre as emendas.",
    fundamento: "LDO e LOA do exercício",
  });
  const faltam = [
    cfg?.cotaIndividual == null && "cota individual",
    !cfg?.fonteAudesp && "fonte AUDESP",
    !cfg?.codigoAplicacao && "código de aplicação",
    !cfg?.numeroVereadores && "número de vereadores",
  ].filter(Boolean);
  add({
    nivel: faltam.length ? "bad" : "ok",
    titulo: "Limites e identificadores parametrizados",
    detalhe: faltam.length
      ? `Falta parametrizar: ${faltam.join(", ")}. O sistema não presume valores.`
      : `Cota ${cfg!.cotaIndividual!.toNumber().toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, saúde mínima de ${cfg!.percentualSaude.toNumber()}% (aferição ${cfg!.afericaoSaude === "GLOBAL" ? "global" : "individual"}), fonte AUDESP ${cfg!.fonteAudesp} e aplicação ${cfg!.codigoAplicacao}.`,
    fundamento: "Comunicados Audesp 55/2025 e 09/2026; LOM",
  });

  const n = emendas.length;
  const comDestino = emendas.filter((e) => e.destinoId).length;
  add({
    nivel: !n ? "warn" : comDestino === n ? "ok" : comDestino / n >= 0.8 ? "warn" : "bad",
    titulo: "Rastreabilidade do destino",
    detalhe: n ? `${comDestino} de ${n} emendas com destino identificado (${pct(comDestino, n)}).` : "Nenhuma emenda submetida no sistema.",
    fundamento: "ADPF 854; Resolução TCE-SP 17/2025",
  });
  const comDotacao = emendas.filter((e) => e.dotacaoId).length;
  add({
    nivel: !n ? "warn" : comDotacao === n ? "ok" : "warn",
    titulo: "Classificação orçamentária definida",
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
      detalhe: problemas.length
        ? `${problemas.length} vereador(es) com cota excedida ou reserva invadida: ${problemas.map((a) => `${a.nome} (${situacaoCota(a, c).rotulo})`).join("; ")}.`
        : "Todos os vereadores dentro da cota e da reserva mínima em saúde.",
      fundamento: "LOM art. 140 §§ 6º e 8º; LDO",
    });
  }

  const itensEmendas = await prisma.itemEmenda.findMany({
    where: { emenda: { exercicio: { ano: ano ?? -1 }, status: { not: "RASCUNHO" } } },
    include: { referencia: true },
  });
  const semRef = itensEmendas.filter((i) => !i.referenciaId).length;
  const antigas = itensEmendas.filter(
    (i) => i.referencia?.data && referenciaAntiga(i.referencia.data.toISOString().slice(0, 10), cfg?.validadeReferenciaMeses ?? 12)
  ).length;
  add({
    nivel: !itensEmendas.length ? "warn" : semRef ? "bad" : antigas ? "warn" : "ok",
    titulo: "Origem dos preços demonstrada",
    detalhe: itensEmendas.length
      ? `${itensEmendas.length - semRef} de ${itensEmendas.length} itens com a fonte do preço informada${antigas ? `; ${antigas} com consulta mais antiga que ${cfg?.validadeReferenciaMeses ?? 12} meses` : ""}.`
      : "Nenhum item de memória de cálculo em emenda submetida.",
    fundamento: "Lei 14.133/2021 art. 23; Comunicado SDG 28/2025",
  });

  const comParecer = emendas.filter((e) => e.pareceres.length).length;
  add({
    nivel: !n ? "warn" : comParecer === n ? "ok" : "warn",
    titulo: "Manifestação de viabilidade técnica",
    detalhe: n ? `${comParecer} de ${n} emendas com parecer do Executivo.` : "Nenhuma emenda submetida no sistema.",
    fundamento: "CF art. 166 § 13; LDO (impedimento técnico)",
  });

  const aprovadas = emendas.filter((e) => e.status === "APROVADA");
  const comExecucao = aprovadas.filter((e) => e.andamentos.length).length;
  add({
    nivel: !aprovadas.length ? "warn" : comExecucao === aprovadas.length ? "ok" : "warn",
    titulo: "Execução registrada",
    detalhe: aprovadas.length ? `${comExecucao} de ${aprovadas.length} emendas aprovadas com execução lançada.` : "Nenhuma emenda aprovada no sistema.",
    fundamento: "Lei 4.320/1964 arts. 58 a 65; Comunicado Audesp 55/2025",
  });

  add({
    nivel: "ok",
    titulo: "Transparência ativa",
    detalhe: "Portal público com busca por objeto, destino e vereador, sem login; rascunhos nunca são publicados.",
    fundamento: "ADPF 854; CF art. 163-A",
  });

  const hoje = new Date();
  const proximos = (exercicio?.prazos ?? []).filter((p) => p.data >= new Date(hoje.getTime() - 86_400_000)).slice(0, 4);

  return (
    <Pagina titulo="Conformidade" descricao="Espelho da fiscalização das emendas impositivas. Cada item é conferido nos dados do sistema.">
      <div className="mb-5 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Kpi rotulo="Conformes" valor={itens.filter((i) => i.nivel === "ok").length} tom="ok" />
        <Kpi rotulo="Em atenção" valor={itens.filter((i) => i.nivel === "warn").length} tom="warn" />
        <Kpi rotulo="Impropriedades" valor={itens.filter((i) => i.nivel === "bad").length} tom="bad" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5 max-[1000px]:grid-cols-1">
        <Cartao>
          <ul className="divide-y divide-hair">
            {itens.map((i) => (
              <li key={i.titulo} className="flex gap-3 py-3">
                <MarcaChecagem nivel={i.nivel} />
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    {i.titulo}
                    <Ajuda titulo="Fundamento">{i.fundamento}</Ajuda>
                  </div>
                  <div className="text-sm text-muted-foreground">{i.detalhe}</div>
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
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
