import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { subfuncaoDoDestino, tipoDoDestino } from "@/lib/riep/destino";
import type { TipoDestino } from "@/lib/riep/tipos";
import { itensParaPadrao, padraoParaItens, padraoValido, testarNome } from "../tipos-destino";

const PASTA = path.resolve(process.cwd(), "prisma/dados/mogi-guacu");
const ler = <T>(arquivo: string): T => JSON.parse(readFileSync(path.join(PASTA, arquivo), "utf8")) as T;
const tipos = ler<{ tiposDestino: TipoDestino[] }>("biblioteca-objetos.json").tiposDestino;
const destinos = ler<{ destinos: { nome: string; nomeOficial?: string }[] }>("destinos-2026.json").destinos;

describe("tipos de destino: lista de palavras ↔ regra", () => {
  it("cada tipo de Mogi vira lista e volta à mesma regra, ou fica como regra avançada", () => {
    const avancados: string[] = [];
    for (const t of tipos) {
      const itens = padraoParaItens(t.padrao);
      if (itens === null) avancados.push(t.nome);
      else expect(itensParaPadrao(itens)).toBe(t.padrao);
    }
    // Só os que têm grupo ou ponto opcional ficam como regra avançada.
    expect(avancados.sort()).toEqual(["Cadastro Único", "SAMU"]);
  });

  it("salvar cada tipo sem mudança reconhece os mesmos destinos de Mogi", () => {
    const regravados = tipos.map((t) => {
      const itens = padraoParaItens(t.padrao);
      return { ...t, padrao: itens ? itensParaPadrao(itens) : t.padrao };
    });
    for (const d of destinos) {
      expect(tipoDoDestino(d.nome, d.nomeOficial, regravados)?.nome ?? null).toBe(tipoDoDestino(d.nome, d.nomeOficial, tipos)?.nome ?? null);
      expect(subfuncaoDoDestino(d.nome, d.nomeOficial, regravados)).toBe(subfuncaoDoDestino(d.nome, d.nomeOficial, tipos));
    }
  });

  it("palavra inteira não casa dentro de outra palavra; expressão casa", () => {
    const padrao = itensParaPadrao([
      { texto: "UBS", inteira: true },
      { texto: "Posto de Saúde", inteira: false },
    ]);
    expect(padrao).toBe("\\bubs\\b|posto de saude");
    const t = [{ nome: "UBS", padrao, pistas: [], subfuncao: "301" }];
    expect(testarNome("UBS Jardim Ypê", t)?.nome).toBe("UBS");
    expect(testarNome("Posto de Saúde Central", t)?.nome).toBe("UBS");
    expect(testarNome("Subsede", t)).toBeNull();
  });

  it("caractere especial digitado na lista é tratado como texto", () => {
    expect(itensParaPadrao([{ texto: "C.C.S.C", inteira: false }])).toBe("c\\.c\\.s\\.c");
  });

  it("regra avançada inválida é recusada", () => {
    expect(padraoValido("(ubs")).toMatch(/não é uma expressão válida/);
    expect(padraoValido("")).toMatch(/ao menos uma/);
    expect(padraoValido("\\bubs\\b")).toBeNull();
  });

  it("UBS Jardim Ypê é reconhecida como UBS e sugere atenção básica", () => {
    const t = testarNome("UBS Jardim Ypê", tipos);
    expect(t?.nome).toBe("UBS / USF / ESF");
    expect(t?.subfuncao).toBe("301");
  });
});
