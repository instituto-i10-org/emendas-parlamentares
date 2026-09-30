import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Extrai o Quadro de Detalhamento da Despesa (QDD) da LOA a partir dos PDFs
// publicados pela Prefeitura no Portal da Transparência (INTER-TEC) e gera
// prisma/dados/mogi-guacu/loa-2026.json no formato que o seed consome.
//
//   npx tsx prisma/extrair-qdd.ts "<QDD.pdf>" --anexos "<Anexos.pdf>"
//
// Precisa do `pdftotext` (poppler) no PATH. Os PDFs são nativos, com camada de
// texto limpa — nada aqui é OCR.
//
// Duas fontes, dois formatos:
// - O QDD da Prefeitura ("por Aplicação em Programas") traz nome de ação,
//   subfunção e programa. Cobre a administração direta (órgãos 02 a 28).
// - Os Anexos trazem o QDD consolidado, compacto, de todas as entidades
//   (Câmara 01, SAMAE 18, FEG 19, Hospital 20). Só entram daqui os órgãos que
//   o primeiro não cobre; nomes de subfunção e programa vêm do arquivo
//   anterior, quando os códigos coincidem.
//
// A extração só é gravada se a conciliação fechar: total da Prefeitura igual
// ao Anexo 1 da lei, total por órgão igual ao Anexo 2, nenhuma ficha repetida
// dentro do órgão e toda linha de natureza com ação conhecida.

const PASTA = path.join(import.meta.dirname, "dados", "mogi-guacu");
const SAIDA = path.join(PASTA, "loa-2026.json");
const UNIDADES = path.join(PASTA, "unidades-2026.json");

// Anexo 1 da Lei 6.246/2025: despesa fixada para a Prefeitura (administração direta).
const TOTAL_PREFEITURA = 722_938_503.22;
const FONTE_URL =
  "https://gpmodmogiguacu.intertecsolucoes.com.br/GPMODMGG/f?p=109:0:1163141112156:APPLICATION_PROCESS=GET_FILE_FOLDER:NO::ID_DOCUMENTO:13082";
const FONTE_ANEXOS_URL =
  "https://gpmodmogiguacu.intertecsolucoes.com.br/GPMODMGG/f?p=109:0:1163141112156:APPLICATION_PROCESS=GET_FILE_FOLDER:NO::ID_DOCUMENTO:13119";

export type Linha = {
  ficha: string;
  nome: string;
  actionCode: string;
  uo: string;
  unitId: string;
  orgName: string;
  unitName: string;
  funcao: string;
  subf: string;
  subfn: string;
  prog: string;
  programName: string;
  gnd: string;
  mod: string;
  elem: string;
  sourceCode: string;
  applicationCode: string;
  autorizado: number;
  pagina: number;
  inferida: false;
  origem: "qdd-prefeitura" | "qdd-consolidado";
};

const RE_ORGAO = /^\s*Órgão\s*:\s*(\d{2})\s+(\S.*?)\s*$/;
const RE_UNIDADE = /^\s*Unidade\s*:\s*(\d{3})\s+(\S.*?)\s*$/;
const RE_NATUREZA = /^\s*(\d)\.(\d)\.(\d{2})(\d{2})\s+(\d{1,3})\s+(\d{7})\s+(\d+)\s+([\d.]+,\d{2})\s*$/;
const RE_ACAO = /^\s*(\S.*?)\s{2,}(\d{2})\s+(\d{3})\s+(\d{4})\s+(\d{4})(?:\s+[\d.]+,\d{2})?\s*$/;
const RE_PROGRAMA = /^\s*(\S.*?)\s{2,}(\d{2})\s+(\d{3})\s+(\d{4})\s*$/;
const RE_SUBFUNCAO = /^\s*(\S.*?)\s{2,}(\d{2})\s+(\d{3})\s*$/;
const RE_FUNCAO = /^\s*(\S.*?)\s{2,}(\d{2})\s*$/;
// Formato compacto dos Anexos: ficha, classificação completa, nome da ação, valor.
// "1        01.01.01.031.7005.1.558.449051.01.1100000        OBRAS DE ...      1.220.000,00"
const RE_COMPACTA =
  /^\s*(\d+)\s+(\d{2})\.(\d{2})\.(\d{2})\.(\d{3})\.(\d{4})\.(\d)\.(\d{3})\.(\d)(\d)(\d{2})(\d{2})\.(\d{2})\.(\d{7})\s+(\S.*?)\s{2,}([\d.]+,\d{2})\s*$/;
