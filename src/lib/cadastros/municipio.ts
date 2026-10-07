import { z } from "zod";

// Dados do município: o que identifica a Câmara e a Prefeitura nas telas, no
// portal e nos documentos. Num sistema recém-iniciado, nome em branco quer
// dizer "município não configurado".

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

export const municipioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do município.").max(120),
  uf: z.enum(UFS, "Escolha a UF."),
  codigoIbge: z.union([z.literal(""), z.string().trim().regex(/^\d{7}$/, "O código IBGE tem 7 dígitos.")]),
  nomeCamara: z.string().trim().max(200),
  nomePrefeitura: z.string().trim().max(200),
});

export type DadosMunicipio = z.input<typeof municipioSchema>;

export const municipioConfigurado = (m: { nome: string } | null | undefined): m is { nome: string } => !!m?.nome?.trim();
