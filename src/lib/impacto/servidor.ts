import "server-only";
import { prisma } from "@/lib/prisma";
import { diaBrasilia, hojeBrasilia, lerRegras, projetoBase } from "@/lib/emendas/contexto";
import { ROTULO_STATUS_INSTRUMENTO, situacaoEmendamento } from "@/lib/emendas/emendamento";
import { areaDaUnidade } from "@/lib/riep/classificar";
import { regraDe, VERIFICACOES } from "@/lib/riep/verificacoes";
import { conferirCiencia, contar, diferencas, impactoVazio, plural, SEM_EMENDAS, type CampoRotulado, type ContagemEmendas, type Impacto, type Mudanca } from "./tipos";

// ============================================================================
// O impacto de cada ação sensível de configuração, lido do banco. Sem
// permissão nem gravação: quem chama (a consulta da janela e a própria ação)
// confere a permissão; a ação grava e reconfere a ciência com este resultado.
// ============================================================================

export type PedidoImpacto =
  | { tipo: "configuracao"; entrada: Record<string, unknown> & { exercicioId: string } }
  | { tipo: "statusExercicio"; id: string; status: "ABERTO" | "ENCERRADO" }
  | { tipo: "statusInstrumento"; id: string; status: string }
  | { tipo: "regras"; exercicioId: string; regras: { codigo: string; modo: string; ativa: boolean; fundamento: string; normaId: string | null }[] }
  | { tipo: "parametrosValidacao"; exercicioId: string; prazoDiligenciaDias?: number; fundamentos: Record<string, { texto: string; normaId: string | null }> }
  | { tipo: "area"; id: string; orgaos: string[]; unidadePadrao: string }
  | { tipo: "destinoAtivo"; id: string }
  | { tipo: "mesclar"; manterId: string; removerId: string }
  | { tipo: "normaAtiva"; id: string }
  | { tipo: "objetoAtivo"; id: string }
  | { tipo: "usuarioAtivo"; id: string }
  | { tipo: "perfilUsuario"; usuarioId: string; perfilId: string | null }
  | { tipo: "gerarLei"; ano: number };

// Exercício encerrado, ou histórico (anterior ao que abre por padrão, como em
// `exercicioHistorico`): parâmetros, regras, prazos e situação do projeto de
// lei ficam como estão. Devolve o motivo, ou nada.
async function fechadoParaAlteracao(ex: { ano: number; status: string }): Promise<string | null> {
  if (ex.status !== "ABERTO") {
    return `O exercício ${ex.ano} está encerrado: os parâmetros, as regras, os prazos e a situação do projeto de lei não mudam. Reabra o exercício para alterar.`;
  }
  const padrao = await prisma.exercicio.findFirst({ where: { status: "ABERTO" }, orderBy: { ano: "desc" }, select: { ano: true } });
  if (padrao && ex.ano < padrao.ano) {
    return `O exercício ${ex.ano} é histórico (anterior ao de ${padrao.ano}, em curso): os parâmetros, as regras, os prazos e a situação do projeto de lei não mudam.`;
  }
  return null;
}

async function contagem(where: Parameters<typeof prisma.emenda.groupBy>[0]["where"]): Promise<ContagemEmendas> {
  const linhas = await prisma.emenda.groupBy({ by: ["status"], where, _count: { _all: true } });
  return contar(linhas.map((l) => ({ status: l.status, n: l._count._all })));
}

const rascunhosAviso = (n: number, texto: string) => (n ? `${plural(n, "rascunho", "rascunhos")} ${texto}` : null);

// --- parâmetros do exercício ------------------------------------------------

const SITUACOES_PL: Record<string, string> = ROTULO_STATUS_INSTRUMENTO;

