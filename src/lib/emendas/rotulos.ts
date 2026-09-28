// Rótulos de exibição dos enums do domínio.

export const STATUS_EMENDA: Record<string, { rotulo: string; tipo: "ok" | "warn" | "bad" | "info" | "neutro" }> = {
  RASCUNHO: { rotulo: "Rascunho", tipo: "neutro" },
  SUBMETIDA: { rotulo: "Submetida", tipo: "info" },
  APROVADA: { rotulo: "Aprovada", tipo: "ok" },
  REJEITADA: { rotulo: "Rejeitada", tipo: "bad" },
};

export const RESULTADO_VIABILIDADE: Record<string, { rotulo: string; tipo: "ok" | "warn" | "bad" }> = {
  VIAVEL: { rotulo: "Viável", tipo: "ok" },
  VIAVEL_COM_RESSALVA: { rotulo: "Viável com ressalva", tipo: "warn" },
  INVIAVEL: { rotulo: "Inviável", tipo: "bad" },
};

export const ETAPA_EXECUCAO: Record<string, string> = {
  EMPENHO: "Empenho",
  LIQUIDACAO: "Liquidação",
  PAGAMENTO: "Pagamento",
};

export const PARCELA: Record<string, string> = { SAUDE: "Saúde", DEMAIS: "Demais áreas" };
