-- Documento da emenda: dotação de reserva, fundamento legal e dados da Câmara.
ALTER TABLE "ConfiguracaoExercicio" ADD COLUMN "fichaReserva" TEXT;
ALTER TABLE "ConfiguracaoExercicio" ADD COLUMN "fundamentoDocumento" TEXT;
ALTER TABLE "Municipio" ADD COLUMN "enderecoCamara" TEXT;
ALTER TABLE "Municipio" ADD COLUMN "rodapeDocumentos" TEXT;
