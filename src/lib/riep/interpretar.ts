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
// Custeio sem termo na biblioteca: estas palavras apontam para material de
// consumo (30); sem elas, para serviços (39). É preferência, não certeza.
export const PALAVRAS_MATERIAL = ["material", "materiais", "insumo", "insumos", "genero", "generos", "suprimento", "suprimentos", "kit", "kits"];

// Rótulos genéricos: o objeto foi reconhecido só pela natureza.
export const ROTULOS_GENERICOS = ["Custeio", "Custeio ou manutenção", "Aquisição de bem", "Obra ou reforma"];

type Achado = { o: ObjetoBiblioteca; termo: string; prioridade: number };

// Reconhece o que o texto entrega. O termo mais longo da biblioteca define a
// natureza; a subfunção pode vir de outro termo do mesmo texto ("mobiliário
// para a creche": mobiliário define o elemento, creche define a subfunção).
//
// `areaPreferida` é a área do destino: quando o texto casa termos de mais de
// uma área, os da área do destino vencem. "Material esportivo para o Polo
// Academia da Saúde" é Saúde, não Esporte; "oficina terapêutica do CAPS" é
// Saúde, não Cultura. Sem termo da área do destino, nada muda — ambulância
// para a escola continua sendo Saúde, e conflito.
export function interpretar(texto: string, biblioteca: ObjetoBiblioteca[], areaPreferida: string | null = null): Interpretacao | null {
  const t = norm(texto);
  const obra = VERBOS_OBRA.some((v) => contem(t, v));
  const bem = VERBOS_BEM.some((v) => contem(t, v));
  const custeio = VERBOS_CUSTEIO.some((v) => contem(t, v));

  const achados: Achado[] = [];
  for (const o of biblioteca) {
    for (const k of o.termos) {
      if (!contem(t, k)) continue;
      // O nome do destino contextualiza a entrega, mas não transforma um bem ou
      // serviço reconhecido em obra ("ultrassom para o centro de saúde"). Só um
      // verbo de obra dá prioridade a termo de obra.
      achados.push({ o, termo: k, prioridade: !obra && o.elemento === "51" ? 0 : 1 });
    }
  }

  // Prioridade primeiro (termo de obra sem verbo de obra perde para qualquer
  // outro), depois a área do destino, por fim o termo mais longo.
  const maisLongo = (lista: Achado[]) =>
    lista.reduce<Achado | null>((m, a) => (!m || a.termo.length > m.termo.length ? a : m), null);
  const prioridadeMaxima = achados.reduce((m, a) => Math.max(m, a.prioridade), -1);
  const prioritarios = achados.filter((a) => a.prioridade === prioridadeMaxima);
  const daArea = areaPreferida ? prioritarios.filter((a) => a.o.area === areaPreferida) : [];
  const melhor = maisLongo(daArea.length ? daArea : prioritarios);

  if (melhor) {
    const { o, termo } = melhor;
    const subfuncao = o.subfuncao;
    const subfuncaoSecundaria = o.subfuncao ? null : (achados.find((a) => a.o !== o && a.o.subfuncao)?.o.subfuncao ?? null);
    const pistas = o.pistas ?? [];
    // "Aquisição de equipamentos para a UBS": o único termo reconhecido é o
    // nome do lugar (ubs, escola, emef…), que está na biblioteca como obra. Sem
    // verbo de obra, o verbo de aquisição decide: é compra de bem, de elemento
    // ainda incerto — nunca uma reforma.
    if (bem && !obra && o.elemento === "51") {
      return {
        rotulo: "Aquisição de bem",
        divisibilidade: null,
        explicacao: `verbo de aquisição prevalece sobre “${termo}”, que é o lugar, não o que se compra`,
        natureza: "CAPITAL",
        elemento: "52",
        elementoIncerto: true,
        area: o.area,
        estrito: false,
        subfuncao,
        subfuncaoSecundaria,
        confianca: "inferido",
        termo: `${termo} + verbo de aquisição`,
        pistas,
      };
    }
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
        subfuncaoSecundaria,
        confianca: "exato",
        termo: `${termo} + verbo de obra`,
        pistas,
      };
    }
    // Custeio, manutenção e locação prevalecem sobre termo de capital, salvo
    // se houver verbo de aquisição.
    if (custeio && !bem && !obra && o.natureza === "CAPITAL") {
      const material = PALAVRAS_MATERIAL.some((v) => contem(t, v));
      return {
        rotulo: "Custeio ou manutenção",
        divisibilidade: "DIVISIVEL",
        explicacao: `marcador de custeio prevalece sobre “${termo}”${material ? "; material citado" : ""}`,
        natureza: "CUSTEIO",
        // Manutenção do bem é serviço (39), salvo se o texto fala em material.
        elemento: material ? "30" : "39",
        elementoIncerto: true,
        area: o.area,
        estrito: o.estrito,
        subfuncao,
        subfuncaoSecundaria,
        confianca: "exato",
        termo: `${termo} + marcador de custeio`,
        pistas,
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
      subfuncaoSecundaria,
      confianca: "exato",
      termo,
      pistas,
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
  // Custeio sem termo: material (30) se o texto fala em material, insumo ou
  // gênero; serviço (39) caso contrário. O elemento fica marcado como incerto.
  const material = PALAVRAS_MATERIAL.some((v) => contem(t, v));
  if (custeio && !bem) {
    return inferido({
      rotulo: "Custeio ou manutenção",
      divisibilidade: "DIVISIVEL",
      explicacao: material ? "inferido pelo marcador de custeio; material citado" : "inferido pelo marcador de custeio",
      natureza: "CUSTEIO",
      elemento: material ? "30" : "39",
      elementoIncerto: true,
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
      explicacao: material ? "inferido — nenhum termo da biblioteca; material citado" : "inferido — nenhum termo da biblioteca",
      natureza: "CUSTEIO",
      elemento: material ? "30" : "39",
      elementoIncerto: true,
    });
  }
  return null;
}