export const CAMPOS_CONFIGURACAO: Record<string, CampoRotulado> = {
  cotaIndividual: { rotulo: "Cota individual", formato: "moeda" },
  percentualRcl: { rotulo: "Percentual da RCL", formato: "percentual" },
  rclBase: { rotulo: "RCL de referência", formato: "moeda" },
  rclAnoBase: { rotulo: "Ano da RCL", formato: "inteiro" },
  numeroVereadores: { rotulo: "Número de vereadores", formato: "inteiro" },
  percentualSaude: { rotulo: "Parcela mínima da saúde", formato: "percentual" },
  afericaoSaude: { rotulo: "Aferição da saúde", opcoes: { GLOBAL: "global (todas as emendas do vereador)", INDIVIDUAL: "por emenda" } },
  toleranciaValorPct: { rotulo: "Tolerância do valor", formato: "percentual" },
  validadeReferenciaMeses: { rotulo: "Validade da referência de preço", formato: "meses" },
  percentualAcessorio: { rotulo: "Limite de acessórios", formato: "percentual" },
  fonteAudesp: { rotulo: "Fonte AUDESP" },
  fonteAudespNome: { rotulo: "Nome da fonte AUDESP" },
  codigoAplicacao: { rotulo: "Código de aplicação" },
  formatoVariacao: { rotulo: "Dígitos da variação", formato: "inteiro" },
  icEpVigente: { rotulo: "IC-EP vigente", formato: "sim-nao" },
  icEpCodigo: { rotulo: "Código IC-EP" },
  orgaosForaDasEmendas: { rotulo: "Órgãos fora das emendas", formato: "lista" },
  rotuloBase: { rotulo: "Rótulo da base" },
  prazoProtocolo: { rotulo: "Fim do protocolo", formato: "data" },
  fontePrecoObrigatoria: { rotulo: "Fonte do preço obrigatória", formato: "sim-nao" },
  situacoesEmendamento: { rotulo: "Situações do projeto que recebem emendas", formato: "lista", opcoes: SITUACOES_PL },
  validadeLinkEntidadeDias: { rotulo: "Validade do link da entidade", formato: "dias" },
  memoriaCota: { rotulo: "Memória de cálculo da cota" },
  rclObservacao: { rotulo: "Observação da RCL" },
  observacaoSaude: { rotulo: "Observação da saúde" },
};

// Campos que mudam a conferência das emendas já enviadas.
const AFETAM_EMENDAS = [
  "cotaIndividual",
  "percentualSaude",
  "afericaoSaude",
  "toleranciaValorPct",
  "validadeReferenciaMeses",
  "percentualAcessorio",
  "fonteAudesp",
  "codigoAplicacao",
  "formatoVariacao",
  "icEpVigente",
  "icEpCodigo",
  "orgaosForaDasEmendas",
  "fontePrecoObrigatoria",
];

