# Mapa de páginas

Os perfis abaixo são os liberados pelo proxy de rotas (`ROUTE_PERMISSIONS` em `src/lib/proxy-supabase.ts`), que é o que de fato protege a página. Quando o menu (`AppSidebar.tsx`) mostra a opção para menos perfis, isso está indicado.

## Acesso e tela cheia

| Rota | Perfis | Uso |
|---|---|---|
| `/signin` | todos | login |
| `/signup` | todos | cadastro, quando habilitado |
| `/error-404` | todos | erro 404 |
| `/painel-senhas` | admin, painel | exibição e anúncio das chamadas |

## Filas

| Rota | Perfis | Uso |
|---|---|---|
| `/sistema-filas/senhas-recepcao` | admin, recepcao, especialista, painel | chamar senhas, importar ficha (máscaras de CPF, RG, nascimento e CNPJ só na exibição; o banco recebe os valores sem máscara, como antes), conferir e encaminhar às especialidades; o contador de finalização fica gravado no banco |
| `/sistema-filas/filas` | admin, especialista, recepcao, painel | selecionar especialidade e identificar sala e profissional por uma hora |
| `/sistema-filas/filas/[id]` | admin, especialista, recepcao, painel | acompanhar a fila via SSE, chamar, conferir exames e finalizar a etapa |
| `/sistema-filas/kanban` | admin | configurar especialidades (incluindo meta de atendimento e tolerância do farol e "Finaliza junto com" para especialidade vinculada; diálogo em seções Atendimento, Meta de tempo e Ordem e vínculo), exames, ordem e dependências; troca **Kanban \| Fluxo**: o Fluxo (React Flow, `components/kanban/FluxoEspecialidades.tsx`) mostra as especialidades em camadas pela ordem das dependências, com os exames ligados a elas; puxar uma linha entre especialidades cria a dependência, clicar na seta remove, clicar num nó abre o mesmo diálogo; o nó Recepção abre as configurações da recepção (tempo de finalização do encaixe e meta de tempo, as mesmas de Configurações > Unidade > Atendimento); exames ocultos por padrão; passar o mouse numa especialidade destaca o caminho dela (dependências antes e depois, vínculos e recepção) e apaga o resto; posições dos nós ficam salvas no navegador; botões **Modelo** (baixa `modelo_importacao_exames.xlsx` com as colunas Especialidade, Exame e Obrigatório, a lista de especialidades da unidade e instruções) e **Importar** (lê .xlsx/.xls/.csv, mostra a prévia com Novo, Atualizar, Já existe e Erro e só grava ao confirmar; a especialidade precisa existir na unidade, exame repetido na mesma especialidade não é duplicado, novos entram no fim da coluna) — `components/kanban/ImportarExames.tsx` |

## Análise e relatórios

| Rota | Perfis | Uso |
|---|---|---|
| `/dashboards/atendimento` | admin | indicadores do dia, período ou mês; o card da especialidade que tem grupos com `exibir_dashboard` ganha o botão "Grupos", que abre um painel lateral com a especialidade dividida por grupo (ex.: Clínico Térreo e Clínico Primeiro Andar): resumo, gráficos e tabela por sala, em qualquer visão; cards das especialidades com **Aguardando** (todos que ainda passam pela especialidade, mesmo na recepção ou em outra sala) e **Disponíveis** (dos aguardando, os que podem ser chamados agora; o oposto do BLOQUEADO da fila), também no painel de grupos; aba **Gestão de Tempo** com tempo médio por recepcionista e por profissional, farol contra a meta da especialidade, filtro por especialidade e, quando ela tem grupos marcados para o dashboard, por grupo (ex.: Clínico Térreo, Clínico Primeiro Andar ou fora dos grupos), visualização em tabelas ou gráficos, ordenação das tabelas e exportação Excel dos tempos individuais |
| `/sistema-filas/analise-dados/indicadores-mensais` | admin, especialista, recepcao, operador | indicadores por período |
| `/sistema-filas/analise-dados/especialidades` | admin, especialista, recepcao, operador | indicadores por especialidade; oculta no menu |
| `/sistema-filas/relatorios/geral` | admin, painel, recepcao, operador, especialista | relatório de atendimentos |
| `/sistema-filas/relatorios/exames-pendentes` | admin, painel, recepcao, operador, especialista | relatório de exames pendentes |

## ASO

| Rota | Perfis | Uso |
|---|---|---|
| `/aso/aso-pendente` | admin, operador, recepcao | sincronização, prazos e liberação |
| `/aso/assinatura-aso` | admin, operador, especialista, recepcao | assinatura, pendências e envios |
| `/aso/prazo-exames` | admin, operador, recepcao | cadastro e importação de prazos; **Modelo Excel** baixa `Modelo_Importacao_Prazos_ASO.xlsx` com os prazos cadastrados e a aba Instruções; **Importar Planilha** (.xlsx/.xls/.csv) mostra a prévia com Novo, Atualizar (com o que muda), Já existe e Erro e só grava ao confirmar, com upsert por (`unidade_id`, `nome_exame`) — `aso/prazo-exames/components/ImportarPrazosExames.tsx` |

No módulo ASO, o especialista acessa apenas Assinatura e Envio. O proxy aplica todas as regras cujo prefixo casa com a rota: `/aso/` libera o módulo e as regras de `/aso/aso-pendente` e `/aso/prazo-exames` restringem essas duas telas.

## Configuração

| Rota | Perfis | Uso |
|---|---|---|
| `/configuracoes/grupos-especialidades` | admin, operador | grupos de especialidades: critério, especialidade da fila, exibir na fila e exibir no dashboard |
| `/configuracoes/painel` | admin | voz do painel: andar e térreo |
| `/configuracoes/salas-profissionais` | admin | salas, profissionais e vínculos; troca **Lista \| Fluxo**: o Fluxo (`components/configuracoes/FluxoSalasProfissionais.tsx`) mostra Profissionais -> Especialidades -> Salas (salas agrupadas por andar, profissionais da recepção ligados à Recepção); puxar uma linha vincula profissional a especialidade ou especialidade a sala, clicar na linha desvincula, clicar num profissional ou sala abre a edição na lista; passar o mouse acende as ligações |
| `/configuracoes/unidade` | admin | abas **Empresa** (dados e identidade da unidade) e **Atendimento** (meta e tolerância da recepção na Gestão de Tempo , alertas de tempo: ligar/desligar, paciente parado e atendimento prolongado padrão, e tempo de finalização do encaixe na recepção, padrão 30 min); um único Salvar para as duas |
| `/configuracoes/users` | admin | usuários, papéis e ativação |
| `/profile` | qualquer usuário logado | perfil; oculto no menu |

No cabeçalho, o admin tem o **sino de notificações** (`components/header/NotificacoesSino.tsx`): a cada minuto gera os alertas de tempo, mostra um aviso no canto da tela em qualquer página quando surge um novo e guarda a lista com marcação de lida. Clicar em "Ver atendimento" no aviso ou no item do sino marca como lida e abre a Chamada de Senhas em `/sistema-filas/senhas-recepcao?atendimento=<id>`: a tela limpa os filtros, rola até a linha e a destaca por alguns segundos.

`/` redireciona conforme o perfil. As rotas demonstrativas herdadas do template foram removidas.

Proxy e menu estão alinhados em todas as rotas. Ao criar ou alterar uma página, mantenha os mesmos perfis nos dois lugares; rotas fora de `ROUTE_PERMISSIONS` ficam acessíveis a qualquer usuário logado.
