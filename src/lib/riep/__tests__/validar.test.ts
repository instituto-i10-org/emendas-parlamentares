import { describe, expect, it } from "vitest";
import { classificar } from "../classificar";
import { derivaIcCo, parcelaDaDotacao, parcelaDemais, parcelaSaude } from "../cota";
import { analisaItens } from "../itens";
import {
  elementoDoInstrumento,
  eventosDe,
  metodoQuantidade,
  modeloDaDotacao,
  quantidadeSugerida,
} from "../plano";
import { fontesParaEmenda, referenciaAntiga, referenciaCombina, referenciaCompleta, rotuloReferencia, type ReferenciaPreco } from "../referencias";
import type { Selecao } from "../tipos";
import { resumoValidacao, sinaisValor, validar, type EstadoValidacao } from "../validar";
import { conferirPlanilha, valorDaEmenda } from "../valor";
import { catalogo, config, destino, loa } from "./dados-reais";

const semAplicado = { saude: 0, demais: 0 };

function ref(parcial: Partial<ReferenciaPreco> = {}): ReferenciaPreco {
  return {
    codigo: "R1",
    tipo: "ATA",
    campos: { num: "Ata SRP 014/2025", gerenciador: "Consórcio", item: "3", vigencia: "2026" },
    emissor: "Consórcio Intermunicipal de Saúde",
    data: "2026-06-18",
    dataTexto: null,
    unidade: "unidade",
    valor: 278000,
    objeto: "Ambulância tipo A — simples remoção",
    porte: "4 unidades",
    link: "",
    observacao: "",
    procedencia: "INFORMADA",
    aprovadoPor: null,
    aprovadoEm: null,
    origemExterna: null,
    consultadoEm: null,
    ...parcial,
  };
}

// Emenda completa e válida: ambulância para uma UBS, escolhida pelo proponente.
function estadoAmbulancia(): EstadoValidacao {
  const d = destino("UBS Centro Oeste");
  const classificacao = classificar({
    objeto: "Aquisição de 1 (uma) ambulância para transporte de pacientes",
    destino: d,
    execucao: "DIRETA",
    pretendido: 280000,
    loa,
    catalogo,
  });
  const selecao: Selecao = { escolha: "PROPONENTE", dotacaoId: "2001.52/470" };
  return {
    classificacao,
    selecao,
    pretendido: 280000,
    endereco: d.endereco,
    agenteExecutor: "Secretaria de Saúde — Atenção Básica",
    justificativa:
      "A frota atual tem dois veículos com mais de dez anos de uso, insuficientes para a demanda de transporte entre as unidades.",
    metaFinalistica: "Ampliar a capacidade de remoção de pacientes da rede municipal.",
    etapas: "Planejamento → contratação → entrega → instalação → recebimento",
    metas: [{ beneficiarios: "Pacientes da rede municipal", unidade: "veículo", quantidade: 1 }],
    itens: [{ descricao: "Ambulância tipo A — simples remoção", quantidade: 1, valorUnitario: 278000, referencia: "R1" }],
    referencias: [ref()],
    parcelas: [280000],
    quadro: { "EQUIPAMENTOS-0": "Sim", "EQUIPAMENTOS-1": "Não", "EQUIPAMENTOS-2": "Sim" },
    instrumento: null,
    instrumentoOutro: "",
    evento: null,
    declaracao: true,
    declaracaoPrecos: true,
    metaPlanejamento: null,
  };
}

const ctx = { config, aplicado: semAplicado, biblioteca: catalogo.objetos, hoje: new Date("2026-09-28") };
const titulo = (checks: ReturnType<typeof validar>, nivel: string) =>
  checks.filter((c) => c.nivel === nivel).map((c) => c.titulo);

