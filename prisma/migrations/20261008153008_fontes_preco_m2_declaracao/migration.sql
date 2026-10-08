-- AlterTable
ALTER TABLE "ConfiguracaoExercicio" ADD COLUMN     "custoM2Competencia" TEXT,
ADD COLUMN     "custoM2Fonte" TEXT,
ADD COLUMN     "custoM2Referencia" DECIMAL(12,2),
ADD COLUMN     "custoM2Url" TEXT;

-- AlterTable
ALTER TABLE "Emenda" ADD COLUMN     "declaracaoPrecos" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FontePrecoOficial" ADD COLUMN     "assinaturaPaga" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "destaque" BOOLEAN NOT NULL DEFAULT false;

-- Dados (pedidos do Dr. Emerson, 08/10/2026). Só altera o que ainda está como o
-- seed gravou: o que foi editado pela tela não é tocado.
UPDATE "FontePrecoOficial"
SET "url" = 'https://pesquisaprecos.compras.gov.br/pesquisa-precos-frontend-semlogin/',
    "orientacao" = 'Versão pública, sem login. Pesquise pelo nome ou pelo código CATMAT/CATSER do item, limite às compras dos últimos 12 meses e anote a mediana e quantas compras entraram na conta.',
    "updatedAt" = now()
WHERE "nome" = 'Pesquisa de Preços (Compras.gov.br)'
  AND "url" = 'https://www.gov.br/compras/pt-br/sistemas/conheca-o-compras/pesquisa-de-precos';

UPDATE "FontePrecoOficial"
SET "url" = 'https://pncp.gov.br/app/atas?q={item}&status=vigente&ufs=SP&pagina=1', "updatedAt" = now()
WHERE "nome" = 'Atas de registro de preços (PNCP)' AND "url" = 'https://pncp.gov.br/app/atas';

UPDATE "FontePrecoOficial"
SET "url" = 'https://pncp.gov.br/app/contratos?q={item}&pagina=1', "updatedAt" = now()
WHERE "nome" = 'Contratos de outros órgãos (PNCP)' AND "url" = 'https://pncp.gov.br/app/contratos';

UPDATE "FontePrecoOficial"
SET "assinaturaPaga" = true, "updatedAt" = now()
WHERE "nome" = 'Tabela CPOS/CDHU (São Paulo)';

INSERT INTO "FontePrecoOficial" ("id", "nome", "url", "orientacao", "aplicaA", "tipo", "destaque", "assinaturaPaga", "ordem", "ativo", "createdAt", "updatedAt")
SELECT 'fp_banco_i10', 'Banco de preços i10', 'https://pnigp.vercel.app/banco-precos',
       'Mediana e faixa de preço de compras públicas do mesmo item. Use "Ver referência" na linha de cada item para consultar sem sair da emenda.',
       ARRAY[]::TEXT[], 'PAINEL', true, false, 1, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "FontePrecoOficial" WHERE "nome" = 'Banco de preços i10');

INSERT INTO "FontePrecoOficial" ("id", "nome", "url", "orientacao", "aplicaA", "tipo", "destaque", "assinaturaPaga", "ordem", "ativo", "createdAt", "updatedAt")
SELECT 'fp_sinapi_m2', 'Custo médio do m² — SINAPI/IBGE', 'https://ftp.ibge.gov.br/Precos_Custos_e_Indices_da_Construcao_Civil/Fasciculo_Indicadores_IBGE/',
       'Para obras: valor oficial do m² de construção em São Paulo, publicado todo mês pelo IBGE (abra o caderno do mês mais recente). Use com o item único em m².',
       ARRAY['OBRAS']::TEXT[], 'TABELA_OFICIAL', false, false, 65, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "FontePrecoOficial" WHERE "nome" = 'Custo médio do m² — SINAPI/IBGE');

-- Custo de referência do m² de 2027: SINAPI/IBGE, São Paulo, agosto de 2026,
-- com desoneração (R$ 2.209,93 sem desoneração), caderno do IBGE.
UPDATE "ConfiguracaoExercicio" c
SET "custoM2Referencia" = 2089.88,
    "custoM2Competencia" = 'ago/2026',
    "custoM2Fonte" = 'Custo médio do m² SINAPI/IBGE — São Paulo, com desoneração',
    "custoM2Url" = 'https://ftp.ibge.gov.br/Precos_Custos_e_Indices_da_Construcao_Civil/Fasciculo_Indicadores_IBGE/sinapi_202608caderno.pdf'
FROM "Exercicio" e
WHERE e."id" = c."exercicioId" AND e."ano" = 2027 AND c."custoM2Referencia" IS NULL;
