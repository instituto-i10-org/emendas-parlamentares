import { classificacaoValida, dotacaoDe, situacaoEfetiva } from "./classificar";
import { audesp, nomeParcela, parcelaDaDotacao, parcelaSaude, restanteParcela, totalParcela } from "./cota";
import { analisaItens, bloqueia, totalItens, type ItemCalculo } from "./itens";
import {
  EVENTOS,
  INSTRUMENTOS,
  MODELOS,
  QUADROS,
  chaveQuadro,
  elementoDoInstrumento,
  elementoPendenteOsc,
  eventoEfetivo,
  metodoQuantidade,
  modeloDaDotacao,
} from "./plano";
import { referenciaAntiga, referenciaCombina, unidadeDiverge, type ReferenciaPreco } from "./referencias";
import { BRL, NUM, norm } from "./texto";
import type {
  Aplicado,
  Checagem,
  Classificacao,
  ConfigMotor,
  Evento,
  Instrumento,
  MetaPlanejamento,
  ObjetoBiblioteca,
  Selecao,
} from "./tipos";

export type MetaFisica = { beneficiarios: string; unidade: string; quantidade: number };

// Tudo o que a etapa 3 confere. É o estado do formulário, sem DOM.
export type EstadoValidacao = {
  classificacao: Classificacao | null;
  selecao: Selecao;
  pretendido: number;
  endereco: string;
  agenteExecutor: string;
  justificativa: string;
  metaFinalistica: string;
  etapas: string;
  metas: MetaFisica[];
  itens: ItemCalculo[];
  referencias: ReferenciaPreco[];
  parcelas: number[];
  quadro: Record<string, string>;
  instrumento: Instrumento | null;
  instrumentoOutro: string;
  evento: Evento | null;
  declaracao: boolean;
  // Meta da ação da dotação, nas peças de planejamento.
  metaPlanejamento: MetaPlanejamento | null;
};

export type ContextoValidacao = {
  config: ConfigMotor;
  aplicado: Aplicado;
  biblioteca: ObjetoBiblioteca[];
  hoje?: Date;
};

const arred = (v: number) => Math.round(v * 100) / 100;

