import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { semearPerfis } from "./seed/acesso";

// Inicia o sistema VAZIO para um município novo: os seis perfis padrão (sem
// usuários), a conta do Administrador Geral e o cadastro do município em
// branco. Nenhum dado de município: o resto se faz pela tela (Configurações
// e o quadro "Primeira configuração" do Início).
//
//   npm run db:iniciar-vazio -- <email-do-admin>
//
// A senha do administrador é temporária: sai uma vez neste terminal e é
// trocada no primeiro acesso. Recusa banco que já tenha exercício ou usuário,
// e banco remoto sem PERMITIR_BANCO_REMOTO=1. Ver docs/novo-municipio.md.

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env.");
  process.exit(1);
}
if (/neon\.tech|vercel/.test(url) && process.env.PERMITIR_BANCO_REMOTO !== "1") {
  console.error("Banco remoto: rode com PERMITIR_BANCO_REMOTO=1 se for de propósito.");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Uso: npm run db:iniciar-vazio -- <email-do-admin>");
    process.exit(1);
  }
  const [exercicios, usuarios] = await Promise.all([prisma.exercicio.count(), prisma.user.count()]);
  if (exercicios || usuarios) {
    console.error(`Este banco já tem dados (${exercicios} exercício(s), ${usuarios} usuário(s)). O comando só roda em banco vazio, logo depois das migrações.`);
    process.exit(1);
  }

  // Senha temporária: aleatória, ou SENHA_INICIAL (testes automáticos).
  const senha = process.env.SENHA_INICIAL || randomBytes(12).toString("base64url");
  const perfis = await semearPerfis(prisma);
  const admin = await prisma.user.create({
    data: {
      name: "Administrador",
      email,
      perfilId: perfis.get("Administrador Geral")!,
      passwordHash: await bcrypt.hash(senha, 10),
      primeiroAcesso: true,
    },
  });
  if (!(await prisma.municipio.findFirst())) await prisma.municipio.create({ data: { nome: "", uf: "" } });
  await prisma.auditLog.create({
    data: { usuarioId: admin.id, entidade: "Sistema", entidadeId: admin.id, acao: "INICIAR_VAZIO", dadosDepois: { administrador: email, perfis: [...perfis.keys()] } },
  });

  console.log("Sistema iniciado vazio.");
  console.log(`  Perfis: ${[...perfis.keys()].join(", ")}`);
  console.log(`  Administrador: ${email}`);
  console.log(`  Senha temporária: ${process.env.SENHA_INICIAL ? "(SENHA_INICIAL)" : senha}`);
  console.log("  No primeiro acesso, o sistema pede a troca da senha e a conferência dos dados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
