import type { PrismaClient } from "../../src/generated/prisma/client";
import type { TipoAcao } from "../../src/generated/prisma/enums";
import { codigosDeExibicao, NATUREZAS_EMENDAVEIS } from "../../src/lib/orcamento/codigo-dotacao";
import { orgaoDaUnidade, pertence } from "../../src/lib/riep/destino";
import { data, lerDados } from "./dados";
import { lerExercicio } from "./exercicio";

type LinhaLoa = {
  ficha: string;
  nome: string;
  actionCode: string;
  uo: string;
  unitId: string;
  orgName: string;
  unitName: string;
  funcao: string;
  subf: string;
  subfn: string;
  prog: string;
  programName: string;
  gnd: string;
  mod: string;
  elem: string;
  sourceCode: string;
  applicationCode: string;
  autorizado: number;
  pagina: number;
};

type MetaJson = {
  unitId: string;
  programa: string;
  acao: string;
  nomeAcao: string;
  produto: string | null;
  unidadeMedida: string | null;
  publico: string | null;
  quantidadePpa: number | null;
  pagina: number | null;
  // Meta de cada ano do PPA: quantidade2026, quantidade2027…
  [quantidadeDoAno: `quantidade${number}`]: number | null | undefined;
};

// Tabelas federais (Portaria MOG 42/1999 e Portaria Interministerial 163/2001).
const FUNCOES: Record<string, string> = {
  "01": "Legislativa", "02": "Judiciária", "03": "Essencial à Justiça", "04": "Administração",
  "05": "Defesa Nacional", "06": "Segurança Pública", "07": "Relações Exteriores", "08": "Assistência Social",
  "09": "Previdência Social", "10": "Saúde", "11": "Trabalho", "12": "Educação", "13": "Cultura",
  "14": "Direitos da Cidadania", "15": "Urbanismo", "16": "Habitação", "17": "Saneamento",
  "18": "Gestão Ambiental", "19": "Ciência e Tecnologia", "20": "Agricultura", "21": "Organização Agrária",
  "22": "Indústria", "23": "Comércio e Serviços", "24": "Comunicações", "25": "Energia", "26": "Transporte",
  "27": "Desporto e Lazer", "28": "Encargos Especiais", "99": "Reserva de Contingência",
};
const ELEMENTOS: Record<string, string> = {
  "01": "Aposentadorias e reformas", "03": "Pensões", "08": "Outros benefícios assistenciais do servidor e do militar",
  "11": "Vencimentos e vantagens fixas — pessoal civil",
  "13": "Obrigações patronais", "14": "Diárias — civil", "16": "Outras despesas variáveis — pessoal civil",
  "18": "Auxílio financeiro a estudantes", "21": "Juros sobre a dívida por contrato", "30": "Material de consumo",
  "31": "Premiações culturais, artísticas, científicas, desportivas e outras",
  "32": "Material, bem ou serviço para distribuição gratuita", "33": "Passagens e despesas com locomoção",
  "34": "Outras despesas de pessoal decorrentes de contratos de terceirização", "35": "Serviços de consultoria",
  "36": "Outros serviços de terceiros — pessoa física", "39": "Outros serviços de terceiros — pessoa jurídica",
  "40": "Serviços de tecnologia da informação e comunicação", "41": "Contribuições", "42": "Auxílios",
  "43": "Subvenções sociais", "45": "Subvenções econômicas", "46": "Auxílio-alimentação",
  "47": "Obrigações tributárias e contributivas", "48": "Outros auxílios financeiros a pessoas físicas",
  "51": "Obras e instalações", "52": "Equipamentos e material permanente", "61": "Aquisição de imóveis",
  "65": "Constituição ou aumento de capital de empresas", "70": "Rateio pela participação em consórcio público",
  "71": "Principal da dívida contratual resgatado", "91": "Sentenças judiciais",
  "92": "Despesas de exercícios anteriores", "93": "Indenizações e restituições",
  "94": "Indenizações e restituições trabalhistas",
  "96": "Ressarcimento de despesas de pessoal requisitado", "99": "A classificar",
};
const CATEGORIA: Record<string, string> = { "1": "3", "2": "3", "3": "3", "4": "4", "5": "4", "6": "4", "9": "9" };

