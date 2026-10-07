// ============================================================================
// Guias de ajuda: balões sobre a tela, um roteiro por módulo.
//
// Cada passo aponta para um elemento marcado com data-guia="<âncora>". Passo
// cuja âncora não está visível para a pessoa (botão que o perfil não tem, aba
// fechada) é pulado; passo sem âncora aparece no centro da tela.
//
// Mudou o conteúdo de um guia de forma que valha mostrar de novo? Suba a
// versão: quem já o viu recebe o guia mais uma vez na próxima visita.
// ============================================================================

export type PassoGuia = {
  // Valor de data-guia do elemento; sem âncora, o balão fica no centro.
  ancora?: string;
  titulo: string;
  texto: string;
};

export type Guia = {
  id: string;
  titulo: string;
  versao: number;
  passos: PassoGuia[];
};

const GUIAS_LISTA: Guia[] = [
  {
    id: "inicio",
    titulo: "Início",
    versao: 1,
    passos: [
      {
        titulo: "Bem-vindo ao Emendas360",
        texto:
          "Este guia mostra, em poucos passos, como a tela inicial está organizada. Você pode fechar a qualquer momento e rever depois em “Ver ajuda”, no menu.",
      },
      {
        ancora: "inicio.primeira-configuracao",
        titulo: "Primeira configuração",
        texto:
          "Aqui estão os passos para deixar o sistema pronto, na ordem, e o que já foi feito. Em cada passo pendente, “Mostrar onde” leva à tela certa e abre o guia dela.",
      },
      {
        ancora: "inicio.destaque",
        titulo: "Sua ação principal",
        texto: "O cartão grande leva à tarefa mais importante do seu perfil, como criar uma emenda ou tramitar as enviadas.",
      },
      {
        ancora: "inicio.resumo",
        titulo: "Resumo do exercício",
        texto: "Os números do ano em exibição. Para quem apresenta emendas, mostra a sua cota: quanto já usou e quanto ainda está disponível.",
      },
      {
        ancora: "inicio.atalhos",
        titulo: "Atalhos",
        texto: "Os outros caminhos do seu perfil. Os números nos cartões mostram o que está esperando por você.",
      },
      {
        ancora: "menu.exercicio",
        titulo: "Exercício em exibição",
        texto: "O ano do orçamento que o sistema está mostrando. Troque aqui para consultar outro exercício.",
      },
      {
        ancora: "menu.ajuda",
        titulo: "Ver ajuda",
        texto: "Em qualquer tela, este botão abre o guia daquela tela.",
      },
      {
        ancora: "menu.conta",
        titulo: "Sua conta",
        texto: "Clique no seu nome para trocar a senha ou para rever todos os guias.",
      },
    ],
  },
];

export const GUIAS: Record<string, Guia> = Object.fromEntries(GUIAS_LISTA.map((g) => [g.id, g]));

// O guia da tela em que a pessoa está. Configurações usa a aba (?aba=).
export function guiaDaRota(pathname: string, aba?: string | null): Guia | null {
  const rotas: [RegExp, string][] = [[/^\/inicio\/?$/, "inicio"]];
  if (pathname.startsWith("/config")) {
    const g = GUIAS[`config.${aba || "exercicio"}`];
    if (g) return g;
  }
  for (const [re, id] of rotas) if (re.test(pathname) && GUIAS[id]) return GUIAS[id];
  return null;
}

// O guia deve abrir sozinho? Só se a pessoa nunca o viu nesta versão.
export function deveAbrirSozinho(guia: Guia, vistos: Record<string, number>): boolean {
  const visto = vistos[guia.id];
  return visto === undefined || visto < guia.versao;
}