describe("valor da emenda", () => {
  it("é o valor informado; sem ele, a soma da planilha", () => {
    expect(valorDaEmenda(280000, 278000)).toBe(280000);
    expect(valorDaEmenda(0, 278000)).toBe(278000);
  });
  it("a planilha é conferida contra o valor, com a tolerância", () => {
    expect(conferirPlanilha(280000, 280000, 10).estado).toBe("igual");
    expect(conferirPlanilha(280000, 278000, 10).estado).toBe("dentro");
    expect(conferirPlanilha(280000, 308000, 10).estado).toBe("dentro");
    expect(conferirPlanilha(280000, 308000.01, 10).estado).toBe("fora");
    expect(conferirPlanilha(280000, 0, 10).estado).toBe("vazia");
    expect(conferirPlanilha(0, 5000, 10).estado).toBe("sem-valor");
    expect(conferirPlanilha(100000, 80000, 10)).toMatchObject({ estado: "fora", diferenca: -20000, pct: 20 });
  });
  it("o cronograma confere contra o valor informado, não contra a soma", () => {
    const e = { ...estadoAmbulancia(), parcelas: [278000] };
    expect(titulo(validar(e, ctx), "bad")).toContain("Cronograma não confere");
  });
});

describe("cota em duas parcelas", () => {
  it("divide a cota pela reserva da saúde", () => {
    expect(parcelaSaude(config)).toBeCloseTo(386507.39, 2);
    expect(parcelaDemais(config)).toBeCloseTo(386507.39, 2);
  });

  it("o IC-CO decide a parcela", () => {
    expect(derivaIcCo({ funcao: "10", subf: "301" })?.codigo).toBe("1002");
    expect(derivaIcCo({ funcao: "12", subf: "361" })?.codigo).toBe("1001");
    expect(parcelaDaDotacao({ funcao: "10", subf: "122" })).toBe("DEMAIS");
    expect(parcelaDaDotacao({ funcao: "10", subf: "302" })).toBe("SAUDE");
  });
});

describe("modelo, evento e instrumento", () => {
  it("o modelo sai da dotação", () => {
    expect(modeloDaDotacao({ mod: "50", gnd: "3", elem: "43" })).toBe("TERCEIRO_SETOR");
    expect(modeloDaDotacao({ mod: "90", gnd: "4", elem: "51" })).toBe("OBRAS");
    expect(modeloDaDotacao({ mod: "90", gnd: "4", elem: "52" })).toBe("EQUIPAMENTOS");
    expect(modeloDaDotacao({ mod: "90", gnd: "3", elem: "30" })).toBe("CUSTEIO");
  });

  it("o evento que encerra a meta acompanha o modelo", () => {
    expect(eventosDe({ mod: "90", gnd: "4", elem: "52" })).toEqual(["PATRIMONIO"]);
    expect(eventosDe({ mod: "50", gnd: "4", elem: "42" })).toEqual(["PRESTACAO_CONTAS_DOACAO", "PRESTACAO_CONTAS"]);
    expect(eventosDe({ mod: "90", gnd: "3", elem: "30" })[0]).toBe("ALMOXARIFADO");
  });

  it("o instrumento define o elemento no terceiro setor", () => {
    expect(elementoDoInstrumento("PARCERIA_MROSC", "3")).toBe("43");
    expect(elementoDoInstrumento("PARCERIA_MROSC", "4")).toBe("42");
    expect(elementoDoInstrumento("CONTRIBUICAO_LEI", "3")).toBe("41");
    expect(elementoDoInstrumento("OUTRO", "3")).toBeNull();
  });
});

