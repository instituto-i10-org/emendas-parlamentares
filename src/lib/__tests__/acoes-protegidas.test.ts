import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Revisão de segurança (11.4): toda ação de servidor exportada confere quem a
// chama antes de agir. As públicas estão listadas aqui, com o motivo.
const PUBLICAS: Record<string, string> = {
  abrirConvite: "link da entidade: código de uso único, com limite por endereço",
  enviarPlanoEntidade: "link da entidade: código de uso único, com limite por endereço",
  entrar: "login, com limite de tentativas",
  sair: "encerra a própria sessão",
  definirExercicioAtivo: "preferência de exibição do próprio usuário",
};
// Chamadas que contam como conferência de permissão.
// gravar(): a gravação da emenda, que confere quem a chama.
const GUARDAS = /getCurrentUser\(\)|exigir\(|gestor\(\)|emendaDoGabinete\(|usuarioDaSessao\(\)|requireAccess\(|return gravar\(/;

const dir = path.resolve("src/lib/actions");
const arquivos = readdirSync(dir).filter((f) => f.endsWith(".ts"));

describe("ações de servidor protegidas", () => {
  for (const arquivo of arquivos) {
    const fonte = readFileSync(path.join(dir, arquivo), "utf8");
    if (!fonte.startsWith('"use server"')) continue;
    const funcoes = [...fonte.matchAll(/export async function (\w+)\s*\(/g)].map((m) => ({ nome: m[1], inicio: m.index! }));
    for (const [i, f] of funcoes.entries()) {
      it(`${arquivo} › ${f.nome}`, () => {
        if (PUBLICAS[f.nome]) return;
        const corpo = fonte.slice(f.inicio, funcoes[i + 1]?.inicio ?? fonte.length);
        // A conferência vem antes de qualquer escrita no banco.
        const guarda = corpo.search(GUARDAS);
        const escrita = corpo.search(/prisma\.\$transaction|\.(create|update|upsert|delete)(Many)?\(/);
        expect(guarda, "sem conferência de quem chama").toBeGreaterThan(-1);
        if (escrita > -1) expect(guarda).toBeLessThan(escrita);
      });
    }
  }
});
