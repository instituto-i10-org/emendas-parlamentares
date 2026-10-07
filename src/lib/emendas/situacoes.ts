// Situações da emenda agrupadas pelo que importa às telas e às regras.
// Puro: serve ao servidor e ao navegador.

import type { StatusEmenda } from "@/generated/prisma/enums";

// Com o autor: ainda não chegou à Câmara (sem número).
export const NAO_REMETIDAS: StatusEmenda[] = ["RASCUNHO", "EM_VALIDACAO", "VALIDA", "INVALIDA"];
export const naoRemetida = (s: string) => (NAO_REMETIDAS as string[]).includes(s);

// O autor ainda altera: as não remetidas e a devolvida em diligência.
export const editavelPeloAutor = (s: string) => naoRemetida(s) || s === "EM_DILIGENCIA";
