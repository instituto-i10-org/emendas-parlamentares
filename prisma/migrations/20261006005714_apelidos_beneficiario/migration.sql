-- AlterTable
ALTER TABLE "Destino" ADD COLUMN     "apelidos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mescladoEmId" TEXT;
