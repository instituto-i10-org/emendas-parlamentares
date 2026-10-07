import type { DotacaoMotor } from "./tipos";

// ============================================================================
// A dotação da base do projeto de lei, com o que as treze verificações
// conferem além do que o motor de classificação já usa. Puro.
// ============================================================================

export type DotacaoBase = DotacaoMotor & {
  // Órgão orçamentário (código).
  orgao: string;
  acaoCodigo: string;
  // Programa a que a ação pertence no cadastro (normalmente o da dotação).
  acaoPrograma: string;
  // Natureza da despesa por extenso no código (ex.: 3.3.90.30).
  natureza: string;
  constaNoPPA: boolean;
  // Os oito componentes da classificação vieram todos.
  completa: boolean;
};
