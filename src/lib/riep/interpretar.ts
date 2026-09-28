import { contem, norm } from "./texto";
import type { Interpretacao, ObjetoBiblioteca } from "./tipos";

// Verbos que decidem quando não há termo na biblioteca — e que, havendo, podem
// prevalecer sobre ele.
export const VERBOS_OBRA = [
  "reforma", "construcao", "construir", "ampliacao", "ampliar", "revitalizacao", "pavimentar", "recuperacao",
];
export const VERBOS_BEM = ["aquisicao", "aquisicao de", "compra", "comprar", "adquirir", "aquisi"];
// Marcadores inequívocos de custeio: prevalecem sobre termo de capital quando
// não há verbo de aquisição.
export const VERBOS_CUSTEIO = [
  "custeio", "custear", "manutencao", "manter", "conservacao", "locacao", "aluguel", "alugar",
  "contratacao de servicos", "prestacao de servicos", "apoio ao funcionamento", "funcionamento",
];

// Rótulos genéricos: o objeto foi reconhecido só pela natureza.
export const ROTULOS_GENERICOS = ["Custeio", "Custeio ou manutenção", "Aquisição de bem", "Obra ou reforma"];

// Reconhece o que o texto entrega. O termo mais longo da biblioteca define a
// natureza; a subfunção pode vir de outro termo do mesmo texto ("mobiliário
// para a creche": mobiliário define o elemento, creche define a subfunção).
export function interpretar(texto: string, biblioteca: ObjetoBiblioteca[]): Interpretacao | null {
  const t = norm(texto);
  const obra = VERBOS_OBRA.some((v) => contem(t, v));
  const bem = VERBOS_BEM.some((v) => contem(t, v));
  const custeio = VERBOS_CUSTEIO.some((v) => contem(t, v));

  let melhor: { o: ObjetoBiblioteca; termo: string; prioridade: number } | null = null;
  let tamanho = 0;
  const achados: ObjetoBiblioteca[] = [];
  for (const o of biblioteca) {
    for (const k of o.termos) {
      if (!contem(t, k)) continue;
      achados.push(o);
      // O nome do destino contextualiza a entrega, mas não transforma um bem ou
      // serviço reconhecido em obra ("ultrassom para o centro de saúde"). Só um
      // verbo de obra dá prioridade a termo de obra.
      const prioridade = !obra && o.elemento === "51" ? 0 : 1;
      if (!melhor || prioridade > melhor.prioridade || (prioridade === melhor.prioridade && k.length > tamanho)) {
        tamanho = k.length;
        melhor = { o, termo: k, prioridade };
      }
    }
  }

  if (melhor) {
    const { o, termo } = melhor;
    const subfuncao = o.subfuncao ?? (achados.find((a) => a.subfuncao)?.subfuncao ?? null);
    // Construção, reforma e ampliação são marcadores inequívocos de obra.
    if (obra && o.elemento !== "51") {
      return {
        rotulo: "Obra ou reforma",
        divisibilidade: "INDIVISIVEL",
        explicacao: `verbo de obra prevalece sobre “${termo}”`,
        natureza: "CAPITAL",
        elemento: "51",
        area: o.area,
        estrito: o.estrito,
        subfuncao,
        confianca: "exato",
        termo: `${termo} + verbo de obra`,
      };
    }
    // Custeio, manutenção e locação prevalecem sobre termo de capital, salvo
    // se houver verbo de aquisição.
    if (custeio && !bem && !obra && o.natureza === "CAPITAL") {
      return {
        rotulo: "Custeio ou manutenção",
        divisibilidade: "DIVISIVEL",
        explicacao: `marcador de custeio prevalece sobre “${termo}”`,
        natureza: "CUSTEIO",
        elemento: "39",
        area: o.area,
        estrito: o.estrito,
        subfuncao,
        confianca: "exato",
        termo: `${termo} + marcador de custeio`,
      };
    }
    return {
      rotulo: o.rotulo,
      divisibilidade: o.divisibilidade,
      explicacao: o.explicacao,
      natureza: o.natureza,
      elemento: o.elemento,
      area: o.area,
      estrito: o.estrito,
      subfuncao,
      confianca: "exato",
      termo,
    };
  }

  const inferido = (x: Omit<Interpretacao, "area" | "estrito" | "subfuncao" | "confianca">): Interpretacao => ({
    ...x,
    area: null,
    estrito: false,
    subfuncao: null,
    confianca: "inferido",
  });
  if (obra) {
    return inferido({
      rotulo: "Obra ou reforma",
      divisibilidade: "INDIVISIVEL",
      explicacao: "inferido pelo verbo",
      natureza: "CAPITAL",
      elemento: "51",
    });
  }
  if (custeio && !bem) {
    return inferido({
      rotulo: "Custeio ou manutenção",
      divisibilidade: "DIVISIVEL",
      explicacao: "inferido pelo marcador de custeio",
      natureza: "CUSTEIO",
      elemento: "39",
    });
  }
  if (bem) {
    return inferido({
      rotulo: "Aquisição de bem",
      divisibilidade: null,
      explicacao: "inferido pelo verbo",
      natureza: "CAPITAL",
      elemento: "52",
    });
  }
  if (t.length > 8) {
    return inferido({
      rotulo: "Custeio",
      divisibilidade: "DIVISIVEL",
      explicacao: "inferido — nenhum termo da biblioteca",
      natureza: "CUSTEIO",
      elemento: "39",
    });
  }
  return null;
}
