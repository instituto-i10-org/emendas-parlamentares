# Plano de correção — Relatório de Testes do Dr. Emerson (29/09/2026)

Versão consolidada em 30/09/2026, com as sete decisões fechadas. Substitui os adendos anteriores.

Instância: `emendas-parlamentares-eight.vercel.app` · Exercício 2026 · 21 emendas de teste (nº 352 a 372).
Relatório: `v2-emendas-impositivas/Relatório de Testes - Emendas360 (29-09-2026).docx`.
Fontes da LOA: `v2-emendas-impositivas/Ajustes Emendas Impositivas/LOA 2026 - fontes oficiais/` (ver `FONTES.md`).

Status: **executado em 30/09/2026.** Fases 0 a 6 concluídas; o que resta é a operação em produção descrita na Fase 6, item 5, que o Diego roda pelo terminal.

Observações da execução:
- A7 se confirmou como artefato da base: no QDD oficial a unidade 13.03 tem 4.4.90.52 (Rede Saúde Mental, ficha 618). O motor passa a enquadrar equipamento para o CAPS AD.
- Os Anexos da lei trazem também o QDD consolidado de Câmara, SAMAE, FEG e Hospital, em formato compacto. O extrator cobre as duas fontes: 857 fichas, 28 órgãos conciliados ao centavo com o Anexo 2.
- As dotações continuam no instrumento "PL 275/2025", porque é ele que o app usa como base das emendas; a base é a do QDD sancionado e o rótulo na tela já diz "Lei 6.246/2025".
- Tipos de destino (EMEI, CAPS, UBS...) viraram catálogo em banco (`TipoDestino`): sugerem a subfunção e dão ao motor pistas de aderência ("CAPS" → "saúde mental"). Editáveis na aba Destinos.
- G6 (unidade da referência ≠ unidade do item) foi implementado em seguida, com autorização do Diego: o item da memória de cálculo ganhou campo de unidade (preenchido pela referência aprovada), a validação avisa quando difere da unidade da referência, e a impressão do plano mostra a unidade do item.

---

## 1. Diagnóstico

### 1.1 Achados numerados do relatório

| Achado | Gravidade | Causa confirmada no código | Fase |
| --- | --- | --- | --- |
| A1 — material de consumo aceito em 3.3.90.39 | Alta | `analisaItens` compara só custeio × capital, nunca o elemento (30 × 39); `validar` também não cruza o elemento do objeto com o da dotação gravada | 2 |
| A2 — candidatas sem relação com o objeto | Alta | "material de consumo/expediente/higiene" não estão na biblioteca; a palavra "custeio" faz `interpretar` inferir elemento 39; `classificar` trava no elemento inferido e, sem aderência, ordena por valor autorizado | 2 |
| A5 — "Nenhuma linha entrega o objeto" inconsistente | Média | Objeto inferido pula a checagem; os casos em 39 eram todos inferidos | 2 |
| A3 — saúde bloqueada como Cultura/Esporte | Média | "oficina" só existe em Cultura e "material esportivo" só em Esporte, ambos estritos | 3 |
| A4 — EMEI/CEI em 12.361 | Média | "EMEI" não é termo; `Destino` não tem subfunção; a LOA tem 12.365 na UO 11.01 | 3 |
| A6 — pesquisa de preço sem relação | Média | `pesquisarPrecos` repassa a lista do PNIGP sem filtro de relevância | 4 |
| A8 — "Fora da reserva da saúde" sempre | Baixa | Aferição GLOBAL emite `warn` mesmo quando a cota restante alcança o mínimo | 4 |
| A9 — referência com amostra de 1 compra | Baixa | A amostra é exibida, mas não é gravada na referência nem validada | 4 |
| A7 — CAPS AD sem dotação de investimento | Baixa | A UO 13.03 não tem 4.4.90.52 na base carregada. **Pode ser artefato da base**, ver 1.3 | 1 |

A1, A2 e A5 são um único defeito com três sintomas. Evidência: a UO 13.01 (UBS) tem seis dotações 3.3.90.30 em "2001 — Atendimentos Atenção Básica" que o motor nunca ofereceu, porque restringiu ao elemento 39 e ordenou por valor, e "2183 — Benefício ao Trabalhador" é a maior dotação da unidade.

