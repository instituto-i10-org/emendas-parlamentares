import { Poder } from "@/generated/prisma/enums";

// ============================================================================
// Regras de autorização PURAS (sem I/O) — testáveis. As server actions carregam
// o ator/recurso e decidem com estas funções.
//
// PROMPT 12: o papel fixo saiu de cena. O ator carrega o PERFIL DE ACESSO —
// Poder de atuação + permissões atômicas — lido do banco no login. Quem tem
// `adminGeral` passa por tudo; quem está sem perfil não passa por nada.
// ============================================================================

// As permissões atômicas que compõem um perfil. Um perfil é a combinação delas
// com um Poder de atuação; sem nenhuma marcada, é perfil de consulta.
export type Permissao =
  | "apresentarEmendas"
  | "gerirTodasEmendas"
  | "tramitarEmendas"
  | "gerirPlanejamento"
  | "gerirExercicios"
  | "administrarConfiguracoes"
  | "analisarViabilidade"
  | "registrarExecucao"
  // Leitura de tudo, sem escrita (controle interno, auditoria, consulta).
  | "consultarTudo";

export const PERMISSOES: Permissao[] = [
  "apresentarEmendas",
  "gerirTodasEmendas",
  "tramitarEmendas",
  "gerirPlanejamento",
  "gerirExercicios",
  "administrarConfiguracoes",
  "analisarViabilidade",
  "registrarExecucao",
  "consultarTudo",
];

// Permissões que escrevem. Perfil que só tem consultarTudo continua sendo de
// consulta.
export const PERMISSOES_DE_ESCRITA: Permissao[] = PERMISSOES.filter((p) => p !== "consultarTudo");

export type Perfil = {
  id: string;
  nome: string;
  // Poder de atuação; nulo = transversal (atravessa os dois Poderes).
  poder: Poder | null;
  adminGeral: boolean;
  perfilDoSistema: boolean;
} & Record<Permissao, boolean>;

export type Ator = {
  id: string;
  // Nulo enquanto a conta não tem perfil atribuído — não acessa o sistema.
  perfil: Perfil | null;
};

export const ehAdminGeral = (a: Ator): boolean => a.perfil?.adminGeral === true;

// Perfil de consulta: existe, pertence a um Poder, mas não escreve nada.
export const ehConsulta = (a: Ator): boolean =>
  !!a.perfil && !a.perfil.adminGeral && PERMISSOES_DE_ESCRITA.every((p) => !a.perfil![p]);

// Verificação de permissão. O Administrador Geral ignora a checagem.
export function temPermissao(a: Ator, ...permissoes: Permissao[]): boolean {
  if (!a.perfil) return false;
  if (a.perfil.adminGeral) return true;
  return permissoes.some((p) => a.perfil![p]);
}

// Separação de Poderes — estrutural, verificada ANTES da permissão: um módulo
// do Legislativo é inacessível a perfil do Executivo e vice-versa, ainda que a
// permissão exista no perfil. Perfil transversal e Administrador Geral passam.
export function alcancaPoder(a: Ator, poder: Poder | "TRANSVERSAL"): boolean {
  if (!a.perfil) return false;
  if (a.perfil.adminGeral) return true;
  if (poder === "TRANSVERSAL") return true;
  // Perfil transversal (sem Poder) atravessa os dois lados.
  return a.perfil.poder === null || a.perfil.poder === poder;
}

// Regra geral de acesso a um item: o Poder tem de alcançar E o perfil precisa
// de ao menos uma das permissões exigidas. Item sem permissão exigida é item de
// consulta — basta o Poder coincidir.
export function podeAcessar(
  a: Ator,
  item: { poder: Poder | "TRANSVERSAL"; permissoes?: Permissao[] }
): boolean {
  if (!alcancaPoder(a, item.poder)) return false;
  if (!item.permissoes || item.permissoes.length === 0) return !!a.perfil;
  return temPermissao(a, ...item.permissoes);
}

// -------------------------------------------------------------------- Emendas

// Pode apresentar (criar) emendas. Exige também estar no Legislativo: emenda
// parlamentar é ato do Poder Legislativo.
export function podeCriarEmenda(a: Ator): boolean {
  return (
    alcancaPoder(a, Poder.LEGISLATIVO) && temPermissao(a, "apresentarEmendas")
  );
}

