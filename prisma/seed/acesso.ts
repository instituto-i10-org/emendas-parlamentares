import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../src/generated/prisma/client";

// Os seis perfis base. Idempotente por nome: reaplicar realinha as permissões
// sem trocar o id, e os vínculos de usuário continuam valendo.
export const PERFIS = [
  {
    nome: "Administrador Geral",
    descricao: "Acesso total ao sistema. Único perfil que compõe novos perfis de acesso.",
    poder: null,
    apresentarEmendas: true,
    gerirTodasEmendas: true,
    tramitarEmendas: true,
    gerirPlanejamento: true,
    gerirExercicios: true,
    administrarConfiguracoes: true,
    analisarViabilidade: true,
    registrarExecucao: true,
    adminGeral: true,
  },
  {
    nome: "Vereador",
    descricao: "Gabinete parlamentar: apresenta e gere as emendas de própria autoria, dentro da sua cota.",
    poder: "LEGISLATIVO",
    apresentarEmendas: true,
  },
  {
    nome: "Comissão de Finanças e Orçamento",
    descricao: "Conduz a análise técnica: gere qualquer emenda do exercício e aprova ou rejeita com parecer.",
    poder: "LEGISLATIVO",
    gerirTodasEmendas: true,
    tramitarEmendas: true,
  },
  {
    nome: "Presidente da Câmara",
    descricao: "Soma as capacidades do vereador e da comissão, mais a administração do Legislativo.",
    poder: "LEGISLATIVO",
    apresentarEmendas: true,
    gerirTodasEmendas: true,
    tramitarEmendas: true,
    gerirExercicios: true,
    administrarConfiguracoes: true,
  },
  {
    nome: "Poder Executivo",
    descricao:
      "Instrumentos de planejamento, base de dotações e lei aprovada; analisa a viabilidade técnica e lança a execução orçamentária das emendas.",
    poder: "EXECUTIVO",
    gerirPlanejamento: true,
    gerirExercicios: true,
    administrarConfiguracoes: true,
    analisarViabilidade: true,
    registrarExecucao: true,
  },
  {
    nome: "Somente consulta",
    descricao: "Controle interno, auditoria e consulta: vê emendas, tramitação, planejamento, execução e conformidade, sem alterar nada.",
    poder: null,
    consultarTudo: true,
  },
] as const;

// Uma conta por perfil, para demonstração e testes. O vereador de exemplo é um
// autor fictício: os 13 vereadores reais entram como autores das emendas
// importadas, sem conta no sistema.
const USUARIOS = [
  { nome: "Administrador", email: "admin@emendas360.local", perfil: "Administrador Geral" },
  { nome: "Poder Executivo", email: "executivo@emendas360.local", perfil: "Poder Executivo" },
  { nome: "Presidente da Câmara", email: "presidente@emendas360.local", perfil: "Presidente da Câmara" },
  { nome: "Comissão de Finanças", email: "comissao@emendas360.local", perfil: "Comissão de Finanças e Orçamento" },
  { nome: "Vereador Exemplo", email: "vereador@emendas360.local", perfil: "Vereador", autor: true },
  { nome: "Controle Interno", email: "consulta@emendas360.local", perfil: "Somente consulta" },
];

// Senha: SEED_SENHA no .env (ambiente local) ou uma aleatória por conta. Só é
// definida quando a conta nasce — re-seed nunca troca senha.
function senhaInicial(): string {
  return process.env.SEED_SENHA || randomBytes(9).toString("base64url");
}

// Os seis perfis base, sem nenhum usuário. Usado também pelo comando que inicia
// o sistema vazio para um município novo.
export async function semearPerfis(prisma: PrismaClient): Promise<Map<string, string>> {
  const perfilId = new Map<string, string>();
  for (const p of PERFIS) {
    // Permissão ausente na lista vale falso: reaplicar o seed realinha tudo.
    const dados = {
      apresentarEmendas: false,
      gerirTodasEmendas: false,
      tramitarEmendas: false,
      gerirPlanejamento: false,
      gerirExercicios: false,
      administrarConfiguracoes: false,
      analisarViabilidade: false,
      registrarExecucao: false,
      consultarTudo: false,
      adminGeral: false,
      ...p,
      poder: p.poder ?? null,
      perfilDoSistema: true,
    };
    const salvo = await prisma.perfilAcesso.upsert({
      where: { nome: p.nome },
      update: dados,
      create: dados,
    });
    perfilId.set(p.nome, salvo.id);
  }
  return perfilId;
}

export async function semearAcesso(prisma: PrismaClient) {
  const perfilId = await semearPerfis(prisma);

  const senhasNovas: { email: string; senha: string }[] = [];
  for (const u of USUARIOS) {
    let usuario = await prisma.user.findUnique({ where: { email: u.email } });
    if (!usuario) {
      const senha = senhaInicial();
      usuario = await prisma.user.create({
        data: {
          name: u.nome,
          email: u.email,
          perfilId: perfilId.get(u.perfil)!,
          passwordHash: await bcrypt.hash(senha, 10),
        },
      });
      senhasNovas.push({ email: u.email, senha: process.env.SEED_SENHA ? "(SEED_SENHA)" : senha });
    } else {
      await prisma.user.update({
        where: { id: usuario.id },
        data: { name: u.nome, perfilId: perfilId.get(u.perfil)! },
      });
    }
    if (u.autor) {
      // Autor de demonstração: real dentro do sistema, fora do portal público.
      await prisma.autor.upsert({
        where: { nome: u.nome },
        update: { usuarioId: usuario.id, demonstracao: true },
        create: { nome: u.nome, cargo: "Vereador", usuarioId: usuario.id, demonstracao: true },
      });
    }
  }

  return { perfis: PERFIS.length, usuarios: USUARIOS.length, senhasNovas };
}
