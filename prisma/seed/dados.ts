import { readFileSync } from "node:fs";
import path from "node:path";

// Leitura dos arquivos de prisma/dados/<município>/.
const PASTA = path.join(import.meta.dirname, "..", "dados", "mogi-guacu");

export function lerDados<T>(arquivo: string): T {
  return JSON.parse(readFileSync(path.join(PASTA, arquivo), "utf8")) as T;
}

export const data = (iso: string) => new Date(`${iso}T12:00:00Z`);
