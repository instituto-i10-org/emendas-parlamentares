// Reprodução do Relatório de Testes do Dr. Emerson (29/09/2026), achado por
// achado. Cada caso usa o destino real e um objeto no estilo do relatório,
// com o prefixo "[TESTE nn]" que ele usou. As expectativas são por
// propriedade (elemento, unidade, subfunção, aderência), não por código de
// dotação, para valerem também depois da recarga da LOA.
import { describe, expect, it } from "vitest";
import { classificar } from "../classificar";
import { interpretar } from "../interpretar";
import { ordenarPorRelevancia } from "@/lib/servicos/relevancia-precos";
import { mesmaEmenda } from "@/lib/emendas/duplicidade";
import type { Candidata, Classificacao, DotacaoMotor, Selecao } from "../tipos";
import { validar, type EstadoValidacao } from "../validar";
import type { ReferenciaPreco } from "../referencias";
import { CASOS } from "./casos-relatorio";
import { catalogo, config, destino, loa } from "./dados-reais";

const classifica = (objeto: string, trecho: string, pretendido = 20000) => {
  const d = destino(trecho);
  return classificar({ objeto, destino: d, execucao: d.execucao, pretendido, loa, catalogo });
};

// A dotação que a tela apresentaria primeiro.
const primeira = (r: Classificacao): Candidata | null => r.selecionada ?? r.opcoes[0] ?? r.candidatas[0] ?? null;

const ACOES_SEM_RELACAO = /BENEFICIO AO TRABALHADOR|TRANSPORTE DE DOENTES|CONSTR|ASSIST.NCIA AO IDOSO/i;

describe("A2 — candidatas com aderência ao objeto", () => {
  for (const c of CASOS) {
    it(`TESTE ${c.teste}: ${c.destino} cai em dotação de material (30) da própria unidade`, () => {
      const r = classifica(c.objeto, c.destino);
      const d = destino(c.destino);
      expect(["OK", "VALIDAR"]).toContain(r.situacao);
      const p = primeira(r);
      expect(p, "nenhuma candidata apresentada").not.toBeNull();
      expect(p!.uo).toBe(d.uo);
      expect(p!.elem).toBe("30");
      expect(p!.nome).not.toMatch(ACOES_SEM_RELACAO);
      if (c.subf) expect(p!.subf).toBe(c.subf);
      // Nada de serviços (39) entre o que a tela oferece para material.
      for (const o of r.opcoes) expect(o.elem).toBe("30");
    });
  }

  it("TESTE 15: EMEB atende os dois níveis, então as duas subfunções aparecem", () => {
    const r = classifica("[TESTE 15] Custeio de material de consumo para a EMEB Pe. Estevo", "Estevo");
    expect(["OK", "VALIDAR"]).toContain(r.situacao);
    const subfs = new Set((r.opcoes.length ? r.opcoes : r.candidatas).map((o) => o.subf));
    expect(subfs.has("361")).toBe(true);
    expect(subfs.has("365")).toBe(true);
  });

  it("objeto de custeio sem termo não é travado no elemento 39", () => {
    const o = interpretar("[TESTE 99] Custeio de gêneros para a unidade", catalogo.objetos)!;
    expect(o.confianca).toBe("inferido");
    expect(o.natureza).toBe("CUSTEIO");
    expect(o.elemento).not.toBe("39");
  });

  it("ação de benefício a servidor nunca é a primeira opção para material", () => {
    const r = classifica("[TESTE 03] Custeio de material de consumo ambulatorial para a UBS Zona Norte", "UBS Zona Norte");
    const p = primeira(r)!;
    expect(p.nome).toMatch(/ATENCAO BASICA/i);
  });
});

describe("A7 — investimento no CAPS AD sobre a LOA sancionada", () => {
  it("a unidade 13.03 tem 4.4.90.52 na lei: equipamento para o CAPS AD não é óbice", () => {
    // Na base por OCR do PL a unidade não tinha equipamento; no QDD oficial tem
    // (1090 — Rede Saúde Mental, ficha 618). O achado A7 era artefato da base.
    expect(loa.some((d) => d.uo === "13.03" && d.gnd === "4" && d.mod === "90" && d.elem === "52")).toBe(true);
    const r = classifica("[TESTE 01] Aquisição de equipamentos e mobiliário para o CAPS AD de Mogi Guaçu", "CAPS AD");
    expect(r.situacao).not.toBe("OBICE");
    const p = primeira(r)!;
    expect(p.uo).toBe("13.03");
    expect(p.elem).toBe("52");
    expect(p.nome).toMatch(/SAUDE MENTAL/i);
  });
});

