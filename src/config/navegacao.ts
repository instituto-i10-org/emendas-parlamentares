import { Poder } from "@/generated/prisma/enums";
import { podeAcessar, type Ator, type Permissao } from "@/lib/authz";

// ============================================================================
// Mapa de navegação — fonte única do menu lateral. Um item aparece quando o
// Poder do perfil alcança o do item e o perfil tem ao menos uma das permissões
// exigidas (sem permissões = item de consulta do seu Poder). Tela de ação só
// aparece para quem executa a ação.
// ============================================================================

export type Icone =
  | "inicio"
  | "pasta"
  | "nova"
  | "lista"
  | "tramitacao"
  | "painel"
  | "planejamento"
  | "execucao"
  | "viabilidade"
  | "conformidade"
  | "config";

export type ItemNav = {
  id: string;
  titulo: string;
  href: string;
  icone: Icone;
  poder: Poder | "TRANSVERSAL";
  permissoes?: Permissao[];
  // Casa também subcaminhos (/emendas/123).
  prefixo?: boolean;
  // Só para quem apresenta emendas (permissão + vínculo a um vereador).
  soQuemApresenta?: boolean;
};

export type GrupoNav = { titulo: string; itens: ItemNav[] };

export const NAVEGACAO: GrupoNav[] = [
  {
    titulo: "Acompanhar",
    itens: [
      { id: "inicio", titulo: "Início", href: "/inicio", icone: "inicio", poder: "TRANSVERSAL" },
      { id: "painel", titulo: "Resumo consolidado", href: "/painel", icone: "painel", poder: "TRANSVERSAL" },
      { id: "tramitacao", titulo: "Tramitação", href: "/tramitacao", icone: "tramitacao", poder: Poder.LEGISLATIVO, permissoes: ["tramitarEmendas", "consultarTudo"] },
    ],
  },
  {
    titulo: "Operar",
    itens: [
      { id: "emendas", titulo: "Emendas", href: "/emendas", icone: "pasta", poder: "TRANSVERSAL", prefixo: true },
      {
        id: "nova",
        titulo: "Nova emenda",
        href: "/emendas/nova",
        icone: "nova",
        poder: Poder.LEGISLATIVO,
        permissoes: ["apresentarEmendas"],
        soQuemApresenta: true,
      },
      { id: "vereador360", titulo: "Vereador 360", href: "/vereador360", icone: "lista", poder: Poder.LEGISLATIVO },
    ],
  },
  {
    titulo: "Executivo",
    itens: [
      { id: "viabilidade", titulo: "Viabilidade técnica", href: "/executivo/viabilidade", icone: "viabilidade", poder: Poder.EXECUTIVO, permissoes: ["analisarViabilidade", "consultarTudo"] },
      { id: "execucao", titulo: "Execução", href: "/executivo/execucao", icone: "execucao", poder: Poder.EXECUTIVO, permissoes: ["registrarExecucao", "consultarTudo"] },
      { id: "planejamento", titulo: "Planejamento", href: "/executivo/planejamento", icone: "planejamento", poder: Poder.EXECUTIVO, permissoes: ["gerirPlanejamento", "consultarTudo"], prefixo: true },
    ],
  },
  {
    titulo: "Governança",
    itens: [
      { id: "conformidade", titulo: "Conformidade", href: "/conformidade", icone: "conformidade", poder: "TRANSVERSAL" },
      {
        id: "config",
        titulo: "Configurações",
        href: "/config",
        icone: "config",
        poder: "TRANSVERSAL",
        permissoes: ["administrarConfiguracoes"],
        prefixo: true,
      },
    ],
  },
];

export function navegacaoVisivel(ator: Ator, { apresenta }: { apresenta: boolean }): GrupoNav[] {
  return NAVEGACAO.map((g) => ({
    ...g,
    itens: g.itens.filter((i) => podeAcessar(ator, { poder: i.poder, permissoes: i.permissoes }) && (!i.soQuemApresenta || apresenta)),
  })).filter((g) => g.itens.length);
}
