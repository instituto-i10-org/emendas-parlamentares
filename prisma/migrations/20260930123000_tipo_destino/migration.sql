-- CreateTable
CREATE TABLE "TipoDestino" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "padrao" TEXT NOT NULL,
    "pistas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subfuncao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoDestino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoDestino_nome_key" ON "TipoDestino"("nome");
