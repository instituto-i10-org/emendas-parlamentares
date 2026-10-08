import { readFileSync } from "node:fs";
import path from "node:path";

// Leitura dos arquivos de prisma/dados/<município>/. O município do seed vem
// de SEED_MUNICIPIO (padrão: mogi-guacu).
export const MUNICIPIO_SEED = process.env.SEED_MUNICIPIO || "mogi-guacu";
const PASTA = path.join(import.meta.dirname, "..", "dados", MUNICIPIO_SEED);

export function lerDados<T>(arquivo: string): T {
  return JSON.parse(readFileSync(path.join(PASTA, arquivo), "utf8")) as T;
}

export type MunicipioJson = {
  nome: string;
  uf: string;
  codigoIbge: string;
  nomeCamara: string;
  nomePrefeitura: string;
  // Documentos da Câmara (capa do processo e rodapé). Opcionais.
  enderecoCamara?: string;
  rodapeDocumentos?: string;
  // Exercícios com exercicio-<ano>.json, loa-<ano>.json e unidades-<ano>.json.
  anos: number[];
  destinos: string;
  // Emendas apresentadas fora do sistema, que contam para a cota.
  emendasImportadas: { arquivo: string; ano: number } | null;
  // Vereadores da legislatura (autores sem conta), quando não vêm das emendas importadas.
  vereadores: string | null;
};

export const lerMunicipio = () => lerDados<MunicipioJson>("municipio.json");

export const data = (iso: string) => new Date(`${iso}T12:00:00Z`);
