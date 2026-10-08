import { describe, expect, it } from "vitest";
import { classificar } from "../classificar";
import type { Selecao } from "../tipos";
import { validar, type EstadoValidacao } from "../validar";
import { VERIFICACOES, verificar, type ContextoVerificacao, type EntradaVerificacao } from "../verificacoes";
import { catalogo, config, destino, loa } from "./dados-reais";
import { contexto, paraBase } from "./verificar-apoio";

// Uma emenda completa (ambulância para a UBS), com a dotação escolhida.
const DOT = paraBase(loa.find((d) => d.codigo === "2001.52/470") ?? loa.find((d) => d.funcao === "10" && d.elem === "52")!);
const PESSOAL_SAUDE = paraBase(DOT, { id: "pessoal", codigo: "2001.11", gnd: "1", mod: "90", elem: "11", natureza: "3.1.90.11" });
const OUTRA = paraBase(loa.find((d) => d.funcao === "12" && d.elem === "30")!);

function estado(): EstadoValidacao {
  const d = destino("UBS Centro Oeste");
  const classificacao = classificar({ objeto: "Aquisição de 1 (uma) ambulância para transporte de pacientes", destino: d, execucao: "DIRETA", pretendido: 280000, loa, catalogo });
  const selecao: Selecao = { escolha: "PROPONENTE", dotacaoId: DOT.id };
  return {
    classificacao,
    selecao,
    pretendido: 278000,
    endereco: d.endereco,
    agenteExecutor: "Secretaria de Saúde",
    justificativa: "A frota atual tem dois veículos com mais de dez anos de uso, insuficientes para a demanda.",
    metaFinalistica: "Ampliar a capacidade de remoção de pacientes da rede municipal.",
    etapas: "Planejamento → contratação → entrega",
    metas: [{ beneficiarios: "Pacientes", unidade: "veículo", quantidade: 1 }],
    itens: [{ descricao: "Ambulância tipo A — simples remoção", quantidade: 1, valorUnitario: 278000, referencia: "R1" }],
    referencias: [{ codigo: "R1", tipo: "ATA", campos: {}, emissor: "PNCP", data: "2026-06-18", dataTexto: null, unidade: "unidade", valor: 278000, objeto: "Ambulância", porte: "", link: "", observacao: "", procedencia: "INFORMADA", aprovadoPor: null, aprovadoEm: null, origemExterna: null, consultadoEm: null }],
    parcelas: [278000],
    quadro: { "EQUIPAMENTOS-0": "Sim", "EQUIPAMENTOS-1": "Não", "EQUIPAMENTOS-2": "Sim" },
    instrumento: null,
    instrumentoOutro: "",
    evento: null,
    declaracao: true,
    declaracaoPrecos: true,
    metaPlanejamento: null,
  };
}

function rodar(
  extra: Partial<EntradaVerificacao> = {},
  ctx: Partial<ContextoVerificacao> = {},
  baseDots = [DOT, PESSOAL_SAUDE, OUTRA],
  estadoExtra: Partial<EstadoValidacao> = {}
) {
  const c = contexto(ctx, baseDots);
  const complementares = validar({ ...estado(), ...estadoExtra }, { config: c.config, aplicado: c.aplicado, biblioteca: catalogo.objetos, hoje: new Date("2026-09-28") });
  const e: EntradaVerificacao = { objeto: "Aquisição de uma ambulância", justificativa: estado().justificativa, valor: 278000, destino: DOT, ...extra };
  const r = verificar(e, c, complementares);
  return { ...r, complementares, estado: Object.fromEntries(r.verificacoes.map((v) => [v.numero, v.estado])) as Record<string, string>, v: (n: string) => r.verificacoes.find((x) => x.numero === n)! };
}