async function impactoConfiguracao(entrada: Record<string, unknown> & { exercicioId: string }): Promise<Impacto> {
  const ex = await prisma.exercicio.findUnique({ where: { id: entrada.exercicioId }, include: { configuracao: true } });
  if (!ex) return impactoVazio({ bloqueio: "Exercício não encontrado." });
  const antes = ex.configuracao as unknown as Record<string, unknown> | null;
  const mudancas = diferencas(antes, entrada, CAMPOS_CONFIGURACAO);
  if (!mudancas.length) return impactoVazio();
  const fechado = await fechadoParaAlteracao(ex);
  if (fechado) return impactoVazio({ mudancas, bloqueio: fechado });

  const avisos: string[] = [];
  const mudou = (k: string) => diferencas(antes, { [k]: entrada[k] }, { [k]: CAMPOS_CONFIGURACAO[k] }).length > 0;
  const afeta = AFETAM_EMENDAS.some(mudou);
  const todas = await contagem({ exercicioId: ex.id });
  const emendas = afeta ? todas : { ...SEM_EMENDAS, rascunhos: todas.rascunhos };
  if (afeta && emendas.enviadas) avisos.push("As emendas já enviadas passam a ser conferidas com os valores novos na próxima validação, na tramitação e nos painéis.");

  // Cota menor: quem já passaria do limite com o que enviou.
  const cotaNova = entrada.cotaIndividual == null || entrada.cotaIndividual === "" ? null : Number(entrada.cotaIndividual);
  if (mudou("cotaIndividual") && cotaNova !== null) {
    const porAutor = await prisma.emenda.groupBy({
      by: ["autorId"],
      where: { exercicioId: ex.id, status: { in: ["SUBMETIDA", "EM_TRAMITACAO", "EM_DILIGENCIA", "APROVADA"] } },
      _sum: { valor: true },
    });
    const acima = porAutor.filter((a) => Number(a._sum.valor ?? 0) > cotaNova + 0.005).length;
    if (acima) avisos.push(`${plural(acima, "vereador já passa", "vereadores já passam")} da nova cota com as emendas enviadas.`);
  }

  // Prazo ou situações do projeto: o envio abre ou fecha hoje?
  if (mudou("prazoProtocolo") || mudou("situacoesEmendamento")) {
    const projeto = await projetoBase(ex.id);
    const base = { ano: ex.ano, exercicioStatus: ex.status, projeto, hoje: hojeBrasilia() };
    const cfg = ex.configuracao;
    const de = situacaoEmendamento({
      ...base,
      situacoesQueAdmitem: cfg?.situacoesEmendamento ?? ["EM_TRAMITACAO"],
      prazoProtocolo: cfg?.prazoProtocolo ? diaBrasilia(cfg.prazoProtocolo) : null,
    });
    const prazo = typeof entrada.prazoProtocolo === "string" && entrada.prazoProtocolo ? entrada.prazoProtocolo.slice(0, 10) : null;
    const para = situacaoEmendamento({
      ...base,
      situacoesQueAdmitem: Array.isArray(entrada.situacoesEmendamento) ? (entrada.situacoesEmendamento as string[]) : cfg?.situacoesEmendamento ?? ["EM_TRAMITACAO"],
      prazoProtocolo: "prazoProtocolo" in entrada ? prazo : cfg?.prazoProtocolo ? diaBrasilia(cfg.prazoProtocolo) : null,
    });
    if (de.aberto !== para.aberto) {
      avisos.push(para.aberto ? `O envio de emendas de ${ex.ano} passa a ficar aberto hoje.` : `O envio de emendas de ${ex.ano} fica fechado a partir de hoje: ${para.explicacao}`);
      const r = rascunhosAviso(todas.rascunhos, para.aberto ? "volta a poder ser enviado." : "deixa de poder ser enviado.");
      if (r) avisos.push(r);
    }
  }
  return impactoVazio({ mudancas, emendas, avisos });
}

// --- exercício: encerrar e reabrir ------------------------------------------

async function impactoStatusExercicio(id: string, status: "ABERTO" | "ENCERRADO"): Promise<Impacto> {
  const ex = await prisma.exercicio.findUnique({ where: { id } });
  if (!ex) return impactoVazio({ bloqueio: "Exercício não encontrado." });
  const rot = (s: string) => (s === "ABERTO" ? "aberto" : "encerrado");
  const mudancas: Mudanca[] = ex.status === status ? [] : [{ campo: `Exercício ${ex.ano}`, antes: rot(ex.status), depois: rot(status) }];
  if (status === "ABERTO") return impactoVazio({ mudancas, avisos: [`O exercício ${ex.ano} volta a receber emendas e alterações, conforme o prazo e a situação do projeto de lei.`] });
  const emendas = await contagem({ exercicioId: ex.id });
  const avisos = [
    `Nenhuma emenda poderá ser criada ou alterada em ${ex.ano}, nem em rascunho.`,
    rascunhosAviso(emendas.rascunhos, "fica bloqueado."),
    emendas.enviadas ? "As emendas enviadas ficam só para consulta; a tramitação e a execução continuam." : null,
  ].filter((x): x is string => !!x);
  return impactoVazio({ mudancas, emendas, avisos });
}

// --- situação do instrumento (projeto de lei) -------------------------------

