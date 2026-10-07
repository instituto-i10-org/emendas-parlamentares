import "server-only";
import { projetoBase } from "@/lib/emendas/contexto";
import { prisma } from "@/lib/prisma";
import { passosPrimeiraConfiguracao, type PassoPrimeiraConfiguracao } from "./primeira-configuracao";

// Junta os números da primeira configuração para o exercício em exibição.
export async function lerPrimeiraConfiguracao(ano: number | null): Promise<PassoPrimeiraConfiguracao[]> {
  const exercicio = ano ? await prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true } }) : null;
  const ativos = { ativo: true };
  const [municipio, base, areasComOrgaos, destinosAtivos, usuariosQueApresentam, usuariosQueTramitam] = await Promise.all([
    prisma.municipio.findFirst({ select: { nome: true, portalPublico: true, manualAtoId: true, manualPublicadoEm: true } }),
    exercicio ? projetoBase(exercicio.id) : null,
    prisma.areaAplicacao.count({ where: { orgaos: { isEmpty: false } } }),
    prisma.destino.count({ where: ativos }),
    prisma.user.count({ where: { ...ativos, perfil: { apresentarEmendas: true } } }),
    prisma.user.count({ where: { ...ativos, perfil: { tramitarEmendas: true } } }),
  ]);
  const cfg = exercicio?.configuracao ?? null;
  return passosPrimeiraConfiguracao({
    municipioNome: municipio?.nome ?? null,
    exercicio: exercicio
      ? {
          ano: exercicio.ano,
          cotaIndividual: cfg?.cotaIndividual != null,
          percentualSaude: cfg?.percentualSaude != null,
          prazoProtocolo: cfg?.prazoProtocolo != null,
          fundamentos: (cfg?.fundamentos ?? {}) as Record<string, { texto?: string } | undefined>,
        }
      : null,
    loaImportada: !!base,
    areasComOrgaos,
    destinosAtivos,
    usuariosQueApresentam,
    usuariosQueTramitam,
    portalPublico: municipio?.portalPublico ?? false,
    manualInstituido: !!municipio?.manualAtoId,
    manualPublicado: !!municipio?.manualPublicadoEm,
  });
}
