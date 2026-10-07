import { orgaoDaUnidade, pertence } from "@/lib/riep/destino";
import { nomeElemento, nomeFuncao, nomeSubfuncao } from "./tabelas";

// ============================================================================
// Importação da base orçamentária. Puro: recebe cada linha já lida (campo →
// texto) e devolve a linha validada ou os motivos da recusa. A linha com
// componente ausente é recusada sozinha; as demais seguem. A gravação fica na
// ação do servidor.
// ============================================================================

export type LinhaDotacao = {
  orgao: { codigo: string; nome: string };
  unidade: { codigo: string; nome: string };
  funcao: { codigo: string; nome: string };
  subfuncao: { codigo: string; nome: string };
  programa: { codigo: string; nome: string };
  acao: { codigo: string; nome: string; tipo: "PROJETO" | "ATIVIDADE" | "OPERACAO_ESPECIAL" };
  natureza: { codigo: string; categoria: string; grupo: string; modalidade: string; elemento: string; nome: string | null };
  fonte: { codigo: string; nome: string };
  ficha: string | null;
  valor: number;
  pagina: number | null;
};

export type LinhaPrioridade = { programa: string; acao: string | null; descricao: string; meta: number | null; unidadeMedida: string | null };

export type LinhaProgramaPpa = {
  programa: { codigo: string; nome: string };
  acao: { codigo: string; nome: string | null } | null;
  unidade: string | null;
  produto: string | null;
  unidadeMedida: string | null;
  publico: string | null;
  metaExercicio: number | null;
  metaPpa: number | null;
};

// O que já existe no exercício: supre nomes ausentes e confere a integridade
// das cargas da LDO e do PPA.
export type BaseExistente = {
  orgaos: Record<string, string>;
  unidades: Record<string, string>;
  programas: Record<string, string>;
  // "programa|ação" → nome
  acoes: Record<string, string>;
};

export const baseVazia = (): BaseExistente => ({ orgaos: {}, unidades: {}, programas: {}, acoes: {} });

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivos: string[] };

