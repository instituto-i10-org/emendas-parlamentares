# Emendas360

Sistema de gestão das **emendas impositivas** ao orçamento municipal (PPA / LDO /
LOA). O vereador apresenta a emenda em três etapas guiadas — objeto e destino,
classificação sugerida sobre a LOA, plano de trabalho — sem digitar códigos
orçamentários; a Câmara tramita; o Executivo se manifesta sobre a viabilidade e
registra a execução; o cidadão acompanha pelo portal público.

Um deploy atende **um município**. Tudo o que é do município (cota, % mínimo da
saúde, códigos AUDESP, LOA, destinos, biblioteca de objetos, base legal) fica no
banco e se edita em Configurações — nada disso está no código.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **PostgreSQL** + **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Auth.js** (next-auth v5) — credenciais + JWT
- **Tailwind CSS v4** + componentes radix/shadcn · **Zod** · **Vitest**
- Deploy na **Vercel** (banco no Neon), CI no **GitHub Actions**

## Módulos

| Grupo | Telas |
| --- | --- |
| Acompanhar | **Painel** (cotas e consolidação) · **Tramitação** (aprovar, devolver, reabrir) |
| Operar | **Emendas** (lista, criação em 3 etapas, plano de trabalho para impressão) · **Vereador 360** |
| Executivo | **Viabilidade** (parecer técnico) · **Execução** (empenho, liquidação, pagamento) · **Planejamento** (instrumentos, base de dotações, PL × lei) |
| Governança | **Conformidade** (espelho da fiscalização do TCE-SP) · **Configurações** · **Portal público** |

A landing (`/`) e o portal público (`/publica`) não exigem login; o portal nunca
mostra rascunhos. Depois do login, cada perfil cai no **Início** (`/inicio`),
com atalhos para o que ele pode fazer.

## Acesso

Não há papéis fixos: os **perfis de acesso** são cadastrados em Configurações,
cada um com o seu conjunto de permissões, e o menu mostra só o que o perfil
alcança (`src/config/navegacao.ts`). As permissões são checadas de novo no
servidor (`src/lib/authz.ts`, `requireAccess` em `src/lib/access.ts`), e toda
mutação relevante gera `AuditLog`.

## Regras do domínio

- **Motor RIEP** (`src/lib/riep/`) — puro, sem banco: reconhece o objeto,
  classifica sobre a LOA, calcula a cota em duas parcelas (saúde pelo IC-CO
  1002), escolhe o modelo do plano de trabalho e valida a etapa 3. Roda igual
  no navegador e no servidor; o servidor refaz a classificação ao gravar.
- **Emendas** (`src/lib/emendas/`) — carga do contexto do exercício, consultas,
  consolidação da cota e regras da execução (empenho ≤ valor, liquidado ≤
  empenhado, pago ≤ liquidado; estorno é valor negativo).
- **Orçamento** (`src/lib/orcamento/`) — códigos de exibição da dotação e
  validação da planilha de importação da base.
- A numeração da emenda (`ContadorEmenda`) só acontece na submissão.

## Setup local

Pré-requisitos: Node.js LTS e Docker.

```bash
npm install
cp .env.example .env          # DATABASE_URL/DIRECT_URL do banco local, AUTH_SECRET, SEED_SENHA
npx auth secret               # gera AUTH_SECRET
npm run db:up                 # Postgres 17 em Docker, porta 5440
npx prisma migrate deploy     # aplica as migrations
npm run seed                  # Mogi Guaçu: LOA 2026, PPA, destinos, emendas importadas
PORT=3100 npm run dev
```

As contas do seed são `admin`, `executivo`, `presidente`, `comissao` e
`vereador` `@emendas360.local`, com a senha de `SEED_SENHA` (sem ela, o seed
gera uma senha por conta e a mostra uma única vez). Para redefinir:
`npm run db:senha -- <email>` ou `npm run db:senha -- --todas`.

## Modelo de conexão (Prisma 7)

- **Runtime** (`src/lib/prisma.ts`) → `@prisma/adapter-pg` com `DATABASE_URL`
  (pooled no Neon).
- **Migrations / CLI** (`prisma.config.ts`) → `DIRECT_URL` (direta).

## Importação da base de dotações

Planejamento → Instrumentos → *Importar base*. Planilha **CSV/XLSX**, uma linha
por dotação:

```
obrigatórias: orgao_codigo, orgao_nome, unidade_codigo, unidade_nome,
              funcao_codigo, subfuncao_codigo, subfuncao_nome, programa_codigo,
              programa_nome, acao_codigo, acao_nome, natureza_codigo,
              fonte_codigo, valor_autorizado
opcionais:    funcao_nome, acao_tipo, natureza_nome, fonte_nome, ficha, pagina
```

Qualquer erro rejeita o arquivo inteiro; dotações já usadas por emendas são
preservadas. Formate as colunas de código como **Texto** para manter os zeros à
esquerda.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Postgres pooled — runtime |
| `DIRECT_URL` | Postgres direto — migrations |
| `AUTH_SECRET` | Segredo do Auth.js (`npx auth secret`) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | "Melhorar texto" na criação da emenda (opcional) |
| `SEED_SENHA` | Senha das contas do seed |
| `DEMO_SENHA` / `DEMO_LOGIN` | Acesso rápido de demonstração na tela de login |

## Scripts

```bash
npm run dev         # desenvolvimento
npm run build       # prisma generate + next build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (motor RIEP, execução, importação, authz)
npm run db:up       # sobe o Postgres local
npm run db:migrate  # prisma migrate dev
npm run seed        # carrega os dados do município
npm run db:senha    # redefine senhas
```

## Deploy (Vercel)

- **Push na `main` publica em produção.** O build roda `prisma generate` →
  `prisma migrate deploy` (se houver `DIRECT_URL`) → `next build`.
- Confira as variáveis do ambiente de Preview antes de publicar: se apontarem
  para o banco de produção, um preview também aplica migrations nele.
- CI (`.github/workflows/ci.yml`): lint + typecheck + testes + build, e um job
  que aplica as migrations e o seed num Postgres limpo.

## Segurança

- Validação **Zod** em todas as bordas (server actions e importação).
- Headers de segurança (`next.config.ts`), `poweredByHeader` desligado.
- Rate limiting nas ações sensíveis (submeter, importar, melhorar texto,
  pesquisa de preços e de CNPJ).
- Autorização checada no servidor; nunca confia em IDs vindos do cliente.
