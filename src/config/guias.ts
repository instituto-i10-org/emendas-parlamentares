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

  // ------------------------------------------------------------ acompanhar
  {
    id: "painel",
    titulo: "Resumo consolidado",
    versao: 1,
    passos: [
      { ancora: "painel.titulo", titulo: "Resumo consolidado", texto: "O retrato das emendas do exercício, calculado a cada vez que a tela abre. Nada aqui é digitado: tudo vem das emendas registradas." },
      { ancora: "painel.teto", titulo: "Teto e parcelas", texto: "O teto global é a cota de cada vereador vezes o número de vereadores. Ao lado, quanto já foi consumido e quanto foi para a saúde e para as demais áreas." },
      { ancora: "painel.apresentado", titulo: "Apresentado, acatado e incorporado", texto: "Apresentado é o que foi enviado à Câmara; acatado, o que a Comissão aprovou; incorporado, o que foi marcado como parte da lei aprovada." },
      { ancora: "painel.areas", titulo: "Por área", texto: "As emendas enviadas, agrupadas pela área da secretaria da dotação (Saúde, Educação…), com o apresentado e o acatado de cada uma." },
      { ancora: "painel.cota", titulo: "Cota por vereador", texto: "Quanto cada vereador já comprometeu da própria cota. Clique no nome para abrir a visão completa dele no Vereador 360." },
      { ancora: "painel.situacao", titulo: "Situação das emendas", texto: "Quantas emendas estão em cada situação e quanto somam." },
      { ancora: "painel.acoes", titulo: "Imprimir", texto: "Gera uma versão para impressão ou PDF desta tela." },
    ],
  },
  {
    id: "comparativo",
    titulo: "Projeto × lei",
    versao: 1,
    passos: [
      { ancora: "comparativo.titulo", titulo: "Projeto × lei", texto: "Compara, dotação por dotação, o projeto de lei do orçamento com a lei aprovada e mostra quais emendas explicam cada diferença." },
      { ancora: "comparativo.visoes", titulo: "Duas visões", texto: "“Comparativo por dotação” mostra projeto, lei e diferença. “Execução das dotações emendadas” soma o que já foi empenhado, liquidado e pago nas dotações que receberam emendas." },
      { ancora: "comparativo.totais", titulo: "Totais", texto: "O total do projeto, o da lei e a diferença. A lei fica maior que o projeto pelo valor das emendas incorporadas." },
      { ancora: "comparativo.filtros", titulo: "Filtros", texto: "Filtre por órgão ou unidade, ou marque “Só as que mudaram ou têm emenda” para ver apenas o que interessa." },
      { ancora: "comparativo.dotacoes", titulo: "Dotações", texto: "Cada linha é uma dotação. As emendas incorporadas aparecem com o número e levam à página da emenda." },
      { ancora: "comparativo.execucao", titulo: "Execução", texto: "Por dotação emendada: o valor aprovado e o que o Executivo já lançou de empenho, liquidação e pagamento." },
      { ancora: "comparativo.acoes", titulo: "Exportar e gerar a lei", texto: "Baixe a comparação em XLSX ou CSV, ou imprima. Quando a lei ainda não tem base, quem gere o planejamento pode gerá-la a partir do projeto e das emendas incorporadas." },
    ],
  },
  {
    id: "tramitacao",
    titulo: "Tramitação",
    versao: 1,
    passos: [
      { ancora: "tramitacao.titulo", titulo: "Tramitação", texto: "Onde a Comissão analisa as emendas enviadas: recebe, pede ajuste ou decide, sempre com o parecer por escrito." },
      { ancora: "tramitacao.totais", titulo: "Números da fila", texto: "Quantas emendas aguardam parecer, quantas estão em saneamento e quantas já foram aprovadas ou rejeitadas." },
      { ancora: "tramitacao.abas", titulo: "As filas", texto: "Parecer: aguardando análise. Saneamento: devolvidas para ajuste. Decididas: aprovadas e rejeitadas. Lei aprovada: marcar as que entraram na lei. Por programa e Relatórios: os resumos." },
      { ancora: "tramitacao.filtros", titulo: "Filtros", texto: "Busque por número, objeto, beneficiário ou autor e filtre por situação, autor, área e período." },
      { ancora: "tramitacao.decidir", titulo: "Receber, pedir ajuste ou decidir", texto: "Receber marca que a Comissão começou a análise (pede confirmação). Pedir ajuste devolve ao autor com prazo. Decidir aprova ou rejeita, com parecer de pelo menos 20 caracteres." },
      { ancora: "tramitacao.sanear", titulo: "Saneamento", texto: "Aqui ficam as emendas em ajuste, com o motivo e o prazo, e as inválidas, com as verificações que falharam. A inválida pode ser devolvida ao autor com o apontamento." },
      { ancora: "tramitacao.reabrir", titulo: "Reabrir", texto: "Uma emenda decidida pode ser reaberta com motivo. O histórico guarda os dois pareceres." },
      { ancora: "tramitacao.incorporar", titulo: "Incorporada à lei", texto: "Marque as emendas aprovadas que entraram no texto da lei. Fica registrado quem marcou e quando, e é possível desfazer." },
      { ancora: "tramitacao.periodo", titulo: "Período do relatório", texto: "Escolha as datas para ver as movimentações por situação e por autor." },
      { ancora: "tramitacao.relatorios", titulo: "Relatórios", texto: "Os totais do período, com exportação em XLSX, CSV e impressão." },
      { ancora: "tramitacao.programas", titulo: "Por programa", texto: "As emendas agrupadas pelo programa do orçamento, com o total e o valor aprovado de cada um." },
      { ancora: "tramitacao.acoes", titulo: "Exportar", texto: "Baixa a lista em XLSX ou CSV, respeitando os filtros escolhidos." },
    ],
  },
  // ------------------------------------------------------------ operar
  {
    id: "emendas",
    titulo: "Emendas",
    versao: 1,
    passos: [
      { ancora: "emendas.titulo", titulo: "Emendas", texto: "A lista das emendas do exercício. O vereador vê as próprias; a Comissão e quem acompanha veem todas." },
      { ancora: "indicador.emendamento", titulo: "Emendamento aberto ou fechado", texto: "Diz se é possível enviar emendas agora e por quê: situação do projeto de lei, prazo de protocolo ou exercício encerrado." },
      { ancora: "emendas.acoes", titulo: "Nova emenda", texto: "Começa uma emenda nova, em três etapas: descrever, plano de trabalho e validação." },
      { ancora: "emendas.filtros", titulo: "Filtros", texto: "Busque e filtre por situação, autor, área e período. Os filtros ficam no endereço da página, então dá para guardar ou compartilhar a busca." },
      { ancora: "emendas.exportar", titulo: "Exportar", texto: "Baixa exatamente as emendas filtradas, em XLSX ou CSV, com acentos e códigos preservados." },
      { ancora: "emendas.lista", titulo: "A lista", texto: "Clique no objeto para abrir a emenda. Rascunhos podem ser descartados pela lixeira." },
    ],
  },
  {
    id: "emenda",
    titulo: "Emenda",
    versao: 2,
    passos: [
      { ancora: "emenda.dados", titulo: "Dados da emenda", texto: "Situação, autor, destino, dotação, parcela da cota, valor e justificativa. Abaixo aparecem os pedidos de ajuste, o parecer da Comissão, a viabilidade do Executivo e a execução, quando houver." },
      { ancora: "emenda.relatorio", titulo: "Aba Validação", texto: "As treze verificações conferidas pelo servidor no envio, uma por linha com o resultado. Clique numa linha para ver a explicação; as com alerta ou falha já vêm abertas." },
      { ancora: "emenda.validacoes", titulo: "Aba Validações anteriores", texto: "Todas as vezes que a emenda foi conferida: envio, reenvio e tentativas recusadas, com data e quem pediu." },
      { ancora: "emenda.situacoes", titulo: "Aba Situações", texto: "Cada mudança de situação, com data, responsável e o texto do parecer ou do pedido de ajuste." },
      { ancora: "emenda.acoes", titulo: "Impressão", texto: "“Versão para impressão” abre a emenda inteira, com plano de trabalho, tramitação e validação, pronta para PDF." },
    ],
  },
  {
    id: "vereador360",
    titulo: "Vereador 360",
    versao: 1,
    passos: [
      { ancora: "vereador360.titulo", titulo: "Vereador 360", texto: "A cota individual de um vereador e cada emenda que a consome." },
      { ancora: "vereador360.lista", titulo: "Escolher o vereador", texto: "Para quem acompanha todos: busque e escolha o vereador. A barra mostra quanto da cota já foi usado." },
      { ancora: "vereador360.vereador", titulo: "Situação da cota", texto: "O nome, o partido e se a cota está dentro do limite." },
      { ancora: "vereador360.cota", titulo: "Cota, comprometido e saldo", texto: "Quanto o vereador pode indicar, quanto já comprometeu, o saldo e a divisão entre saúde e demais áreas." },
      { ancora: "vereador360.emendas", titulo: "Emendas", texto: "Cada emenda do vereador no sistema, com parcela, situação e valor. Clique para abrir." },
    ],
  },
  // ------------------------------------------------------------ executivo
  {
    id: "viabilidade",
    titulo: "Viabilidade técnica",
    versao: 1,
    passos: [
      { ancora: "viabilidade.titulo", titulo: "Viabilidade técnica", texto: "O Executivo se manifesta sobre as emendas enviadas. O parecer é informativo: não altera a emenda nem trava a tramitação." },
      { ancora: "viabilidade.totais", titulo: "Números", texto: "Quantas emendas foram enviadas, quantas ainda estão sem parecer e quantas foram consideradas inviáveis." },
      { ancora: "viabilidade.filtros", titulo: "Busca e filtro", texto: "Busque pela emenda e filtre entre as que têm e as que ainda não têm parecer." },
      { ancora: "viabilidade.acao", titulo: "Manifestar-se", texto: "Registre o resultado e a justificativa. Um parecer novo não apaga o anterior: o histórico fica na emenda." },
    ],
  },
  {
    id: "execucao",
    titulo: "Execução",
    versao: 1,
    passos: [
      { ancora: "execucao.titulo", titulo: "Execução das emendas", texto: "O acompanhamento de empenho, liquidação e pagamento de cada emenda aprovada." },
      { ancora: "execucao.totais", titulo: "Totais", texto: "O valor aprovado e o que já foi empenhado, liquidado e pago." },
      { ancora: "execucao.filtros", titulo: "Busca e filtro", texto: "Busque pela emenda e filtre entre as que têm e as que ainda não têm lançamento." },
      { ancora: "execucao.acao", titulo: "Lançar andamento", texto: "Registre cada etapa com data, valor e documento. Os totais da emenda e do painel se atualizam na hora." },
    ],
  },
  {
    id: "planejamento",
    titulo: "Planejamento",
    versao: 2,
    passos: [
      { ancora: "planejamento.titulo", titulo: "Planejamento", texto: "As leis do orçamento do exercício (PPA, LDO e LOA) e a base de dotações em que as emendas são classificadas." },
      { ancora: "planejamento.acoes", titulo: "Novo instrumento", texto: "Cadastre um projeto de lei ou uma lei aprovada, com número, data, ementa e o PDF da peça. A lei aprovada fica ligada ao projeto de origem." },
      { ancora: "planejamento.abas", titulo: "Seções", texto: "Instrumentos: as leis cadastradas. Base de dotações: as dotações carregadas. PL × lei aprovada: o projeto ao lado da lei aprovada." },
      { ancora: "indicador.emendamento", titulo: "Emendamento", texto: "Mostra se as emendas estão abertas. Depende da situação do projeto de lei, do prazo e do exercício." },
      { ancora: "planejamento.situacao", titulo: "Situação do instrumento", texto: "Em “Mudar situação”, escolha avançar ou voltar um passo. Mudar a situação do projeto de lei pode abrir ou fechar o envio de emendas; o sistema mostra o efeito antes de confirmar." },
      { ancora: "planejamento.acoes-instrumento", titulo: "Ações do instrumento", texto: "Ver a base, importar a base (PDF, CSV ou XLSX), editar e excluir. Só é possível excluir um instrumento sem dotações e sem lei ligada a ele." },
      { ancora: "planejamento.importacoes", titulo: "Importações recentes", texto: "As importações em andamento ou concluídas. Clique para continuar uma conferência ou retomar uma leitura de PDF." },
      { ancora: "planejamento.base", titulo: "Base de dotações", texto: "O total da base, quantas dotações podem receber emendas e quantas já receberam." },
      { ancora: "planejamento.comparacao", titulo: "Comparação", texto: "Para cada lei aprovada, o total do projeto de origem, o total da lei e as emendas aprovadas." },
    ],
  },
  {
    id: "importacao",
    titulo: "Conferência da importação",
    versao: 1,
    passos: [
      { ancora: "importacao.titulo", titulo: "Conferência da importação", texto: "Nada vai para a base antes da sua confirmação. Aqui você confere o que foi lido." },
      { ancora: "importacao.situacao", titulo: "Situação", texto: "Em que ponto a importação está: lendo, aguardando conferência, gravada ou cancelada." },
      { ancora: "importacao.leitura", titulo: "Leitura do PDF", texto: "O PDF é lido página por página. Pode sair da tela: ao voltar, a leitura continua de onde parou. Se parar com erro, use “Retomar leitura”." },
      { ancora: "importacao.mapa", titulo: "Colunas da planilha", texto: "Quando a planilha usa nomes de coluna diferentes, indique qual coluna corresponde a cada campo." },
      { ancora: "importacao.totais", titulo: "Linhas e totais", texto: "Quantas linhas são válidas, quantas foram recusadas e o total lido." },
      { ancora: "importacao.conferencia", titulo: "Conferência com a peça", texto: "Informe o total impresso na lei. A carga só é liberada quando o total lido bate com ele ao centavo." },
      { ancora: "importacao.confirmar", titulo: "Confirmar carga", texto: "Grava a base conferida. Também é possível cancelar a importação sem gravar nada." },
      { ancora: "importacao.linhas", titulo: "Linhas lidas", texto: "Cada linha com o número e, se recusada, o motivo. Corrija ou inclua linhas aqui mesmo." },
      { ancora: "importacao.filtro", titulo: "Filtro", texto: "Veja só as recusadas, só as com aviso, ou todas." },
      { ancora: "importacao.relatorio", titulo: "Relatório de recusas", texto: "Baixa em CSV todas as linhas recusadas e com aviso, com o motivo de cada uma." },
    ],
  },
  // ------------------------------------------------------------ governança
  {
    id: "conformidade",
    titulo: "Conformidade",
    versao: 1,
    passos: [
      { ancora: "conformidade.titulo", titulo: "Conformidade", texto: "O espelho da fiscalização das emendas impositivas. Cada item é conferido nos dados do sistema, não é marcado à mão." },
      { ancora: "conformidade.totais", titulo: "Resumo", texto: "Quantos itens estão conformes, em atenção ou pendentes." },
      { ancora: "conformidade.requisitos", titulo: "Requisitos", texto: "Lei Orgânica vigente, Regimento, manual publicado, portal funcionando, autor identificado e limites conferidos. O “?” ao lado de cada item mostra o fundamento." },
      { ancora: "conformidade.resolver", titulo: "Resolver", texto: "Em cada pendência, a providência recomendada e o atalho para a tela onde resolvê-la." },
      { ancora: "conformidade.outros", titulo: "Outros itens", texto: "Rastreabilidade do destino, classificação, cota, preços, viabilidade e execução." },
      { ancora: "conformidade.prazos", titulo: "Próximos prazos", texto: "Os prazos cadastrados para o exercício." },
    ],
  },
  // ------------------------------------------------------------ configurações
  {
    id: "config.municipio",
    titulo: "Configurações › Município",
    versao: 2,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.municipio.dados", titulo: "Dados do município", texto: "Nome, UF e código do IBGE identificam o município. Aparecem no portal público, na entrada do sistema e nos documentos impressos." },
      { ancora: "config.municipio.nomes", titulo: "Câmara e Prefeitura", texto: "O nome oficial de cada Poder, usado nos títulos do portal e nos documentos." },
      { ancora: "config.municipio.salvar", titulo: "Salvar", texto: "Só o Administrador Geral altera estes dados. “Desfazer” volta ao que está gravado." },
    ],
  },
  {
    id: "config.exercicio",
    titulo: "Configurações › Exercício e parâmetros",
    versao: 1,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria." },
      { ancora: "config.exercicio.lista", titulo: "Exercícios", texto: "Os anos do orçamento. Crie o exercício novo aqui. Encerrar um exercício fecha o envio de emendas dele; reabrir desfaz." },
      { ancora: "config.exercicio.parametros", titulo: "Parâmetros", texto: "Cota de cada vereador, percentual da saúde, prazo de protocolo, situações do projeto que recebem emendas e códigos AUDESP. Se a mudança afetar emendas já enviadas, o sistema mostra quantas antes de salvar." },
      { ancora: "config.exercicio.prazos", titulo: "Prazos", texto: "Datas do calendário das emendas, que aparecem no manual e na conformidade." },
      { ancora: "config.exercicio.historico", titulo: "Emendas de anos anteriores", texto: "Importe por planilha as emendas apresentadas fora do sistema. Você confere antes de gravar; elas aparecem no portal e nos painéis." },
    ],
  },
  {
    id: "config.validacao",
    titulo: "Configurações › Validação",
    versao: 2,
    passos: [
      { ancora: "config.validacao.treze", titulo: "As treze verificações", texto: "Todas as emendas passam por estas treze conferências antes do envio. A mudança vale na próxima validação, sem publicação nova." },
      { ancora: "config.validacao.fixa", titulo: "Verificações fixas", texto: "As marcadas como fixas sempre bloqueiam o envio, porque decorrem da lei. A tela mostra o motivo de cada uma." },
      { ancora: "config.validacao.modo", titulo: "Bloqueia ou só alerta", texto: "Nas demais, escolha se a falha impede o envio (bloqueante) ou só aparece no relatório (só alerta)." },
      { ancora: "config.validacao.fundamento", titulo: "Fundamento", texto: "O fundamento legal escrito por extenso. Aparece no relatório da emenda e no manual público." },
      { ancora: "config.validacao.norma", titulo: "Norma citada", texto: "A norma da Base legal em que o fundamento se apoia. Cadastre a norma antes, na aba Base legal." },
      { ancora: "config.validacao.salvar", titulo: "Salvar as regras", texto: "Antes de gravar, o sistema mostra quantas emendas já enviadas mudariam de resultado. Se houver alguma, é preciso marcar que está ciente." },
      { ancora: "config.validacao.fundamentos", titulo: "Fundamento dos parâmetros", texto: "Cota, percentual da saúde, prazos e demais parâmetros do exercício também levam fundamento. Parâmetro definido sem fundamento não é aceito." },
    ],
  },
  {
    id: "config.portal",
    titulo: "Configurações › Portal e manual",
    versao: 2,
    passos: [
      { ancora: "config.portal.portal", titulo: "Portal público", texto: "A consulta pública às emendas, sem login. Mostra se está ligado ou desligado." },
      { ancora: "config.portal.ligar", titulo: "Ligar ou desligar", texto: "Desligado, o portal avisa que está indisponível e a Conformidade aponta a pendência. O link de preenchimento das entidades continua funcionando." },
      { ancora: "config.portal.ato", titulo: "Ato que institui o manual", texto: "Escolha a norma que institui o manual orientativo. Ela precisa estar cadastrada na aba Base legal." },
      { ancora: "config.portal.publicar", titulo: "Publicar", texto: "Publica o manual com o ato escolhido. Depois de publicado, dá para trocar o ato ou retirar a publicação." },
      { ancora: "config.portal.ver", titulo: "Ver o manual", texto: "O manual lê os valores do próprio sistema (cota, prazos, verificações), então nunca fica diferente da regra aplicada." },
    ],
  },
  {
    id: "config.usuarios",
    titulo: "Configurações › Usuários",
    versao: 2,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.usuarios.novo", titulo: "Novo usuário", texto: "Cadastre quem vai acessar: nome, e-mail, perfil e uma senha temporária. No primeiro acesso, a pessoa confere os dados e troca a senha." },
      { ancora: "config.usuarios.poder", titulo: "Poder", texto: "Legislativo, Executivo ou ambos (transversal). Vem do perfil e define quais telas a pessoa enxerga." },
      { ancora: "config.usuarios.perfil", titulo: "Perfil", texto: "Troque o perfil aqui. A mudança vale no próximo clique da pessoa, sem precisar sair do sistema." },
      { ancora: "config.usuarios.autor", titulo: "Autor", texto: "Liga a conta ao vereador autor das emendas. Só quem está ligado a um vereador apresenta emendas." },
      { ancora: "config.usuarios.senha", titulo: "Senha", texto: "Defina uma senha nova quando alguém esquecer a sua. A senha nunca aparece na auditoria." },
      { ancora: "config.usuarios.ativo", titulo: "Desativar ou reativar", texto: "Quem é desativado não entra mais, mas o histórico dele continua. Você não consegue desativar a própria conta." },
    ],
  },
  {
    id: "config.perfis",
    titulo: "Configurações › Perfis",
    versao: 2,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.perfis.lista", titulo: "Perfis de acesso", texto: "Um perfil reúne um Poder e as permissões. Os perfis do sistema já vêm prontos e não podem ser alterados." },
      { ancora: "config.perfis.poder", titulo: "Poder", texto: "Define quais telas o perfil alcança: Legislativo, Executivo ou ambos." },
      { ancora: "config.perfis.permissoes", titulo: "Permissões", texto: "O que o perfil pode fazer: apresentar emendas, tramitar, gerir o planejamento e outras. Sem nenhuma, é um perfil só de consulta." },
      { ancora: "config.perfis.usuarios", titulo: "Usuários", texto: "Quantas pessoas usam o perfil. Um perfil com usuários não pode ser excluído." },
      { ancora: "config.perfis.novo", titulo: "Novo perfil", texto: "Monte um perfil próprio quando nenhum dos prontos servir. As mudanças valem no próximo clique de quem o usa." },
      { ancora: "config.perfis.acoes", titulo: "Editar e excluir", texto: "Disponível só para perfis criados aqui." },
    ],
  },
  {
    id: "config.areas",
    titulo: "Configurações › Áreas",
    versao: 2,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.areas.lista", titulo: "Áreas de aplicação", texto: "Saúde, Educação e as demais. Definem se o objeto cabe no destino, qual parcela da cota a emenda consome e o agrupamento dos painéis." },
      { ancora: "config.areas.orgaos", titulo: "Órgãos", texto: "Os órgãos do orçamento que atendem a área. Mudar os órgãos pode mudar a parcela de emendas já enviadas: o sistema mostra quantas antes de salvar." },
      { ancora: "config.areas.objetos", titulo: "Objetos ligados", texto: "Quantos objetos da biblioteca pertencem à área. Uma área com objetos não pode ser excluída: mude os objetos de área antes." },
      { ancora: "config.areas.acoes", titulo: "Ordem, editar e excluir", texto: "A ordem desempata quando um órgão aparece em mais de uma área. Em Editar, você muda o nome, os órgãos e a unidade padrão." },
      { ancora: "config.areas.nova", titulo: "Nova área", texto: "Crie uma área com nome, órgãos e a unidade que responde por ela quando o destino não tem vínculo fixo." },
    ],
  },
  {
    id: "config.tipos-destino",
    titulo: "Configurações › Tipos de destino",
    versao: 2,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.tipos-destino.teste", titulo: "Testar um nome", texto: "Digite o nome de um destino para ver qual tipo o sistema reconhece e a subfunção que ele sugere." },
      { ancora: "config.tipos-destino.lista", titulo: "Tipos de destino", texto: "UBS, CAPS, EMEF e outros. Ensinam o sistema a sugerir a subfunção certa a partir do nome do destino." },
      { ancora: "config.tipos-destino.regra", titulo: "Palavras que identificam", texto: "As palavras ou siglas que, no nome do destino, indicam o tipo. Alguns tipos usam uma regra avançada, editável à parte." },
      { ancora: "config.tipos-destino.novo", titulo: "Novo tipo", texto: "Cadastre um tipo com as palavras, a subfunção sugerida e as pistas. A ordem da lista decide qual vale quando dois combinam. Mudar um tipo não altera a subfunção já gravada nos destinos existentes; vale para os próximos." },
    ],
  },
  {
    id: "config.destinos",
    titulo: "Configurações › Destinos",
    versao: 1,
    passos: [
      { ancora: "config.destinos.duplicados", titulo: "Possíveis duplicados", texto: "Nomes parecidos ou o mesmo CNPJ. A mesclagem só acontece com a sua confirmação, e as emendas passam para o beneficiário mantido." },
      { ancora: "config.destinos.lista", titulo: "Beneficiários", texto: "Unidades da administração e entidades que podem receber emendas. Cadastre, edite, registre pendência de habilitação ou desative." },
      { ancora: "config.importar-destinos", titulo: "Importar planilha", texto: "Cadastre vários de uma vez. Você confere antes de gravar; quem já existe é atualizado, não duplicado." },
    ],
  },
  {
    id: "config.biblioteca",
    titulo: "Configurações › Biblioteca de objetos",
    versao: 2,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.biblioteca.lista", titulo: "Biblioteca de objetos", texto: "O vocabulário que o sistema reconhece no objeto da emenda: ambulância, reforma, merenda e outros, com as palavras de cada um." },
      { ancora: "config.biblioteca.natureza", titulo: "Natureza da despesa", texto: "Custeio ou capital, o elemento de despesa e a subfunção. É o que leva o sistema à dotação certa." },
      { ancora: "config.biblioteca.area", titulo: "Área", texto: "A área do objeto. Objeto de área estrita (ambulância é Saúde) não cabe num destino de outra área." },
      { ancora: "config.biblioteca.novo", titulo: "Novo objeto", texto: "Cadastre um objeto que o sistema ainda não reconhece, com as palavras, a natureza e a área." },
      { ancora: "config.biblioteca.acoes", titulo: "Editar e desativar", texto: "Desativar faz o sistema deixar de reconhecer o objeto em emendas novas; as já enviadas continuam válidas." },
    ],
  },
  {
    id: "config.precos",
    titulo: "Configurações › Fontes de preço",
    versao: 2,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.precos.lista", titulo: "Fontes oficiais de preço", texto: "Os sites de referência que aparecem no plano de trabalho. O sistema não busca preço: mostra ao autor onde pesquisar." },
      { ancora: "config.precos.aplica", titulo: "Para quais despesas", texto: "Cada fonte aparece para os tipos de despesa marcados; sem marca, aparece sempre. Ao lado, quantas vezes já foi usada." },
      { ancora: "config.precos.nova", titulo: "Nova fonte", texto: "Cadastre o nome, o endereço e a orientação de como pesquisar." },
      { ancora: "config.precos.acoes", titulo: "Editar e desativar", texto: "Desativada, a fonte deixa de aparecer no plano de trabalho; as referências já gravadas continuam." },
    ],
  },
  {
    id: "config.normas",
    titulo: "Configurações › Base legal",
    versao: 2,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.normas.lista", titulo: "Base legal", texto: "Lei Orgânica, Regimento Interno, resoluções e demais atos. São citados no manual e nas verificações, e conferidos na Conformidade." },
      { ancora: "config.normas.nova", titulo: "Nova norma", texto: "Cadastre o tipo, o número, a data do ato, a vigência e o PDF." },
      { ancora: "config.normas.vigencia", titulo: "Vigência", texto: "A data do ato e o período de vigência. A Conformidade exige a Lei Orgânica vigente." },
      { ancora: "config.normas.acoes", titulo: "Arquivo, editar e desativar", texto: "Abra o PDF, edite os dados ou desative. Desativar a Lei Orgânica ou o Regimento faz a Conformidade acusar pendência." },
    ],
  },
  {
    id: "config.auditoria",
    titulo: "Configurações › Auditoria",
    versao: 3,
    passos: [
      { ancora: "config.abas", titulo: "Configurações", texto: "Cada aba cuida de uma parte do sistema. Toda alteração fica registrada na auditoria, com o antes e o depois." },
      { ancora: "config.auditoria.lista", titulo: "Registros", texto: "Cada alteração feita no sistema: quando, quem, em quê e qual ação." },
      { ancora: "config.auditoria.filtros", titulo: "Filtros", texto: "Procure por período, usuário, tipo de registro e ação. A lista filtra sozinha ao escolher." },
      { ancora: "config.auditoria.abrir", titulo: "Abrir", texto: "Mostra, em linguagem simples, só o que mudou: cada campo com o valor de antes e o de depois. Senhas nunca aparecem." },
      { ancora: "config.auditoria.paginacao", titulo: "Páginas", texto: "Os registros aparecem de 50 em 50." },
    ],
  },
  // ------------------------------------------------------------ nova emenda
  {
    id: "nova-emenda.etapa1",
    titulo: "Nova emenda › Descrever",
    versao: 1,
    passos: [
      { ancora: "nova-emenda.etapas", titulo: "Três etapas", texto: "Descrever a emenda, preencher o plano de trabalho e validar. Pode salvar o rascunho a qualquer momento e voltar depois." },
      { ancora: "nova-emenda.execucao", titulo: "Quem executa", texto: "Direta: a Prefeitura contrata e paga. Indireta: o recurso é repassado a uma entidade sem fins lucrativos." },
      { ancora: "nova-emenda.destino", titulo: "Destino e valor", texto: "Escolha para onde vai o recurso e informe uma estimativa do valor. O valor final será a soma dos itens do plano de trabalho." },
      { ancora: "nova-emenda.objeto", titulo: "Objeto", texto: "Descreva em linguagem comum o que será feito ou comprado. “Melhorar texto” sugere uma redação usando só o que você escreveu." },
      { ancora: "nova-emenda.avancar", titulo: "Analisar", texto: "O sistema procura no orçamento a dotação que comporta o objeto. Depois de escolhida, siga para o plano de trabalho." },
      { ancora: "nova-emenda.resumo", titulo: "Resumo e cota", texto: "O que já foi definido e quanto da sua cota está disponível." },
    ],
  },
  {
    id: "nova-emenda.etapa2",
    titulo: "Nova emenda › Plano de trabalho",
    versao: 1,
    passos: [
      { ancora: "nova-emenda.modelo", titulo: "Modelo do plano", texto: "O modelo vem do tipo de despesa escolhido na etapa anterior e define o que o plano precisa ter." },
      { ancora: "nova-emenda.entidade", titulo: "Preenchimento pela entidade", texto: "Na execução indireta, gere um link para a própria entidade preencher o plano, sem precisar de login." },
      { ancora: "nova-emenda.justificativa", titulo: "Justificativa", texto: "Por que a emenda é necessária." },
      { ancora: "nova-emenda.metas", titulo: "Metas", texto: "Quem é beneficiado, a unidade e a quantidade, e a meta finalística." },
      { ancora: "nova-emenda.memoria", titulo: "Memória de cálculo", texto: "Os itens com quantidade e preço, e a fonte oficial de onde veio cada preço. A soma é o valor da emenda." },
      { ancora: "nova-emenda.cronograma", titulo: "Cronograma", texto: "Como o valor será desembolsado. A soma das parcelas tem de bater com o valor da emenda." },
      { ancora: "nova-emenda.rodape", titulo: "Seguir", texto: "Vá para a validação, volte, salve o rascunho ou visualize o plano." },
    ],
  },
  {
    id: "nova-emenda.etapa3",
    titulo: "Nova emenda › Validar e submeter",
    versao: 1,
    passos: [
      { ancora: "nova-emenda.treze", titulo: "As treze verificações", texto: "Cada uma com o resultado (conforme, alerta ou falha) e a explicação. Uma falha impede o envio." },
      { ancora: "nova-emenda.pendencias", titulo: "Pendências", texto: "As conferências do sistema que ainda pedem atenção. Bloqueios impedem o envio; alertas, não." },
      { ancora: "nova-emenda.declaracao", titulo: "Declaração", texto: "Marque a declaração de inexistência de vedação antes de enviar." },
      { ancora: "nova-emenda.submeter", titulo: "Submeter", texto: "Envia a emenda à Câmara. O servidor confere tudo de novo; se recusar, a tentativa fica registrada e você vê o motivo." },
    ],
  },
];

