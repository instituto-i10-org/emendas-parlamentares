// Primeira configuração do sistema: os oito passos que deixam um município
// pronto para receber emendas, conferidos nos dados (não em marcação manual).
// Puro: o servidor junta os números e esta função decide o estado de cada um.

export type DadosPrimeiraConfiguracao = {
  municipioNome: string | null;
  // Exercício em exibição; null quando ainda não há nenhum.
  exercicio: {
    ano: number;
    cotaIndividual: boolean;
    percentualSaude: boolean;
    prazoProtocolo: boolean;
    fundamentos: Record<string, { texto?: string } | undefined>;
  } | null;
  // Projeto de lei da LOA com dotações no exercício.
  loaImportada: boolean;
  areasComOrgaos: number;
  destinosAtivos: number;
  usuariosQueApresentam: number;
  usuariosQueTramitam: number;
  portalPublico: boolean;
  manualInstituido: boolean;
  manualPublicado: boolean;
};

export type PassoPrimeiraConfiguracao = {
  id: string;
  titulo: string;
  texto: string;
  ok: boolean;
  // Onde resolver; o guia daquela tela abre ao chegar.
  href: string;
  guia: string;
};

const temTexto = (f: { texto?: string } | undefined) => !!f?.texto?.trim();

export function passosPrimeiraConfiguracao(d: DadosPrimeiraConfiguracao): PassoPrimeiraConfiguracao[] {
  const ex = d.exercicio;
  // Fundamento por extenso de todo parâmetro definido (a mesma regra da aba Validação).
  const fundamentosOk =
    !!ex &&
    (!ex.cotaIndividual || temTexto(ex.fundamentos.cotaIndividual)) &&
    (!ex.percentualSaude || temTexto(ex.fundamentos.percentualSaude)) &&
    (!ex.prazoProtocolo || temTexto(ex.fundamentos.prazoProtocolo)) &&
    temTexto(ex.fundamentos.prazoDiligenciaDias);
  return [
    {
      id: "municipio",
      titulo: "Município",
      texto: "Nome, UF e código IBGE, e os nomes da Câmara e da Prefeitura.",
      ok: !!d.municipioNome?.trim(),
      href: "/config?aba=municipio",
      guia: "config.municipio",
    },
    {
      id: "exercicio",
      titulo: "Exercício e parâmetros",
      texto: "O ano do orçamento, a cota individual e o percentual reservado à saúde.",
      ok: !!ex && ex.cotaIndividual && ex.percentualSaude,
      href: "/config?aba=exercicio",
      guia: "config.exercicio",
    },
    {
      id: "loa",
      titulo: "Orçamento importado",
      texto: "O projeto de lei do orçamento cadastrado, com a base de dotações importada.",
      ok: d.loaImportada,
      href: "/executivo/planejamento",
      guia: "planejamento",
    },
    {
      id: "areas",
      titulo: "Áreas",
      texto: "Saúde, Educação e as demais, com os órgãos do orçamento de cada uma.",
      ok: d.areasComOrgaos > 0,
      href: "/config?aba=areas",
      guia: "config.areas",
    },
    {
      id: "destinos",
      titulo: "Destinos",
      texto: "Escolas, unidades de saúde e entidades que podem receber emendas.",
      ok: d.destinosAtivos > 0,
      href: "/config?aba=destinos",
      guia: "config.destinos",
    },
    {
      id: "usuarios",
      titulo: "Usuários",
      texto: "Ao menos um vereador que apresenta emendas e alguém da Comissão que as tramita.",
      ok: d.usuariosQueApresentam > 0 && d.usuariosQueTramitam > 0,
      href: "/config?aba=usuarios",
      guia: "config.usuarios",
    },
    {
      id: "validacao",
      titulo: "Validação",
      texto: "O fundamento legal de cada parâmetro e o modo de cada verificação.",
      ok: fundamentosOk,
      href: "/config?aba=validacao",
      guia: "config.validacao",
    },
    {
      id: "portal",
      titulo: "Portal e manual",
      texto: "Portal público ligado e o manual orientativo instituído por ato e publicado.",
      ok: d.portalPublico && d.manualInstituido && d.manualPublicado,
      href: "/config?aba=portal",
      guia: "config.portal",
    },
  ];
}
