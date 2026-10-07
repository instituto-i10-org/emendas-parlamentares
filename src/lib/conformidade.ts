// ============================================================================
// Checklist de conformidade derivado do estado real. Nenhum item declaratório:
// cada um vem dos dados e, pendente, traz a providência e onde resolver. Puro.
// ============================================================================

export type ItemConformidade = {
  id: string;
  nivel: "ok" | "warn" | "bad";
  titulo: string;
  detalhe: string;
  fundamento: string;
  providencia: string | null;
  link: string | null;
  principal: boolean;
};

export type Norma = { tipo: string; ativo: boolean; dataVigencia: Date | null; vigenciaFim: Date | null; titulo: string };

export type EstadoConformidade = {
  hoje: Date;
  normas: Norma[];
  manual: { atoInstituidor: boolean; publicadoEm: Date | null };
  // Resultado da consulta real ao portal: null = portal desligado ou falhou.
  portal: { ok: boolean; detalhe: string } | null;
  emendasRemetidas: number;
  semAutor: number;
  semValidacao: number;
  parametros: { cota: number | null; percentualSaude: number | null; vereadores: number | null };
  regraCota: { ativa: boolean; modo: string };
  regraLimite: { ativa: boolean; modo: string };
  extras?: ItemConformidade[];
};

function vigente(n: Norma, hoje: Date): "VIGENTE" | "FUTURA" | "VENCIDA" | "SEM_INICIO" {
  if (!n.dataVigencia) return "SEM_INICIO";
  if (n.dataVigencia > hoje) return "FUTURA";
  if (n.vigenciaFim && n.vigenciaFim < hoje) return "VENCIDA";
  return "VIGENTE";
}

export function conferirConformidade(e: EstadoConformidade): ItemConformidade[] {
  const itens: ItemConformidade[] = [];
  const add = (i: Omit<ItemConformidade, "principal">) => itens.push({ ...i, principal: true });

  // Lei Orgânica
  const loms = e.normas.filter((n) => n.tipo === "LOM" && n.ativo);
  const lomVigente = loms.some((n) => vigente(n, e.hoje) === "VIGENTE");
  const situacaoLom = !loms.length
    ? "Nenhum dispositivo da Lei Orgânica ativo na base legal."
    : lomVigente
      ? `${loms.length} dispositivo(s) da Lei Orgânica cadastrado(s) e vigente(s).`
      : loms.some((n) => vigente(n, e.hoje) === "FUTURA")
        ? "Lei Orgânica cadastrada, mas ainda não vigente."
        : loms.some((n) => vigente(n, e.hoje) === "VENCIDA")
          ? "Lei Orgânica cadastrada com vigência encerrada."
          : "Lei Orgânica cadastrada sem início de vigência.";
  add({
    id: "LOM",
    nivel: lomVigente ? "ok" : "bad",
    titulo: "Lei Orgânica cadastrada e vigente",
    detalhe: situacaoLom,
    fundamento: "CF art. 166, §§ 9º a 20 (simetria); Lei Orgânica do Município",
    providencia: lomVigente ? null : "Cadastre a Lei Orgânica (ou ative o cadastro) com o início de vigência.",
    link: lomVigente ? null : "/config?aba=normas",
  });

  // Regimento Interno
  const ri = e.normas.some((n) => n.tipo === "REGIMENTO_INTERNO" && n.ativo);
  add({
    id: "REGIMENTO",
    nivel: ri ? "ok" : "bad",
    titulo: "Regimento Interno cadastrado",
    detalhe: ri ? "Regimento Interno ativo na base legal." : "Nenhum Regimento Interno ativo na base legal.",
    fundamento: "Regimento Interno da Câmara",
    providencia: ri ? null : "Cadastre o Regimento Interno nas normas.",
    link: ri ? null : "/config?aba=normas",
  });

  // Manual
  const manualOk = e.manual.atoInstituidor && !!e.manual.publicadoEm;
  add({
    id: "MANUAL",
    nivel: manualOk ? "ok" : "bad",
    titulo: "Manual instituído e publicado",
    detalhe: manualOk
      ? "Manual instituído por ato cadastrado e publicado."
      : [!e.manual.atoInstituidor && "sem ato instituidor", !e.manual.publicadoEm && "não publicado"].filter(Boolean).join(" e ").replace(/^./, (c) => c.toUpperCase()) + ".",
    fundamento: "Transparência ativa; Lei Orgânica",
    providencia: manualOk ? null : "Cadastre o ato que institui o manual e publique-o em Configurações > Portal e manual.",
    link: manualOk ? null : "/config?aba=portal",
  });

  // Portal
  const portalOk = !!e.portal?.ok;
  add({
    id: "PORTAL",
    nivel: portalOk ? "ok" : "bad",
    titulo: "Portal com busca e filtros",
    detalhe: e.portal ? e.portal.detalhe : "A consulta ao portal falhou: o portal está desligado.",
    fundamento: "ADPF 854; CF art. 163-A",
    providencia: portalOk ? null : "Ligue o portal público em Configurações > Portal e manual.",
    link: portalOk ? null : "/config?aba=portal",
  });

  // Autor
  add({
    id: "AUTOR",
    nivel: e.semAutor ? "bad" : "ok",
    titulo: "Autor identificado em todas as emendas",
    detalhe: e.semAutor ? `${e.semAutor} emenda(s) remetida(s) sem autor identificado.` : `Todas as ${e.emendasRemetidas} emenda(s) remetida(s) com autor identificado.`,
    fundamento: "ADPF 854 (identificação do autor)",
    providencia: e.semAutor ? "Corrija o autor das emendas listadas na tramitação." : null,
    link: e.semAutor ? "/tramitacao" : null,
  });

  // Limites
  const faltam = [e.parametros.cota == null && "cota individual", e.parametros.percentualSaude == null && "percentual da saúde", !e.parametros.vereadores && "número de vereadores"].filter(Boolean);
  const regrasFracas = [
    (!e.regraCota.ativa || e.regraCota.modo !== "BLOQUEANTE") && "cota do autor (ix) não está bloqueante",
    (!e.regraLimite.ativa || e.regraLimite.modo !== "BLOQUEANTE") && "limite das demais áreas (xi) não está bloqueante",
  ].filter(Boolean);
  const limitesOk = !faltam.length && !regrasFracas.length && !e.semValidacao;
  add({
    id: "LIMITES",
    nivel: limitesOk ? "ok" : "bad",
    titulo: "Limites parametrizados e conferidos pelo motor",
    detalhe: limitesOk
      ? "Cota, percentual da saúde e número de vereadores definidos; cota e limite bloqueantes; toda emenda remetida tem validação gravada."
      : [
          faltam.length && `Falta definir: ${faltam.join(", ")}.`,
          regrasFracas.length && `Regra: ${regrasFracas.join("; ")}.`,
          e.semValidacao && `${e.semValidacao} emenda(s) remetida(s) sem validação gravada.`,
        ]
          .filter(Boolean)
          .join(" "),
    fundamento: "Lei Orgânica; LDO do exercício",
    providencia: limitesOk ? null : faltam.length ? "Defina os parâmetros do exercício." : regrasFracas.length ? "Volte as regras de cota e limite para bloqueante." : "Revalide as emendas sem validação gravada.",
    link: limitesOk ? null : faltam.length ? "/config?aba=exercicio" : regrasFracas.length ? "/config?aba=validacao" : "/tramitacao",
  });

  return [...itens, ...(e.extras ?? []).map((x) => ({ ...x, principal: false }))];
}
