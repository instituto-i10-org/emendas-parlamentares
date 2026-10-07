import type { PrismaClient } from "../../src/generated/prisma/client";
import { lerDados, lerMunicipio } from "./dados";

type EmendasJson = {
  fonte: { name: string; url: string };
  porVereador: { name: string; count: number; totalCents: number }[];
  emendas: {
    number: number;
    author: string;
    destination: string;
    value: number;
    healthHeuristic: boolean;
    check: { items?: number[]; total?: number[]; reduction?: number[] } | null;
  }[];
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Divergência interna do documento, registrada na leitura por OCR.
function observacaoDe(check: EmendasJson["emendas"][number]["check"]): string | null {
  if (!check) return null;
  const partes = [
    check.items?.length && `itens ${check.items.map(brl).join(" + ")}`,
    check.total?.length && `total declarado ${check.total.map(brl).join(" / ")}`,
    check.reduction?.length && `redução da reserva ${check.reduction.map(brl).join(" / ")}`,
  ].filter(Boolean);
  return `Divergência interna no documento: ${partes.join("; ")}.`;
}

// "Adriano Luciano Rodrigues - MDB" → nome e partido.
function autorDe(rotulo: string) {
  const m = rotulo.match(/^(.*?)\s+-\s+([A-Za-zÀ-ú]+)$/);
  return m ? { nome: m[1].trim(), partido: m[2] } : { nome: rotulo.trim(), partido: null };
}

// As 351 emendas impositivas apresentadas ao PL 275/2025 (LOA 2026), lidas por
// OCR. Contam para a cota dos 13 vereadores. A marcação de saúde é heurística,
// então a parcela fica em branco e a cota as divide pela meação legal.
export async function semearEmendasImportadas(prisma: PrismaClient, exercicioId: string) {
  const arquivo = lerMunicipio().emendasImportadas?.arquivo;
  if (!arquivo) return { autores: 0, emendas: 0 };
  const e = lerDados<EmendasJson>(arquivo);

  const autorId = new Map<string, string>();
  for (const v of e.porVereador) {
    const { nome, partido } = autorDe(v.name);
    const autor = await prisma.autor.upsert({
      where: { nome },
      update: { partido },
      create: { nome, partido, cargo: "Vereador" },
    });
    autorId.set(v.name, autor.id);
  }

  for (const x of e.emendas) {
    const dados = {
      exercicioId,
      autorId: autorId.get(x.author)!,
      numero: x.number,
      descricao: x.destination,
      valor: x.value,
      parcela: null,
      saudeHeuristica: x.healthHeuristic,
      observacao: observacaoDe(x.check),
      fonte: e.fonte.url,
    };
    await prisma.emendaImportada.upsert({
      where: { exercicioId_numero: { exercicioId, numero: x.number } },
      update: dados,
      create: dados,
    });
  }

  // A numeração das emendas novas continua depois das importadas.
  const ultimo = Math.max(...e.emendas.map((x) => x.number));
  await prisma.contadorEmenda.upsert({
    where: { exercicioId },
    update: {},
    create: { exercicioId, ultimo },
  });

  return { autores: e.porVereador.length, emendas: e.emendas.length };
}
