import { padEsquerda } from "./texto";
import type { Aplicado, ConfigMotor, DotacaoMotor, Parcela } from "./tipos";

// IC-CO — Anexo II da Portaria STN 710/2021. É este marcador, e não a área
// declarada, que decide a parcela da cota consumida.
const SUBFUNCOES_ASPS = ["301", "302", "303", "304", "305", "306"];

export function derivaIcCo(d: Pick<DotacaoMotor, "funcao" | "subf"> | null) {
  if (!d) return null;
  if (d.funcao === "10" && SUBFUNCOES_ASPS.includes(d.subf)) {
    return { codigo: "1002", nome: "Ações e serviços públicos de saúde" };
  }
  if (d.funcao === "12") {
    return { codigo: "1001", nome: "Manutenção e desenvolvimento do ensino (art. 70 da LDB)" };
  }
  return null;
}

// A parcela é consequência do enquadramento: não há campo nem escolha.
export function parcelaDaDotacao(d: Pick<DotacaoMotor, "funcao" | "subf"> | null): Parcela | null {
  if (!d) return null;
  return derivaIcCo(d)?.codigo === "1002" ? "SAUDE" : "DEMAIS";
}

export const nomeParcela = (p: Parcela | null) => (p === "SAUDE" ? "saúde" : p === "DEMAIS" ? "demais áreas" : null);

export function parcelaSaude(cfg: ConfigMotor): number | null {
  return cfg.cotaIndividual === null ? null : (cfg.cotaIndividual * cfg.percentualSaude) / 100;
}

export function parcelaDemais(cfg: ConfigMotor): number | null {
  const s = parcelaSaude(cfg);
  return cfg.cotaIndividual === null || s === null ? null : cfg.cotaIndividual - s;
}

export function totalParcela(cfg: ConfigMotor, p: Parcela): number | null {
  return p === "SAUDE" ? parcelaSaude(cfg) : parcelaDemais(cfg);
}

// Saldo da parcela que esta emenda consome.
export function restanteParcela(cfg: ConfigMotor, aplicado: Aplicado, p: Parcela | null): number | null {
  if (cfg.cotaIndividual === null || !p) return null;
  const total = totalParcela(cfg, p)!;
  return total - (p === "SAUDE" ? aplicado.saude : aplicado.demais);
}

// --- camada C — identificadores AUDESP --------------------------------------

// Nenhum código fixo: tudo vem da parametrização do exercício, porque as
// tabelas do AUDESP são revistas a cada ano.
export function audesp(cfg: ConfigMotor) {
  if (!cfg.fonteAudesp || !cfg.codigoAplicacao) return null;
  return {
    fonte: cfg.fonteAudesp,
    nome: cfg.fonteAudespNome ?? "",
    aplicacao: cfg.codigoAplicacao,
    aplicacaoExibicao: padEsquerda(cfg.codigoAplicacao, 4),
  };
}

// IC-EP — vigência a partir do exercício de 2027 (art. 2º da Portaria STN/MF 636/2026).
export function derivaIcEp(cfg: ConfigMotor) {
  return cfg.icEpVigente && cfg.icEpCodigo ? { codigo: cfg.icEpCodigo, nome: "Emendas individuais" } : null;
}

// Variação: o número da emenda no exercício, no layout de N dígitos.
export function variacaoEmenda(cfg: ConfigMotor, numero: number | null): string | null {
  return numero === null ? null : padEsquerda(numero, cfg.formatoVariacao);
}
