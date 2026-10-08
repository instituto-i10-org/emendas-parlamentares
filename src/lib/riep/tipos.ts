// Tipos do motor RIEP. Tudo aqui é dado puro: o motor roda igual no servidor e
// no navegador, sem banco e sem DOM.

export type Natureza = "CUSTEIO" | "CAPITAL";
export type Divisibilidade = "DIVISIVEL" | "INDIVISIVEL";
export type Execucao = "DIRETA" | "INDIRETA";
export type Parcela = "SAUDE" | "DEMAIS";
export type Modelo = "CUSTEIO" | "OBRAS" | "TERCEIRO_SETOR" | "EQUIPAMENTOS";
export type Situacao = "OK" | "VALIDAR" | "OBICE" | "CONFLITO" | "INDETERMINADO";
export type Escolha = "SISTEMA" | "PROPONENTE" | "ANALISE_TECNICA";
export type Instrumento = "PARCERIA_MROSC" | "CONTRIBUICAO_LEI" | "OUTRO";
export type Evento =
  | "PATRIMONIO"
  | "ALMOXARIFADO"
  | "LIQUIDACAO"
  | "RECEBIMENTO_DEFINITIVO"
  | "RECEBIMENTO_ETAPA"
  | "PRESTACAO_CONTAS"
  | "PRESTACAO_CONTAS_DOACAO";
export type TipoReferencia =
  | "ATA"
  | "CONTRATACAO_MUNICIPIO"
  | "CONTRATACAO_OUTRO_ORGAO"
  | "PAINEL"
  | "BANCO_PRECOS_SAUDE"
  | "TABELA_OFICIAL"
  | "COTACAO"
  | "NOTA_FISCAL"
  | "TERMO_PARCERIA"
  | "ESTIMATIVA";

// --- catálogos do município --------------------------------------------------

export type ObjetoBiblioteca = {
  rotulo: string;
  termos: string[];
  natureza: Natureza;
  elemento: string;
  divisibilidade: Divisibilidade;
  subfuncao: string | null;
  estrito: boolean;
  explicacao: string;
  area: string | null;
  // Palavras que, no nome da ação, provam aderência ao objeto mesmo sem
  // aparecerem no texto da emenda ("saude mental" para material terapêutico).
  pistas?: string[];
};

// Tipo de equipamento público, reconhecido pelo nome do destino: o que ele
// sugere de subfunção (EMEI → 365) e que palavras no nome da ação provam
// aderência ("CAPS" → "saude mental").
export type TipoDestino = {
  nome: string;
  // Expressão regular aplicada ao nome e ao nome oficial, sem acentos e em
  // minúsculas.
  padrao: string;
  pistas: string[];
  subfuncao: string | null;
};

export type AreaAplicacao = {
  nome: string;
  orgaos: string[];
  unidadePadrao: string | null;
};

export type Catalogo = {
  objetos: ObjetoBiblioteca[];
  areas: AreaAplicacao[];
  // Nome das unidades orçamentárias por código ("13.01").
  unidades: Record<string, string>;
  tiposDestino?: TipoDestino[];
};

// --- orçamento ---------------------------------------------------------------

// Linha da LOA como o motor a enxerga. Só entram as que uma emenda pode
// financiar (custeio ou investimento, aplicação direta ou a entidade).
export type DotacaoMotor = {
  id: string;
  codigo: string;
  ficha: string | null;
  nome: string;
  uo: string;
  funcao: string;
  subf: string;
  subfn: string;
  prog: string;
  progn: string;
  tipo: "P" | "A";
  gnd: string;
  mod: string;
  elem: string;
  fonte: string;
  fonten: string;
  autorizado: number;
};

// Meta da ação nas peças de planejamento.
export type MetaPlanejamento = {
  produto: string;
  unidade: string | null;
  publico: string | null;
  quantidadePpa: number | null;
  quantidadeExercicio: number | null;
  beneficiarios: number | null;
  notaLdo: string | null;
};

// --- destino -----------------------------------------------------------------