describe("T-4.1 as treze verificações", () => {
  it("T-4.1-1 sempre as treze, na ordem, em três estados", () => {
    const r = rodar();
    expect(r.verificacoes.map((v) => v.numero)).toEqual(["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii"]);
    expect(r.verificacoes.every((v) => ["conforme", "alerta", "falha"].includes(v.estado))).toBe(true);
    expect(r.valida).toBe(true);
  });
  it("T-4.1-2 uma falha torna a emenda inválida, mesmo com alertas", () => {
    expect(rodar({ justificativa: "" }).valida).toBe(false);
  });
  it("T-4.1-3 só alertas: válida", () => {
    const r = rodar({}, { ppaCadastrado: false, ldo: { cadastrada: false, programas: new Set(), acoes: new Set() } });
    expect([r.estado.v, r.estado.viii]).toEqual(["alerta", "alerta"]);
    expect(r.valida).toBe(true);
  });
  it("T-4.2-1 toda falha tem razão em linguagem do autor e fundamento", () => {
    const r = rodar({ justificativa: "", valor: 0 });
    expect(r.v("i").razao).toBe("Falta: justificativa, valor maior que zero.");
    expect(r.verificacoes.every((v) => v.fundamento.length > 5)).toBe(true);
  });
  it("conferência complementar com bloqueio também invalida", () => {
    const r = rodar({}, {}, undefined, { agenteExecutor: "" });
    expect(r.complementares.some((c) => c.nivel === "bad")).toBe(true);
    expect(r.valida).toBe(false);
  });
});

describe("T-4.5 cada verificação", () => {
  it("(i) sem justificativa ou valor zero", () => expect(rodar({ valor: 0 }).estado.i).toBe("falha"));
  it("(ii) exercício encerrado; prazo vencido; reenvio de diligência passa", () => {
    expect(rodar({}, { emendamento: { aberto: false, motivo: "EXERCICIO_ENCERRADO", explicacao: "O exercício 2027 está encerrado." } }).estado.ii).toBe("falha");
    expect(rodar({}, { emendamento: { aberto: false, motivo: "PRAZO_ENCERRADO", explicacao: "Prazo terminou." } }).estado.ii).toBe("falha");
    expect(rodar({}, { emendamento: { aberto: false, motivo: "PRAZO_ENCERRADO", explicacao: "Prazo terminou." }, reenvio: true }).estado.ii).toBe("conforme");
  });
  it("(iii) projeto de lei em elaboração ou ausente", () => {
    expect(rodar({}, { emendamento: { aberto: false, motivo: "INSTRUMENTO_FECHADO", explicacao: "O PL está em elaboração." } }).estado.iii).toBe("falha");
    expect(rodar({}, { emendamento: { aberto: false, motivo: "SEM_PROJETO", explicacao: "Sem projeto." } }).estado.iii).toBe("falha");
  });
  it("(iv) dotação fora da base do projeto; sem dotação", () => {
    expect(rodar({}, {}, [OUTRA]).estado.iv).toBe("falha");
    const r = rodar({ destino: null });
    expect(r.estado.iv).toBe("falha");
    expect(r.valida).toBe(false);
  });
  it("(v) programa fora do PPA: falha bloqueante, alerta quando a regra é de alerta", () => {
    const fora = paraBase(DOT, { constaNoPPA: false });
    expect(rodar({ destino: fora }, {}, [fora]).estado.v).toBe("falha");
    expect(rodar({ destino: fora }, { regras: { PROGRAMA_NO_PPA: { modo: "ALERTA", ativa: true, fundamento: null } } }, [fora]).estado.v).toBe("alerta");
  });
  it("(vi) ação de outro programa", () => {
    const d = paraBase(DOT, { acaoPrograma: "9999" });
    expect(rodar({ destino: d }, {}, [d]).estado.vi).toBe("falha");
  });
  it("(vii) classificação incompleta", () => {
    const d = paraBase(DOT, { completa: false });
    expect(rodar({ destino: d }, {}, [d]).estado.vii).toBe("falha");
  });
  it("(viii) fora das prioridades da LDO; conforme pelo programa ou pelo par programa|ação", () => {
    expect(rodar({}, { ldo: { cadastrada: true, programas: new Set(["0000"]), acoes: new Set() } }).estado.viii).toBe("falha");
    expect(rodar({}, { ldo: { cadastrada: true, programas: new Set([DOT.prog]), acoes: new Set() } }).estado.viii).toBe("conforme");
    expect(rodar({}, { ldo: { cadastrada: true, programas: new Set(), acoes: new Set([`${DOT.prog}|${DOT.acaoCodigo}`]) } }).estado.viii).toBe("conforme");
  });
  it("(ix) acima da cota: falha; abaixo, conforme com o saldo na razão", () => {
    expect(rodar({}, { aplicado: { saude: 600000, demais: 0 } }).estado.ix).toBe("falha");
    expect(rodar().v("ix").razao).toMatch(/restam/);
  });
  it("(ix) cota não parametrizada: falha", () => {
    expect(rodar({}, { config: { ...config, cotaIndividual: null } }).estado.ix).toBe("falha");
  });
  it("(x) em Mogi toda emenda é impositiva: sempre conforme, com a razão", () => {
    const r = rodar();
    expect(r.estado.x).toBe("conforme");
    expect(r.v("x").razao).toMatch(/não é remanejamento nem anulação/);
  });
  it("(xi) demais áreas acima do limite", () => {
    expect(rodar({ destino: OUTRA }, { aplicado: { saude: 0, demais: 386507.39 } }).estado.xi).toBe("falha");
  });
  it("(xii) pessoal na saúde; desligada, conforme", () => {
    expect(rodar({ destino: PESSOAL_SAUDE }).estado.xii).toBe("falha");
    expect(rodar({ destino: PESSOAL_SAUDE }, { regras: { SAUDE_SEM_PESSOAL: { modo: "BLOQUEANTE", ativa: false, fundamento: null } } }).estado.xii).toBe("conforme");
  });
  it("(xiii) plano exigido de todo beneficiário: sem metas e sem planilha, falha com o que falta", () => {
    const r = rodar({}, {}, undefined, { metas: [], metaFinalistica: "", itens: [], parcelas: [] });
    expect(r.estado.xiii).toBe("falha");
    expect(r.v("xiii").razao).toMatch(/metas físicas/);
    expect(r.v("xiii").razao).toMatch(/planilha orçamentária/);
  });
  it("(xiii) item sem fonte de preço aparece no que falta", () => {
    const r = rodar({}, {}, undefined, { itens: [{ descricao: "Ambulância", quantidade: 1, valorUnitario: 278000, referencia: "" }] });
    expect(r.v("xiii").razao).toMatch(/fonte do preço/);
  });
});

