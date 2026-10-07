# Módulo de filas

Este documento descreve a pasta `src/app/(admin)/(others-pages)/sistema-filas/filas`, seus contratos e os pontos que precisam ser preservados durante manutenções.

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `page.tsx` | carrega especialidades, salas e profissionais e solicita a identificação antes de entrar na fila |
| `[id]/page.tsx` | opera a fila de uma especialidade, recebe atualizações, filtra pacientes e executa ações de atendimento |
| `types.ts` | contratos compartilhados de fila, exames, grupos e ordenação |
| `utils.ts` | normalização de texto e cálculos/apresentação de horários |
| `components/SortableTableHead.tsx` | cabeçalho reutilizável da ordenação da tabela |
| `src/lib/fila-session.ts` | persistência e expiração da identificação de sala/profissional |

## Entrada na fila

1. `/sistema-filas/filas` obtém `unidade_id` do perfil autenticado.
2. Carrega `especialidades`, `salas` e profissionais ativos.
3. Filtra salas e profissionais pelos relacionamentos da especialidade escolhida.
4. Exige sala e profissional, salva `fila_session_<userId>` e abre `/sistema-filas/filas/[id]`.
5. A sessão vale uma hora. Sessão ausente, inválida, legada ou expirada reabre o modal. Um novo login sempre a remove.

## Atualização da fila

A tela dinâmica recebe a lista pelo endpoint SSE `stream-fila`, parametrizado por unidade e nome da especialidade. Não substitua o SSE por polling sem avaliar volume, atraso e comportamento do distribuidor. Tabelas Supabase complementam a lista com exames, grupos, salas, profissionais e configuração de tempo.

## Ações e RPCs

| RPC | Uso |
|---|---|
| `chamar_paciente_novo` | repete a chamada de um paciente já vinculado ao profissional |
| `chamar_paciente_bloqueado_novo` | assume/chama um paciente disponível conforme as regras da fila |
| `nao_atendido_especialidade_novo` | registra que o paciente não respondeu à chamada |
| `finalizar_especialidade_novo` | conclui a etapa depois da confirmação e do temporizador configurado |

Os parâmetros essenciais são `p_atendimento_id`, `p_atendimento_exame_id`, `p_sala`, `p_num_sala` e, nas chamadas, `p_profissional`. Alterações nesses nomes exigem mudança coordenada nas funções PostgreSQL.

## Estados e bloqueios

- `AGUARDANDO`: permite chamada quando as dependências estiverem liberadas.
- `EM_FILA`: paciente chamado e aguardando a etapa.
- `EM_ATENDIMENTO`: atendimento em curso; apenas a mesma sala/profissional pode operar o item.
- `FINALIZADO`: etapa concluída e sem novas ações.
- `CANCELADO`: apresenta o registro como encerrado/cancelado.

`status_atendimento`, `bloqueado`, `num_sala` e `profissional` complementam o status principal. Não simplifique a permissão de botões usando somente `status`.

## Exames e finalização

Os exames da especialidade são cruzados com `atendimentos.exames_list`. A tela preserva exames de outras especialidades e atualiza apenas os pertencentes à etapa atual. Quando a especialidade obriga conferência, os exames marcados como obrigatórios precisam estar concluídos antes da finalização.

Na fila de **Toxicológico**, o botão **Realizado** pode iniciar a finalização enquanto o exame ainda está com status `AGUARDANDO`. O temporizador é persistido em `atendimento_exames.finaliza_em` e restaurado a cada atualização da fila independentemente de o item estar em `AGUARDANDO` ou `EM_ATENDIMENTO`. Uma finalização cancelada pelo usuário não é reativada por um evento SSE atrasado.

O tempo de confirmação vem de `especialidades.tempo_finalizacao_segundos`, com fallback de 20 segundos. `atendimento_exames.finaliza_em` permite reconstruir temporizadores depois de recarregar a página.

Ao terminar o contador, a finalização usa `num_sala` do próprio item de atendimento, e não apenas a identificação mantida no navegador. Assim, uma sessão que expire durante o contador não invalida a operação já iniciada. O contador somente é retirado depois que `finalizar_especialidade_novo` confirma sucesso; em caso de falha, a tela mantém a finalização pendente e tenta novamente após cinco segundos.

## Filtros e armazenamento local

| Chave | Conteúdo |
|---|---|
| `fila_session_<userId>` | sala, profissional, especialidade e `expiresAt` |
| `filtro_grupo_fila_<especialidadeId>` | grupo de especialidades selecionado |
| `nao_atendidos_recentes` | itens recentemente marcados como não atendidos para ordenação visual |

Os grupos aceitam `todos`, `algum`, `apenas_do_grupo` e `obrigatorio_mais_algum`. A comparação usa nomes normalizados sem acentos.

## Checklist de manutenção

1. Teste entrada, expiração e troca manual de sala/profissional.
2. Confirme chamada, nova chamada, não atendido, cancelamento do temporizador e finalização.
3. Teste paciente bloqueado por outro profissional e paciente da sessão atual.
4. Confira exames obrigatórios e não obrigatórios.
5. Valide os quatro tipos de grupo, pesquisa, tipo de senha e ordenação.
6. Confirme isolamento por `unidade_id` e atualização SSE.
7. Execute `npx tsc --noEmit`, lint direcionado e build.

## Dívida técnica restante

`[id]/page.tsx` ainda concentra orquestração e interface. A evolução recomendada é extrair, em entregas separadas e testáveis, hooks para SSE, exames, temporizadores e grupos, além de componentes para linha da tabela e modal de identificação.
