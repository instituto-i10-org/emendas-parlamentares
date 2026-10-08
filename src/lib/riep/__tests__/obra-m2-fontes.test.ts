import { describe, expect, it } from "vitest";
import { competenciaIso, itemObraM2, ordenarFontes, referenciaCompleta, urlDaFonte, type FontePreco } from "@/lib/riep";

const fonte = (p: Partial<FontePreco>): FontePreco => ({ id: "f", nome: "F", url: "https://x", orientacao: "", aplicaA: [], tipo: "PAINEL", ...p });

describe("link da fonte com o item", () => {
  it("troca {item} pelo nome do item, codificado", () => {
    const f = fonte({ url: "https://pncp.gov.br/app/atas?q={item}&status=vigente&ufs=SP&pagina=1" });
    expect(urlDaFonte(f, " cadeira de rodas ")).toBe("https://pncp.gov.br/app/atas?q=cadeira%20de%20rodas&status=vigente&ufs=SP&pagina=1");
  });
  it("sem item, o marcador sai vazio", () => {
    expect(urlDaFonte(fonte({ url: "https://pncp.gov.br/app/contratos?q={item}&pagina=1" }))).toBe("https://pncp.gov.br/app/contratos?q=&pagina=1");
  });
  it("link sem marcador fica como está", () => {
    expect(urlDaFonte(fonte({ url: "https://www.bec.sp.gov.br/" }), "luva")).toBe("https://www.bec.sp.gov.br/");
  });
  it("a fonte recomendada vem primeiro, o resto na ordem", () => {
    const l = ordenarFontes([fonte({ id: "a" }), fonte({ id: "b" }), fonte({ id: "i10", destaque: true })]);
    expect(l.map((x) => x.id)).toEqual(["i10", "a", "b"]);
  });
});

describe("obra por m²", () => {
  it("lê a competência", () => {
    expect(competenciaIso("ago/2026")).toBe("2026-08-01");
    expect(competenciaIso("Agosto/2026")).toBe("2026-08-01");
    expect(competenciaIso("08/2026")).toBe("2026-08-01");
    expect(competenciaIso("2026")).toBeNull();
    expect(competenciaIso(null)).toBeNull();
  });
  it("monta referência completa e linha única em m²", () => {
    const { referencia, item } = itemObraM2({
      objeto: "Reforma da quadra",
      area: 120,
      custo: { valor: 2089.88, competencia: "ago/2026", fonte: "Custo médio do m² SINAPI/IBGE — São Paulo, com desoneração", url: "https://ftp.ibge.gov.br/x.pdf" },
      fonte: { id: "fp_sinapi_m2", nome: "Custo médio do m² — SINAPI/IBGE" },
      codigo: "R3",
    });
    expect(referenciaCompleta(referencia)).toBe(true);
    expect(referencia).toMatchObject({ codigo: "R3", tipo: "TABELA_OFICIAL", unidade: "m²", valor: 2089.88, data: "2026-08-01", fonteId: "fp_sinapi_m2" });
    expect(referencia.campos.deson).toBe("Com desoneração");
    expect(item).toEqual({ descricao: "Reforma da quadra — área construída", unidade: "m²", quantidade: 120, valorUnitario: 2089.88, referencia: "R3" });
  });
  it("competência ilegível vai como texto, e a referência segue completa", () => {
    const { referencia } = itemObraM2({ objeto: "", area: 10, custo: { valor: 2000, competencia: "2º sem.", fonte: null, url: null }, fonte: null, codigo: "R1" });
    expect(referencia.data).toBeNull();
    expect(referencia.dataTexto).toBe("2º sem.");
    expect(referenciaCompleta(referencia)).toBe(true);
  });
});
