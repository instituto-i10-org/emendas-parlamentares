<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Como publicar as alterações neste projeto

Quem trabalha aqui quer **ver a mudança no ar**, não montar ambiente. Leia esta
seção antes de propor qualquer coisa que envolva rodar o sistema.

## Publicar é dar push na `main`

```
git add -A
git commit -m "descrição curta do que mudou"
git push origin main
```

É só isso. O push na `main` dispara o deploy de produção na Vercel
automaticamente — leva de 1 a 3 minutos. Depois abra:

**https://emendas-parlamentares-eight.vercel.app**

Não existe passo manual de deploy. Não rode `vercel --prod`, não peça para
ninguém apertar botão: o push É a publicação.

Enquanto o deploy roda, dá para acompanhar em
https://vercel.com/ti-7875s-projects/emendas-parlamentares

## Mudou o banco de dados? Já vai junto

Se você alterou `prisma/schema.prisma`, crie a migração normalmente
(`npx prisma migrate dev --name descricao-curta`) e **commite a pasta gerada em
`prisma/migrations/`**. O build da Vercel aplica as migrações pendentes sozinho,
antes de subir o código. Não é preciso mexer no banco de produção à mão — e não
se deve.

Atenção ao contrário disso: uma migração destrutiva (apagar coluna, apagar
tabela) chega à produção no mesmo push, sem revisão de ninguém. Migração que
remove dado precisa ser combinada com o responsável antes.

## Ambiente local

O banco de desenvolvimento é um Postgres 17 em Docker (`docker-compose.yml`,
container `emendas-v2-db`, porta 5440). Para subir tudo do zero:

```
npm run db:up         # sobe o Postgres local
npx prisma migrate deploy
npm run seed          # carrega Mogi Guaçu (LOA 2026, PPA, destinos, emendas)
PORT=3100 npm run dev
```

As contas do seed são `*@emendas360.local`; a senha vem de `SEED_SENHA` no
`.env` (ou é gerada e mostrada uma vez). `npm run db:senha -- email` redefine.

Antes de dar push, rode:

```
npx tsc --noEmit      # erros de tipo
npx eslint src prisma # padrão de código
npx vitest run        # regras de negócio (puras, sem banco)
```

Se algum reclamar, conserte antes de publicar — o que vai para a `main` vai
para a produção.

**Atenção ao banco:** `prisma migrate reset` apaga tudo. Nunca rode contra um
banco que não seja o local.

## O que nunca entra no repositório

Vídeo, tutorial gravado, apresentação e material de divulgação ficam fora. Se
existirem as pastas `video/`, `video-final/` ou `apresentacoes/`, ignore-as: elas
não são versionadas de propósito, e commitá-las deixa o repositório pesado sem
necessidade.

Segredo nenhum vai para o código. As chaves e as URLs de banco vivem nas
variáveis de ambiente da Vercel; o `.env` local é ignorado pelo git e deve
continuar assim.

## Onde ficam as regras do domínio

O motor RIEP (`src/lib/riep/`) concentra as regras das emendas impositivas:
reconhecimento do objeto, classificação contra a LOA, cota em duas parcelas
(saúde pelo IC-CO 1002), modelos de plano de trabalho, referências de preço e a
validação da etapa 3. É puro — sem banco e sem DOM — e roda igual no navegador
e no servidor; o servidor refaz a classificação ao gravar.

Os parâmetros do município (cota, % da saúde, códigos AUDESP, áreas de
aplicação, biblioteca de objetos) ficam no banco e se editam em Configurações.
Nada de Mogi Guaçu no código: os dados reais entram por `prisma/seed/` a partir
de `prisma/dados/mogi-guacu/`.

Mudou a regra, atualize o teste no mesmo commit (`src/lib/riep/__tests__/`).

## Documentação do sistema

`docs/better/` descreve a versão anterior do sistema (antes da reescrita v2) e
serve só como referência histórica. O modelo de dados atual está comentado em
`prisma/schema.prisma`.
