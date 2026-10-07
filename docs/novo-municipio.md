# Novo município

Cada município é uma instalação própria: endereço, banco de dados e
armazenamento de arquivos separados. O código é o mesmo; nada do município
entra no código.

## 1. Parte técnica (feita uma vez, por quem cuida da infraestrutura)

1. **Banco de dados**: criar um banco Postgres novo (Neon, região São Paulo).
   Guardar as duas URLs: com pooling (`DATABASE_URL`) e direta (`DIRECT_URL`).
2. **Projeto na Vercel**: importar o mesmo repositório num projeto novo, região
   `gru1`. Variáveis de ambiente (Production e Preview):
   - `DATABASE_URL` e `DIRECT_URL` do banco novo;
   - `AUTH_SECRET` novo (`openssl rand -base64 32`);
   - `DEMO_LOGIN=false` e `DEMO_SENHA` vazio;
   - `OPENAI_API_KEY` (leitura de PDF na importação e "Melhorar texto"; sem ela,
     só esses dois recursos ficam indisponíveis).
3. **Armazenamento de arquivos**: criar um Blob store (Storage › Blob) ligado ao
   projeto novo. Isso cria `BLOB_READ_WRITE_TOKEN`. Sem ele, o envio de PDF das
   leis, das normas e das planilhas não funciona em produção.
4. **Primeira publicação**: o build da Vercel aplica as migrações no banco novo
   (só no ambiente de produção; ver `vercel.json`).
5. **Iniciar o sistema vazio**, do terminal, apontando para o banco novo:

   ```
   ( vercel env pull .env.novo --environment=production --scope <time> --yes \
     && set -a && source ./.env.novo && set +a \
     && PERMITIR_BANCO_REMOTO=1 npm run db:iniciar-vazio -- admin@camara.sp.gov.br ; \
     rm -f .env.novo )
   ```

   O comando cria os seis perfis padrão (Administrador Geral, Poder Executivo,
   Presidente da Câmara, Comissão de Finanças e Orçamento, Vereador, Somente
   consulta), sem usuários, a conta do administrador e o cadastro do município
   em branco. A **senha temporária** aparece uma vez no terminal: entregue-a ao
   administrador por um canal seguro. O comando recusa banco que já tenha
   exercício ou usuário.

Para testar localmente: `npm run test:e2e:vazio` recria o banco `emendas_vazio`
no Postgres local, roda o comando e confere que todas as telas abrem.

## 2. Parte pela tela (o administrador da Câmara)

No primeiro acesso, o sistema pede a troca da senha temporária e a conferência
do nome e do e-mail. Depois, em **Configurações**:

1. **Município**: nome, UF, código IBGE, nome da Câmara e da Prefeitura. Até o
   nome ser preenchido, o portal mostra "Município não configurado".
2. **Exercício e parâmetros**: criar o exercício (ano) e preencher cota
   individual, percentual da saúde, prazos e códigos AUDESP.
3. **Planejamento** (perfil Poder Executivo ou o administrador): cadastrar o
   projeto de lei orçamentária com o PDF e **importar a base** (PDF, CSV ou
   XLSX), conferindo os totais antes de gravar. LDO e PPA também.
4. **Áreas**: Saúde, Educação etc., com os órgãos do orçamento de cada uma.
5. **Tipos de destino**: UBS, EMEF, CRAS… e as palavras que os identificam.
6. **Destinos**: um a um, ou **Importar planilha** (modelo para baixar na
   própria janela).
7. **Usuários**: vereadores (com o nome do autor), Comissão, Presidente,
   Executivo. Cada conta nova troca a senha no primeiro acesso.
8. **Validação**: fundamento legal de cada parâmetro e o modo de cada
   verificação.
9. **Base legal**: Lei Orgânica (com vigência), Regimento Interno e demais atos.
10. **Portal e manual**: escolher o ato que institui o manual e publicar.

Opcional: em Exercício e parâmetros, **Importar emendas de anos anteriores**
(histórico do portal e dos painéis).

## 3. Catálogos editados pela tela e os scripts de carga

Áreas, tipos de destino e objetos da biblioteca podem nascer de um arquivo
(`prisma/dados/<município>/biblioteca-objetos.json`, pelo seed ou por
`npm run db:recarregar-catalogos`) e depois ser editados pela tela. Para que
uma recarga não desfaça o trabalho do administrador, os scripts **não
regravam o que foi editado pela tela**: todo registro com auditoria feita por
uma pessoa (criado, alterado, renomeado, excluído ou reordenado em
Configurações) fica como está, e a listagem diz quais são:

```
npm run db:recarregar-catalogos            # lista, inclusive "estes N registros foram editados pela tela"
CONFIRMAR=1 npm run db:recarregar-catalogos  # grava o resto, mantém os editados
```

Para regravar também os editados a partir do arquivo (o que foi feito pela tela
se perde), é preciso pedir explicitamente:

```
SOBRESCREVER_EDICOES=1 CONFIRMAR=1 npm run db:recarregar-catalogos
```

Em banco novo, sem nenhuma edição pela tela, o arquivo vale inteiro. A regra
está em `src/lib/cadastros/catalogos-protecao.ts`.
