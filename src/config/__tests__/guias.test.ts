import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deveAbrirSozinho, guiaDaRota, GUIAS } from "../guias";

// Todas as âncoras declaradas nas telas: data-guia="x", guia="x" (Pagina,
// Cartao, Kpi, Secao, Campo, filtros) — e, para o guia de uma Pagina, as
// âncoras derivadas "<guia>.titulo" e "<guia>.acoes".
function ancorasDasTelas(): Set<string> {
  const raiz = path.resolve(process.cwd(), "src");
  const arquivos: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = path.join(dir, n);
      if (statSync(p).isDirectory()) {
        if (n !== "generated" && n !== "__tests__") andar(p);
      } else if (p.endsWith(".tsx")) arquivos.push(p);
    }
  };
  andar(raiz);
  const achadas = new Set<string>();
  for (const a of arquivos) {
    const s = readFileSync(a, "utf8");
    for (const m of s.matchAll(/(?:data-guia|guia)=(?:\{\s*)?"([a-z0-9.-]+)"/g)) achadas.add(m[1]);
    for (const m of s.matchAll(/data-guia=\{`([a-z0-9.-]+)\$\{/g)) achadas.add(m[1]);
    // Expressão (ex.: titulo === "x" ? "a" : "b"): vale cada literal com ponto.
    for (const m of s.matchAll(/guia=\{([^}]*)\}/g)) for (const q of m[1].matchAll(/"([a-z0-9-]+\.[a-z0-9.-]+)"/g)) achadas.add(q[1]);
    for (const m of s.matchAll(/<Pagina\b[^<]*?\sguia="([a-z0-9.-]+)"/g)) {
      achadas.add(`${m[1]}.titulo`);
      achadas.add(`${m[1]}.acoes`);
    }
  }
  // Âncoras montadas a partir de valores (importação por planilha).
  if ([...achadas].includes("config.importar-")) for (const t of ["destinos", "historico"]) achadas.add(`config.importar-${t}`);
  return achadas;
}

describe("guias de ajuda", () => {
  it("cada guia tem id único, versão e passos com título e texto", () => {
    for (const g of Object.values(GUIAS)) {
      expect(g.versao).toBeGreaterThan(0);
      expect(g.passos.length).toBeGreaterThan(0);
      for (const p of g.passos) {
        expect(p.titulo.trim()).not.toBe("");
        expect(p.texto.trim()).not.toBe("");
      }
    }
  });

  it("toda âncora citada num guia existe em alguma tela", () => {
    const telas = ancorasDasTelas();
    const faltam: string[] = [];
    for (const g of Object.values(GUIAS)) for (const p of g.passos) if (p.ancora && !telas.has(p.ancora)) faltam.push(`${g.id}: ${p.ancora}`);
    expect(faltam).toEqual([]);
  });

  it("um guia por módulo do menu, por aba de Configurações e por etapa da nova emenda", () => {
    const esperados = [
      "inicio", "painel", "comparativo", "tramitacao", "emendas", "emenda", "vereador360", "viabilidade", "execucao",
      "planejamento", "importacao", "conformidade", "conta",
      "config.municipio", "config.exercicio", "config.validacao", "config.portal", "config.usuarios", "config.perfis",
      "config.areas", "config.tipos-destino", "config.destinos", "config.biblioteca", "config.precos", "config.normas", "config.auditoria",
      "nova-emenda.etapa1", "nova-emenda.etapa2", "nova-emenda.etapa3",
    ];
    for (const id of esperados) expect(GUIAS[id], id).toBeTruthy();
    for (const g of Object.values(GUIAS)) {
      expect(g.passos.length, g.id).toBeGreaterThanOrEqual(1);
      expect(g.passos.length, g.id).toBeLessThanOrEqual(12);
    }
  });

  it("cada tela leva ao seu guia; tela sem guia não tem", () => {
    expect(guiaDaRota("/inicio")?.id).toBe("inicio");
    expect(guiaDaRota("/painel")?.id).toBe("painel");
    expect(guiaDaRota("/tramitacao")?.id).toBe("tramitacao");
    expect(guiaDaRota("/emendas")?.id).toBe("emendas");
    expect(guiaDaRota("/emendas/nova")?.id).toBe("nova-emenda.etapa1");
    expect(guiaDaRota("/emendas/cabc123")?.id).toBe("emenda");
    expect(guiaDaRota("/executivo/planejamento")?.id).toBe("planejamento");
    expect(guiaDaRota("/executivo/planejamento/importacao/cxyz")?.id).toBe("importacao");
    expect(guiaDaRota("/config", "areas")?.id).toBe("config.areas");
    expect(guiaDaRota("/config")?.id).toBe("config.exercicio");
    expect(guiaDaRota("/tela-que-nao-existe")).toBeNull();
  });

  it("o “Mostrar onde” da primeira configuração aponta para guias que existem", () => {
    for (const id of ["config.municipio", "config.exercicio", "planejamento", "config.areas", "config.destinos", "config.usuarios", "config.validacao", "config.portal"]) {
      expect(GUIAS[id], id).toBeTruthy();
    }
  });

  it("abre sozinho só na primeira visita ou quando a versão sobe", () => {
    const g = GUIAS.inicio;
    expect(deveAbrirSozinho(g, {})).toBe(true);
    expect(deveAbrirSozinho(g, { inicio: g.versao })).toBe(false);
    expect(deveAbrirSozinho(g, { inicio: g.versao - 1 })).toBe(true);
  });
});
