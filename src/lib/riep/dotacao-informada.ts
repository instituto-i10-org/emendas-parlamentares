// Dotação informada à mão pelo vereador (pedido do Dr. Emerson).
//
// O vereador digita a classificação; "Conferir na LOA" procura a combinação
// entre as dotações que recebem emenda. Achada, a emenda segue com ela, como
// se o motor a tivesse escolhido. Não achada, a classificação informada vale
// sob a responsabilidade declarada do vereador: as verificações que dependem
// da LOA passam a alerta ("não conferível"), nunca a conforme.

import type { DotacaoBase } from "./base";
import type { Candidata, Classificacao, DestinoMotor, Execucao, Interpretacao } from "./tipos";

export type DotacaoInformada = {
  // Unidade orçamentária ("02.01").
  unidade: string;
  // função.subfunção.programa.ação ("10.301.0010.2001").
  funcional: string;
  // Natureza da despesa ("3.3.90.30").
  natureza: string;
  // Fonte de recurso ("01.1100000").
  fonte: string;
  // Opcional; quando informada, desempata.
  ficha: string;
};

export const DOTACAO_INFORMADA_VAZIA: DotacaoInformada = { unidade: "", funcional: "", natureza: "", fonte: "", ficha: "" };

// Id da dotação que não está na LOA: nunca vai para o banco como dotacaoId.
export const ID_INFORMADA = "informada";

const digitos = (s: string) => s.replace(/\D/g, "");
const partes = (s: string) => s.split(/[^\dA-Za-z]+/).filter(Boolean);

export type CamposInformados = { funcao: string; subf: string; prog: string; acao: string; gnd: string; mod: string; elem: string };

// Lê os campos; devolve o que falta, em linguagem do vereador.
export function lerDotacaoInformada(inf: DotacaoInformada): { campos: CamposInformados | null; faltas: string[] } {
  const faltas: string[] = [];
  const f = partes(inf.funcional);
  const n = partes(inf.natureza);
  if (!digitos(inf.unidade)) faltas.push("unidade orçamentária");
  if (f.length !== 4) faltas.push("funcional no formato função.subfunção.programa.ação");
  if (n.length < 4) faltas.push("natureza no formato categoria.grupo.modalidade.elemento");
  if (!digitos(inf.fonte)) faltas.push("fonte de recurso");
  if (faltas.length) return { campos: null, faltas };
  return { campos: { funcao: f[0], subf: f[1], prog: f[2], acao: f[3], gnd: n[1], mod: n[2], elem: n[3] }, faltas };
}

// A combinação na LOA do exercício (só entre as dotações que recebem emenda).
export function procurarNaLoa(inf: DotacaoInformada, loa: DotacaoBase[]): DotacaoBase | null {
  const { campos: c } = lerDotacaoInformada(inf);
  if (!c) return null;
  const igual = (a: string, b: string) => digitos(a) === digitos(b) && digitos(a) !== "";
  const achadas = loa.filter(
    (d) =>
      igual(d.uo, inf.unidade) &&
      igual(d.funcao, c.funcao) &&
      igual(d.subf, c.subf) &&
      igual(d.prog, c.prog) &&
      igual(d.acaoCodigo, c.acao) &&
      igual(d.natureza, inf.natureza) &&
      igual(d.fonte, inf.fonte)
  );
  if (digitos(inf.ficha)) return achadas.find((d) => igual(d.ficha ?? "", inf.ficha)) ?? null;
  return achadas[0] ?? null;
}

// A classificação com a dotação informada no lugar da escolha do motor. Do
// motor fica só a leitura do objeto (para a compatibilidade dos itens).
export function classificacaoInformada(args: {
  inf: DotacaoInformada;
  achada: DotacaoBase | null;
  motor: Classificacao | null;
  destino: DestinoMotor;
  execucao: Execucao;
}): { classificacao: Classificacao; candidata: Candidata } | null {
  const { inf, achada, motor, destino, execucao } = args;
  const { campos: c } = lerDotacaoInformada(inf);
  if (!c) return null;
  const candidata: Candidata = achada
    ? { ...achada, pontos: 0, sobreposicao: 0, aderente: true, abaixoDoPretendido: false }
    : {
        id: ID_INFORMADA,
        codigo: `${c.acao}.${c.elem}`,
        ficha: digitos(inf.ficha) ? inf.ficha.trim() : null,
        nome: "Dotação informada pelo vereador",
        uo: inf.unidade.trim(),
        funcao: c.funcao,
        subf: c.subf,
        subfn: "",
        prog: c.prog,
        progn: "",
        tipo: c.acao.startsWith("1") ? "P" : "A",
        gnd: c.gnd,
        mod: c.mod,
        elem: c.elem,
        fonte: inf.fonte.trim(),
        fonten: "",
        autorizado: 0,
        pontos: 0,
        sobreposicao: 0,
        aderente: false,
        abaixoDoPretendido: false,
      };
  const objeto: Interpretacao | null = motor?.objeto ?? null;
  const classificacao: Classificacao = {
    situacao: "OK",
    objeto,
    gnd: candidata.gnd,
    mod: candidata.mod,
    base: `${candidata.gnd === "4" ? "4.4" : "3.3"}.${candidata.mod}`,
    execucao,
    destino,
    candidatas: [candidata],
    naoReconhecido: false,
    semAderencia: false,
    uoAlvo: candidata.uo,
    unidadesAlvo: [candidata.uo],
    unidadeDaObra: null,
    uoArea: null,
    uoAreaNome: null,
    estrito: false,
    subfuncao: candidata.subf,
    subfuncaoRestringiu: false,
    elementoRestringiu: false,
    selecionada: candidata,
    porQue: achada ? "Dotação informada pelo vereador e encontrada na LOA." : "Dotação informada pelo vereador, não encontrada na LOA.",
    opcoes: [],
    motivo: null,
    proximas: [],
  };
  return { classificacao, candidata };
}