### 1.2 Pontos do relatório fora da numeração

| Trecho | Conferido no código | Fase |
| --- | --- | --- |
| §1 "nº 355 é duplicata do TESTE 10" | `salvarEmenda` não verifica duplicidade: mesmo autor, destino e objeto geram nova emenda numerada | 2 (G1) |
| §1 e §7: Vereador Exemplo entra no consolidado e na cota | `Autor` não tem marca de demonstração; portal público e painel listam qualquer autor | 5 (G2) |
| §2 "servidor revalidou e recusou parcela ≠ total" | Confirmado: `salvarEmenda` chama `validar()` | regressão (G7) |
| §2 objetos com prefixo "[TESTE nn]" | Inócuo; os testes reproduzem com o prefixo | 0 (G8) |
| A1 "cruzar o item **ou o objeto** com a dotação" | Só o item estava previsto; o objeto entra | 2 (G4) |
| A4 "EMEB Pe. Estevo" agrupada com EMEI/CEI | EMEB atende infantil **e** fundamental (Decisão 6) | 3 (G5) |
| A9 "unidade peça" | Unidade da referência não é conferida contra o item | 4 (G6) |
| §5 sete positivos | Todos confirmados no código | 6 (G7) |
| §6 emenda 373 (OSC, R$ 40.000) | Existe; não é da rodada | fica (Decisão 2) |
| §7 "repetir a rodada" | Ambiente precisa estar pronto | 6 (G9) |

### 1.3 A base orçamentária em produção está errada

A base `loa-2026.json` veio por OCR da revisão do anexo do PL 275/2025 (18/11/2025), anterior à votação. Cruzada com o QDD oficial da Lei 6.246/2025 (Portal da Transparência da Prefeitura, PDF nativo):

| | QDD oficial | Base em produção |
| --- | --- | --- |
| Fichas distintas | 660 | 374 (549 linhas, com repetição) |
| Valor igual | | 305 |
| Valor errado | | 63 |
| Fichas inexistentes | | 6 |
| Fichas faltando | 292 (R$ 265.462.061,22) | |
| Total da Prefeitura | R$ 722.938.503,22 (= Anexo 1 da lei) | R$ 698.337.052,03 |

A2, A4 e A7 dependem de quais dotações cada unidade tem. Corrigir o motor sobre a base errada daria resultado que muda na recarga. Por isso a recarga vem **antes** do motor.

---

## 2. Decisões fechadas (30/09/2026)

1. **Uma leva.** Todas as fases antes de publicar.
2. **Emenda 373 fica.** Citada na devolutiva; apagada só se ele pedir.
3. **A8 vira informativo**, seguindo a leitura dele, sem nova consulta.
4. **Vereador Exemplo recebe marca de demonstração.** Some do portal público e dos relatórios oficiais de impressão. Dentro do sistema (painel, Vereador 360, tramitação, cota) continua como vereador real. Na virada para uso real, a conta é desativada.
5. **LOA recarregada do QDD oficial**, por atualização ficha a ficha, nunca apagando a tabela.
6. **EMEB: subfunção sugerida nula.** A tela oferece 12.361 e 12.365 e o vereador escolhe. EMEI, CEI e creche → 365; EMEF → 361.
7. **Duplicidade bloqueia**, com confirmação explícita do proponente.

Ponto que segue autônomo: a recarga só para se alguma emenda de vereador real apontar para ficha que vai sumir ou mudar de valor. Hoje só existem as 21 de teste e a 373, então a expectativa é lista vazia.

---

## 3. Premissas e restrições do repositório

