import { BRL } from "@/lib/riep/texto";

// ============================================================================
// Auditoria em linguagem simples: o registro guarda o antes e o depois como
// saíram do banco (nomes técnicos, ids, datas em ISO). Aqui eles viram o que
// uma pessoa lê — só os campos que mudaram, com nome em português, valores
// legíveis e nomes no lugar dos ids. Puro: os nomes dos ids vêm de fora.
// ============================================================================

const ENTIDADES: Record<string, string> = {
  AndamentoExecucao: "Execução da emenda",
  AreaAplicacao: "Área",
  Arquivo: "Arquivo",
  Autor: "Autor",
  ConfiguracaoExercicio: "Parâmetros do exercício",
  ConviteEntidade: "Link da entidade",
  Destino: "Destino",
  DocumentoNormativo: "Norma",
  Emenda: "Emenda",
  EmendaImportada: "Emenda de ano anterior",
  Exercicio: "Exercício",
  FontePrecoOficial: "Fonte de preço",
  Importacao: "Importação",
  InstrumentoPlanejamento: "Instrumento de planejamento",
  LinhaImportada: "Linha da importação",
  Login: "Entrada no sistema",
  Municipio: "Município",
  ObjetoBiblioteca: "Objeto da biblioteca",
  ParecerViabilidade: "Parecer de viabilidade",
  PerfilAcesso: "Perfil",
  PrazoExercicio: "Prazo do exercício",
  RegraValidacao: "Regra de validação",
  TipoDestino: "Tipo de destino",
  User: "Usuário",
};

const ACOES: Record<string, string> = {
  APAGAR_EMENDA_DE_TESTE: "Emenda de teste apagada",
  APLICAR_PLANO_ENTIDADE: "Plano da entidade trazido ao rascunho",
  APROVAR: "Aprovação",
  ATIVAR: "Ativação",
  ATUALIZAR: "Alteração",
  ATUALIZAR_POR_PLANILHA: "Alteração por planilha",
  ATUALIZAR_VALIDACAO: "Alteração dos parâmetros da validação",
  CANCELAR: "Cancelamento",
  CORRIGIR: "Correção",
  CRIAR: "Criação",
  CRIAR_POR_PLANILHA: "Criação por planilha",
  CRIAR_RASCUNHO: "Rascunho criado",
  DEFINIR_SENHA: "Senha redefinida",
  DESATIVAR: "Desativação",
  DESFAZER_INCORPORACAO: "Incorporação à lei desfeita",
  DEVOLVER_AO_AUTOR: "Devolvida ao autor",
  ENVIAR: "Envio de arquivo",
  EXCLUIR: "Exclusão",
  EXCLUIR_RASCUNHO: "Rascunho descartado",
  GERAR_LEI_DO_PROJETO: "Base da lei gerada",
  GERAR_LINK: "Link da entidade gerado",
  IMPORTAR_BASE: "Importação da base",
  IMPORTAR_PPA: "Importação do PPA",
  IMPORTAR_PRIORIDADES: "Importação das prioridades da LDO",
  INCLUIR: "Inclusão",
  INCORPORAR_LEI: "Incorporada à lei",
  LOGIN: "Entrada",
  LOGIN_BLOQUEADO: "Entrada bloqueada (muitas tentativas)",
  LOGIN_RECUSADO: "Senha incorreta",
  LOGIN_RECUSADO_CONTA_INATIVA: "Entrada recusada (conta desativada)",
  LOGOUT: "Saída",
  MANUAL: "Manual orientativo",
  MESCLAR: "Mescla",
  PEDIR_DILIGENCIA: "Pedido de ajuste",
  PLANO_ENVIADO_PELA_ENTIDADE: "Plano enviado pela entidade",
  PORTAL_PUBLICO: "Portal público",
  PRIMEIRO_ACESSO: "Primeiro acesso",
  REABRIR_TRAMITACAO: "Tramitação reaberta",
  REATIVAR: "Reativação",
  REATRIBUIR_PERFIL: "Troca de perfil",
  RECEBER: "Recebida pela Comissão",
  REJEITAR: "Rejeição",
  REMESSA_RECUSADA: "Envio recusado na validação",
  REMETER: "Envio",
  RENOMEAR: "Renomeação",
  REORDENAR: "Mudança de ordem",
  RETOMAR_LEITURA: "Leitura retomada",
  REVOGAR_LINK: "Link da entidade cancelado",
  STATUS: "Mudança de situação",
  SUBMETER: "Envio",
  TOTAL_IMPRESSO: "Total impresso informado",
  TROCAR_PROPRIA_SENHA: "Troca da própria senha",
  VALIDAR: "Validação",
  VINCULAR_AUTOR: "Vínculo com autor",
};

