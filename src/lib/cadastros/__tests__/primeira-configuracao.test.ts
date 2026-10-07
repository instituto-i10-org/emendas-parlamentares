import { describe, expect, it } from "vitest";
import { passosPrimeiraConfiguracao, type DadosPrimeiraConfiguracao } from "../primeira-configuracao";

const completo: DadosPrimeiraConfiguracao = {
  municipioNome: "Mogi Guaçu",
  exercicio: {
    ano: 2027,
    cotaIndividual: true,
    percentualSaude: true,
    prazoProtocolo: false,
    fundamentos: {
      cotaIndividual: { texto: "LOM, art. 140" },
      percentualSaude: { texto: "LOM, art. 140, § 6º" },
      prazoDiligenciaDias: { texto: "Regimento Interno, art. 210-C" },
    },
  },
  loaImportada: true,
  areasComOrgaos: 9,
  destinosAtivos: 131,
  usuariosQueApresentam: 1,
  usuariosQueTramitam: 1,
  portalPublico: true,
  manualInstituido: true,
  manualPublicado: true,
};
const estado = (d: DadosPrimeiraConfiguracao) => Object.fromEntries(passosPrimeiraConfiguracao(d).map((p) => [p.id, p.ok]));

describe("primeira configuração", () => {
  it("oito passos, na ordem, todos feitos quando os dados estão completos", () => {
    const passos = passosPrimeiraConfiguracao(completo);
    expect(passos.map((p) => p.id)).toEqual(["municipio", "exercicio", "loa", "areas", "destinos", "usuarios", "validacao", "portal"]);
    expect(passos.every((p) => p.ok)).toBe(true);
    for (const p of passos) expect(p.href.startsWith("/")).toBe(true);
  });

  it("sistema vazio: tudo pendente", () => {
    const vazio: DadosPrimeiraConfiguracao = {
      municipioNome: "",
      exercicio: null,
      loaImportada: false,
      areasComOrgaos: 0,
      destinosAtivos: 0,
      usuariosQueApresentam: 0,
      usuariosQueTramitam: 0,
      portalPublico: true,
      manualInstituido: false,
      manualPublicado: false,
    };
    expect(passosPrimeiraConfiguracao(vazio).every((p) => !p.ok)).toBe(true);
  });

  it("como Mogi hoje: falta fundamento e manual (passos 7 e 8)", () => {
    const mogi = { ...completo, exercicio: { ...completo.exercicio!, fundamentos: {} }, manualInstituido: false, manualPublicado: false };
    const e = estado(mogi);
    expect(e.validacao).toBe(false);
    expect(e.portal).toBe(false);
    expect(Object.values(e).filter(Boolean)).toHaveLength(6);
  });

  it("usuários exige quem apresenta e quem tramita; parâmetro definido exige fundamento", () => {
    expect(estado({ ...completo, usuariosQueTramitam: 0 }).usuarios).toBe(false);
    const semPrazo = { ...completo, exercicio: { ...completo.exercicio!, prazoProtocolo: true } };
    expect(estado(semPrazo).validacao).toBe(false);
  });
});
