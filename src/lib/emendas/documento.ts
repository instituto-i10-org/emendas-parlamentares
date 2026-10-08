// Documento da emenda, no padrão da Pasta Digital da Câmara: capa do processo,
// a emenda (artigos 1º a 3º, no modelo usado pela Câmara) e o plano de
// trabalho como anexo. Puro: monta o conteúdo a partir dos dados gravados; a
// página de impressão só o desenha.

import { reaisPorExtenso, dataPorExtenso } from "@/lib/extenso";

export type Codigo = { codigo: string; nome: string | null };

export type DotacaoDocumento = {
  orgao: Codigo;
  unidade: Codigo;
  funcao: string;
  subfuncao: string;
  programa: string;
  acao: Codigo;
  natureza: Codigo;
  fonte: string;
  ficha: string | null;
};

export type EntradaDocumento = {
  ano: number;
  numero: number | null;
  // Enviada: o documento é o definitivo, com número e data de entrada.
  enviada: boolean;
  submetidaEm: Date | null;
  hoje: Date;
  camara: { nome: string | null; endereco: string | null; rodape: string | null };
  nomePrefeitura: string | null;
  projeto: { numero: string; ementa: string } | null;
  fundamento: string | null;
  autor: { nome: string; partido: string | null; cargo: string };
  objeto: string;
  execucao: "DIRETA" | "INDIRETA";
  agenteExecutor: string;
  destino: { nome: string; cnpj: string | null; endereco: string } | null;
  valor: number;
  parcela: "SAUDE" | "DEMAIS" | null;
  dotacao: DotacaoDocumento | null;
  // Classificação digitada pelo vereador e não encontrada na LOA.
  informada: { unidade: string; funcional: string; natureza: string; fonte: string; ficha: string } | null;
  fichaReserva: string | null;
  reserva: DotacaoDocumento | null;
};

export type Linha = { rotulo: string; valor: string[]; pendente?: boolean };

export type DocumentoEmenda = {
  minuta: boolean;
  // "EI 12/2027"; na minuta, "EI —/2027".
  identificador: string;
  numeroTexto: string;
  camara: { nome: string; endereco: string | null; rodape: string | null };
  capa: { protocolo: string; tipo: string; numero: string; autor: string; ementa: string; data: string; horario: string };
  titulo: string;
  subtitulo: string;
  cabecalho: Linha[];
  art1: { caput: string; adequacao: string; classificacoes: Linha[] };
  art2: { caput: string; dotacao: Linha[] };
  art3: string;
  localData: string;
  assinatura: { nome: string; cargo: string };
};

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PENDENTE = (t: string): Linha["valor"] => [t];

// "PL 264/2026" → "264/2026".
const numeroProjeto = (n: string) => n.replace(/^\s*(PL|P\.L\.|Projeto de Lei)\s*(n[º°o.]*)?\s*/i, "").trim();

// Linhas da classificação, no formato do quadro de detalhamento da despesa.
export function linhasDotacao(d: DotacaoDocumento): string[] {
  const nome = (c: Codigo) => (c.nome && !/^a classificar$/i.test(c.nome.trim()) ? ` ${c.nome}` : "");
  return [
    `${d.orgao.codigo}${nome(d.orgao)}`,
    `${d.unidade.codigo}${nome(d.unidade)}`,
    `${d.funcao}.${d.subfuncao}.${d.programa}.${d.acao.codigo}${nome(d.acao)}`,
    `${d.natureza.codigo}${nome(d.natureza)}`,
    `Fonte ${d.fonte}`,
    ...(d.ficha ? [`Ficha ${d.ficha}`] : []),
  ];
}

const comCargo = (cargo: string, nome: string) => (nome.toLocaleLowerCase("pt-BR").startsWith(cargo.toLocaleLowerCase("pt-BR")) ? nome : `${cargo} ${nome}`);