- **Regras de negócio não mudam.** Cota, reserva da saúde, tolerância de 10 %, ADPF 854 e as três etapas ficam como estão.
- **O motor RIEP é puro** (`src/lib/riep`). Toda correção nasce com teste reproduzindo o caso do relatório. Mudou a regra, o teste vai no mesmo commit (`AGENTS.md`).
- **Push na `main` publica** e o build aplica migrations. Não há passo manual de deploy. Migração destrutiva não entra sem combinar.
- **Operações de dados em produção são scripts de terminal, rodados pelo Diego** (decisão de 30/09). O `AGENTS.md` desaconselha mexer no banco de produção à mão; a mitigação é que cada script lista o efeito antes, só grava com `CONFIRMAR=1`, exige `PERMITIR_BANCO_REMOTO=1` para banco que não seja o local, e grava auditoria. O agente prepara e testa os scripts no banco local; quem os executa contra produção é o Diego, com `!` na sessão, porque `vercel env pull` e conexão ao banco remoto são bloqueados para o agente.
- **Dados de Mogi Guaçu só entram por `prisma/dados/mogi-guacu/` + seed.** Nada do município no código.
- Antes de cada push: `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`.

---

## 4. Fases

### Fase 0 — Reprodução (testes que falham hoje)

Arquivo: `src/lib/riep/__tests__/relatorio-2026-09-29.test.ts`, sobre `dados-reais.ts`.

1. Tabela com os 20 objetos do relatório, **com o prefixo "[TESTE nn]"**, destino (UO), execução DIRETA e a dotação esperada: elemento 30 na ação de custeio da unidade; EMEI/CEI em 365.
2. Afirmações por caso: primeira opção aderente; elemento 30 para material; item de material em dotação 39 gera bloqueio (A1); objeto reconhecido em dotação de elemento diferente gera bloqueio (G4); checagem "entrega o objeto" roda em 30 e em 39 (A5).
3. A3: CAPS II "oficinas terapêuticas" e Polo Academia "material esportivo" classificam como Saúde, sem CONFLITO.
4. A5 positivo: emenda 352 (objeto cita medicamentos, item genérico) continua com o aviso.
5. A7: fica marcado como "resultado depende da Fase 1"; o teste é escrito depois da recarga.
6. Duplicidade (G1): a comparação (autor, destino, objeto normalizado) vira função pura em `src/lib/emendas/`, testada no vitest; a consulta ao banco em `salvarEmenda` fica fina. O vitest do projeto é puro, sem banco (`vitest.config.ts`, `AGENTS.md`).

Critério de saída: suíte escrita e **falhando** nos pontos A1 a A5 e G1.

### Fase 1 — Recarga da LOA 2026 a partir do QDD oficial

Arquivos: novo `prisma/dados/mogi-guacu/extrair-qdd.ts`; `loa-2026.json` regenerado; `unidades-2026.json`; `prisma/seed/loa.ts`; `src/lib/actions/config.ts` (ação de recarga); tela de Configurações.

1. **Extração.** `pdftotext -layout` do QDD e parser por linha: "Órgão :" / "Unidade :" definem a UO; linha de ação traz função, subfunção, programa, projeto/atividade e nome; linha de natureza traz `3.3.9039`, fonte, aplicação, ficha e valor. Validado em rascunho: 660 fichas, soma exata.
2. **Formato** igual ao atual, com `inferida: false`, `fonte: "QDD Lei 6.246/2025, Portal da Transparência doc 13082"` e o texto bruto da linha para auditoria.
3. **Conciliação obrigatória** antes de gravar: soma por órgão = Anexo 2 "Natureza da Despesa por Órgão"; total = R$ 722.938.503,22; nenhuma ficha repetida; toda UO existe no cadastro de unidades (atualizado a partir do QDD).
4. **Gravação por ficha, preservando os ids.** Hoje o seed faz `upsert` por `(instrumento, codigo)`, e o `codigo` de exibição ("2183.39/445") é derivado do conjunto de linhas (`codigosDeExibicao`): com 660 linhas em vez de 549, vários códigos mudam, então ele não serve de chave. A recarga busca a linha existente por `(exercício, ficha)` e a atualiza no lugar (id preservado, logo o vínculo das emendas também); sem match, cria. Os códigos de exibição são regenerados sobre o conjunto completo e gravados em duas passagens dentro de uma transação, para não colidir com o índice único. As dotações passam a pertencer ao instrumento "Lei 6.246/2025" (já semeado como `LEI_APROVADA`), não mais ao "PL 275/2025". As 6 fichas inexistentes são desativadas, não apagadas. Nada é deletado.
5. **Trava de segurança.** Antes de gravar, listar emendas com `dotacaoId` apontando para ficha que será desativada ou terá valor alterado, filtrando autores não marcados como demonstração. Lista vazia: segue. Lista com item: para e mostra.
6. **Script `prisma/recarregar-loa.ts`** (`npm run db:recarregar-loa`), que roda o mesmo código do seed contra o banco atual, com a conciliação e a trava acima, e imprime o resultado (fichas criadas, atualizadas, desativadas). Sem `CONFIRMAR=1` só lista. Serve para produção agora e para a LOA 2027 depois.
7. **A7 reavaliado** sobre a base nova: conferir se a UO 13.03 tem 4.4.90.52. Registrar o resultado na devolutiva.
8. `dados-reais.ts` passa a ler o JSON novo; suítes existentes continuam verdes.

