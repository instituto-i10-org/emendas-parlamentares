-- CreateTable
CREATE TABLE "CoautorEmenda" (
    "id" TEXT NOT NULL,
    "emendaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CoautorEmenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoautorEmenda_autorId_idx" ON "CoautorEmenda"("autorId");

-- CreateIndex
CREATE UNIQUE INDEX "CoautorEmenda_emendaId_autorId_key" ON "CoautorEmenda"("emendaId", "autorId");

-- AddForeignKey
ALTER TABLE "CoautorEmenda" ADD CONSTRAINT "CoautorEmenda_emendaId_fkey" FOREIGN KEY ("emendaId") REFERENCES "Emenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoautorEmenda" ADD CONSTRAINT "CoautorEmenda_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Autor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