describe("A3 — objetos de saúde em unidade de saúde não são de outra área", () => {
  it("oficinas terapêuticas do CAPS II são Saúde, não Cultura", () => {
    const r = classifica("[TESTE 04] Custeio de material de consumo para oficinas terapêuticas do CAPS II", "CAPS II");
    expect(r.situacao).not.toBe("CONFLITO");
    expect(r.objeto?.area).toBe("Saúde");
  });

  it("material esportivo para o Polo Academia da Saúde é Saúde, não Esporte", () => {
    const r = classifica("[TESTE 17] Custeio de material esportivo de consumo para o Polo Academia da Saúde", "Academia da Sa");
    expect(r.situacao).not.toBe("CONFLITO");
    expect(r.objeto?.area).toBe("Saúde");
  });

  it("a precedência é restrita: ambulância para escola continua em conflito", () => {
    const r = classifica("Aquisição de ambulância", "EMEF Adirce");
    expect(r.situacao).toBe("CONFLITO");
  });
});

// --- validação da etapa 3 -----------------------------------------------------

function ref(parcial: Partial<ReferenciaPreco> = {}): ReferenciaPreco {
  return {
    codigo: "R1",
    tipo: "PAINEL",
    campos: { consulta: "PNIGP material de consumo", recorte: "nacional", amostra: "1" },
    emissor: "PNIGP",
    data: "2026-06-18",
    dataTexto: null,
    unidade: "peça",
    valor: 286.2,
    objeto: "material de consumo",
    porte: "",
    link: "",
    observacao: "",
    procedencia: "CONFERIDA",
    aprovadoPor: "Vereador Exemplo",
    aprovadoEm: "2026-09-29",
    origemExterna: null,
    consultadoEm: "2026-09-29",
    ...parcial,
  };
}

function estado(objeto: string, trecho: string, item: string, extra: Partial<EstadoValidacao> = {}): EstadoValidacao {
  const d = destino(trecho);
  const classificacao = classificar({ objeto, destino: d, execucao: "DIRETA", pretendido: 20000, loa, catalogo });
  const selecao: Selecao = { escolha: null, dotacaoId: null };
  return {
    classificacao,
    selecao,
    pretendido: 20000,
    endereco: d.endereco,
    agenteExecutor: "Secretaria de Saúde",
    justificativa: "Reposição de material de consumo para manter o atendimento regular da unidade ao longo do exercício.",
    metaFinalistica: "Manter o atendimento sem interrupção por falta de insumos.",
    etapas: "Planejamento → aquisição → entrega → almoxarifado",
    metas: [{ beneficiarios: "Usuários da unidade", unidade: "kit", quantidade: 70 }],
    itens: [{ descricao: item, quantidade: 70, valorUnitario: 286.2, referencia: "R1" }],
    referencias: [ref()],
    parcelas: [70 * 286.2],
    quadro: { "CUSTEIO-0": "Sim", "CUSTEIO-1": "Sim", "CUSTEIO-2": "Sim" },
    instrumento: null,
    instrumentoOutro: "",
    evento: null,
    declaracao: true,
    metaPlanejamento: null,
    ...extra,
  };
}

// Força a dotação gravada, como uma emenda antiga em 3.3.90.39 (o caso A1).
function comDotacao(e: EstadoValidacao, filtro: (d: DotacaoMotor) => boolean): EstadoValidacao {
  const d = loa.find(filtro);
  if (!d) throw new Error("dotação de teste não encontrada");
  const sel: Candidata = { ...d, pontos: 0, sobreposicao: 0, aderente: false, abaixoDoPretendido: false };
  return { ...e, classificacao: { ...e.classificacao!, situacao: "OK", selecionada: sel, opcoes: [], candidatas: [sel] } };
}

const ctx = { config, aplicado: { saude: 0, demais: 0 }, biblioteca: catalogo.objetos, hoje: new Date("2026-09-29") };
const titulos = (checks: ReturnType<typeof validar>, nivel: string) =>
  checks.filter((c) => c.nivel === nivel).map((c) => c.titulo);

