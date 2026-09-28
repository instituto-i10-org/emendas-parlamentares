import type {
  Candidata,
  Classificacao,
  DestinoMotor,
  DotacaoMotor,
  Evento,
  Instrumento,
  MetaPlanejamento,
  Modelo,
} from "./tipos";

// ============================================================================
// Modelos de plano de trabalho. O modelo é consequência da classificação da
// etapa 1: não há pergunta, e o proponente não contraria.
// ============================================================================

export const MODELOS: Record<
  Modelo,
  { numero: "I" | "II" | "III" | "IV"; titulo: string; etapas: string; cotacao: string; executor: string }
> = {
  CUSTEIO: {
    numero: "I",
    titulo: "Custeio",
    etapas: "Planejamento → aquisição ou contratação → entrega → utilização",
    cotacao:
      "**Ata de registro de preços vigente**, do próprio Município ou de outro órgão; contratação anterior com objeto equivalente; e, quando for despesa da saúde, o **Banco de Preços em Saúde**.",
    executor: "Quem vai executar",
  },
  OBRAS: {
    numero: "II",
    titulo: "Obras e serviços de engenharia",
    etapas: "Projeto → contratação → execução → recebimento",
    cotacao:
      "**SINAPI** ou **SICRO**, tabela oficial do Estado, ou orçamento de obra semelhante já contratada. Indique a referência e a data-base da tabela.",
    executor: "Quem vai executar e onde",
  },
  TERCEIRO_SETOR: {
    numero: "III",
    titulo: "Repasse ao terceiro setor",
    etapas: "Plano de trabalho da parceria → formalização → execução → prestação de contas",
    cotacao:
      "**Termo de fomento ou de colaboração anterior** com objeto equivalente, e referências de hora/aula, hora técnica ou vaga praticadas na rede.",
    executor: "Entidade beneficiária e órgão repassador",
  },
  EQUIPAMENTOS: {
    numero: "IV",
    titulo: "Aquisição de equipamentos e material permanente",
    etapas: "Planejamento → contratação → entrega → instalação → recebimento",
    cotacao:
      "**Ata de registro de preços**, contratação semelhante de outro município, painel oficial de preços ou nota fiscal recente do mesmo item.",
    executor: "Quem vai comprar e onde o equipamento vai ficar",
  },
};

export function modeloDaDotacao(d: Pick<DotacaoMotor, "mod" | "gnd" | "elem"> | null): Modelo | null {
  if (!d) return null;
  if (d.mod === "50") return "TERCEIRO_SETOR";
  if (d.gnd === "4") return d.elem === "51" ? "OBRAS" : "EQUIPAMENTOS";
  return "CUSTEIO";
}

// ============================================================================
// Instrumento da parceria (Modelo III). O vereador não escolhe entre fomento e
// colaboração: o elemento é o mesmo nos dois (43 em custeio, 42 em capital).
// ============================================================================

export const INSTRUMENTOS: Record<Instrumento, { rotulo: string; curto: string }> = {
  PARCERIA_MROSC: {
    rotulo:
      "Parceria nos termos da Lei 13.019/2014 — termo de fomento ou de colaboração, conforme orientação técnica no momento da execução",
    curto: "Parceria da Lei 13.019/2014",
  },
  CONTRIBUICAO_LEI: { rotulo: "Contribuição instituída por lei", curto: "Contribuição instituída por lei" },
  OUTRO: { rotulo: "Outro — especificar", curto: "Outro — especificar" },
};

// O instrumento define o elemento (art. 12 da Lei 4.320/1964). "Outro" deixa
// o elemento para a análise técnica.
export function elementoDoInstrumento(instrumento: Instrumento | null, gnd: string): string | null {
  if (!instrumento || instrumento === "OUTRO") return null;
  if (instrumento === "CONTRIBUICAO_LEI") return "41";
  return gnd === "4" ? "42" : "43";
}

export function instrumentoResolvido(instrumento: Instrumento | null, outro: string): boolean {
  if (!instrumento) return false;
  if (instrumento !== "OUTRO") return true;
  return outro.trim().length >= 10;
}

// Execução indireta sem instrumento definido: o elemento fica pendente.
export function elementoPendenteOsc(c: Classificacao | null, instrumento: Instrumento | null, outro: string) {
  return !!(c && c.situacao !== "OBICE" && c.mod === "50" && !instrumentoResolvido(instrumento, outro));
}

// ============================================================================
// Quadros de viabilidade — só o que demonstra que a emenda é viável. Nada da
// instrução da contratação entra aqui.
// ============================================================================

export type QuadroViabilidade = {
  titulo: string;
  orientacao: string;
  itens: { pergunta: string; ajuda: string; opcoes: string[] }[];
};

