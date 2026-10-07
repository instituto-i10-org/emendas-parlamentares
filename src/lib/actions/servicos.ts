"use server";

import { rateLimit } from "@/lib/rate-limit";
import { consultarCnpj, type DadosCnpj } from "@/lib/servicos/cnpj";
import { LIMITES_CAMPO, conferirSugestao, payloadRedacao, type CampoTexto } from "@/lib/servicos/redacao";
import { podeCriarEmenda, temPermissao } from "@/lib/authz";
import { getCurrentUser } from "@/lib/session";

type Falha = { ok: false; erro: string };

// --------------------------------------------------------------- Melhorar texto

export async function melhorarTexto(entrada: {
  campo: CampoTexto;
  texto: string;
  objeto: string;
  destino: string;
  execucao: "DIRETA" | "INDIRETA";
  exercicio?: number;
}): Promise<{ ok: true; texto: string } | Falha> {
  const user = await getCurrentUser();
  // Apoio de quem apresenta emendas, não de qualquer conta logada.
  if (!podeCriarEmenda(user)) return { ok: false, erro: "O apoio à redação é de quem apresenta emendas." };
  const max = LIMITES_CAMPO[entrada.campo];
  if (!max || typeof entrada.texto !== "string" || entrada.texto.trim().length < 8 || entrada.texto.length > max) {
    return { ok: false, erro: "Escreva um texto dentro do limite do campo antes de pedir a melhoria." };
  }
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) return { ok: false, erro: "O apoio à redação está indisponível: falta a chave do serviço de IA no servidor. O resto do sistema funciona normalmente." };
  if (!(await rateLimit(`ia:${user.id}`, 8, 60_000))) return { ok: false, erro: "Aguarde um minuto antes de pedir novas sugestões." };

  const c = {
    campo: entrada.campo,
    texto: entrada.texto,
    objeto: String(entrada.objeto ?? "").slice(0, 500),
    destino: String(entrada.destino ?? "").slice(0, 500),
    execucao: entrada.execucao === "INDIRETA" ? ("INDIRETA" as const) : ("DIRETA" as const),
  };

  let resposta: Response;
  try {
    resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(35_000),
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(payloadRedacao(c, process.env.OPENAI_MODEL || "gpt-4.1-mini")),
    });
  } catch {
    return { ok: false, erro: "A consulta demorou demais. Tente novamente; seu texto foi preservado." };
  }
  if (!resposta.ok) {
    return {
      ok: false,
      erro:
        resposta.status === 401
          ? "A OpenAI recusou a chave configurada."
          : resposta.status === 429
            ? "A OpenAI atingiu o limite de uso ou saldo da conta."
            : "A OpenAI não conseguiu gerar a sugestão. Tente novamente.",
    };
  }
  const dados = (await resposta.json()) as { output?: { content?: { type: string; text: string }[] }[] };
  const texto = (dados.output ?? [])
    .flatMap((o) => o.content ?? [])
    .filter((x) => x.type === "output_text")
    .map((x) => x.text)
    .join("\n")
    .trim();
  if (!texto || texto.length > max) {
    return { ok: false, erro: "A sugestão não respeitou o tamanho do campo. Tente novamente; seu texto foi preservado." };
  }
  // Conferência no servidor: nada que a emenda não tenha.
  const problemas = conferirSugestao(`${c.texto} ${c.objeto} ${c.destino}`, texto);
  if (problemas.length) {
    return { ok: false, erro: `A sugestão foi recusada porque trazia ${problemas.join("; ")}. Seu texto foi preservado.` };
  }
  return { ok: true, texto };
}

// ------------------------------------------------------------------------ CNPJ

export async function buscarCnpj(cnpj: string): Promise<{ ok: true; dados: DadosCnpj } | Falha> {
  const user = await getCurrentUser();
  if (!podeCriarEmenda(user) && !temPermissao(user, "administrarConfiguracoes")) return { ok: false, erro: "Sem permissão para consultar CNPJ." };
  if (!(await rateLimit(`cnpj:${user.id}`, 20, 60_000))) return { ok: false, erro: "Muitas consultas seguidas. Aguarde um minuto." };
  try {
    return { ok: true, dados: await consultarCnpj(cnpj) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível consultar." };
  }
}
