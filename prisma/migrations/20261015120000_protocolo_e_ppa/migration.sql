-- Protocolo da Câmara na emenda e período do PPA no documento.
ALTER TABLE "Emenda" ADD COLUMN "protocoloCamara" TEXT;
ALTER TABLE "Emenda" ADD COLUMN "protocoloRegistradoEm" TIMESTAMP(3);
ALTER TABLE "Emenda" ADD COLUMN "protocoloRegistradoPorId" TEXT;
ALTER TABLE "ConfiguracaoExercicio" ADD COLUMN "periodoPpa" TEXT;
