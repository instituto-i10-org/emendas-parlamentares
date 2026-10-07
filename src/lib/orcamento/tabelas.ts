// Tabelas federais da classificação da despesa: funções e subfunções
// (Portaria MOG 42/1999, com as alterações posteriores) e elementos de despesa
// (Portaria Interministerial STN/SOF 163/2001). Usadas quando a peça não traz
// o nome — o nome oficial vale mais que "Função 12".

export const FUNCOES: Record<string, string> = {
  "01": "Legislativa", "02": "Judiciária", "03": "Essencial à Justiça", "04": "Administração",
  "05": "Defesa Nacional", "06": "Segurança Pública", "07": "Relações Exteriores", "08": "Assistência Social",
  "09": "Previdência Social", "10": "Saúde", "11": "Trabalho", "12": "Educação", "13": "Cultura",
  "14": "Direitos da Cidadania", "15": "Urbanismo", "16": "Habitação", "17": "Saneamento",
  "18": "Gestão Ambiental", "19": "Ciência e Tecnologia", "20": "Agricultura", "21": "Organização Agrária",
  "22": "Indústria", "23": "Comércio e Serviços", "24": "Comunicações", "25": "Energia", "26": "Transporte",
  "27": "Desporto e Lazer", "28": "Encargos Especiais", "99": "Reserva de Contingência",
};

export const SUBFUNCOES: Record<string, string> = {
  "031": "Ação Legislativa", "032": "Controle Externo",
  "061": "Ação Judiciária", "062": "Defesa do Interesse Público no Processo Judiciário",
  "091": "Defesa da Ordem Jurídica", "092": "Representação Judicial e Extrajudicial",
  "121": "Planejamento e Orçamento", "122": "Administração Geral", "123": "Administração Financeira",
  "124": "Controle Interno", "125": "Normatização e Fiscalização", "126": "Tecnologia da Informação",
  "127": "Ordenamento Territorial", "128": "Formação de Recursos Humanos", "129": "Administração de Receitas",
  "130": "Administração de Concessões", "131": "Comunicação Social",
  "151": "Defesa Aérea", "152": "Defesa Naval", "153": "Defesa Terrestre",
  "181": "Policiamento", "182": "Defesa Civil", "183": "Informação e Inteligência",
  "211": "Relações Diplomáticas", "212": "Cooperação Internacional",
  "241": "Assistência ao Idoso", "242": "Assistência ao Portador de Deficiência",
  "243": "Assistência à Criança e ao Adolescente", "244": "Assistência Comunitária",
  "271": "Previdência Básica", "272": "Previdência do Regime Estatutário", "273": "Previdência Complementar",
  "274": "Previdência Especial",
  "301": "Atenção Básica", "302": "Assistência Hospitalar e Ambulatorial", "303": "Suporte Profilático e Terapêutico",
  "304": "Vigilância Sanitária", "305": "Vigilância Epidemiológica", "306": "Alimentação e Nutrição",
  "331": "Proteção e Benefícios ao Trabalhador", "332": "Relações de Trabalho", "333": "Empregabilidade",
  "334": "Fomento ao Trabalho",
  "361": "Ensino Fundamental", "362": "Ensino Médio", "363": "Ensino Profissional", "364": "Ensino Superior",
  "365": "Educação Infantil", "366": "Educação de Jovens e Adultos", "367": "Educação Especial", "368": "Educação Básica",
  "391": "Patrimônio Histórico, Artístico e Arqueológico", "392": "Difusão Cultural",
  "421": "Custódia e Reintegração Social", "422": "Direitos Individuais, Coletivos e Difusos",
  "423": "Assistência aos Povos Indígenas",
  "451": "Infraestrutura Urbana", "452": "Serviços Urbanos", "453": "Transportes Coletivos Urbanos",
  "481": "Habitação Rural", "482": "Habitação Urbana",
  "511": "Saneamento Básico Rural", "512": "Saneamento Básico Urbano",
  "541": "Preservação e Conservação Ambiental", "542": "Controle Ambiental", "543": "Recuperação de Áreas Degradadas",
  "544": "Recursos Hídricos", "545": "Meteorologia",
  "571": "Desenvolvimento Científico", "572": "Desenvolvimento Tecnológico e Engenharia",
  "573": "Difusão do Conhecimento Científico e Tecnológico",
  "601": "Promoção da Produção Vegetal", "602": "Promoção da Produção Animal", "603": "Defesa Sanitária Vegetal",
  "604": "Defesa Sanitária Animal", "605": "Abastecimento", "606": "Extensão Rural", "607": "Irrigação",
  "608": "Promoção da Produção Agropecuária", "609": "Defesa Agropecuária",
  "631": "Reforma Agrária", "632": "Colonização",
  "661": "Promoção Industrial", "662": "Produção Industrial", "663": "Mineração", "664": "Propriedade Industrial",
  "665": "Normalização e Qualidade",
  "691": "Promoção Comercial", "692": "Comercialização", "693": "Comércio Exterior", "694": "Serviços Financeiros",
  "695": "Turismo",
  "721": "Comunicações Postais", "722": "Telecomunicações",
  "751": "Conservação de Energia", "752": "Energia Elétrica", "753": "Combustíveis Minerais", "754": "Biocombustíveis",
  "781": "Transporte Aéreo", "782": "Transporte Rodoviário", "783": "Transporte Ferroviário",
  "784": "Transporte Hidroviário", "785": "Transportes Especiais",
  "811": "Desporto de Rendimento", "812": "Desporto Comunitário", "813": "Lazer",
  "841": "Refinanciamento da Dívida Interna", "842": "Refinanciamento da Dívida Externa",
  "843": "Serviço da Dívida Interna", "844": "Serviço da Dívida Externa", "845": "Outras Transferências",
  "846": "Outros Encargos Especiais", "847": "Transferências para a Educação Básica",
  "999": "Reserva de Contingência",
};