const CAMPOS: Record<string, string> = {
  acao: "Ação",
  agenteExecutor: "Agente executor",
  ano: "Ano",
  apelidos: "Também grafado",
  areaId: "Área",
  arquivoId: "Arquivo",
  arquivoUrl: "Link do documento",
  artigo: "Artigo",
  ativa: "Ativa",
  ativo: "Ativo",
  autorId: "Autor",
  cabecalho: "Cabeçalho",
  cnes: "CNES",
  cnpj: "CNPJ",
  codigo: "Código",
  codigoAplicacao: "Código de aplicação",
  codigoIbge: "Código IBGE",
  cotaIndividual: "Cota individual",
  dataAprovacao: "Data de aprovação",
  dataAto: "Data do ato",
  dataEnvio: "Data de envio",
  dataVigencia: "Início da vigência",
  descricao: "Descrição",
  destinoId: "Destino",
  diligenciaAte: "Prazo do ajuste",
  diligenciaMotivo: "Motivo do ajuste",
  dotacaoId: "Dotação",
  email: "E-mail",
  emendasReapontadas: "Emendas transferidas",
  ementa: "Ementa",
  endereco: "Endereço",
  especie: "Espécie",
  estrito: "Só na própria área",
  execucao: "Execução",
  exercicioId: "Exercício",
  explicacao: "Explicação",
  fonteAudesp: "Fonte AUDESP",
  fontePopulacao: "Fonte da população",
  fundamento: "Fundamento",
  fundamentos: "Fundamentos",
  incorporadaEm: "Incorporada à lei em",
  inep: "INEP",
  instrumentoId: "Instrumento",
  instrumentoOrigemId: "Projeto de lei de origem",
  justificativa: "Justificativa",
  manter: "Fica",
  mantido: "Mantido",
  manualAtoId: "Ato que institui o manual",
  manualPublicadoEm: "Manual publicado em",
  mescladoEmId: "Mesclado em",
  modo: "Modo",
  motivo: "Motivo",
  name: "Nome",
  natureza: "Natureza",
  nome: "Nome",
  nomeCamara: "Nome da Câmara",
  nomeOficial: "Nome oficial",
  nomePrefeitura: "Nome da Prefeitura",
  normaId: "Norma",
  numero: "Número",
  objeto: "Objeto",
  orgaos: "Órgãos",
  ordem: "Ordem",
  padrao: "Palavras que identificam",
  parcela: "Parcela da cota",
  parecerTramitacao: "Parecer da Comissão",
  percentualSaude: "Percentual da saúde",
  perfilId: "Perfil",
  pistas: "Pistas",
  populacaoReferencia: "População de referência",
  portalPublico: "Portal público ligado",
  prazoDiligenciaDias: "Prazo padrão do ajuste (dias)",
  prazoProtocolo: "Fim do protocolo",
  pretendido: "Valor pretendido",
  publico: "Público",
  removido: "Removido",
  responsavelCargo: "Cargo do responsável",
  responsavelNome: "Responsável",
  rotulo: "Nome",
  senha: "Senha",
  situacao: "Situação",
  situacoesEmendamento: "Situações que recebem emendas",
  status: "Situação",
  subfuncao: "Subfunção",
  subfuncaoSugerida: "Subfunção sugerida",
  telefone: "Telefone",
  termos: "Termos",
  tipo: "Tipo",
  titulo: "Título",
  toleranciaValorPct: "Tolerância do valor (%)",
  totalImpresso: "Total impresso",
  trecho: "Trecho",
  uf: "UF",
  unidadeCodigo: "Unidade",
  unidadePadrao: "Unidade padrão",
  unidadeRepasseCodigo: "Unidade de repasse",
  uo: "Unidade",
  url: "Link",
  usuarioId: "Usuário",
  validadeLinkEntidadeDias: "Validade do link da entidade (dias)",
  validadeReferenciaMeses: "Validade da referência de preço (meses)",
  valor: "Valor",
  vigenciaFim: "Fim da vigência",
};

// Nunca aparecem: identificadores, carimbos técnicos e segredos.
const OCULTOS = new Set(["id", "createdAt", "updatedAt", "criadoEm", "atualizadoEm", "passwordHash", "criadoPorId", "enviadoPorId", "revisao", "sha256", "chave", "origem"]);

// Campos em reais.
const DINHEIRO = /^(valor|cotaIndividual|pretendido|totalImpresso|autorizado|empenhado|liquidado|pago|valor[A-Z].*)$/;

const ID = /^c[a-z0-9]{20,}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export const humanizar = (s: string) => {
  const t = s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1) : s;
};