async function impactoStatusInstrumento(id: string, status: string): Promise<Impacto> {
  const inst = await prisma.instrumentoPlanejamento.findUnique({ where: { id }, include: { exercicio: { include: { configuracao: true } } } });
  if (!inst) return impactoVazio({ bloqueio: "Instrumento não encontrado." });
  const mudancas: Mudanca[] = [{ campo: `Situação do ${inst.numero}`, antes: ROTULO_STATUS_INSTRUMENTO[inst.status] ?? inst.status, depois: ROTULO_STATUS_INSTRUMENTO[status] ?? status }];
  const ex = inst.exercicio;
  const fechado = inst.especie === "PROJETO_LEI" ? await fechadoParaAlteracao(ex) : null;
  if (fechado) return impactoVazio({ mudancas, bloqueio: fechado });
  const projeto = await projetoBase(ex.id);
  if (!projeto || projeto.id !== inst.id) return impactoVazio({ mudancas });
  const cfg = ex.configuracao;
  const base = {
    ano: ex.ano,
    exercicioStatus: ex.status,
    situacoesQueAdmitem: cfg?.situacoesEmendamento ?? ["EM_TRAMITACAO"],
    prazoProtocolo: cfg?.prazoProtocolo ? diaBrasilia(cfg.prazoProtocolo) : null,
    hoje: hojeBrasilia(),
  };
  const de = situacaoEmendamento({ ...base, projeto });
  const para = situacaoEmendamento({ ...base, projeto: { ...projeto, status } });
  if (de.aberto === para.aberto) return impactoVazio({ mudancas });
  const emendas = await contagem({ exercicioId: ex.id });
  const avisos = [
    para.aberto ? `O emendamento de ${ex.ano} passa de fechado para aberto.` : `O emendamento de ${ex.ano} passa de aberto para fechado: ${para.explicacao}`,
    rascunhosAviso(emendas.rascunhos, para.aberto ? "volta a poder ser enviado." : "deixa de poder ser enviado."),
  ].filter((x): x is string => !!x);
  // Fechar ou abrir o emendamento não altera as já enviadas.
  return impactoVazio({ mudancas, avisos, emendas: { ...SEM_EMENDAS, rascunhos: emendas.rascunhos } });
}

// --- regras de validação ----------------------------------------------------

async function impactoRegras(exercicioId: string, regras: { codigo: string; modo: string; ativa: boolean; fundamento: string; normaId: string | null }[]): Promise<Impacto> {
  const ex = await prisma.exercicio.findUnique({ where: { id: exercicioId } });
  if (!ex) return impactoVazio({ bloqueio: "Exercício não encontrado." });
  const atuais = await lerRegras(exercicioId);
  const doExercicio = await prisma.regraValidacao.findMany({ where: { exercicioId } });
  const mudancas: Mudanca[] = [];
  const mudaResultado: string[] = [];
  for (const r of regras) {
    const def = VERIFICACOES.find((v) => v.codigo === r.codigo);
    if (!def?.configuravel) continue;
    const atual = regraDe(def, atuais);
    const rotulo = `(${def.numero}) ${def.titulo}`;
    const modo = (m: string, ativa: boolean) => (!ativa ? "desligada" : m === "ALERTA" ? "só alerta" : "bloqueia");
    const de = modo(atual.modo, atual.ativa);
    const para = modo(r.modo, r.ativa);
    if (de !== para) {
      mudancas.push({ campo: rotulo, antes: de, depois: para });
      mudaResultado.push(r.codigo);
    }
    const anterior = doExercicio.find((x) => x.codigo === r.codigo);
    if ((anterior?.fundamento ?? "") !== (r.fundamento ?? "") || (anterior?.normaId ?? null) !== (r.normaId ?? null)) {
      if (anterior || r.fundamento || r.normaId) mudancas.push({ campo: `${rotulo}: fundamento`, antes: anterior?.fundamento || "padrão do sistema", depois: r.fundamento || "padrão do sistema" });
    }
  }
  if (!mudancas.length) return impactoVazio();
  const fechado = await fechadoParaAlteracao(ex);
  if (fechado) return impactoVazio({ mudancas, bloqueio: fechado });
  if (!mudaResultado.length) return impactoVazio({ mudancas, avisos: ["Só o fundamento muda: o resultado das validações continua o mesmo."] });

  // Emendas enviadas cuja última validação acusou alguma das verificações que
  // mudam de modo: o resultado delas muda na próxima validação.
  const emendas = await prisma.emenda.findMany({
    where: { exercicioId, status: { in: ["SUBMETIDA", "EM_TRAMITACAO", "EM_DILIGENCIA", "APROVADA", "REJEITADA"] } },
    select: { status: true, validacoes: { orderBy: { executadaEm: "desc" }, take: 1, select: { verificacoes: true } } },
  });
  const alcancadas = emendas.filter((e) => {
    const v = (e.validacoes[0]?.verificacoes ?? []) as { codigo?: string; estado?: string }[];
    return v.some((x) => x.codigo && mudaResultado.includes(x.codigo) && x.estado && x.estado !== "conforme");
  });
  const contagemAlc = contar(Object.entries(alcancadas.reduce<Record<string, number>>((t, e) => ({ ...t, [e.status]: (t[e.status] ?? 0) + 1 }), {})).map(([status, n]) => ({ status, n })));
  const avisos = ["A mudança vale a partir da próxima validação de cada emenda."];
  if (contagemAlc.enviadas) avisos.unshift(`Nessas emendas, a verificação alterada foi acusada na última validação: o resultado delas muda.`);
  return impactoVazio({ mudancas, emendas: contagemAlc, avisos });
}

