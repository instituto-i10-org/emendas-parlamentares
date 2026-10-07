-- CreateEnum
CREATE TYPE "TipoCarga" AS ENUM ('DOTACOES', 'PRIORIDADES_LDO', 'PROGRAMAS_PPA');

-- CreateEnum
CREATE TYPE "FormatoImportacao" AS ENUM ('PLANILHA', 'PDF_TEXTO', 'PDF_IMAGEM', 'IMAGEM');

-- CreateEnum
CREATE TYPE "SituacaoImportacao" AS ENUM ('MAPEAR', 'LENDO', 'LIDA', 'GRAVADA', 'CANCELADA', 'ERRO');

-- CreateTable
CREATE TABLE "Importacao" (
    "id" TEXT NOT NULL,
    "instrumentoId" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "tipoCarga" "TipoCarga" NOT NULL,
    "formato" "FormatoImportacao" NOT NULL,
    "situacao" "SituacaoImportacao" NOT NULL,
    "cabecalho" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mapa" JSONB,
    "progresso" JSONB,
    "paginas" INTEGER,
    "paginasLidas" INTEGER NOT NULL DEFAULT 0,
    "paginaInicial" INTEGER,
    "paginaFinal" INTEGER,
    "totalImpresso" DECIMAL(18,2),
    "totalLido" DECIMAL(18,2),
    "erro" TEXT,
    "resumo" JSONB,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "gravadaEm" TIMESTAMP(3),
    "gravadaPorId" TEXT,

    CONSTRAINT "Importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinhaImportada" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "pagina" INTEGER,
    "campos" JSONB NOT NULL,
    "motivos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avisos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "corrigidaPorId" TEXT,
    "corrigidaEm" TIMESTAMP(3),
    "incluida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LinhaImportada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrioridadeLdo" (
    "id" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "instrumentoId" TEXT,
    "programaId" TEXT NOT NULL,
    "acaoId" TEXT,
    "descricao" TEXT NOT NULL,
    "meta" DECIMAL(18,4),
    "unidadeMedida" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrioridadeLdo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Importacao_instrumentoId_criadoEm_idx" ON "Importacao"("instrumentoId", "criadoEm");

-- CreateIndex
CREATE INDEX "LinhaImportada_importacaoId_numero_idx" ON "LinhaImportada"("importacaoId", "numero");

-- CreateIndex
CREATE INDEX "PrioridadeLdo_exercicioId_programaId_idx" ON "PrioridadeLdo"("exercicioId", "programaId");

-- AddForeignKey
ALTER TABLE "Importacao" ADD CONSTRAINT "Importacao_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "InstrumentoPlanejamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Importacao" ADD CONSTRAINT "Importacao_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Arquivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaImportada" ADD CONSTRAINT "LinhaImportada_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "Importacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrioridadeLdo" ADD CONSTRAINT "PrioridadeLdo_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrioridadeLdo" ADD CONSTRAINT "PrioridadeLdo_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "InstrumentoPlanejamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrioridadeLdo" ADD CONSTRAINT "PrioridadeLdo_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrioridadeLdo" ADD CONSTRAINT "PrioridadeLdo_acaoId_fkey" FOREIGN KEY ("acaoId") REFERENCES "Acao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