describe("quantidade sugerida", () => {
  it("objeto indivisível usa a população de referência do destino, ou registra pendência", () => {
    const e = estadoAmbulancia();
    const d = loa.find((x) => x.codigo === "2001.52")!;
    const mq = metodoQuantidade({
      classificacao: e.classificacao,
      dotacao: { ...d, pontos: 0, sobreposicao: 0, aderente: true, abaixoDoPretendido: false },
      meta: null,
      destino: { ...e.classificacao!.destino, populacao: 8400, fontePopulacao: "CNES", dataPopulacao: "2026" },
      valor: 278000,
      pretendido: 280000,
    });
    expect(mq?.metodo).toBe("populacao_referencia");
    expect(quantidadeSugerida(mq)).toBe(8400);
  });

  it("objeto divisível é proporcional ao valor sobre a meta do exercício", () => {
    const d = destino("EMEF Adirce");
    const c = classificar({ objeto: "Aquisição de materiais escolares", destino: d, execucao: "DIRETA", pretendido: 0, loa, catalogo });
    const dot = c.candidatas[0];
    const mq = metodoQuantidade({
      classificacao: c,
      dotacao: dot,
      meta: { produto: "Alunos", unidade: "aluno", publico: null, quantidadePpa: null, quantidadeExercicio: 1000, beneficiarios: null, notaLdo: null },
      destino: d,
      valor: dot.autorizado / 10,
      pretendido: 0,
    });
    expect(mq?.metodo).toBe("proporcao_valor");
    expect(quantidadeSugerida(mq)).toBeCloseTo(100, 6);
  });
});

describe("referências de preço", () => {
  it("exige fonte, data, objeto, unidade e valor; os campos próprios do tipo ajudam, mas não travam", () => {
    expect(referenciaCompleta(ref())).toBe(true);
    expect(referenciaCompleta(ref({ campos: { num: "Ata 1" } }))).toBe(true);
    expect(referenciaCompleta(ref({ valor: 0 }))).toBe(false);
    expect(referenciaCompleta(ref({ emissor: "  " }))).toBe(false);
    expect(referenciaCompleta(ref({ data: null, dataTexto: null }))).toBe(false);
  });

  it("rótulo de referência tirada de fonte oficial usa o nome da fonte", () => {
    expect(rotuloReferencia({ ...ref(), fonteId: "f1", emissor: "SINAPI (Caixa)", campos: { composicao: "92873" } })).toBe("R1 · SINAPI (Caixa) 92873");
  });

  it("fontes indicadas: gerais, do modelo do plano e de saúde quando a dotação é de saúde", () => {
    const f = (id: string, aplicaA: string[]) => ({ id, nome: id, url: "https://x", orientacao: "", aplicaA, tipo: "PAINEL" as const });
    const todas = [f("geral", []), f("obra", ["OBRAS"]), f("saude", ["SAUDE"]), f("equip", ["EQUIPAMENTOS"])];
    expect(fontesParaEmenda(todas, "OBRAS", false).map((x) => x.id)).toEqual(["geral", "obra"]);
    expect(fontesParaEmenda(todas, "EQUIPAMENTOS", true).map((x) => x.id)).toEqual(["geral", "saude", "equip"]);
    expect(fontesParaEmenda(todas, null, false).map((x) => x.id)).toEqual(["geral"]);
  });

  it("rótulo, antiguidade e comparabilidade", () => {
    expect(rotuloReferencia(ref())).toBe("R1 · Ata de registro de preços vigente Ata SRP 014/2025");
    expect(referenciaAntiga("2025-01-01", 12, new Date("2026-09-28"))).toBe(true);
    expect(referenciaAntiga("2026-06-18", 12, new Date("2026-09-28"))).toBe(false);
    expect(referenciaCombina(ref(), "Ambulância UTI", catalogo.objetos)).toBe(true);
    expect(referenciaCombina(ref({ objeto: "Instrumentos musicais" }), "Ambulância", catalogo.objetos)).toBe(false);
  });
});

