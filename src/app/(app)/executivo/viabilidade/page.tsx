import type { Metadata } from "next";
import { Cartao, Kpi, Pagina } from "@/components/app/pagina";
import { ListaViabilidade } from "@/components/executivo/listas";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { podeAnalisarViabilidade } from "@/lib/authz";
import { listarEmendas } from "@/lib/emendas/consultas";
import { paraLinhaExecutivo } from "@/lib/emendas/linhas-executivo";
import { getAnoAtivo } from "@/lib/exercicio";
import { NAO_REMETIDAS } from "@/lib/emendas/situacoes";

export const metadata: Metadata = { title: "Viabilidade técnica — Emendas360" };

export default async function ViabilidadePage() {
  const user = await requireAccess({ poder: Poder.EXECUTIVO, permissoes: ["analisarViabilidade", "consultarTudo"] });
  const ano = await getAnoAtivo();
  const emendas = ano ? await listarEmendas(ano, { status: { notIn: NAO_REMETIDAS } }) : [];
  const linhas = emendas.map((e) => paraLinhaExecutivo(e, ano!));
  const com = linhas.filter((l) => l.parecer);
  return (
    <Pagina
      titulo="Viabilidade técnica"
      guia="viabilidade"
      descricao="O Executivo se manifesta sobre a viabilidade das emendas submetidas. O parecer é informativo: não altera a emenda nem trava a tramitação, e serve também como registro de impedimento técnico (CF art. 166 §11)."
    >
      <div data-guia="viabilidade.totais" className="mb-5 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Kpi rotulo="Emendas submetidas" valor={linhas.length} />
        <Kpi rotulo="Sem parecer" valor={linhas.length - com.length} tom={linhas.length - com.length ? "warn" : undefined} />
        <Kpi rotulo="Inviáveis (último parecer)" valor={com.filter((l) => l.parecer!.resultado === "INVIAVEL").length} tom="bad" />
      </div>
      <Cartao>
        <ListaViabilidade linhas={linhas} podeAgir={podeAnalisarViabilidade(user)} />
      </Cartao>
    </Pagina>
  );
}
