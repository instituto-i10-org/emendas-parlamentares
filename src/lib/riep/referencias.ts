import { interpretar } from "./interpretar";
import { norm } from "./texto";
import type { ObjetoBiblioteca, TipoReferencia } from "./tipos";

// Tipos de referência de preço. A identificação exigida muda com o tipo — é
// isso que torna a origem conferível por terceiro.
export const TIPOS_REFERENCIA: Record<TipoReferencia, { nome: string; campos: [string, string][] }> = {
  ATA: {
    nome: "Ata de registro de preços vigente",
    campos: [["num", "Número da ata"], ["gerenciador", "Órgão gerenciador"], ["item", "Item da ata"], ["vigencia", "Vigência"]],
  },
  CONTRATACAO_MUNICIPIO: {
    nome: "Contratação anterior do próprio Município",
    campos: [["num", "Nº do processo ou contrato"], ["assinatura", "Data de assinatura"]],
  },
  CONTRATACAO_OUTRO_ORGAO: {
    nome: "Contratação de outro órgão público",
    campos: [["num", "Nº do processo ou contrato"], ["ente", "Ente contratante"], ["assinatura", "Data de assinatura"]],
  },
  PAINEL: {
    nome: "Painel ou banco oficial de preços",
    campos: [["consulta", "Identificação da consulta"], ["recorte", "Recorte aplicado"], ["amostra", "Nº de contratações na amostra"]],
  },
  BANCO_PRECOS_SAUDE: {
    nome: "Banco de Preços em Saúde",
    campos: [["consulta", "Identificação da consulta"], ["recorte", "Recorte aplicado"], ["amostra", "Nº de contratações na amostra"]],
  },
  TABELA_OFICIAL: {
    nome: "Tabela oficial de custos (SINAPI, SICRO, estadual)",
    campos: [["sistema", "Sistema"], ["composicao", "Código da composição"], ["databse", "Data-base"], ["deson", "Com ou sem desoneração"]],
  },
  COTACAO: {
    nome: "Orçamento ou cotação de fornecedor",
    campos: [["razao", "Razão social"], ["cnpj", "CNPJ"], ["validade", "Validade da proposta"]],
  },
  NOTA_FISCAL: {
    nome: "Nota fiscal",
    campos: [["num", "Número"], ["serie", "Série"], ["emitente", "Emitente"], ["cnpj", "CNPJ"]],
  },
  TERMO_PARCERIA: {
    nome: "Termo de fomento ou colaboração anterior",
    campos: [["num", "Nº do termo"], ["entidade", "Entidade"], ["vigencia", "Vigência"]],
  },
  ESTIMATIVA: {
    nome: "Estimativa técnica justificada",
    campos: [["metodologia", "Metodologia empregada"], ["justificativa", "Justificativa escrita"]],
  },
};

export type ReferenciaPreco = {
  codigo: string;
  tipo: TipoReferencia;
  campos: Record<string, string>;
  emissor: string;
  // ISO (aaaa-mm-dd) quando a fonte informa data exata.
  data: string | null;
  // Como a fonte informa o período, quando não há data exata.
  dataTexto: string | null;
  unidade: string;
  valor: number;
  objeto: string;
  porte: string;
  link: string;
  observacao: string;
  procedencia: "INFORMADA" | "CONFERIDA";
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  origemExterna: string | null;
  consultadoEm: string | null;
  // Fonte oficial de onde o preço foi tirado; nula em "outra fonte".
  fonteId?: string | null;
};

// Fonte oficial de preço, como a tela a mostra ao autor.
export type FontePreco = {
  id: string;
  nome: string;
  url: string;
  orientacao: string;
  aplicaA: string[];
  tipo: TipoReferencia;
};

// As fontes que servem à emenda: as gerais (aplicaA vazio), as do modelo do
// plano e, se a dotação é de saúde, as de saúde. Na ordem do cadastro.
export function fontesParaEmenda(fontes: FontePreco[], modelo: string | null, saude: boolean): FontePreco[] {
  return fontes.filter(
    (f) => !f.aplicaA.length || (modelo && f.aplicaA.includes(modelo)) || (saude && f.aplicaA.includes("SAUDE"))
  );
}

