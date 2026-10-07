import { describe, expect, it } from "vitest";
import { descreverProtecao, protecaoDosCatalogos, totalProtegido } from "../catalogos-protecao";

const atuais = {
  areas: [
    { id: "a1", nome: "Saúde" },
    { id: "a2", nome: "Educação básica" },
  ],
  tipos: [
    { id: "t1", nome: "UBS / USF / ESF" },
    { id: "t2", nome: "Ponto de cultura" },
  ],
  objetos: [
    { id: "o1", rotulo: "Ambulância" },
    { id: "o2", rotulo: "Cadeira de rodas" },
  ],
};

describe("proteção dos catálogos editados pela tela", () => {
  it("banco sem edição pela tela: nada protegido, o arquivo vale inteiro", () => {
    const p = protecaoDosCatalogos([], atuais);
    expect(totalProtegido(p)).toBe(0);
    expect(p.ordemAreas || p.ordemTipos).toBe(false);
    expect(descreverProtecao(p)).toEqual([]);
  });

  it("área renomeada: protege o nome novo e o antigo (o arquivo não a recria)", () => {
    const p = protecaoDosCatalogos(
      [{ entidade: "AreaAplicacao", entidadeId: "a2", acao: "RENOMEAR", dadosAntes: { nome: "Educação" } }],
      atuais
    );
    expect([...p.areas].sort()).toEqual(["Educação", "Educação básica"]);
  });

  it("área excluída pela tela não volta pelo arquivo", () => {
    const p = protecaoDosCatalogos(
      [{ entidade: "AreaAplicacao", entidadeId: "a9", acao: "EXCLUIR", dadosAntes: { nome: "Estradas" } }],
      atuais
    );
    expect(p.areas.has("Estradas")).toBe(true);
  });

  it("reordenar pela tela protege a ordem de todos, não os registros", () => {
    const p = protecaoDosCatalogos(
      [
        { entidade: "AreaAplicacao", entidadeId: "a1", acao: "REORDENAR", dadosAntes: { ordem: ["Saúde"] } },
        { entidade: "TipoDestino", entidadeId: "t1", acao: "REORDENAR", dadosAntes: null },
      ],
      atuais
    );
    expect(p.ordemAreas).toBe(true);
    expect(p.ordemTipos).toBe(true);
    expect(p.areas.size + p.tipos.size).toBe(0);
  });

  it("tipo criado e objeto editado pela tela ficam protegidos", () => {
    const p = protecaoDosCatalogos(
      [
        { entidade: "TipoDestino", entidadeId: "t2", acao: "CRIAR", dadosAntes: null },
        { entidade: "ObjetoBiblioteca", entidadeId: "o1", acao: "ATUALIZAR", dadosAntes: { rotulo: "Ambulancia" } },
      ],
      atuais
    );
    expect(p.tipos.has("Ponto de cultura")).toBe(true);
    expect([...p.objetos].sort()).toEqual(["Ambulancia", "Ambulância"]);
    expect(descreverProtecao(p).join("\n")).toContain("tipos de destino: Ponto de cultura");
  });

  it("registros de outras entidades não protegem nada", () => {
    const p = protecaoDosCatalogos([{ entidade: "Destino", entidadeId: "x", acao: "ATUALIZAR", dadosAntes: { nome: "Saúde" } }], atuais);
    expect(totalProtegido(p)).toBe(0);
  });
});
