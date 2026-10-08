-- AlterTable
ALTER TABLE "Emenda" ADD COLUMN     "declaracaoDotacao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dotacaoInformada" JSONB;
