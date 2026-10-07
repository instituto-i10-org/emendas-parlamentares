// Proteção dos catálogos editados pela tela.
//
// Áreas, tipos de destino e objetos da biblioteca nasceram dos arquivos de
// prisma/dados/<município>/, mas desde a etapa de configuração pela tela o
// administrador pode criá-los, editá-los, reordená-los e excluí-los. Os scripts
// que regravam os catálogos a partir do arquivo (seed e recarregar-catalogos)
// não podem desfazer isso em silêncio: o que tem registro de auditoria feito
// por uma pessoa fica como está, salvo pedido explícito (SOBRESCREVER_EDICOES=1).
//
// Banco novo (sem auditoria) não tem nada protegido: o arquivo vale inteiro.

export type RegistroAuditoria = {
  entidade: string;
  entidadeId: string;
  acao: string;
  dadosAntes: unknown;
};

export type AtuaisCatalogo = {
  areas: { id: string; nome: string }[];
  tipos: { id: string; nome: string }[];
  objetos: { id: string; rotulo: string }[];
};

export type Protecao = {
  // Nomes (atuais e antigos) que o arquivo não pode regravar nem recriar.
  areas: Set<string>;
  tipos: Set<string>;
  objetos: Set<string>;
  // Alguém mudou a ordem pela tela: o arquivo não regrava a ordem de nenhum.
  ordemAreas: boolean;
  ordemTipos: boolean;
};

export const protecaoVazia = (): Protecao => ({
  areas: new Set(),
  tipos: new Set(),
  objetos: new Set(),
  ordemAreas: false,
  ordemTipos: false,
});

const campo = (dados: unknown, nome: string): string | null => {
  if (!dados || typeof dados !== "object") return null;
  const v = (dados as Record<string, unknown>)[nome];
  return typeof v === "string" && v ? v : null;
};

// Monta a proteção a partir dos registros de auditoria FEITOS POR UMA PESSOA
// (o chamador filtra usuarioId não nulo) e do estado atual do banco.
export function protecaoDosCatalogos(logs: RegistroAuditoria[], atuais: AtuaisCatalogo): Protecao {
  const p = protecaoVazia();
  const porId = {
    AreaAplicacao: new Map(atuais.areas.map((a) => [a.id, a.nome])),
    TipoDestino: new Map(atuais.tipos.map((t) => [t.id, t.nome])),
    ObjetoBiblioteca: new Map(atuais.objetos.map((o) => [o.id, o.rotulo])),
  };
  for (const l of logs) {
    if (l.entidade === "AreaAplicacao") {
      if (l.acao === "REORDENAR") {
        p.ordemAreas = true;
        continue;
      }
      const atual = porId.AreaAplicacao.get(l.entidadeId);
      if (atual) p.areas.add(atual);
      // Renomeada ou excluída: o nome antigo também não volta pelo arquivo.
      const antigo = campo(l.dadosAntes, "nome");
      if (antigo) p.areas.add(antigo);
    } else if (l.entidade === "TipoDestino") {
      if (l.acao === "REORDENAR") {
        p.ordemTipos = true;
        continue;
      }
      const atual = porId.TipoDestino.get(l.entidadeId);
      if (atual) p.tipos.add(atual);
      const antigo = campo(l.dadosAntes, "nome");
      if (antigo) p.tipos.add(antigo);
    } else if (l.entidade === "ObjetoBiblioteca") {
      const atual = porId.ObjetoBiblioteca.get(l.entidadeId);
      if (atual) p.objetos.add(atual);
      const antigo = campo(l.dadosAntes, "rotulo");
      if (antigo) p.objetos.add(antigo);
    }
  }
  return p;
}

export const totalProtegido = (p: Protecao) => p.areas.size + p.tipos.size + p.objetos.size;

// Texto para os scripts: o que foi editado pela tela.
export function descreverProtecao(p: Protecao): string[] {
  const linhas: string[] = [];
  if (p.areas.size) linhas.push(`  áreas: ${[...p.areas].join(", ")}`);
  if (p.tipos.size) linhas.push(`  tipos de destino: ${[...p.tipos].join(", ")}`);
  if (p.objetos.size) linhas.push(`  objetos da biblioteca: ${[...p.objetos].join(", ")}`);
  if (p.ordemAreas) linhas.push("  ordem das áreas (reordenada pela tela)");
  if (p.ordemTipos) linhas.push("  ordem dos tipos de destino (reordenada pela tela)");
  return linhas;
}
