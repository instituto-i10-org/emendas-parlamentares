import type { Metadata } from "next";
import { BotaoImprimir } from "@/components/app/botao-imprimir";
import { Cartao } from "@/components/app/pagina";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL } from "@/lib/riep";

export const metadata: Metadata = { title: "Como funcionam as emendas impositivas" };

// Manual público: o que são as emendas impositivas, os limites do exercício
// (vindos da configuração, nunca fixos no texto), os prazos e a base legal.
export default async function ManualPage() {
  const ano = await getAnoAtivo();
  const ex = ano
    ? await prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true, prazos: { orderBy: { data: "asc" } } } })
    : null;
  const normas = await prisma.documentoNormativo.findMany({ where: { ativo: true }, orderBy: [{ tipo: "asc" }, { titulo: "asc" }] });
  const c = ex?.configuracao;
  const cota = c?.cotaIndividual?.toNumber();
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Como funcionam as emendas impositivas</h1>
        <BotaoImprimir variante="ghost" />
      </div>
      <Cartao titulo="1. O que são">
        <p className="text-sm leading-relaxed">
          São indicações dos vereadores ao orçamento do município que a Prefeitura é obrigada a executar, até o limite fixado na Lei Orgânica. Cada
          vereador indica o que será feito e onde; a Prefeitura executa, salvo impedimento de ordem técnica, que precisa ser justificado.
        </p>
      </Cartao>
      <Cartao titulo={`2. Os limites do exercício ${ano ?? ""}`}>
        <ul className="grid gap-2 text-sm">
          <li>
            <b>Cota individual:</b> {cota !== undefined ? BRL(cota) : "não parametrizada"}
            {c?.numeroVereadores ? ` para cada um dos ${c.numeroVereadores} vereadores` : ""}.
          </li>
          {c?.percentualRcl && c?.rclBase ? (
            <li>
              <b>Base:</b> {c.percentualRcl.toNumber().toLocaleString("pt-BR")}% da receita corrente líquida de {c.rclAnoBase ?? "referência"} (
              {BRL(c.rclBase.toNumber())}).
            </li>
          ) : null}
          <li>
            <b>Saúde:</b> no mínimo {c?.percentualSaude.toNumber().toLocaleString("pt-BR") ?? 50}% do valor vai para ações e serviços públicos de saúde,
            aferido {c?.afericaoSaude === "INDIVIDUAL" ? "em cada emenda" : "no conjunto das emendas de cada vereador"}.
          </li>
          {c?.memoriaCota ? <li className="text-xs text-muted-foreground">{c.memoriaCota}</li> : null}
        </ul>
      </Cartao>
      <Cartao titulo="3. Da indicação à execução">
        <ol className="grid gap-2 text-sm">
          <li>
            <b>Indicação.</b> O vereador descreve o objeto e o destino; o sistema encontra a dotação na lei orçamentária e monta o plano de trabalho.
          </li>
          <li>
            <b>Conferência.</b> Antes de seguir, a emenda passa pela pré-checagem de cota, reserva da saúde, preços e documentação.
          </li>
          <li>
            <b>Decisão.</b> A Comissão de Finanças e Orçamento aprova ou rejeita, com parecer. O Executivo se manifesta sobre a viabilidade técnica.
          </li>
          <li>
            <b>Execução e prestação de contas.</b> Empenho, liquidação e pagamento ficam registrados e visíveis neste portal.
          </li>
        </ol>
      </Cartao>
      {ex?.prazos.length ? (
        <Cartao titulo="4. Prazos">
          <ul className="grid gap-2 text-sm">
            {ex.prazos.map((p) => (
              <li key={p.id}>
                <b className="tnum">{p.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</b> — {p.descricao}
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
      {normas.length ? (
        <Cartao titulo="5. Base legal">
          <ul className="grid gap-3 text-sm">
            {normas.map((n) => (
              <li key={n.id}>
                <b>{n.titulo}</b>
                {n.artigo ? ` — ${n.artigo}` : ""}
                {n.url ? (
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs font-bold text-navy hover:underline">
                    fonte
                  </a>
                ) : null}
                {n.trecho ? <p className="mt-1 text-xs text-muted-foreground">“{n.trecho}”</p> : null}
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
    </div>
  );
}
