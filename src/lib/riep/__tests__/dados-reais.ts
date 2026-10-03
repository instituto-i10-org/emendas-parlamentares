// Dados reais de Mogi Guaçu para os testes do motor, montados a partir dos
// mesmos arquivos que o seed carrega no banco.
import { readFileSync } from "node:fs";
import path from "node:path";
import { codigosDeExibicao, NATUREZAS_EMENDAVEIS } from "@/lib/orcamento/codigo-dotacao";
import { subfuncaoDoDestino } from "../destino";
import type { Catalogo, ConfigMotor, DestinoMotor, DotacaoMotor, TipoDestino } from "../tipos";

const PASTA = path.resolve(process.cwd(), "prisma/dados/mogi-guacu");
const ler = <T>(arquivo: string): T => JSON.parse(readFileSync(path.join(PASTA, arquivo), "utf8")) as T;

type Linha = {
  ficha: string; nome: string; actionCode: string; uo: string; funcao: string; subf: string; subfn: string;
  prog: string; programName: string; gnd: string; mod: string; elem: string; sourceCode: string;
  applicationCode: string; autorizado: number; pagina: number;
};

// As dotações que recebem emenda no exercício, no formato do motor.
export function loaDoExercicio(ano: number): DotacaoMotor[] {
  const linhas = ler<{ dotacoes: Linha[] }>(`loa-${ano}.json`).dotacoes.filter(
    (d) => NATUREZAS_EMENDAVEIS.has(`${d.gnd}|${d.mod}`) && !["01", "17"].includes(d.uo.split(".")[0])
  );
  const codigos = codigosDeExibicao(linhas, new Set());
  return linhas.map((d, i) => ({
    id: codigos[i],
    codigo: codigos[i],
    ficha: /^\d+$/.test(d.ficha) ? d.ficha : null,
    nome: d.nome,
    uo: d.uo,
    funcao: d.funcao,
    subf: d.subf,
    subfn: d.subfn,
    prog: d.prog,
    progn: d.programName,
    tipo: d.actionCode.startsWith("1") ? "P" : "A",
    gnd: d.gnd,
    mod: d.mod,
    elem: d.elem,
    fonte: `${d.sourceCode}.${d.applicationCode}`,
    fonten: "",
    autorizado: d.autorizado,
  }));
}

export const loa: DotacaoMotor[] = loaDoExercicio(2026);

const bib = ler<{ areas: Catalogo["areas"]; objetos: Catalogo["objetos"]; tiposDestino: TipoDestino[] }>("biblioteca-objetos.json");
export const catalogoDoExercicio = (ano: number): Catalogo => ({
  objetos: bib.objetos,
  areas: bib.areas,
  unidades: ler<{ names: Record<string, string> }>(`unidades-${ano}.json`).names,
  tiposDestino: bib.tiposDestino,
});
export const catalogo: Catalogo = catalogoDoExercicio(2026);

type DestinoJson = {
  nome: string; nomeOficial?: string; execucao: "DIRETA" | "INDIRETA"; endereco: string; unidade?: string; cnpj?: string;
  populacao?: number; fontePopulacao?: string; dataPopulacao?: string;
};
const destinos = ler<{ destinos: DestinoJson[] }>("destinos-2026.json").destinos;

export function destino(trecho: string): DestinoMotor {
  const d = destinos.find((x) => x.nome.toLowerCase().includes(trecho.toLowerCase()));
  if (!d) throw new Error(`Destino não encontrado: ${trecho}`);
  return {
    id: d.nome,
    nome: d.nome,
    execucao: d.execucao,
    uo: d.unidade ?? null,
    endereco: d.endereco,
    cnpj: d.cnpj ?? null,
    responsavel: null,
    cargo: null,
    populacao: d.populacao ?? null,
    fontePopulacao: d.fontePopulacao ?? null,
    dataPopulacao: d.dataPopulacao ?? null,
    novo: false,
    pendenciaHabilitacao: null,
    // Como o seed faz: a subfunção sugerida vem do tipo de equipamento.
    subfuncao: subfuncaoDoDestino(d.nome, d.nomeOficial, bib.tiposDestino),
  };
}

export const config: ConfigMotor = {
  exercicio: 2026,
  cotaIndividual: 773014.78,
  percentualSaude: 50,
  afericaoSaude: "GLOBAL",
  toleranciaValorPct: 10,
  validadeReferenciaMeses: 12,
  percentualAcessorio: 20,
  fonteAudesp: "08",
  fonteAudespNome: "Emendas Parlamentares Individuais — Legislativo Municipal",
  codigoAplicacao: "804",
  formatoVariacao: 4,
  variacaoOcupaFonte: false,
  icEpVigente: false,
  icEpCodigo: null,
  rotuloBase: "LOA 2026 (Lei 6.246/2025)",
};

// Todos os destinos, no formato do motor.
export const todosDestinos = (): DestinoMotor[] => destinos.map((d) => destino(d.nome));
