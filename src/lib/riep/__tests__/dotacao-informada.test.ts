import { describe, expect, it } from "vitest";
import { classificacaoInformada, ID_INFORMADA, lerDotacaoInformada, procurarNaLoa, type DotacaoInformada } from "../dotacao-informada";
import { validar } from "../validar";
import { verificar } from "../verificacoes";
import { catalogo, config, destino, loa } from "./dados-reais";
import { contexto, paraBase } from "./verificar-apoio";

const BASE = loa.map((d) => paraBase(d));
const DOT = BASE.find((d) => d.funcao === "10" && d.elem === "52")!;
const funcional = (d: typeof DOT) => `${d.funcao}.${d.subf}.${d.prog}.${d.acaoCodigo}`;
const daLoa = (d: typeof DOT, extra: Partial<DotacaoInformada> = {}): DotacaoInformada => ({
  unidade: d.uo,
  funcional: funcional(d),
  natureza: d.natureza,
  fonte: d.fonte,
  ficha: "",
  ...extra,
});
const FORA: DotacaoInformada = { unidade: "99.99", funcional: "10.302.9999.2999", natureza: "3.3.90.30", fonte: "01.1100000", ficha: "" };

describe("D4 dotação informada à mão", () => {
  it("lê os campos e diz o que falta", () => {
    expect(lerDotacaoInformada(FORA).campos).toMatchObject({ funcao: "10", subf: "302", prog: "9999", acao: "2999", gnd: "3", mod: "90", elem: "30" });
    expect(lerDotacaoInformada({ ...FORA, funcional: "10.302", fonte: "" }).faltas).toEqual([
      "funcional no formato função.subfunção.programa.ação",
      "fonte de recurso",
    ]);
  });

  it("acha a combinação na LOA, com ou sem pontuação; a ficha desempata", () => {
    expect(procurarNaLoa(daLoa(DOT), BASE)?.id).toBe(DOT.id);
    const semPontos = daLoa(DOT, { unidade: DOT.uo.replace(/\D/g, ""), natureza: DOT.natureza.replace(/\D/g, ".") });
    expect(procurarNaLoa(semPontos, BASE)?.id).toBe(DOT.id);
    if (DOT.ficha) expect(procurarNaLoa(daLoa(DOT, { ficha: "000000" }), BASE)).toBeNull();
    expect(procurarNaLoa(FORA, BASE)).toBeNull();
  });

  it("fora da LOA vira uma classificação que nunca vai para o banco como dotação", () => {
    const d = destino("UBS Centro Oeste");
    const r = classificacaoInformada({ inf: FORA, achada: null, motor: null, destino: d, execucao: "DIRETA" })!;
    expect(r.classificacao.situacao).toBe("OK");
    expect(r.candidata.id).toBe(ID_INFORMADA);
    expect(r.candidata.autorizado).toBe(0);
  });

  it("fora da LOA: (iv) a (viii) e (xi)/(xii) em alerta, nunca conforme nem falha", () => {
    const d = destino("UBS Centro Oeste");
    const { candidata } = classificacaoInformada({ inf: FORA, achada: null, motor: null, destino: d, execucao: "DIRETA" })!;
    const naBase = { ...candidata, orgao: "", acaoCodigo: "", acaoPrograma: "", natureza: "", constaNoPPA: false, completa: false };
    const r = verificar(
      { objeto: "Aquisição de material", justificativa: "Justificativa suficiente para a emenda em questão.", valor: 10000, destino: naBase, informadaForaDaLoa: true },
      contexto({}, BASE),
      []
    );
    const estado = Object.fromEntries(r.verificacoes.map((v) => [v.numero, v.estado]));
    expect([estado.iv, estado.v, estado.vi, estado.vii, estado.viii, estado.xi, estado.xii]).toEqual(Array(7).fill("alerta"));
    expect(r.verificacoes.find((v) => v.numero === "iv")!.razao).toContain("Dotação informada pelo vereador, não encontrada na LOA");
    expect(r.valida).toBe(true);
  });

  it("sem a declaração, a emenda com dotação fora da LOA não segue", () => {
    const d = destino("UBS Centro Oeste");
    const { classificacao } = classificacaoInformada({ inf: FORA, achada: null, motor: null, destino: d, execucao: "DIRETA" })!;
    const base = {
      classificacao,
      selecao: { escolha: "PROPONENTE" as const, dotacaoId: null },
      pretendido: 10000,
      endereco: d.endereco,
      agenteExecutor: "Secretaria de Saúde",
      justificativa: "Justificativa suficiente para a emenda em questão, com mais de sessenta caracteres.",
      metaFinalistica: "Meta",
      etapas: "Etapas",
      metas: [{ beneficiarios: "Pacientes", unidade: "un", quantidade: 1 }],
      itens: [],
      referencias: [],
      parcelas: [10000],
      quadro: {},
      instrumento: null,
      instrumentoOutro: "",
      evento: null,
      declaracao: true,
      declaracaoPrecos: true,
      metaPlanejamento: null,
      dotacaoInformada: "FORA" as const,
    };
    const ctx = { config, aplicado: { saude: 0, demais: 0 }, biblioteca: catalogo.objetos };
    const sem = validar({ ...base, declaracaoDotacao: false }, ctx);
    expect(sem.find((c) => c.titulo === "Declaração da dotação pendente")?.nivel).toBe("bad");
    expect(sem.find((c) => c.titulo === "Valor autorizado não conferível")?.nivel).toBe("warn");
    expect(sem.some((c) => c.titulo === "Acima do valor autorizado")).toBe(false);
    const com = validar({ ...base, declaracaoDotacao: true }, ctx);
    expect(com.find((c) => c.titulo === "Declaração da dotação")?.nivel).toBe("ok");
  });
});
