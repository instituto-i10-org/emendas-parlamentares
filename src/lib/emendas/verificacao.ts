// As treze verificações a partir do estado da tela e do contexto do exercício.
// Puro: o editor roda no navegador, a remessa refaz no servidor, com as mesmas
// funções.

import type { SituacaoEmendamento } from "./emendamento";
import type { DadosVerificacao } from "./contexto";
import { verificar, type Aplicado, type Checagem, type ConfigMotor, type ContextoVerificacao, type DotacaoBase, type DotacaoMotor } from "@/lib/riep";

export function contextoVerificacao(
  ctx: { config: ConfigMotor; emendamento: SituacaoEmendamento; loa: DotacaoBase[]; verificacao: DadosVerificacao },
  aplicado: Aplicado,
  reenvio: boolean
): ContextoVerificacao {
  return {
    config: ctx.config,
    aplicado,
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
  complementares: Checagem[]
) {
  return verificar({ objeto: e.objeto, justificativa: e.justificativa, valor, destino: destinoNaBase(dotacao, ctx.base) }, ctx, complementares);
}