export const QUADROS: Partial<Record<Modelo, QuadroViabilidade>> = {
  OBRAS: {
    titulo: "Viabilidade da obra",
    orientacao:
      "Quatro perguntas para demonstrar que a obra é exequível. Planilha orçamentária, ART ou RRT, memorial e cronograma físico-financeiro pertencem à execução e não são pedidos aqui.",
    itens: [
      {
        pergunta: "Existe projeto básico ou executivo?",
        ajuda: "Se não houver, a emenda segue — o projeto é condição da execução, não da apresentação.",
        opcoes: ["Sim", "Não"],
      },
      { pergunta: "Licença ambiental", ajuda: "", opcoes: ["Não aplicável", "Existente", "Pendente"] },
      {
        pergunta: "O valor permite concluir a obra ou uma etapa útil?",
        ajuda: "Etapa útil é a que pode ser entregue e usada por si.",
        opcoes: ["Conclusão integral", "Etapa útil", "A verificar"],
      },
      {
        pergunta: "A área é de titularidade do Município ou há cessão formalizada?",
        ajuda: "",
        opcoes: ["Sim", "Não", "A verificar"],
      },
    ],
  },
  EQUIPAMENTOS: {
    titulo: "Condições para uso do equipamento",
    orientacao:
      "Três perguntas para demonstrar que o bem poderá ser usado depois de entregue. Marca, modelo, fabricante e especificação técnica são da fase de contratação e não são pedidos aqui.",
    itens: [
      { pergunta: "Há local disponível para instalação?", ajuda: "", opcoes: ["Sim", "Não", "A verificar"] },
      { pergunta: "Exige obra ou adequação prévia?", ajuda: "", opcoes: ["Não", "Sim", "A verificar"] },
      {
        pergunta: "O valor cobre instalação, treinamento e garantia?",
        ajuda: "",
        opcoes: ["Sim", "Não", "A verificar"],
      },
    ],
  },
};

export const QUADRO_INSTRUMENTO = {
  titulo: "Instrumento da parceria",
  orientacao:
    "É o instrumento que determina o elemento de despesa — 41, 42 ou 43. Por isso ele não é deduzido pelo motor: enquanto não for informado, o elemento fica pendente e a classificação permanece em amarelo.",
  pergunta: "Instrumento pretendido",
  ajuda:
    "A escolha entre fomento e colaboração depende de quem propõe o plano de trabalho e se define na celebração — não precisa ser antecipada aqui, porque o elemento de despesa é o mesmo nos dois.",
};

// Chave da resposta no quadro ("OBRAS-0").
export const chaveQuadro = (m: Modelo, i: number) => `${m}-${i}`;

// ============================================================================
// O evento que encerra a meta. Quem comprova é o Executivo, na execução: o
// plano aponta o ato administrativo que fecha a entrega.
// ============================================================================

export const EVENTOS: Record<Evento, { nome: string; frase: string; onde: string }> = {
  PATRIMONIO: {
    nome: "Entrada no patrimônio",
    frase:
      "A meta será considerada cumprida com a **entrada no patrimônio municipal** do bem adquirido, registrada pelo órgão executor.",
    onde: "sistema de patrimônio do Município",
  },
  ALMOXARIFADO: {
    nome: "Entrada no almoxarifado",
    frase: "A meta será considerada cumprida com o **registro de entrada em estoque** do material adquirido.",
    onde: "sistema de almoxarifado",
  },
  LIQUIDACAO: {
    nome: "Liquidação da despesa, com atesto do fiscal",
    frase:
      "A meta será considerada cumprida com a **liquidação da despesa**, precedida do atesto do fiscal do contrato.",
    onde: "empenho e liquidação · art. 63 da Lei nº 4.320/1964",
  },
  RECEBIMENTO_DEFINITIVO: {
    nome: "Recebimento definitivo da obra",
    frase: "A meta será considerada cumprida com o **recebimento definitivo** da obra contratada.",
    onde: "termo de recebimento definitivo",
  },
  RECEBIMENTO_ETAPA: {
    nome: "Recebimento definitivo da etapa",
    frase: "A meta será considerada cumprida com o **recebimento definitivo da etapa** contratada.",
    onde: "termo de recebimento definitivo da etapa",
  },
  PRESTACAO_CONTAS: {
    nome: "Aprovação da prestação de contas",
    frase:
      "A meta será considerada cumprida com a **aprovação da prestação de contas** da parceria pelo órgão concedente.",
    onde: "decisão do concedente · Lei nº 13.019/2014",
  },
  PRESTACAO_CONTAS_DOACAO: {
    nome: "Aprovação da prestação de contas, com termo de doação com encargo",
    frase:
      "A meta será considerada cumprida com a **aprovação da prestação de contas**, acompanhada do **termo de doação com encargo** do bem adquirido pela entidade.",
    onde: "decisão do concedente · o bem não ingressa no patrimônio municipal",
  },
};

