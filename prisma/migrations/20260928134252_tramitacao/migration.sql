-- AlterTable
ALTER TABLE "Emenda" ADD COLUMN     "parecerTramitacao" TEXT,
ADD COLUMN     "tramitadaEm" TIMESTAMP(3),
ADD COLUMN     "tramitadaPorId" TEXT;

-- AddForeignKey
ALTER TABLE "Emenda" ADD CONSTRAINT "Emenda_tramitadaPorId_fkey" FOREIGN KEY ("tramitadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
