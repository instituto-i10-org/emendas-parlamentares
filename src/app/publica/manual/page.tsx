import type { Metadata } from "next";
import { BotaoImprimir } from "@/components/app/botao-imprimir";
import { Cartao } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { lerRegras } from "@/lib/emendas/contexto";
import { getAnoAtivo } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { BRL, DATA } from "@/lib/riep";
import { VERIFICACOES, regraDe } from "@/lib/riep/verificacoes";

export const metadata: Metadata = { title: "Manual das emendas impositivas" };

const ND = <span className="text-muted-foreground">não definido</span>;
const STATUS_INSTRUMENTO: Record<string, string> = {
  EM_ELABORACAO: "em elaboração",
  ENVIADO: "enviado",
  EM_TRAMITACAO: "em tramitação",
  APROVADO: "aprovado",
  SANCIONADO: "sancionado",
  VIGENTE: "vigente",
  ENCERRADO: "encerrado",
};

// Manual orientativo público. Todo número, prazo e regra vem do que o sistema
// aplica (Configurações); o que não foi definido aparece assim, nunca presumido.
export default async function ManualPage() {
  const ano = await getAnoAtivo();
  const [ex, municipio, normas] = await Promise.all([
    ano ? prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true, prazos: { orderBy: { data: "asc" } } } }) : null,
    prisma.municipio.findFirst({ include: { manualAto: true, manualPublicadoPor: { select: { name: true, email: true } } } }),
    prisma.documentoNormativo.findMany({ where: { ativo: true }, orderBy: [{ tipo: "asc" }, { titulo: "asc" }], include: { arquivo: { select: { id: true } } } }),
  ]);
  const c = ex?.configuracao;
  const regras = ex ? await lerRegras(ex.id) : {};
  const regrasDb = ex ? await prisma.regraValidacao.findMany({ where: { OR: [{ exercicioId: ex.id }, { exercicioId: null }] }, select: { codigo: true, normaId: true } }) : [];
  const normaDa = (codigo: string) => regrasDb.find((r) => r.codigo === codigo)?.normaId ?? null;
  const fund = (c?.fundamentos ?? {}) as Record<string, { texto?: string; normaId?: string | null }>;
  const comFundamento = (chave: string) =>
    fund[chave]?.texto ? (
      <span className="block text-xs text-muted-foreground">
        Fundamento: {fund[chave].normaId ? <a href={`#norma-${fund[chave].normaId}`} className="font-semibold text-navy hover:underline">{fund[chave].texto}</a> : fund[chave].texto}
      </span>
    ) : null;
  const num = (v: { toNumber(): number } | null | undefined) => (v == null ? null : v.toNumber());
  const cota = num(c?.cotaIndividual);
  const pctSaude = num(c?.percentualSaude);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Manual das emendas impositivas</h1>
        <BotaoImprimir variante="ghost" />
      </div>
      <Cartao titulo="Situação deste manual">
        <ul className="grid gap-1.5 text-sm">
          <li>
            <b>Instituído:</b>{" "}
            {municipio?.manualAto ? (
              <a href={`#norma-${municipio.manualAto.id}`} className="font-semibold text-navy hover:underline">
                {municipio.manualAto.titulo}
                {municipio.manualAto.numero ? ` nº ${municipio.manualAto.numero}` : ""}
                {municipio.manualAto.dataAto ? `, de ${DATA(municipio.manualAto.dataAto)}` : ""}
              </a>
            ) : (
              <Selo tipo="warn">ainda não instituído por ato</Selo>
            )}
          </li>
          <li>
            <b>Publicado:</b>{" "}
            {municipio?.manualPublicadoEm ? (
              `em ${DATA(municipio.manualPublicadoEm)}, por ${municipio.manualPublicadoPor?.name ?? municipio.manualPublicadoPor?.email ?? "—"}`
            ) : (
              <Selo tipo="warn">não publicado</Selo>
            )}
          </li>
          <li className="text-xs text-muted-foreground">Os valores, prazos e regras abaixo são os que o sistema aplica hoje, lidos da configuração do exercício {ano ?? ""}.</li>
        </ul>
      </Cartao>

      <Cartao titulo="1. O que são">
        <p className="text-sm leading-relaxed">
          São indicações dos vereadores ao projeto de lei orçamentária que a Prefeitura é obrigada a executar, até o limite fixado na Lei Orgânica.
          Cada vereador indica o que será feito e onde; a Prefeitura executa, salvo impedimento de ordem técnica, que precisa ser justificado.
        </p>
      </Cartao>

      <Cartao titulo={`2. Limites do exercício ${ano ?? ""}`}>
        <ul className="grid gap-2.5 text-sm">
          <li>
            <b>Cota individual:</b> {cota !== null ? BRL(cota) : ND}
            {comFundamento("cotaIndividual")}
          </li>
          <li>
            <b>Número de vereadores:</b> {c?.numeroVereadores ?? ND}
          </li>
          <li>
            <b>Base de cálculo:</b>{" "}
            {num(c?.percentualRcl) !== null && num(c?.rclBase) !== null ? `${num(c?.percentualRcl)!.toLocaleString("pt-BR")}% da receita corrente líquida de ${c?.rclAnoBase ?? ""} (${BRL(num(c?.rclBase)!)})` : ND}
          </li>
          <li>
            <b>Parcela mínima da saúde:</b> {pctSaude !== null ? `${pctSaude.toLocaleString("pt-BR")}%` : ND}
            {c ? `, conferida ${c.afericaoSaude === "INDIVIDUAL" ? "em cada emenda" : "no conjunto das emendas de cada vereador"}` : ""}
            {comFundamento("percentualSaude")}
          </li>
          {c?.memoriaCota ? <li className="text-xs text-muted-foreground">{c.memoriaCota}</li> : null}
        </ul>
      </Cartao>

      <Cartao titulo="3. Prazos">
        <ul className="grid gap-2.5 text-sm">
          <li>
            <b>Fim do protocolo de emendas:</b> {c?.prazoProtocolo ? DATA(c.prazoProtocolo) : ND}
            {comFundamento("prazoProtocolo")}
          </li>
          <li>
            <b>O projeto de lei recebe emendas quando está:</b>{" "}
            {c?.situacoesEmendamento?.length ? c.situacoesEmendamento.map((s) => STATUS_INSTRUMENTO[s] ?? s).join(", ") : ND}
          </li>
          <li>
            <b>Prazo para atender à diligência da Comissão:</b> {c?.prazoDiligenciaDias ? `${c.prazoDiligenciaDias} dia(s)` : ND}
            {comFundamento("prazoDiligenciaDias")}
          </li>
          <li>
            <b>Validade do link para a entidade preencher o plano:</b> {c?.validadeLinkEntidadeDias ? `${c.validadeLinkEntidadeDias} dia(s)` : ND}
            {comFundamento("validadeLinkEntidadeDias")}
          </li>
          {ex?.prazos.map((p) => (
            <li key={p.id}>
              <b className="tnum">{p.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</b> — {p.descricao}
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao titulo="4. Da indicação à execução">
        <ol className="grid gap-2 text-sm">
          <li>
            <b>Indicação.</b> O vereador descreve o objeto e o destino; o sistema encontra a dotação na lei orçamentária e monta o plano de trabalho.
          </li>
          <li>
            <b>Conferência.</b> Antes de seguir, a emenda passa pelas treze verificações abaixo e pela pré-checagem de cota, reserva da saúde, preços e
            documentação. Só a emenda sem falha é remetida à Câmara.
          </li>
          <li>
            <b>Decisão.</b> A Comissão de Finanças e Orçamento recebe, pode pedir ajuste (diligência) e aprova ou rejeita, com parecer. O Executivo se
            manifesta sobre a viabilidade técnica.
          </li>
          <li>
            <b>Execução e prestação de contas.</b> Empenho, liquidação e pagamento ficam registrados e visíveis neste portal.
          </li>
        </ol>
      </Cartao>

      <Cartao titulo="5. As treze verificações">
        <ol className="grid gap-2.5 text-sm">
          {VERIFICACOES.map((v) => {
            const r = regraDe(v, regras);
            const n = normaDa(v.codigo);
            return (
              <li key={v.codigo} data-codigo={v.codigo}>
                <b>
                  ({v.numero}) {v.titulo}
                </b>{" "}
                — {!r.ativa ? "desligada (não prevista na Lei Orgânica)" : r.modo === "FIXO" ? "sempre impede a remessa" : r.modo === "BLOQUEANTE" ? "impede a remessa" : "só alerta"}
                <span className="block text-xs text-muted-foreground">
                  Fundamento: {n ? <a href={`#norma-${n}`} className="font-semibold text-navy hover:underline">{r.fundamento}</a> : r.fundamento}
                </span>
              </li>
            );
          })}
        </ol>
      </Cartao>

      <Cartao titulo="6. Base legal">
        {normas.length ? (
          <ul className="grid gap-3 text-sm">
            {normas.map((n) => (
              <li key={n.id} id={`norma-${n.id}`} className="scroll-mt-4">
                <b>
                  {n.titulo}
                  {n.numero ? ` nº ${n.numero}` : ""}
                </b>
                {n.artigo ? ` — ${n.artigo}` : ""}
                <span className="block text-xs text-muted-foreground">
                  {n.dataVigencia ? `vigente desde ${DATA(n.dataVigencia)}` : "vigência não informada"}
                  {n.vigenciaFim ? ` até ${DATA(n.vigenciaFim)}` : ""}
                  {n.arquivo ? (
                    <>
                      {" · "}
                      <a href={`/api/arquivos/${n.arquivo.id}`} className="font-bold text-navy hover:underline">
                        arquivo
                      </a>
                    </>
                  ) : null}
                  {n.url ? (
                    <>
                      {" · "}
                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="font-bold text-navy hover:underline">
                        fonte
                      </a>
                    </>
                  ) : null}
                </span>
                {n.trecho ? <p className="mt-1 text-xs text-muted-foreground">“{n.trecho}”</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma norma cadastrada.</p>
        )}
      </Cartao>
    </div>
  );
}