// Os eventos aplicáveis saem do modelo e da natureza da entrega.
export function eventosDe(d: Pick<DotacaoMotor, "mod" | "gnd" | "elem"> | null): Evento[] {
  const m = modeloDaDotacao(d);
  if (!m || !d) return [];
  if (m === "EQUIPAMENTOS") return ["PATRIMONIO"];
  if (m === "OBRAS") return ["RECEBIMENTO_DEFINITIVO", "RECEBIMENTO_ETAPA"];
  if (m === "TERCEIRO_SETOR") return d.gnd === "4" ? ["PRESTACAO_CONTAS_DOACAO", "PRESTACAO_CONTAS"] : ["PRESTACAO_CONTAS"];
  return d.elem === "30" ? ["ALMOXARIFADO", "LIQUIDACAO"] : ["LIQUIDACAO", "ALMOXARIFADO"];
}

// O evento vigente: o escolhido, se ainda couber; senão o primeiro aplicável.
export function eventoEfetivo(d: Pick<DotacaoMotor, "mod" | "gnd" | "elem"> | null, escolhido: Evento | null) {
  const ev = eventosDe(d);
  if (!ev.length) return null;
  return escolhido && ev.includes(escolhido) ? escolhido : ev[0];
}

// ============================================================================
// Divisibilidade e origem das quantidades. Todo número sugerido diz de onde
// veio e mostra a conta. Ausência de insumo não gera número: gera pendência.
// ============================================================================

export type MetodoQuantidade =
  | {
      metodo: "proporcao_valor";
      falta: true;
      pendencia: string;
      meta: MetaPlanejamento | null;
      dotacao: Candidata;
      valor: number;
    }
  | {
      metodo: "proporcao_valor";
      falta: false;
      meta: MetaPlanejamento;
      dotacao: Candidata;
      valor: number;
      custoMedio: number;
      quantidade: number | null;
      beneficiarios: number | null;
    }
  | {
      metodo: "populacao_referencia";
      falta: true;
      pendencia: string;
      meta: MetaPlanejamento | null;
      dotacao: Candidata;
      valor: number;
    }
  | {
      metodo: "populacao_referencia";
      falta: false;
      meta: MetaPlanejamento | null;
      dotacao: Candidata;
      valor: number;
      beneficiarios: number;
      fonte: string | null;
      data: string | null;
    };

export function metodoQuantidade(args: {
  classificacao: Classificacao | null;
  dotacao: Candidata | null;
  meta: MetaPlanejamento | null;
  destino: DestinoMotor | null;
  valor: number;
  pretendido: number;
}): MetodoQuantidade | null {
  const { classificacao: c, dotacao: d, meta: pl, destino, valor, pretendido } = args;
  if (!c || c.situacao === "OBICE" || !d) return null;
  // Curadoria da biblioteca: omissão é tratada como indivisível, nunca inferida.
  const divisivel = c.objeto?.divisibilidade === "DIVISIVEL";
  const v = valor > 0 ? valor : pretendido;

  if (divisivel) {
    if (!pl || !pl.quantidadeExercicio || !d.autorizado) {
      return {
        metodo: "proporcao_valor",
        falta: true,
        meta: pl,
        dotacao: d,
        valor: v,
        pendencia:
          !pl || !pl.quantidadeExercicio
            ? "a ação não tem meta do exercício nas peças importadas"
            : "a ação não tem valor autorizado na carga da LOA",
      };
    }
    const custoMedio = d.autorizado / pl.quantidadeExercicio;
    return {
      metodo: "proporcao_valor",
      falta: false,
      meta: pl,
      dotacao: d,
      valor: v,
      custoMedio,
      quantidade: v > 0 ? v / custoMedio : null,
      beneficiarios: v > 0 && pl.beneficiarios ? pl.beneficiarios * (v / d.autorizado) : null,
    };
  }
  // Indivisível: o beneficiário é a população de referência do destino.
  if (!destino || !destino.populacao) {
    return {
      metodo: "populacao_referencia",
      falta: true,
      meta: pl,
      dotacao: d,
      valor: v,
      pendencia: "o cadastro deste destino não informa população de referência",
    };
  }
  return {
    metodo: "populacao_referencia",
    falta: false,
    meta: pl,
    dotacao: d,
    valor: v,
    beneficiarios: destino.populacao,
    fonte: destino.fontePopulacao,
    data: destino.dataPopulacao,
  };
}

// Quantidade que a sugestão preenche na meta física (ou nada).
export function quantidadeSugerida(mq: MetodoQuantidade | null): number | null {
  if (!mq || mq.falta) return null;
  if (mq.metodo === "proporcao_valor") return mq.quantidade;
  return mq.beneficiarios;
}
