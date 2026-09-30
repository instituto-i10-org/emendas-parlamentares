import { interpretar, ROTULOS_GENERICOS } from "./interpretar";
import type { Candidata, Classificacao, Interpretacao, ObjetoBiblioteca } from "./tipos";

export type ItemCalculo = {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  referencia: string | null;
};

export type ResultadoLinha = "compativel" | "nat" | "elem" | "area" | "acessorio" | null;

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
  elem: "elemento divergente",
  area: "área divergente",
  acessorio: "acessório",
};

export const bloqueia = (r: ResultadoLinha) => r === "nat" || r === "elem" || r === "area";

export const totalItens = (itens: Pick<ItemCalculo, "quantidade" | "valorUnitario">[]) =>
  itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);

// Para entidade (3.3.50 / 4.4.50) o elemento é 41, 42 ou 43 e vem do
// instrumento, não do item: o elemento do item não se compara com o da dotação.
const comparaElemento = (d: Candidata) => d.mod !== "50";

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
    linhas.push({ indice, descricao, valor, objeto: interpretar(descricao, biblioteca, c.objeto?.area ?? null), principal: false, resultado: null });
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
    // Natureza, elemento e área não são questão de proporção: uma ambulância
    // não deixa de ser despesa de capital por valer pouco numa emenda de
    // custeio; material de consumo (30) não vira serviço (39) por estar numa
    // dotação de serviços; nem deixa de ser despesa de saúde por ser
    // minoritário numa emenda de educação. A tolerância do acessório vale só
    // para o item já compatível.
    const naturezaLinha = L.objeto.natureza === "CAPITAL" ? "4" : "3";
    if (naturezaLinha !== d.gnd) L.resultado = "nat";
    else if (comparaElemento(d) && L.objeto.elemento !== d.elem) L.resultado = "elem";
    else if (areaEmenda && L.objeto.area && L.objeto.estrito && L.objeto.area !== areaEmenda) L.resultado = "area";
    else if (!L.principal) L.resultado = "acessorio";
  }

  // Teste inverso: alguma linha entrega o objeto declarado? Objeto genérico
  // (só a natureza) é conferido pela natureza e, quando certo, pelo elemento:
  // não há termo a encontrar, mas há o que contradizer.
  const obj = c.objeto;
  const generico = !obj || !obj.rotulo || ROTULOS_GENERICOS.includes(obj.rotulo) || obj.confianca === "inferido";
  const entrega =
    !obj ||
    linhas.some((L) => {
      if (!L.objeto) return false;
      if (generico) {
        // Linha inferida não acusa, mas pode absolver.
        if (L.objeto.confianca === "inferido") return true;
        return L.objeto.natureza === obj.natureza && (obj.elementoIncerto || L.objeto.elemento === obj.elemento);
      }
      // Linha reconhecida só entrega o objeto se é o mesmo objeto: "material
      // de consumo" não entrega "medicamentos" por ser do mesmo elemento.
      // Linha inferida não acusa, mas pode absolver.
      if (L.objeto.confianca === "inferido") return L.objeto.natureza === obj.natureza;
      return L.objeto.rotulo === obj.rotulo;
    });

  return { linhas, total, limite, entrega, gnd: d.gnd, area: areaEmenda, objeto: obj };
}