export const ELEMENTOS: Record<string, string> = {
  "01": "Aposentadorias e reformas", "03": "Pensões", "04": "Contratação por tempo determinado",
  "05": "Outros benefícios previdenciários", "07": "Contribuição a entidades fechadas de previdência",
  "08": "Outros benefícios assistenciais do servidor e do militar", "11": "Vencimentos e vantagens fixas — pessoal civil",
  "13": "Obrigações patronais", "14": "Diárias — civil", "16": "Outras despesas variáveis — pessoal civil",
  "18": "Auxílio financeiro a estudantes", "20": "Auxílio financeiro a pesquisadores", "21": "Juros sobre a dívida por contrato",
  "30": "Material de consumo", "31": "Premiações culturais, artísticas, científicas, desportivas e outras",
  "32": "Material, bem ou serviço para distribuição gratuita", "33": "Passagens e despesas com locomoção",
  "34": "Outras despesas de pessoal decorrentes de contratos de terceirização", "35": "Serviços de consultoria",
  "36": "Outros serviços de terceiros — pessoa física", "37": "Locação de mão de obra",
  "39": "Outros serviços de terceiros — pessoa jurídica", "40": "Serviços de tecnologia da informação e comunicação",
  "41": "Contribuições", "42": "Auxílios", "43": "Subvenções sociais", "45": "Subvenções econômicas",
  "46": "Auxílio-alimentação", "47": "Obrigações tributárias e contributivas", "48": "Outros auxílios financeiros a pessoas físicas",
  "49": "Auxílio-transporte", "51": "Obras e instalações", "52": "Equipamentos e material permanente",
  "61": "Aquisição de imóveis", "65": "Constituição ou aumento de capital de empresas",
  "70": "Rateio pela participação em consórcio público", "71": "Principal da dívida contratual resgatado",
  "91": "Sentenças judiciais", "92": "Despesas de exercícios anteriores", "93": "Indenizações e restituições",
  "94": "Indenizações e restituições trabalhistas", "96": "Ressarcimento de despesas de pessoal requisitado",
  "99": "A classificar",
};

export const nomeFuncao = (codigo: string) => FUNCOES[codigo.padStart(2, "0")] ?? null;
export const nomeSubfuncao = (codigo: string) => SUBFUNCOES[codigo.padStart(3, "0")] ?? null;
export const nomeElemento = (codigo: string) => ELEMENTOS[codigo.padStart(2, "0")] ?? null;
