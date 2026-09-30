import { describe, expect, it } from "vitest";
import { classificar, dotacaoDe, podeAvancar, situacaoEfetiva } from "../classificar";
import { interpretar } from "../interpretar";
import { contem, norm } from "../texto";
import { catalogo, destino, loa } from "./dados-reais";

const classifica = (objeto: string, trechoDestino: string, pretendido = 100000, base = loa) => {
  const d = destino(trechoDestino);
  return classificar({ objeto, destino: d, execucao: d.execucao, pretendido, loa: base, catalogo });
};

// Recortes da LOA real para provocar situações que a base completa não tem.
// A LOA sancionada tem 4.4.90.52 em toda unidade e várias linhas 3.3.50.39 de
// creche; os recortes tiram o que sobra para isolar a regra testada.
const soUmaCreche = loa.filter((d) => !(d.uo === "11.01" && d.mod === "50" && d.codigo !== "2884.39/249"));
const semEquipamentoNoHospital = loa.filter((d) => !(d.uo === "20.02" && d.elem === "52"));
const semCapitalParaEntidade = loa.filter((d) => !(d.mod === "50" && d.gnd === "4"));

describe("reconhecimento do objeto", () => {
  it("casa por palavra inteira, com plural", () => {
    expect(contem(norm("Aquisição de materiais escolares"), "material escolar")).toBe(true);
    expect(contem(norm("recursos humanos"), "curso")).toBe(false);
    expect(contem(norm("internações hospitalares"), "internacao")).toBe(true);
  });

  it("reconhece o termo da biblioteca", () => {
    const o = interpretar("Aquisição de materiais escolares para os alunos", catalogo.objetos)!;
    expect(o.rotulo).toBe("Material escolar");
    expect(o.natureza).toBe("CUSTEIO");
    expect(o.elemento).toBe("30");
    expect(o.confianca).toBe("exato");
  });

  it("verbo de obra prevalece sobre o termo", () => {
    const o = interpretar("Reforma da quadra da escola", catalogo.objetos)!;
    expect(o.rotulo).toBe("Obra escolar");
    expect(o.elemento).toBe("51");
    expect(interpretar("Reforma do computador da secretaria", catalogo.objetos)!.rotulo).toBe("Obra ou reforma");
  });

  it("marcador de custeio prevalece sobre termo de capital", () => {
    const o = interpretar("Manutenção de ambulância", catalogo.objetos)!;
    expect(o.rotulo).toBe("Custeio ou manutenção");
    expect(o.natureza).toBe("CUSTEIO");
    expect(o.area).toBe("Saúde");
  });

  it("o nome do destino não transforma o bem em obra", () => {
    const o = interpretar("Ultrassom para o centro de saúde", catalogo.objetos)!;
    expect(o.rotulo).toBe("Equipamento hospitalar");
    expect(o.elemento).toBe("52");
  });

  it("sem termo na biblioteca, infere só a natureza", () => {
    const o = interpretar("Pagamento de diárias e passagens", catalogo.objetos)!;
    expect(o.confianca).toBe("inferido");
    expect(o.natureza).toBe("CUSTEIO");
    expect(interpretar("abc", catalogo.objetos)).toBeNull();
  });
});

describe("classificação contra a LOA 2026 real", () => {
  it("dotação única e aderente: OK", () => {
    const r = classifica("Manutenção de creche para crianças de 0 a 6 anos", "APAE (Escola)", 100000, soUmaCreche);
    expect(r.situacao).toBe("OK");
    expect(r.selecionada?.codigo).toBe("2884.39/249");
    expect(r.base).toBe("3.3.50");
  });

  it("mais de uma candidata: VALIDAR com as opções", () => {
    const r = classifica("Aquisição de 1 (uma) ambulância para transporte de pacientes", "UBS Centro Oeste");
    expect(r.situacao).toBe("VALIDAR");
    expect(r.opcoes.length).toBeGreaterThanOrEqual(2);
    expect(r.opcoes.every((d) => d.uo === "13.01" && d.elem === "52" && d.aderente)).toBe(true);
    // Mesma ação e mesmo elemento: o valor autorizado desempata.
    expect(r.opcoes[0].codigo).toBe("2001.52/583");
    expect(r.semAderencia).toBe(false);
  });

  it("objeto de área estrita em destino de outra área: CONFLITO", () => {
    const r = classifica("Aquisição de ambulância", "EMEF Adirce");
    expect(r.situacao).toBe("CONFLITO");
    expect(r.uoAreaNome).toMatch(/Saúde/);
  });

  it("nenhuma dotação comporta: ÓBICE com as mais próximas", () => {
    const r = classifica("Aquisição de computadores", "APAE (Escola)", 100000, semCapitalParaEntidade);
    expect(r.situacao).toBe("OBICE");
    expect(r.proximas.length).toBeGreaterThan(0);
  });

  it("equipamento não cai em dotação de obra: ÓBICE", () => {
    // A unidade do hospital só tem a reforma (4.4.90.51); ambulância é 52.
    const r = classifica("Compra de uma ambulância", "Tabajara", 100000, semEquipamentoNoHospital);
    expect(r.objeto?.elemento).toBe("52");
    expect(r.situacao).toBe("OBICE");
    expect(r.selecionada).toBeNull();
    expect(r.proximas.some((d) => d.elem === "52")).toBe(true);
  });

  it("objeto não reconhecido não escolhe por você", () => {
    const r = classifica("Pagamento de diárias e passagens", "UBS Centro Oeste");
    expect(r.situacao).toBe("VALIDAR");
    expect(r.naoReconhecido).toBe(true);
    expect(podeAvancar(r, { escolha: null, dotacaoId: null })).toBe(false);
    expect(podeAvancar(r, { escolha: "ANALISE_TECNICA", dotacaoId: null })).toBe(true);
  });

  it("valor pretendido acima do autorizado sinaliza, nunca elimina", () => {
    const r = classifica("Aquisição de 1 (uma) ambulância para transporte de pacientes", "UBS Centro Oeste", 50_000_000);
    expect(r.candidatas.length).toBeGreaterThanOrEqual(2);
    expect(r.candidatas.every((d) => d.abaixoDoPretendido)).toBe(true);
  });

  it("a escolha do proponente vale como OK", () => {
    const r = classifica("Aquisição de 1 (uma) ambulância para transporte de pacientes", "UBS Centro Oeste");
    const [primeira, segunda] = r.opcoes.map((d) => d.codigo);
    const s = { escolha: "PROPONENTE" as const, dotacaoId: segunda };
    expect(situacaoEfetiva(r, s)).toBe("OK");
    expect(dotacaoDe(r, s)?.codigo).toBe(segunda);
    // Deixada à análise técnica, vale a primeira candidata para modelo e parcela.
    expect(dotacaoDe(r, { escolha: "ANALISE_TECNICA", dotacaoId: null })?.codigo).toBe(primeira);
  });
});
