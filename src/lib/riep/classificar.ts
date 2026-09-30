import { pistasDoDestino } from "./destino";
import { interpretar } from "./interpretar";
import { contem, norm } from "./texto";
import type {
  AreaAplicacao,
  Candidata,
  Catalogo,
  Classificacao,
  DestinoMotor,
  DotacaoMotor,
  Execucao,
  Selecao,
} from "./tipos";

// Palavras genéricas: aparecem em quase toda denominação de ação e não provam
// aderência entre o objeto e a ação.
const TOKENS_FRACOS = new Set([
  "manutencao", "aquisicao", "custeio", "compra", "apoio", "servico", "servicos", "material", "materiais",
  "equipamento", "equipamentos", "municipal", "municipais", "publico", "publica", "programa", "projeto",
  "atividade", "implantacao", "modernizacao", "revitalizacao", "adequacao", "melhoria", "para", "com", "dos",
  "das", "nos", "nas", "geral", "gerais", "diversos", "outros", "teste", "consumo",
]);

// Ações de pessoal e de benefícios a servidores: uma emenda individual de
// custeio ou investimento não as financia, por mais que tenham dotação de
// material ou de serviços. Nunca são a primeira opção e nunca contam como
// aderentes ao objeto.
export const ACOES_DE_PESSOAL = [
  "beneficio ao trabalhador", "beneficios ao trabalhador", "vale alimentacao", "vale transporte", "auxilio alimentacao",
  "folha de pagamento", "encargos sociais", "encargos gerais", "pessoal e encargos", "precatorio", "precatorios",
  "sentencas judiciais", "divida", "amortizacao",
];

export const acaoDePessoal = (nomeNormalizado: string) => ACOES_DE_PESSOAL.some((p) => contem(nomeNormalizado, p));

function area(areas: AreaAplicacao[], nome: string | null) {
  return nome ? areas.find((a) => a.nome === nome) ?? null : null;
}

// A unidade pertence a um dos órgãos da área?
export function naArea(uo: string | null | undefined, nomeArea: string | null, areas: AreaAplicacao[]): boolean {
  const a = area(areas, nomeArea);
  return !!a && a.orgaos.includes(String(uo ?? "").split(".")[0]);
}

// Área a que a unidade do destino pertence (Saúde para 13.xx e 20.xx).
export function areaDaUnidade(uo: string | null | undefined, areas: AreaAplicacao[]): string | null {
  const org = String(uo ?? "").split(".")[0];
  if (!org) return null;
  return areas.find((a) => a.orgaos.includes(org))?.nome ?? null;
}

export type EntradaClassificacao = {
  objeto: string;
  destino: DestinoMotor;
  execucao: Execucao;
  pretendido: number;
  loa: DotacaoMotor[];
  catalogo: Catalogo;
};

