import { interpretar, ROTULOS_GENERICOS } from "./interpretar";
import type { Candidata, Classificacao, Interpretacao, ObjetoBiblioteca } from "./tipos";

export type ItemCalculo = {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  referencia: string | null;
};

export type ResultadoLinha = "compativel" | "nat" | "area" | "acessorio" | null;

export type LinhaAnalisada = {
  indice: number;
  descricao: string;
  valor: number;
  objeto: Interpretacao | null;
  principal: boolean;
  resultado: ResultadoLinha;
};

export const ROTULO_RESULTADO: Record<Exclude<ResultadoLinha, null>, string> = {
  compativel: "compatível",
  nat: "natureza divergente",
  area: "área divergente",
  acessorio: "acessório",
};

export const bloqueia = (r: ResultadoLinha) => r === "nat" || r === "area";

export const totalItens = (itens: Pick<ItemCalculo, "quantidade" | "valorUnitario">[]) =>
  itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);

// Cada linha da memória de cálculo passa pela mesma interpretação do objeto e
// é confrontada com a classificação da emenda.
export function analisaItens(args: {
  classificacao: Classificacao | null;
  dotacao: Candidata | null;
  itens: ItemCalculo[];
  biblioteca: ObjetoBiblioteca[];
  percentualAcessorio: number;
}) {
  const { classificacao: c, dotacao: d, itens, biblioteca, percentualAcessorio } = args;
  if (!c || c.situacao === "OBICE" || !d) return null;

  const linhas: LinhaAnalisada[] = [];
  let total = 0;
  itens.forEach((it, indice) => {
    const descricao = it.descricao.trim();
    const valor = it.quantidade * it.valorUnitario;
    if (!descricao || valor <= 0) return;
    total += valor;
    linhas.push({ indice, descricao, valor, objeto: interpretar(descricao, biblioteca), principal: false, resultado: null });
  });
  if (!linhas.length) return null;

  const maior = linhas.reduce((a, b) => (b.valor > a.valor ? b : a));
  const limite = (percentualAcessorio / 100) * total;
  const areaEmenda = c.objeto?.area ?? null;

  for (const L of linhas) {
    L.principal = L === maior || L.valor > limite;
    L.resultado = "compativel";
    // Não reconhecido: sem opinião.
    if (!L.objeto || L.objeto.confianca === "inferido") {
      L.resultado = null;
      continue;
    }
    // Natureza e área não são questão de proporção: uma ambulância não deixa de
    // ser despesa de capital por valer pouco numa emenda de custeio, nem de ser
    // despesa de saúde por ser minoritária numa emenda de educação. A
    // tolerância do acessório vale só para o item já compatível.
    const naturezaLinha = L.objeto.natureza === "CAPITAL" ? "4" : "3";
    if (naturezaLinha !== d.gnd) L.resultado = "nat";
    else if (areaEmenda && L.objeto.area && L.objeto.estrito && L.objeto.area !== areaEmenda) L.resultado = "area";
    else if (!L.principal) L.resultado = "acessorio";
  }

  // Teste inverso: alguma linha entrega o objeto declarado? Não se aplica a
  // objeto genérico — não há termo a encontrar, e cobrar seria inventar achado.
  const obj = c.objeto;
  const entrega =
    !obj ||
    !obj.rotulo ||
    ROTULOS_GENERICOS.includes(obj.rotulo) ||
    obj.confianca === "inferido" ||
    linhas.some((L) => {
      if (!L.objeto) return false;
      // Linha inferida não acusa, mas pode absolver.
      if (L.objeto.confianca !== "inferido" && L.objeto.rotulo === obj.rotulo) return true;
      return L.objeto.elemento === obj.elemento && L.objeto.natureza === obj.natureza;
    });

  return { linhas, total, limite, entrega, gnd: d.gnd, area: areaEmenda, objeto: obj };
}
