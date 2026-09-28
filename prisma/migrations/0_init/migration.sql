-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Poder" AS ENUM ('LEGISLATIVO', 'EXECUTIVO');

-- CreateEnum
CREATE TYPE "StatusExercicio" AS ENUM ('ABERTO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoInstrumento" AS ENUM ('PPA', 'LDO', 'LOA');

-- CreateEnum
CREATE TYPE "EspecieInstrumento" AS ENUM ('PROJETO_LEI', 'LEI_APROVADA');

-- CreateEnum
CREATE TYPE "StatusInstrumento" AS ENUM ('EM_ELABORACAO', 'ENVIADO', 'EM_TRAMITACAO', 'APROVADO', 'SANCIONADO', 'VIGENTE', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoAcao" AS ENUM ('PROJETO', 'ATIVIDADE', 'OPERACAO_ESPECIAL');

-- CreateEnum
CREATE TYPE "TipoNorma" AS ENUM ('LOM', 'REGIMENTO_INTERNO', 'LEI', 'PORTARIA', 'COMUNICADO', 'OUTRO');

-- CreateEnum
CREATE TYPE "AfericaoSaude" AS ENUM ('GLOBAL', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "FormaExecucao" AS ENUM ('DIRETA', 'INDIRETA');

-- CreateEnum
CREATE TYPE "NaturezaObjeto" AS ENUM ('CUSTEIO', 'CAPITAL');

-- CreateEnum
CREATE TYPE "Divisibilidade" AS ENUM ('DIVISIVEL', 'INDIVISIVEL');

-- CreateEnum
CREATE TYPE "ParcelaCota" AS ENUM ('SAUDE', 'DEMAIS');

-- CreateEnum
CREATE TYPE "OrigemDestino" AS ENUM ('BASE_OFICIAL', 'CADASTRO');

-- CreateEnum
CREATE TYPE "SituacaoClassificacao" AS ENUM ('OK', 'VALIDAR', 'OBICE', 'CONFLITO', 'INDETERMINADO');

-- CreateEnum
CREATE TYPE "EscolhaDotacao" AS ENUM ('SISTEMA', 'PROPONENTE', 'ANALISE_TECNICA');

-- CreateEnum
CREATE TYPE "ModeloPlanoTrabalho" AS ENUM ('CUSTEIO', 'OBRAS', 'TERCEIRO_SETOR', 'EQUIPAMENTOS');

-- CreateEnum
CREATE TYPE "InstrumentoParceria" AS ENUM ('PARCERIA_MROSC', 'CONTRIBUICAO_LEI', 'OUTRO');

-- CreateEnum
CREATE TYPE "EventoComprovacao" AS ENUM ('PATRIMONIO', 'ALMOXARIFADO', 'LIQUIDACAO', 'RECEBIMENTO_DEFINITIVO', 'RECEBIMENTO_ETAPA', 'PRESTACAO_CONTAS', 'PRESTACAO_CONTAS_DOACAO');

-- CreateEnum
CREATE TYPE "TipoReferenciaPreco" AS ENUM ('ATA', 'CONTRATACAO_MUNICIPIO', 'CONTRATACAO_OUTRO_ORGAO', 'PAINEL', 'BANCO_PRECOS_SAUDE', 'TABELA_OFICIAL', 'COTACAO', 'NOTA_FISCAL', 'TERMO_PARCERIA', 'ESTIMATIVA');

-- CreateEnum
CREATE TYPE "ProcedenciaReferencia" AS ENUM ('INFORMADA', 'CONFERIDA');

-- CreateEnum
CREATE TYPE "StatusEmenda" AS ENUM ('RASCUNHO', 'SUBMETIDA', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "ResultadoViabilidade" AS ENUM ('VIAVEL', 'VIAVEL_COM_RESSALVA', 'INVIAVEL');

-- CreateEnum
CREATE TYPE "EtapaExecucao" AS ENUM ('EMPENHO', 'LIQUIDACAO', 'PAGAMENTO');

-- CreateTable
CREATE TABLE "Municipio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "codigoIbge" TEXT,
    "nomeCamara" TEXT,
    "nomePrefeitura" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercicio" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "status" "StatusExercicio" NOT NULL DEFAULT 'ABERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoExercicio" (
    "id" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "cotaIndividual" DECIMAL(18,2),
    "percentualRcl" DECIMAL(7,4),
    "rclBase" DECIMAL(18,2),
    "rclAnoBase" INTEGER,
    "rclObservacao" TEXT,
    "numeroVereadores" INTEGER,
    "memoriaCota" TEXT,
    "percentualSaude" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "afericaoSaude" "AfericaoSaude" NOT NULL DEFAULT 'GLOBAL',
    "observacaoSaude" TEXT,
    "toleranciaValorPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "validadeReferenciaMeses" INTEGER NOT NULL DEFAULT 12,
    "percentualAcessorio" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "fonteAudesp" TEXT,
    "fonteAudespNome" TEXT,
    "codigoAplicacao" TEXT,
    "formatoVariacao" INTEGER NOT NULL DEFAULT 4,
    "variacaoOcupaFonte" BOOLEAN NOT NULL DEFAULT false,
    "icEpVigente" BOOLEAN NOT NULL DEFAULT false,
    "icEpCodigo" TEXT,
    "orgaosForaDasEmendas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rotuloBase" TEXT,
    "prazoProtocolo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoExercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrazoExercicio" (
    "id" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrazoExercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orgao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orgao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadeOrcamentaria" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "orgaoId" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadeOrcamentaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subfuncao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subfuncao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programa" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "constaNoPPA" BOOLEAN NOT NULL DEFAULT false,
    "exercicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoAcao" NOT NULL,
    "programaId" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Acao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NaturezaDespesa" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "categoriaEconomica" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "modalidadeAplicacao" TEXT NOT NULL,
    "elemento" TEXT NOT NULL,
    "nome" TEXT,
    "exercicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NaturezaDespesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FonteRecurso" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FonteRecurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentoPlanejamento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoInstrumento" NOT NULL,
    "especie" "EspecieInstrumento" NOT NULL,
    "numero" TEXT NOT NULL,
    "ementa" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "status" "StatusInstrumento" NOT NULL DEFAULT 'EM_ELABORACAO',
    "arquivoUrl" TEXT,
    "dataEnvio" TIMESTAMP(3),
    "dataAprovacao" TIMESTAMP(3),
    "dataVigencia" TIMESTAMP(3),
    "instrumentoOrigemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentoPlanejamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dotacao" (
    "id" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ficha" TEXT,
    "orgaoId" TEXT NOT NULL,
    "unidadeOrcamentariaId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,
    "subfuncaoId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "acaoId" TEXT NOT NULL,
    "naturezaDespesaId" TEXT NOT NULL,
    "fonteRecursoId" TEXT NOT NULL,
    "valorAutorizado" DECIMAL(18,2) NOT NULL,
    "paginaFonte" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAcao" (
    "id" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "acaoId" TEXT NOT NULL,
    "produto" TEXT NOT NULL,
    "unidadeMedida" TEXT,
    "publicoAlvo" TEXT,
    "quantidadePpa" DECIMAL(18,4),
    "quantidadeExercicio" DECIMAL(18,4),
    "beneficiariosExercicio" DECIMAL(18,4),
    "notaLdo" TEXT,
    "paginaFonte" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoNormativo" (
    "id" TEXT NOT NULL,
    "tipo" "TipoNorma" NOT NULL,
    "titulo" TEXT NOT NULL,
    "numero" TEXT,
    "artigo" TEXT,
    "trecho" TEXT,
    "url" TEXT,
    "dataVigencia" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoNormativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaAplicacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "orgaos" TEXT[],
    "unidadePadrao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaAplicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjetoBiblioteca" (
    "id" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "termos" TEXT[],
    "natureza" "NaturezaObjeto" NOT NULL,
    "elemento" TEXT NOT NULL,
    "divisibilidade" "Divisibilidade" NOT NULL,
    "subfuncao" TEXT,
    "estrito" BOOLEAN NOT NULL DEFAULT false,
    "explicacao" TEXT NOT NULL,
    "areaId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjetoBiblioteca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destino" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeOficial" TEXT,
    "execucao" "FormaExecucao" NOT NULL,
    "unidadeCodigo" TEXT,
    "unidadeRepasseCodigo" TEXT,
    "endereco" TEXT NOT NULL,
    "cnpj" TEXT,
    "cnes" TEXT,
    "inep" TEXT,
    "populacaoReferencia" INTEGER,
    "fontePopulacao" TEXT,
    "dataPopulacao" TEXT,
    "responsavelNome" TEXT,
    "responsavelCargo" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "pendenciaHabilitacao" TEXT,
    "fonteUrl" TEXT,
    "origem" "OrigemDestino" NOT NULL DEFAULT 'CADASTRO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Autor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "partido" TEXT,
    "cargo" TEXT NOT NULL DEFAULT 'Vereador',
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Autor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContadorEmenda" (
    "id" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContadorEmenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emenda" (
    "id" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "status" "StatusEmenda" NOT NULL DEFAULT 'RASCUNHO',
    "numero" INTEGER,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "execucao" "FormaExecucao" NOT NULL DEFAULT 'DIRETA',
    "destinoId" TEXT,
    "objeto" TEXT NOT NULL DEFAULT '',
    "quantidade" TEXT,
    "valorPretendido" DECIMAL(18,2),
    "endereco" TEXT NOT NULL DEFAULT '',
    "situacao" "SituacaoClassificacao",
    "dotacaoId" TEXT,
    "escolhaDotacao" "EscolhaDotacao",
    "classificacao" JSONB,
    "parcela" "ParcelaCota",
    "modelo" "ModeloPlanoTrabalho",
    "agenteExecutor" TEXT NOT NULL DEFAULT '',
    "justificativa" TEXT NOT NULL DEFAULT '',
    "metaFinalistica" TEXT NOT NULL DEFAULT '',
    "etapas" TEXT NOT NULL DEFAULT '',
    "etapasEditadas" BOOLEAN NOT NULL DEFAULT false,
    "quadroViabilidade" JSONB NOT NULL DEFAULT '{}',
    "instrumento" "InstrumentoParceria",
    "instrumentoOutro" TEXT NOT NULL DEFAULT '',
    "elementoOsc" TEXT,
    "evento" "EventoComprovacao",
    "metodoMeta" TEXT,
    "metaSugerida" DECIMAL(18,4),
    "valor" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "declaracaoVinculo" BOOLEAN NOT NULL DEFAULT false,
    "submetidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaEmenda" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "beneficiarios" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "MetaEmenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenciaPreco" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoReferenciaPreco" NOT NULL,
    "campos" JSONB NOT NULL DEFAULT '{}',
    "emissor" TEXT NOT NULL,
    "data" TIMESTAMP(3),
    "dataTexto" TEXT,
    "unidade" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "objeto" TEXT NOT NULL,
    "porte" TEXT,
    "link" TEXT,
    "observacao" TEXT,
    "procedencia" "ProcedenciaReferencia" NOT NULL DEFAULT 'INFORMADA',
    "aprovadoPor" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "origemExterna" TEXT,
    "consultadoEm" TIMESTAMP(3),

    CONSTRAINT "ReferenciaPreco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEmenda" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "valorUnitario" DECIMAL(18,2) NOT NULL,
    "referenciaId" TEXT,

    CONSTRAINT "ItemEmenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelaDesembolso" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ParcelaDesembolso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidacaoEmenda" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "bloqueios" INTEGER NOT NULL,
    "alertas" INTEGER NOT NULL,
    "itens" JSONB NOT NULL,
    "executadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidacaoEmenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmendaImportada" (
    "id" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "parcela" "ParcelaCota",
    "saudeHeuristica" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "fonte" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmendaImportada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParecerViabilidade" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "resultado" "ResultadoViabilidade" NOT NULL,
    "justificativa" TEXT NOT NULL,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParecerViabilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AndamentoExecucao" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "etapa" "EtapaExecucao" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "numeroDocumento" TEXT,
    "observacao" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AndamentoExecucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilAcesso" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "poder" "Poder",
    "apresentarEmendas" BOOLEAN NOT NULL DEFAULT false,
    "gerirTodasEmendas" BOOLEAN NOT NULL DEFAULT false,
    "tramitarEmendas" BOOLEAN NOT NULL DEFAULT false,
    "gerirPlanejamento" BOOLEAN NOT NULL DEFAULT false,
    "gerirExercicios" BOOLEAN NOT NULL DEFAULT false,
    "administrarConfiguracoes" BOOLEAN NOT NULL DEFAULT false,
    "analisarViabilidade" BOOLEAN NOT NULL DEFAULT false,
    "registrarExecucao" BOOLEAN NOT NULL DEFAULT false,
    "perfilDoSistema" BOOLEAN NOT NULL DEFAULT false,
    "adminGeral" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "perfilId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_ano_key" ON "Exercicio"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoExercicio_exercicioId_key" ON "ConfiguracaoExercicio"("exercicioId");

-- CreateIndex
CREATE INDEX "PrazoExercicio_exercicioId_data_idx" ON "PrazoExercicio"("exercicioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Orgao_exercicioId_codigo_key" ON "Orgao"("exercicioId", "codigo");

-- CreateIndex
CREATE INDEX "UnidadeOrcamentaria_orgaoId_idx" ON "UnidadeOrcamentaria"("orgaoId");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeOrcamentaria_exercicioId_codigo_key" ON "UnidadeOrcamentaria"("exercicioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Funcao_exercicioId_codigo_key" ON "Funcao"("exercicioId", "codigo");

-- CreateIndex
CREATE INDEX "Subfuncao_funcaoId_idx" ON "Subfuncao"("funcaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Subfuncao_exercicioId_funcaoId_codigo_key" ON "Subfuncao"("exercicioId", "funcaoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Programa_exercicioId_codigo_key" ON "Programa"("exercicioId", "codigo");

-- CreateIndex
CREATE INDEX "Acao_programaId_idx" ON "Acao"("programaId");

-- CreateIndex
CREATE UNIQUE INDEX "Acao_exercicioId_programaId_codigo_key" ON "Acao"("exercicioId", "programaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "NaturezaDespesa_exercicioId_codigo_key" ON "NaturezaDespesa"("exercicioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "FonteRecurso_exercicioId_codigo_key" ON "FonteRecurso"("exercicioId", "codigo");

-- CreateIndex
CREATE INDEX "InstrumentoPlanejamento_exercicioId_especie_status_idx" ON "InstrumentoPlanejamento"("exercicioId", "especie", "status");

-- CreateIndex
CREATE INDEX "Dotacao_exercicioId_idx" ON "Dotacao"("exercicioId");

-- CreateIndex
CREATE INDEX "Dotacao_unidadeOrcamentariaId_idx" ON "Dotacao"("unidadeOrcamentariaId");

-- CreateIndex
CREATE UNIQUE INDEX "Dotacao_instrumentoId_codigo_key" ON "Dotacao"("instrumentoId", "codigo");

-- CreateIndex
CREATE INDEX "MetaAcao_exercicioId_idx" ON "MetaAcao"("exercicioId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAcao_unidadeId_programaId_acaoId_key" ON "MetaAcao"("unidadeId", "programaId", "acaoId");

-- CreateIndex
CREATE INDEX "DocumentoNormativo_tipo_ativo_idx" ON "DocumentoNormativo"("tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "AreaAplicacao_nome_key" ON "AreaAplicacao"("nome");

-- CreateIndex
CREATE INDEX "ObjetoBiblioteca_ativo_idx" ON "ObjetoBiblioteca"("ativo");

-- CreateIndex
CREATE INDEX "Destino_ativo_idx" ON "Destino"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Destino_execucao_nome_key" ON "Destino"("execucao", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Autor_usuarioId_key" ON "Autor"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Autor_nome_key" ON "Autor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "ContadorEmenda_exercicioId_key" ON "ContadorEmenda"("exercicioId");

-- CreateIndex
CREATE INDEX "Emenda_exercicioId_status_idx" ON "Emenda"("exercicioId", "status");

-- CreateIndex
CREATE INDEX "Emenda_autorId_idx" ON "Emenda"("autorId");

-- CreateIndex
CREATE INDEX "Emenda_dotacaoId_idx" ON "Emenda"("dotacaoId");

-- CreateIndex
CREATE INDEX "Emenda_destinoId_idx" ON "Emenda"("destinoId");

-- CreateIndex
CREATE UNIQUE INDEX "Emenda_exercicioId_numero_key" ON "Emenda"("exercicioId", "numero");

-- CreateIndex
CREATE INDEX "MetaEmenda_emendaId_idx" ON "MetaEmenda"("emendaId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenciaPreco_emendaId_codigo_key" ON "ReferenciaPreco"("emendaId", "codigo");

-- CreateIndex
CREATE INDEX "ItemEmenda_emendaId_idx" ON "ItemEmenda"("emendaId");

-- CreateIndex
CREATE INDEX "ParcelaDesembolso_emendaId_idx" ON "ParcelaDesembolso"("emendaId");

-- CreateIndex
CREATE INDEX "ValidacaoEmenda_emendaId_idx" ON "ValidacaoEmenda"("emendaId");

-- CreateIndex
CREATE INDEX "EmendaImportada_autorId_idx" ON "EmendaImportada"("autorId");

-- CreateIndex
CREATE UNIQUE INDEX "EmendaImportada_exercicioId_numero_key" ON "EmendaImportada"("exercicioId", "numero");

-- CreateIndex
CREATE INDEX "ParecerViabilidade_emendaId_criadoEm_idx" ON "ParecerViabilidade"("emendaId", "criadoEm");

-- CreateIndex
CREATE INDEX "AndamentoExecucao_emendaId_idx" ON "AndamentoExecucao"("emendaId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilAcesso_nome_key" ON "PerfilAcesso"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_perfilId_idx" ON "User"("perfilId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");

-- CreateIndex
CREATE INDEX "AuditLog_entidade_entidadeId_idx" ON "AuditLog"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditLog_criadoEm_idx" ON "AuditLog"("criadoEm");

-- AddForeignKey
ALTER TABLE "ConfiguracaoExercicio" ADD CONSTRAINT "ConfiguracaoExercicio_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrazoExercicio" ADD CONSTRAINT "PrazoExercicio_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orgao" ADD CONSTRAINT "Orgao_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeOrcamentaria" ADD CONSTRAINT "UnidadeOrcamentaria_orgaoId_fkey" FOREIGN KEY ("orgaoId") REFERENCES "Orgao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeOrcamentaria" ADD CONSTRAINT "UnidadeOrcamentaria_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcao" ADD CONSTRAINT "Funcao_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subfuncao" ADD CONSTRAINT "Subfuncao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subfuncao" ADD CONSTRAINT "Subfuncao_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programa" ADD CONSTRAINT "Programa_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acao" ADD CONSTRAINT "Acao_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acao" ADD CONSTRAINT "Acao_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaturezaDespesa" ADD CONSTRAINT "NaturezaDespesa_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FonteRecurso" ADD CONSTRAINT "FonteRecurso_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentoPlanejamento" ADD CONSTRAINT "InstrumentoPlanejamento_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentoPlanejamento" ADD CONSTRAINT "InstrumentoPlanejamento_instrumentoOrigemId_fkey" FOREIGN KEY ("instrumentoOrigemId") REFERENCES "InstrumentoPlanejamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "InstrumentoPlanejamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_orgaoId_fkey" FOREIGN KEY ("orgaoId") REFERENCES "Orgao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_unidadeOrcamentariaId_fkey" FOREIGN KEY ("unidadeOrcamentariaId") REFERENCES "UnidadeOrcamentaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "Funcao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_subfuncaoId_fkey" FOREIGN KEY ("subfuncaoId") REFERENCES "Subfuncao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_naturezaDespesaId_fkey" FOREIGN KEY ("naturezaDespesaId") REFERENCES "NaturezaDespesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dotacao" ADD CONSTRAINT "Dotacao_fonteRecursoId_fkey" FOREIGN KEY ("fonteRecursoId") REFERENCES "FonteRecurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAcao" ADD CONSTRAINT "MetaAcao_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAcao" ADD CONSTRAINT "MetaAcao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "UnidadeOrcamentaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAcao" ADD CONSTRAINT "MetaAcao_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAcao" ADD CONSTRAINT "MetaAcao_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjetoBiblioteca" ADD CONSTRAINT "ObjetoBiblioteca_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "AreaAplicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Destino" ADD CONSTRAINT "Destino_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autor" ADD CONSTRAINT "Autor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContadorEmenda" ADD CONSTRAINT "ContadorEmenda_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emenda" ADD CONSTRAINT "Emenda_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emenda" ADD CONSTRAINT "Emenda_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Autor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emenda" ADD CONSTRAINT "Emenda_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Destino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emenda" ADD CONSTRAINT "Emenda_dotacaoId_fkey" FOREIGN KEY ("dotacaoId") REFERENCES "Dotacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEmenda" ADD CONSTRAINT "MetaEmenda_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenciaPreco" ADD CONSTRAINT "ReferenciaPreco_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEmenda" ADD CONSTRAINT "ItemEmenda_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEmenda" ADD CONSTRAINT "ItemEmenda_referenciaId_fkey" FOREIGN KEY ("referenciaId") REFERENCES "ReferenciaPreco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelaDesembolso" ADD CONSTRAINT "ParcelaDesembolso_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidacaoEmenda" ADD CONSTRAINT "ValidacaoEmenda_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmendaImportada" ADD CONSTRAINT "EmendaImportada_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmendaImportada" ADD CONSTRAINT "EmendaImportada_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Autor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParecerViabilidade" ADD CONSTRAINT "ParecerViabilidade_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParecerViabilidade" ADD CONSTRAINT "ParecerViabilidade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AndamentoExecucao" ADD CONSTRAINT "AndamentoExecucao_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AndamentoExecucao" ADD CONSTRAINT "AndamentoExecucao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "PerfilAcesso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

