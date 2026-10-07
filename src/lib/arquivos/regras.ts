// Regras de arquivo por uso: o que se aceita, até que tamanho e quem envia.
// Puro: vale no navegador (para avisar antes) e no servidor (para recusar).

export type UsoArquivo = "PECA_ORCAMENTARIA" | "NORMA" | "IMPORTACAO";

const PDF = "application/pdf";
const CSV = ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"];
const XLSX = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
const IMAGENS = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export const REGRAS_ARQUIVO: Record<UsoArquivo, { tipos: string[]; extensoes: string[]; maxBytes: number; rotulo: string }> = {
  PECA_ORCAMENTARIA: { tipos: [PDF], extensoes: ["pdf"], maxBytes: 100 * 1024 * 1024, rotulo: "PDF de até 100 MB" },
  NORMA: { tipos: [PDF], extensoes: ["pdf"], maxBytes: 50 * 1024 * 1024, rotulo: "PDF de até 50 MB" },
  IMPORTACAO: {
    tipos: [PDF, ...CSV, ...XLSX, ...IMAGENS],
    extensoes: ["pdf", "csv", "xlsx", "xls", "jpg", "jpeg", "png", "webp", "heic"],
    maxBytes: 100 * 1024 * 1024,
    rotulo: "PDF, CSV, XLSX ou foto, até 100 MB",
  },
};

export const extensao = (nome: string) => (nome.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? "");

// Nada de caminho, controle ou caractere estranho no nome guardado.
export function nomeSeguro(nome: string): string {
  const base = nome.normalize("NFC").replace(/[/\\]/g, "_").replace(/[\u0000-\u001f]/g, "").trim();
  return (base || "arquivo").slice(0, 180);
}

export function conferirArquivo(uso: UsoArquivo, a: { nome: string; tipo: string; tamanho: number }): string | null {
  const r = REGRAS_ARQUIVO[uso];
  if (!r) return "Uso de arquivo desconhecido.";
  if (!(a.tamanho > 0)) return "O arquivo está vazio.";
  if (a.tamanho > r.maxBytes) return `Arquivo grande demais: o limite é ${r.rotulo}.`;
  const ext = extensao(a.nome);
  if (!r.extensoes.includes(ext)) return `Formato não aceito aqui: envie ${r.rotulo}.`;
  // Alguns navegadores mandam tipo vazio; a extensão decide nesses casos.
  if (a.tipo && !r.tipos.includes(a.tipo) && a.tipo !== "application/octet-stream") return `Formato não aceito aqui: envie ${r.rotulo}.`;
  return null;
}

// Tipo a gravar: o informado, ou o da extensão quando vier vazio.
export function tipoDoArquivo(nome: string, tipo: string): string {
  if (tipo && tipo !== "application/octet-stream") return tipo;
  const ext = extensao(nome);
  return (
    {
      pdf: PDF,
      csv: "text/csv",
      xlsx: XLSX[0],
      xls: "application/vnd.ms-excel",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
    }[ext] ?? "application/octet-stream"
  );
}
