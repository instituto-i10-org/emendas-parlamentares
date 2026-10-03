// Os casos do Relatório de Testes do Dr. Emerson (29/09/2026), usados nos
// testes da base de cada exercício.
//
// CRAS Zona Leste e CRAS Zona Norte não existem no
// cadastro de destinos; os casos 05 e 13 usam o CREAS e o Cadastro Único, da
// mesma unidade 14.01.
export const CASOS: { teste: string; destino: string; objeto: string; subf?: string }[] = [
  { teste: "01", destino: "CAPS AD", objeto: "[TESTE 01] Custeio de material de consumo para o CAPS AD de Mogi Guaçu" },
  { teste: "02", destino: "João Bueno", objeto: "[TESTE 02] Custeio de material pedagógico e de expediente para a EMEF João Bueno Junior", subf: "361" },
  { teste: "03", destino: "UBS Zona Norte", objeto: "[TESTE 03] Custeio de material de consumo ambulatorial para a UBS Zona Norte" },
  { teste: "04", destino: "CAPS II", objeto: "[TESTE 04] Custeio de material de consumo para oficinas terapêuticas do CAPS II" },
  { teste: "05", destino: "CREAS", objeto: "[TESTE 05] Custeio de material de consumo para o CREAS Mogi Guaçu" },
  // Objeto do relatório: "material pedagógico" carregava a subfunção 361 e vencia a do destino.
  { teste: "07", destino: "EMEI Aida", objeto: "[TESTE 07] Custeio de material pedagógico para a EMEI Aida Rocha", subf: "365" },
  { teste: "08", destino: "CEI Ruy", objeto: "[TESTE 08] Custeio de material de higiene e consumo para o CEI Ruy Bueno", subf: "365" },
  { teste: "09", destino: "USF Chaparral", objeto: "[TESTE 09] Custeio de material de consumo ambulatorial para a USF Chaparral" },
  { teste: "10", destino: "SAMU 192", objeto: "[TESTE 10] Custeio de material de consumo para a Central SAMU 192" },
  { teste: "11", destino: "Guaçu Mirim", objeto: "[TESTE 11] Custeio de material de consumo ambulatorial para a UBS Guaçu Mirim" },
  { teste: "12", destino: "Geraldo Sorg", objeto: "[TESTE 12] Custeio de material de consumo para a EMEF Prof. Geraldo Sorg", subf: "361" },
  { teste: "14", destino: "CEO", objeto: "[TESTE 14] Custeio de material odontológico para o CEO" },
  { teste: "16", destino: "Atendimento da Mulher", objeto: "[TESTE 16] Custeio de material ambulatorial para o Centro de Atendimento da Mulher" },
  { teste: "17", destino: "Academia da Sa", objeto: "[TESTE 17] Custeio de material esportivo de consumo para o Polo Academia da Saúde" },
  { teste: "18", destino: "Cadastro Único", objeto: "[TESTE 18] Custeio de material de expediente para a Central de Cadastro Único" },
  { teste: "19", destino: "Sinésio", objeto: "[TESTE 19] Custeio de material pedagógico para a CEI Sinésio Ramos", subf: "365" },
  { teste: "20", destino: "UBS Zona Sul", objeto: "[TESTE 20] Custeio de material de consumo ambulatorial para a UBS Zona Sul" },
];
