import "server-only";
import { prisma } from "@/lib/prisma";

// ============================================================================
// Ponto único de acesso ao serviço de IA. Hoje o provedor é a OpenAI (API
// Responses); trocar de provedor é trocar este arquivo. Cada chamada registra
// o uso (operação, modelo, páginas, tokens) para acompanhar o custo.
// ============================================================================

export type ParteEntrada =
  | { tipo: "texto"; texto: string }
  | { tipo: "pdf"; nome: string; base64: string }
  | { tipo: "imagem"; mime: string; base64: string };

export type PedidoIA = {
  operacao: string;
  instrucoes: string;
  entrada: ParteEntrada[];
  // Resposta em JSON conforme o esquema (JSON Schema estrito), ou texto livre.
  esquema?: { nome: string; schema: Record<string, unknown> };
  modelo?: string;
  maxSaida?: number;
  timeoutMs?: number;
  // Páginas lidas, para o registro de uso.
  unidades?: number;
  usuarioId?: string | null;
};

export type RespostaIA = { ok: true; texto: string; json: unknown } | { ok: false; erro: string; status?: number };

export const iaDisponivel = () => !!process.env.OPENAI_API_KEY;

export const MODELO_LEITURA = () => process.env.OPENAI_MODEL_LEITURA || "gpt-4.1";
export const MODELO_REDACAO = () => process.env.OPENAI_MODEL || "gpt-4.1-mini";

function conteudo(p: ParteEntrada) {
  if (p.tipo === "texto") return { type: "input_text", text: p.texto };
  if (p.tipo === "pdf") return { type: "input_file", filename: p.nome, file_data: `data:application/pdf;base64,${p.base64}` };
  return { type: "input_image", image_url: `data:${p.mime};base64,${p.base64}`, detail: "high" };
}

export async function chamarIA(p: PedidoIA): Promise<RespostaIA> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) return { ok: false, erro: "O serviço de IA aguarda a chave no servidor (OPENAI_API_KEY)." };
  const modelo = p.modelo ?? MODELO_LEITURA();
  const corpo: Record<string, unknown> = {
    model: modelo,
    store: false,
    max_output_tokens: p.maxSaida ?? 16_000,
    instructions: p.instrucoes,
    input: [{ role: "user", content: p.entrada.map(conteudo) }],
  };
  if (p.esquema) corpo.text = { format: { type: "json_schema", name: p.esquema.nome, schema: p.esquema.schema, strict: true } };

  let resposta: Response;
  try {
    resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(p.timeoutMs ?? 120_000),
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    return { ok: false, erro: "O serviço de IA demorou demais para responder." };
  }
  if (!resposta.ok) {
    const erro =
      resposta.status === 401
        ? "O serviço de IA recusou a chave configurada."
        : resposta.status === 429
          ? "O serviço de IA atingiu o limite de uso ou o saldo da conta."
          : "O serviço de IA não conseguiu responder.";
    return { ok: false, erro, status: resposta.status };
  }
  const dados = (await resposta.json()) as {
    output?: { content?: { type: string; text: string }[] }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const texto = (dados.output ?? [])
    .flatMap((o) => o.content ?? [])
    .filter((x) => x.type === "output_text")
    .map((x) => x.text)
    .join("\n")
    .trim();

  await prisma.usoIA
    .create({
      data: {
        operacao: p.operacao,
        modelo,
        unidades: p.unidades ?? 1,
        tokensEntrada: dados.usage?.input_tokens ?? 0,
        tokensSaida: dados.usage?.output_tokens ?? 0,
        usuarioId: p.usuarioId ?? null,
      },
    })
    .catch(() => undefined);

  if (!p.esquema) return { ok: true, texto, json: null };
  try {
    return { ok: true, texto, json: JSON.parse(texto) };
  } catch {
    return { ok: false, erro: "O serviço de IA devolveu uma resposta fora do formato." };
  }
}
