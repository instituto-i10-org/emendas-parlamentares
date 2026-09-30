-- Campos aditivos das correções do Relatório de Testes de 29/09/2026.
ALTER TABLE "Dotacao" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Autor" ADD COLUMN "demonstracao" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Destino" ADD COLUMN "subfuncaoSugerida" TEXT;
ALTER TABLE "ObjetoBiblioteca" ADD COLUMN "pistas" TEXT[] DEFAULT ARRAY[]::TEXT[];
