# Formulário da prova de conceito — Mogi Guaçu

Situação de cada item do formulário (43 itens: 35 obrigatórios e 8
facultativos) no sistema de Mogi Guaçu, com a tela, o caminho, a conta usada e
a captura gerada pelo ensaio automático (`npm run prova`, capturas em
`docs/prova/capturas/item-N.N.png`, fora do repositório).

Regra da prova: nenhum "não atende" entre os obrigatórios e no máximo cinco
"atende parcialmente".

**Resultado:** obrigatórios: 30 atendem e 5 atendem parcialmente. Facultativos:
7 atendem e 1 não atende.

Os cinco parciais (3.1, 3.2, 3.3, 5.1 e 5.2) e o facultativo 3.4 tratam da
tela de apresentação da emenda. Ela foi aprovada como está pelo Dr. Emerson:
três etapas, o sistema encontra a dotação a partir do objeto, plano de trabalho
exigido de todos e preço informado com fonte oficial. O formulário descreve uma
versão anterior do sistema; esses itens ficaram como estão por decisão.

| Item | Cond. | Requisito | Situação | Tela e caminho | Conta | Captura |
|---|---|---|---|---|---|---|
| 1.1 | Obr | Cadastro de PPA, LDO e LOA com número, ementa, data e arquivo | Atende | Planejamento › Novo instrumento | admin | item-1.1.png |
| 1.2 | Fac | Lei aprovada vinculada ao projeto de origem | Atende | Planejamento › Novo instrumento › Lei aprovada | admin | item-1.2.png |
| 1.3 | Obr | Emendamento aberto/fechado pela situação do instrumento e do exercício; exercício ativo sempre à vista | Atende | Emendas (indicador) · Configurações › Exercício · seletor no menu | vereador / admin | item-1.3.png |
| 2.1 | Obr | Importação de PDF (texto ou digitalizado), CSV e XLSX, com prioridades da LDO e relatório de recusas | Atende | Planejamento › Importar base | admin / executivo | item-2.1.png |
| 2.2 | Obr | Os oito componentes derivados de cada linha; recusa só da linha | Atende | Planejamento › Importação › Todas | admin / executivo | item-2.2.png |
| 2.3 | Obr | Pré-visualização, conferência de totais e confirmação | Atende | Planejamento › Importação › Confirmar carga | admin / executivo | item-2.3.png |
| 3.1 | Obr | Formulário em blocos numerados, todos visíveis | Parcial | Nova emenda (três etapas numeradas, uma por vez) | vereador | — |
| 3.2 | Obr | Dotação em cascata, com saldo e por extenso | Parcial | Nova emenda › etapa 1 (o sistema sugere a dotação a partir do objeto) | vereador | — |
| 3.3 | Obr | Tipo de emenda; remanejamento com origem e destino | Parcial | Toda emenda é impositiva; a verificação (x) confere | vereador | — |
| 3.4 | Fac | Acréscimo, anulação e remanejamento | Não atende | — | — | — |
| 3.5 | Obr | Beneficiário por destino, cadastro na própria tela, rascunho a qualquer momento | Atende | Nova emenda › etapa 1 | vereador | item-3.5.png |
| 4.1 | Obr | As treze verificações em três estados | Atende | Emenda › etapa 3 "Validar e submeter" | vereador | item-4.1.png |
| 4.2 | Obr | Relatório com razão e fundamento de cada uma | Atende | Emenda › etapa 3; página da emenda › Relatório da validação | vereador / comissao | item-4.2.png |
| 4.3 | Obr | Modo bloqueante ou alerta por verificação | Atende | Configurações › Validação | admin | item-4.3.png |
| 4.4 | Obr | Validação no servidor, gravada com histórico | Atende | Página da emenda › Histórico de validações | vereador / comissao | item-4.4.png |
| 4.5 | Obr | Cada verificação conferida | Atende | Emenda › etapa 3 | vereador | item-4.5.png |
| 5.1 | Obr | Plano conforme a categoria; declaração; conferência de um centavo | Parcial | Nova emenda › etapa 2 (plano exigido de todos) | vereador | — |
| 5.2 | Obr | O que falta para remeter, sempre à vista | Parcial | Nova emenda › resumo lateral e etapa 3 | vereador | — |
| 5.3 | Fac | Link para a entidade, de uso único | Atende | Emenda (execução indireta) › etapa 2 › Gerar link | vereador · entidade sem login | item-5.3.png |
| 6.1 | Obr | Situações da emenda e fila com filtros por situação, autor e área | Atende | Tramitação › Parecer | comissao | item-6.1.png |
| 6.2 | Obr | Parecer obrigatório; saneamento em fila própria | Atende | Tramitação › Parecer e Saneamento | comissao | item-6.2.png |
| 6.3 | Obr | Incorporadas à lei e relatórios por situação, autor e período | Atende | Tramitação › Lei aprovada e Relatórios | comissao | item-6.3.png |
| 7.1 | Obr | Painel: apresentado × acatado, por área, consumo do teto | Atende | Resumo consolidado | comissao | item-7.1.png |
| 7.2 | Obr | Visão do gabinete | Atende | Vereador 360 | vereador | item-7.2.png |
| 7.3 | Fac | Resumo por autor | Atende | Resumo consolidado › Cota por vereador | comissao | item-7.3.png |
| 7.4 | Obr | Fila com o apontamento de cada pendência | Atende | Tramitação › Saneamento | comissao | item-7.4.png |
| 8.1 | Obr | Comparativo projeto × lei por dotação | Atende | Projeto × lei | comissao / admin | item-8.1.png |
| 8.2 | Fac | Execução das dotações emendadas | Atende | Projeto × lei › Execução | comissao | item-8.2.png |
| 9.1 | Obr | Portal sem login com os números do exercício | Atende | /publica | sem login | item-9.1.png |
| 9.2 | Obr | Relação com busca, filtro por situação e paginação; ficha completa | Atende | /publica/emendas | sem login | item-9.2.png |
| 10.1 | Obr | Manual lido da configuração | Atende | /publica/manual | sem login | item-10.1.png |
| 11.1 | Obr | Conformidade derivada do estado real | Atende | Conformidade | admin | item-11.1.png |
| 11.2 | Obr | Providência e link em cada pendência | Atende | Conformidade | admin | item-11.2.png |
| 12.1 | Obr | Parâmetros com fundamento e modo, geral ou por exercício | Atende | Configurações › Validação | admin | item-12.1.png |
| 12.2 | Obr | Normas com arquivo, vigência e edição | Atende | Configurações › Base legal | admin | item-12.2.png |
| 12.3 | Fac | Beneficiários: duplicados e mesclagem | Atende | Configurações › Destinos | admin | item-12.3.png |
| 12.4 | Obr | Instrumentos, importação, usuários e perfis; auditoria consultável | Atende | Configurações › Usuários e Auditoria · Planejamento | admin | item-12.4.png |
| 13.1 | Obr | Perfis (inclusive somente consulta); troca da própria senha | Atende | Minha conta (clicar no nome) | consulta / qualquer | item-13.1.png |
| 13.2 | Obr | Permissão relida a cada ação, no servidor | Atende | qualquer ação de escrita | consulta | item-13.2.png |
| 13.3 | Obr | Trilha com antes e depois; limite de tentativas; senha protegida | Atende | Configurações › Auditoria · Login | admin | item-13.3.png |
| 14.1 | Obr | Exportação CSV e XLSX com os filtros da tela | Atende | Emendas e Tramitação › Exportar | comissao / vereador | item-14.1.png |
| 14.2 | Fac | Impressão da emenda inteira | Atende | Emenda › Versão para impressão | qualquer com acesso | item-14.2.png |
| 15.1 | Fac | Sugestão de redação só com o conteúdo da emenda | Atende | Nova emenda › Melhorar texto | vereador | item-15.1.png |

## Antes da sessão, pela tela

A conformidade mostra pendente o que o sistema não pode inventar. Cadastrar
antes da demonstração:

1. Configurações › Base legal: o Regimento Interno; a data de início de
   vigência da Lei Orgânica; a Resolução 370/2026, com o PDF.
2. Configurações › Portal e manual: o ato que institui o manual, e publicar.
3. Configurações › Validação: o fundamento de cada parâmetro.
