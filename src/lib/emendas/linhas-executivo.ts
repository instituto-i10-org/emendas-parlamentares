import "server-only";
import type { LinhaExecutivo } from "@/components/executivo/listas";
import type { EmendaLinha } from "./consultas";

// Emenda → linha serializável para as listas do Executivo.
export function paraLinhaExecutivo(e: EmendaLinha, ano: number): LinhaExecutivo {
  const p = e.pareceres[0];
  return {
    id: e.id,
    rotulo: e.numero ? `Emenda nº ${e.numero}/${ano}` : "Emenda",
    objeto: e.objeto,
    autor: e.autor.nome,
    destino: e.destino?.nome ?? "—",
    dotacao: e.dotacao ? `${e.dotacao.codigo} · ${e.dotacao.unidadeOrcamentaria.codigo}` : "dotação a definir",
    status: e.status,
    valor: e.valor.toNumber(),
    parecer: p
      ? {
          resultado: p.resultado,
          justificativa: p.justificativa,
          por: p.usuario?.name ?? p.usuario?.email ?? "—",
          em: p.criadoEm.toLocaleString("pt-BR"),
        }
      : null,
    execucao: e.somasExec,
    andamentos: e.andamentos.map((a) => ({
      id: a.id,
      etapa: a.etapa,
      data: a.data.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
      valor: a.valor.toNumber(),
      documento: a.numeroDocumento,
      observacao: a.observacao,
    })),
  };
}