async function impactoParametrosValidacao(exercicioId: string, prazo: number | undefined, fundamentos: Record<string, { texto: string; normaId: string | null }>): Promise<Impacto> {
  const ex = await prisma.exercicio.findUnique({ where: { id: exercicioId }, include: { configuracao: true } });
  if (!ex?.configuracao) return impactoVazio({ bloqueio: "Exercício sem configuração." });
  const cfg = ex.configuracao;
  // A mesma exigência da ação: parâmetro definido leva fundamento por extenso.
  const definidos: [string, string, boolean][] = [
    ["cotaIndividual", "cota individual", cfg.cotaIndividual != null],
    ["percentualSaude", "percentual da saúde", cfg.percentualSaude != null],
    ["prazoProtocolo", "prazo de protocolo", cfg.prazoProtocolo != null],
    ["prazoDiligenciaDias", "prazo da diligência", true],
  ];
  const semFundamento = definidos.filter(([k, , definido]) => definido && !fundamentos[k]?.texto?.trim()).map(([, rotulo]) => rotulo);
  if (semFundamento.length) return impactoVazio({ bloqueio: `Informe o fundamento de: ${semFundamento.join(", ")}.` });
  const mudancas: Mudanca[] = [];
  if (prazo !== undefined && prazo !== cfg.prazoDiligenciaDias) mudancas.push({ campo: "Prazo da diligência", antes: `${cfg.prazoDiligenciaDias} dias`, depois: `${prazo} dias` });
  const antes = (cfg.fundamentos ?? {}) as Record<string, { texto?: string; normaId?: string | null }>;
  const NOMES: Record<string, string> = { cotaIndividual: "cota individual", percentualSaude: "percentual da saúde", prazoProtocolo: "prazo de protocolo", prazoDiligenciaDias: "prazo da diligência", toleranciaValorPct: "tolerância", validadeReferenciaMeses: "validade da referência", validadeLinkEntidadeDias: "validade do link" };
  for (const k of new Set([...Object.keys(antes), ...Object.keys(fundamentos)])) {
    const a = antes[k]?.texto?.trim() ?? "";
    const d = fundamentos[k]?.texto?.trim() ?? "";
    if (a !== d || (antes[k]?.normaId ?? null) !== (fundamentos[k]?.normaId ?? null)) mudancas.push({ campo: `Fundamento: ${NOMES[k] ?? k}`, antes: a || "não informado", depois: d || "não informado" });
  }
  if (!mudancas.length) return impactoVazio();
  const fechado = await fechadoParaAlteracao(ex);
  if (fechado) return impactoVazio({ mudancas, bloqueio: fechado });
  const avisos = mudancas.some((m) => m.campo === "Prazo da diligência") ? ["O prazo novo vale para os próximos pedidos de ajuste; os já feitos mantêm o prazo dado."] : [];
  return impactoVazio({ mudancas, avisos });
}