// A unidade do item difere da unidade da referência? Comparação sem caixa,
// acentos, pontuação e plural simples ("peça" = "peças" = "pç." não; "un" =
// "unidade" sim, pelas abreviações usuais). Vazio de um lado não acusa.
const ABREVIACOES: Record<string, string> = {
  un: "unidade", und: "unidade", unid: "unidade", pc: "peca", pç: "peca", pcs: "peca", cx: "caixa", kg: "quilo",
  quilograma: "quilo", l: "litro", lt: "litro", m: "metro", m2: "metro quadrado", m3: "metro cubico", pct: "pacote",
  fr: "frasco", amp: "ampola", cp: "comprimido", cpr: "comprimido", rl: "rolo", gl: "galao", sc: "saco", par: "par",
};
const normUnidade = (u: string) => {
  const base = norm(u).replace(/[^a-z0-9]+/g, " ").trim();
  const semPlural = base.replace(/(oes|aes)$/, "ao").replace(/s$/, "");
  return ABREVIACOES[semPlural] ?? ABREVIACOES[base] ?? semPlural;
};
export function unidadeDiverge(unidadeItem: string | null | undefined, unidadeReferencia: string | null | undefined): boolean {
  const a = normUnidade(unidadeItem ?? "");
  const b = normUnidade(unidadeReferencia ?? "");
  if (!a || !b) return false;
  return a !== b;
}

// "R2 · Ata de registro de preços vigente Ata SRP 014/2025"; tirada de fonte
// oficial, "R2 · SINAPI (Caixa) 92873".
export function rotuloReferencia(r: Pick<ReferenciaPreco, "codigo" | "tipo" | "campos"> & { emissor?: string; fonteId?: string | null }): string {
  const t = TIPOS_REFERENCIA[r.tipo];
  const chave = r.campos.num || r.campos.composicao || r.campos.consulta || r.campos.razao || "";
  // Tirada de fonte oficial: o nome da fonte diz mais que o tipo.
  const origem = r.fonteId && r.emissor?.trim() ? r.emissor.trim() : t.nome.split(" (")[0];
  return `${r.codigo} · ${origem}${chave ? " " + chave : ""}`;
}

// Registro completo: de onde (fonte), quando, o quê, em que unidade e quanto.
// Os campos próprios do tipo (número da ata, código da composição) ajudam a
// conferir, mas não travam: o autor nem sempre os tem à mão.
export function referenciaCompleta(r: ReferenciaPreco): boolean {
  if (!TIPOS_REFERENCIA[r.tipo]) return false;
  return !!r.emissor.trim() && !!(r.data || r.dataTexto) && !!r.objeto.trim() && !!r.unidade.trim() && r.valor > 0;
}

// O objeto da referência se relaciona ao item da linha? Silêncio da biblioteca
// não gera achado.
export function referenciaCombina(
  r: Pick<ReferenciaPreco, "objeto"> | null,
  item: string,
  biblioteca: ObjetoBiblioteca[]
): boolean {
  if (!r || !item) return true;
  const a = interpretar(r.objeto, biblioteca);
  const b = interpretar(item, biblioteca);
  if (!a || !b || a.confianca === "inferido" || b.confianca === "inferido") return true;
  return a.rotulo === b.rotulo;
}

// Referência anterior ao prazo de validade: alerta, não bloqueio.
export function referenciaAntiga(dataIso: string | null, meses: number, hoje = new Date()): boolean {
  if (!dataIso) return false;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date(hoje);
  limite.setMonth(limite.getMonth() - meses);
  return d < limite;
}

export function proximoCodigoReferencia(refs: Pick<ReferenciaPreco, "codigo">[]): string {
  const maior = refs.reduce((n, r) => Math.max(n, Number(r.codigo.replace(/\D/g, "")) || 0), 0);
  return `R${maior + 1}`;
}
