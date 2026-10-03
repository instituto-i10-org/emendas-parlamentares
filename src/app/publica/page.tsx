import type { Metadata } from "next";
import Link from "next/link";
import { Barra, Cartao, Kpi } from "@/components/app/pagina";
import { Button } from "@/components/ui/button";
import { consolidar } from "@/lib/emendas/consultas";
import { getAnoAtivo } from "@/lib/exercicio";
import { BRL, PCT } from "@/lib/riep";

export const metadata: Metadata = { title: "Emendas impositivas — portal público" };

export default async function PortalPage() {
  const ano = await getAnoAtivo();
  const c = ano ? await consolidar(ano, true) : null;
  if (!c) return <p className="text-sm text-muted-foreground">Nenhum exercício publicado.</p>;
  const comEmenda = c.porAutor.filter((a) => a.total > 0).length;
  return (
    <div className="grid gap-6">
      <div>
        <p className="antena">Exercício {c.ano}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.02em]">Para onde vai o dinheiro das emendas dos vereadores</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Emendas impositivas são indicações dos vereadores que a Prefeitura é obrigada a executar, até o limite legal. Metade do valor vai,
          obrigatoriamente, para ações e serviços públicos de saúde.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Kpi rotulo="Total indicado" valor={BRL(c.total)} detalhe={`${comEmenda} vereador(es)`} tom="navy" />
        <Kpi rotulo="Para a saúde" valor={BRL(c.saude)} detalhe={c.total ? `${PCT((c.saude / c.total) * 100)} do total` : undefined} tom="ok" />
        <Kpi rotulo="Cota de cada vereador" valor={c.cotaIndividual !== null ? BRL(c.cotaIndividual) : "—"} detalhe={`${c.numeroVereadores} vereadores`} />
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <Cartao titulo="Por vereador">
          <ul className="grid gap-3 text-sm">
            {c.porAutor
              .filter((a) => a.total > 0)
              .map((a) => (
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
              <b>2. A indicação.</b> Cada vereador indica, dentro da sua cota, o que será feito e onde — metade para a saúde.
            </li>
            <li>
              <b>3. A execução.</b> A Prefeitura executa, e cada etapa (empenho, liquidação e pagamento) fica registrada.
            </li>
          </ol>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <Link href="/publica/emendas">Consultar emendas</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/publica/manual">Saiba mais</Link>
            </Button>
          </div>
        </Cartao>
      </div>
    </div>
  );
}