export function validar(e: EstadoValidacao, ctx: ContextoValidacao): Checagem[] {
  const { config: cfg, aplicado: apl, biblioteca } = ctx;
  const out: Checagem[] = [];
  const add = (nivel: Checagem["nivel"], titulo: string, detalhe: string) => out.push({ nivel, titulo, detalhe });

  const c = classificacaoValida(e.classificacao);
  const sit = situacaoEfetiva(c, e.selecao);
  const d = dotacaoDe(c, e.selecao);
  const v = totalItens(e.itens);
  const manual = e.selecao.escolha === "PROPONENTE" && sit === "OK" && c?.situacao === "VALIDAR";

  if (c && d) {
    add(
      sit === "OK" ? "ok" : "warn",
      "Classificação orçamentária definida",
      sit === "OK"
        ? `${d.codigo} — ${d.nome} · ${c.base}.${d.elem}` +
            (manual ? ` · escolhida pelo proponente entre ${c.opcoes.length} compatíveis` : "")
        : `Código-base ${c.base} · ação em definição pela análise técnica`
    );
  } else {
    add("bad", "Sem classificação", "Volte ao passo 1 e rode a análise — sem dotação compatível a emenda não pode ser submetida.");
  }

  // O elemento do objeto e o da dotação gravada precisam coincidir, com ou sem
  // memória de cálculo: material de consumo (30) não se paga por dotação de
  // serviços (39), nem obra (51) por equipamento (52). Para entidade o
  // elemento vem do instrumento e não se compara.
  if (c?.objeto && c.objeto.confianca === "exato" && !c.objeto.elementoIncerto && d && d.mod !== "50" && d.elem !== c.objeto.elemento) {
    add(
      "bad",
      "Elemento de despesa incompatível",
      `O objeto «${c.objeto.rotulo}» é despesa do elemento ${c.objeto.elemento} e a dotação ${d.codigo} é do elemento ${d.elem}. ` +
        "Troque a dotação no passo 1 ou reescreva o objeto para o que a dotação paga."
    );
  }

  const metasOk = e.metas.filter((m) => m.beneficiarios.trim() && m.unidade.trim() && m.quantidade > 0);
  if (metasOk.length) {
    add("ok", "Metas informadas", `${metasOk.length} linha(s) com beneficiário, unidade, meta física e forma de comprovação`);
  } else {
    add("bad", "Metas incompletas", "Informe ao menos uma meta com beneficiário, unidade, meta física e como será comprovada.");
  }

  const refPorCodigo = (cod: string | null) => (cod ? e.referencias.find((r) => r.codigo === cod) ?? null : null);
  // Linha sem preço não é cobrada.
  const incompletas = e.itens.filter((i) => i.valorUnitario > 0 && !refPorCodigo(i.referencia));
  if (v > 0) {
    if (incompletas.length) {
      add(
        "bad",
        "Linha sem referência de preço",
        `${incompletas.length} linha(s) sem referência apontada. Cadastre a referência e aponte-a — é ela que permite conferir o valor na fonte.`
      );
    } else {
      add("ok", "Memória de cálculo completa", `Valor da emenda: ${BRL(v)}, com referência apontada em todas as linhas`);
    }
  } else {
    add("bad", "Memória de cálculo vazia", "O valor da emenda nasce da memória de cálculo — lance ao menos um item com preço.");
  }

  // Compatibilidade entre os itens e o objeto da emenda.
  const ac = analisaItens({ classificacao: c, dotacao: d, itens: e.itens, biblioteca, percentualAcessorio: cfg.percentualAcessorio });
  if (ac && d) {
    const ruins = ac.linhas.filter((L) => bloqueia(L.resultado));
    if (ruins.length) {
      add(
        "bad",
        "Item incompatível com o objeto da emenda",
        ruins
          .map(
            (L) =>
              `«${L.descricao}» — ` +
              (L.resultado === "nat"
                ? `despesa de ${L.objeto!.natureza === "CAPITAL" ? "capital" : "custeio"} em dotação ${ac.gnd}.${ac.gnd}.${d.mod}.${d.elem}`
                : L.resultado === "elem"
                  ? `elemento ${L.objeto!.elemento} (${L.objeto!.rotulo}) em dotação do elemento ${d.elem}`
                  : `despesa de ${L.objeto!.area} e o objeto da emenda é de ${ac.area}`)
          )
          .join(" · ") +
          ". Divergência de natureza, de elemento ou de área não é atenuada pelo valor da linha: " +
          "ou o item sai da memória de cálculo, ou a dotação e o objeto são revistos no passo 1 para a finalidade que o item serve."
      );
    } else {
      add("ok", "Itens compatíveis com o objeto", `${ac.linhas.length} linha(s) conferida(s) contra a classificação da emenda`);
    }
    if (!ac.entrega) {
      add(
        "warn",
        "Nenhuma linha entrega o objeto",
        `Nenhum item da memória de cálculo corresponde a «${ac.objeto?.rotulo}». A emenda entrega o objeto declarado?`
      );
    }
  }

  // Quadro de origem: uma entrada por referência, não por linha.
  if (e.referencias.length) {
    const conferidas = e.referencias.filter((r) => r.procedencia === "CONFERIDA").length;
    add(
      "ok",
      "Quadro de origem dos preços",
      `${e.referencias.length} referência(s) registrada(s) · ${conferidas} conferida(s) com aprovação e ` +
        `${e.referencias.length - conferidas} informada(s) pelo proponente. Sai como anexo do plano.`
    );
  }

  const velhas = e.referencias.filter((r) => referenciaAntiga(r.data, cfg.validadeReferenciaMeses, ctx.hoje));
  if (velhas.length) {
    add(
      "warn",
      "Referência de preço antiga",
      `${velhas.length} referência(s) anteriores a ${cfg.validadeReferenciaMeses} meses (${velhas.map((r) => r.codigo).join(", ")}). ` +
        "Pode ser a melhor disponível — apenas não passa despercebida."
    );
  }

  // Painel de preços com amostra pequena: a mediana de uma compra só não é
  // pesquisa de preços (Lei 14.133/2021, art. 23; IN SEGES 65/2021).
  const AMOSTRA_MINIMA = 3;
  const pequenas = e.referencias.filter((r) => {
    if (r.tipo !== "PAINEL" && r.tipo !== "BANCO_PRECOS_SAUDE") return false;
    const n = Number(String(r.campos.amostra ?? "").replace(/\D/g, ""));
    return Number.isFinite(n) && n > 0 && n < AMOSTRA_MINIMA;
  });
  if (pequenas.length) {
    add(
      "warn",
      "Amostra de preço pequena",
      `${pequenas.map((r) => `${r.codigo} (${r.campos.amostra} compra${r.campos.amostra === "1" ? "" : "s"})`).join(", ")} — ` +
        `a pesquisa de preços pede ao menos ${AMOSTRA_MINIMA} contratações (Lei 14.133/2021, art. 23; IN SEGES 65/2021). ` +
        "Acrescente outra referência ou justifique na observação."
    );
  }

  // Unidade do item ≠ unidade da referência: o preço unitário não vale para a
  // quantidade lançada ("peça" na referência, "caixa" no item).
  const unidades: string[] = [];
  for (const i of e.itens) {
    const r = refPorCodigo(i.referencia);
    if (r && i.descricao.trim() && unidadeDiverge(i.unidade, r.unidade)) unidades.push(`«${i.descricao.trim()}» em ${i.unidade} · ${r.codigo} por ${r.unidade}`);
  }
  if (unidades.length) {
    add(
      "warn",
      "Unidade do item difere da referência",
      unidades.join(" · ") + ". O preço unitário da referência vale para a unidade dela — ajuste a unidade do item ou a quantidade."
    );
  }

  const divergentes: string[] = [];
  for (const i of e.itens) {
    const r = refPorCodigo(i.referencia);
    const it = i.descricao.trim();
    if (r && it && !referenciaCombina(r, it, biblioteca)) divergentes.push(`${r.codigo} («${r.objeto}») em «${it}»`);
  }
  if (divergentes.length) {
    add(
      "warn",
      "Referência sem relação com o item",
      divergentes.join(" · ") +
        ". Uso de referência aproximada é legítimo quando não há contratação idêntica — justifique na observação da referência."
    );
  }

  if (e.endereco.trim().length >= 10) add("ok", "Endereço do local informado", e.endereco.trim());
  else add("bad", "Endereço do local ausente", "A entrega precisa de endereço identificado para a fiscalização e para a prestação de contas.");

  if (e.justificativa.trim().length >= 60) add("ok", "Justificativa de interesse público", "Texto informado");
  else add("bad", "Justificativa insuficiente", "Descreva em ao menos 60 caracteres por que a emenda é necessária.");

  if (c) {
    const mq = metodoQuantidade({
      classificacao: c,
      dotacao: d,
      meta: e.metaPlanejamento,
      destino: c.destino,
      valor: v,
      pretendido: e.pretendido,
    });
    if (mq) {
      const somaMetas = e.metas.reduce((s, m) => s + m.quantidade, 0);
      if (mq.falta) {
        add("warn", "Quantidade sem sugestão automática", `${mq.pendencia} — o campo ficou livre e nenhum número foi presumido.`);
      } else if (somaMetas > 0) {
        const sugerido =
          mq.metodo === "proporcao_valor" ? Math.round(mq.quantidade ?? 0) : Math.round(mq.beneficiarios);
        add(
          "ok",
          "Origem da quantidade",
          (mq.metodo === "proporcao_valor"
            ? "objeto divisível · proporção pelo valor sobre a meta do exercício"
            : `objeto indivisível · população de referência do destino (${mq.fonte ?? ""})`) +
            ` · sugerido ${NUM(sugerido)}, informado ${NUM(somaMetas)}`
        );
      }
      // Comparar quantidade só faz sentido na mesma unidade da peça: 250
      // internações não se comparam a 6 unidades de saúde atendidas.
      const pl = mq.meta;
      const mesmaUnidade = !!pl?.unidade && e.metas.some((m) => norm(m.unidade) === norm(pl.unidade));
      if (mesmaUnidade && pl?.quantidadeExercicio && somaMetas > pl.quantidadeExercicio) {
        add(
          "warn",
          "Meta acima da prevista nas peças",
          `A emenda propõe ${NUM(somaMetas)} ${pl.unidade} e a LDO prevê ${NUM(pl.quantidadeExercicio)} para o exercício. ` +
            "Confira a quantidade ou o ajuste da peça."
        );
      }
      if (mq.dotacao.autorizado && v > mq.dotacao.autorizado) {
        add(
          "warn",
          "Valor acima da dotação autorizada",
          `A emenda soma ${BRL(v)} e a ação tem ${BRL(mq.dotacao.autorizado)} autorizados no exercício.`
        );
      }
    }
  }

  if (e.metaFinalistica.trim().length >= 15) add("ok", "Meta finalística informada", e.metaFinalistica.trim());
  else
    add(
      "bad",
      "Meta finalística ausente",
      "O Manual exige metas físicas e finalísticas. Descreva o resultado pretendido, não a entrega."
    );

  const evento = eventoEfetivo(d, e.evento);
  if (evento) {
    add(
      "ok",
      "Como será comprovada",
      `${EVENTOS[evento].nome} — ato do Poder Executivo na execução, registrado em ${EVENTOS[evento].onde}`
    );
  }

  if (e.agenteExecutor.trim()) add("ok", "Agente executor identificado", e.agenteExecutor.trim());
  else add("bad", "Agente executor ausente", "O Plano de Trabalho precisa dizer quem executará a despesa.");

  if (c && d) {
    add(
      "ok",
      "Discriminação da despesa",
      `${d.gnd === "4" ? "Despesa de capital" : "Despesa corrente"} — ${BRL(v)} · derivada da classificação, sem pergunta ao proponente`
    );
  }

  const modelo = modeloDaDotacao(d);
  const quadro = modelo ? QUADROS[modelo] : undefined;
  if (modelo && quadro) {
    const respostas = quadro.itens.map((_, i) => e.quadro[chaveQuadro(modelo, i)]);
    const faltam = respostas.filter((r) => !r).length;
    if (faltam === 0) add("ok", `${quadro.titulo} respondida`, respostas.join(" · "));
    else
      add(
        "bad",
        `${quadro.titulo} incompleta`,
        `${faltam} pergunta(s) sem resposta no quadro do Modelo ${MODELOS[modelo].numero}.`
      );
  }

  if (elementoPendenteOsc(c, e.instrumento, e.instrumentoOutro)) {
    add(
      "bad",
      "Instrumento da parceria não definido",
      "O elemento de despesa — 41, 42 ou 43 — depende do instrumento e não é deduzido pelo motor."
    );
  } else if (c && c.mod === "50" && e.instrumento) {
    const elemento = elementoDoInstrumento(e.instrumento, c.gnd);
    add(
      "ok",
      "Instrumento da parceria",
      elemento
        ? `${INSTRUMENTOS[e.instrumento].rotulo} → elemento ${elemento}`
        : `${e.instrumentoOutro.trim()} — instrumento atípico; o elemento será definido pela análise técnica`
    );
  }

  if (e.etapas.trim()) add("ok", "Etapas informadas", e.etapas.trim());
  else add("warn", "Etapas em branco", "A sequência sugerida pelo modelo foi apagada — descreva as etapas ou restaure a sugestão.");

  if (sit === "OK" && d) {
    if (v > 0 && v <= d.autorizado) {
      add(
        "ok",
        "Dentro do valor autorizado",
        `${BRL(v)} de ${BRL(d.autorizado)} autorizados na LOA · o saldo de execução não está disponível`
      );
    } else if (v > 0) {
      add("bad", "Acima do valor autorizado", `A dotação tem ${BRL(d.autorizado)} autorizados e a emenda soma ${BRL(v)}.`);
    } else {
      add("warn", "Valor não conferido", "Informe o valor na memória de cálculo.");
    }
  }

  // Reconciliação pretendido × definitivo: divergir é o resultado normal de
  // uma pesquisa de preço bem-feita. Alerta; quem bloqueia é saldo e cota.
  if (e.pretendido > 0 && v > 0) {
    const pc = (Math.abs(v - e.pretendido) / e.pretendido) * 100;
    if (pc <= cfg.toleranciaValorPct) {
      add(
        "ok",
        "Valor definitivo compatível com o pretendido",
        `${BRL(v)} contra ${BRL(e.pretendido)} — divergência de ${pc.toFixed(1)}%, dentro da tolerância de ${cfg.toleranciaValorPct}%`
      );
    } else {
      add(
        "warn",
        "Divergência entre o pretendido e o definitivo",
        `${BRL(e.pretendido)} no passo 1 e ${BRL(v)} na memória de cálculo — ${pc.toFixed(1)}%. ` +
          "Saldo e cota foram reconferidos abaixo com o valor definitivo."
      );
    }
  } else if (e.pretendido > 0 && v === 0) {
    add(
      "warn",
      "Valor definitivo ausente",
      `Há valor pretendido de ${BRL(e.pretendido)}, mas a memória de cálculo está vazia — é dela que sai o valor da emenda.`
    );
  }

  // Cota em duas parcelas: a checagem é contra a parcela, nunca contra o total.
  if (cfg.cotaIndividual === null) {
    add(
      "bad",
      "Cota individual não parametrizada",
      `O exercício ${cfg.exercicio} não tem cota configurada. A conferência fica pendente de configuração — o sistema não presume valor.`
    );
  } else {
    const p = parcelaDaDotacao(d);
    if (!p) {
      add(
        "warn",
        "Parcela da cota não definida",
        "Sem classificação não há como saber se a emenda consome a parcela de saúde ou a de demais áreas."
      );
    } else {
      const nm = nomeParcela(p)!;
      const tp = totalParcela(cfg, p)!;
      const ap = (p === "SAUDE" ? apl.saude : apl.demais) + v;
      if (ap <= tp) add("ok", `Dentro da parcela de ${nm}`, `${BRL(ap)} de ${BRL(tp)} · restam ${BRL(tp - ap)} nesta parcela`);
      else
        add(
          "bad",
          `Parcela de ${nm} excedida`,
          `A parcela de ${nm} é de ${BRL(tp)} e chegaria a ${BRL(ap)}. Saldo da outra parcela não cobre esta: a reserva da saúde não é intercambiável.`
        );

      // Reserva da saúde: o que a aferição da LDO muda é o momento do bloqueio.
      const aplS = apl.saude + (p === "SAUDE" ? v : 0);
      const aplD = apl.demais + (p === "DEMAIS" ? v : 0);
      const ps = parcelaSaude(cfg)!;
      if (p === "SAUDE") {
        add(
          "ok",
          "Integra a reserva da saúde",
          `Dotação com IC-CO 1002 — a emenda conta para o mínimo de ${cfg.percentualSaude}% em ações e serviços públicos de saúde`
        );
      } else {
        const faltaS = ps - aplS;
        const sobra = cfg.cotaIndividual - aplS - aplD;
        if (faltaS <= 0) {
          add("ok", "Reserva da saúde já cumprida", `${BRL(aplS)} aplicados em saúde, acima do mínimo de ${BRL(ps)}`);
        } else if (cfg.afericaoSaude === "GLOBAL") {
          // A reserva da saúde é limite do que pode ir para as demais áreas,
          // não obrigação de cada emenda: enquanto a cota restante ainda
          // alcança o mínimo, é só informação.
          if (sobra >= faltaS)
            add(
              "ok",
              "Consome a parcela de demais áreas",
              `Faltam ${BRL(faltaS)} para o mínimo em saúde e restam ${BRL(sobra)} de cota — o mínimo continua alcançável no conjunto das suas emendas`
            );
          else
            add(
              "bad",
              "Mínimo em saúde inalcançável",
              `Faltariam ${BRL(faltaS)} em saúde e sobrariam apenas ${BRL(Math.max(0, sobra))} de cota. O conjunto apresentado torna o mínimo impossível.`
            );
        } else {
          add(
            "warn",
            "Fora da reserva da saúde",
            `Aferição individual: esta emenda não conta para o mínimo de ${cfg.percentualSaude}%`
          );
        }
      }
    }
  }

  const cronograma = e.parcelas.reduce((s, x) => s + x, 0);
  if (v > 0 && arred(cronograma - v) === 0) add("ok", "Cronograma confere", "Total das parcelas igual ao valor da emenda");
  else
    add(
      "bad",
      "Cronograma não confere",
      `A soma das parcelas (${BRL(cronograma)}) precisa igualar o valor da emenda (${BRL(v)}).`
    );

  if (c && c.destino.execucao === "INDIRETA") {
    const dest = c.destino;
    if (dest.pendenciaHabilitacao) add("bad", "Habilitação da entidade", `${dest.pendenciaHabilitacao} — anexe o documento atualizado.`);
    else if (dest.novo)
      add(
        "warn",
        "Entidade recém-cadastrada",
        `CNPJ ${dest.cnpj ?? "—"} · responsável ${dest.responsavel || "—"}. A habilitação documental (arts. 33-39 da Lei 13.019/2014) ainda será conferida pela área técnica.`
      );
    else add("ok", "Habilitação da entidade", "Documentação regular (arts. 33-39 da Lei 13.019/2014)");
  }

  if (e.declaracao) add("ok", "Declaração de inexistência de vedação", "Assinada pelo proponente");
  else add("warn", "Declaração pendente", "Marque a declaração de inexistência de vínculo até o 3º grau.");

  return out;
}

