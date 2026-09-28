import "server-only";

// ============================================================================
// Pesquisa de preço no PNIGP (compras públicas) e, para obras, nas tabelas
// SINAPI, SICRO e SIE-SC. O resultado nunca entra sozinho na memória de
// cálculo: vai para a conferência, e só a aprovação cria a referência.
// ============================================================================

export type ResultadoPreco = {
  id: string;
  descricao: string;
  unidade: string;
  preco: number;
  fonte: string;
  tipo: "PAINEL" | "TABELA_OFICIAL";
  identificacao: string;
  amostra: number;
  municipios: number | null;
  periodo: string | null;
  consultadoEm: string;
  url: string;
};

const BASE = "https://pnigp.vercel.app";
const cache = new Map<string, { em: number; dados: unknown }>();
const positivo = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const competencia = (v: unknown) => (/^\d{6}$/.test(String(v)) ? `${String(v).slice(4)}/${String(v).slice(0, 4)}` : null);

async function buscar(url: string): Promise<unknown> {
  const guardado = cache.get(url);
  if (guardado && Date.now() - guardado.em < 10 * 60_000) return guardado.dados;
  const resposta = await fetch(url, { signal: AbortSignal.timeout(22_000), headers: { Accept: "application/json" } });
  if (!resposta.ok) throw new Error(`A fonte de preços respondeu com erro (${resposta.status}).`);
  const dados = (await resposta.json()) as { erro?: unknown };
  if (dados?.erro) throw new Error("A fonte de preços não conseguiu concluir a consulta.");
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  cache.set(url, { em: Date.now(), dados });
  return dados;
}

type CandidatoPnigp = {
  chave?: string;
  unidade?: string;
  mediana?: number;
  nItens?: number;
  nMunicipios?: number;
  primeira?: string;
  ultima?: string;
};

export async function pesquisarPrecos(consulta: string, engenharia: boolean) {
  const q = encodeURIComponent(consulta);
  const fontes = [
    { nome: "PNIGP", url: `${BASE}/api/candidatos-preco/${q}` },
    ...(engenharia
      ? [
          { nome: "SINAPI", url: `${BASE}/api/sinapi-precos/${q}` },
          { nome: "SICRO", url: `${BASE}/api/sicro-precos/${q}` },
          { nome: "SIE-SC", url: `${BASE}/api/siesc-precos/${q}` },
        ]
      : []),
  ];
  const respostas = await Promise.allSettled(fontes.map((f) => buscar(f.url)));
  const indisponiveis = respostas.flatMap((r, i) => (r.status === "rejected" ? [fontes[i].nome] : []));
  if (indisponiveis.length === fontes.length) {
    throw new Error("A fonte de preços está indisponível. Tente novamente ou registre uma referência própria.");
  }
  const agora = new Date().toISOString();
  const resultados: ResultadoPreco[] = [];
  respostas.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const dados = r.value as { objetos?: CandidatoPnigp[]; competencia?: string; composicoes?: unknown[]; servicos?: unknown[] };
    if (fontes[i].nome === "PNIGP") {
      (dados.objetos ?? []).forEach((o, j) => {
        const preco = positivo(o.mediana);
        if (!preco || !o.chave) return;
        resultados.push({
          id: `pnigp-${j}`,
          descricao: String(o.chave),
          unidade: o.unidade ?? "",
          preco,
          fonte: "PNIGP · mediana das compras encontradas",
          tipo: "PAINEL",
          identificacao: `Busca: ${consulta} · ${o.chave}`,
          amostra: Number(o.nItens) || 0,
          municipios: Number(o.nMunicipios) || null,
          periodo: o.primeira && o.ultima ? `${o.primeira} a ${o.ultima}` : null,
          consultadoEm: agora,
          url: `${BASE}/banco-precos?q=${q}`,
        });
      });
      return;
    }
    const linhas = (dados.composicoes ?? dados.servicos ?? []) as Record<string, unknown>[];
    const comp = competencia(dados.competencia);
    for (const l of linhas) {
      const valor =
        positivo(l.custoNaoDesonerado) ?? positivo(l.custoDesonerado) ?? positivo(l.custo) ?? positivo(l.precoUnitario);
      if (!valor || !l.descricao) continue;
      const desoneracao = l.custoNaoDesonerado ? "Não desonerado" : l.custoDesonerado ? "Desonerado" : "Conforme tabela";
      resultados.push({
        id: `${fontes[i].nome}-${String(l.codigo)}`,
        descricao: String(l.descricao),
        unidade: String(l.unidade ?? ""),
        preco: valor,
        fonte: `${fontes[i].nome}${comp ? " " + comp : ""} · ${desoneracao}`,
        tipo: "TABELA_OFICIAL",
        identificacao: `Código ${l.codigo ?? "não informado"}`,
        amostra: 0,
        municipios: null,
        periodo: comp,
        consultadoEm: agora,
        url: fontes[i].url,
      });
    }
  });
  return { resultados, indisponiveis };
}
