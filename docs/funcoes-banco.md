# Funções e triggers do banco

Regras centrais do Gestão de Fila Doctor's rodam dentro do PostgreSQL do Supabase: geração de senha, chamadas, finalização de etapas, histórico de status e avisos de tempo real. Este documento descreve essas funções e triggers.

A fonte é o esquema exportado em 28/10/2026, versionado em [`docs/sql/schema_public.sql`](sql/schema_public.sql) (estrutura, funções, triggers, índices e políticas RLS, sem dados).

## Como atualizar o esquema versionado

Sempre que alterar funções, triggers, tabelas ou políticas no banco, exporte de novo e substitua o arquivo:

```bash
docker exec <container-do-banco-supabase> pg_dump -U postgres -d postgres --schema=public --schema-only --no-owner --no-privileges > docs/sql/schema_public.sql
```

## Visão geral

| Grupo | Quantidade | Funções |
|---|---|---|
| Chamadas pelo código do sistema | 10 | ver abaixo |
| Usadas pelo aplicativo Java e pelo distribuidor SSE | 4 | `gerar_senha_java`, `get_painel_recepcao_novo`, `get_fila_especialidade_novo`, `get_painel_tv_fila` |
| Funções de trigger | 8 | histórico de status, tempo real, trava de chamada, `updated_at`, diagnóstico e criação de perfil |
| Auxiliares | 3 | `get_my_unit`, `check_is_admin`, `registrar_auditoria` |
| Antigas ou duplicadas | 24 | candidatas à remoção (ver lista abaixo) |

Convenção: as funções em uso têm o sufixo `_novo`. As versões sem sufixo, `_duplicate`, `1` ou `_1` são anteriores ou cópias de teste.

## Funções chamadas pelo sistema

### Recepção (`sistema-filas/senhas-recepcao/page.tsx`)

| Função | O que faz | O que altera |
|---|---|---|
| `gerar_senha_novo(tipo, guiche, atendente, unidade)` | Calcula a próxima senha do dia por unidade e tipo (`N001`, `P023`) e cria o atendimento | Insere em `atendimentos` com status `AGUARDANDO_RECEPCAO`; devolve o código da senha |
| `gerenciar_chamada_recepcao_novo(atendimento, status, guiche, atendente)` | Muda o status da senha na recepção: chamar (`EM_FILA`), iniciar (`EM_RECEPCAO`) ou não atendido (`NAO_ATENDIDO`) | `atendimentos.status`, guichê, atendente e tempo de espera |
| `registrar_dados_ficha_novo(...)` | Salva a ficha importada do SOC | Insere um paciente em `pacientes`; atualiza o atendimento (paciente, exames, ficha, encaixe, tipo de exame); remove as etapas de especialidades desmarcadas e cria as novas em `atendimento_exames` (uma por especialidade, com o primeiro exame dela) |
| `finalizar_recepcao_novo(atendimento, especialidades)` | Conclui a recepção | `atendimentos.status = AGUARDANDO_EXAMES`, `finalizado_recepcao` e tempo de espera |
| `cancelar_atendimento_novo(atendimento, usuario, nome, unidade)` | Cancela o atendimento | `atendimentos.status = CANCELADO`; etapas não finalizadas viram `CANCELADO`; grava auditoria em `auditoria_acoes` |

### Fila da especialidade (`sistema-filas/filas/[id]/page.tsx`)

| Função | O que faz | O que altera |
|---|---|---|
| `chamar_paciente_bloqueado_novo(atendimento, etapa, sala, num_sala, profissional)` | Primeira chamada do paciente na sala. Grava a trava em `chamadas_bloqueio`; se outra sala já chamou, devolve `{ sucesso: false }`. Recusa se o paciente estiver em outra especialidade | Etapa vai para `EM_FILA` com sala e profissional; `atendimentos.status` recebe o status da especialidade |
| `chamar_paciente_novo(...)` | Repete a chamada de um paciente já vinculado à mesma sala e profissional, com trava de linha (`FOR UPDATE NOWAIT`) | Mesmo efeito da chamada acima, sem nova trava |
| `nao_atendido_especialidade_novo(atendimento, etapa)` | Registra que o paciente não respondeu | Etapa volta para `AGUARDANDO`; atendimento volta para `AGUARDANDO_EXAMES` |
| `finalizar_especialidade_novo(atendimento, etapa, sala, num_sala)` | Conclui a etapa ao fim do temporizador | Etapa vai para `FINALIZADO` e limpa `finaliza_em`. Se restarem etapas, o atendimento volta para `AGUARDANDO_EXAMES`; se não, vai para `FINALIZADO` |

