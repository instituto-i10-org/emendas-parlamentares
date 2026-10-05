-- AlterTable
ALTER TABLE "ConfiguracaoExercicio" ADD COLUMN     "fontePrecoObrigatoria" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "validadeLinkEntidadeDias" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "ReferenciaPreco" ADD COLUMN     "fonteId" TEXT;

-- CreateTable
CREATE TABLE "FontePrecoOficial" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orientacao" TEXT NOT NULL,
    "aplicaA" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tipo" "TipoReferenciaPreco" NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FontePrecoOficial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConviteEntidade" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),
    "revogadoPorId" TEXT,
    "usadoEm" TIMESTAMP(3),
    "responsavelNome" TEXT,
    "responsavelCargo" TEXT,
    "enviadoDeIp" TEXT,
    "conteudo" JSONB,
    "aplicadoEm" TIMESTAMP(3),
    "aplicadoPorId" TEXT,

    CONSTRAINT "ConviteEntidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FontePrecoOficial_nome_key" ON "FontePrecoOficial"("nome");

-- CreateIndex
CREATE INDEX "FontePrecoOficial_ativo_ordem_idx" ON "FontePrecoOficial"("ativo", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "ConviteEntidade_codigoHash_key" ON "ConviteEntidade"("codigoHash");

-- CreateIndex
CREATE INDEX "ConviteEntidade_emendaId_idx" ON "ConviteEntidade"("emendaId");

-- AddForeignKey
ALTER TABLE "ReferenciaPreco" ADD CONSTRAINT "ReferenciaPreco_fonteId_fkey" FOREIGN KEY ("fonteId") REFERENCES "FontePrecoOficial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteEntidade" ADD CONSTRAINT "ConviteEntidade_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fontes oficiais de preço indicadas ao autor (prisma/dados/comum/fontes-preco.json).
INSERT INTO "FontePrecoOficial" ("id", "nome", "url", "orientacao", "aplicaA", "tipo", "ordem", "ativo", "updatedAt") VALUES
  ('fonte-preco-01', 'Pesquisa de Preços (Compras.gov.br)', 'https://www.gov.br/compras/pt-br/sistemas/conheca-o-compras/pesquisa-de-precos', 'Pesquise pelo nome ou pelo código CATMAT/CATSER do item, limite às compras dos últimos 12 meses e anote a mediana e quantas compras entraram na conta.', ARRAY[]::TEXT[], 'PAINEL'::"TipoReferenciaPreco", 10, true, CURRENT_TIMESTAMP),
  ('fonte-preco-02', 'Atas de registro de preços (PNCP)', 'https://pncp.gov.br/app/atas', 'Procure uma ata vigente com o mesmo item. Anote o número da ata, o órgão que a gerencia, o item e o valor unitário.', ARRAY[]::TEXT[], 'ATA'::"TipoReferenciaPreco", 20, true, CURRENT_TIMESTAMP),
  ('fonte-preco-03', 'Contratos de outros órgãos (PNCP)', 'https://pncp.gov.br/app/contratos', 'Procure contratações recentes do mesmo item por outros municípios ou órgãos. Anote o número do contrato, o órgão e a data de assinatura.', ARRAY[]::TEXT[], 'CONTRATACAO_OUTRO_ORGAO'::"TipoReferenciaPreco", 30, true, CURRENT_TIMESTAMP),
  ('fonte-preco-04', 'Bolsa Eletrônica de Compras de São Paulo (BEC/SP)', 'https://www.bec.sp.gov.br/', 'Consulte os preços praticados nas compras do Estado de São Paulo para o mesmo item. Anote o código do item e o período consultado.', ARRAY['CUSTEIO','EQUIPAMENTOS','TERCEIRO_SETOR']::TEXT[], 'PAINEL'::"TipoReferenciaPreco", 40, true, CURRENT_TIMESTAMP),
  ('fonte-preco-05', 'Banco de Preços em Saúde (Ministério da Saúde)', 'https://bps.saude.gov.br/', 'Para medicamentos, materiais e equipamentos de saúde. Filtre por item e pelos últimos 12 meses e anote a mediana e o número de compras.', ARRAY['SAUDE']::TEXT[], 'BANCO_PRECOS_SAUDE'::"TipoReferenciaPreco", 50, true, CURRENT_TIMESTAMP),
  ('fonte-preco-06', 'Tabela de preços de medicamentos (CMED/Anvisa)', 'https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos', 'Preço máximo de venda ao governo para medicamentos. Anote a apresentação do medicamento e a data da tabela.', ARRAY['SAUDE']::TEXT[], 'TABELA_OFICIAL'::"TipoReferenciaPreco", 60, true, CURRENT_TIMESTAMP),
  ('fonte-preco-07', 'SINAPI (Caixa)', 'https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx', 'Tabela oficial para obras e reformas. Use o relatório de São Paulo, anote o código da composição, o mês de referência e se é com ou sem desoneração.', ARRAY['OBRAS']::TEXT[], 'TABELA_OFICIAL'::"TipoReferenciaPreco", 70, true, CURRENT_TIMESTAMP),
  ('fonte-preco-08', 'Tabela CPOS/CDHU (São Paulo)', 'https://www.cdhu.sp.gov.br/web/guest/fornecedores/tabela-de-custos-cpos', 'Tabela de custos de obras do Estado de São Paulo. Anote o código do serviço e a data-base da tabela.', ARRAY['OBRAS']::TEXT[], 'TABELA_OFICIAL'::"TipoReferenciaPreco", 80, true, CURRENT_TIMESTAMP),
  ('fonte-preco-09', 'Catálogo de serviços da FDE (obras escolares SP)', 'https://www.fde.sp.gov.br/', 'Referência para obras e reformas em prédios escolares. Anote o código do serviço e a data-base.', ARRAY['OBRAS']::TEXT[], 'TABELA_OFICIAL'::"TipoReferenciaPreco", 90, true, CURRENT_TIMESTAMP),
  ('fonte-preco-10', 'SICRO (DNIT)', 'https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/sicro', 'Tabela oficial para obras de estradas, pavimentação e drenagem. Anote o código da composição, a região e o mês de referência.', ARRAY['OBRAS']::TEXT[], 'TABELA_OFICIAL'::"TipoReferenciaPreco", 100, true, CURRENT_TIMESTAMP)
ON CONFLICT ("nome") DO NOTHING;