export const rotuloEntidade = (e: string) => ENTIDADES[e] ?? humanizar(e);
export const rotuloAcao = (a: string) => ACOES[a] ?? humanizar(a);
export const rotuloCampo = (c: string) => CAMPOS[c] ?? humanizar(c.replace(/Id$/, ""));


function dataHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Data pura (gravada ao meio-dia ou à meia-noite UTC): só o dia.
  if (/T(00|12):00:00(\.000)?Z$/.test(iso)) return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Um valor como uma pessoa lê.
export function valorLegivel(campo: string, v: unknown, nomes: Record<string, string> = {}): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return DINHEIRO.test(campo) ? BRL(v) : v.toLocaleString("pt-BR");
  if (typeof v === "string") {
    if (ID.test(v)) return nomes[v] ?? "—";
    if (ISO.test(v)) return dataHora(v);
    if (DINHEIRO.test(campo) && /^-?\d+(\.\d+)?$/.test(v)) return BRL(Number(v));
    // Códigos de situação e afins ("EM_TRAMITACAO", "DIRETA").
    if (/^[A-Z][A-Z0-9_]+$/.test(v) && v.length > 3) return humanizar(v);
    return v;
  }
  if (Array.isArray(v)) {
    if (!v.length) return "—";
    if (v.every((x) => typeof x !== "object" || x === null)) return v.map((x) => valorLegivel(campo, x, nomes)).join(", ");
    return `${v.length} ${v.length === 1 ? "item" : "itens"}`;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const nome = o.nome ?? o.titulo ?? o.rotulo ?? o.name;
    return typeof nome === "string" ? nome : "(dados agrupados)";
  }
  return String(v);
}

const objeto = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : x == null ? {} : { valor: x });
const ehObjeto = (x: unknown) => !!x && typeof x === "object" && !Array.isArray(x);

export type LinhaLegivel = { campo: string; antes: string; depois: string };
export type GrupoLegivel = { titulo: string | null; linhas: LinhaLegivel[] };

// Só o que mudou. Na criação (sem antes) e na exclusão (sem depois), todos os
// campos preenchidos. Objetos aninhados (a mescla guarda "mantido" e
// "removido") viram grupos com título.
export function diferencaLegivel(antes: unknown, depois: unknown, nomes: Record<string, string> = {}): GrupoLegivel[] {
  const a = objeto(antes);
  const d = objeto(depois);
  const grupos: GrupoLegivel[] = [];
  const soltas: LinhaLegivel[] = [];
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(d)])].filter((k) => !OCULTOS.has(k));
  for (const k of chaves) {
    if (ehObjeto(a[k]) || ehObjeto(d[k])) {
      const sub = diferencaLegivel(a[k] ?? null, d[k] ?? null, nomes).flatMap((g) => g.linhas);
      if (sub.length) grupos.push({ titulo: rotuloCampo(k), linhas: sub });
      continue;
    }
    // Id sem nome conhecido: não diz nada a quem lê.
    const idSemNome = (v: unknown) => typeof v === "string" && ID.test(v) && !nomes[v];
    const nada = (v: unknown) => v === undefined || v === null || idSemNome(v);
    if (nada(a[k]) && nada(d[k]) && (idSemNome(a[k]) || idSemNome(d[k]))) continue;
    const va = valorLegivel(k, a[k], nomes);
    const vd = valorLegivel(k, d[k], nomes);
    if (va === vd) continue;
    soltas.push({ campo: rotuloCampo(k), antes: va, depois: vd });
  }
  return soltas.length ? [{ titulo: null, linhas: soltas }, ...grupos] : grupos;
}

// Nome do registro, para o cabeçalho da janela ("Destino · Associação Ágape").
export function nomeDoRegistro(antes: unknown, depois: unknown): string | null {
  for (const x of [objeto(depois), objeto(antes)]) {
    for (const k of ["nome", "titulo", "rotulo", "name", "objeto", "numero"]) {
      const v = x[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return `nº ${v}`;
    }
    const m = objeto(x.mantido);
    if (typeof m.nome === "string") return m.nome;
  }
  return null;
}

// Ids que aparecem no antes e no depois (para buscar os nomes no banco).
export function idsDoRegistro(antes: unknown, depois: unknown): string[] {
  const out = new Set<string>();
  const visitar = (x: unknown) => {
    if (typeof x === "string" && ID.test(x)) out.add(x);
    else if (Array.isArray(x)) x.forEach(visitar);
    else if (x && typeof x === "object") Object.entries(x as Record<string, unknown>).forEach(([k, v]) => k !== "id" && visitar(v));
  };
  visitar(antes);
  visitar(depois);
  return [...out];
}
