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

A especialidade não cancela atendimentos. Quando a recepção cancela um atendimento (`atendimentos.status = CANCELADO`), a fila apenas o exibe como encerrado.

`status_atendimento`, `bloqueado`, `num_sala` e `profissional` complementam o status principal. A trava de chamada fica em `chamadas_bloqueio` (uma linha por etapa). Não simplifique a permissão de botões usando somente `status`.

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

## Grupos de especialidades

A regra fica em `src/lib/grupos-especialidades.ts` (`atendimentoPertenceAoGrupo`) e é a mesma na fila, no relatório geral e no dashboard. As especialidades do atendimento vêm de `atendimento_exames.sala` (nome da especialidade), considerando todos os exames em qualquer status; por isso o paciente não muda de grupo ao longo do dia.

| Tipo | Entra no grupo |
|---|---|
| `apenas_do_grupo` | só especialidades do grupo, em qualquer combinação. Ex.: Clínico (Primeiro Andar) com Clínico e Triagem aceita só Clínico ou Clínico + Triagem |
| `todos` | exatamente as especialidades do grupo |
| `algum` | pelo menos uma especialidade do grupo, com extras permitidos |
| `obrigatorio_mais_algum` | todas as obrigatórias e pelo menos uma opcional, sem impeditivas. Ex.: Clínico (Térreo) com Clínico obrigatório e Audiometria, ECG, Laboratório e Toxicológico opcionais |

No `obrigatorio_mais_algum`, a opcional precisa estar cadastrada no próprio grupo. Um atendimento com Clínico e uma especialidade que nenhum grupo cita (por exemplo, uma especialidade nova) fica fora dos grupos de Térreo e de Primeiro Andar. Ao criar especialidade, inclua-a nos grupos correspondentes. O dashboard mostra esses casos num card "fora dos grupos".

Configuração de exibição do grupo (`/configuracoes/grupos-especialidades`):

| Campo | Padrão | Efeito |
|---|---|---|
| `especialidade_fila_id` | vazio | especialidade cuja fila o grupo representa. Preenchido: o grupo aparece só no filtro da fila dessa especialidade. Vazio: aparece na fila de todas as especialidades do grupo |
| `exibir_fila` | `true` | quando `false`, o grupo some do filtro da fila; quem estava com ele selecionado volta para "Todos" |
| `exibir_dashboard` | `false` | o grupo vira um card próprio no dashboard diário, no lugar do card geral da especialidade da fila; exige `especialidade_fila_id` |

`gruposVisiveisNaFila` aplica `exibir_fila` e `especialidade_fila_id`. O relatório geral continua listando todos os grupos.

## Checklist de manutenção

1. Teste entrada, expiração e troca manual de sala/profissional.
2. Confirme chamada, nova chamada, não atendido, cancelamento do temporizador e finalização.
3. Teste paciente bloqueado por outro profissional e paciente da sessão atual.
4. Confira exames obrigatórios e não obrigatórios.
5. Valide os quatro tipos de grupo, a exibição por especialidade da fila e `exibir_fila`, pesquisa, tipo de senha e ordenação.
6. Confirme isolamento por `unidade_id` e atualização SSE.
7. Execute `npx tsc --noEmit`, lint direcionado e build.

## Organização e desempenho

As páginas de `sistema-filas` devem manter somente estado que participa da interface ou das regras operacionais. Atualizações em tempo real continuam centralizadas nos canais SSE; não mantenha consultas RPC manuais desativadas em paralelo. Em `senhas-recepcao`, o relógio da espera usa um timestamp atualizado por intervalo, evitando chamadas impuras durante a renderização, e os cabeçalhos ordenáveis são renderizados como função, sem criar um novo tipo de componente a cada ciclo.

Os dashboards mensais armazenam apenas os agregados utilizados pelos gráficos. Os relatórios mantêm os dados detalhados porque eles alimentam filtros, expansão de linhas e exportação. Imports, variáveis, consultas e blocos comentados sem consumidores devem ser removidos durante a manutenção, preservando os contratos de RPC e n8n.

## Dívida técnica restante

`[id]/page.tsx` ainda concentra orquestração e interface. A evolução recomendada é extrair, em entregas separadas e testáveis, hooks para SSE, exames, temporizadores e grupos, além de componentes para linha da tabela e modal de identificação.