// Encontra a dotação da LOA que comporta o objeto no destino. Nunca inventa:
// sem prova de vínculo entre objeto e ação, devolve as opções e o motivo.
export function classificar({ objeto, destino, execucao, pretendido, loa, catalogo }: EntradaClassificacao): Classificacao {
  // Entidade do terceiro setor não tem vínculo fixo: a secretaria vem do objeto.
  const uoAlvo = destino.uo || null;
  // A área do destino desempata termos de áreas diferentes no mesmo texto.
  const areaDestino = areaDaUnidade(uoAlvo, catalogo.areas);
  const obj = interpretar(objeto, catalogo.objetos, areaDestino);
  const vazio = {
    candidatas: [],
    naoReconhecido: false,
    semAderencia: false,
    uoAlvo: null,
    uoArea: null,
    uoAreaNome: null,
    estrito: false,
    subfuncao: null,
    subfuncaoRestringiu: false,
    elementoRestringiu: false,
    selecionada: null,
    porQue: null,
    opcoes: [],
    motivo: null,
    proximas: [],
  };
  if (!obj) {
    return { ...vazio, situacao: "INDETERMINADO", objeto: null, gnd: "", mod: "", base: "", execucao, destino };
  }

  const gnd = obj.natureza === "CAPITAL" ? "4" : "3";
  const mod = execucao === "INDIRETA" ? "50" : "90";
  const base = `${gnd === "4" ? "4.4" : "3.3"}.${mod}`;
  const uoArea = area(catalogo.areas, obj.area)?.unidadePadrao ?? null;
  // Objeto que só cabe na sua própria área.
  const estrito = !!(obj.estrito && uoArea);
  const nomeArea = (uo: string | null) => (uo ? catalogo.unidades[uo] : null) ?? obj.area;
  // A subfunção vem do objeto ("creche" → 365); sem ela, do tipo de destino
  // ("EMEI Aida Rocha" → 365). EMEB atende os dois níveis e não sugere nenhuma.
  const subfuncao = obj.subfuncao ?? destino.subfuncao ?? obj.subfuncaoSecundaria ?? null;
  // Pistas de aderência: do objeto ("saude mental" para material terapêutico)
  // e do tipo de destino ("CAPS" → "saude mental", "UBS" → "atencao basica").
  const pistas = [...(obj.pistas ?? []), ...pistasDoDestino(destino.nome, null, catalogo.tiposDestino)].map(norm);

  // Objeto de área estrita indicado a unidade de outra área: incompatibilidade,
  // não classificação.
  if (estrito && uoAlvo && !naArea(uoAlvo, obj.area, catalogo.areas)) {
    return {
      ...vazio,
      situacao: "CONFLITO",
      objeto: obj,
      gnd,
      mod,
      base,
      execucao,
      destino,
      uoAlvo,
      uoArea,
      uoAreaNome: nomeArea(uoArea),
      estrito,
      subfuncao,
    };
  }

  let cand = loa.filter((d) => d.gnd === gnd && d.mod === mod && (uoAlvo ? d.uo === uoAlvo : true));

  // Sem vínculo fixo, a área do objeto restringe — não apenas pontua.
  if (!uoAlvo && estrito) cand = cand.filter((d) => naArea(d.uo, obj.area, catalogo.areas));

  // Funil: elemento antes de subfunção — obra não vira equipamento por causa
  // da subfunção. Elemento incerto (objeto inferido) não filtra: só pontua.
  let elementoRestringiu = false;
  let subfuncaoRestringiu = false;
  if (!obj.elementoIncerto) {
    const porElemento = cand.filter((d) => d.elem === obj.elemento);
    if (porElemento.length) {
      cand = porElemento;
      elementoRestringiu = true;
    } else if (obj.confianca === "exato" && obj.natureza === "CAPITAL" && mod !== "50") {
      // Em investimento, obra (51) e equipamento (52) não se substituem: sem
      // linha do elemento do objeto, nenhuma dotação comporta — é óbice, não uma
      // ambulância paga pela dotação de reforma do hospital.
      cand = [];
    }
  }
  // Creche é 12.365, não 12.367: a subfunção restringe dentro do que sobrou.
  if (subfuncao) {
    const porSubfuncao = cand.filter((d) => d.subf === subfuncao);
    if (porSubfuncao.length) {
      cand = porSubfuncao;
      subfuncaoRestringiu = true;
    }
  }

  const tokens = norm(objeto)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !TOKENS_FRACOS.has(w));

  const pontuadas: Candidata[] = cand.map((d) => {
    let s = 0;
    if (d.elem === obj.elemento) s += 6;
    // 42 (auxílio) e 43 (subvenção) são os únicos elementos para entidade.
    else if (mod === "50") s += 2;
    const nome = norm(d.nome);
    let sobreposicao = 0;
    for (const w of tokens) {
      if (nome.includes(w)) {
        s += 3;
        sobreposicao++;
      }
    }
    for (const p of pistas) {
      if (p && contem(nome, p)) {
        s += 3;
        sobreposicao++;
      }
    }
    const pessoal = acaoDePessoal(nome);
    if (pessoal) s -= 10;
    // Aderência mínima: o vínculo entre objeto e ação precisa ter alguma prova.
    const aderente =
      !pessoal &&
      (sobreposicao > 0 ||
        (!!subfuncao && d.subf === subfuncao) ||
        (obj.estrito && !!uoArea && naArea(d.uo, obj.area, catalogo.areas) && d.elem === obj.elemento));
    if (obj.natureza === "CAPITAL" && d.tipo === "P") s += 1;
    if (obj.natureza === "CUSTEIO" && d.tipo === "A") s += 1;
    if (!uoAlvo && uoArea && naArea(d.uo, obj.area, catalogo.areas)) s += 5;
    if (subfuncao && d.subf === subfuncao) s += 8;
    return {
      ...d,
      pontos: s,
      sobreposicao,
      aderente,
      // O valor pretendido SINALIZA, nunca elimina: a estimativa pode estar
      // imprecisa e o valor definitivo só nasce da memória de cálculo.
      abaixoDoPretendido: pretendido > 0 && pretendido > d.autorizado,
    };
  });
  // Aderência antes de pontos, pontos antes de valor: a maior dotação da
  // unidade nunca vence só por ser a maior.
  pontuadas.sort(
    (a, b) =>
      Number(b.aderente) - Number(a.aderente) ||
      b.sobreposicao - a.sobreposicao ||
      b.pontos - a.pontos ||
      b.autorizado - a.autorizado
  );

  const naoReconhecido = obj.confianca === "inferido";
  const comum = {
    ...vazio,
    objeto: obj,
    gnd,
    mod,
    base,
    execucao,
    destino,
    candidatas: pontuadas,
    naoReconhecido,
    uoAlvo,
    uoArea,
    uoAreaNome: nomeArea(uoArea),
    estrito,
    subfuncao,
    subfuncaoRestringiu,
    elementoRestringiu,
  };

  if (pontuadas.length === 0) {
    // Primeiro o que resolveria: a mesma natureza e o mesmo elemento em outra
    // unidade (da área do objeto antes das demais); depois as linhas da unidade.
    const mesmoElemento = loa
      .filter((d) => d.uo !== (uoAlvo || uoArea) && d.gnd === gnd && d.mod === mod && d.elem === obj.elemento)
      .sort((a, b) => Number(naArea(b.uo, obj.area, catalogo.areas)) - Number(naArea(a.uo, obj.area, catalogo.areas)));
    const daUnidade = loa.filter((d) => (uoAlvo ? d.uo === uoAlvo : !!uoArea && naArea(d.uo, obj.area, catalogo.areas)));
    const proximas = [...mesmoElemento.slice(0, 3), ...daUnidade].slice(0, 4);
    return { ...comum, situacao: "OBICE", proximas };
  }
  // Só o que tem o elemento do objeto é oferecido como opção. Ações de pessoal
  // e benefícios nunca são opção.
  const doElemento = pontuadas.filter((d) => d.elem === obj.elemento && !acaoDePessoal(norm(d.nome)));
  if (naoReconhecido) {
    // O motor sabe apenas se é custeio ou capital: não pode fingir precisão.
    return {
      ...comum,
      situacao: "VALIDAR",
      opcoes: (doElemento.length ? doElemento : pontuadas.filter((d) => !acaoDePessoal(norm(d.nome)))).slice(0, 6),
      motivo:
        "O objeto descrito não corresponde a nenhum item da biblioteca; o sistema identificou apenas a natureza da despesa.",
    };
  }
  if (!pontuadas[0].aderente) {
    // Nada verificado contra o objeto: só o que tem o elemento certo pode ser
    // escolhido, e nada de ação sem relação como candidata válida.
    return {
      ...comum,
      situacao: "VALIDAR",
      semAderencia: true,
      opcoes: doElemento.slice(0, 6),
      motivo:
        "Nenhuma ação da unidade menciona o objeto nem corresponde à sua subfunção. " +
        "A compatibilidade é apenas de natureza da despesa, o que não basta para enquadrar.",
    };
  }
  const aderentes = pontuadas.filter((d) => d.aderente);
  if (aderentes.length > 1 && aderentes[0].pontos - aderentes[1].pontos <= 1) {
    return {
      ...comum,
      situacao: "VALIDAR",
      opcoes: aderentes.slice(0, 6),
      motivo: "Mais de uma ação tem aderência ao objeto e nenhuma é mais específica que a outra.",
    };
  }
  const sel = pontuadas[0];
  return {
    ...comum,
    situacao: "OK",
    selecionada: sel,
    porQue:
      sel.sobreposicao > 0
        ? "A denominação da ação menciona o objeto"
        : subfuncao && sel.subf === subfuncao
          ? `A ação está na subfunção ${subfuncao}, a que corresponde ao objeto`
          : "Área e elemento de despesa coincidem exatamente com o objeto",
  };
}

