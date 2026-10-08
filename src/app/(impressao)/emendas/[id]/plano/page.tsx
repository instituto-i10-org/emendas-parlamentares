import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { podeGerirEmenda, podeVerTodasEmendas, temPermissao } from "@/lib/authz";
import { buscarEmenda } from "@/lib/emendas/carregar";
import { informadaGravada, textoInformada } from "@/lib/emendas/dotacao-informada";
import { BRL, DATA, DATA_HORA, EVENTOS, INSTRUMENTOS, MODELOS, QUADROS, TIPOS_REFERENCIA, chaveQuadro, rotuloReferencia, type Checagem, type Modelo, type Verificacao } from "@/lib/riep";
import { RelatorioVerificacoes } from "@/components/emenda/relatorio-verificacoes";
import { getCurrentUser } from "@/lib/session";
import { BotaoImprimir } from "@/components/app/botao-imprimir";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { naoRemetida } from "@/lib/emendas/situacoes";

export const metadata: Metadata = { title: "Plano de trabalho — Emendas360" };

const pendente = (t = "Não informado") => <span className="text-muted-foreground italic">{t}</span>;
const valor = (v: string | null | undefined) => (v && v.trim() ? v : pendente());

// Plano de trabalho da emenda, na estrutura dos Modelos I a IV. Prévia para
// conferência e impressão, sempre com os dados gravados.
export default async function PlanoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const x = await buscarEmenda(id);
  if (!x) notFound();
  const ve =
    podeGerirEmenda(user, { autorUsuarioId: x.autor.usuarioId }) ||
    podeVerTodasEmendas(user) ||
    temPermissao(user, "analisarViabilidade", "registrarExecucao", "consultarTudo");
  if (!ve) notFound();

  const m = x.modelo as Modelo | null;
  const M = m ? MODELOS[m] : null;
  const indireta = x.execucao === "INDIRETA";
  const d = x.dotacao;
  const quadro = (x.quadroViabilidade ?? {}) as Record<string, string>;
  const total = x.itens.reduce((s, i) => s + i.quantidade.toNumber() * i.valorUnitario.toNumber(), 0);
  const cronograma = x.parcelas.reduce((s, p) => s + p.valor.toNumber(), 0);
  const evento = x.evento ? EVENTOS[x.evento] : null;
  const beneficiario = [...new Set(x.metas.map((mt) => mt.beneficiarios).filter(Boolean))].join("; ");
  let n = 0;
  const prox = () => ++n;

  return (
    <div className="min-h-dvh bg-page py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[860px] justify-end gap-2 px-4 print:hidden">
        <BotaoImprimir />
      </div>
      <article className="mx-auto max-w-[860px] rounded-card bg-surface p-10 shadow-card max-sm:p-5 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b border-hair pb-4">
          <p className="antena">
            Emendas360 · exercício {x.exercicio.ano}
          </p>
          <h1 className="mt-1 text-xl font-extrabold">Emenda e plano de trabalho</h1>
          <p className="mt-1 text-sm font-bold text-navy">{M ? `Modelo ${M.numero} — ${M.titulo}` : "Modelo a definir pela análise técnica"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {naoRemetida(x.status) ? "Rascunho — prévia para conferência." : `Emenda nº ${x.numero}/${x.exercicio.ano}, submetida em ${DATA(x.submetidaEm)}.`}{" "}
            A aprovação e as assinaturas permanecem pendentes.
          </p>
        </header>

        <Secao numero={prox()} titulo="Emenda">
          <Campos
            linhas={[
              ["Emenda nº / ano", x.numero ? `${x.numero}/${x.exercicio.ano}` : pendente("Número atribuído na submissão")],
              ["Situação", STATUS_EMENDA[x.status]?.rotulo ?? x.status],
              ["Valor da emenda", BRL(x.valor.toNumber())],
              ["Planilha do plano", BRL(total)],
              ["Autor", x.autor.nome + (x.autor.partido ? ` — ${x.autor.partido}` : "")],
              ["Tipo de despesa", d ? (d.naturezaDespesa.grupo === "4" ? "Investimento (GND 4)" : "Custeio (GND 3)") : pendente("A definir pela análise técnica")],
              ["Parcela da cota", x.parcela === "SAUDE" ? "Saúde — ações e serviços públicos de saúde (IC-CO 1002)" : x.parcela === "DEMAIS" ? "Demais áreas" : pendente()],
            ]}
          />
        </Secao>

        <Secao numero={prox()} titulo="Dotação">
          <h3 className="mb-1 text-sm font-bold">Dotação de destino</h3>
          {d ? <Campos linhas={classificacao(d)} /> : null}
          {informadaGravada(x.dotacaoInformada) && !informadaGravada(x.dotacaoInformada)!.naLoa ? (
            <Campos
              linhas={[
                ["Classificação informada", textoInformada(informadaGravada(x.dotacaoInformada)!)],
                ["Situação", "Informada pelo vereador, não encontrada na LOA — sob a responsabilidade declarada do autor"],
              ]}
            />
          ) : !d ? (
            <p className="text-sm">{pendente("A definir pela análise técnica")}</p>
          ) : null}
        </Secao>

        <Secao numero={prox()} titulo={M?.executor ?? "Executor e beneficiário"}>
          <Campos
            linhas={[
              ...(indireta
                ? ([
                    ["Entidade (OSC)", valor(x.destino?.nome)],
                    ["CNPJ", valor(x.destino?.cnpj)],
                    ["Órgão repassador", d ? `${d.unidadeOrcamentaria.codigo} — ${d.unidadeOrcamentaria.nome}` : pendente()],
                    ["Instrumento pretendido", x.instrumento === "OUTRO" ? valor(x.instrumentoOutro) : x.instrumento ? INSTRUMENTOS[x.instrumento].rotulo : pendente()],
                    ["Representante legal", valor([x.destino?.responsavelNome, x.destino?.responsavelCargo].filter(Boolean).join(" · "))],
                  ] as [string, React.ReactNode][])
                : ([
                    ["Órgão executor", valor(x.agenteExecutor)],
                    ["Destino", valor(x.destino?.nome)],
                  ] as [string, React.ReactNode][])),
              [m === "OBRAS" ? "Local da obra" : m === "EQUIPAMENTOS" ? "Local de instalação" : "Local de execução", valor(x.endereco)],
              ["Beneficiário final", valor(beneficiario)],
            ]}
          />
        </Secao>

        <Secao numero={prox()} titulo="Objeto — o que será feito com o recurso">
          <p className="text-sm leading-relaxed">{valor(x.objeto)}</p>
        </Secao>
        <Secao numero={prox()} titulo="Justificativa — por que é de interesse público">
          <p className="text-sm leading-relaxed whitespace-pre-line">{valor(x.justificativa)}</p>
        </Secao>

        {m && QUADROS[m] ? (
          <Secao numero={prox()} titulo={QUADROS[m]!.titulo}>
            <Campos linhas={QUADROS[m]!.itens.map((it, i) => [it.pergunta, valor(quadro[chaveQuadro(m, i)])])} />
          </Secao>
        ) : null}

        <Secao numero={prox()} titulo="Metas">
          <h3 className="mb-1 text-sm font-bold">Meta finalística</h3>
          <p className="mb-3 text-sm">{valor(x.metaFinalistica)}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair text-left text-2xs tracking-[0.04em] text-muted-foreground uppercase">
                <th className="py-1.5">Meta / público beneficiário</th>
                <th>Unidade</th>
                <th className="text-right">Quantidade</th>
                <th className="pl-3">Como será comprovada</th>
              </tr>
            </thead>
            <tbody>
              {x.metas.map((mt, i) => (
                <tr key={mt.id} className="border-b border-hair">
                  <td className="py-1.5">
                    <b>M{i + 1}.</b> {mt.beneficiarios}
                  </td>
                  <td>{mt.unidade}</td>
                  <td className="text-right tnum">{mt.quantidade.toNumber().toLocaleString("pt-BR")}</td>
                  <td className="pl-3">{evento?.nome ?? pendente()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-3 mb-1 text-sm font-bold">Etapas de execução</h3>
          <p className="text-sm">{valor(x.etapas)}</p>
        </Secao>

        <Secao numero={prox()} titulo="Memória de cálculo — como se chegou ao valor">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair text-left text-2xs tracking-[0.04em] text-muted-foreground uppercase">
                <th className="py-1.5">{m === "EQUIPAMENTOS" ? "Equipamento / especificação" : "Item / serviço"}</th>
                <th className="pl-3 text-right">Qtde.</th>
                <th className="pl-3 text-right">Unitário</th>
                <th className="pl-3 text-right">Total</th>
                <th className="pl-3">Fonte do preço</th>
              </tr>
            </thead>
            <tbody>
              {x.itens.map((i) => (
                <tr key={i.id} className="border-b border-hair align-top">
                  <td className="py-1.5">{i.descricao}</td>
                  <td className="pl-3 text-right whitespace-nowrap tnum">
                    {i.quantidade.toNumber().toLocaleString("pt-BR")} {i.unidade ?? i.referencia?.unidade ?? ""}
                  </td>
                  <td className="pl-3 text-right whitespace-nowrap tnum">{BRL(i.valorUnitario.toNumber())}</td>
                  <td className="pl-3 text-right whitespace-nowrap tnum">{BRL(i.quantidade.toNumber() * i.valorUnitario.toNumber())}</td>
                  <td className="pl-3 text-xs">
                    {i.referencia
                      ? rotuloReferencia({
                          codigo: i.referencia.codigo,
                          tipo: i.referencia.tipo,
                          campos: i.referencia.campos as Record<string, string>,
                          emissor: i.referencia.emissor,
                          fonteId: i.referencia.fonteId,
                        })
                      : pendente("Fonte não informada")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-right text-md font-extrabold">Valor total da emenda: {BRL(total)}</p>
        </Secao>

        <Secao numero={prox()} titulo="Cronograma de desembolso">
          <Campos linhas={x.parcelas.map((p, i) => [`${i + 1}ª parcela`, BRL(p.valor.toNumber())])} />
          <p className="mt-2 text-xs text-muted-foreground">
            {Math.round((cronograma - total) * 100) === 0 ? "Cronograma confere com a memória de cálculo." : "O cronograma diverge da memória de cálculo."} Os
            meses de pagamento se definem na execução.
          </p>
        </Secao>

        <Secao numero={prox()} titulo="Classificação orçamentária">
          {d ? (
            <Campos
              linhas={[
                ["Órgão / unidade", `${d.unidadeOrcamentaria.codigo} — ${d.unidadeOrcamentaria.nome}`],
                ["Funcional programática", `${d.funcao.codigo}.${d.subfuncao.codigo} · ${d.programa.codigo} · ${d.codigo}`],
                ["Programa", `${d.programa.codigo} — ${d.programa.nome}`],
                ["Ação / ficha", `${d.codigo} — ${d.acao.nome}${d.ficha ? ` · ficha ${d.ficha}` : ""}`],
                ["Natureza da despesa", d.naturezaDespesa.codigo],
                ["Fonte", d.fonteRecurso.codigo],
              ]}
            />
          ) : (
            <p className="text-sm">{pendente("Pendente de análise técnica")}</p>
          )}
        </Secao>

        {x.referencias.length ? (
          <Secao numero={prox()} titulo="Quadro de origem dos preços">
            {x.referencias.map((r) => (
              <div key={r.id} className="mb-3 break-inside-avoid text-sm">
                <b>
                  {r.codigo} · {r.fonteId ? r.emissor : TIPOS_REFERENCIA[r.tipo].nome}
                </b>{" "}
                <span className="text-xs text-muted-foreground">({r.fonteId ? "fonte oficial" : "outra fonte"})</span>
                <p className="text-xs">
                  {Object.entries((r.campos ?? {}) as Record<string, string>)
                    .map(([, v]) => v)
                    .join(" · ")}{" "}
                  · {r.emissor} · consultada em {r.data ? r.data.toLocaleDateString("pt-BR") : r.dataTexto} · {r.objeto} · {BRL(r.valor.toNumber())} por{" "}
                  {r.unidade}
                </p>
                {r.link ? <p className="text-xs break-all">{r.link}</p> : null}
              </div>
            ))}
          </Secao>
        ) : null}

        <Secao numero={prox()} titulo="Declarações do autor">
          <Campos
            linhas={[
              [
                "Inexistência de vínculo conjugal, de união estável ou de parentesco até o terceiro grau (ADPF 854)",
                x.declaracaoVinculo ? "Confirmada" : pendente("Ainda não confirmada"),
              ],
              ["Pesquisei e informei os preços desta emenda", x.declaracaoPrecos ? "Confirmada" : pendente("Ainda não confirmada")],
              ...(informadaGravada(x.dotacaoInformada) && !informadaGravada(x.dotacaoInformada)!.naLoa
                ? ([["A classificação foi informada por mim e é de minha responsabilidade", x.declaracaoDotacao ? "Confirmada" : pendente("Ainda não confirmada")]] as [string, React.ReactNode][])
                : []),
            ]}
          />
        </Secao>

        <Secao numero={prox()} titulo="Tramitação e pareceres">
          <Campos
            linhas={[
              ["Remetida em", x.submetidaEm ? DATA(x.submetidaEm) : pendente("Não remetida")],
              ...(x.diligenciaMotivo
                ? ([["Diligência da Comissão", <span key="dl" className="whitespace-pre-line">{`${DATA(x.diligenciaEm)} · prazo ${DATA(x.diligenciaAte)}\n${x.diligenciaMotivo}`}</span>]] as [string, React.ReactNode][])
                : []),
              ["Parecer da Comissão", x.parecerTramitacao ? <span key="pc" className="whitespace-pre-line">{`${STATUS_EMENDA[x.status]?.rotulo ?? ""} em ${DATA(x.tramitadaEm)}\n${x.parecerTramitacao}`}</span> : pendente("Sem decisão")],
              ...x.pareceres.map(
                (p, i) => [`Viabilidade técnica${i ? " (anterior)" : ""}`, `${p.resultado === "VIAVEL" ? "Viável" : p.resultado === "INVIAVEL" ? "Inviável" : "Viável com ressalva"} em ${DATA(p.criadoEm)} — ${p.justificativa}`] as [string, React.ReactNode]
              ),
              ["Incorporada à lei", x.incorporadaEm ? DATA(x.incorporadaEm) : pendente("Não")],
            ]}
          />
        </Secao>

        {(() => {
          const v = x.validacoes.find((y) => Array.isArray(y.verificacoes) && (y.verificacoes as unknown[]).length);
          return v ? (
            <Secao numero={prox()} titulo="Validação">
              <RelatorioVerificacoes
                verificacoes={v.verificacoes as unknown as Verificacao[]}
                complementares={v.itens as unknown as Checagem[]}
                valida={v.valida}
                cabecalho={`Executada em ${DATA_HORA(v.executadaEm)}`}
              />
            </Secao>
          ) : null;
        })()}

        <section className="mt-10 grid grid-cols-2 gap-10 text-center text-xs max-sm:grid-cols-1">
          <div className="border-t border-ink pt-2">
            {x.autor.nome}
            <br />
            Vereador(a) autor(a) da emenda
          </div>
          <div className="border-t border-ink pt-2">
            Poder Executivo
            <br />
            Aprovação do plano de trabalho
          </div>
        </section>
        {m === "TERCEIRO_SETOR" ? (
          <p className="mt-6 text-xs text-muted-foreground">
            Este é o plano de trabalho da emenda, apresentado pelo vereador. O plano da parceria será elaborado pela entidade na fase de celebração.
          </p>
        ) : null}
      </article>
    </div>
  );
}

function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 border-b-2 border-navy pb-1 text-md font-extrabold">
        {numero}. {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campos({ linhas }: { linhas: [string, React.ReactNode][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {linhas.map(([k, v]) => (
          <tr key={k} className="border-b border-hair">
            <th className="w-[38%] py-1.5 pr-3 text-left align-top font-semibold text-muted-foreground">{k}</th>
            <td className="py-1.5">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Codigo = { codigo: string; nome: string | null };
function classificacao(d: { ficha: string | null; orgao: Codigo; unidadeOrcamentaria: Codigo; funcao: Codigo; subfuncao: Codigo; programa: Codigo; acao: Codigo; naturezaDespesa: Codigo; fonteRecurso: Codigo }): [string, React.ReactNode][] {
  const c = (x: Codigo) => `${x.codigo} — ${x.nome ?? ""}`;
  return [
    ["Órgão", c(d.orgao)],
    ["Unidade orçamentária", c(d.unidadeOrcamentaria)],
    ["Função", c(d.funcao)],
    ["Subfunção", c(d.subfuncao)],
    ["Programa", c(d.programa)],
    ["Ação", c(d.acao)],
    ["Natureza da despesa", c(d.naturezaDespesa)],
    ["Fonte de recurso", c(d.fonteRecurso)],
    ["Ficha", d.ficha ?? "—"],
  ];
}
