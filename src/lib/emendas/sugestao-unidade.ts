// Sugestão da secretaria responsável a partir do nome de um destino novo
// ("EMEF Fulano" → Educação). É sugestão, não vínculo: quem cadastra confirma.

const normalizar = (v: string) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const REGRAS: { nome: RegExp; orgao: RegExp; saude?: boolean }[] = [
  { nome: /\b(ubs|usf|esf|posto de saude|unidade basica de saude|saude da familia)\b/, orgao: /\bsaude\b/, saude: true },
  { nome: /\b(farmacia|assistencia farmaceutica)\b/, orgao: /\bsaude\b/, saude: true },
  { nome: /\b(hospital|upa|pronto socorro|pronto atendimento)\b/, orgao: /\b(saude|hospital)\b/, saude: true },
  { nome: /\b(vigilancia sanitaria|vigilancia epidemiologica|vigilancia em saude)\b/, orgao: /\bsaude\b/, saude: true },
  { nome: /\b(cras|creas|assistencia social|centro de referencia de assistencia social)\b/, orgao: /\bassistencia social\b/ },
  { nome: /\b(escolas?|creches?|emei|emef|emeief|emeb|cei|cem|educacao|ensino|feg|fundacao educacional)\b/, orgao: /\b(educacao|fundacao educacional)\b/ },
  { nome: /\b(ginasio|quadra|estadio|centro esportivo|complexo esportivo|esporte|esportes)\b/, orgao: /\besportes?\b/ },
  { nome: /\b(biblioteca|museu|teatro|centro cultural|casa da cultura|cultura)\b/, orgao: /\bcultura\b/ },
];

export function sugerirUnidades(nome: string, unidades: { codigo: string; nome: string }[]): string[] {
  const q = normalizar(nome);
  if (!q) return [];
  const regras = REGRAS.filter((r) => r.nome.test(q));
  if (!regras.some((r) => r.saude) && /\bsaude\b/.test(q)) regras.push({ nome: /./, orgao: /\bsaude\b/ });
  return unidades
    .filter((u) => {
      const rotulo = normalizar(u.nome);
      return (rotulo.length > 8 && ` ${q} `.includes(` ${rotulo} `)) || regras.some((r) => r.orgao.test(rotulo));
    })
    .map((u) => u.codigo);
}