const RE_COMPACTA_ORGAO = /^\s*Órgão\s*:\s*(\d{2})\s+(\S.*?)\s*$/;
const RE_COMPACTA_UNIDADE = /^\s*Unidade\s*:\s*(\d{3})\s+(\S.*?)\s*$/;

const numero = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const maiusculas = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
const centavos = (v: number) => Math.round(v * 100);

function textoDe(arquivo: string): string {
  if (arquivo.toLowerCase().endsWith(".txt")) return readFileSync(arquivo, "utf8");
  return execFileSync("pdftotext", ["-layout", arquivo, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// QDD da Prefeitura, "por Aplicação em Programas".
export function extrairQddPrefeitura(texto: string): { linhas: Linha[]; problemas: string[] } {
  const linhas: Linha[] = [];
  const problemas: string[] = [];
  const paginas = texto.split("\f");

  let orgao: { codigo: string; nome: string } | null = null;
  let unidade: { codigo: string; nome: string } | null = null;
  let funcao = "";
  let subf: { codigo: string; nome: string } | null = null;
  let prog: { codigo: string; nome: string } | null = null;
  let acao: { codigo: string; nome: string } | null = null;

  paginas.forEach((pagina, i) => {
    const numPagina = i + 1;
    for (const bruta of pagina.split("\n")) {
      const linha = bruta.replace(/\s+$/, "");
      if (!linha.trim()) continue;

      let m = RE_ORGAO.exec(linha);
      if (m) {
        if (orgao?.codigo !== m[1]) {
          orgao = { codigo: m[1], nome: maiusculas(m[2]) };
          unidade = null;
          acao = null;
        }
        continue;
      }
      m = RE_UNIDADE.exec(linha);
      if (m) {
        if (unidade?.codigo !== m[1]) {
          unidade = { codigo: m[1], nome: maiusculas(m[2]) };
          acao = null;
        }
        continue;
      }
      m = RE_NATUREZA.exec(linha);
      if (m) {
        const [, , gnd, mod, elem, fonte, aplicacao, ficha, valor] = m;
        if (!orgao || !unidade || !acao || !subf || !prog) {
          problemas.push(`p.${numPagina}: ficha ${ficha} sem ação/programa conhecidos — "${linha.trim()}"`);
          continue;
        }
        linhas.push({
          ficha,
          nome: acao.nome,
          actionCode: acao.codigo,
          uo: `${orgao.codigo}.${unidade.codigo.slice(1)}`,
          unitId: `${orgao.codigo}:${Number(unidade.codigo)}`,
          orgName: orgao.nome,
          unitName: unidade.nome,
          funcao,
          subf: subf.codigo,
          subfn: subf.nome,
          prog: prog.codigo,
          programName: prog.nome,
          gnd,
          mod,
          elem,
          sourceCode: fonte.padStart(2, "0"),
          applicationCode: aplicacao,
          autorizado: numero(valor),
          pagina: numPagina,
          inferida: false,
          origem: "qdd-prefeitura",
        });
        continue;
      }
      m = RE_ACAO.exec(linha);
      if (m) {
        funcao = m[2];
        if (subf?.codigo !== m[3]) subf = { codigo: m[3], nome: "" };
        if (prog?.codigo !== m[4]) prog = { codigo: m[4], nome: "" };
        acao = { codigo: m[5], nome: maiusculas(m[1]) };
        continue;
      }
      m = RE_PROGRAMA.exec(linha);
      if (m) {
        funcao = m[2];
        if (subf?.codigo !== m[3]) subf = { codigo: m[3], nome: "" };
        prog = { codigo: m[4], nome: maiusculas(m[1]) };
        continue;
      }
      m = RE_SUBFUNCAO.exec(linha);
      if (m) {
        funcao = m[2];
        subf = { codigo: m[3], nome: m[1].trim() };
        continue;
      }
      m = RE_FUNCAO.exec(linha);
      if (m && !/total|vinculad|ordin/i.test(m[1])) {
        funcao = m[2];
        continue;
      }
    }
  });
  return { linhas, problemas };
}

// QDD consolidado dos Anexos (formato compacto), só para os órgãos pedidos.
// Cada linha aparece duas vezes no PDF (na entidade e no consolidado): a chave
// órgão+ficha remove a repetição.
export function extrairQddCompacto(texto: string, orgaos: Set<string>): Linha[] {
  const porChave = new Map<string, Linha>();
  const paginas = texto.split("\f");
  let orgNome = new Map<string, string>();
  let unidNome = new Map<string, string>();
  paginas.forEach((pagina, i) => {
    let orgaoAtual: string | null = null;
    for (const bruta of pagina.split("\n")) {
      const linha = bruta.replace(/\s+$/, "");
      let m = RE_COMPACTA_ORGAO.exec(linha);
      if (m) {
        orgaoAtual = m[1];
        orgNome.set(m[1], maiusculas(m[2]));
        continue;
      }
      m = RE_COMPACTA_UNIDADE.exec(linha);
      if (m && orgaoAtual) {
        unidNome.set(`${orgaoAtual}.${m[1].slice(1)}`, maiusculas(m[2]));
        continue;
      }
      m = RE_COMPACTA.exec(linha);
      if (!m) continue;
      const [, ficha, org, unid, funcao, subf, prog, tipoAcao, numAcao, , gnd, mod, elem, fonte, aplicacao, nome, valor] = m;
      if (!orgaos.has(org)) continue;
      const chave = `${org}|${ficha}`;
      if (porChave.has(chave)) continue;
      const uo = `${org}.${unid}`;
      porChave.set(chave, {
        ficha,
        nome: maiusculas(nome),
        actionCode: `${tipoAcao}${numAcao}`,
        uo,
        unitId: `${org}:${Number(unid)}`,
        orgName: orgNome.get(org) ?? `ÓRGÃO ${org}`,
        unitName: unidNome.get(uo) ?? `UNIDADE ${uo}`,
        funcao,
        subf,
        subfn: "",
        prog,
        programName: "",
        gnd,
        mod,
        elem,
        sourceCode: fonte,
        applicationCode: aplicacao,
        autorizado: numero(valor),
        pagina: i + 1,
        inferida: false,
        origem: "qdd-consolidado",
      });
    }
  });
  orgNome = new Map();
  unidNome = new Map();
  return [...porChave.values()];
}

// Totais por órgão do Anexo 2 ("Natureza da Despesa por Órgão").
function totaisPorOrgaoDosAnexos(texto: string): Map<string, number> {
  const totais = new Map<string, number>();
  let orgaoAtual: string | null = null;
  for (const linha of texto.split("\n")) {
    const o = /^\s*Órgão[.\s]*:?\s*(\d{2})\s+\S/.exec(linha);
    if (o) orgaoAtual = o[1];
    const t = /Total do Órgão\s*:\s*([\d.]+,\d{2})/.exec(linha);
    if (t && orgaoAtual) totais.set(orgaoAtual, numero(t[1]));
  }
  return totais;
}

// Completa nomes de subfunção e programa: primeiro pelo que outras linhas do
// mesmo código trazem, depois pelo arquivo anterior, por fim um rótulo neutro.
function completarNomes(linhas: Linha[], anterior: Linha[]) {
  const nomeSubf = new Map<string, string>();
  const nomeProg = new Map<string, string>();
  const cadastro = (JSON.parse(readFileSync(UNIDADES, "utf8")) as { names: Record<string, string> }).names;
  const nomeUnid = new Map<string, string>(
    Object.entries(cadastro).map(([uo, nome]) => [uo, maiusculas(nome.split(" — ").pop() ?? nome)])
  );
  for (const l of [...linhas, ...anterior]) {
    if (l.subfn && !/^Subfunção /.test(l.subfn)) {
      if (!nomeSubf.has(`${l.funcao}.${l.subf}`)) nomeSubf.set(`${l.funcao}.${l.subf}`, l.subfn);
      // A subfunção tem o mesmo nome em qualquer função (Portaria MOG 42/1999).
      if (!nomeSubf.has(l.subf)) nomeSubf.set(l.subf, l.subfn);
    }
    if (l.programName && !nomeProg.has(l.prog)) nomeProg.set(l.prog, l.programName);
    if (l.unitName && !/^UNIDADE /.test(l.unitName) && !nomeUnid.has(l.uo)) nomeUnid.set(l.uo, l.unitName);
  }
  for (const l of linhas) {
    if (!l.subfn) l.subfn = nomeSubf.get(`${l.funcao}.${l.subf}`) ?? nomeSubf.get(l.subf) ?? `Subfunção ${l.subf}`;
    if (!l.programName) l.programName = nomeProg.get(l.prog) ?? `Programa ${l.prog}`;
    if (/^UNIDADE /.test(l.unitName)) l.unitName = nomeUnid.get(l.uo) ?? l.unitName;
  }
}

function main() {
  const [entrada, ...resto] = process.argv.slice(2);
  const anexos = resto[0] === "--anexos" ? resto[1] : null;
  if (!entrada || !anexos) {
    console.error('Uso: npx tsx prisma/extrair-qdd.ts "<QDD.pdf|.txt>" --anexos "<Anexos.pdf|.txt>"');
    process.exit(1);
  }

  const anterior = existsSync(SAIDA) ? (JSON.parse(readFileSync(SAIDA, "utf8")) as { dotacoes: Linha[] }).dotacoes : [];
  const textoAnexos = textoDe(anexos);
  const { linhas: prefeitura, problemas } = extrairQddPrefeitura(textoDe(entrada));
  const orgaosPrefeitura = new Set(prefeitura.map((l) => l.uo.split(".")[0]));
  const oficiais = totaisPorOrgaoDosAnexos(textoAnexos);
  const outrosOrgaos = new Set([...oficiais.keys()].filter((o) => !orgaosPrefeitura.has(o)));
  const outras = extrairQddCompacto(textoAnexos, outrosOrgaos);
  const linhas = [...prefeitura, ...outras];
  completarNomes(linhas, anterior);

  const somaPrefeitura = prefeitura.reduce((s, l) => s + l.autorizado, 0);
  const chaves = new Map<string, number>();
  for (const l of linhas) {
    const k = `${l.uo.split(".")[0]}|${l.ficha}`;
    chaves.set(k, (chaves.get(k) ?? 0) + 1);
  }
  const repetidas = [...chaves].filter(([, n]) => n > 1).map(([f]) => f);

  console.log(
    `Prefeitura: ${prefeitura.length} fichas · R$ ${somaPrefeitura.toFixed(2)} (Anexo 1: R$ ${TOTAL_PREFEITURA.toFixed(2)})` +
      `\nDemais entidades (${[...outrosOrgaos].sort().join(", ")}): ${outras.length} fichas`
  );
  if (problemas.length) console.log(`problemas (${problemas.length}):\n  ${problemas.join("\n  ")}`);
  if (repetidas.length) console.log(`fichas repetidas no mesmo órgão: ${repetidas.join(", ")}`);

  const porOrgao = new Map<string, number>();
  for (const l of linhas) porOrgao.set(l.uo.split(".")[0], (porOrgao.get(l.uo.split(".")[0]) ?? 0) + l.autorizado);
  let divergencias = 0;
  for (const [org, v] of [...porOrgao].sort()) {
    const of = oficiais.get(org);
    const ok = of != null && centavos(of) === centavos(v);
    if (!ok) divergencias++;
    console.log(`  órgão ${org}: R$ ${v.toFixed(2)}${of == null ? " (sem total no Anexo 2)" : ok ? " ✓" : ` ≠ Anexo 2 R$ ${of.toFixed(2)}`}`);
  }

  const unidades = JSON.parse(readFileSync(UNIDADES, "utf8")) as { names: Record<string, string> };
  const semNome = [...new Set(linhas.map((l) => l.uo))].filter((uo) => !unidades.names[uo]);
  if (semNome.length) console.log(`unidades sem nome em unidades-2026.json: ${semNome.join(", ")}`);

  const fecha =
    centavos(somaPrefeitura) === centavos(TOTAL_PREFEITURA) && !problemas.length && !repetidas.length && divergencias === 0;
  if (!fecha) {
    console.error("\nConciliação NÃO fechou. Nada gravado.");
    process.exit(2);
  }

  const saida = {
    titulo: "LOA 2026 · Lei 6.246/2025 — QDD",
    lei: "Lei 6.246/2025",
    status: "sanctioned-qdd",
    fonte: FONTE_URL,
    fonteAnexos: FONTE_ANEXOS_URL,
    arquivo: `${path.basename(entrada)} + ${path.basename(anexos)}`,
    metodo:
      "pdftotext -layout sobre os PDFs nativos do Portal da Transparência (INTER-TEC), parser em prisma/extrair-qdd.ts. " +
      "Prefeitura pelo QDD por aplicação em programas; Câmara, SAMAE, FEG e Hospital pelo QDD consolidado dos Anexos. " +
      "Conciliado ao centavo com o Anexo 1 (R$ 722.938.503,22 da Prefeitura) e, por órgão, com o Anexo 2.",
    geradoEm: new Date().toISOString().slice(0, 10),
    totalPrefeitura: TOTAL_PREFEITURA,
    dotacoes: linhas,
  };
  writeFileSync(SAIDA, JSON.stringify(saida, null, 1) + "\n");
  console.log(`\nGravado ${path.relative(process.cwd(), SAIDA)} com ${linhas.length} dotações.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