// --- áreas ------------------------------------------------------------------

async function impactoArea(id: string, orgaos: string[], unidadePadrao: string): Promise<Impacto> {
  const areas = await prisma.areaAplicacao.findMany({ orderBy: { ordem: "asc" } });
  const area = areas.find((a) => a.id === id);
  if (!area) return impactoVazio({ bloqueio: "Área não encontrada." });
  const mudancas = diferencas({ orgaos: area.orgaos, unidadePadrao: area.unidadePadrao }, { orgaos, unidadePadrao: unidadePadrao || null }, {
    orgaos: { rotulo: `Órgãos de ${area.nome}`, formato: "lista" },
    unidadePadrao: { rotulo: `Unidade padrão de ${area.nome}` },
  });
  if (!mudancas.length) return impactoVazio();
  const novas = areas.map((a) => (a.id === id ? { ...a, orgaos } : a));
  const emendas = await prisma.emenda.findMany({
    where: { status: { in: ["SUBMETIDA", "EM_TRAMITACAO", "EM_DILIGENCIA", "APROVADA", "REJEITADA"] }, dotacaoId: { not: null } },
    select: { status: true, dotacao: { select: { unidadeOrcamentaria: { select: { codigo: true } } } } },
  });
  const mudam = emendas.filter((e) => {
    const uo = e.dotacao?.unidadeOrcamentaria.codigo;
    return areaDaUnidade(uo, areas) !== areaDaUnidade(uo, novas);
  });
  const emendasMudam = contar(Object.entries(mudam.reduce<Record<string, number>>((t, e) => ({ ...t, [e.status]: (t[e.status] ?? 0) + 1 }), {})).map(([status, n]) => ({ status, n })));
  const avisos = emendasMudam.enviadas ? ["Nessas emendas a área muda: a parcela (saúde ou demais áreas), os painéis por área e os filtros passam a refletir a nova divisão."] : ["Nenhuma emenda enviada muda de área com esta alteração."];
  return impactoVazio({ mudancas, emendas: emendasMudam, avisos });
}

// --- destinos ---------------------------------------------------------------

async function impactoDestinoAtivo(id: string): Promise<Impacto> {
  const d = await prisma.destino.findUnique({ where: { id } });
  if (!d) return impactoVazio({ bloqueio: "Destino não encontrado." });
  const mudancas: Mudanca[] = [{ campo: d.nome, antes: d.ativo ? "ativo" : "inativo", depois: d.ativo ? "inativo" : "ativo" }];
  if (!d.ativo) return impactoVazio({ mudancas, avisos: ["O destino volta a aparecer para quem apresenta emendas."] });
  const emendas = await contagem({ destinoId: id });
  if (emendas.enviadas) {
    return impactoVazio({
      mudancas,
      emendas,
      bloqueio: `Há ${plural(emendas.enviadas, "emenda enviada", "emendas enviadas")} para “${d.nome}”: o destino não pode ser desativado. Se for uma grafia repetida, use “Mesclar” para juntar com o cadastro certo.`,
    });
  }
  const avisos = ["O destino deixa de aparecer para quem apresenta emendas."];
  const r = rascunhosAviso(emendas.rascunhos, "aponta para ele e precisará trocar de destino antes do envio.");
  if (r) avisos.push(r);
  return impactoVazio({ mudancas, emendas, avisos });
}

