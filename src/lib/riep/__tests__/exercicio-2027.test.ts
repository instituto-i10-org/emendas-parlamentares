// Base de 2027: o QDD do PL 264/2026 (proposta orçamentária), antes das
// emendas. Os autos são digitalização; a leitura foi conciliada fora do
// repositório e estes testes travam o que ela garantiu.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classificar } from "../classificar";
import { parcelaDaDotacao } from "../cota";
import { unidadesDoDestino } from "../destino";
import type { Candidata, Classificacao } from "../tipos";
import { CASOS } from "./casos-relatorio";
import { catalogoDoExercicio, destino, loaDoExercicio, todosDestinos } from "./dados-reais";

const PASTA = path.resolve(process.cwd(), "prisma/dados/mogi-guacu");
const ler = <T>(arquivo: string): T => JSON.parse(readFileSync(path.join(PASTA, arquivo), "utf8")) as T;

type Linha = { ficha: string; uo: string; nome: string; gnd: string; mod: string; elem: string; sourceCode: string; applicationCode: string; autorizado: number };
const linhas = ler<{ dotacoes: Linha[] }>("loa-2027.json").dotacoes;
const exercicio = ler<{ individualQuota: number; rclPercent: number; rclBase: { value: number }; councilors: number }>("exercicio-2027.json");
const centavos = (v: number) => Math.round(v * 100);