Critério de saída: JSON conciliado ao centavo; seed local recarrega; ação de recarga funciona no banco local; suítes verdes.

### Fase 2 — Motor: objeto, elemento e duplicidade (A1, A2, A5, G1, G4)

Arquivos: `src/lib/riep/interpretar.ts`, `classificar.ts`, `itens.ts`, `validar.ts`, `tipos.ts`; `biblioteca-objetos.json`; `src/lib/actions/emendas.ts`; `src/components/emenda/etapa1.tsx`.

1. **Biblioteca — objetos de custeio, elemento 30:** "Material de consumo" (material de consumo, insumos), "Material de expediente" (material de expediente, papelaria, material de escritório), "Material de higiene e limpeza" (material de higiene, material de limpeza, produtos de limpeza), "Material odontológico" (Saúde, 301), "Material para atividades terapêuticas" (material terapêutico, atividades terapêuticas, oficina terapêutica — Saúde, 302). "Material hospitalar" ganha "material de consumo ambulatorial".
2. **`interpretar.ts`:** inferência de custeio sem termo não fixa elemento 39. Elemento fica nulo e `classificar` pende para 30 se o texto tem "material/insumo/gênero" e para 39 se tem "serviço/contratação/manutenção de". A decisão vai na `explicacao`.
3. **`classificar.ts`:** objeto inferido não passa pelo funil `porElemento` (elemento vira pontuação); ordenação `aderente` → `sobreposicao` → `pontos` → `autorizado`; em `semAderencia`, se nenhuma candidata é aderente, `opcoes` vem vazia e a tela só oferece reescrever ou análise técnica.
4. **`itens.ts`:** novo resultado `elem` em `ResultadoLinha`; item reconhecido com elemento diferente do da dotação é bloqueio; `bloqueia()` inclui `elem`; a checagem "entrega o objeto" roda também para objeto inferido, por elemento e natureza.
5. **`validar.ts` (G4):** objeto reconhecido com elemento diferente do da dotação gravada é bloqueio, independente dos itens. Mensagens apontam o caminho: trocar a dotação no passo 1 ou trocar o item.
6. **Duplicidade (G1) em `salvarEmenda`:** antes de numerar, buscar emenda do mesmo autor e exercício, não rascunho, com mesmo destino e objeto normalizado. Existindo, devolver bloqueio "Possível duplicata da emenda nº X"; segue só com `confirmarDuplicata: true` vindo da tela, que mostra a emenda parecida.
7. **Tela etapa 1:** bloco "Nenhuma ação corresponde ao objeto" com lista vazia; marca de aderência por opção. Sem mudar layout.

Critério de saída: Fase 0 verde em A1, A2, A5, G1, G4; suítes antigas verdes; typecheck e lint limpos.

### Fase 3 — Biblioteca e destino: saúde e educação (A3, A4, G5)

Arquivos: `biblioteca-objetos.json`; `prisma/schema.prisma` (+ migration aditiva); `destinos-2026.json`; `prisma/seed/destinos.ts`; `src/lib/riep/tipos.ts`, `classificar.ts`; montagem de `DestinoMotor`; tela de destino em Configurações.