describe("A1 — material de consumo em dotação de serviços é bloqueio", () => {
  it("item de material (30) gravado em 3.3.90.39 bloqueia a submissão", () => {
    const e = comDotacao(
      estado("[TESTE 03] Custeio de material de consumo ambulatorial para a UBS Zona Norte", "UBS Zona Norte", "material de consumo"),
      (d) => d.uo === "13.01" && d.gnd === "3" && d.mod === "90" && d.elem === "39"
    );
    const bad = titulos(validar(e, ctx), "bad");
    expect(bad.some((t) => /incompat/i.test(t))).toBe(true);
  });

  it("o objeto reconhecido também é cruzado com o elemento da dotação (não só o item)", () => {
    // Objeto é material hospitalar (30); item genérico sem opinião; dotação 39.
    const e = comDotacao(
      estado("[TESTE 03] Custeio de material hospitalar para a UBS Zona Norte", "UBS Zona Norte", "pagamento de diárias"),
      (d) => d.uo === "13.01" && d.gnd === "3" && d.mod === "90" && d.elem === "39"
    );
    const bad = titulos(validar(e, ctx), "bad");
    expect(bad).toContain("Elemento de despesa incompatível");
  });

  it("material em dotação de material segue sem bloqueio de elemento", () => {
    const e = comDotacao(
      estado("[TESTE 03] Custeio de material de consumo ambulatorial para a UBS Zona Norte", "UBS Zona Norte", "material de consumo"),
      (d) => d.uo === "13.01" && d.gnd === "3" && d.mod === "90" && d.elem === "30"
    );
    const bad = titulos(validar(e, ctx), "bad");
    expect(bad.some((t) => /incompat/i.test(t))).toBe(false);
  });
});

describe("A5 — 'nenhuma linha entrega o objeto' roda em qualquer elemento", () => {
  const objeto = "[TESTE 01] Custeio de medicamentos para o CAPS AD de Mogi Guaçu";
  it("emenda 352: objeto de medicamentos com item genérico avisa (o aviso estava certo)", () => {
    const e = comDotacao(estado(objeto, "CAPS AD", "material de consumo"), (d) => d.uo === "13.03" && d.elem === "30");
    expect(titulos(validar(e, ctx), "warn")).toContain("Nenhuma linha entrega o objeto");
  });

  it("o mesmo caso em 3.3.90.39 avisa igual", () => {
    const e = comDotacao(estado(objeto, "CAPS AD", "material de consumo"), (d) => d.uo === "13.03" && d.gnd === "3" && d.elem === "39");
    expect(titulos(validar(e, ctx), "warn")).toContain("Nenhuma linha entrega o objeto");
  });

  it("objeto inferido também é conferido contra os itens", () => {
    // Objeto sem termo (custeio genérico); item é bem de capital: não entrega e diverge.
    const e = comDotacao(estado("[TESTE 98] Custeio de gêneros para a UBS Zona Norte", "UBS Zona Norte", "ambulância"), (d) => d.uo === "13.01" && d.elem === "30");
    const checks = validar(e, ctx);
    expect(titulos(checks, "bad").some((t) => /incompat/i.test(t))).toBe(true);
  });
});

describe("A8 — reserva da saúde é limite, não obrigação", () => {
  it("emenda de demais áreas com cota que ainda alcança o mínimo não gera alerta", () => {
    const e = comDotacao(
      estado("[TESTE 02] Custeio de material de consumo para a EMEF João Bueno Junior", "João Bueno", "material de consumo"),
      (d) => d.uo === "11.01" && d.elem === "30" && d.subf === "361"
    );
    const checks = validar(e, { ...ctx, aplicado: { saude: 0, demais: 141382.8 } });
    expect(titulos(checks, "warn")).not.toContain("Fora da reserva da saúde");
    expect(titulos(checks, "ok")).toContain("Consome a parcela de demais áreas");
  });

  it("quando a sobra não cobre o mínimo, continua bloqueando", () => {
    const e = comDotacao(
      estado("[TESTE 02] Custeio de material de consumo para a EMEF João Bueno Junior", "João Bueno", "material de consumo"),
      (d) => d.uo === "11.01" && d.elem === "30" && d.subf === "361"
    );
    const checks = validar(e, { ...ctx, aplicado: { saude: 0, demais: 386507.39 } });
    expect(titulos(checks, "bad")).toContain("Mínimo em saúde inalcançável");
  });
});

describe("A9 — amostra mínima da referência de painel", () => {
  it("amostra de 1 compra gera alerta", () => {
    const e = comDotacao(estado("[TESTE 03] Custeio de material de consumo para a UBS Zona Norte", "UBS Zona Norte", "material de consumo"), (d) => d.uo === "13.01" && d.elem === "30");
    expect(titulos(validar(e, ctx), "warn")).toContain("Amostra de preço pequena");
  });

  it("amostra de 3 compras não gera alerta", () => {
    const base = estado("[TESTE 03] Custeio de material de consumo para a UBS Zona Norte", "UBS Zona Norte", "material de consumo");
    const e = comDotacao({ ...base, referencias: [ref({ campos: { consulta: "x", recorte: "y", amostra: "3" } })] }, (d) => d.uo === "13.01" && d.elem === "30");
    expect(titulos(validar(e, ctx), "warn")).not.toContain("Amostra de preço pequena");
  });
});

