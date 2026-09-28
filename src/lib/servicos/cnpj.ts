import "server-only";
import { cnpjValido, formatarTelefone, somenteDigitos } from "@/lib/cnpj";

// Consulta de CNPJ na BrasilAPI (dados da Receita Federal), para preencher o
// cadastro de entidade do terceiro setor.

// Naturezas jurídicas sem fins lucrativos: fundação privada, organização
// religiosa, organização social e associação privada.
const SEM_FINS_LUCRATIVOS = new Set(["3069", "3220", "3301", "3999"]);
const CARGO = /presidente|diretor|administrador|provedor|superintendente|coordenador/i;
const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]);
const cache = new Map<string, { em: number; dados: DadosCnpj }>();

export type DadosCnpj = {
  cnpj: string;
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
  responsavel: string;
  cargo: string;
  situacao: string;
  ativa: boolean;
  natureza: string;
  semFinsLucrativos: boolean;
};

const titulo = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i && MINUSCULAS.has(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");

type Receita = Record<string, unknown> & { qsa?: { nome_socio?: string; qualificacao_socio?: string }[] };

function endereco(d: Receita) {
  const rua = titulo([d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" "));
  const complemento = String(d.complemento ?? "").trim();
  const linha = [rua, String(d.numero ?? "").trim()].filter(Boolean).join(", ") + (complemento ? " " + titulo(complemento) : "");
  const cep = somenteDigitos(String(d.cep ?? ""));
  return [
    [linha, titulo(d.bairro)].filter(Boolean).join(" — "),
    [titulo(d.municipio), String(d.uf ?? "").toUpperCase()].filter(Boolean).join("/"),
    cep.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function consultarCnpj(valor: string): Promise<DadosCnpj> {
  const cnpj = somenteDigitos(valor);
  if (!cnpjValido(cnpj)) throw new Error("CNPJ inválido.");
  const guardado = cache.get(cnpj);
  if (guardado && Date.now() - guardado.em < 86_400_000) return guardado.dados;
  let resposta: Response;
  try {
    // A BrasilAPI recusa requisição sem User-Agent identificado.
    resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json", "User-Agent": "Emendas360/1.0" },
    });
  } catch {
    throw new Error("Não foi possível consultar o CNPJ agora.");
  }
  if (resposta.status === 404) throw new Error("CNPJ não encontrado na Receita Federal.");
  if (!resposta.ok) throw new Error("Não foi possível consultar o CNPJ agora.");
  const d = (await resposta.json()) as Receita;
  const socios = Array.isArray(d.qsa) ? d.qsa : [];
  const lider =
    socios.find((p) => /presidente/i.test(p.qualificacao_socio ?? "")) ?? socios.find((p) => CARGO.test(p.qualificacao_socio ?? ""));
  const natureza = String(d.codigo_natureza_juridica ?? "");
  const situacao = String(d.descricao_situacao_cadastral ?? "").trim().toUpperCase();
  const dados: DadosCnpj = {
    cnpj,
    nome: String(d.razao_social ?? "").trim(),
    endereco: endereco(d),
    telefone: formatarTelefone(String(d.ddd_telefone_1 ?? "")),
    email: String(d.email ?? "").trim().toLowerCase(),
    responsavel: lider ? titulo(lider.nome_socio) : "",
    cargo: lider ? titulo(lider.qualificacao_socio) : "",
    situacao,
    ativa: situacao === "ATIVA",
    natureza: String(d.natureza_juridica ?? "").trim(),
    semFinsLucrativos: SEM_FINS_LUCRATIVOS.has(natureza),
  };
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  cache.set(cnpj, { em: Date.now(), dados });
  return dados;
}
