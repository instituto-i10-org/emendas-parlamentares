"use server";

import { anoDaTela } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { interpretar } from "@/lib/riep";
import { carregarContexto } from "@/lib/emendas/contexto";
import { consultarCnpj, type DadosCnpj } from "@/lib/servicos/cnpj";
import { pesquisarPrecos, type ResultadoPreco } from "@/lib/servicos/precos";
import { LIMITES_CAMPO, payloadRedacao, referenciasDeRedacao, type CampoTexto, type Referencia } from "@/lib/servicos/redacao";
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
}): Promise<{ ok: true; texto: string; referencias: Referencia[] } | Falha> {
  const user = await getCurrentUser();
  const max = LIMITES_CAMPO[entrada.campo];
  if (!max || typeof entrada.texto !== "string" || entrada.texto.trim().length < 8 || entrada.texto.length > max) {
    return { ok: false, erro: "Escreva um texto dentro do limite do campo antes de pedir a melhoria." };
  }
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) return { ok: false, erro: "A melhoria de texto aguarda a chave da OpenAI no servidor." };
  if (!rateLimit(`ia:${user.id}`, 8, 60_000)) return { ok: false, erro: "Aguarde um minuto antes de pedir novas sugestões." };

  const ano = await anoDaTela(entrada.exercicio);
  const ctx = ano ? await carregarContexto(ano) : null;
  const programas = ano
    ? await prisma.programa.findMany({ where: { exercicio: { ano }, constaNoPPA: true }, select: { codigo: true, nome: true } })
    : [];
  const acoes = ctx
    ? ctx.loa.map((d) => ({ funcao: d.funcao, programa: d.prog, programaNome: d.progn, acao: d.codigo.split(/[./]/)[0], acaoNome: d.nome }))
    : [];
  const c = {
    campo: entrada.campo,
    texto: entrada.texto,
    objeto: String(entrada.objeto ?? "").slice(0, 500),
    destino: String(entrada.destino ?? "").slice(0, 500),
    execucao: entrada.execucao === "INDIRETA" ? ("INDIRETA" as const) : ("DIRETA" as const),
  };
  const referencias = referenciasDeRedacao(c, {
    programas,
    acoes,
    biblioteca: ctx?.catalogo.objetos ?? [],
    rotuloBase: ctx?.config.rotuloBase ?? "LOA",
  });

  let resposta: Response;
  try {
    resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(35_000),
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(payloadRedacao(c, referencias, process.env.OPENAI_MODEL || "gpt-4.1-mini")),
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
  return { ok: true, texto, referencias };
}

// ---------------------------------------------------------------------- Preços

export async function buscarPrecos(
  consulta: string,
  objeto: string,
  exercicio?: number
): Promise<{ ok: true; resultados: ResultadoPreco[]; indisponiveis: string[]; aproximados: boolean } | Falha> {
  const user = await getCurrentUser();
  const q = String(consulta ?? "").trim();
  if (q.length < 3 || q.length > 160) return { ok: false, erro: "Digite de 3 a 160 caracteres para pesquisar." };
  if (!rateLimit(`precos:${user.id}`, 30, 60_000)) return { ok: false, erro: "Muitas consultas seguidas. Aguarde um minuto." };
  const ano = await anoDaTela(exercicio);
  const ctx = ano ? await carregarContexto(ano) : null;
  const biblioteca = ctx?.catalogo.objetos ?? [];
  // Obra consulta também as tabelas oficiais de engenharia.
  const item = interpretar(q, biblioteca);
  const obj = interpretar(String(objeto ?? "").slice(0, 500), biblioteca);
  const engenharia = item?.confianca === "exato" ? item.elemento === "51" : obj?.elemento === "51";
  try {
    return { ok: true, ...(await pesquisarPrecos(q, engenharia)) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível pesquisar agora." };
  }
}

// ------------------------------------------------------------------------ CNPJ

export async function buscarCnpj(cnpj: string): Promise<{ ok: true; dados: DadosCnpj } | Falha> {
  const user = await getCurrentUser();
  if (!rateLimit(`cnpj:${user.id}`, 20, 60_000)) return { ok: false, erro: "Muitas consultas seguidas. Aguarde um minuto." };
  try {
    return { ok: true, dados: await consultarCnpj(cnpj) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível consultar." };
  }
}
