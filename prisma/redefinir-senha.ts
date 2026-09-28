import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Redefine a senha de uma conta.
//
//   npm run db:senha -- usuario@dominio            senha aleatória, exibida uma vez
//   npm run db:senha -- usuario@dominio NovaSenha  senha informada
//   npm run db:senha -- --todas                    todas as contas, com SEED_SENHA

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env.");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const [alvo, informada] = process.argv.slice(2);
  if (!alvo) {
    console.error("Informe o e-mail da conta (ou --todas).");
    process.exit(1);
  }
  if (alvo === "--todas") {
    const senha = process.env.SEED_SENHA;
    if (!senha) throw new Error("--todas exige SEED_SENHA no .env.");
    const hash = await bcrypt.hash(senha, 10);
    const { count } = await prisma.user.updateMany({ data: { passwordHash: hash } });
    console.log(`${count} conta(s) com a senha de SEED_SENHA.`);
    return;
  }
  const senha = informada || randomBytes(9).toString("base64url");
  const usuario = await prisma.user.update({
    where: { email: alvo.toLowerCase() },
    data: { passwordHash: await bcrypt.hash(senha, 10) },
  });
  console.log(`Senha de ${usuario.email}: ${informada ? "(a informada)" : senha}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
