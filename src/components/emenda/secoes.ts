// As seções de cada etapa da emenda (protótipo aprovado em 08/10/2026) e o
// que impede avançar de cada uma. A conferência completa continua na etapa 3:
// aqui só se pede o que a seção tem de ter para seguir.

import { informadaConferida, lerNumero, type EstadoEmenda } from "@/lib/emendas/estado";
import type { DerivadoEmenda } from "./editor";

export type Secao = { id: string; titulo: string; descricao: string };

export const ETAPAS = ["Descrição", "Plano de trabalho", "Validação e envio"] as const;

export const SECOES: Record<1 | 2 | 3, Secao[]> = {
  1: [
    { id: "tipo", titulo: "Tipo de emenda e execução", descricao: "Escolha o tipo de emenda e quem executa o recurso." },
    { id: "destino", titulo: "Destino e endereço", descricao: "Para onde vai o recurso e onde o objeto será entregue ou executado." },
    { id: "objeto", titulo: "Objeto e valor", descricao: "Descreva o que a emenda vai fazer e quanto ela vale. Este é o valor da emenda." },
    { id: "dotacao", titulo: "Dotação", descricao: "De onde sai o recurso no orçamento." },
  ],
  2: [
    { id: "justificativa", titulo: "Agente, justificativa e meta finalística", descricao: "Quem executa, por que a emenda é necessária e o resultado esperado." },
    { id: "metas", titulo: "Metas", descricao: "Quem será atendido e quanto será entregue." },
    { id: "memoria", titulo: "Memória de cálculo", descricao: "Os itens que compõem o valor da emenda, com a fonte de cada preço." },
    { id: "execucao", titulo: "Condições, etapas e cronograma", descricao: "Condições de uso, etapas da execução e parcelas do desembolso." },
  ],
  3: [
    { id: "verificacoes", titulo: "Verificações", descricao: "As treze conferências feitas antes do envio. As que têm alerta ou falha já vêm abertas." },
    { id: "envio", titulo: "Declarações e envio", descricao: "Marque as declarações e envie. Depois do envio a emenda recebe o número, que não muda mais." },
  ],
};

export const secoesDa = (etapa: number) => SECOES[(etapa === 2 || etapa === 3 ? etapa : 1) as 1 | 2 | 3];

// alvo: id do campo (o Campo com esse htmlFor fica vermelho) ou de um bloco.
export type Problema = { alvo: string; msg: string };

// Conferências do motor que pertencem a cada seção da etapa 2.
const DA_SECAO: Record<string, (titulo: string) => string | null> = {
  justificativa: (t) =>
    t === "Agente executor ausente" ? "secao-agente" : t === "Justificativa insuficiente" ? "f-just" : t === "Meta finalística ausente" ? "f-finalistica" : null,
  metas: (t) => (t === "Metas incompletas" ? "secao-metas" : null),
  memoria: (t) =>
    t === "Memória de cálculo vazia" || t === "Linha sem fonte de preço" || t === "Planilha fora da tolerância" || t === "Item incompatível com o objeto da emenda"
      ? "secao-memoria"
      : null,
  execucao: (t) =>
    t.endsWith(" incompleta") ? "secao-viabilidade" : t === "Instrumento da parceria não definido" ? "secao-viabilidade" : t === "Cronograma não confere" ? "secao-cronograma" : null,
};

const MSG: Record<string, string> = {
  "Agente executor ausente": "Defina o agente executor",
  "Justificativa insuficiente": "Escreva a justificativa com ao menos 60 caracteres",
  "Meta finalística ausente": "Descreva a meta finalística",
  "Metas incompletas": "Informe ao menos uma meta com beneficiários, unidade e meta física",
  "Memória de cálculo vazia": "Lance ao menos um item com preço",
  "Linha sem fonte de preço": "Informe a fonte do preço em todas as linhas",
  "Planilha fora da tolerância": "O total da planilha está fora da tolerância do valor da emenda",
  "Item incompatível com o objeto da emenda": "Retire o item incompatível com o objeto",
  "Instrumento da parceria não definido": "Escolha o instrumento da parceria",
  "Cronograma não confere": "A soma das parcelas precisa igualar o valor da emenda",
};

export function problemasDaSecao(etapa: number, secao: string, e: EstadoEmenda, d: DerivadoEmenda): Problema[] {
  const p: Problema[] = [];
  if (etapa === 1) {
    if (secao === "destino") {
      if (!e.destinoId) p.push({ alvo: "f-dest", msg: "Escolha para onde vai a emenda" });
      if (!e.endereco.trim()) p.push({ alvo: "f-loc", msg: "Informe o endereço do local" });
    } else if (secao === "objeto") {
      if (!e.objeto.trim()) p.push({ alvo: "f-obj", msg: "Descreva o objeto da emenda" });
      if (!(lerNumero(e.pretendido) > 0)) p.push({ alvo: "f-pre", msg: "Informe o valor da emenda" });
    } else if (secao === "dotacao") {
      if (e.dotacaoInformada) {
        if (!informadaConferida(e.dotacaoInformada) || !d.informada) p.push({ alvo: "f-dot-unidade", msg: "Preencha a classificação e clique em «Conferir na LOA»" });
        else if (d.informada === "FORA" && !e.declaracaoDotacao) p.push({ alvo: "f-dec-dotacao", msg: "Marque a declaração de responsabilidade pela classificação" });
      } else if (!d.classificacao || d.obsoleta) {
        p.push({ alvo: "b-analisar", msg: "Clique em «Analisar e classificar» para o sistema procurar a dotação" });
      } else if (!d.avanca) {
        p.push({ alvo: "nova-emenda-resultado", msg: "Escolha uma das dotações ou reescreva o objeto" });
      }
    }
    return p;
  }
  if (etapa === 2) {
    const mapa = DA_SECAO[secao];
    if (!mapa) return p;
    for (const c of d.checks) {
      if (c.nivel !== "bad") continue;
      const alvo = mapa(c.titulo);
      if (alvo) p.push({ alvo, msg: MSG[c.titulo] ?? c.titulo.replace(/ incompleta$/, ": responda todas as perguntas") });
    }
    return p;
  }
  return p;
}