describe("A9 (complemento) — unidade do item e da referência", () => {
  const base = () => estado("[TESTE 03] Custeio de material de consumo para a UBS Zona Norte", "UBS Zona Norte", "material de consumo");
  const em30 = (e: EstadoValidacao) => comDotacao(e, (d) => d.uo === "13.01" && d.elem === "30");
  it("item em caixa apontando referência por peça avisa", () => {
    const e = base();
    e.itens = [{ ...e.itens[0], unidade: "caixa" }];
    expect(titulos(validar(em30(e), ctx), "warn")).toContain("Unidade do item difere da referência");
  });
  it("mesma unidade, abreviada ou no plural, não avisa; item sem unidade também não", () => {
    const e = base();
    e.itens = [{ ...e.itens[0], unidade: "peças" }];
    expect(titulos(validar(em30(e), ctx), "warn")).not.toContain("Unidade do item difere da referência");
    e.itens = [{ ...e.itens[0], unidade: "" }];
    expect(titulos(validar(em30(e), ctx), "warn")).not.toContain("Unidade do item difere da referência");
  });
});

describe("A6 — relevância da pesquisa de preço", () => {
  const lista = [
    // Fichas técnicas longas que citam "material" e "consumo" soltos — o que o PNIGP devolve de verdade.
    { descricao: "BETERRABA IN NATURA. ESCOVADA, DE PRIMEIRA QUALIDADE, ISENTA DE ENFERMIDADES, MATERIAL TERROSO E UMIDADE EXTERNA ANORMAL. EM CONDIÇÕES ADEQUADAS PARA O CONSUMO MEDIATO E IMEDIATO.", amostra: 40 },
    { descricao: "MATERIAL DE CONSUMO PARA ESCRITÓRIO", amostra: 1 },
    { descricao: "TÊ DE SERVIÇO INTEGRADO PARA TUBOS PEAD. A FERRAMENTA DE CORTE DEVE SER MONOLÍTICA, FABRICADA A PARTIR DE UM ÚNICO MATERIAL, INÓCUO À QUALIDADE DA ÁGUA PARA CONSUMO HUMANO.", amostra: 12 },
    { descricao: "MATERIAL DE CONSUMO HOSPITALAR - LUVAS", amostra: 7 },
    { descricao: "CONCRETO USINADO", amostra: 3 },
    { descricao: "material de consumo", amostra: 1 },
  ];
  it("só a expressão junta conta; palavras soltas em ficha técnica longa não", () => {
    const r = ordenarPorRelevancia("material de consumo", lista);
    expect(r.aproximados).toBe(false);
    expect(r.itens.map((x) => x.descricao)).toEqual([
      "MATERIAL DE CONSUMO HOSPITALAR - LUVAS",
      "MATERIAL DE CONSUMO PARA ESCRITÓRIO",
      "material de consumo",
    ]);
  });
  it("admite até duas palavras entre os termos e plural", () => {
    const r = ordenarPorRelevancia("luva procedimento", [{ descricao: "LUVAS PARA PROCEDIMENTO NÃO CIRÚRGICO", amostra: 3 }, { descricao: "AVENTAL DESCARTÁVEL", amostra: 9 }]);
    expect(r.itens.map((x) => x.descricao)).toEqual(["LUVAS PARA PROCEDIMENTO NÃO CIRÚRGICO"]);
  });
  it("sem correspondência nenhuma, devolve os originais marcados como aproximados", () => {
    const r = ordenarPorRelevancia("vacina", lista);
    expect(r.aproximados).toBe(true);
    expect(r.itens.length).toBe(lista.length);
  });
});

describe("G1 — duplicidade de emenda", () => {
  const a = { destinoId: "d1", execucao: "DIRETA" as const, objeto: "[TESTE 10] Custeio de material de consumo para a Central SAMU 192" };
  it("mesmo destino e mesmo objeto, ignorando caixa, acentos e espaços, é duplicata", () => {
    expect(mesmaEmenda(a, { ...a, objeto: "  [teste 10] custeio de MATERIAL de consumo para a central samu 192 " })).toBe(true);
  });
  it("objeto diferente ou destino diferente não é", () => {
    expect(mesmaEmenda(a, { ...a, objeto: "[TESTE 11] Custeio de material de consumo para a UBS" })).toBe(false);
    expect(mesmaEmenda(a, { ...a, destinoId: "d2" })).toBe(false);
  });
});