describe("T-4.3 modo das verificações", () => {
  it("T-4.3-2 verificações fixas ignoram a regra", () => {
    for (const c of ["CAMPOS_PREENCHIDOS", "EXERCICIO_ABERTO", "INSTRUMENTO_ABERTO", "DOTACAO_EXISTE", "CLASSIFICACAO_COMPLETA", "TIPO_COERENTE"]) {
      expect(VERIFICACOES.find((v) => v.codigo === c)?.configuravel).toBe(false);
    }
    const r = rodar({ valor: 0 }, { regras: { CAMPOS_PREENCHIDOS: { modo: "ALERTA", ativa: true, fundamento: null } } });
    expect(r.estado.i).toBe("falha");
  });
  it("a cota em modo de alerta não invalida", () => {
    const r = rodar({}, { aplicado: { saude: 600000, demais: 0 }, regras: { COTA_AUTOR: { modo: "ALERTA", ativa: true, fundamento: null } } });
    expect(r.estado.ix).toBe("alerta");
  });
  it("o fundamento da regra substitui o padrão", () => {
    const r = rodar({}, { regras: { COTA_AUTOR: { modo: "BLOQUEANTE", ativa: true, fundamento: "Lei Orgânica, art. 140" } } });
    expect(r.v("ix").fundamento).toBe("Lei Orgânica, art. 140");
  });
});
