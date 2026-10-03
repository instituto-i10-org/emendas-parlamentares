import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditorEmenda } from "@/components/emenda/editor";
import { Poder } from "@/generated/prisma/enums";
import { requireAccess } from "@/lib/access";
import { aplicadoDoAutor, carregarContexto } from "@/lib/emendas/contexto";
import { estadoInicial } from "@/lib/emendas/estado";
import { anoPadrao, exercicioHistorico, getAnoAtivo, listarExercicios } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { ExercicioHistoricoAviso, SemExercicio } from "@/components/emenda/avisos-pagina";

export const metadata: Metadata = { title: "Nova emenda — Emendas360" };

export default async function NovaEmendaPage() {
  const user = await requireAccess({ poder: Poder.LEGISLATIVO, permissoes: ["apresentarEmendas"] });
  const ano = await getAnoAtivo();
  const ctx = ano ? await carregarContexto(ano) : null;
  if (!ctx) return <SemExercicio />;
  if (await exercicioHistorico(ctx.config.exercicio)) {
    return <ExercicioHistoricoAviso ano={ctx.config.exercicio} padrao={anoPadrao(await listarExercicios()) ?? ctx.config.exercicio} />;
  }
  // Sem vínculo a um vereador, a conta não apresenta emenda: a tela não abre.
  const autor = await prisma.autor.findUnique({ where: { usuarioId: user.id } });
  if (!autor) redirect("/inicio?erro=acesso-negado");
  if (!ctx.loa.length) redirect("/emendas?erro=sem-loa");
  const aplicado = await aplicadoDoAutor(ctx.exercicioId, autor.id, ctx.config.percentualSaude);
  return <EditorEmenda ctx={ctx} inicial={estadoInicial()} aplicado={aplicado} autor={autor.nome} />;
}
