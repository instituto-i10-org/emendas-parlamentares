import { chaveNome } from "@/lib/emendas/beneficiarios";
import { normalizarCabecalho } from "@/lib/orcamento/colunas";
import { lerValor } from "@/lib/orcamento/importacao";
import { decodificarTexto, detectarSeparador, lerCsv, lerXlsx } from "@/lib/orcamento/planilha";

// ============================================================================
// Planilhas de cadastro: destinos em lote e emendas de anos anteriores. Puro:
// leitura (CSV em UTF-8 ou Windows-1252, separador detectado, ou XLSX),
// cabeçalho reconhecido por nome ou sinônimo, validação linha a linha e o
// plano do que se grava (novo, atualizado, recusado). Nada se grava aqui: a
// tela mostra a conferência e a ação grava só depois da confirmação.
// ============================================================================

export type CampoPlanilha = { campo: string; rotulo: string; obrigatorio: boolean; sinonimos: string[] };

const c = (campo: string, rotulo: string, obrigatorio: boolean, sinonimos: string[] = []): CampoPlanilha => ({ campo, rotulo, obrigatorio, sinonimos });

export const CAMPOS_DESTINOS: CampoPlanilha[] = [
  c("nome", "Nome", true, ["destino", "beneficiario", "nome_destino", "nome_beneficiario", "equipamento", "entidade"]),
  c("nome_oficial", "Nome oficial", false, ["razao_social", "nome_cadastro"]),
  c("execucao", "Execução (direta ou indireta)", true, ["forma_execucao", "tipo_execucao", "tipo"]),
  c("unidade", "Unidade (execução direta)", false, ["unidade_orcamentaria", "uo", "codigo_unidade", "unidade_codigo"]),
  c("unidade_repasse", "Unidade de repasse (execução indireta)", false, ["secretaria_repasse", "unidade_repassadora", "repasse"]),
  c("endereco", "Endereço", true, ["logradouro", "local"]),
  c("cnpj", "CNPJ", false, ["cnpj_entidade"]),
  c("cnes", "CNES", false, ["codigo_cnes"]),
  c("inep", "INEP", false, ["codigo_inep"]),
  c("populacao", "População de referência", false, ["populacao_referencia", "publico", "atendidos"]),
  c("fonte_populacao", "Fonte da população", false, ["fonte_populacao_referencia"]),
];

export const CAMPOS_HISTORICO: CampoPlanilha[] = [
  c("ano", "Ano", true, ["exercicio", "ano_exercicio"]),
  c("numero", "Número", true, ["n", "numero_emenda", "emenda"]),
  c("autor", "Autor (vereador)", true, ["vereador", "nome_autor", "parlamentar"]),
  c("descricao", "Descrição", true, ["objeto", "destino", "texto"]),
  c("valor", "Valor", true, ["valor_emenda", "total"]),
  c("parcela", "Parcela (saúde ou demais)", false, ["area", "parcela_cota"]),
];

export type Tabela = { cabecalho: string[]; linhas: { numero: number; celulas: string[] }[]; mapa: Record<string, number>; faltam: string[] };

export function mapear(campos: CampoPlanilha[], cabecalho: string[]): { mapa: Record<string, number>; faltam: string[] } {
  const norm = cabecalho.map(normalizarCabecalho);
  const mapa: Record<string, number> = {};
  const usados = new Set<number>();
  for (const rodada of [0, 1]) {
    for (const f of campos) {
      if (f.campo in mapa) continue;
      const candidatos = rodada === 0 ? [f.campo] : f.sinonimos;
      const i = norm.findIndex((h, j) => !usados.has(j) && candidatos.includes(h));
      if (i >= 0) {
        mapa[f.campo] = i;
        usados.add(i);
      }
    }
  }
  return { mapa, faltam: campos.filter((f) => f.obrigatorio && !(f.campo in mapa)).map((f) => f.rotulo) };
}

export function lerTabela(campos: CampoPlanilha[], nomeArquivo: string, bytes: Uint8Array): Tabela {
  const ext = nomeArquivo.toLowerCase().split(".").pop();
  let celulas: string[][];
  if (ext === "csv" || ext === "txt") {
    const { texto } = decodificarTexto(bytes);
    celulas = lerCsv(texto, detectarSeparador(texto));
  } else {
    celulas = lerXlsx(bytes);
  }
  // Cabeçalho: entre as 20 primeiras linhas, a que mais casa com os campos.
  let i = 0;
  let melhor = -1;
  for (let k = 0; k < Math.min(20, celulas.length); k++) {
    const n = Object.keys(mapear(campos, celulas[k]).mapa).length;
    if (n > melhor) {
      melhor = n;
      i = k;
    }
  }
  const cabecalho = (celulas[i] ?? []).map((x) => String(x).trim());
  const { mapa, faltam } = mapear(campos, cabecalho);
  const linhas = celulas
    .slice(i + 1)
    .map((cel, k) => ({ numero: i + 2 + k, celulas: cel.map((x) => String(x).trim()) }))
    .filter((l) => l.celulas.some(Boolean));
  return { cabecalho, linhas, mapa, faltam };
}