// Mogi Guaçu numera projetos 1xxx, atividades 2xxx e operações especiais 0xxx/9xxx.
function tipoAcao(codigo: string): TipoAcao {
  if (codigo.startsWith("1")) return "PROJETO";
  if (codigo.startsWith("2")) return "ATIVIDADE";
  return "OPERACAO_ESPECIAL";
}

// Python str.capitalize(): primeira letra maiúscula, o resto minúsculo.
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export async function semearLoa(prisma: PrismaClient, exercicioId: string, ano: number) {
  const ex = lerExercicio(ano);
  const loa = lerDados<{ titulo: string; fonte: string | null; dotacoes: LinhaLoa[] }>(`loa-${ano}.json`);
  const nomes = lerDados<{ names: Record<string, string>; orgaos?: Record<string, string> }>(`unidades-${ano}.json`);
  const unidadesNomes = nomes.names;
  const ppa = lerDados<{ acoes: MetaJson[]; programas: string[] }>("metas-ppa-2026-2029.json");
  const foraDasEmendas = (uo: string) => ex.excludedOrgans.some((o) => pertence(uo, o));

  // As dotações ficam sempre no projeto de lei: é sobre ele que a emenda incide.
  const { bill, law } = ex.instruments;
  const pl = await upsertInstrumento(prisma, exercicioId, {
    tipo: "LOA",
    especie: "PROJETO_LEI",
    numero: bill.number,
    ementa: bill.summary,
    status: bill.status,
    arquivoUrl: loa.fonte,
    // Data ausente no arquivo não apaga a que foi preenchida em Planejamento.
    dataEnvio: bill.sentAt ? data(bill.sentAt) : undefined,
  });
  if (law) {
    await upsertInstrumento(prisma, exercicioId, {
      tipo: "LOA",
      especie: "LEI_APROVADA",
      numero: law.number,
      ementa: law.summary,
      status: law.status,
      dataAprovacao: law.approvedAt ? data(law.approvedAt) : undefined,
      dataVigencia: law.effectiveAt ? data(law.effectiveAt) : undefined,
      instrumentoOrigemId: pl.id,
    });
  }

  const elegiveis = loa.dotacoes.filter(
    (d) => NATUREZAS_EMENDAVEIS.has(`${d.gnd}|${d.mod}`) && !foraDasEmendas(d.uo)
  );
  const demais = loa.dotacoes.filter((d) => !elegiveis.includes(d));
  const usados = new Set<string>();
  const ordenadas = [...elegiveis, ...demais];
  const codigos = [...codigosDeExibicao(elegiveis, usados), ...codigosDeExibicao(demais, usados)];

  // Caches por código para não repetir upserts.
  const orgaos = new Map<string, string>();
  const unidades = new Map<string, string>();
  const funcoes = new Map<string, string>();
  const subfuncoes = new Map<string, string>();
  const programas = new Map<string, string>();
  const acoes = new Map<string, string>();
  const naturezas = new Map<string, string>();
  const fontes = new Map<string, string>();
  const programasPpa = new Set(ppa.programas);

  // Dotações já gravadas neste exercício, por órgão + ficha.
  const gravadas = await prisma.dotacao.findMany({
    where: { exercicioId },
    select: { id: true, codigo: true, ficha: true, ativo: true, orgao: { select: { codigo: true } } },
  });
  const existentes = new Map(gravadas.filter((g) => g.ficha).map((g) => [`${g.orgao.codigo}|${g.ficha}`, g]));
  const tocadas = new Set<string>();
  // Os códigos de exibição vão ser regenerados sobre o conjunto novo; para
  // não colidir no índice único durante a troca, todos passam por um código
  // temporário antes.
  for (const g of gravadas) {
    await prisma.dotacao.update({ where: { id: g.id }, data: { codigo: `~${g.id}` } });
  }
  let criadas = 0;
  let atualizadas = 0;

  const uma = async <T extends { id: string }>(cache: Map<string, string>, chave: string, fn: () => Promise<T>) => {
    const achado = cache.get(chave);
    if (achado) return achado;
    const { id } = await fn();
    cache.set(chave, id);
    return id;
  };

  for (let i = 0; i < ordenadas.length; i++) {
    const d = ordenadas[i];
    // Órgão: a unidade sem o último segmento ("13.01" → "13"; "02.04.02" → "02.04").
    const codOrgao = orgaoDaUnidade(d.uo);
    const nomeUnidade = unidadesNomes[d.uo] ?? d.unitName;
    const nomeOrgao = nomes.orgaos?.[codOrgao] ?? (unidadesNomes[`${codOrgao}.01`] ?? d.orgName).split(" — ")[0];

    const orgaoId = await uma(orgaos, codOrgao, () =>
      prisma.orgao.upsert({
        where: { exercicioId_codigo: { exercicioId, codigo: codOrgao } },
        update: { nome: nomeOrgao },
        create: { exercicioId, codigo: codOrgao, nome: nomeOrgao },
      })
    );
    const unidadeId = await uma(unidades, d.uo, () =>
      prisma.unidadeOrcamentaria.upsert({
        where: { exercicioId_codigo: { exercicioId, codigo: d.uo } },
        update: { nome: nomeUnidade, orgaoId },
        create: { exercicioId, codigo: d.uo, nome: nomeUnidade, orgaoId },
      })
    );
    const funcaoId = await uma(funcoes, d.funcao, () =>
      prisma.funcao.upsert({
        where: { exercicioId_codigo: { exercicioId, codigo: d.funcao } },
        update: {},
        create: { exercicioId, codigo: d.funcao, nome: FUNCOES[d.funcao] ?? `Função ${d.funcao}` },
      })
    );
    const subfuncaoId = await uma(subfuncoes, `${d.funcao}.${d.subf}`, () =>
      prisma.subfuncao.upsert({
        where: { exercicioId_funcaoId_codigo: { exercicioId, funcaoId, codigo: d.subf } },
        update: { nome: d.subfn },
        create: { exercicioId, funcaoId, codigo: d.subf, nome: d.subfn },
      })
    );
    const programaId = await uma(programas, d.prog, () =>
      prisma.programa.upsert({
        where: { exercicioId_codigo: { exercicioId, codigo: d.prog } },
        update: { nome: d.programName, constaNoPPA: programasPpa.has(d.prog) },
        create: { exercicioId, codigo: d.prog, nome: d.programName, constaNoPPA: programasPpa.has(d.prog) },
      })
    );
    const acaoId = await uma(acoes, `${d.prog}|${d.actionCode}`, () =>
      prisma.acao.upsert({
        where: { exercicioId_programaId_codigo: { exercicioId, programaId, codigo: d.actionCode } },
        update: { nome: d.nome },
        create: { exercicioId, programaId, codigo: d.actionCode, nome: d.nome, tipo: tipoAcao(d.actionCode) },
      })
    );
    const codNatureza = `${CATEGORIA[d.gnd] ?? d.gnd}.${d.gnd}.${d.mod}.${d.elem}`;
    const naturezaDespesaId = await uma(naturezas, codNatureza, () =>
      prisma.naturezaDespesa.upsert({
        where: { exercicioId_codigo: { exercicioId, codigo: codNatureza } },
        update: {},
        create: {
          exercicioId,
          codigo: codNatureza,
          categoriaEconomica: CATEGORIA[d.gnd] ?? d.gnd,
          grupo: d.gnd,
          modalidadeAplicacao: d.mod,
          elemento: d.elem,
          nome: ELEMENTOS[d.elem] ?? null,
        },
      })
    );
    const codFonte = `${d.sourceCode}.${d.applicationCode}`;
    const fonteRecursoId = await uma(fontes, codFonte, () =>
      prisma.fonteRecurso.upsert({
        where: { exercicioId_codigo: { exercicioId, codigo: codFonte } },
        update: {},
        create: {
          exercicioId,
          codigo: codFonte,
          nome: "Fonte e aplicação do QDD (TCE-SP) — correspondência STN pendente",
        },
      })
    );

    const dotacao = {
      exercicioId,
      orgaoId,
      unidadeOrcamentariaId: unidadeId,
      funcaoId,
      subfuncaoId,
      programaId,
      acaoId,
      naturezaDespesaId,
      fonteRecursoId,
      ficha: /^\d+$/.test(d.ficha) ? d.ficha : null,
      valorAutorizado: d.autorizado,
      paginaFonte: d.pagina,
      ordem: loa.dotacoes.indexOf(d),
      ativo: true,
    };
    // A ficha é o número oficial da dotação e é estável entre versões da LOA;
    // o código de exibição não é (depende de quantas vezes a ação se repete).
    // Por isso a linha existente é localizada por órgão + ficha e atualizada
    // no lugar, preservando o id — e com ele o vínculo das emendas.
    const chave = dotacao.ficha ? `${codOrgao}|${dotacao.ficha}` : null;
    const existente = chave ? existentes.get(chave) : undefined;
    if (existente) {
      await prisma.dotacao.update({ where: { id: existente.id }, data: { ...dotacao, codigo: codigos[i], instrumentoId: pl.id } });
      tocadas.add(existente.id);
      atualizadas++;
    } else {
      await prisma.dotacao.upsert({
        where: { instrumentoId_codigo: { instrumentoId: pl.id, codigo: codigos[i] } },
        update: dotacao,
        create: { ...dotacao, instrumentoId: pl.id, codigo: codigos[i] },
      });
      criadas++;
    }
  }

  // O que existia e não está mais na LOA (com ou sem ficha) fica inativo — nunca
  // é apagado, porque uma emenda antiga pode apontar para cá. O código volta ao
  // original com um sufixo, para não disputar o índice com os códigos novos.
  let desativadas = 0;
  for (const sobra of gravadas) {
    if (tocadas.has(sobra.id)) continue;
    const original = sobra.codigo.replace(/~inativo$/, "");
    await prisma.dotacao.update({ where: { id: sobra.id }, data: { ativo: false, codigo: `${original}~inativo` } });
    if (sobra.ativo) desativadas++;
  }

  // Metas do PPA 2026–2029. A meta do ano no PPA faz as vezes da meta do
  // exercício, e a nota diz de onde ela veio. A meta é da ação: quando a ação
  // mudou de unidade em relação ao PPA (os setores do Hospital em 2027, as obras
  // que foram para a Secretaria de Obras), ela acompanha a ação, em cada unidade
  // que a executa neste exercício.
  const unidadePorUnitId = new Map(loa.dotacoes.map((d) => [d.unitId, d.uo]));
  const unidadesDaAcao = new Map<string, Set<string>>();
  for (const d of loa.dotacoes) {
    const k = `${d.prog}|${d.actionCode}`;
    if (!unidadesDaAcao.has(k)) unidadesDaAcao.set(k, new Set());
    unidadesDaAcao.get(k)!.add(d.uo);
  }
  let metas = 0;
  for (const a of ppa.acoes) {
    const quantidadeDoAno = a[`quantidade${ano}`];
    if (!quantidadeDoAno) continue;
    const programaId = programas.get(a.programa);
    const acaoId = acoes.get(`${a.programa}|${a.acao}`);
    if (!programaId || !acaoId) continue;
    const executoras = unidadesDaAcao.get(`${a.programa}|${a.acao}`) ?? new Set<string>();
    const uoPpa = unidadePorUnitId.get(a.unitId);
    const alvos = uoPpa && executoras.has(uoPpa) ? [uoPpa] : [...executoras];
    const meta = {
      exercicioId,
      produto: capitalizar(a.produto || a.nomeAcao),
      unidadeMedida: a.unidadeMedida ? a.unidadeMedida.toLowerCase() : null,
      publicoAlvo: a.publico ? capitalizar(a.publico) : null,
      quantidadePpa: a.quantidadePpa,
      quantidadeExercicio: quantidadeDoAno,
      beneficiariosExercicio: null,
      notaLdo: `${ex.goalNote} (p. ${a.pagina})`,
      paginaFonte: a.pagina,
    };
    for (const uo of alvos) {
      const unidadeId = unidades.get(uo);
      if (!unidadeId) continue;
      await prisma.metaAcao.upsert({
        where: { unidadeId_programaId_acaoId: { unidadeId, programaId, acaoId } },
        update: meta,
        create: { ...meta, unidadeId, programaId, acaoId },
      });
      metas++;
    }
  }

  return { dotacoes: ordenadas.length, criadas, atualizadas, desativadas, metas };
}

async function upsertInstrumento(
  prisma: PrismaClient,
  exercicioId: string,
  dados: Omit<Parameters<PrismaClient["instrumentoPlanejamento"]["create"]>[0]["data"], "exercicio" | "exercicioId">
) {
  const existente = await prisma.instrumentoPlanejamento.findFirst({
    where: { exercicioId, especie: dados.especie, numero: dados.numero },
  });
  if (existente) {
    return prisma.instrumentoPlanejamento.update({ where: { id: existente.id }, data: dados as never });
  }
  return prisma.instrumentoPlanejamento.create({ data: { ...dados, exercicioId } as never });
}
