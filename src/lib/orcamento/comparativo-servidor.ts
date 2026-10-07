import "server-only";
import { projetoBase } from "@/lib/emendas/contexto";
import { prisma } from "@/lib/prisma";
import { comparar, type EmendaIncorporada, type LinhaOrcamento } from "./comparativo";

// Linhas do projeto e da lei do exercício, e as emendas incorporadas.
export async function dadosComparativo(ano: number) {
  const ex = await prisma.exercicio.findUnique({ where: { ano } });
  if (!ex) return null;
  const [projeto, lei] = await Promise.all([
    projetoBase(ex.id),
    prisma.instrumentoPlanejamento.findFirst({ where: { exercicioId: ex.id, tipo: "LOA", especie: "LEI_APROVADA" }, orderBy: { createdAt: "desc" } }),
  ]);
  const linhas = async (instrumentoId: string | undefined): Promise<LinhaOrcamento[]> => {
    if (!instrumentoId) return [];
    const ds = await prisma.dotacao.findMany({
      where: { instrumentoId, ativo: true },
      include: { acao: true, orgao: true, unidadeOrcamentaria: true, naturezaDespesa: true, fonteRecurso: true },
      orderBy: { ordem: "asc" },
    });
    return ds.map((d) => ({
      id: d.id,
      // A mesma dotação nos dois instrumentos: os oito componentes iguais.
      chave: [d.unidadeOrcamentariaId, d.funcaoId, d.subfuncaoId, d.programaId, d.acaoId, d.naturezaDespesaId, d.fonteRecursoId].join("|"),
      ficha: d.ficha,
      codigo: d.codigo,
      nome: d.acao.nome,
      uo: d.unidadeOrcamentaria.codigo,
      orgao: d.orgao.codigo,
      natureza: d.naturezaDespesa.codigo,
      fonte: d.fonteRecurso.codigo,
      valor: d.valorAutorizado.toNumber(),
    }));
  };
  const [pl, ll, inc] = await Promise.all([
    linhas(projeto?.id),
    linhas(lei?.id),
    prisma.emenda.findMany({ where: { exercicioId: ex.id, incorporadaEm: { not: null } }, select: { id: true, numero: true, valor: true, dotacaoId: true } }),
  ]);
  // Em Mogi a impositiva não tem origem no sistema: soma só no destino.
  const emendas: EmendaIncorporada[] = inc.map((e) => ({ id: e.id, numero: e.numero, valor: e.valor.toNumber(), destinoId: e.dotacaoId, origemId: null }));
  return { exercicioId: ex.id, projeto, lei, pl, emendas, linhas: comparar(pl, ll, emendas), temLei: ll.length > 0 };
}
