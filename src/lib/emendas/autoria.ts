// Coautoria: o autor (quem criou e quem age) e os coautores, cada um com a sua
// parte do valor. A parte do autor é o valor da emenda menos a dos coautores.
// Puro: serve à tela, ao servidor, ao documento e às listas.

type Num = number | { toNumber(): number };
const num = (v: Num) => (typeof v === "number" ? v : v.toNumber());
const arred = (v: number) => Math.round(v * 100) / 100;

export type AutorBasico = { id?: string; nome: string; partido?: string | null };

export type ParteAutoria = {
  autorId: string;
  nome: string;
  partido: string | null;
  valor: number;
  // O autor da emenda (primeira linha); os demais são coautores.
  principal: boolean;
};

type EmendaComAutoria = {
  autorId: string;
  valor: Num;
  autor: AutorBasico;
  coautores?: { autorId: string; valor: Num; ordem?: number; autor: AutorBasico }[] | null;
};

// Todos os autores, na ordem: o autor e depois os coautores.
export function autoresDaEmenda(e: EmendaComAutoria): ParteAutoria[] {
  const co = [...(e.coautores ?? [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const somaCo = co.reduce((s, c) => s + num(c.valor), 0);
  return [
    { autorId: e.autorId, nome: e.autor.nome, partido: e.autor.partido ?? null, valor: arred(num(e.valor) - somaCo), principal: true },
    ...co.map((c) => ({ autorId: c.autorId, nome: c.autor.nome, partido: c.autor.partido ?? null, valor: arred(num(c.valor)), principal: false })),
  ];
}

export const emCoautoria = (e: { coautores?: unknown[] | null }) => (e.coautores?.length ?? 0) > 0;

// A parte de um vereador na emenda (0 se ele não é autor nem coautor).
type ComPartes = { autorId: string; valor: Num; coautores?: { autorId: string; valor: Num }[] | null };

export function parteDe(e: ComPartes, autorId: string): number {
  const co = e.coautores ?? [];
  if (e.autorId === autorId) return arred(num(e.valor) - co.reduce((s, c) => s + num(c.valor), 0));
  const c = co.find((x) => x.autorId === autorId);
  return c ? arred(num(c.valor)) : 0;
}

export const participa = (e: Omit<ComPartes, "valor">, autorId: string) =>
  e.autorId === autorId || (e.coautores ?? []).some((c) => c.autorId === autorId);

// "Fulano (PSD)".
export const nomeComPartido = (a: { nome: string; partido?: string | null }) => (a.partido ? `${a.nome} (${a.partido})` : a.nome);

// Nomes juntos, para texto corrido e planilhas: "A, B e C".
export function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

// Filtro do Prisma: emendas em que o vereador é autor ou coautor. Coautoria em
// emenda de demonstração não aparece para o vereador real.
export const ondeParticipa = (autorId: string) => ({
  OR: [{ autorId }, { coautores: { some: { autorId } }, autor: { demonstracao: false } }],
});

// O que as listas precisam carregar para mostrar os coautores.
export const incluirCoautores = {
  coautores: { orderBy: { ordem: "asc" as const }, include: { autor: { select: { id: true, nome: true, partido: true } } } },
};

// Vereador que pode entrar como coautor, com o que já apresentou no exercício
// (sem a emenda em edição): a tela confere a parte dele contra a cota dele.
export type VereadorCota = { id: string; nome: string; partido: string | null; aplicado: { saude: number; demais: number } };

// As partes para a conferência de cota; sem coautores, nada (a emenda é toda
// do autor e vale o aplicado dele).
export function partesParaCota(
  valor: number,
  autor: { nome: string; aplicado: { saude: number; demais: number } },
  coautores: { autorId: string; valor: number }[],
  vereadores: VereadorCota[]
): { nome: string; valor: number; aplicado: { saude: number; demais: number } }[] | undefined {
  if (!coautores.length) return undefined;
  const somaCo = coautores.reduce((s, c) => s + c.valor, 0);
  return [
    { nome: autor.nome, valor: arred(valor - somaCo), aplicado: autor.aplicado },
    ...coautores.map((c) => {
      const v = vereadores.find((x) => x.id === c.autorId);
      return { nome: v?.nome ?? "Coautor", valor: arred(c.valor), aplicado: v?.aplicado ?? { saude: 0, demais: 0 } };
    }),
  ];
}
