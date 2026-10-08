// A dotação informada à mão no lugar da escolhida pela análise. Puro: o editor
// usa no navegador e a gravação refaz no servidor, com a mesma função.

import { classificacaoInformada, procurarNaLoa, type Classificacao, type DestinoMotor, type DotacaoBase } from "@/lib/riep";
import { informadaConferida, type EstadoEmenda } from "./estado";

export type OrigemInformada = "LOA" | "FORA" | null;

export function aplicarDotacaoInformada(
  e: Pick<EstadoEmenda, "dotacaoInformada" | "execucao">,
  motor: Classificacao | null,
  destino: DestinoMotor | null,
  loa: DotacaoBase[]
): { classificacao: Classificacao | null; informada: OrigemInformada; achada: DotacaoBase | null } {
  const inf = e.dotacaoInformada;
  if (!destino || !inf || !informadaConferida(inf)) return { classificacao: motor, informada: null, achada: null };
  const achada = procurarNaLoa(inf, loa);
  const r = classificacaoInformada({ inf, achada, motor, destino, execucao: e.execucao });
  if (!r) return { classificacao: motor, informada: null, achada: null };
  return { classificacao: r.classificacao, informada: achada ? "LOA" : "FORA", achada };
}

export type InformadaGravada = {
  unidade: string;
  funcional: string;
  natureza: string;
  fonte: string;
  ficha: string;
  naLoa: boolean;
  porNome: string;
  em: string | null;
};

// O que a gravação guardou em Emenda.dotacaoInformada.
export function informadaGravada(j: unknown): InformadaGravada | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const t = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  return { unidade: t("unidade"), funcional: t("funcional"), natureza: t("natureza"), fonte: t("fonte"), ficha: t("ficha"), naLoa: o.naLoa === true, porNome: t("porNome"), em: t("em") || null };
}

export const textoInformada = (g: InformadaGravada) =>
  `${g.unidade} · ${g.funcional} · ${g.natureza} · fonte ${g.fonte}${g.ficha ? ` · ficha ${g.ficha}` : ""}`;