const valor = (l: { celulas: string[] }, mapa: Record<string, number>, campo: string) => (campo in mapa ? String(l.celulas[mapa[campo]] ?? "").trim() : "");

// Modelo para baixar: cabeçalho com os nomes canônicos, CSV com ponto e
// vírgula e marca de ordem (abre certo no Excel em português).
export const modeloCsv = (campos: CampoPlanilha[]) => "﻿" + campos.map((f) => f.campo).join(";") + "\r\n";

// --- destinos ---------------------------------------------------------------

export type DestinoPlanilha = {
  nome: string;
  nomeOficial: string | null;
  execucao: "DIRETA" | "INDIRETA";
  unidadeCodigo: string | null;
  unidadeRepasseCodigo: string | null;
  endereco: string;
  cnpj: string | null;
  cnes: string | null;
  inep: string | null;
  populacaoReferencia: number | null;
  fontePopulacao: string | null;
};

export type DestinoExistente = DestinoPlanilha & { id: string; ativo: boolean; apelidos?: string[] };

export type Recusa = { linha: number; motivos: string[]; conteudo: string };
export type Mudanca = { campo: string; antes: string; depois: string };

export type PlanoDestinos = {
  novos: { linha: number; dados: DestinoPlanilha }[];
  // O nome cadastrado não muda: a grafia da planilha, se diferente, vira apelido.
  atualizados: { linha: number; id: string; nome: string; dados: DestinoPlanilha; apelido: string | null; mudancas: Mudanca[] }[];
  semMudanca: { linha: number; nome: string }[];
  recusados: Recusa[];
  faltam: string[];
};

const UNIDADE = /^\d{1,4}(\.\d{1,4}){0,2}$/;

function execucaoDe(v: string): "DIRETA" | "INDIRETA" | null {
  const s = normalizarCabecalho(v);
  if (["direta", "d", "execucao_direta", "poder_executivo", "administracao_direta"].includes(s)) return "DIRETA";
  if (["indireta", "i", "execucao_indireta", "osc", "terceiro_setor", "entidade"].includes(s)) return "INDIRETA";
  return null;
}

export function validarDestino(r: Record<string, string>, unidades: Set<string>): { ok: true; valor: DestinoPlanilha } | { ok: false; motivos: string[] } {
  const motivos: string[] = [];
  const nome = r.nome?.trim() ?? "";
  if (nome.length < 3) motivos.push("Nome ausente ou curto demais.");
  const execucao = execucaoDe(r.execucao ?? "");
  if (!execucao) motivos.push("Execução precisa ser “direta” ou “indireta”.");
  const unidade = (r.unidade ?? "").trim() || null;
  const repasse = (r.unidade_repasse ?? "").trim() || null;
  if (execucao === "DIRETA") {
    if (!unidade) motivos.push("Execução direta precisa da unidade orçamentária.");
    else if (!UNIDADE.test(unidade)) motivos.push(`Unidade “${unidade}” fora do formato (ex.: 13.01).`);
    else if (unidades.size && ![...unidades].some((u) => u === unidade || u.startsWith(unidade + "."))) motivos.push(`Unidade ${unidade} não existe no exercício em uso.`);
  }
  if (repasse && !UNIDADE.test(repasse)) motivos.push(`Unidade de repasse “${repasse}” fora do formato (ex.: 14.01).`);
  const endereco = r.endereco?.trim() ?? "";
  if (endereco.length < 5) motivos.push("Endereço ausente.");
  const cnpj = (r.cnpj ?? "").replace(/\D/g, "") || null;
  if (cnpj && cnpj.length !== 14) motivos.push("CNPJ precisa ter 14 dígitos.");
  const popTxt = (r.populacao ?? "").replace(/\D/g, "");
  const populacao = popTxt ? Number(popTxt) : null;
  if (motivos.length || !execucao) return { ok: false, motivos };
  return {
    ok: true,
    valor: {
      nome,
      nomeOficial: r.nome_oficial?.trim() || null,
      execucao,
      unidadeCodigo: execucao === "DIRETA" ? unidade : null,
      unidadeRepasseCodigo: execucao === "INDIRETA" ? repasse : null,
      endereco,
      cnpj,
      cnes: (r.cnes ?? "").replace(/\D/g, "") || null,
      inep: (r.inep ?? "").replace(/\D/g, "") || null,
      populacaoReferencia: populacao,
      fontePopulacao: r.fonte_populacao?.trim() || null,
    },
  };
}

