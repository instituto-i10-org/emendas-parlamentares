import { describe, expect, it } from "vitest";
import { autorDe } from "../../../../prisma/seed/emendas-importadas";

describe("nome e partido do autor nas emendas importadas", () => {
  it("partido de uma palavra", () => {
    expect(autorDe("Adriano Luciano Rodrigues - MDB")).toEqual({ nome: "Adriano Luciano Rodrigues", partido: "MDB" });
  });
  it("partido de duas palavras vira a sigla", () => {
    expect(autorDe("Amarai de Oliveira Gomes - UNIÃO BRASIL")).toEqual({ nome: "Amarai de Oliveira Gomes", partido: "UNIÃO" });
  });
  it("sem partido", () => {
    expect(autorDe("Vereador Exemplo")).toEqual({ nome: "Vereador Exemplo", partido: null });
  });
});
