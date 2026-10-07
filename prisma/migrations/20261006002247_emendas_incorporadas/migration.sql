-- AlterTable
ALTER TABLE "Emenda" ADD COLUMN     "incorporadaEm" TIMESTAMP(3),
ADD COLUMN     "incorporadaLeiId" TEXT,
ADD COLUMN     "incorporadaPorId" TEXT;

-- AddForeignKey
ALTER TABLE "Emenda" ADD CONSTRAINT "Emenda_incorporadaPorId_fkey" FOREIGN KEY ("incorporadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emenda" ADD CONSTRAINT "Emenda_incorporadaLeiId_fkey" FOREIGN KEY ("incorporadaLeiId") REFERENCES "InstrumentoPlanejamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