const ROTULOS_DESTINO: Record<keyof DestinoPlanilha, string> = {
  nome: "Nome",
  nomeOficial: "Nome oficial",
  execucao: "Execução",
  unidadeCodigo: "Unidade",
  unidadeRepasseCodigo: "Unidade de repasse",
  endereco: "Endereço",
  cnpj: "CNPJ",
  cnes: "CNES",
  inep: "INEP",
  populacaoReferencia: "População de referência",
  fontePopulacao: "Fonte da população",
};

const txt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

// O que a linha muda no cadastro existente. Campo vazio na planilha não apaga
// o que já está cadastrado.
export function mudancasDestino(antes: DestinoPlanilha, depois: DestinoPlanilha): Mudanca[] {
  const out: Mudanca[] = [];
  for (const k of Object.keys(ROTULOS_DESTINO) as (keyof DestinoPlanilha)[]) {
    const d = depois[k];
    if (d === null || d === "") continue;
    if (String(antes[k] ?? "") !== String(d)) out.push({ campo: ROTULOS_DESTINO[k], antes: txt(antes[k]), depois: txt(d) });
  }
  return out;
}

// Mescla: o vazio da planilha mantém o valor cadastrado.
export const mesclarDestino = (antes: DestinoPlanilha, depois: DestinoPlanilha): DestinoPlanilha =>
  Object.fromEntries((Object.keys(ROTULOS_DESTINO) as (keyof DestinoPlanilha)[]).map((k) => [k, depois[k] === null || depois[k] === "" ? antes[k] : depois[k]])) as DestinoPlanilha;

// Destino já cadastrado: mesmo CNPJ, ou mesmo nome (pela chave que ignora
// acentos, caixa e abreviações) com a mesma forma de execução. É atualizado,
// não duplicado.
export function planejarDestinos(tabela: Tabela, existentes: DestinoExistente[], unidades: Set<string>): PlanoDestinos {
  const plano: PlanoDestinos = { novos: [], atualizados: [], semMudanca: [], recusados: [], faltam: tabela.faltam };
  if (tabela.faltam.length) return plano;
  const porCnpj = new Map(existentes.filter((e) => e.cnpj).map((e) => [e.cnpj!, e]));
  const porNome = new Map(existentes.map((e) => [`${e.execucao}|${chaveNome(e.nome)}`, e]));
  const vistos = new Set<string>();
  for (const l of tabela.linhas) {
    const r = Object.fromEntries(Object.keys(tabela.mapa).map((k) => [k, valor(l, tabela.mapa, k)]));
    const v = validarDestino(r, unidades);
    const conteudo = l.celulas.join(" · ").slice(0, 300);
    if (!v.ok) {
      plano.recusados.push({ linha: l.numero, motivos: v.motivos, conteudo });
      continue;
    }
    const chave = `${v.valor.execucao}|${chaveNome(v.valor.nome)}`;
    const chaveLinha = v.valor.cnpj ? `cnpj:${v.valor.cnpj}` : chave;
    if (vistos.has(chaveLinha) || vistos.has(chave)) {
      plano.recusados.push({ linha: l.numero, motivos: ["Repetido em outra linha desta planilha."], conteudo });
      continue;
    }
    vistos.add(chaveLinha);
    vistos.add(chave);
    const existente = (v.valor.cnpj ? porCnpj.get(v.valor.cnpj) : undefined) ?? porNome.get(chave);
    if (!existente) {
      plano.novos.push({ linha: l.numero, dados: v.valor });
      continue;
    }
    const dados = { ...v.valor, nome: existente.nome };
    const mudancas = mudancasDestino(existente, dados);
    const grafias = [existente.nome, ...(existente.apelidos ?? [])].map((x) => x.trim().toLocaleLowerCase("pt-BR"));
    const apelido = grafias.includes(v.valor.nome.trim().toLocaleLowerCase("pt-BR")) ? null : v.valor.nome;
    if (apelido) mudancas.push({ campo: "Também grafado", antes: "—", depois: apelido });
    if (!mudancas.length) plano.semMudanca.push({ linha: l.numero, nome: existente.nome });
    else plano.atualizados.push({ linha: l.numero, id: existente.id, nome: existente.nome, dados: mesclarDestino(existente, dados), apelido, mudancas });
  }
  return plano;
}

// --- emendas de anos anteriores ----------------------------------------------

export type EmendaHistorica = { ano: number; numero: number; autor: string; descricao: string; valor: number; parcela: "SAUDE" | "DEMAIS" | null };

export type PlanoHistorico = {
  novas: { linha: number; dados: EmendaHistorica }[];
  atualizadas: { linha: number; dados: EmendaHistorica; mudancas: Mudanca[] }[];
  semMudanca: { linha: number; ano: number; numero: number }[];
  recusados: Recusa[];
  autoresNovos: string[];
  faltam: string[];
};

