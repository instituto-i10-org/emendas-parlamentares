import type { Metadata } from "next";
import { Cartao, Kpi, Pagina } from "@/components/app/pagina";
import { ListaExecucao } from "@/components/executivo/listas";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { podeRegistrarExecucao } from "@/lib/authz";
import { listarEmendas } from "@/lib/emendas/consultas";
import { paraLinhaExecutivo } from "@/lib/emendas/linhas-executivo";
import { getAnoAtivo } from "@/lib/exercicio";
import { BRL } from "@/lib/riep";

export const metadata: Metadata = { title: "Execução das emendas — Emendas360" };

export default async function ExecucaoPage() {
  const user = await requireAccess({ poder: Poder.EXECUTIVO, permissoes: ["registrarExecucao"] });
  const ano = await getAnoAtivo();
  const emendas = ano ? await listarEmendas(ano, { status: "APROVADA" }) : [];
  const linhas = emendas.map((e) => paraLinhaExecutivo(e, ano!));
  const soma = (k: "empenhado" | "liquidado" | "pago") => linhas.reduce((s, l) => s + l.execucao[k], 0);
  const aprovado = linhas.reduce((s, l) => s + l.valor, 0);
  return (
    <Pagina
      titulo="Execução das emendas"
      descricao="Empenho, liquidação e pagamento de cada emenda aprovada (Lei 4.320/1964). O lançamento é manual nesta versão; os campos seguem o vocabulário do sistema financeiro para uma integração futura."
    >
      <div className="mb-5 grid grid-cols-4 gap-3.5 max-lg:grid-cols-2">
        <Kpi rotulo="Aprovado" valor={BRL(aprovado)} detalhe={`${linhas.length} emenda(s)`} tom="navy" />
        <Kpi rotulo="Empenhado" valor={BRL(soma("empenhado"))} />
        <Kpi rotulo="Liquidado" valor={BRL(soma("liquidado"))} />
        <Kpi rotulo="Pago" valor={BRL(soma("pago"))} tom="ok" />
      </div>
      <Cartao>
        <ListaExecucao linhas={linhas} podeAgir={podeRegistrarExecucao(user)} />
      </Cartao>
    </Pagina>
  );
}
