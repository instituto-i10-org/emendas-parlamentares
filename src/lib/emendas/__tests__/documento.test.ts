import { describe, expect, it } from "vitest";
import { montarDocumento, type EntradaDocumento } from "../documento";

const saude = {
  orgao: { codigo: "13", nome: "Secretaria de Saúde" },
  unidade: { codigo: "13.01", nome: "Secretaria de Saúde — Atenção Básica" },
  funcao: "10",
  subfuncao: "301",
  programa: "1001",
  acao: { codigo: "2001", nome: "ATENDIMENTOS ATENCAO BASICA" },
  natureza: { codigo: "4.4.90.52", nome: "Equipamentos e material permanente" },
  fonte: "01.3100000",
  ficha: "469",
};
const reserva = {
  orgao: { codigo: "17", nome: "Encargos Gerais do Município" },
  unidade: { codigo: "17.01", nome: "Encargos Gerais do Município — Secretaria de Finanças" },
  funcao: "99",
  subfuncao: "999",
  programa: "9999",
  acao: { codigo: "9999", nome: "RESERVA DE CONTINGÊNCIA" },
  natureza: { codigo: "9.9.99.99", nome: "A classificar" },
  fonte: "08.1100000",
  ficha: "1208",
};

const base: EntradaDocumento = {
  ano: 2027,
  numero: 12,
  enviada: true,
  submetidaEm: new Date("2026-10-08T17:30:00Z"),
  hoje: new Date("2026-10-09T12:00:00Z"),
  camara: { nome: "Câmara Municipal de Mogi Guaçu", endereco: "Rua José Colombo, 235", rodape: "rodapé" },
  nomePrefeitura: "Prefeitura Municipal de Mogi Guaçu",
  projeto: { numero: "PL 264/2026", ementa: "Estima a receita e fixa a despesa do município para o exercício de 2027." },
  fundamento: "Art. 166, § 9º da Constituição Federal.\nArt. 140, § 6º da Lei Orgânica do Município.",
  autor: { nome: "Ana Souza", partido: "XYZ", cargo: "Vereador" },
  objeto: "Aquisição de uma ambulância",
  execucao: "DIRETA",
  agenteExecutor: "Secretaria de Saúde",
  destino: { nome: "UBS Guaçu Mirim", cnpj: null, endereco: "Rua A" },
  valor: 286944.11,
  parcela: "SAUDE",
  dotacao: saude,
  informada: null,
  fichaReserva: "1208",
  reserva,
};

const textos = (l: { valor: string[] }[]) => l.flatMap((x) => x.valor).join("\n").replace(/\u00a0/g, " ");

describe("documento da emenda", () => {
  it("definitivo: número, capa e artigos", () => {
    const d = montarDocumento(base);
    expect(d.minuta).toBe(false);
    expect(d.identificador).toBe("EI 12/2027");
    expect(d.titulo).toBe("EMENDA Nº 12/2027");
    expect(d.capa.ementa).toBe("Emenda Impositiva nº 12 ao Projeto de Lei nº 264/2026.");
    expect(d.capa.data).toBe("08/10/2026");
    expect(d.capa.horario).toBe("14:30");
    expect(textos(d.cabecalho)).toContain("Projeto de Lei nº 264/2026 – Estima a receita");
    expect(textos(d.cabecalho)).toContain("Art. 140, § 6º");
    const art1 = textos(d.art1.classificacoes);
    expect(art1).toContain("10.301.1001.2001 ATENDIMENTOS ATENCAO BASICA");
    expect(art1).toContain("Ficha 469");
    expect(art1).toContain("R$ 286.944,11 (duzentos e oitenta e seis mil, novecentos e quarenta e quatro reais e onze centavos)");
    expect(art1).toContain("Ações e serviços públicos de saúde.");
    expect(art1).toContain("Não se aplica (execução direta");
    const art2 = textos(d.art2.dotacao);
    expect(art2).toContain("99.999.9999.9999 RESERVA DE CONTINGÊNCIA");
    expect(art2).toContain("9.9.99.99\n"); // "A classificar" não sai
    expect(art2).toContain("Ficha 1208");
    expect(art2).toContain("R$ 286.944,11");
    expect(d.localData).toBe("Câmara Municipal de Mogi Guaçu, 8 de outubro de 2026.");
    expect(d.assinatura).toEqual({ nome: "ANA SOUZA", cargo: "VEREADOR" });
  });

  it("o cargo não se repete quando o nome já o traz", () => {
    const d = montarDocumento({ ...base, autor: { nome: "Vereador Exemplo", partido: null, cargo: "Vereador" } });
    expect(d.cabecalho[0].valor).toEqual(["Vereador Exemplo."]);
    expect(montarDocumento(base).cabecalho[0].valor).toEqual(["Vereador Ana Souza (XYZ)."]);
  });

  it("minuta: sem número e com a data de hoje", () => {
    const d = montarDocumento({ ...base, enviada: false, numero: null, submetidaEm: null });
    expect(d.minuta).toBe(true);
    expect(d.identificador).toBe("EI —/2027");
    expect(d.capa.ementa).toBe("Emenda Impositiva nº — ao Projeto de Lei nº 264/2026.");
    expect(d.capa.data).toBe("—");
    expect(d.localData).toContain("9 de outubro de 2026");
  });

  it("entidade: beneficiário com CNPJ e endereço", () => {
    const d = montarDocumento({ ...base, execucao: "INDIRETA", destino: { nome: "Associação X", cnpj: "00.000.000/0001-00", endereco: "Rua B, 1" } });
    const t = textos(d.art1.classificacoes);
    expect(t).toContain("Denominação: Associação X");
    expect(t).toContain("Inscrição no CNPJ: 00.000.000/0001-00");
    expect(t).toContain("(órgão repassador)");
  });

  it("dotação informada à mão e reserva não configurada viram pendência visível", () => {
    const d = montarDocumento({
      ...base,
      dotacao: null,
      informada: { unidade: "13.01", funcional: "10.301.1001.2001", natureza: "4.4.90.52", fonte: "01.3100000", ficha: "" },
      fichaReserva: null,
      reserva: null,
    });
    expect(textos(d.art1.classificacoes)).toContain("informada pelo vereador");
    expect(d.art2.dotacao[0].pendente).toBe(true);
    expect(textos(d.art2.dotacao)).toContain("não configurada");
  });
});