export const GUIAS: Record<string, Guia> = Object.fromEntries(GUIAS_LISTA.map((g) => [g.id, g]));

// O guia da tela em que a pessoa está. Configurações usa a aba (?aba=).
export function guiaDaRota(pathname: string, aba?: string | null): Guia | null {
  const rotas: [RegExp, string][] = [
    [/^\/inicio\/?$/, "inicio"],
    [/^\/painel\/?$/, "painel"],
    [/^\/comparativo\/?$/, "comparativo"],
    [/^\/tramitacao\/?$/, "tramitacao"],
    [/^\/emendas\/?$/, "emendas"],
    [/^\/emendas\/nova\/?$/, "nova-emenda.etapa1"],
    // A página da emenda declara a própria tela (visão ou editor).
    [/^\/emendas\/[^/]+\/?$/, "emenda"],
    [/^\/vereador360\/?$/, "vereador360"],
    [/^\/executivo\/viabilidade\/?$/, "viabilidade"],
    [/^\/executivo\/execucao\/?$/, "execucao"],
    [/^\/executivo\/planejamento\/?$/, "planejamento"],
    [/^\/executivo\/planejamento\/importacao\/[^/]+\/?$/, "importacao"],
    [/^\/conformidade\/?$/, "conformidade"],
  ];
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
