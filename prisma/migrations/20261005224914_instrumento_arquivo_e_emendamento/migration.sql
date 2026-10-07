-- AlterTable
ALTER TABLE "ConfiguracaoExercicio" ADD COLUMN     "situacoesEmendamento" "StatusInstrumento"[] DEFAULT ARRAY['EM_TRAMITACAO']::"StatusInstrumento"[];

-- AlterTable
ALTER TABLE "InstrumentoPlanejamento" ADD COLUMN     "arquivoId" TEXT,
ADD COLUMN     "totalImpresso" DECIMAL(18,2);

-- AddForeignKey
ALTER TABLE "InstrumentoPlanejamento" ADD CONSTRAINT "InstrumentoPlanejamento_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