export function resumoValidacao(checks: Checagem[]) {
  const bloqueios = checks.filter((c) => c.nivel === "bad").length;
  const alertas = checks.filter((c) => c.nivel === "warn").length;
  return { bloqueios, alertas, pode: bloqueios === 0 };
}

// ============================================================================
// Sinalizações da etapa 1 — amarelas por definição: alertam, não bloqueiam.
// Trechos entre ** são destaque.
// ============================================================================

export function sinaisValor(args: {
  classificacao: Classificacao | null;
  selecao: Selecao;
  pretendido: number;
  instrumento: Instrumento | null;
  instrumentoOutro: string;
  config: ConfigMotor;
  aplicado: Aplicado;
}): string[] {
  const { classificacao: r, selecao, pretendido: vp, config: cfg } = args;
  const avisos: string[] = [];
  if (!vp || !r) return avisos;
  const sit = situacaoEfetiva(r, selecao);
  const d = dotacaoDe(r, selecao);

  if (sit === "OK" && d?.abaixoDoPretendido) {
    avisos.push(
      `O valor pretendido, **${BRL(vp)}**, excede o valor autorizado da dotação ${d.codigo}, de **${BRL(d.autorizado)}**. ` +
        "A dotação continua válida — quem define o valor da emenda é a memória de cálculo do passo 2."
    );
  }
  if (sit === "VALIDAR" && r.opcoes.length) {
    const k = r.opcoes.filter((x) => x.abaixoDoPretendido).length;
    if (k) {
      avisos.push(
        `${k} das ${r.opcoes.length} candidatas têm valor autorizado abaixo do pretendido. Ficam marcadas na lista e seguem disponíveis para escolha.`
      );
    }
  }
  if (elementoPendenteOsc(r, args.instrumento, args.instrumentoOutro)) {
    avisos.push(
      "Execução indireta com **instrumento da parceria não definido**. O elemento — 41, 42 ou 43 — depende dele e não pode ser deduzido: " +
        "informe o instrumento no quadro do passo 2. A opção padrão é a parceria da Lei 13.019/2014, que cobre fomento e colaboração."
    );
  }
  if (d && !audesp(cfg)) {
    avisos.push(
      `Exercício ${cfg.exercicio} sem parametrização de emendas — **fonte AUDESP e código de aplicação pendentes de configuração**. O sistema não presume código.`
    );
  }
  if (cfg.cotaIndividual === null) {
    avisos.push(
      `Cota individual não parametrizada para o exercício ${cfg.exercicio} — a conferência de cota fica **pendente de configuração**. O sistema não presume valor.`
    );
    return avisos;
  }
  const p = parcelaDaDotacao(d);
  const rest = restanteParcela(cfg, args.aplicado, p);
  if (p && rest !== null && vp > rest) {
    avisos.push(
      `Esta emenda consome a parcela de **${nomeParcela(p)}** (IC-CO ${p === "SAUDE" ? "1002" : "diferente de 1002"}), ` +
        `onde restam **${BRL(Math.max(0, rest))}**. O valor pretendido é de ${BRL(vp)}. ` +
        "Saldo de outra parcela não cobre esta — a reserva da saúde não é intercambiável."
    );
  }
  return avisos;
}