### Dashboard (`dashboards/atendimento/page.tsx`)

| Função | O que faz |
|---|---|
| `get_dashboard_completo(unidade, inicio, fim)` | Monta em uma única consulta todos os dados do dashboard: cards (geradas, em atendimento, aguardando, finalizadas, canceladas), fluxo por hora, mapa de calor, recepção por atendente (com tempo médio), especialidades e salas (total, tempo médio e ociosidade pela jornada do profissional), principais empresas, tipo de atendimento e tempo de permanência |

## Funções usadas pelo aplicativo Java e pelo distribuidor SSE

| Função | Quem usa | O que faz |
|---|---|---|
| `gerar_senha_java(...)` | Aplicativo Java de senhas | Igual a `gerar_senha_novo`, mas trava a tabela durante o cálculo (evita senha repetida) e usa a data de São Paulo. É `SECURITY DEFINER` |
| `get_fila_especialidade_novo(sala, unidade)` | Distribuidor SSE (`tipo=especialidade`) | Lista as etapas do dia de uma especialidade, com sala atual, profissional, se está bloqueada (paciente em outra sala ou dependência pendente) e se é a última etapa do paciente |
| `get_painel_recepcao_novo(unidade)` | Distribuidor SSE (`tipo=recepcao`) | Lista as senhas do dia da unidade, ordenadas por status, para a tela da recepção |
| `get_painel_tv_fila(unidade)` | Distribuidor SSE (`tipo=painel_tv`) | Lista as chamadas em `EM_FILA` intercalando recepção e exames, para o painel de TV |

O código do distribuidor está em [`services/distribuidor-sse`](../services/distribuidor-sse/server.js) e é descrito em [distribuidor-sse.md](distribuidor-sse.md). As variantes `get_fila_especialidade_novo_1` e `get_painel_tv_fila_1` (esta usa o nome social quando houver) não são chamadas por ele e estão entre as antigas.

## Triggers

| Tabela | Trigger | Quando | Função | Efeito |
|---|---|---|---|---|
| `atendimentos` | `tr_log_status_mudanca` | depois de inserir ou alterar | `fn_log_mudanca_status_atendimento` | Grava em `log_status_atendimento` cada criação ou mudança de status, com cópia dos dados do paciente |
| `atendimento_exames` | `tr_log_status_exames_mudanca` | depois de alterar | `fn_log_status_exames` | Grava em `log_status_atendimento` cada mudança de status da etapa, com sala, profissional e horários |
| `atendimentos` | `trg_atendimentos_change` | depois de inserir, alterar ou excluir | `notify_realtime_local` | Envia `pg_notify('fila_alterada', { unidade_id })` |
| `atendimento_exames` | `trg_atendimento_exames_change` | depois de inserir, alterar ou excluir | `notify_realtime_local` | Envia `pg_notify('fila_alterada', { unidade_id })` |
| `chat_mensagens` | `trg_chat_notify` | depois de inserir | `notify_chat` | Envia `pg_notify('chat_nova_mensagem', mensagem)` |
| `atendimento_exames` | `trigger_limpar_bloqueio_exames` | depois de alterar | `limpar_bloqueio_status_change` | Apaga a trava em `chamadas_bloqueio` quando a etapa sai de `EM_FILA` |
| `atendimento_exames` | `update_atendimento_exames_updated_at` | antes de alterar | `update_updated_at_column` | Atualiza `updated_at` |
| `atendimento_exames` | `trg_debug_reabertura_exame` | quando a etapa volta de `FINALIZADO` para `EM_ATENDIMENTO` | `debug_log_reabertura_exame` | Registra em `debug_reabertura_exames` quem reabriu (diagnóstico) |

`handle_new_user` é a função do trigger em `auth.users` (fora do schema `public`): ao criar um usuário no Supabase Auth, cria o perfil em `profiles` com nome, unidade, papel e especialidade vindos dos metadados do cadastro. Sem papel informado, o perfil nasce como `especialista`.

## Como o tempo real funciona

1. Qualquer mudança em `atendimentos` ou `atendimento_exames` dispara `pg_notify('fila_alterada')` com a unidade. Uma mensagem nova no chat dispara `pg_notify('chat_nova_mensagem')`.
2. O distribuidor SSE escuta esses canais (`LISTEN`), consulta as funções de leitura da unidade afetada e envia o resultado aos navegadores pelos streams `stream-fila` e `stream-chat`.
3. Recepção, filas, painel, dashboard do dia e chat recebem os dados prontos, sem consultar o banco a cada mudança.

## Ciclo de status pelas funções