1. **Termos de Saúde:** "atividade física", "práticas corporais", "academia da saúde", "promoção da saúde", "oficina terapêutica". Como `interpretar` escolhe o termo mais longo, eles vencem "oficina" e "material esportivo".
2. **Precedência do destino, restrita:** objeto estrito de outra área + destino do órgão 13 + termo de Saúde no texto → não é CONFLITO. Fora disso, CONFLITO continua (ambulância para escola segue bloqueada).
3. **`Destino.subfuncaoSugerida String?`.** Inferida no seed lendo o **prefixo de `nome`** ("EMEI Aida Rocha") e o **sufixo de `nomeOficial`** ("AIDA ROCHA EMEI"): EMEI, CEI, creche → 365; EMEF → 361; **EMEB → nula**; demais → nula. Campo editável na tela de destino, só para execução direta.
4. `DestinoMotor.subfuncao`; `classificar` usa `obj.subfuncao ?? destino.subfuncao` no funil. Quando é nula e a unidade tem mais de uma subfunção de educação, as duas aparecem como opções.

Critério de saída: A3 e A4 verdes; migration aditiva pequena; seed local recarrega.

### Fase 4 — Preços e validações menores (A6, A8, A9, G6)

Arquivos: `src/lib/servicos/precos.ts`; `src/components/emenda/pesquisa-preco.tsx`; `src/lib/riep/validar.ts`; gravação da referência em `src/lib/actions/`.

1. **A6:** função pura de escore por palavras da consulta presentes na descrição (sem `TOKENS_FRACOS`); manter escore ≥ 1; ordenar por escore, depois amostra; se zerar, mostrar 10 originais com aviso "resultados aproximados"; limite 30.
2. **A8:** aferição GLOBAL com `sobra >= faltaS` passa de `warn` para `ok`, título "Consome a parcela de demais áreas", texto com o que falta em saúde. `bad` permanece quando a sobra não cobre. INDIVIDUAL continua `warn`.
3. **A9 e G6:** gravar `campos.amostra` e `unidade` da captura ao aprovar; `warn` "Amostra de preço pequena" abaixo de 3 compras (Lei 14.133/2021 art. 23; IN SEGES 65/2021); aviso informativo quando a unidade da referência não bate com a do item. Nada bloqueia.

Critério de saída: teste do escore; testes de `validar` para A8 e A9; busca por "material de consumo" conferida na tela.

### Fase 5 — Demonstração e limpeza (G2, Fase de dados)

Arquivos: `prisma/schema.prisma` (`Autor.demonstracao Boolean @default(false)`, migration aditiva); `prisma/seed/acesso.ts`; `src/app/publica/**`; painel, relatórios de impressão; `prisma/apagar-emenda.ts` (commit) e novo `prisma/apagar-emendas-lote.ts`; novo `prisma/recarregar-catalogos.ts`.

1. **Marca de demonstração** no Vereador Exemplo. Excluído do portal público e dos relatórios oficiais de impressão. Painel, Vereador 360, tramitação e cota não mudam.
2. **Script `prisma/apagar-emendas-lote.ts`** (`npm run db:apagar-emendas -- 352-372 vereador@emendas360.local`): só aceita autor com a marca de demonstração, lista o que vai apagar (número, objeto, valor) e só apaga com `CONFIRMAR=1`. Cascata igual ao script existente; ajusta o contador só se forem as últimas. Auditoria registrada.
3. Emendas 352 a 372 saem por esse script. **A 373 fica** por estar fora do intervalo.
4. **Script `prisma/recarregar-catalogos.ts`** (`npm run db:recarregar-catalogos`): áreas, biblioteca de objetos e subfunção sugerida dos destinos, a partir dos JSONs. Mesmas proteções.
5. Cota volta sozinha: `aplicadoDoAutor` soma em tempo real.

Critério de saída: portal público sem o Vereador Exemplo; os três scripts testados no banco local com as 21 emendas semeadas.

### Fase 6 — Verificação, publicação e devolutiva (G7, G9)