describe("PL 264/2026 — conciliação da base", () => {
  it("o total das dotações é o do art. 3º do projeto", () => {
    expect(linhas.reduce((s, d) => s + centavos(d.autorizado), 0)).toBe(centavos(1_083_895_132));
  });

  it("nenhuma ficha se repete dentro do órgão", () => {
    const chaves = linhas.map((d) => `${d.uo.split(".")[0]}|${d.ficha}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("a fonte 08 está inteira na reserva das emendas (ficha 1208, órgão 17)", () => {
    const fonte08 = linhas.filter((d) => d.sourceCode === "08");
    expect(fonte08).toHaveLength(1);
    expect(fonte08[0]).toMatchObject({ ficha: "1208", uo: "17.01", gnd: "9", autorizado: 11_112_367 });
  });

  it("a cota vem de 1,2% da RCL de 2025, dividida pelos vereadores, e cabe na reserva", () => {
    const teto = Math.round(exercicio.rclBase.value * exercicio.rclPercent) / 100;
    expect(exercicio.individualQuota).toBe(Math.round((teto / exercicio.councilors) * 100) / 100);
    expect(centavos(exercicio.individualQuota) * exercicio.councilors).toBeLessThanOrEqual(centavos(11_112_367));
  });

  it("todo destino de execução direta alcança unidades que existem em 2027", () => {
    const unidades = new Set(linhas.map((d) => d.uo));
    for (const d of todosDestinos()) {
      if (d.execucao !== "DIRETA" || !d.uo) continue;
      const alvo = unidadesDoDestino(d.uo, unidades);
      expect(alvo.length, d.nome).toBeGreaterThan(0);
      for (const u of alvo) expect(unidades, d.nome).toContain(u);
    }
  });
});

describe("PL 264/2026 — os casos do relatório de 29/09 sobre a base de 2027", () => {
  const loa = loaDoExercicio(2027);
  const catalogo = catalogoDoExercicio(2027);
  const classifica = (objeto: string, trecho: string) => {
    const d = destino(trecho);
    return classificar({ objeto, destino: d, execucao: d.execucao, pretendido: 20000, loa, catalogo });
  };
  const primeira = (r: Classificacao): Candidata | null => r.selecionada ?? r.opcoes[0] ?? r.candidatas[0] ?? null;

  for (const c of CASOS) {
    it(`TESTE ${c.teste}: ${c.destino} cai em dotação de material (30) da própria unidade`, () => {
      const r = classifica(c.objeto, c.destino);
      expect(["OK", "VALIDAR"]).toContain(r.situacao);
      const p = primeira(r);
      expect(p, "nenhuma candidata apresentada").not.toBeNull();
      expect(p!.uo).toBe(destino(c.destino).uo);
      expect(p!.elem).toBe("30");
      if (c.subf) expect(p!.subf).toBe(c.subf);
      for (const o of r.opcoes) expect(o.elem).toBe("30");
    });
  }

  it("TESTE 15: a EMEB atende os dois níveis — o sistema pede a escolha e oferece 361 e 365", () => {
    const r = classifica("[TESTE 15] Custeio de material de consumo para a EMEB Pe. Estevo", "Estevo");
    expect(r.situacao).toBe("VALIDAR");
    const subfs = new Set(r.opcoes.map((o) => o.subf));
    expect(subfs.has("361")).toBe(true);
    expect(subfs.has("365")).toBe(true);
    for (const o of r.opcoes) expect(o.elem).toBe("30");
  });

  it("material de consumo encaixa em todos os destinos de execução direta", () => {
    for (const d of todosDestinos()) {
      if (d.execucao !== "DIRETA") continue;
      const r = classificar({ objeto: `Custeio de material de consumo para ${d.nome}`, destino: d, execucao: d.execucao, pretendido: 20000, loa, catalogo });
      expect(["OK", "VALIDAR"], d.nome).toContain(r.situacao);
      expect(unidadesDoDestino(d.uo, loa.map((x) => x.uo)), d.nome).toContain(primeira(r)?.uo);
    }
  });

  // O Hospital deixou de ter três unidades e passou a ter doze, uma por
  // serviço. O destino aponta para o órgão inteiro: a dotação é do Hospital,
  // em qualquer das unidades dele.
  describe("Hospital — destino que cobre o órgão inteiro", () => {
    const HOSPITAL = "Hospital Municipal Dr. Tabajara";

    it("o Hospital alcança as doze unidades do órgão 20", () => {
      const r = classifica("Aquisição de ventiladores mecânicos para a UTI do Hospital Municipal", HOSPITAL);
      expect(r.unidadesAlvo).toHaveLength(12);
      expect(r.unidadesAlvo.every((u) => u.startsWith("20."))).toBe(true);
    });

    it("equipamento para o Hospital encontra a dotação de equipamento (52) do próprio Hospital", () => {
      const r = classifica("Aquisição de ventiladores mecânicos para a UTI do Hospital Municipal", HOSPITAL);
      expect(["OK", "VALIDAR"]).toContain(r.situacao);
      const p = primeira(r);
      expect(p?.uo.startsWith("20.")).toBe(true);
      expect(`${p?.gnd}.${p?.mod}.${p?.elem}`).toBe("4.90.52");
      for (const o of r.opcoes) expect(o.uo.startsWith("20.")).toBe(true);
    });

    it("material de consumo para o Hospital fica em dotação de material (30) do Hospital", () => {
      const r = classifica("Custeio de material de consumo hospitalar para o Hospital Municipal", HOSPITAL);
      expect(["OK", "VALIDAR"]).toContain(r.situacao);
      for (const o of r.opcoes.length ? r.opcoes : [primeira(r)!]) {
        expect(o.uo.startsWith("20.")).toBe(true);
        expect(o.elem).toBe("30");
      }
    });

    it("obra e equipamento não se substituem: sem linha de obra no Hospital que sirva, não vira equipamento", () => {
      const r = classifica("Reforma do telhado do Hospital Municipal", HOSPITAL);
      for (const o of [...r.opcoes, ...(r.selecionada ? [r.selecionada] : [])]) expect(o.elem).toBe("51");
    });

    it("o Centro de Especialidades é do Hospital: cobre as doze unidades e acha equipamento", () => {
      const r = classifica("Aquisição de equipamentos hospitalares para o Centro de Especialidades Médicas", "Centro de Especialidades Médicas");
      expect(r.unidadesAlvo).toHaveLength(12);
      expect(["OK", "VALIDAR"]).toContain(r.situacao);
      expect(`${primeira(r)?.gnd}.${primeira(r)?.mod}.${primeira(r)?.elem}`).toBe("4.90.52");
    });
  });

  // O cadastro de destinos é um só para todos os exercícios. Em 2026 a unidade
  // 20.04 não existia: o destino vale pelo órgão, e a emenda continua cabendo.
  describe("o mesmo cadastro sobre a base de 2026", () => {
    const loa26 = loaDoExercicio(2026);
    const cat26 = catalogoDoExercicio(2026);
    const em2026 = (objeto: string, trecho: string) => {
      const d = destino(trecho);
      return classificar({ objeto, destino: d, execucao: d.execucao, pretendido: 20000, loa: loa26, catalogo: cat26 });
    };

    it("o Hospital alcança as três unidades de 2026 e o material continua cabendo", () => {
      const r = em2026("Custeio de material de consumo hospitalar para o Hospital Municipal", "Hospital Municipal Dr. Tabajara");
      expect(r.unidadesAlvo).toEqual(["20.01", "20.02", "20.03"]);
      expect(["OK", "VALIDAR"]).toContain(r.situacao);
    });

    it("o Centro de Especialidades cobre o órgão também em 2026", () => {
      const r = em2026("Custeio de material de consumo para o Centro de Especialidades Médicas", "Centro de Especialidades Médicas");
      expect(r.unidadesAlvo).toEqual(["20.01", "20.02", "20.03"]);
      expect(["OK", "VALIDAR"]).toContain(r.situacao);
    });

    it("destino de unidade única continua preso à unidade dele", () => {
      expect(em2026("Custeio de material de consumo ambulatorial para a UBS Zona Norte", "UBS Zona Norte").unidadesAlvo).toEqual(["13.01"]);
    });
  });

  // O projeto de 2027 reúne as obras de escola, de unidade de saúde e de
  // assistência na Secretaria de Obras (08.01), em linhas da função de cada
  // área. Quando o órgão do destino não tem linha de obra, a dotação é a linha
  // da função dele nessa secretaria — e a tela diz isso.
  describe("obra executada pela Secretaria de Obras", () => {
    const daObra = (r: Classificacao) => r.selecionada ?? r.opcoes[0] ?? null;

    it("as secretarias de Educação, Saúde e Assistência não têm linha de obra; a de Obras tem", () => {
      const obra = (d: Linha) => d.gnd === "4" && d.mod === "90" && d.elem === "51";
      for (const orgao of ["11", "13", "14"]) expect(linhas.some((d) => d.uo.startsWith(`${orgao}.`) && obra(d)), orgao).toBe(false);
      expect(linhas.some((d) => d.uo === "08.01" && obra(d))).toBe(true);
    });

    it("reforma em EMEF cai na linha de prédios da educação, ensino fundamental (12.361)", () => {
      const r = classifica("Reforma da quadra da EMEF João Bueno Junior", "João Bueno");
      expect(["OK", "VALIDAR"]).toContain(r.situacao);
      expect(r.unidadeDaObra).toBe("08.01");
      expect(daObra(r)).toMatchObject({ uo: "08.01", funcao: "12", subf: "361", gnd: "4", mod: "90", elem: "51" });
    });

    it("reforma em EMEI cai na linha de educação infantil (12.365)", () => {
      const r = classifica("Reforma e ampliação da EMEI Aida Rocha", "EMEI Aida");
      expect(daObra(r)).toMatchObject({ uo: "08.01", funcao: "12", subf: "365", elem: "51" });
    });

    it("reforma em UBS cai na linha de unidades de saúde e consome a parcela da saúde", () => {
      const r = classifica("Reforma e ampliação da UBS Zona Norte", "UBS Zona Norte");
      const d = daObra(r);
      expect(d).toMatchObject({ uo: "08.01", funcao: "10", elem: "51" });
      expect(parcelaDaDotacao(d)).toBe("SAUDE");
    });

    it("reforma em equipamento da assistência cai na linha da função 08", () => {
      const r = classifica("Reforma do prédio do CREAS", "CREAS");
      expect(daObra(r)).toMatchObject({ uo: "08.01", funcao: "08", elem: "51" });
    });

    it("só entram linhas da função do destino, e só da secretaria de fora da área", () => {
      for (const [objeto, trecho, funcao] of [
        ["Reforma da quadra da EMEF João Bueno Junior", "João Bueno", "12"],
        ["Reforma e ampliação da UBS Zona Norte", "UBS Zona Norte", "10"],
      ] as const) {
        const r = classifica(objeto, trecho);
        for (const c of r.candidatas) {
          expect(c.uo).toBe("08.01"); // nunca a fundação (19) nem o hospital (20)
          expect(c.funcao).toBe(funcao);
          expect(c.elem).toBe("51");
        }
      }
    });

    it("o Hospital tem obra própria: a reforma dele não sai do Hospital", () => {
      const r = classifica("Reforma e ampliação do Hospital Municipal", "Hospital Municipal Dr. Tabajara");
      expect(r.unidadeDaObra).toBeNull();
      for (const c of r.candidatas) expect(c.uo.startsWith("20.")).toBe(true);
    });

    it("o Centro de Especialidades é do Hospital, que tem obra própria: não busca na Secretaria de Obras", () => {
      const r = classifica("Reforma do Centro de Especialidades Médicas", "Centro de Especialidades Médicas");
      expect(r.unidadeDaObra).toBeNull();
      for (const c of r.candidatas) expect(c.uo.startsWith("20.")).toBe(true);
    });

    it("equipamento não usa esse caminho: sem linha de equipamento na unidade, continua óbice", () => {
      const semEquipamentoNaSaude = loa.filter((d) => !(d.uo.startsWith("13.") && d.elem === "52"));
      const d = destino("UBS Zona Norte");
      const r = classificar({ objeto: "Compra de uma ambulância", destino: d, execucao: d.execucao, pretendido: 100000, loa: semEquipamentoNaSaude, catalogo });
      expect(r.unidadeDaObra).toBeNull();
      expect(r.situacao).toBe("OBICE");
    });

    it("em 2026 as secretarias tinham obra própria: nada muda", () => {
      const d = destino("João Bueno");
      const r = classificar({ objeto: "Reforma da quadra da EMEF João Bueno Junior", destino: d, execucao: d.execucao, pretendido: 20000, loa: loaDoExercicio(2026), catalogo: catalogoDoExercicio(2026) });
      expect(r.unidadeDaObra).toBeNull();
      expect(daObra(r)?.uo).toBe("11.01");
    });
  });
});

describe("correções da rodada de testes de 02/10", () => {
  const loa = loaDoExercicio(2027);
  const catalogo = catalogoDoExercicio(2027);
  const classifica = (objeto: string, trecho: string) => {
    const d = destino(trecho);
    return classificar({ objeto, destino: d, execucao: d.execucao, pretendido: 50000, loa, catalogo });
  };

  it("aquisição de equipamentos para a UBS é compra de bem, não obra — e não vai para a Secretaria de Obras", () => {
    const r = classifica("Aquisição de equipamentos médicos para a UBS Zona Norte", "UBS Zona Norte");
    expect(r.objeto?.elemento).toBe("52");
    expect(r.objeto?.natureza).toBe("CAPITAL");
    expect(r.unidadeDaObra).toBeNull();
    for (const o of [...r.opcoes, ...(r.selecionada ? [r.selecionada] : [])]) {
      expect(o.uo).toBe("13.01");
      expect(o.elem).toBe("52");
    }
  });

  it("o mesmo vale para a escola (termo 'emef') e para o nome por extenso", () => {
    for (const [objeto, trecho] of [
      ["Compra de equipamentos para a EMEF João Bueno Junior", "João Bueno"],
      ["Aquisição de equipamentos para a unidade de saúde Zona Sul", "UBS Zona Sul"],
    ] as const) {
      const r = classifica(objeto, trecho);
      expect(r.objeto?.elemento, objeto).toBe("52");
      expect(r.unidadeDaObra, objeto).toBeNull();
    }
  });

  it("verbo de obra continua decidindo: reforma da UBS é obra", () => {
    expect(classifica("Reforma e ampliação da UBS Zona Norte", "UBS Zona Norte").objeto?.elemento).toBe("51");
  });

  it("destino que cobre o órgão inteiro oferece todas as dotações compatíveis, não só seis", () => {
    const r = classifica("Custeio de material de consumo hospitalar para o Hospital Municipal", "Hospital Municipal Dr. Tabajara");
    expect(r.opcoes.length).toBeGreaterThan(6);
    expect(new Set(r.opcoes.map((o) => o.uo)).size).toBeGreaterThan(6);
  });

  it("destino de uma unidade só continua limitado a seis opções", () => {
    const r = classifica("Custeio de material de consumo ambulatorial para a UBS Zona Norte", "UBS Zona Norte");
    expect(r.opcoes.length).toBeLessThanOrEqual(6);
  });
});