| Momento | Função | `atendimentos.status` | `atendimento_exames.status` |
|---|---|---|---|
| Senha gerada | `gerar_senha_novo` / `gerar_senha_java` | `AGUARDANDO_RECEPCAO` | — |
| Chamada no guichê | `gerenciar_chamada_recepcao_novo` | `EM_FILA` | — |
| Painel anuncia a chamada | atualização feita pelo painel de TV | `EM_RECEPCAO` | — |
| Não compareceu | `gerenciar_chamada_recepcao_novo` | `NAO_ATENDIDO` | — |
| Ficha salva | `registrar_dados_ficha_novo` | (sem mudança) | etapas criadas como `AGUARDANDO` |
| Recepção finalizada | `finalizar_recepcao_novo` | `AGUARDANDO_EXAMES` | — |
| Chamado na especialidade | `chamar_paciente_bloqueado_novo` / `chamar_paciente_novo` | status da especialidade (`especialidades.status`, ex.: "EM CLÍNICO") | `EM_FILA` |
| Painel anuncia a chamada | atualização feita pelo painel de TV | (mantém) | `EM_ATENDIMENTO` |
| Não respondeu | `nao_atendido_especialidade_novo` | `AGUARDANDO_EXAMES` | `AGUARDANDO` |
| Etapa concluída | `finalizar_especialidade_novo` | `AGUARDANDO_EXAMES` ou `FINALIZADO` | `FINALIZADO` |
| Cancelado | `cancelar_atendimento_novo` | `CANCELADO` | `CANCELADO` (as não finalizadas) |

A passagem de `EM_FILA` para `EM_RECEPCAO` (recepção) e para `EM_ATENDIMENTO` (especialidade) não é feita por função do banco: o painel de TV (`painel-senhas/page.tsx`) atualiza a tabela diretamente logo depois de anunciar a chamada. Se o painel estiver fechado, as chamadas ficam em `EM_FILA`.

Enquanto o paciente está em uma especialidade, `atendimentos.status` recebe o texto configurado em `especialidades.status` da especialidade. As dependências entre especialidades não mudam status: são verificadas na leitura da fila (`bloqueado`).

## Funções antigas ou duplicadas

Não são chamadas pelo sistema, pelo aplicativo Java nem pelo distribuidor SSE. Antes de remover, confira se nenhum outro processo (n8n, scripts) as usa.

| Grupo | Funções |
|---|---|
| Versões anteriores às `_novo` | `cancelar_atendimento`, `chamar_paciente`, `chamar_paciente_bloqueado`, `finalizar_especialidade`, `finalizar_recepcao`, `gerar_senha`, `gerenciar_chamada_recepcao`, `get_fila_especialidade`, `get_painel_recepcao`, `nao_atendido_especialidade`, `registrar_dados_ficha` |
| Cópias e variantes | `cancelar_atendimento_novo2`, `get_fila_especialidade1`, `get_fila_especialidade_novo_1`, `get_fila_especialidade_novo_duplicate`, `get_painel_recepcao1`, `get_painel_tv_fila_1`, `registrar_dados_ficha_novo_duplicate`, `registrar_dados_ficha_novo_duplicate_1` |
| Sem uso encontrado | `debug_user`, `get_profissionais`, `get_salas`, `painel_chamar_paciente`, `painel_chamar_paciente_novo` |

## Pontos de atenção

- **Data do dia:** `get_painel_recepcao_novo`, `get_fila_especialidade_novo` e `gerar_senha_novo` filtram pelo dia do servidor do banco (`CURRENT_DATE` / `now()::date`), enquanto `gerar_senha_java` usa o fuso de São Paulo. Se o banco estiver em UTC, a partir das 21h as telas e a numeração das senhas mudam de dia antes do horário local.
- **`SECURITY DEFINER`:** `gerar_senha_java`, `get_dashboard_completo`, `notify_realtime_local`, `handle_new_user`, `debug_log_reabertura_exame`, `get_my_unit` e `check_is_admin` rodam com o dono da função, fora do RLS. As que recebem a unidade por parâmetro não conferem se ela é a do usuário (ver [banco-de-dados.md](banco-de-dados.md)).
- **`handle_new_user`:** aceita o papel vindo dos metadados do cadastro; quem consegue se cadastrar pela API pode escolher o próprio papel.
- **Mudança de status pelo painel:** as passagens para `EM_RECEPCAO` e `EM_ATENDIMENTO` dependem do painel de TV aberto (ver ciclo de status acima).
- **Funções antigas:** a quantidade de versões parecidas facilita alterar a função errada. Remova as que não forem usadas depois de conferir.