export type DestinoMotor = {
  id: string;
  nome: string;
  execucao: Execucao;
  // Direta: a unidade a que o equipamento está vinculado.
  uo: string | null;
  endereco: string;
  cnpj: string | null;
  responsavel: string | null;
  cargo: string | null;
  populacao: number | null;
  fontePopulacao: string | null;
  dataPopulacao: string | null;
  // Cadastrado por usuário (não veio da base oficial).
  novo: boolean;
  pendenciaHabilitacao: string | null;
  // Subfunção que o equipamento sugere quando o objeto não a define.
  subfuncao?: string | null;
  // Entidade (execução indireta): a secretaria pela qual o repasse costuma
  // sair. Não restringe a busca (a secretaria vem do objeto); só põe as
  // dotações dela à frente das demais igualmente aderentes.
  unidadeRepasse?: string | null;
};

// --- configuração do exercício ----------------------------------------------

export type ConfigMotor = {
  exercicio: number;
  cotaIndividual: number | null;
  percentualSaude: number;
  afericaoSaude: "GLOBAL" | "INDIVIDUAL";
  toleranciaValorPct: number;
  validadeReferenciaMeses: number;
  percentualAcessorio: number;
  fonteAudesp: string | null;
  fonteAudespNome: string | null;
  codigoAplicacao: string | null;
  formatoVariacao: number;
  variacaoOcupaFonte: boolean;
  icEpVigente: boolean;
  icEpCodigo: string | null;
  rotuloBase: string | null;
  // Item com preço e sem fonte: bloqueia (verdadeiro) ou só alerta.
  fontePrecoObrigatoria: boolean;
};

// Já apresentado pelo autor no exercício, por parcela, sem contar esta emenda.
export type Aplicado = { saude: number; demais: number };

// --- resultado da interpretação e da classificação --------------------------

export type Interpretacao = {
  rotulo: string;
  divisibilidade: Divisibilidade | null;
  explicacao: string;
  natureza: Natureza;
  elemento: string;
  area: string | null;
  estrito: boolean;
  subfuncao: string | null;
  confianca: "exato" | "inferido";
  termo?: string;
  // Objeto inferido só pela natureza: o elemento é uma preferência (material
  // → 30, serviço → 39), não um fato — a classificação não filtra por ele.
  elementoIncerto?: boolean;
  pistas?: string[];
  // Subfunção sugerida por OUTRO termo do texto ("creche" em "mobiliário para a
  // creche"). Vale só quando nem o objeto nem o destino definem uma.
  subfuncaoSecundaria?: string | null;
};

export type Candidata = DotacaoMotor & {
  pontos: number;
  sobreposicao: number;
  aderente: boolean;
  // Valor autorizado abaixo do pretendido: sinaliza, nunca elimina.
  abaixoDoPretendido: boolean;
};

export type Classificacao = {
  situacao: Situacao;
  objeto: Interpretacao | null;
  gnd: string;
  mod: string;
  base: string;
  execucao: Execucao;
  destino: DestinoMotor;
  candidatas: Candidata[];
  naoReconhecido: boolean;
  semAderencia: boolean;
  uoAlvo: string | null;
  // As unidades pesquisadas: a do destino ou, quando ele aponta para o órgão
  // inteiro (Hospital), todas as do órgão.
  unidadesAlvo: string[];
  // Preenchida quando a dotação de obra veio de outra secretaria (a de obras),
  // porque o órgão do destino não tem linha de obra no orçamento.
  unidadeDaObra: string | null;
  uoArea: string | null;
  uoAreaNome: string | null;
  estrito: boolean;
  subfuncao: string | null;
  subfuncaoRestringiu: boolean;
  elementoRestringiu: boolean;
  // OK automático.
  selecionada: Candidata | null;
  porQue: string | null;
  // VALIDAR: as opções mostradas e o motivo de não decidir.
  opcoes: Candidata[];
  motivo: string | null;
  // ÓBICE: as dotações mais próximas.
  proximas: DotacaoMotor[];
};

// A decisão sobre a dotação, separada do resultado do motor: o proponente pode
// escolher entre as opções ou deixar para a análise técnica.
export type Selecao = {
  escolha: Escolha | null;
  dotacaoId: string | null;
};

export type Nivel = "ok" | "warn" | "bad";
// `declaracao`: marcada na seção "Declarações e envio", não na de verificações.
export type Checagem = { nivel: Nivel; titulo: string; detalhe: string; declaracao?: true };
