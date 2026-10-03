-- AlterEnum
ALTER TYPE "StatusEmenda" ADD VALUE 'EM_DILIGENCIA';

-- AlterTable
ALTER TABLE "Emenda" ADD COLUMN     "diligenciaAte" TIMESTAMP(3),
ADD COLUMN     "diligenciaEm" TIMESTAMP(3),
ADD COLUMN     "diligenciaMotivo" TEXT,
ADD COLUMN     "reenviadaEm" TIMESTAMP(3);
