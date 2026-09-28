// Importação da base de dotações (LOA) a partir de planilha. Puro: recebe as
// linhas já lidas (cabeçalho → texto) e devolve as dotações validadas ou os
// erros por linha. A gravação fica na action.

export const COLUNAS_OBRIGATORIAS = [
  "orgao_codigo",
  "orgao_nome",
  "unidade_codigo",
  "unidade_nome",
  "funcao_codigo",
  "subfuncao_codigo",
  "subfuncao_nome",
  "programa_codigo",
  "programa_nome",
  "acao_codigo",
  "acao_nome",
  "natureza_codigo",
  "fonte_codigo",
  "valor_autorizado",
] as const;

// Opcionais: funcao_nome, acao_tipo (PROJETO | ATIVIDADE | OPERACAO_ESPECIAL),
// fonte_nome, ficha, natureza_nome, pagina.

export type LinhaDotacao = {
  orgao: { codigo: string; nome: string };
  unidade: { codigo: string; nome: string };
  funcao: { codigo: string; nome: string | null };
  subfuncao: { codigo: string; nome: string };
  programa: { codigo: string; nome: string };
  acao: { codigo: string; nome: string; tipo: "PROJETO" | "ATIVIDADE" | "OPERACAO_ESPECIAL" };
  natureza: { codigo: string; categoria: string; grupo: string; modalidade: string; elemento: string; nome: string | null };
  fonte: { codigo: string; nome: string };
  ficha: string | null;
  valor: number;
  pagina: number | null;
};

export type ErroLinha = { linha: number; motivo: string };

// Valor monetário em formato brasileiro ("1.234,56") ou decimal com ponto
// ("1234.56"). Ponto só é separador de milhar quando seguido de três dígitos
// e sem vírgula decimal depois.
export function lerValor(bruto: string): number | null {
  let s = String(bruto ?? "").replace(/R\$|\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const somente = (v: string) => String(v ?? "").trim();

function tipoAcao(bruto: string, codigo: string): LinhaDotacao["acao"]["tipo"] | null {
  const t = somente(bruto).toUpperCase().replace(/\s+/g, "_");
  if (t === "PROJETO" || t === "ATIVIDADE" || t === "OPERACAO_ESPECIAL") return t;
  if (t) return null;
  // Sem tipo informado, a numeração padrão da ação decide: 1xxx projeto,
  // 2xxx atividade, demais operação especial.
  return codigo.startsWith("1") ? "PROJETO" : codigo.startsWith("2") ? "ATIVIDADE" : "OPERACAO_ESPECIAL";
}

// Natureza "4.4.90.52" (ou "44905200") → partes.
function natureza(codigo: string) {
  const digitos = codigo.replace(/\D/g, "");
  const m = codigo.match(/^(\d)\.(\d)\.(\d{2})\.(\d{2})/) ?? (digitos.length >= 6 ? [codigo, digitos[0], digitos[1], digitos.slice(2, 4), digitos.slice(4, 6)] : null);
  if (!m) return null;
  return { categoria: m[1], grupo: m[2], modalidade: m[3], elemento: m[4], codigo: `${m[1]}.${m[2]}.${m[3]}.${m[4]}` };
}

export function validarLinhas(linhas: Record<string, string>[]): { dotacoes: LinhaDotacao[]; erros: ErroLinha[] } {
  const erros: ErroLinha[] = [];
  const dotacoes: LinhaDotacao[] = [];
  if (!linhas.length) return { dotacoes, erros: [{ linha: 1, motivo: "A planilha não tem linhas." }] };
  const faltam = COLUNAS_OBRIGATORIAS.filter((c) => !(c in linhas[0]));
  if (faltam.length) return { dotacoes, erros: [{ linha: 1, motivo: `Colunas ausentes: ${faltam.join(", ")}.` }] };

  linhas.forEach((l, i) => {
    const n = i + 2;
    const vazias = COLUNAS_OBRIGATORIAS.filter((c) => c !== "valor_autorizado" && !somente(l[c]));
    if (vazias.length) return erros.push({ linha: n, motivo: `Campos vazios: ${vazias.join(", ")}.` });
    const valor = lerValor(l.valor_autorizado);
    if (valor === null || valor < 0) return erros.push({ linha: n, motivo: "valor_autorizado inválido." });
    const nat = natureza(somente(l.natureza_codigo));
    if (!nat) return erros.push({ linha: n, motivo: "natureza_codigo inválido (use 4.4.90.52)." });
    const acaoCodigo = somente(l.acao_codigo);
    const tipo = tipoAcao(l.acao_tipo, acaoCodigo);
    if (!tipo) return erros.push({ linha: n, motivo: "acao_tipo inválido (PROJETO, ATIVIDADE ou OPERACAO_ESPECIAL)." });
    const pagina = somente(l.pagina) ? Number(somente(l.pagina)) : null;
    dotacoes.push({
      orgao: { codigo: somente(l.orgao_codigo), nome: somente(l.orgao_nome) },
      unidade: { codigo: somente(l.unidade_codigo), nome: somente(l.unidade_nome) },
      funcao: { codigo: somente(l.funcao_codigo).padStart(2, "0"), nome: somente(l.funcao_nome) || null },
      subfuncao: { codigo: somente(l.subfuncao_codigo).padStart(3, "0"), nome: somente(l.subfuncao_nome) },
      programa: { codigo: somente(l.programa_codigo), nome: somente(l.programa_nome) },
      acao: { codigo: acaoCodigo, nome: somente(l.acao_nome), tipo },
      natureza: { ...nat, nome: somente(l.natureza_nome) || null },
      fonte: { codigo: somente(l.fonte_codigo), nome: somente(l.fonte_nome) || "Fonte de recurso" },
      ficha: somente(l.ficha) || null,
      valor,
      pagina: pagina !== null && Number.isFinite(pagina) ? pagina : null,
    });
  });

  // A unidade precisa pertencer ao órgão informado.
  for (const d of dotacoes) {
    if (!d.unidade.codigo.startsWith(d.orgao.codigo.split(".")[0])) {
      erros.push({ linha: 0, motivo: `Unidade ${d.unidade.codigo} não pertence ao órgão ${d.orgao.codigo}.` });
      break;
    }
  }
  return { dotacoes, erros };
}
