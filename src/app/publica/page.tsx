import type { Metadata } from "next";
import Link from "next/link";
import { Barra, Cartao, Kpi, TabelaDados } from "@/components/app/pagina";
import { PortalDesligado } from "@/components/app/portal-desligado";
import { Button } from "@/components/ui/button";
import { consolidar } from "@/lib/emendas/consultas";
import { STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { getAnoAtivo } from "@/lib/exercicio";
import { portalAtivo } from "@/lib/portal";
import { BRL, PCT } from "@/lib/riep";

export const metadata: Metadata = { title: "Emendas impositivas — portal público" };

// Abertura do portal: os números do exercício, calculados da base. Nenhum
// percentual ou prazo em texto fixo.
export default async function PortalPage() {
  if (!(await portalAtivo())) return <PortalDesligado />;
  const ano = await getAnoAtivo();
  const c = ano ? await consolidar(ano, true) : null;
  if (!c) return <p className="text-sm text-muted-foreground">Nenhum exercício publicado.</p>;
  const comEmenda = c.porAutor.filter((a) => a.total > 0);
  const pct = c.percentualSaude.toLocaleString("pt-BR");
  const situacoes = Object.entries(c.porStatus).filter(([k]) => !["RASCUNHO", "EM_VALIDACAO", "VALIDA", "INVALIDA"].includes(k));
  return (
    <div className="grid gap-6">
      <div>
        <p className="antena">Exercício {c.ano}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.02em]">Para onde vai o dinheiro das emendas dos vereadores</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Emendas impositivas são indicações dos vereadores que a Prefeitura é obrigada a executar, até o limite legal. No mínimo {pct}% do valor
          vai para ações e serviços públicos de saúde.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <Kpi rotulo="Emendas apresentadas" valor={c.apresentado.qtd + (c.porStatus.IMPORTADA?.qtd ?? 0)} detalhe={`${comEmenda.length} vereador(es)`} tom="navy" />
        <Kpi rotulo="Total apresentado" valor={BRL(c.apresentado.valor + (c.porStatus.IMPORTADA?.valor ?? 0))} />
        <Kpi rotulo="Total acatado" valor={BRL(c.acatado.valor)} detalhe={`${c.acatado.qtd} aprovada(s) pela Comissão`} tom="ok" />
        <Kpi rotulo="Cota de cada vereador" valor={c.cotaIndividual !== null ? BRL(c.cotaIndividual) : "não definida"} detalhe={`${c.numeroVereadores} vereadores`} />
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <Cartao titulo="Por situação">
          <TabelaDados
            vazio="Nenhuma emenda apresentada."
            colunas={[{ titulo: "Situação" }, { titulo: "Emendas", className: "text-right" }, { titulo: "Valor", className: "text-right" }]}
            linhas={situacoes.map(([k, v]) => ({
              chave: k,
              celulas: [
                k === "IMPORTADA" ? (
                  "Apresentadas fora do sistema"
                ) : (
                  <Link key="l" href={`/publica/emendas?situacao=${k}`} className="hover:underline">
                    {STATUS_EMENDA[k]?.rotulo ?? k}
                  </Link>
                ),
                <span key="q" className="tnum">{v.qtd}</span>,
                <span key="v" className="tnum">{BRL(v.valor)}</span>,
              ],
            }))}
          />
        </Cartao>
        <Cartao titulo="Por área">
          <TabelaDados
            vazio="Nenhuma emenda apresentada."
            colunas={[{ titulo: "Área" }, { titulo: "Apresentado", className: "text-right" }, { titulo: "Acatado", className: "text-right" }]}
            linhas={c.porArea
              .filter((a) => a.qtd)
              .map((a) => ({
                chave: a.nome,
                celulas: [a.nome, <span key="p" className="tnum">{BRL(a.apresentado)}</span>, <span key="a" className="tnum">{BRL(a.acatado)}</span>],
              }))}
          />
        </Cartao>
        <Cartao titulo="Por vereador">
          <ul className="grid gap-3 text-sm">
            {comEmenda.map((a) => (
              <li key={a.autorId}>
                <div className="flex justify-between gap-2">
                  <Link href={`/publica/emendas?autor=${a.autorId}`} className="font-semibold hover:underline">
                    {a.nome}
                  </Link>
                  <b className="tnum">{BRL(a.total)}</b>
                </div>
                <Barra valor={a.total} total={c.cotaIndividual ?? a.total} />
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao titulo="Como funciona">
          <ol className="grid gap-3 text-sm">
            <li>
              <b>1. A cota.</b> O total das emendas impositivas é um percentual da receita corrente líquida, dividido igualmente entre os vereadores.
            </li>
            <li>
              <b>2. A indicação.</b> Cada vereador indica, dentro da sua cota, o que será feito e onde — no mínimo {pct}% para a saúde.
            </li>
            <li>
              <b>3. A execução.</b> A Prefeitura executa, e cada etapa (empenho, liquidação e pagamento) fica registrada.
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Saúde no total apresentado: {c.total ? PCT((c.saude / c.total) * 100) : "—"}.</p>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <Link href="/publica/emendas">Consultar emendas</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/publica/manual">Manual</Link>
            </Button>
          </div>
        </Cartao>
      </div>
    </div>
  );
}
