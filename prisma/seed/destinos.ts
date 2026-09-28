import type { PrismaClient } from "../../src/generated/prisma/client";
import { lerDados } from "./dados";

type DestinoJson = {
  nome: string;
  nomeOficial: string;
  execucao: "DIRETA" | "INDIRETA";
  endereco: string;
  unidade?: string;
  unidadeRepasse?: string;
  cnpj?: string;
  cnes?: string;
  inep?: string;
  populacao?: number;
  fontePopulacao?: string;
  dataPopulacao?: string;
  fonte: string;
};

// Destinos da base oficial (CNES, Censo Escolar, SUAS, Receita Federal). Os
// cadastrados por usuários não são tocados.
export async function semearDestinos(prisma: PrismaClient) {
  const { destinos } = lerDados<{ destinos: DestinoJson[] }>("destinos-2026.json");
  for (const d of destinos) {
    const dados = {
      nome: d.nome,
      nomeOficial: d.nomeOficial,
      execucao: d.execucao,
      endereco: d.endereco,
      unidadeCodigo: d.unidade ?? null,
      unidadeRepasseCodigo: d.unidadeRepasse ?? null,
      cnpj: d.cnpj ?? null,
      cnes: d.cnes ?? null,
      inep: d.inep ?? null,
      populacaoReferencia: d.populacao ?? null,
      fontePopulacao: d.fontePopulacao ?? null,
      dataPopulacao: d.dataPopulacao ?? null,
      fonteUrl: d.fonte,
      origem: "BASE_OFICIAL" as const,
    };
    await prisma.destino.upsert({
      where: { execucao_nome: { execucao: d.execucao, nome: d.nome } },
      update: dados,
      create: dados,
    });
  }
  return destinos.length;
}