async function impactoMesclar(manterId: string, removerId: string): Promise<Impacto> {
  const [manter, remover] = await Promise.all([prisma.destino.findUnique({ where: { id: manterId } }), prisma.destino.findUnique({ where: { id: removerId } })]);
  if (!manter || !remover) return impactoVazio({ bloqueio: "Beneficiário não encontrado." });
  const emendas = await contagem({ destinoId: removerId });
  const mudancas: Mudanca[] = [{ campo: "Beneficiário", antes: remover.nome, depois: manter.nome }];
  const avisos = [`“${remover.nome}” fica inativo e passa a ser grafia alternativa de “${manter.nome}”.`];
  const total = emendas.enviadas + emendas.rascunhos;
  if (total) avisos.push(`${plural(total, "emenda passa", "emendas passam")} a apontar para “${manter.nome}”.`);
  return impactoVazio({ mudancas, emendas, avisos });
}

// --- normas, objetos, usuários ----------------------------------------------

async function impactoNormaAtiva(id: string): Promise<Impacto> {
  const n = await prisma.documentoNormativo.findUnique({ where: { id } });
  if (!n) return impactoVazio({ bloqueio: "Norma não encontrada." });
  const mudancas: Mudanca[] = [{ campo: n.titulo, antes: n.ativo ? "ativa" : "inativa", depois: n.ativo ? "inativa" : "ativa" }];
  if (!n.ativo) return impactoVazio({ mudancas });
  const avisos: string[] = [];
  if (n.tipo === "LOM" || n.tipo === "REGIMENTO_INTERNO") {
    avisos.push(`${n.tipo === "LOM" ? "A Lei Orgânica" : "O Regimento Interno"} deixa de valer como base: a conformidade passa a acusar pendência e o manual público perde a referência.`);
  }
  const manual = await prisma.municipio.findFirst({ where: { manualAtoId: id }, select: { id: true } });
  if (manual) avisos.push("Esta norma institui o manual orientativo: o manual deixa de constar como instituído.");
  const regras = await prisma.regraValidacao.count({ where: { normaId: id } });
  if (regras) avisos.push(`${plural(regras, "regra de validação cita", "regras de validação citam")} esta norma como fundamento.`);
  return impactoVazio({ mudancas, avisos });
}

async function impactoObjetoAtivo(id: string): Promise<Impacto> {
  const o = await prisma.objetoBiblioteca.findUnique({ where: { id } });
  if (!o) return impactoVazio({ bloqueio: "Objeto não encontrado." });
  const mudancas: Mudanca[] = [{ campo: o.rotulo, antes: o.ativo ? "ativo" : "inativo", depois: o.ativo ? "inativo" : "ativo" }];
  return impactoVazio({
    mudancas,
    avisos: o.ativo
      ? ["Emendas novas deixam de ter este objeto reconhecido pelo sistema. As emendas já enviadas continuam válidas como estão."]
      : ["O sistema volta a reconhecer este objeto nas próximas análises."],
  });
}

async function emendasDoUsuario(usuarioId: string): Promise<ContagemEmendas | null> {
  const autor = await prisma.autor.findUnique({ where: { usuarioId }, select: { id: true } });
  return autor ? contagem({ autorId: autor.id }) : null;
}

async function impactoUsuarioAtivo(id: string): Promise<Impacto> {
  const u = await prisma.user.findUnique({ where: { id }, include: { perfil: true } });
  if (!u) return impactoVazio({ bloqueio: "Usuário não encontrado." });
  const mudancas: Mudanca[] = [{ campo: u.name ?? u.email ?? "Usuário", antes: u.ativo ? "ativo" : "desativado", depois: u.ativo ? "desativado" : "ativo" }];
  if (!u.ativo) return impactoVazio({ mudancas, avisos: ["A pessoa volta a entrar no sistema com o perfil que tinha."] });
  const avisos = ["A pessoa não entra mais; se estiver com o sistema aberto, a sessão cai na próxima ação."];
  const e = await emendasDoUsuario(id);
  if (e && (e.enviadas || e.rascunhos)) {
    avisos.push(`As emendas de autoria dela continuam no sistema (${plural(e.enviadas, "enviada", "enviadas")}, ${plural(e.rascunhos, "rascunho", "rascunhos")}); os rascunhos ficam parados até alguém reativar a conta.`);
  }
  return impactoVazio({ mudancas, avisos });
}

