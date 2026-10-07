// Campos que a importação entende, por tipo de carga, e os nomes de coluna
// que cada prefeitura costuma usar. O cabeçalho da planilha é reconhecido por
// sinônimos; o que não for reconhecido o usuário liga na tela de mapeamento.

export type TipoCarga = "DOTACOES" | "PRIORIDADES_LDO" | "PROGRAMAS_PPA";

export type Campo = { campo: string; rotulo: string; obrigatorio: boolean; sinonimos: string[] };

const c = (campo: string, rotulo: string, obrigatorio: boolean, sinonimos: string[] = []): Campo => ({ campo, rotulo, obrigatorio, sinonimos: [campo, ...sinonimos] });

export const CAMPOS: Record<TipoCarga, Campo[]> = {
  DOTACOES: [
    c("orgao_codigo", "Código do órgão", false, ["orgao", "cod_orgao", "codigo_orgao", "org"]),
    c("orgao_nome", "Nome do órgão", false, ["nome_orgao", "descricao_orgao", "orgao_descricao"]),
    c("unidade_codigo", "Código da unidade", true, ["unidade", "unidade_orcamentaria", "unidade_executora", "cod_unidade", "codigo_unidade", "uo", "ue", "un"]),
    c("unidade_nome", "Nome da unidade", true, ["nome_unidade", "unidade_executora_nome", "unidade_orcamentaria_nome", "descricao_unidade", "unidade_descricao"]),
    c("funcional", "Funcional programática (função.subfunção.programa.ação)", false, ["funcional_programatica", "func_sub_prog", "classificacao_funcional", "programatica"]),
    c("funcao_codigo", "Função", true, ["funcao", "cod_funcao", "codigo_funcao", "func"]),
    c("funcao_nome", "Nome da função", false, ["nome_funcao"]),
    c("subfuncao_codigo", "Subfunção", true, ["subfuncao", "cod_subfuncao", "codigo_subfuncao", "subfunc"]),
    c("subfuncao_nome", "Nome da subfunção", false, ["nome_subfuncao"]),
    c("programa_codigo", "Programa", true, ["programa", "cod_programa", "codigo_programa", "prog"]),
    c("programa_nome", "Nome do programa", true, ["nome_programa", "descricao_programa", "programa_descricao"]),
    c("acao_codigo", "Ação (projeto/atividade)", true, ["acao", "cod_acao", "codigo_acao", "projeto_atividade", "proj_ativ", "pa"]),
    c("acao_nome", "Nome da ação", true, ["nome_acao", "descricao_acao", "acao_descricao", "especificacao"]),
    c("acao_tipo", "Tipo da ação", false, ["tipo_acao"]),
    c("natureza_codigo", "Natureza da despesa", true, ["natureza", "natureza_despesa", "elemento_despesa", "elemento", "categoria_economica", "cod_natureza", "nd"]),
    c("natureza_nome", "Nome da natureza", false, ["nome_natureza", "descricao_natureza", "natureza_descricao", "elemento_nome"]),
    c("fonte_codigo", "Fonte de recurso", true, ["fonte", "fonte_recurso", "cod_fonte", "fonte_de_recurso", "fr"]),
    c("aplicacao_codigo", "Código de aplicação", false, ["aplicacao", "cod_aplicacao", "codigo_aplicacao", "destinacao"]),
    c("fonte_nome", "Nome da fonte", false, ["nome_fonte", "descricao_fonte"]),
    c("ficha", "Ficha", false, ["n_ficha", "numero_ficha", "dotacao_ficha", "reduzido", "cod_reduzido"]),
    c("valor_autorizado", "Valor", true, ["valor", "valor_orcado", "valor_fixado", "dotacao", "total", "valor_total", "fixado", "orcado"]),
    c("pagina", "Página", false, ["pag", "folha"]),
  ],
  PRIORIDADES_LDO: [
    c("programa_codigo", "Programa", true, ["programa", "cod_programa", "codigo_programa"]),
    c("acao_codigo", "Ação", false, ["acao", "cod_acao", "codigo_acao"]),
    c("descricao", "Prioridade ou meta", true, ["prioridade", "meta_prioridade", "descricao_meta", "objetivo", "produto"]),
    c("meta", "Meta física", false, ["meta_fisica", "quantidade", "meta_quantidade"]),
    c("unidade_medida", "Unidade de medida", false, ["unidade_medida_meta", "un_medida"]),
  ],
  PROGRAMAS_PPA: [
    c("programa_codigo", "Programa", true, ["programa", "cod_programa", "codigo_programa"]),
    c("programa_nome", "Nome do programa", true, ["nome_programa", "descricao_programa"]),
    c("acao_codigo", "Ação", false, ["acao", "cod_acao", "codigo_acao"]),
    c("acao_nome", "Nome da ação", false, ["nome_acao", "descricao_acao"]),
    c("unidade_codigo", "Unidade executora", false, ["unidade", "unidade_executora", "uo"]),
    c("produto", "Produto", false, ["produto_acao"]),
    c("unidade_medida", "Unidade de medida", false, ["un_medida"]),
    c("publico", "Público-alvo", false, ["publico_alvo"]),
    c("meta_exercicio", "Meta do exercício", false, ["meta", "meta_ano", "quantidade"]),
    c("meta_ppa", "Meta do PPA (quatro anos)", false, ["meta_total", "meta_quadrienio"]),
  ],
};

