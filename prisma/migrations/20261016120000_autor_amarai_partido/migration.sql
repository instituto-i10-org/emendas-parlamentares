-- O partido de duas palavras ficou grudado no nome na carga das emendas de
-- 2026 ("Amarai de Oliveira Gomes - UNIÃO BRASIL"). Separa nome e partido.
-- Idempotente; não mexe se já existir um autor com o nome certo.
UPDATE "Autor"
   SET nome = 'Amarai de Oliveira Gomes', partido = 'UNIÃO', "updatedAt" = now()
 WHERE nome = 'Amarai de Oliveira Gomes - UNIÃO BRASIL'
   AND NOT EXISTS (SELECT 1 FROM "Autor" WHERE nome = 'Amarai de Oliveira Gomes');
