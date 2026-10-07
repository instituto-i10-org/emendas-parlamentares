-- CreateTable
CREATE TABLE "GuiaVisto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "guia" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "concluidoEm" TIMESTAMP(3),
    "puladoEm" TIMESTAMP(3),
    "pulouTodos" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuiaVisto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuiaVisto_usuarioId_guia_key" ON "GuiaVisto"("usuarioId", "guia");

-- AddForeignKey
ALTER TABLE "GuiaVisto" ADD CONSTRAINT "GuiaVisto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
