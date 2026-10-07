-- CreateEnum
CREATE TYPE "UsoArquivo" AS ENUM ('PECA_ORCAMENTARIA', 'NORMA', 'IMPORTACAO');

-- AlterTable
ALTER TABLE "PerfilAcesso" ADD COLUMN     "consultarTudo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "HistoricoEmenda" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "de" "StatusEmenda",
    "para" "StatusEmenda" NOT NULL,
    "texto" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoEmenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arquivo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "uso" "UsoArquivo" NOT NULL,
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "enviadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaAcesso" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsoIA" (
    "id" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL DEFAULT 1,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSaida" INTEGER NOT NULL DEFAULT 0,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsoIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoEmenda_emendaId_criadoEm_idx" ON "HistoricoEmenda"("emendaId", "criadoEm");

-- CreateIndex
CREATE INDEX "HistoricoEmenda_criadoEm_idx" ON "HistoricoEmenda"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Arquivo_chave_key" ON "Arquivo"("chave");

-- CreateIndex
CREATE INDEX "Arquivo_uso_idx" ON "Arquivo"("uso");

-- CreateIndex
CREATE INDEX "TentativaAcesso_chave_criadoEm_idx" ON "TentativaAcesso"("chave", "criadoEm");

-- CreateIndex
CREATE INDEX "UsoIA_criadoEm_idx" ON "UsoIA"("criadoEm");

-- AddForeignKey
ALTER TABLE "HistoricoEmenda" ADD CONSTRAINT "HistoricoEmenda_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoEmenda" ADD CONSTRAINT "HistoricoEmenda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Histórico das emendas que já existiam: submissão e decisão da Comissão.
INSERT INTO "HistoricoEmenda" ("id", "emendaId", "de", "para", "criadoEm")
SELECT 'hist-sub-' || "id", "id", 'RASCUNHO', 'SUBMETIDA', "submetidaEm" FROM "Emenda" WHERE "submetidaEm" IS NOT NULL;
INSERT INTO "HistoricoEmenda" ("id", "emendaId", "de", "para", "texto", "usuarioId", "criadoEm")
SELECT 'hist-dec-' || "id", "id", 'SUBMETIDA', "status", "parecerTramitacao", "tramitadaPorId", "tramitadaEm"
FROM "Emenda" WHERE "tramitadaEm" IS NOT NULL AND "status" IN ('APROVADA', 'REJEITADA');