describe("validação da etapa 3", () => {
  it("emenda completa, sem cota comprometida: nenhum bloqueio", () => {
    const checks = validar(estadoAmbulancia(), ctx);
    expect(titulo(checks, "bad")).toEqual([]);
    expect(resumoValidacao(checks).pode).toBe(true);
    expect(titulo(checks, "ok")).toContain("Dentro da parcela de saúde");
  });

  it("com a cota real de 2026 já indicada, a parcela excede e bloqueia", () => {
    const checks = validar(estadoAmbulancia(), { ...ctx, aplicado: { saude: 386507.39, demais: 386507.39 } });
    expect(titulo(checks, "bad")).toEqual(["Parcela de saúde excedida"]);
  });

  it("cota não parametrizada é pendência, nunca valor presumido", () => {
    const checks = validar(estadoAmbulancia(), { ...ctx, config: { ...config, cotaIndividual: null } });
    expect(titulo(checks, "bad")).toContain("Cota individual não parametrizada");
  });

  it("cronograma diferente do valor bloqueia", () => {
    const e = { ...estadoAmbulancia(), parcelas: [100000] };
    expect(titulo(validar(e, ctx), "bad")).toContain("Cronograma não confere");
  });

  it("linha sem fonte de preço bloqueia quando a fonte é obrigatória", () => {
    const e = estadoAmbulancia();
    e.itens = [{ ...e.itens[0], referencia: null }];
    expect(titulo(validar(e, ctx), "bad")).toContain("Linha sem fonte de preço");
  });

  it("linha sem fonte de preço só alerta quando a configuração tira a obrigatoriedade", () => {
    const e = estadoAmbulancia();
    e.itens = [{ ...e.itens[0], referencia: null }];
    const checks = validar(e, { ...ctx, config: { ...ctx.config, fontePrecoObrigatoria: false } });
    expect(titulo(checks, "bad")).not.toContain("Linha sem fonte de preço");
    expect(titulo(checks, "warn")).toContain("Linha sem fonte de preço");
  });

  it("item de outra área bloqueia mesmo em valor pequeno", () => {
    const e = estadoAmbulancia();
    e.itens.push({ descricao: "Material escolar para a unidade", quantidade: 1, valorUnitario: 4800, referencia: "R1" });
    e.parcelas = [282800];
    const checks = validar(e, ctx);
    expect(titulo(checks, "bad")).toContain("Item incompatível com o objeto da emenda");
    const ac = analisaItens({
      classificacao: e.classificacao,
      dotacao: e.classificacao!.opcoes.find((d) => d.codigo === "2001.52/470")!,
      itens: e.itens,
      biblioteca: catalogo.objetos,
      percentualAcessorio: 20,
    });
    expect(ac?.linhas.map((l) => l.resultado)).toEqual(["compativel", "nat"]);
  });

  it("terceiro setor sem instrumento: elemento pendente bloqueia", () => {
    const d = destino("Santa Casa");
    const c = classificar({ objeto: "Custeio de internações hospitalares", destino: d, execucao: "INDIRETA", pretendido: 150000, loa, catalogo });
    const e: EstadoValidacao = {
      ...estadoAmbulancia(),
      classificacao: c,
      selecao: { escolha: "PROPONENTE", dotacaoId: c.opcoes[0].id },
      itens: [{ descricao: "Internação em clínica médica", quantidade: 250, valorUnitario: 600, referencia: "R1" }],
      referencias: [ref({ objeto: "Internação em clínica médica", valor: 600 })],
      parcelas: [150000],
      quadro: {},
    };
    expect(titulo(validar(e, ctx), "bad")).toContain("Instrumento da parceria não definido");
    const comInstrumento = validar({ ...e, instrumento: "PARCERIA_MROSC" }, ctx);
    expect(titulo(comInstrumento, "bad")).not.toContain("Instrumento da parceria não definido");
    expect(comInstrumento.find((x) => x.titulo === "Instrumento da parceria")?.detalhe).toMatch(/elemento 43$/);
  });

  it("sinaliza na etapa 1 que a parcela não comporta o pretendido", () => {
    const e = estadoAmbulancia();
    const avisos = sinaisValor({
      classificacao: e.classificacao,
      selecao: e.selecao,
      pretendido: 280000,
      instrumento: null,
      instrumentoOutro: "",
      config,
      aplicado: { saude: 386507.39, demais: 386507.39 },
    });
    expect(avisos.some((a) => a.includes("parcela de **saúde**"))).toBe(true);
  });
});
