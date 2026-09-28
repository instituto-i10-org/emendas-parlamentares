// Código de exibição da dotação — como as pessoas a citam: o número da ação;
// se a ação se repete, com o elemento ("2001.52"); se ainda colidir, com a
// ficha ("2001.52/470") ou a página do anexo, quando a ficha é ilegível.
//
// Os códigos já usados entram por `usados`, para que lotes sucessivos (primeiro
// as dotações que recebem emenda, depois as demais) não colidam.
export function codigosDeExibicao(
  linhas: { actionCode: string; elem: string; ficha: string; pagina: number }[],
  usados: Set<string>
): string[] {
  const repeticoes = new Map<string, number>();
  for (const d of linhas) repeticoes.set(d.actionCode, (repeticoes.get(d.actionCode) ?? 0) + 1);
  return linhas.map((d) => {
    let codigo = repeticoes.get(d.actionCode) === 1 ? d.actionCode : `${d.actionCode}.${d.elem}`;
    if (usados.has(codigo)) {
      const base = `${codigo}/${/^\d+$/.test(d.ficha) ? d.ficha : `p${d.pagina}`}`;
      codigo = base;
      for (let n = 2; usados.has(codigo); n++) codigo = `${base}-${n}`;
    }
    usados.add(codigo);
    return codigo;
  });
}

// Grupo e modalidade que uma emenda individual pode financiar: custeio ou
// investimento, aplicação direta (90) ou transferência a entidade (50).
export const NATUREZAS_EMENDAVEIS = new Set(["3|90", "4|90", "3|50", "4|50"]);