// Apresenta emendas de fato: além da permissão, a conta precisa estar
// vinculada a um autor (vereador) — é dele a cota que a emenda consome. Quem
// administra tem todas as permissões, mas não é vereador: não apresenta.
export function apresentaEmendas(a: Ator, vinculadoAAutor: boolean): boolean {
  return podeCriarEmenda(a) && vinculadoAAutor;
}

// Pode aprovar/rejeitar emendas submetidas (função de comissão).
export function podeTramitar(a: Ator): boolean {
  return (
    alcancaPoder(a, Poder.LEGISLATIVO) && temPermissao(a, "tramitarEmendas")
  );
}

// Pode editar/validar/submeter uma emenda:
//  - `gerirTodasEmendas`: qualquer emenda do exercício;
//  - `apresentarEmendas`: apenas as de própria autoria.
export function podeGerirEmenda(
  a: Ator,
  emenda: { autorUsuarioId: string | null }
): boolean {
  if (!alcancaPoder(a, Poder.LEGISLATIVO)) return false;
  if (temPermissao(a, "gerirTodasEmendas")) return true;
  if (temPermissao(a, "apresentarEmendas")) {
    return emenda.autorUsuarioId === a.id;
  }
  return false;
}

// Vê a lista completa de emendas do exercício (não apenas as próprias). Quem só
// apresenta fica no seu gabinete: acompanha os agregados, não a lista alheia.
export function podeVerTodasEmendas(a: Ator): boolean {
  return (
    alcancaPoder(a, Poder.LEGISLATIVO) &&
    temPermissao(a, "gerirTodasEmendas", "tramitarEmendas", "consultarTudo")
  );
}

// -------------------------------------------------------- Executivo no processo

// Pode registrar parecer de viabilidade técnica sobre uma emenda. É ato do
// Executivo, e informativo: não altera a emenda nem trava a tramitação.
export function podeAnalisarViabilidade(a: Ator): boolean {
  return (
    alcancaPoder(a, Poder.EXECUTIVO) && temPermissao(a, "analisarViabilidade")
  );
}

// Pode lançar andamento da execução orçamentária (empenho/liquidação/pagamento).
export function podeRegistrarExecucao(a: Ator): boolean {
  return (
    alcancaPoder(a, Poder.EXECUTIVO) && temPermissao(a, "registrarExecucao")
  );
}

// ------------------------------------------------------ Planejamento e gestão

// Pode operar instrumentos PPA/LDO/LOA, base de dotações e lei aprovada.
export function podeGerirPlanejamento(a: Ator): boolean {
  return (
    alcancaPoder(a, Poder.EXECUTIVO) && temPermissao(a, "gerirPlanejamento")
  );
}

// Pode abrir/encerrar exercícios orçamentários.
export function podeGerirExercicio(a: Ator): boolean {
  return temPermissao(a, "gerirExercicios");
}

// Pode administrar parâmetros, normas, beneficiários e usuários.
export function podeAdministrarConfiguracoes(a: Ator): boolean {
  return temPermissao(a, "administrarConfiguracoes");
}

// Administra configurações dentro de um Poder — a separação vale aqui também.
export function ehAdminDoPoder(a: Ator, poder: Poder): boolean {
  return alcancaPoder(a, poder) && temPermissao(a, "administrarConfiguracoes");
}

// ------------------------------------------------------------ Perfis e usuários

// Compor/excluir perfis de acesso é ato exclusivo do Administrador Geral.
export const podeGerirPerfis = ehAdminGeral;

// Quem não é Administrador Geral só atribui perfis do próprio Poder — nunca o
// Administrador Geral, nunca um perfil do outro Poder. Sem esta trava, quem
// administra o Executivo poderia criar uma conta de Presidente da Câmara.
export function podeAtribuirPerfil(
  a: Ator,
  alvo: Pick<Perfil, "poder" | "adminGeral">
): boolean {
  if (ehAdminGeral(a)) return true;
  if (!temPermissao(a, "administrarConfiguracoes")) return false;
  if (alvo.adminGeral) return false;
  return alvo.poder !== null && alvo.poder === a.perfil?.poder;
}