function parcelaDe(v: string): "SAUDE" | "DEMAIS" | null | false {
  const s = normalizarCabecalho(v);
  if (!s) return null;
  if (["saude", "s"].includes(s)) return "SAUDE";
  if (["demais", "demais_areas", "d", "outras", "outras_areas"].includes(s)) return "DEMAIS";
  return false;
}

export function validarHistorico(r: Record<string, string>, anos: Set<number>): { ok: true; valor: EmendaHistorica } | { ok: false; motivos: string[] } {
  const motivos: string[] = [];
  const ano = Number((r.ano ?? "").replace(/\D/g, ""));
  if (!ano) motivos.push("Ano ausente.");
  else if (!anos.has(ano)) motivos.push(`O exercício ${ano} não está cadastrado.`);
  const numero = Number((r.numero ?? "").replace(/\D/g, ""));
  if (!numero) motivos.push("Número da emenda ausente.");
  const autor = (r.autor ?? "").replace(/\s+/g, " ").trim();
  if (autor.length < 3) motivos.push("Autor ausente.");
  const descricao = (r.descricao ?? "").trim();
  if (descricao.length < 5) motivos.push("Descrição ausente.");
  const v = lerValor(r.valor ?? "");
  if (v === null || v <= 0) motivos.push("Valor ausente ou inválido.");
  const parcela = parcelaDe(r.parcela ?? "");
  if (parcela === false) motivos.push("Parcela precisa ser “saúde” ou “demais”.");
  if (motivos.length) return { ok: false, motivos };
  return { ok: true, valor: { ano, numero, autor, descricao, valor: v!, parcela: parcela || null } };
}

export type HistoricoExistente = { ano: number; numero: number; autor: string; descricao: string; valor: number; parcela: "SAUDE" | "DEMAIS" | null };

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function planejarHistorico(tabela: Tabela, existentes: HistoricoExistente[], anos: Set<number>, autores: string[]): PlanoHistorico {
  const plano: PlanoHistorico = { novas: [], atualizadas: [], semMudanca: [], recusados: [], autoresNovos: [], faltam: tabela.faltam };
  if (tabela.faltam.length) return plano;
  const porChave = new Map(existentes.map((e) => [`${e.ano}|${e.numero}`, e]));
  const autoresConhecidos = new Set(autores.map((a) => a.toLocaleLowerCase("pt-BR")));
  const novosAutores = new Map<string, string>();
  const vistos = new Set<string>();
  for (const l of tabela.linhas) {
    const r = Object.fromEntries(Object.keys(tabela.mapa).map((k) => [k, valor(l, tabela.mapa, k)]));
    const v = validarHistorico(r, anos);
    const conteudo = l.celulas.join(" · ").slice(0, 300);
    if (!v.ok) {
      plano.recusados.push({ linha: l.numero, motivos: v.motivos, conteudo });
      continue;
    }
    const chave = `${v.valor.ano}|${v.valor.numero}`;
    if (vistos.has(chave)) {
      plano.recusados.push({ linha: l.numero, motivos: [`A emenda nº ${v.valor.numero}/${v.valor.ano} aparece em outra linha desta planilha.`], conteudo });
      continue;
    }
    vistos.add(chave);
    const chaveAutor = v.valor.autor.toLocaleLowerCase("pt-BR");
    if (!autoresConhecidos.has(chaveAutor) && !novosAutores.has(chaveAutor)) novosAutores.set(chaveAutor, v.valor.autor);
    const e = porChave.get(chave);
    if (!e) {
      plano.novas.push({ linha: l.numero, dados: v.valor });
      continue;
    }
    const mudancas: Mudanca[] = [];
    if (e.autor !== v.valor.autor) mudancas.push({ campo: "Autor", antes: e.autor, depois: v.valor.autor });
    if (e.descricao !== v.valor.descricao) mudancas.push({ campo: "Descrição", antes: e.descricao.slice(0, 120), depois: v.valor.descricao.slice(0, 120) });
    if (Math.round(e.valor * 100) !== Math.round(v.valor.valor * 100)) mudancas.push({ campo: "Valor", antes: BRL(e.valor), depois: BRL(v.valor.valor) });
    if ((e.parcela ?? null) !== v.valor.parcela) mudancas.push({ campo: "Parcela", antes: e.parcela ?? "—", depois: v.valor.parcela ?? "—" });
    if (mudancas.length) plano.atualizadas.push({ linha: l.numero, dados: v.valor, mudancas });
    else plano.semMudanca.push({ linha: l.numero, ano: v.valor.ano, numero: v.valor.numero });
  }
  plano.autoresNovos = [...novosAutores.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return plano;
}