export function montarDocumento(e: EntradaDocumento): DocumentoEmenda {
  const minuta = !e.enviada || e.numero === null;
  const numeroTexto = minuta ? `—/${e.ano}` : `${e.numero}/${e.ano}`;
  const pl = e.projeto ? numeroProjeto(e.projeto.numero) : null;
  const autorNome = e.autor.nome + (e.autor.partido ? ` (${e.autor.partido})` : "");
  const quando = !minuta && e.submetidaEm ? e.submetidaEm : null;
  const fuso = { timeZone: "America/Sao_Paulo" } as const;

  const valor = e.valor > 0 ? [`${BRL(e.valor)} (${reaisPorExtenso(e.valor)})`] : null;
  const indireta = e.execucao === "INDIRETA";
  const d = e.dotacao;

  const classificacao: Linha = e.informada
    ? {
        rotulo: "Indicação do órgão e classificações orçamentárias",
        valor: [
          ...(e.nomePrefeitura ? [`Órgão: ${e.nomePrefeitura}`] : []),
          `Unidade ${e.informada.unidade}`,
          e.informada.funcional,
          e.informada.natureza,
          `Fonte ${e.informada.fonte}`,
          ...(e.informada.ficha ? [`Ficha ${e.informada.ficha}`] : []),
          "(classificação informada pelo vereador, não localizada no projeto de lei)",
        ],
      }
    : d
      ? { rotulo: "Indicação do órgão e classificações orçamentárias", valor: [...(e.nomePrefeitura ? [`Órgão: ${e.nomePrefeitura}`] : []), ...linhasDotacao(d)] }
      : { rotulo: "Indicação do órgão e classificações orçamentárias", valor: PENDENTE("Dotação ainda não definida."), pendente: true };

  const unidadeExecutora = indireta
    ? d
      ? `${d.unidade.nome ?? d.unidade.codigo} (órgão repassador)`
      : null
    : e.agenteExecutor.trim() || (d ? (d.unidade.nome ?? d.unidade.codigo) : null);

  const beneficiario: Linha = indireta
    ? e.destino
      ? {
          rotulo: "Identificação do beneficiário",
          valor: [`Denominação: ${e.destino.nome}`, `Inscrição no CNPJ: ${e.destino.cnpj || "não informada"}`, `Endereço: ${e.destino.endereco || "não informado"}`],
        }
      : { rotulo: "Identificação do beneficiário", valor: PENDENTE("Entidade ainda não escolhida."), pendente: true }
    : { rotulo: "Identificação do beneficiário", valor: ["Não se aplica (execução direta pelo Município)."] };

  const reserva: Linha = e.reserva
    ? { rotulo: "Dotação", valor: linhasDotacao(e.reserva) }
    : {
        rotulo: "Dotação",
        valor: PENDENTE(
          e.fichaReserva
            ? `Ficha ${e.fichaReserva} não encontrada no projeto de lei do exercício (Configurações › Exercício e parâmetros).`
            : "Dotação de reserva não configurada (Configurações › Exercício e parâmetros)."
        ),
        pendente: true,
      };

  return {
    minuta,
    identificador: `EI ${numeroTexto}`,
    numeroTexto,
    camara: { nome: e.camara.nome || "Câmara Municipal", endereco: e.camara.endereco, rodape: e.camara.rodape },
    capa: {
      protocolo: minuta ? "—" : "Atribuído pela Secretaria da Câmara",
      tipo: "EMENDA IMPOSITIVA",
      numero: numeroTexto,
      autor: autorNome,
      ementa: `Emenda Impositiva nº ${minuta ? "—" : e.numero} ao ${pl ? `Projeto de Lei nº ${pl}` : "projeto de lei orçamentária"}.`,
      data: quando ? quando.toLocaleDateString("pt-BR", fuso) : "—",
      horario: quando ? quando.toLocaleTimeString("pt-BR", { ...fuso, hour: "2-digit", minute: "2-digit" }) : "—",
    },
    titulo: `EMENDA Nº ${numeroTexto}`,
    subtitulo: `Emenda ao Quadro de Detalhamento da Despesa da Lei Orçamentária Anual do exercício de ${e.ano}.`,
    cabecalho: [
      // O nome pode já trazer o cargo ("Vereador Fulano"): não repete.
      { rotulo: "Autor", valor: [`${comCargo(e.autor.cargo, autorNome)}.`] },
      { rotulo: "Tipo de Emenda", valor: ["Parlamentar Individual Impositiva."] },
      e.fundamento?.trim()
        ? { rotulo: "Fundamento legal", valor: e.fundamento.split("\n").map((l) => l.trim()).filter(Boolean) }
        : { rotulo: "Fundamento legal", valor: PENDENTE("Não configurado (Configurações › Exercício e parâmetros)."), pendente: true },
      e.projeto
        ? { rotulo: "Projeto de Lei Original", valor: [`Projeto de Lei nº ${pl} – ${e.projeto.ementa.trim().replace(/\.?$/, ".")}`] }
        : { rotulo: "Projeto de Lei Original", valor: PENDENTE("Projeto de lei do exercício não cadastrado."), pendente: true },
    ],
    art1: {
      caput: `Fica alterado o Quadro de Detalhamento da Despesa da Lei Orçamentária Anual do exercício de ${e.ano}, na seguinte conformidade:`,
      adequacao: `O autor, utilizando-se das prerrogativas legais previstas na Lei Orgânica do Município e no Regimento Interno da Câmara Municipal, vem por meio da presente emenda orçamentária de caráter impositivo apresentar as seguintes adequações ao Projeto de Lei da LOA ${e.ano}:`,
      classificacoes: [
        e.objeto.trim() ? { rotulo: "Objeto", valor: [e.objeto.trim()] } : { rotulo: "Objeto", valor: PENDENTE("Objeto não informado."), pendente: true },
        classificacao,
        unidadeExecutora
          ? { rotulo: "Identificação da unidade responsável pela execução", valor: [unidadeExecutora] }
          : { rotulo: "Identificação da unidade responsável pela execução", valor: PENDENTE("A definir com a dotação."), pendente: true },
        beneficiario,
        valor ? { rotulo: "Valor", valor } : { rotulo: "Valor", valor: PENDENTE("Valor não informado."), pendente: true },
        e.parcela
          ? { rotulo: "Destinação dos recursos", valor: [e.parcela === "SAUDE" ? "Ações e serviços públicos de saúde." : "Demais áreas."] }
          : { rotulo: "Destinação dos recursos", valor: PENDENTE("A definir com a dotação."), pendente: true },
      ],
    },
    art2: {
      caput: "Para cumprimento do disposto no artigo anterior fica parcialmente anulada a seguinte dotação orçamentária:",
      dotacao: [reserva, valor ? { rotulo: "Valor", valor: [BRL(e.valor)] } : { rotulo: "Valor", valor: PENDENTE("Valor não informado."), pendente: true }],
    },
    art3: `A presente emenda produz reflexos nos quadros do Plano Plurianual e da Lei de Diretrizes Orçamentárias do exercício de ${e.ano}.`,
    localData: `${e.camara.nome || "Câmara Municipal"}, ${dataPorExtenso(quando ?? e.hoje)}.`,
    assinatura: { nome: e.autor.nome.toLocaleUpperCase("pt-BR"), cargo: e.autor.cargo.toLocaleUpperCase("pt-BR") },
  };
}
