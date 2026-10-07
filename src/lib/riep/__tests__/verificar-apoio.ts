import type { DotacaoBase } from "../base";
import type { DotacaoMotor } from "../tipos";
import type { ContextoVerificacao } from "../verificacoes";
import { config } from "./dados-reais";

// Dotação do motor → dotação da base (como o contexto a monta do banco).
export function paraBase(d: DotacaoMotor, extra: Partial<DotacaoBase> = {}): DotacaoBase {
  return {
    ...d,
    orgao: d.uo.split(".")[0],
    acaoCodigo: d.codigo.split(/[./]/)[0],
    acaoPrograma: d.prog,
    natureza: `${Number(d.gnd) >= 4 ? "4" : "3"}.${d.gnd}.${d.mod}.${d.elem}`,
    constaNoPPA: true,
    completa: true,
    ...extra,
  };
}

export function contexto(extra: Partial<ContextoVerificacao> = {}, base: DotacaoBase[] = []): ContextoVerificacao {
  return {
    config,
    aplicado: { saude: 0, demais: 0 },
    emendamento: { aberto: true, motivo: null, explicacao: "Emendas abertas." },
    reenvio: false,
    base: new Map(base.map((d) => [d.id, d])),
    ppaCadastrado: true,
    ldo: { cadastrada: true, programas: new Set(base.map((d) => d.prog)), acoes: new Set() },
    regras: {},
    ...extra,
  };
}