1. `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, `npm run build`.
2. Banco local do zero (`db:up`, `migrate deploy`, `seed`) e refazer pela tela TESTE 01, 03, 04, 07, 17 e 18. Capturas para a devolutiva.
3. **Regressão dos positivos:** três etapas com resumo lateral e cota ao vivo; ÓBICE em investimento sem dotação, com sugestão; pré-preenchimento do plano; recusa no servidor com parcela divergente; tolerância de 10 %; declaração ADPF 854 obrigatória; cota atualizada após submissão e após exclusão.
4. Commits por fase, mensagens citando os achados. Push na `main`. Acompanhar o deploy.
5. **Em produção, pelo terminal, o Diego roda** (com `!` na sessão), nesta ordem, depois do deploy no ar:

   ```
   cd .../prototipo && vercel env pull .env.neon --environment=production \
     --scope ti-7875s-projects --yes && set -a && source ./.env.neon && set +a \
     && PERMITIR_BANCO_REMOTO=1 npm run db:recarregar-loa \
     && PERMITIR_BANCO_REMOTO=1 CONFIRMAR=1 npm run db:recarregar-loa \
     && PERMITIR_BANCO_REMOTO=1 npm run db:recarregar-catalogos \
     && PERMITIR_BANCO_REMOTO=1 CONFIRMAR=1 npm run db:recarregar-catalogos \
     && PERMITIR_BANCO_REMOTO=1 npm run db:apagar-emendas -- 352-372 vereador@emendas360.local \
     && PERMITIR_BANCO_REMOTO=1 CONFIRMAR=1 npm run db:apagar-emendas -- 352-372 vereador@emendas360.local; \
     rm -f .env.neon
   ```

   Cada script roda duas vezes: a primeira só lista, a segunda grava. Se a listagem da recarga da LOA acusar emenda de autor real apontando para ficha que muda, a segunda chamada é recusada e o agente é avisado. O agente entrega o comando final pronto, com os nomes definitivos dos scripts. Depois, conferir que a conta de teste segue ativa, com cota íntegra e zero emendas.
6. **Devolutiva ao Dr. Emerson:** página curta, achado por achado, com o que mudou, a decisão em A8, a explicação da EMEB, o resultado de A7 sobre a base oficial, a nota sobre a base recarregada, e a lista de cenários da rodada 2 com o comportamento esperado em cada um.

---

## 5. Ordem e estimativa

| Ordem | Fase | Depende de | Estimativa |
| --- | --- | --- | --- |
| 1 | 0 — reprodução | — | 1,5 h |
| 2 | 1 — recarga da LOA | 0 | 2,5 h |
| 3 | 2 — motor e duplicidade | 1 | 3,5 h |
| 4 | 3 — biblioteca e destino | 2 | 2 h |
| 5 | 4 — preços e validações | — | 1,5 h |
| 6 | 5 — demonstração e limpeza | — | 1 h |
| 7 | 6 — verificação e publicação | todas | 1,5 h |

Total aproximado: **13,5 h**, uma jornada e meia. As Fases 4 e 5 correm em paralelo às Fases 1 a 3.

---

## 6. Riscos

- **Recarga da LOA muda o chão do motor.** Por isso ela vem antes do motor e a Fase 0 é escrita para valer sobre a base nova. Resultado do A7 só se conhece depois.
- **Ampliar a biblioteca pode mudar classificações que hoje funcionam.** As suítes existentes são o guarda-corpo; rodar a cada objeto acrescentado.
- **Precedência do destino (A3)** é a regra mais delicada; fica restrita a órgão 13 + termo de Saúde.
- **Scripts contra o banco de produção** são rodados pelo Diego. Cada um lista o efeito antes, só grava com `CONFIRMAR=1`, exige `PERMITIR_BANCO_REMOTO=1` e grava auditoria. Nenhum apaga dotação ou emenda de autor real. O `.env.neon` é apagado ao fim.
- **Os códigos de exibição das dotações mudam com a recarga.** "2183.39/445" do relatório pode virar outro código, porque o sufixo depende de quantas vezes a ação se repete. As emendas guardam o id, não o código, então nada quebra; mas a devolutiva ao Dr. Emerson deve avisar, para ele não procurar os códigos antigos.
- **A6 depende da API do PNIGP.** O filtro é local; se a API mudar, degrada para "mostrar tudo", nunca para "não mostrar nada".
- **`docs/better/` é histórico da v1** (`AGENTS.md`). Este plano fica em `docs/`.

## 7. Fora do escopo

- OSC, investimento/obras, estouro de cota, tramitação e viabilidade: rodada 2 do Dr. Emerson.
- Reclassificação automática de emendas existentes.
- Importar as 351 emendas do PL com dotação individual (o seed traz só totais por autor).