async function impactoPerfilUsuario(usuarioId: string, perfilId: string | null): Promise<Impacto> {
  const [u, novo] = await Promise.all([
    prisma.user.findUnique({ where: { id: usuarioId }, include: { perfil: true } }),
    perfilId ? prisma.perfilAcesso.findUnique({ where: { id: perfilId } }) : Promise.resolve(null),
  ]);
  if (!u) return impactoVazio({ bloqueio: "Usuário não encontrado." });
  const mudancas: Mudanca[] = [{ campo: `Perfil de ${u.name ?? u.email ?? "usuário"}`, antes: u.perfil?.nome ?? "sem acesso", depois: novo?.nome ?? "sem acesso" }];
  const avisos = ["As permissões novas valem na próxima ação da pessoa, sem novo login."];
  if (u.perfil?.apresentarEmendas && !novo?.apresentarEmendas) {
    const e = await emendasDoUsuario(usuarioId);
    if (e?.rascunhos) avisos.push(`Com o perfil novo a pessoa não apresenta emendas: ${plural(e.rascunhos, "rascunho dela fica parado", "rascunhos dela ficam parados")}.`);
  }
  return impactoVazio({ mudancas, avisos });
}

// --- comparativo: gerar a base da lei ---------------------------------------

async function impactoGerarLei(ano: number): Promise<Impacto> {
  const ex = await prisma.exercicio.findUnique({ where: { ano } });
  if (!ex) return impactoVazio({ bloqueio: "Exercício não encontrado." });
  const projeto = await projetoBase(ex.id);
  if (!projeto) return impactoVazio({ bloqueio: "O exercício não tem projeto de lei com base carregada." });
  const [dotacoes, incorporadas] = await Promise.all([
    prisma.dotacao.count({ where: { instrumentoId: projeto.id, ativo: true } }),
    prisma.emenda.count({ where: { exercicioId: ex.id, incorporadaEm: { not: null } } }),
  ]);
  return impactoVazio({
    avisos: [
      `A lei aprovada de ${ano} recebe ${plural(dotacoes, "dotação", "dotações")}, copiadas do ${projeto.numero}.`,
      incorporadas
        ? `${plural(incorporadas, "emenda incorporada à lei entra", "emendas incorporadas à lei entram")} no valor das dotações.`
        : "Nenhuma emenda está marcada como incorporada à lei: a base gerada fica igual ao projeto.",
    ],
  });
}

export async function calcularImpacto(p: PedidoImpacto): Promise<Impacto> {
  switch (p.tipo) {
    case "configuracao":
      return impactoConfiguracao(p.entrada);
    case "statusExercicio":
      return impactoStatusExercicio(p.id, p.status);
    case "statusInstrumento":
      return impactoStatusInstrumento(p.id, p.status);
    case "regras":
      return impactoRegras(p.exercicioId, p.regras);
    case "parametrosValidacao":
      return impactoParametrosValidacao(p.exercicioId, p.prazoDiligenciaDias, p.fundamentos);
    case "area":
      return impactoArea(p.id, p.orgaos, p.unidadePadrao);
    case "destinoAtivo":
      return impactoDestinoAtivo(p.id);
    case "mesclar":
      return impactoMesclar(p.manterId, p.removerId);
    case "normaAtiva":
      return impactoNormaAtiva(p.id);
    case "objetoAtivo":
      return impactoObjetoAtivo(p.id);
    case "usuarioAtivo":
      return impactoUsuarioAtivo(p.id);
    case "perfilUsuario":
      return impactoPerfilUsuario(p.usuarioId, p.perfilId);
    case "gerarLei":
      return impactoGerarLei(p.ano);
  }
}

// Usada pelas ações antes de gravar: o servidor recalcula e não confia no
// navegador. Devolve o motivo da recusa, ou nada.
export async function recusaPorImpacto(p: PedidoImpacto, ciente: boolean | undefined): Promise<string | null> {
  return conferirCiencia(await calcularImpacto(p), ciente);
}
