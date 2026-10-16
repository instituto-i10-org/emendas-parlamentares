import { describe, expect, it } from "vitest";
import { conferenciasLocais, type Regras } from "../verificacoes";

// Regras locais do município: valor mínimo, quantidade máxima por parcela e
// vedação de pessoal/dívida em qualquer área. Desligadas, não fazem nada.
const SAUDE = { gnd: "4", funcao: "10", subf: "301" };
const EDUCACAO = { gnd: "3", funcao: "12", subf: "361" };
const PESSOAL = { gnd: "1", funcao: "12", subf: "361" };
const DIVIDA = { gnd: "2", funcao: "28", subf: "843" };

const borborema: Regras = {
  VALOR_MINIMO: { modo: "BLOQUEANTE", ativa: true, fundamento: "LDO 2027, art. 26, § 1º", parametros: { geral: 25000, entidade: 10000 } },
  QUANTIDADE_MAXIMA: { modo: "BLOQUEANTE", ativa: true, fundamento: "LOM, art. 193-A, § 5º", parametros: { demais: 6, saude: 6 } },
  SEM_PESSOAL_DIVIDA: { modo: "BLOQUEANTE", ativa: true, fundamento: "LOM, art. 193-A, § 6º" },
};
const titulos = (c: { titulo: string; nivel: string }[]) => c.map((x) => `${x.nivel}:${x.titulo}`);

describe("regras locais", () => {
  it("sem regra ligada (Mogi Guaçu), não acrescenta nada", () => {
    expect(conferenciasLocais({ valor: 1000, destino: PESSOAL, entidade: false, quantidade: { saude: 50, demais: 50 } }, {})).toEqual([]);
    const desligadas: Regras = Object.fromEntries(Object.entries(borborema).map(([k, r]) => [k, { ...r!, ativa: false }]));
    expect(conferenciasLocais({ valor: 1000, destino: PESSOAL, entidade: false, quantidade: { saude: 50, demais: 50 } }, desligadas)).toEqual([]);
  });

  it("valor mínimo geral e o da entidade sem fins lucrativos", () => {
    const abaixo = conferenciasLocais({ valor: 20000, destino: EDUCACAO, entidade: false, quantidade: null }, borborema);
    expect(titulos(abaixo)).toContain("bad:Abaixo do valor mínimo");
    expect(abaixo.find((c) => c.titulo === "Abaixo do valor mínimo")!.detalhe).toMatch(/25\.000,00/);
    const entidade = conferenciasLocais({ valor: 20000, destino: EDUCACAO, entidade: true, quantidade: null }, borborema);
    expect(titulos(entidade)).toContain("ok:Valor mínimo da emenda");
    const noLimite = conferenciasLocais({ valor: 25000, destino: EDUCACAO, entidade: false, quantidade: null }, borborema);
    expect(titulos(noLimite)).toContain("ok:Valor mínimo da emenda");
  });

  it("sem mínimo para entidade, vale o geral", () => {
    const r: Regras = { VALOR_MINIMO: { modo: "BLOQUEANTE", ativa: true, fundamento: null, parametros: { geral: 25000 } } };
    expect(titulos(conferenciasLocais({ valor: 20000, destino: EDUCACAO, entidade: true, quantidade: null }, r))).toContain("bad:Abaixo do valor mínimo");
  });

  it("modo alerta não bloqueia", () => {
    const r: Regras = { VALOR_MINIMO: { ...borborema.VALOR_MINIMO!, modo: "ALERTA" } };
    expect(titulos(conferenciasLocais({ valor: 1000, destino: EDUCACAO, entidade: false, quantidade: null }, r))).toEqual(["warn:Abaixo do valor mínimo"]);
  });

  it("quantidade máxima conta pela parcela da dotação", () => {
    const sexta = conferenciasLocais({ valor: 30000, destino: SAUDE, entidade: false, quantidade: { saude: 5, demais: 6 } }, borborema);
    expect(titulos(sexta)).toContain("ok:Quantidade de emendas");
    const setima = conferenciasLocais({ valor: 30000, destino: SAUDE, entidade: false, quantidade: { saude: 6, demais: 0 } }, borborema);
    expect(titulos(setima)).toContain("bad:Quantidade máxima de emendas");
    const livre = conferenciasLocais({ valor: 30000, destino: EDUCACAO, entidade: false, quantidade: { saude: 6, demais: 6 } }, borborema);
    expect(livre.find((c) => c.titulo === "Quantidade máxima de emendas")!.detalhe).toContain("de destinação livre");
  });

  it("veda pessoal e dívida em qualquer área", () => {
    expect(titulos(conferenciasLocais({ valor: 30000, destino: PESSOAL, entidade: false, quantidade: null }, borborema))).toContain("bad:Despesa vedada à emenda");
    expect(titulos(conferenciasLocais({ valor: 30000, destino: DIVIDA, entidade: false, quantidade: null }, borborema))).toContain("bad:Despesa vedada à emenda");
    expect(titulos(conferenciasLocais({ valor: 30000, destino: EDUCACAO, entidade: false, quantidade: null }, borborema))).toContain("ok:Fora de pessoal e dívida");
  });

  it("sem dotação, só o valor mínimo é conferido", () => {
    expect(titulos(conferenciasLocais({ valor: 30000, destino: null, entidade: false, quantidade: { saude: 0, demais: 0 } }, borborema))).toEqual(["ok:Valor mínimo da emenda"]);
  });
});
