-- CreateEnum
CREATE TYPE "ModoValidacao" AS ENUM ('BLOQUEANTE', 'ALERTA');

-- CreateEnum
CREATE TYPE "MomentoValidacao" AS ENUM ('VALIDACAO', 'REMESSA', 'REENVIO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusEmenda" ADD VALUE 'EM_VALIDACAO';
ALTER TYPE "StatusEmenda" ADD VALUE 'VALIDA';
ALTER TYPE "StatusEmenda" ADD VALUE 'INVALIDA';
ALTER TYPE "StatusEmenda" ADD VALUE 'EM_TRAMITACAO';

-- AlterTable
ALTER TABLE "ConfiguracaoExercicio" ADD COLUMN     "fundamentos" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ValidacaoEmenda" ADD COLUMN     "momento" "MomentoValidacao" NOT NULL DEFAULT 'VALIDACAO',
ADD COLUMN     "revisao" INTEGER,
ADD COLUMN     "usuarioId" TEXT,
ADD COLUMN     "valida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificacoes" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "RegraValidacao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "exercicioId" TEXT,
    "modo" "ModoValidacao" NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "fundamento" TEXT,
    "normaId" TEXT,
    "parametros" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegraValidacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegraValidacao_codigo_idx" ON "RegraValidacao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "RegraValidacao_codigo_exercicioId_key" ON "RegraValidacao"("codigo", "exercicioId");

-- AddForeignKey
ALTER TABLE "RegraValidacao" ADD CONSTRAINT "RegraValidacao_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraValidacao" ADD CONSTRAINT "RegraValidacao_normaId_fkey" FOREIGN KEY ("normaId") REFERENCES "DocumentoNormativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