// --- a classificação combinada com a decisão do proponente -------------------

// Situação efetiva: a escolha do proponente entre as opções vale como OK.
export function situacaoEfetiva(c: Classificacao | null, s: Selecao): Classificacao["situacao"] | null {
  if (!c) return null;
  if (c.situacao === "VALIDAR" && s.escolha === "PROPONENTE" && escolhida(c, s)) return "OK";
  return c.situacao;
}

function escolhida(c: Classificacao, s: Selecao) {
  return s.dotacaoId ? c.opcoes.find((d) => d.id === s.dotacaoId) ?? null : null;
}

// A dotação que a emenda usa. Com a definição deixada à análise técnica, vale a
// primeira candidata para fins de modelo e parcela — como no protótipo.
export function dotacaoDe(c: Classificacao | null, s: Selecao): Candidata | null {
  if (!c) return null;
  if (c.situacao === "OBICE" || c.situacao === "INDETERMINADO" || c.situacao === "CONFLITO") return null;
  if (c.situacao === "OK") return c.selecionada;
  const e = s.escolha === "PROPONENTE" ? escolhida(c, s) : null;
  if (e) return e;
  return c.opcoes[0] ?? c.candidatas[0] ?? null;
}

// Classificação que permite seguir para o plano de trabalho. ÓBICE, CONFLITO e
// objeto indeterminado param aqui; objeto não reconhecido ou sem aderência
// exige que o proponente escolha ou deixe para a análise técnica.
export function podeAvancar(c: Classificacao | null, s: Selecao): boolean {
  if (!c) return false;
  if (c.situacao !== "OK" && c.situacao !== "VALIDAR") return false;
  if ((c.naoReconhecido || c.semAderencia) && situacaoEfetiva(c, s) !== "OK" && s.escolha !== "ANALISE_TECNICA") {
    return false;
  }
  return true;
}

// Classificação que vale para a etapa 3 (a que o protótipo guarda em ST.cls).
export function classificacaoValida(c: Classificacao | null): Classificacao | null {
  return c && (c.situacao === "OK" || c.situacao === "VALIDAR") ? c : null;
}
