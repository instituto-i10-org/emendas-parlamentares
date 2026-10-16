import type { DotacaoBase } from "./base";
import { parcelaDaDotacao, parcelaSaude, totalParcela } from "./cota";
import { BRL } from "./texto";
import type { Aplicado, Checagem, ConfigMotor, ParteCota } from "./tipos";

// ============================================================================
// As treze verificações da emenda (sempre as mesmas, na mesma ordem), cada uma
// em um de três estados — conforme, alerta ou falha — com a razão em
// linguagem do autor e o fundamento. A emenda é inválida quando há ao menos
// uma falha. As conferências do motor RIEP continuam, logo abaixo, como
// complementares.
//
// Modo: as verificações em que a norma local admite discricionariedade são
// configuráveis (bloqueante ou alerta, ligada ou desligada); as demais são
// fixas. A regra vem do banco (Configurações), não do programa.
//
// Em Mogi Guaçu toda emenda é impositiva, sem dotação de origem: a (x) só
// confirma isso, e o plano de trabalho é exigido de todo beneficiário.
// ============================================================================

export type EstadoVerificacao = "conforme" | "alerta" | "falha";
export type ModoRegra = "BLOQUEANTE" | "ALERTA";

export type CodigoVerificacao =
  | "CAMPOS_PREENCHIDOS"
  | "EXERCICIO_ABERTO"
  | "INSTRUMENTO_ABERTO"
  | "DOTACAO_EXISTE"
  | "PROGRAMA_NO_PPA"
  | "ACAO_NO_PROGRAMA"
  | "CLASSIFICACAO_COMPLETA"
  | "ADERENCIA_LDO"
  | "COTA_AUTOR"
  | "TIPO_COERENTE"
  | "LIMITE_DEMAIS_AREAS"
  | "SAUDE_SEM_PESSOAL"
  | "PLANO_TRABALHO";

export type DefinicaoVerificacao = {
  codigo: CodigoVerificacao;
  numero: string;
  titulo: string;
  // Configurável: o modo e a ativação vêm da regra; fixo: sempre bloqueante.
  configuravel: boolean;
  desligavel: boolean;
  padrao: ModoRegra;
  fundamento: string;
  porQueFixa?: string;
};

