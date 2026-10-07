import type { Prisma, StatusEmenda } from "@/generated/prisma/client";

// ============================================================================
// Filtros das listas de emendas, lidos da URL (a lista filtrada se compartilha
// e funciona sem JavaScript): situação, autor, área, texto, período e página.
// Em Mogi toda emenda é impositiva: não há filtro por tipo.
// ============================================================================

export const POR_PAGINA = 25;

export type Filtros = {
  situacao: StatusEmenda[];
  autorId: string | null;
  areaId: string | null;
  q: string;
  de: string | null;
  ate: string | null;
  pagina: number;
};

const SITUACOES = new Set([
  "RASCUNHO",
  "EM_VALIDACAO",
  "VALIDA",
  "INVALIDA",
  "SUBMETIDA",
  "EM_TRAMITACAO",
  "EM_DILIGENCIA",
  "APROVADA",
  "REJEITADA",
]);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const varios = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []);

export function lerFiltros(sp: Busca): Filtros {
  const pagina = Number.parseInt(um(sp.pagina), 10);
  return {
    situacao: varios(sp.situacao).filter((s) => SITUACOES.has(s)) as StatusEmenda[],
    autorId: um(sp.autor).slice(0, 40) || null,
    areaId: um(sp.area).slice(0, 40) || null,
    q: um(sp.q).trim().slice(0, 200),
    de: DATA.test(um(sp.de)) ? um(sp.de) : null,
    ate: DATA.test(um(sp.ate)) ? um(sp.ate) : null,
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

// Onde, no banco. A área vale pelo órgão da dotação (cadastro de áreas de
// aplicação); o período, pela data de remessa (ou da última alteração, para o
// que ainda não foi remetido).
export function ondeDosFiltros(f: Filtros, orgaosDaArea: string[] | null): Prisma.EmendaWhereInput {
  const e: Prisma.EmendaWhereInput[] = [];
  if (f.situacao.length) e.push({ status: { in: f.situacao } });
  if (f.autorId) e.push({ autorId: f.autorId });
  if (orgaosDaArea) {
    e.push({
      // A área cita órgãos ("13") ou unidades ("13.01").
      OR: [
        { dotacao: { orgao: { codigo: { in: orgaosDaArea } } } },
        { dotacao: { unidadeOrcamentaria: { codigo: { in: orgaosDaArea } } } },
      ],
    });
  }
  if (f.q) {
    e.push({
      OR: [
        { objeto: { contains: f.q, mode: "insensitive" } },
        { justificativa: { contains: f.q, mode: "insensitive" } },
        { destino: { nome: { contains: f.q, mode: "insensitive" } } },
        { autor: { nome: { contains: f.q, mode: "insensitive" } } },
        ...(/^\d+$/.test(f.q) ? [{ numero: Number(f.q) }] : []),
      ],
    });
  }
  if (f.de || f.ate) {
    const faixa = { ...(f.de ? { gte: new Date(`${f.de}T00:00:00-03:00`) } : {}), ...(f.ate ? { lte: new Date(`${f.ate}T23:59:59-03:00`) } : {}) };
    e.push({ OR: [{ submetidaEm: faixa }, { submetidaEm: null, updatedAt: faixa }] });
  }
  return e.length ? { AND: e } : {};
}

// A URL da mesma lista com outros valores (paginação, abas).
export function comFiltros(base: string, f: Partial<Filtros> & Record<string, unknown>, extra: Record<string, string | number | null> = {}): string {
  const p = new URLSearchParams();
  const v = { ...f, ...extra } as Record<string, unknown>;
  for (const [k, x] of Object.entries(v)) {
    if (k === "situacao" && Array.isArray(x)) {
      if (x.length) p.set("situacao", x.join(","));
    } else if (k === "autorId") {
      if (x) p.set("autor", String(x));
    } else if (k === "areaId") {
      if (x) p.set("area", String(x));
    } else if (k === "pagina") {
      if (x && x !== 1) p.set("pagina", String(x));
    } else if (x !== null && x !== undefined && x !== "") p.set(k, String(x));
  }
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
