import "server-only";
import { prisma } from "./prisma";

// Limite de tentativas em operações sensíveis. Guardado no banco: na Vercel
// cada requisição pode cair numa instância diferente, e um contador em memória
// não seguraria nada.
//
// Devolve verdadeiro se a tentativa cabe no limite (e a registra); falso se
// o limite da janela já foi atingido (e não registra).
export async function rateLimit(chave: string, limite: number, janelaMs: number): Promise<boolean> {
  const desde = new Date(Date.now() - janelaMs);
  const feitas = await prisma.tentativaAcesso.count({ where: { chave, criadoEm: { gte: desde } } });
  if (feitas >= limite) return false;
  await prisma.tentativaAcesso.create({ data: { chave } });
  // Limpeza ocasional do que já não conta para nenhuma janela.
  if (Math.random() < 0.01) {
    await prisma.tentativaAcesso.deleteMany({ where: { criadoEm: { lt: new Date(Date.now() - 86_400_000) } } });
  }
  return true;
}

// Quantas tentativas a chave tem na janela, sem registrar nova.
export async function tentativas(chave: string, janelaMs: number): Promise<number> {
  return prisma.tentativaAcesso.count({ where: { chave, criadoEm: { gte: new Date(Date.now() - janelaMs) } } });
}

export async function registrarTentativa(chave: string): Promise<void> {
  await prisma.tentativaAcesso.create({ data: { chave } });
}

export async function limparTentativas(chave: string): Promise<void> {
  await prisma.tentativaAcesso.deleteMany({ where: { chave } });
}
