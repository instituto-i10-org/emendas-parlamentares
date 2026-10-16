// As treze verificações a partir do estado da tela e do contexto do exercício.
// Puro: o editor roda no navegador, a remessa refaz no servidor, com as mesmas
// funções.

import type { SituacaoEmendamento } from "./emendamento";
import type { DadosVerificacao } from "./contexto";
import { conferenciasLocais, verificar, type Aplicado, type Checagem, type ConfigMotor, type ContextoVerificacao, type DotacaoBase, type DotacaoMotor, type ParteCota } from "@/lib/riep";

export function contextoVerificacao(
  ctx: { config: ConfigMotor; emendamento: SituacaoEmendamento; loa: DotacaoBase[]; verificacao: DadosVerificacao },
  aplicado: Aplicado,
  reenvio: boolean,
  partes?: ParteCota[]
): ContextoVerificacao {
  return {
    config: ctx.config,
    aplicado,
    partes,
    emendamento: ctx.emendamento,
    reenvio,
    base: new Map(ctx.loa.map((d) => [d.id, d])),
    ppaCadastrado: ctx.verificacao.ppaCadastrado,
    ldo: {
      cadastrada: ctx.verificacao.ldo.cadastrada,
      programas: new Set(ctx.verificacao.ldo.programas),
      acoes: new Set(ctx.verificacao.ldo.acoes),
    },
    regras: ctx.verificacao.regras,
  };
}

// A dotação da emenda como a base a conhece; fora da base, só o que se sabe
// dela (a (iv) acusa).
export function destinoNaBase(dotacao: DotacaoMotor | null, base: Map<string, DotacaoBase>): DotacaoBase | null {
  if (!dotacao) return null;
  return base.get(dotacao.id) ?? { ...dotacao, orgao: "", acaoCodigo: "", acaoPrograma: "", natureza: "", constaNoPPA: false, completa: false };
}

export function verificarEmenda(
  e: { objeto: string; justificativa: string },
  valor: number,
  dotacao: DotacaoMotor | null,
  ctx: ContextoVerificacao,
  complementares: Checagem[],
  informadaForaDaLoa = false
) {
  return verificar({ objeto: e.objeto, justificativa: e.justificativa, valor, destino: destinoNaBase(dotacao, ctx.base), informadaForaDaLoa }, ctx, complementares);
}

// Regras locais do município (valor mínimo, quantidade, vedações), somadas às
// conferências complementares. Desligadas, não acrescentam nada.
export function conferirRegrasLocais(e: { execucao: string; declaracao: boolean }, valor: number, dotacao: DotacaoMotor | null, aplicado: Aplicado, ctx: ContextoVerificacao): Checagem[] {
  return conferenciasLocais({ valor, destino: dotacao, entidade: e.execucao === "INDIRETA", quantidade: aplicado.quantidade ?? null, declaracao: e.declaracao }, ctx.regras);
}

// Declaração de vínculo ampliada (conflito de interesses) para entidade, quando
// o município liga a regra local.
export const declaracaoConflitoAtiva = (regras: ContextoVerificacao["regras"], execucao: string) => !!regras.DECLARACAO_CONFLITO?.ativa && execucao === "INDIRETA";