// Valor monetário: "1.234,56", "1234.56", "1,234.56", "R$ 1.000". Ponto só é
// milhar quando seguido de três dígitos e sem vírgula decimal.
export function lerValor(bruto: string): number | null {
  let s = String(bruto ?? "").replace(/R\$|\s/g, "");
  if (!s) return null;
  if (/^-?\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) s = s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

const t = (v: string | undefined) => String(v ?? "").trim();
const digitos = (v: string | undefined) => t(v).replace(/\D/g, "");

function tipoAcao(bruto: string | undefined, codigo: string): LinhaDotacao["acao"]["tipo"] | null {
  const s = t(bruto).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
  if (s === "PROJETO" || s === "ATIVIDADE" || s === "OPERACAO_ESPECIAL") return s;
  if (s === "P") return "PROJETO";
  if (s === "A") return "ATIVIDADE";
  if (s === "OE" || s === "O") return "OPERACAO_ESPECIAL";
  if (s) return null;
  // Numeração padrão: 1xxx projeto, 2xxx atividade, demais operação especial.
  return codigo.startsWith("1") ? "PROJETO" : codigo.startsWith("2") ? "ATIVIDADE" : "OPERACAO_ESPECIAL";
}

// "4.4.90.52", "44905200", "4.4.90.52.00" → partes.
export function lerNatureza(bruto: string | undefined) {
  const s = t(bruto);
  const m = s.match(/^(\d)\.(\d)\.(\d{2})\.(\d{2})/);
  const d = s.replace(/\D/g, "");
  const p = m ? [m[1], m[2], m[3], m[4]] : d.length >= 6 ? [d[0], d[1], d.slice(2, 4), d.slice(4, 6)] : null;
  if (!p) return null;
  const [categoria, grupo, modalidade, elemento] = p;
  if (!["3", "4", "9"].includes(categoria) || !/^[1-69]$/.test(grupo)) return null;
  return { categoria, grupo, modalidade, elemento, codigo: `${categoria}.${grupo}.${modalidade}.${elemento}` };
}

// "04.122.0002.2015" ou "04122 0002 2015" → função, subfunção, programa, ação.
export function lerFuncional(bruto: string | undefined) {
  const s = t(bruto);
  const m = s.match(/^(\d{2})\.(\d{3})\.(\d{3,4})\.(\d{4})$/) ?? s.replace(/\D/g, "").match(/^(\d{2})(\d{3})(\d{4})(\d{4})$/);
  return m ? { funcao: m[1], subfuncao: m[2], programa: m[3], acao: m[4] } : null;
}

export function validarDotacao(r: Record<string, string>, base: BaseExistente = baseVazia()): Resultado<LinhaDotacao> {
  const motivos: string[] = [];
  const funcional = t(r.funcional) ? lerFuncional(r.funcional) : null;
  if (t(r.funcional) && !funcional) motivos.push(`Funcional programática "${t(r.funcional)}" fora do formato 00.000.0000.0000.`);

  const unidade = t(r.unidade_codigo);
  const funcaoD = digitos(r.funcao_codigo) || funcional?.funcao || "";
  const subfuncaoD = digitos(r.subfuncao_codigo) || funcional?.subfuncao || "";
  const funcao = funcaoD ? funcaoD.padStart(2, "0") : "";
  const subfuncao = subfuncaoD ? subfuncaoD.padStart(3, "0") : "";
  const programa = digitos(r.programa_codigo) || funcional?.programa || "";
  const acao = digitos(r.acao_codigo) || funcional?.acao || "";
  const natureza = lerNatureza(r.natureza_codigo);
  const fonteBase = t(r.fonte_codigo);
  const valor = lerValor(r.valor_autorizado);

  if (!unidade) motivos.push("Unidade ausente.");
  if (!funcao) motivos.push("Função ausente.");
  if (!subfuncao) motivos.push("Subfunção ausente.");
  if (!programa) motivos.push("Programa ausente.");
  if (!acao) motivos.push("Ação ausente.");
  if (!t(r.natureza_codigo)) motivos.push("Natureza da despesa ausente.");
  else if (!natureza) motivos.push(`Natureza da despesa "${t(r.natureza_codigo)}" inválida (use 3.3.90.30).`);
  if (!fonteBase) motivos.push("Fonte de recurso ausente.");
  if (!t(r.valor_autorizado)) motivos.push("Valor ausente.");
  else if (valor === null) motivos.push(`Valor "${t(r.valor_autorizado)}" inválido.`);
  else if (valor < 0) motivos.push("Valor negativo.");

  // Órgão: a unidade sem o último segmento. O órgão informado só confere.
  const orgaoInformado = t(r.orgao_codigo);
  const orgao = unidade.includes(".") ? orgaoDaUnidade(unidade) : orgaoInformado || unidade;
  if (unidade && orgaoInformado && orgaoInformado !== orgao && !pertence(unidade, orgaoInformado)) {
    motivos.push(`A unidade ${unidade} não pertence ao órgão ${orgaoInformado}.`);
  }
  const unidadeNome = t(r.unidade_nome) || base.unidades[unidade] || "";
  // O quadro de despesa muitas vezes não imprime o nome do programa (só o
  // código na funcional): fica um nome provisório, que a carga do PPA completa.
  const programaNome = t(r.programa_nome) || base.programas[programa] || (programa ? `Programa ${programa}` : "");
  const acaoNome = t(r.acao_nome) || base.acoes[`${programa}|${acao}`] || "";
  if (unidade && !unidadeNome) motivos.push(`Nome da unidade ${unidade} ausente.`);
  if (acao && !acaoNome) motivos.push(`Nome da ação ${acao} ausente.`);
  const tipo = tipoAcao(r.acao_tipo, acao);
  if (!tipo) motivos.push(`Tipo da ação "${t(r.acao_tipo)}" inválido (projeto, atividade ou operação especial).`);
  const paginaD = digitos(r.pagina);
  const pagina = paginaD ? Number(paginaD) : null;

  if (motivos.length) return { ok: false, motivos };
  const aplicacao = t(r.aplicacao_codigo);
  const fonte = aplicacao ? `${/^\d$/.test(fonteBase) ? fonteBase.padStart(2, "0") : fonteBase}.${aplicacao}` : fonteBase;
  const orgaoNome = (orgaoInformado === orgao ? t(r.orgao_nome) : "") || base.orgaos[orgao] || unidadeNome;
  return {
    ok: true,
    valor: {
      orgao: { codigo: orgao, nome: orgaoNome },
      unidade: { codigo: unidade, nome: unidadeNome },
      funcao: { codigo: funcao, nome: t(r.funcao_nome) || nomeFuncao(funcao) || `Função ${funcao}` },
      subfuncao: { codigo: subfuncao, nome: t(r.subfuncao_nome) || nomeSubfuncao(subfuncao) || `Subfunção ${subfuncao}` },
      programa: { codigo: programa, nome: programaNome },
      acao: { codigo: acao, nome: acaoNome, tipo: tipo! },
      natureza: { ...natureza!, nome: t(r.natureza_nome) || nomeElemento(natureza!.elemento) },
      fonte: { codigo: fonte, nome: t(r.fonte_nome) || `Fonte ${fonte}` },
      ficha: digitos(r.ficha) || null,
      valor: valor!,
      pagina,
    },
  };
}

export function validarPrioridade(r: Record<string, string>, base: BaseExistente): Resultado<LinhaPrioridade> {
  const motivos: string[] = [];
  const programa = digitos(r.programa_codigo);
  const acao = digitos(r.acao_codigo) || null;
  if (!programa) motivos.push("Programa ausente.");
  else if (!base.programas[programa]) motivos.push(`O programa ${programa} não existe na base do exercício.`);
  if (programa && acao && base.programas[programa] && !base.acoes[`${programa}|${acao}`]) motivos.push(`A ação ${acao} não existe no programa ${programa}.`);
  if (!t(r.descricao)) motivos.push("Descrição da prioridade ausente.");
  const meta = t(r.meta) ? lerValor(r.meta) : null;
  if (t(r.meta) && meta === null) motivos.push(`Meta "${t(r.meta)}" inválida.`);
  if (motivos.length) return { ok: false, motivos };
  return { ok: true, valor: { programa, acao, descricao: t(r.descricao), meta, unidadeMedida: t(r.unidade_medida) || null } };
}

export function validarProgramaPpa(r: Record<string, string>, base: BaseExistente): Resultado<LinhaProgramaPpa> {
  const motivos: string[] = [];
  const programa = digitos(r.programa_codigo);
  const acao = digitos(r.acao_codigo);
  const unidade = t(r.unidade_codigo) || null;
  if (!programa) motivos.push("Programa ausente.");
  if (programa && !t(r.programa_nome) && !base.programas[programa]) motivos.push("Nome do programa ausente.");
  if (unidade && !base.unidades[unidade]) motivos.push(`A unidade ${unidade} não existe na base do exercício.`);
  const metaExercicio = t(r.meta_exercicio) ? lerValor(r.meta_exercicio) : null;
  const metaPpa = t(r.meta_ppa) ? lerValor(r.meta_ppa) : null;
  if (t(r.meta_exercicio) && metaExercicio === null) motivos.push(`Meta do exercício "${t(r.meta_exercicio)}" inválida.`);
  if (t(r.meta_ppa) && metaPpa === null) motivos.push(`Meta do PPA "${t(r.meta_ppa)}" inválida.`);
  if (motivos.length) return { ok: false, motivos };
  return {
    ok: true,
    valor: {
      programa: { codigo: programa, nome: t(r.programa_nome) || base.programas[programa] },
      acao: acao ? { codigo: acao, nome: t(r.acao_nome) || base.acoes[`${programa}|${acao}`] || null } : null,
      unidade,
      produto: t(r.produto) || null,
      unidadeMedida: t(r.unidade_medida) || null,
      publico: t(r.publico) || null,
      metaExercicio,
      metaPpa,
    },
  };
}

// ---------------------------------------------------------------- conferência

type Soma = { codigo: string; nome: string; valor: number; linhas: number };
export type Totais = { totalLido: number; linhas: number; porOrgao: Soma[]; porUnidade: Soma[] };

const centavos = (v: number) => Math.round(v * 100);

export function totalizar(dotacoes: Pick<LinhaDotacao, "orgao" | "unidade" | "valor">[]): Totais {
  const org = new Map<string, Soma>();
  const uni = new Map<string, Soma>();
  let total = 0;
  const somar = (m: Map<string, Soma>, codigo: string, nome: string, v: number) => {
    const s = m.get(codigo) ?? { codigo, nome, valor: 0, linhas: 0 };
    s.valor += v;
    s.linhas++;
    m.set(codigo, s);
  };
  for (const d of dotacoes) {
    const v = centavos(d.valor);
    total += v;
    somar(org, d.orgao.codigo, d.orgao.nome, v);
    somar(uni, d.unidade.codigo, d.unidade.nome, v);
  }
  const reais = (m: Map<string, Soma>) => [...m.values()].map((x) => ({ ...x, valor: x.valor / 100 })).sort((a, b) => (a.codigo < b.codigo ? -1 : 1));
  return { totalLido: total / 100, linhas: dotacoes.length, porOrgao: reais(org), porUnidade: reais(uni) };
}

// O total lido bate com o impresso na peça? Sem total impresso, não se confirma.
export function conferirTotal(totalLido: number, totalImpresso: number | null): { bate: boolean; diferenca: number | null } {
  if (totalImpresso === null) return { bate: false, diferenca: null };
  const dif = (centavos(totalLido) - centavos(totalImpresso)) / 100;
  return { bate: dif === 0, diferenca: dif };
}

// ---------------------------------------------------------------- recarga

export type DotacaoExistente = {
  id: string;
  unidade: string;
  programa: string;
  acao: string;
  natureza: string;
  fonte: string;
  ficha: string | null;
  valor: number;
  // Emendas (número ou "rascunho") que apontam para ela.
  emendas: string[];
};

export type PlanoRecarga = {
  atualizar: { id: string; indice: number; mudouClassificacao: boolean; mudouValor: boolean }[];
  criar: number[];
  desativar: string[];
  travas: { id: string; motivo: string }[];
};

const classe = (d: { unidade: string; programa: string; acao: string; natureza: string; fonte: string }) =>
  `${d.unidade}|${d.programa}|${d.acao}|${d.natureza}|${d.fonte}`;

// Recarga sem apagar: cada linha nova encontra a existente pela ficha (na
// mesma unidade) ou pela classificação completa. A existente que some, ou que
// muda de classificação, trava a recarga se alguma emenda aponta para ela.
export function planejarRecarga(existentes: DotacaoExistente[], novas: LinhaDotacao[]): PlanoRecarga {
  const plano: PlanoRecarga = { atualizar: [], criar: [], desativar: [], travas: [] };
  const usadas = new Set<string>();
  const porFicha = new Map(existentes.filter((e) => e.ficha).map((e) => [`${e.unidade}|${e.ficha}`, e]));
  const porClasse = new Map<string, DotacaoExistente[]>();
  for (const e of existentes) porClasse.set(classe(e), [...(porClasse.get(classe(e)) ?? []), e]);

  novas.forEach((n, indice) => {
    const nc = { unidade: n.unidade.codigo, programa: n.programa.codigo, acao: n.acao.codigo, natureza: n.natureza.codigo, fonte: n.fonte.codigo };
    let e = n.ficha ? porFicha.get(`${nc.unidade}|${n.ficha}`) : undefined;
    if (e && usadas.has(e.id)) e = undefined;
    if (!e) e = (porClasse.get(classe(nc)) ?? []).find((x) => !usadas.has(x.id));
    if (!e) return void plano.criar.push(indice);
    usadas.add(e.id);
    const mudouClassificacao = classe(e) !== classe(nc);
    const mudouValor = centavos(e.valor) !== centavos(n.valor);
    plano.atualizar.push({ id: e.id, indice, mudouClassificacao, mudouValor });
    if (mudouClassificacao && e.emendas.length) {
      plano.travas.push({ id: e.id, motivo: `A ficha ${e.ficha ?? "sem número"} mudaria de classificação e tem emenda: ${e.emendas.join(", ")}.` });
    }
  });
  for (const e of existentes) {
    if (usadas.has(e.id)) continue;
    plano.desativar.push(e.id);
    if (e.emendas.length) plano.travas.push({ id: e.id, motivo: `A ficha ${e.ficha ?? "sem número"} sairia da base e tem emenda: ${e.emendas.join(", ")}.` });
  }
  return plano;
}