export const VERIFICACOES: DefinicaoVerificacao[] = [
  { codigo: "CAMPOS_PREENCHIDOS", numero: "i", titulo: "Emenda preenchida", configuravel: false, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Regimento Interno: requisitos formais da emenda", porQueFixa: "Sem objeto, justificativa e valor não há emenda a analisar." },
  { codigo: "EXERCICIO_ABERTO", numero: "ii", titulo: "Exercício admite emendamento na data", configuravel: false, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Lei Orgânica e Regimento Interno: prazo de apresentação das emendas", porQueFixa: "O prazo de apresentação é da lei, não da configuração." },
  { codigo: "INSTRUMENTO_ABERTO", numero: "iii", titulo: "Projeto de lei recebe emendas", configuravel: false, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Constituição Federal, art. 166, § 5º", porQueFixa: "Projeto que não está em tramitação não se emenda." },
  { codigo: "DOTACAO_EXISTE", numero: "iv", titulo: "Dotação existe no projeto e no exercício", configuravel: false, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Lei 4.320/1964, art. 15", porQueFixa: "A emenda só incide sobre dotação do projeto em análise." },
  { codigo: "PROGRAMA_NO_PPA", numero: "v", titulo: "Programa previsto no PPA", configuravel: true, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Constituição Federal, art. 166, § 3º, I" },
  { codigo: "ACAO_NO_PROGRAMA", numero: "vi", titulo: "Ação coerente com o programa", configuravel: true, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Portaria MOG 42/1999 (vínculo entre ação e programa)" },
  { codigo: "CLASSIFICACAO_COMPLETA", numero: "vii", titulo: "Classificação completa", configuravel: false, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Portaria Interministerial STN/SOF 163/2001", porQueFixa: "Sem todos os componentes a dotação não é executável." },
  { codigo: "ADERENCIA_LDO", numero: "viii", titulo: "Aderência às prioridades e metas da LDO", configuravel: true, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Constituição Federal, art. 166, § 3º, I" },
  { codigo: "COTA_AUTOR", numero: "ix", titulo: "Cota individual do autor", configuravel: true, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Constituição Federal, art. 166, § 9º; Lei Orgânica" },
  { codigo: "TIPO_COERENTE", numero: "x", titulo: "Coerência do tipo de emenda", configuravel: false, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Constituição Federal, art. 166, § 3º, II", porQueFixa: "Origem e destino válidos e saldo suficiente são condição da própria alteração." },
  { codigo: "LIMITE_DEMAIS_AREAS", numero: "xi", titulo: "Limite das demais áreas e parcela da saúde", configuravel: true, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Constituição Federal, art. 166, § 9º" },
  { codigo: "SAUDE_SEM_PESSOAL", numero: "xii", titulo: "Saúde sem pessoal e encargos", configuravel: true, desligavel: true, padrao: "BLOQUEANTE", fundamento: "Constituição Federal, art. 166, § 10" },
  { codigo: "PLANO_TRABALHO", numero: "xiii", titulo: "Plano de trabalho preenchido", configuravel: true, desligavel: false, padrao: "BLOQUEANTE", fundamento: "Lei 13.019/2014, arts. 22 e 35" },
];

export type Verificacao = {
  codigo: CodigoVerificacao;
  numero: string;
  titulo: string;
  estado: EstadoVerificacao;
  razao: string;
  fundamento: string;
  modo: ModoRegra | "FIXO";
};

// Regras locais, além das treze: limites próprios do município (Lei Orgânica,
// LDO, Regimento). Desligadas por padrão; quando ligadas, entram nas
// conferências complementares e, se bloqueantes, impedem a remessa.
export type RegraLocal = { codigo: string; titulo: string; descricao: string; parametros: { chave: string; rotulo: string; tipo: "valor" | "quantidade" }[] };
export const REGRAS_LOCAIS: RegraLocal[] = [
  {
    codigo: "VALOR_MINIMO",
    titulo: "Valor mínimo por emenda",
    descricao: "Abaixo do mínimo a emenda não passa. A execução indireta (entidade sem fins lucrativos) pode ter mínimo próprio.",
    parametros: [
      { chave: "geral", rotulo: "Mínimo geral (R$)", tipo: "valor" },
      { chave: "entidade", rotulo: "Mínimo para entidade sem fins lucrativos (R$)", tipo: "valor" },
    ],
  },
  {
    codigo: "QUANTIDADE_MAXIMA",
    titulo: "Quantidade máxima de emendas por vereador",
    descricao: "Conta as emendas que o vereador já apresentou no exercício, em cada parcela.",
    parametros: [
      { chave: "demais", rotulo: "Destinação livre", tipo: "quantidade" },
      { chave: "saude", rotulo: "Saúde", tipo: "quantidade" },
    ],
  },
  {
    codigo: "DECLARACAO_CONFLITO",
    titulo: "Declaração de conflito de interesses obrigatória para entidade",
    descricao: "Na execução indireta (entidade sem fins lucrativos), a declaração de vínculo passa a abranger vínculo societário, de direção ou de administração e conflito de interesses, e sem ela a emenda não é remetida.",
    parametros: [],
  },
  {
    codigo: "SEM_PESSOAL_DIVIDA",
    titulo: "Vedação de pessoal, encargos e dívida em qualquer área",
    descricao: "A emenda não paga pessoal e encargos sociais (grupo 1) nem a dívida (grupos 2 e 6), seja qual for a área.",
    parametros: [],
  },
];
export const CODIGOS_REGRAS_LOCAIS = new Set(REGRAS_LOCAIS.map((r) => r.codigo));

export type RegraEfetiva = { modo: ModoRegra; ativa: boolean; fundamento: string | null; parametros?: Record<string, unknown> | null };
export type Regras = Partial<Record<string, RegraEfetiva>>;

export type EntradaVerificacao = {
  objeto: string;
  justificativa: string;
  // Valor da emenda: o informado no passo 1 (sem ele, a soma da planilha).
  valor: number;
  destino: DotacaoBase | null;
  // Dotação informada pelo vereador fora da LOA: o que depende dela não se
  // confere (alerta), nunca passa como conforme.
  informadaForaDaLoa?: boolean;
};

export type ContextoVerificacao = {
  config: ConfigMotor;
  aplicado: Aplicado;
  // Coautoria: as partes de cada vereador (sem ela, a emenda é toda do autor).
  partes?: ParteCota[];
  emendamento: { aberto: boolean; motivo: string | null; explicacao: string };
  // Reenvio depois de diligência: o prazo de protocolo não o alcança.
  reenvio: boolean;
  // Base ativa do projeto de lei (ids), para conferir a dotação.
  base: Map<string, DotacaoBase>;
  ppaCadastrado: boolean;
  ldo: { cadastrada: boolean; programas: Set<string>; acoes: Set<string> };
  regras: Regras;
};

const centavos = (v: number) => Math.round(v * 100);

export function regraDe(def: DefinicaoVerificacao, regras: Regras): { modo: ModoRegra | "FIXO"; ativa: boolean; fundamento: string } {
  if (!def.configuravel) return { modo: "FIXO", ativa: true, fundamento: regras[def.codigo]?.fundamento || def.fundamento };
  const r = regras[def.codigo];
  return { modo: r?.modo ?? def.padrao, ativa: def.desligavel ? r?.ativa ?? true : true, fundamento: r?.fundamento || def.fundamento };
}

// Problema numa verificação: falha se a regra é bloqueante; alerta se não.
const problema = (modo: ModoRegra | "FIXO"): EstadoVerificacao => (modo === "ALERTA" ? "alerta" : "falha");

// As treze, a partir da emenda e das conferências do motor RIEP
// (complementares), que alimentam o plano de trabalho (xiii).
export function verificar(e: EntradaVerificacao, ctx: ContextoVerificacao, complementares: Checagem[]): { verificacoes: Verificacao[]; valida: boolean } {
  const res = new Map<CodigoVerificacao, { estado: EstadoVerificacao; razao: string }>();
  const regra = (c: CodigoVerificacao) => regraDe(VERIFICACOES.find((v) => v.codigo === c)!, ctx.regras);
  const d = e.destino;

  // (i) preenchida
  {
    const falta = [!e.objeto.trim() && "objeto", e.justificativa.trim().length < 20 && "justificativa", !(e.valor > 0) && "valor maior que zero"].filter(Boolean);
    res.set("CAMPOS_PREENCHIDOS", falta.length ? { estado: "falha", razao: `Falta: ${falta.join(", ")}.` } : { estado: "conforme", razao: "Objeto, justificativa e valor informados." });
  }
  // (ii) exercício e prazo
  {
    const m = ctx.emendamento.motivo;
    const fecha = m === "EXERCICIO_ENCERRADO" || (m === "PRAZO_ENCERRADO" && !ctx.reenvio);
    res.set(
      "EXERCICIO_ABERTO",
      fecha
        ? { estado: "falha", razao: ctx.emendamento.explicacao }
        : { estado: "conforme", razao: m === "PRAZO_ENCERRADO" ? "Reenvio depois de diligência: o prazo de protocolo não se aplica." : `Exercício ${ctx.config.exercicio} aberto, dentro do prazo.` }
    );
  }
  // (iii) projeto de lei em situação que admite emenda
  {
    const m = ctx.emendamento.motivo;
    res.set("INSTRUMENTO_ABERTO", m === "INSTRUMENTO_FECHADO" || m === "SEM_PROJETO" ? { estado: "falha", razao: ctx.emendamento.explicacao } : { estado: "conforme", razao: "O projeto de lei está em situação que recebe emendas." });
  }
  const fora = !!e.informadaForaDaLoa && !!d;
  const naoConferivel = { estado: "alerta" as const, razao: "Não conferível: dotação informada pelo vereador, não encontrada na LOA." };
  // (iv) dotação existe no projeto e no exercício
  if (fora) res.set("DOTACAO_EXISTE", { estado: "alerta", razao: "Dotação informada pelo vereador, não encontrada na LOA. A classificação é de responsabilidade dele (declaração na emenda)." });
  else res.set(
    "DOTACAO_EXISTE",
    !d
      ? { estado: "falha", razao: "A emenda ainda não tem dotação: rode a análise no passo 1 e escolha entre as opções, se houver." }
      : !ctx.base.has(d.id)
        ? { estado: "falha", razao: "A dotação escolhida não está mais na base do projeto de lei. Rode a análise de novo." }
        : { estado: "conforme", razao: `Dotação ${d.codigo}${d.ficha ? ` (ficha ${d.ficha})` : ""}, no projeto em análise.` }
  );
  // (v) programa no PPA
  {
    const r = regra("PROGRAMA_NO_PPA");
    if (!d) res.set("PROGRAMA_NO_PPA", { estado: "falha", razao: "Sem dotação, não há programa a conferir." });
    else if (fora) res.set("PROGRAMA_NO_PPA", naoConferivel);
    else if (!ctx.ppaCadastrado) res.set("PROGRAMA_NO_PPA", { estado: "alerta", razao: "O PPA do exercício não foi carregado: não há como conferir o programa. Carregue o PPA em Planejamento." });
    else if (d.constaNoPPA) res.set("PROGRAMA_NO_PPA", { estado: "conforme", razao: `O programa ${d.prog} consta do PPA.` });
    else res.set("PROGRAMA_NO_PPA", { estado: problema(r.modo), razao: `O programa ${d.prog} — ${d.progn} não consta do PPA vigente.` });
  }
  // (vi) ação pertence ao programa
  {
    const r = regra("ACAO_NO_PROGRAMA");
    if (!d) res.set("ACAO_NO_PROGRAMA", { estado: "falha", razao: "Sem dotação, não há ação a conferir." });
    else if (fora) res.set("ACAO_NO_PROGRAMA", naoConferivel);
    else if (d.acaoPrograma === d.prog) res.set("ACAO_NO_PROGRAMA", { estado: "conforme", razao: `A ação ${d.acaoCodigo} pertence ao programa ${d.prog}.` });
    else res.set("ACAO_NO_PROGRAMA", { estado: problema(r.modo), razao: `A ação ${d.acaoCodigo} é do programa ${d.acaoPrograma}, e a dotação está no programa ${d.prog}.` });
  }
  // (vii) classificação completa
  if (fora) res.set("CLASSIFICACAO_COMPLETA", naoConferivel);
  else res.set(
    "CLASSIFICACAO_COMPLETA",
    !d
      ? { estado: "falha", razao: "Sem dotação, não há classificação a conferir." }
      : !d.completa
        ? { estado: "falha", razao: `A dotação ${d.codigo} não tem todos os componentes da classificação.` }
        : { estado: "conforme", razao: "Órgão, unidade, função, subfunção, programa, ação, natureza e fonte presentes." }
  );
  // (viii) aderência à LDO
  {
    const r = regra("ADERENCIA_LDO");
    if (!d) res.set("ADERENCIA_LDO", { estado: "falha", razao: "Sem dotação, não há programa a conferir." });
    else if (fora) res.set("ADERENCIA_LDO", naoConferivel);
    else if (!ctx.ldo.cadastrada) res.set("ADERENCIA_LDO", { estado: "alerta", razao: "As prioridades e metas da LDO não foram carregadas: não há como conferir a aderência. Carregue a LDO em Planejamento." });
    else if (ctx.ldo.acoes.has(`${d.prog}|${d.acaoCodigo}`) || ctx.ldo.programas.has(d.prog)) res.set("ADERENCIA_LDO", { estado: "conforme", razao: `O programa ${d.prog} está entre as prioridades e metas da LDO.` });
    else res.set("ADERENCIA_LDO", { estado: problema(r.modo), razao: `O programa ${d.prog} — ${d.progn} não está entre as prioridades e metas da LDO.` });
  }
  // (ix) cota e (xi) demais áreas / saúde
  const cfg = ctx.config;
  const apl = ctx.aplicado;
  if (cfg.cotaIndividual === null) {
    res.set("COTA_AUTOR", { estado: "falha", razao: `A cota individual do exercício ${cfg.exercicio} não está parametrizada. Peça à administração para configurá-la.` });
    res.set("LIMITE_DEMAIS_AREAS", { estado: "falha", razao: "Sem a cota parametrizada não há limite a conferir." });
  } else {
    const rCota = regra("COTA_AUTOR");
    const rLim = regra("LIMITE_DEMAIS_AREAS");
    const cotaIndividual = cfg.cotaIndividual;
    const p = parcelaDaDotacao(d);
    type Res = { estado: EstadoVerificacao; razao: string };
    // Uma parte: o já aplicado pelo dono dela mais o valor que ela leva.
    const conferir = (apl: Aplicado, valor: number): { cota: Res; lim: Res | null } => {
      const total = apl.saude + apl.demais + valor;
      const cota: Res =
        centavos(total) <= centavos(cotaIndividual)
          ? { estado: "conforme", razao: `${BRL(total)} de ${BRL(cotaIndividual)} da cota · restam ${BRL(cotaIndividual - total)}.` }
          : { estado: problema(rCota.modo), razao: `Com esta emenda o autor chegaria a ${BRL(total)}, acima da cota de ${BRL(cotaIndividual)}.` };
      if (!p) return { cota, lim: null };
      const tp = totalParcela(cfg, p)!;
      const ap = (p === "SAUDE" ? apl.saude : apl.demais) + valor;
      const ps = parcelaSaude(cfg)!;
      const aplS = apl.saude + (p === "SAUDE" ? valor : 0);
      const aplD = apl.demais + (p === "DEMAIS" ? valor : 0);
      let lim: Res;
      if (p === "SAUDE") {
        lim =
          centavos(ap) <= centavos(tp)
            ? { estado: "conforme", razao: `Ação e serviço público de saúde: conta para o mínimo de ${cfg.percentualSaude}%. ${BRL(aplS)} aplicados em saúde.` }
            : { estado: problema(rLim.modo), razao: `A parcela de saúde é de ${BRL(tp)} e chegaria a ${BRL(ap)}.` };
      } else if (centavos(ap) > centavos(tp)) {
        lim = { estado: problema(rLim.modo), razao: `As demais áreas podem receber até ${BRL(tp)} e chegariam a ${BRL(ap)}: a parcela mínima da saúde (${BRL(ps)}) fica resguardada.` };
      } else if (cfg.afericaoSaude === "GLOBAL" && cotaIndividual - aplS - aplD < ps - aplS) {
        lim = { estado: problema(rLim.modo), razao: `O mínimo em saúde (${BRL(ps)}) deixaria de ser alcançável com a cota restante.` };
      } else {
        lim = { estado: "conforme", razao: `${BRL(ap)} de ${BRL(tp)} nas demais áreas · a parcela mínima da saúde segue resguardada.` };
      }
      return { cota, lim };
    };
    // Coautoria: cada parte contra a cota do dono; vale a pior, com o nome à
    // frente de cada razão.
    const partes = ctx.partes && ctx.partes.length > 1 ? ctx.partes : null;
    const juntar = (rs: { nome: string; r: Res }[]): Res => {
      const pior = rs.some((x) => x.r.estado === "falha") ? "falha" : rs.some((x) => x.r.estado === "alerta") ? "alerta" : "conforme";
      return { estado: pior, razao: rs.map((x) => `${x.nome}: ${x.r.razao.replace("Com esta emenda o autor chegaria", "com esta emenda chegaria")}`).join(" ") };
    };
    if (partes) {
      const rs = partes.map((x) => ({ nome: x.nome, ...conferir(x.aplicado, x.valor) }));
      res.set("COTA_AUTOR", juntar(rs.map((x) => ({ nome: x.nome, r: x.cota }))));
      if (p) res.set("LIMITE_DEMAIS_AREAS", juntar(rs.map((x) => ({ nome: x.nome, r: x.lim! }))));
    } else {
      const r = conferir(apl, e.valor);
      res.set("COTA_AUTOR", r.cota);
      if (r.lim) res.set("LIMITE_DEMAIS_AREAS", r.lim);
    }
    if (!p) res.set("LIMITE_DEMAIS_AREAS", { estado: "falha", razao: "Sem dotação de destino não há como saber a parcela (saúde ou demais áreas)." });
    else {
      // Dentro do limite, mas a parcela saiu da funcional digitada, sem a LOA.
      const x = res.get("LIMITE_DEMAIS_AREAS")!;
      if (fora && x.estado === "conforme") {
        res.set("LIMITE_DEMAIS_AREAS", { estado: "alerta", razao: `Não conferível na LOA: parcela de ${p === "SAUDE" ? "saúde" : "demais áreas"} pela funcional informada. ${x.razao}` });
      }
    }
  }
  // (x) coerência do tipo: toda emenda é impositiva, sem origem a conferir.
  res.set("TIPO_COERENTE", { estado: "conforme", razao: "Emenda impositiva: não é remanejamento nem anulação; não há origem a conferir." });
  // (xii) parcela da saúde sem pessoal e encargos
  {
    const r = regra("SAUDE_SEM_PESSOAL");
    if (!r.ativa) res.set("SAUDE_SEM_PESSOAL", { estado: "conforme", razao: "Vedação não prevista na Lei Orgânica (regra desligada em Configurações)." });
    else if (d && parcelaDaDotacao(d) === "SAUDE" && d.gnd === "1") res.set("SAUDE_SEM_PESSOAL", { estado: problema(r.modo), razao: `A dotação ${d.codigo} é de pessoal e encargos sociais (${d.natureza}) e a parcela da saúde não pode pagá-los.` });
    else if (fora) res.set("SAUDE_SEM_PESSOAL", naoConferivel);
    else res.set("SAUDE_SEM_PESSOAL", { estado: "conforme", razao: d && parcelaDaDotacao(d) === "SAUDE" ? "Dotação de saúde fora de pessoal e encargos." : "A dotação não é da parcela de saúde." });
  }
  // (xiii) plano de trabalho, exigido de todo beneficiário
  {
    const r = regra("PLANO_TRABALHO");
    const faltas = pendenciasPlano(complementares);
    res.set("PLANO_TRABALHO", faltas.length ? { estado: problema(r.modo), razao: `Plano de trabalho incompleto: ${faltas.join("; ")}.` } : { estado: "conforme", razao: "Plano de trabalho completo." });
  }

  const verificacoes: Verificacao[] = VERIFICACOES.map((def) => {
    const x = res.get(def.codigo)!;
    const rg = regraDe(def, ctx.regras);
    return { codigo: def.codigo, numero: def.numero, titulo: def.titulo, estado: x.estado, razao: x.razao, fundamento: rg.fundamento, modo: rg.modo };
  });
  const valida = verificacoes.every((v) => v.estado !== "falha") && complementares.every((c) => c.nivel !== "bad");
  return { verificacoes, valida };
}

// O que falta no plano, a partir das conferências do motor RIEP.
function pendenciasPlano(checks: Checagem[]): string[] {
  const mapa: [string, string][] = [
    ["Metas incompletas", "metas físicas"],
    ["Meta finalística ausente", "meta finalística"],
    ["Memória de cálculo vazia", "planilha orçamentária"],
    ["Planilha fora da tolerância", "total da planilha fora da tolerância do valor da emenda"],
    ["Linha sem fonte de preço", "fonte do preço em cada item"],
    ["Agente executor ausente", "agente executor"],
    ["Cronograma não confere", "cronograma igual ao valor"],
  ];
  return mapa.filter(([titulo]) => checks.some((c) => c.titulo === titulo && c.nivel === "bad")).map(([, falta]) => falta);
}

// Conferências das regras locais ligadas. `quantidade` é o que o autor já
// apresentou no exercício, por parcela (sem a emenda em edição).
export function conferenciasLocais(
  e: { valor: number; destino: Pick<DotacaoBase, "gnd" | "funcao" | "subf"> | null; entidade: boolean; quantidade?: { saude: number; demais: number } | null; declaracao?: boolean },
  regras: Regras
): Checagem[] {
  const out: Checagem[] = [];
  const nivel = (modo: ModoRegra): Checagem["nivel"] => (modo === "ALERTA" ? "warn" : "bad");
  const fund = (r: RegraEfetiva) => (r.fundamento ? ` (${r.fundamento.trim().replace(/\.$/, "")})` : "");
  const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
  const vm = regras.VALOR_MINIMO;
  if (vm?.ativa) {
    const p = vm.parametros ?? {};
    const minimo = (e.entidade ? num(p.entidade) : null) ?? num(p.geral);
    if (minimo && e.valor > 0) {
      out.push(
        centavos(e.valor) >= centavos(minimo)
          ? { nivel: "ok", titulo: "Valor mínimo da emenda", detalhe: `${BRL(e.valor)}, não abaixo do mínimo de ${BRL(minimo)}${fund(vm)}.` }
          : { nivel: nivel(vm.modo), titulo: "Abaixo do valor mínimo", detalhe: `O mínimo por emenda${e.entidade && num(p.entidade) ? " para entidade sem fins lucrativos" : ""} é ${BRL(minimo)}${fund(vm)}.` }
      );
    }
  }
  const dc = regras.DECLARACAO_CONFLITO;
  if (dc?.ativa && e.entidade && !e.declaracao) {
    out.push({ nivel: nivel(dc.modo), titulo: "Declaração de conflito de interesses pendente", detalhe: `Emenda para entidade: marque a declaração de inexistência de vínculo e de conflito de interesses${fund(dc)}.`, declaracao: true });
  }
  const vd = regras.SEM_PESSOAL_DIVIDA;
  if (vd?.ativa && e.destino) {
    const g = e.destino.gnd;
    const vedado = g === "1" ? "pessoal e encargos sociais" : g === "2" || g === "6" ? "dívida" : null;
    out.push(
      vedado
        ? { nivel: nivel(vd.modo), titulo: "Despesa vedada à emenda", detalhe: `A dotação é de ${vedado} (grupo ${g}), vedada às emendas individuais${fund(vd)}.` }
        : { nivel: "ok", titulo: "Fora de pessoal e dívida", detalhe: "A dotação não é de pessoal, encargos sociais ou dívida." }
    );
  }
  const qm = regras.QUANTIDADE_MAXIMA;
  if (qm?.ativa && e.quantidade && e.destino) {
    const p = qm.parametros ?? {};
    const saude = parcelaDaDotacao(e.destino) === "SAUDE";
    const max = num(saude ? p.saude : p.demais);
    const ja = saude ? e.quantidade.saude : e.quantidade.demais;
    const nome = saude ? "de saúde" : "de destinação livre";
    if (max) {
      out.push(
        ja + 1 <= max
          ? { nivel: "ok", titulo: "Quantidade de emendas", detalhe: `Esta é a ${ja + 1}ª de até ${max} emendas ${nome}.` }
          : { nivel: nivel(qm.modo), titulo: "Quantidade máxima de emendas", detalhe: `O vereador já apresentou ${ja} das ${max} emendas ${nome} permitidas${fund(qm)}.` }
      );
    }
  }
  return out;
}

export const falhasDe = (v: Verificacao[]) => v.filter((x) => x.estado === "falha").length;
export const alertasDe = (v: Verificacao[]) => v.filter((x) => x.estado === "alerta").length;
