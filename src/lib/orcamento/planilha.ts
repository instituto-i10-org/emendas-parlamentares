import * as XLSX from "xlsx";
import { CAMPOS, mapearCabecalho, type TipoCarga } from "./colunas";

// Leitura de CSV e XLSX para a importação. Devolve as células como texto, sem
// perder zeros à esquerda nem acentos, e acha a linha do cabeçalho (há
// planilhas com título antes dele).

export type PlanilhaLida = {
  cabecalho: string[];
  // Linhas de dados, já sem o cabeçalho, com o número da linha na planilha.
  linhas: { numero: number; celulas: string[] }[];
  linhaCabecalho: number;
  codificacao?: "utf-8" | "windows-1252";
  separador?: string;
};

// CSV: UTF-8 com ou sem marca de ordem; se não for UTF-8 válido, Windows-1252
// (o que o Excel em português grava).
export function decodificarTexto(bytes: Uint8Array): { texto: string; codificacao: "utf-8" | "windows-1252" } {
  const semBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return { texto: new TextDecoder("utf-8", { fatal: true }).decode(semBom), codificacao: "utf-8" };
  } catch {
    return { texto: new TextDecoder("windows-1252").decode(semBom), codificacao: "windows-1252" };
  }
}

// Separador: o que mais aparece fora de aspas nas primeiras linhas.
export function detectarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 20).join("\n").replace(/"[^"]*"/g, "");
  const conta = (s: string) => amostra.split(s).length - 1;
  return [";", "\t", ",", "|"].sort((a, b) => conta(b) - conta(a))[0];
}

// CSV com aspas, separador e quebras dentro de aspas.
export function lerCsv(texto: string, separador: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === separador) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

// XLSX: célula numérica vira texto sem notação científica; código com zero à
// esquerda guardado como número volta pelo texto formatado da célula.
export function lerXlsx(bytes: Uint8Array): string[][] {
  const wb = XLSX.read(bytes, { type: "array", cellText: true, cellDates: false });
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba || !aba["!ref"]) return [];
  const area = XLSX.utils.decode_range(aba["!ref"]);
  const linhas: string[][] = [];
  for (let r = area.s.r; r <= area.e.r; r++) {
    const linha: string[] = [];
    for (let col = area.s.c; col <= area.e.c; col++) {
      const cel = aba[XLSX.utils.encode_cell({ r, c: col })] as XLSX.CellObject | undefined;
      if (!cel || cel.v === undefined || cel.v === null) linha.push("");
      else if (typeof cel.v === "number") linha.push(cel.w && /^0\d/.test(cel.w.trim()) ? cel.w.trim() : numeroComoTexto(cel.v));
      else linha.push(String(cel.v));
    }
    linhas.push(linha);
  }
  return linhas;
}

const numeroComoTexto = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// A linha do cabeçalho: entre as 20 primeiras, a que mais casa com os campos.
export function acharCabecalho(tipo: TipoCarga, linhas: string[][]): number {
  let melhor = 0;
  let pontos = -1;
  for (let i = 0; i < Math.min(20, linhas.length); i++) {
    const n = Object.keys(mapearCabecalho(tipo, linhas[i]).mapa).length;
    if (n > pontos) {
      pontos = n;
      melhor = i;
    }
  }
  return melhor;
}

export function lerPlanilha(tipo: TipoCarga, nome: string, bytes: Uint8Array): PlanilhaLida {
  const ext = nome.toLowerCase().split(".").pop();
  let celulas: string[][];
  let codificacao: PlanilhaLida["codificacao"];
  let separador: string | undefined;
  if (ext === "csv" || ext === "txt") {
    const d = decodificarTexto(bytes);
    codificacao = d.codificacao;
    separador = detectarSeparador(d.texto);
    celulas = lerCsv(d.texto, separador);
  } else {
    celulas = lerXlsx(bytes);
  }
  const i = acharCabecalho(tipo, celulas);
  const linhas = celulas
    .slice(i + 1)
    .map((c, k) => ({ numero: i + 2 + k, celulas: c.map((x) => x.trim()) }))
    .filter((l) => l.celulas.some(Boolean));
  return { cabecalho: (celulas[i] ?? []).map((x) => x.trim()), linhas, linhaCabecalho: i + 1, codificacao, separador };
}

// Planilha-modelo (CSV com ponto e vírgula, UTF-8 com marca de ordem).
export function modeloCsv(tipo: TipoCarga): string {
  return "﻿" + CAMPOS[tipo].map((f) => f.campo).join(";") + "\r\n";
}
