// ============================================================================
// O emendamento está aberto? Regra única, usada pela tela, pela gravação e
// pelo motor de validação. Puro: recebe o estado e decide.
//
// Aberto quando: o exercício está aberto, o projeto de lei (LOA) do exercício
// está numa situação que admite emenda (parâmetro do exercício, por padrão
// "em tramitação") e o prazo de protocolo não venceu.
// ============================================================================

export type MotivoFechado = "EXERCICIO_ENCERRADO" | "SEM_PROJETO" | "INSTRUMENTO_FECHADO" | "PRAZO_ENCERRADO";

export type SituacaoEmendamento = {
  aberto: boolean;
  motivo: MotivoFechado | null;
  explicacao: string;
};

export const ROTULO_STATUS_INSTRUMENTO: Record<string, string> = {
  EM_ELABORACAO: "em elaboração",
  ENVIADO: "enviado",
  EM_TRAMITACAO: "em tramitação",
  APROVADO: "aprovado",
  SANCIONADO: "sancionado",
  VIGENTE: "vigente",
  ENCERRADO: "encerrado",
};

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function situacaoEmendamento(e: {
  ano: number;
  exercicioStatus: string;
  projeto: { numero: string; status: string } | null;
  situacoesQueAdmitem: string[];
  prazoProtocolo: string | null;
  hoje: string;
}): SituacaoEmendamento {
  if (e.exercicioStatus !== "ABERTO") {
    return { aberto: false, motivo: "EXERCICIO_ENCERRADO", explicacao: `O exercício ${e.ano} está encerrado: não recebe emenda nova nem alteração.` };
  }
  if (!e.projeto) {
    return { aberto: false, motivo: "SEM_PROJETO", explicacao: `Não há projeto de lei orçamentária cadastrado para ${e.ano}.` };
  }
  if (!e.situacoesQueAdmitem.includes(e.projeto.status)) {
    const admitem = e.situacoesQueAdmitem.map((s) => ROTULO_STATUS_INSTRUMENTO[s] ?? s).join(" ou ");
    return {
      aberto: false,
      motivo: "INSTRUMENTO_FECHADO",
      explicacao: `O ${e.projeto.numero} está ${ROTULO_STATUS_INSTRUMENTO[e.projeto.status] ?? e.projeto.status}; recebe emendas quando ${admitem || "for liberado em Configurações"}.`,
    };
  }
  if (e.prazoProtocolo && e.hoje > e.prazoProtocolo) {
    return { aberto: false, motivo: "PRAZO_ENCERRADO", explicacao: `O prazo de protocolo das emendas terminou em ${dataBr(e.prazoProtocolo)}.` };
  }
  return {
    aberto: true,
    motivo: null,
    explicacao: e.prazoProtocolo
      ? `Emendas ao ${e.projeto.numero} abertas até ${dataBr(e.prazoProtocolo)}.`
      : `Emendas ao ${e.projeto.numero} abertas.`,
  };
}
