-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNorma" ADD VALUE 'RESOLUCAO';
ALTER TYPE "TipoNorma" ADD VALUE 'ATO_DA_MESA';
ALTER TYPE "TipoNorma" ADD VALUE 'DECRETO';

-- AlterTable
ALTER TABLE "DocumentoNormativo" ADD COLUMN     "arquivoId" TEXT,
ADD COLUMN     "dataAto" TIMESTAMP(3),
ADD COLUMN     "vigenciaFim" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Municipio" ADD COLUMN     "manualAtoId" TEXT,
ADD COLUMN     "manualPublicadoEm" TIMESTAMP(3),
ADD COLUMN     "manualPublicadoPorId" TEXT,
ADD COLUMN     "portalPublico" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_manualAtoId_fkey" FOREIGN KEY ("manualAtoId") REFERENCES "DocumentoNormativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_manualPublicadoPorId_fkey" FOREIGN KEY ("manualPublicadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoNormativo" ADD CONSTRAINT "DocumentoNormativo_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