export const ROTULO_CARGA: Record<TipoCarga, string> = {
  DOTACOES: "Dotações do orçamento",
  PRIORIDADES_LDO: "Prioridades e metas da LDO",
  PROGRAMAS_PPA: "Programas e metas do PPA",
};

// O tipo de carga sai do instrumento: LOA traz dotações; LDO, prioridades;
// PPA, programas.
export const cargaDoInstrumento = (tipo: "PPA" | "LDO" | "LOA"): TipoCarga =>
  tipo === "LOA" ? "DOTACOES" : tipo === "LDO" ? "PRIORIDADES_LDO" : "PROGRAMAS_PPA";

export const normalizarCabecalho = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    // "Nome da Unidade" = "nome_unidade"; "Fonte de Recurso" = "fonte_recurso".
    .split("_")
    .filter((p, i, l) => !(l.length > 1 && ["de", "da", "do", "das", "dos"].includes(p)))
    .join("_");

// Cabeçalho → campo. Devolve, para cada campo reconhecido, o índice da coluna,
// e a lista dos obrigatórios que ficaram sem coluna.
export function mapearCabecalho(tipo: TipoCarga, cabecalho: string[]): { mapa: Record<string, number>; faltam: string[]; ignoradas: string[] } {
  const norm = cabecalho.map(normalizarCabecalho);
  const mapa: Record<string, number> = {};
  const usados = new Set<number>();
  // Primeiro o nome exato do campo, depois os sinônimos: "unidade_nome" não
  // pode ser tomado por "unidade".
  for (const rodada of [0, 1]) {
    for (const f of CAMPOS[tipo]) {
      if (f.campo in mapa) continue;
      const candidatos = rodada === 0 ? [f.campo] : f.sinonimos;
      const i = norm.findIndex((h, j) => !usados.has(j) && candidatos.includes(h));
      if (i >= 0) {
        mapa[f.campo] = i;
        usados.add(i);
      }
    }
  }
  return { mapa, faltam: faltandoNoMapa(tipo, mapa), ignoradas: cabecalho.filter((_, j) => !usados.has(j)) };
}

// Obrigatórios sem coluna. Na carga de dotações, a funcional programática
// supre função, subfunção, programa e ação.
export function faltandoNoMapa(tipo: TipoCarga, mapa: Record<string, number>): string[] {
  const temFuncional = tipo === "DOTACOES" && "funcional" in mapa;
  const supridos = new Set(temFuncional ? ["funcao_codigo", "subfuncao_codigo", "programa_codigo", "acao_codigo"] : []);
  return CAMPOS[tipo].filter((f) => f.obrigatorio && !(f.campo in mapa) && !supridos.has(f.campo)).map((f) => f.campo);
}

// Linha da planilha (células) → registro por campo, segundo o mapa.
export function aplicarMapa(celulas: string[], mapa: Record<string, number>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [campo, i] of Object.entries(mapa)) r[campo] = String(celulas[i] ?? "").trim();
  return r;
}

// Modelo de planilha para baixar: só o cabeçalho, com os nomes canônicos.
export const cabecalhoModelo = (tipo: TipoCarga) => CAMPOS[tipo].map((f) => f.campo);
