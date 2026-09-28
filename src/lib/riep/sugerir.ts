import { classificar } from "./classificar";
import { interpretar, VERBOS_BEM, VERBOS_OBRA } from "./interpretar";
import { contem, norm } from "./texto";
import type { Candidata, Catalogo, Classificacao, DestinoMotor, DotacaoMotor, ObjetoBiblioteca } from "./tipos";

// ============================================================================
// Ajuste automático quando a análise não encontra dotação. O motor não inventa:
// cada sugestão é reclassificada e só aparece se enquadrar de fato. Duas vias —
// reescrever o objeto com um termo da biblioteca ligado ao que foi escrito, ou
// manter o texto e indicar um destino onde ele cabe.
// ============================================================================

type Entrada = {
  objeto: string;
  destino: DestinoMotor;
  execucao: "DIRETA" | "INDIRETA";
  pretendido: number;
  loa: DotacaoMotor[];
  catalogo: Catalogo;
};

export type Enquadramento = { situacao: "OK" | "VALIDAR"; dotacao: Candidata; opcoes: number };
export type SugestaoTexto = { texto: string; rotulo: string } & Enquadramento;
export type SugestaoDestino = { destino: DestinoMotor } & Enquadramento;

// Precisa de ajuste: óbice, conflito de área ou nenhuma dotação aderente.
export const precisaAjuste = (c: Classificacao) =>
  c.situacao === "OBICE" || c.situacao === "CONFLITO" || (c.situacao === "VALIDAR" && (c.naoReconhecido || c.semAderencia));

// Enquadra quando há dotação escolhida ou opções aderentes para escolher.
function enquadramento(r: Classificacao): Enquadramento | null {
  if (r.situacao === "OK" && r.selecionada) return { situacao: "OK", dotacao: r.selecionada, opcoes: 1 };
  if (r.situacao === "VALIDAR" && !r.naoReconhecido && !r.semAderencia && r.opcoes.length) {
    return { situacao: "VALIDAR", dotacao: r.opcoes[0], opcoes: r.opcoes.length };
  }
  return null;
}

// Palavras que não dizem o que a emenda entrega.
const VAZIAS = new Set(
  "aquisicao compra comprar adquirir contratacao servico servicos para com uma umas dois duas tres municipal municipio unidade publica publico destinado destinada"
    .split(" ")
);
const palavras = (t: string) => norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !VAZIAS.has(w));

// Texto-modelo pela natureza do objeto, sempre a partir do rótulo da biblioteca
// (os termos são guardados sem acento).
function modelo(o: ObjetoBiblioteca): string {
  const nome = o.rotulo.charAt(0).toLowerCase() + o.rotulo.slice(1);
  if (o.elemento === "51") return /^obra/i.test(o.rotulo) ? o.rotulo : `Reforma de ${nome}`;
  if (o.elemento === "43") return o.rotulo;
  if (o.elemento === "39" || o.elemento === "40") return `Contratação de ${nome}`;
  return `Aquisição de ${nome}`;
}

// O complemento do texto original ("para o transporte de pacientes") vai junto.
const complemento = (objeto: string) => objeto.match(/\s(para|destinad[oa]s?\s+a)\s.+$/i)?.[0].trim() ?? "";

// Como o texto foi lido. Obra ou compra: o verbo manda — "comprar … para a
// escola" é compra, ainda que "escola" seja termo de obra na biblioteca.
function leitura(objeto: string, catalogo: Catalogo) {
  const original = interpretar(objeto, catalogo.objetos);
  const t = norm(objeto);
  const verboObra = VERBOS_OBRA.some((v) => contem(t, v));
  const verboBem = VERBOS_BEM.some((v) => contem(t, v));
  const obra = original?.elemento === "51" && (verboObra || !verboBem);
  const soPelaArea = original?.confianca === "inferido" || (original?.elemento === "51" && !obra);
  return { original, obra, soPelaArea };
}

export function sugerirTextos(x: Entrada, limite = 3): SugestaoTexto[] {
  const { original, obra, soPelaArea } = leitura(x.objeto, x.catalogo);
  const extra = complemento(x.objeto);
  // Compara só o núcleo: "para a escola" diz o destino, não o objeto.
  const escritas = new Set(palavras(extra ? x.objeto.slice(0, x.objeto.length - extra.length) : x.objeto));

  const relevantes = x.catalogo.objetos
    .map((o) => {
      const sobreposicao = [...new Set(palavras(`${o.rotulo} ${o.termos.join(" ")}`))].filter((w) => escritas.has(w)).length;
      const mesmaArea = !!original?.area && original.area === o.area;
      const mesmoElemento = !!original && original.elemento === o.elemento;
      // Só o que tem ligação com o texto: palavra em comum, mesma área e mesmo
      // elemento, ou — objeto não reconhecido — o mesmo tipo de despesa. Obra
      // nunca vira compra, nem compra vira obra.
      const relevante =
        (o.elemento === "51") === obra &&
        (sobreposicao > 0 || (mesmaArea && (mesmoElemento || soPelaArea)) || (original?.confianca === "inferido" && mesmoElemento));
      return { o, pontos: sobreposicao * 3 + (mesmaArea ? 2 : 0) + (mesmoElemento ? 1 : 0), relevante };
    })
    .filter((r) => r.relevante)
    .sort((a, b) => b.pontos - a.pontos);

  const vistos = new Set([norm(x.objeto)]);
  const saida: SugestaoTexto[] = [];
  for (const { o } of relevantes) {
    const base = modelo(o);
    const achou = [extra ? `${base} ${extra}` : "", base]
      .filter(Boolean)
      .map((texto) => {
        if (vistos.has(norm(texto))) return null;
        vistos.add(norm(texto));
        if (interpretar(texto, x.catalogo.objetos)?.rotulo !== o.rotulo) return null;
        const e = enquadramento(classificar({ ...x, objeto: texto }));
        return e ? { texto, rotulo: o.rotulo, ...e } : null;
      })
      .find(Boolean);
    if (achou) saida.push(achou);
    if (saida.length >= limite) break;
  }
  return saida;
}

export function sugerirDestinos(x: Entrada & { destinos: DestinoMotor[] }, limite = 3): { sugestoes: SugestaoDestino[]; total: number } {
  // Trocar o destino só faz sentido quando o objeto foi lido com segurança.
  if (leitura(x.objeto, x.catalogo).soPelaArea) return { sugestoes: [], total: 0 };
  const todas = x.destinos
    .filter((d) => d.id !== x.destino.id && d.execucao === x.execucao && !d.pendenciaHabilitacao)
    .map((d) => {
      const e = enquadramento(classificar({ ...x, destino: d }));
      return e ? { destino: d, ...e } : null;
    })
    .filter((s): s is SugestaoDestino => !!s)
    .sort(
      (a, b) =>
        Number(b.situacao === "OK") - Number(a.situacao === "OK") ||
        b.dotacao.pontos - a.dotacao.pontos ||
        a.destino.nome.localeCompare(b.destino.nome)
    );
  return { sugestoes: todas.slice(0, limite), total: todas.length };
}
