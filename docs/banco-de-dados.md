# Banco de dados

PostgreSQL do Supabase, hospedado na VPS. As tabelas da aplicação ficam no schema `public` (25 tabelas); os usuários de login ficam em `auth.users`. O dicionário de dados completo, com os diagramas entidade-relacionamento, está na seção 8 do documento técnico.

## Tabelas

| Domínio | Tabela | Responsabilidade |
|---|---|---|
| Unidade e usuários | `unidades` | dados cadastrais e URLs dos logotipos |
| | `profiles` | perfil do usuário: `role`, `ativo`, `unidade_id`, `especialidade_id` |
| | `painel_config` | voz do painel: `fala_andar`, `fala_terreo` (uma por unidade) |
| Estrutura de atendimento | `especialidades` | filas, `tempo_finalizacao_segundos`, `obrigar_check_exames` |
| | `especialidade_dependencias` | ordem entre especialidades |
| | `exames` | exames por especialidade, ordem e `obrigatorio_checkbox` |
| | `exame_dependencias` | ordem entre exames |
| | `salas`, `sala_especialidades` | salas (número, andar) e especialidades atendidas |
| | `profissionais`, `profissional_especialidades` | profissionais, jornada e especialidades |
| Grupos | `grupos_especialidades`, `grupo_especialidade_itens` | grupos de filtro e papel de cada item (obrigatória, opcional, excludente); o grupo guarda também `exibir_fila`, `exibir_dashboard` e `especialidade_fila_id` (ver [filas.md](filas.md#grupos-de-especialidades)) |
| Atendimento | `pacientes` | cadastro importado da ficha do SOC |
| | `atendimentos` | senha e ciclo do paciente na unidade |
| | `atendimento_exames` | andamento de cada etapa nas especialidades |
| | `chamadas_bloqueio` | trava de chamada: uma sala/profissional por etapa |
| | `log_status_atendimento` | histórico de status com cópia dos dados do paciente (base dos relatórios) |
| ASO | `pacientes_assinatura` | estado atual de cada ASO no fluxo |
| | `pacientes_assinatura_logs` | histórico imutável das ações de ASO |
| | `prazos_exames` | prazo por exame, tipo e dispensa de GED |
| Chat | `chat_mensagens`, `chat_ultima_leitura` | mensagens e controle de não lidas |
| Auditoria | `auditoria_acoes` | alterações com valor anterior e novo |
| | `debug_reabertura_exames` | diagnóstico de reaberturas de exames |

Os logotipos da unidade ficam no bucket `logos` do Supabase Storage (não é uma tabela).

## RLS

O RLS está ativo em 23 das 25 tabelas. Estar ativo, porém, não garante proteção: no PostgreSQL, as políticas permissivas de uma tabela se somam (basta uma permitir). A análise das 59 políticas do esquema (`docs/sql/schema_public.sql`, 28/10/2026) mostra que o isolamento por unidade existe (políticas `*_unit_isolation`, baseadas em `get_my_unit()`), mas várias políticas mais abertas o anulam.

O padrão correto, usado na maioria das tabelas, é `unidade_id = get_my_unit()` para o papel `authenticated`.

### Falhas encontradas

| Tabela | Política | Efeito |
|---|---|---|
| `pacientes` | "Permitir leitura de nomes para o painel": `SELECT` com `true`, sem papel definido | **Qualquer pessoa com a chave pública, mesmo sem login, lê nome, CPF, data de nascimento e empresa de todos os pacientes de todas as unidades** |
| `pacientes` | "Permitir ... para autenticados": leitura, inclusão, alteração e exclusão com `true` | Qualquer usuário logado lê e altera pacientes de qualquer unidade |
| `unidades` | "Permitir ... para autenticados": inclusão, alteração e exclusão com `true` | Qualquer usuário logado altera ou exclui qualquer unidade; a exclusão apaga em cascata atendimentos e especialidades |
| `exames`, `exame_dependencias` | "allow ... " para o papel `anon` (leitura, inclusão, alteração e exclusão) | **Sem login**, é possível alterar ou excluir exames; a exclusão apaga em cascata as etapas dos atendimentos |
| `atendimentos` | "insert atendimentos anon" | Sem login, é possível criar atendimentos em qualquer unidade |
| `profiles` | `policy_profiles_isolation` para todos os comandos, sem `WITH CHECK` próprio | Um usuário pode alterar o próprio perfil, inclusive `role` e `unidade_id`, e os perfis da sua unidade. Na prática, um usuário comum pode se tornar `admin`, a menos que as permissões de coluna impeçam |
| várias | "Admins acessam tudo": `check_is_admin() OR auth.uid() = id` | O admin de uma unidade vê e altera dados de todas as unidades. A comparação `auth.uid() = id` compara o usuário com o id da linha e não tem efeito útil |
| `chamadas_bloqueio`, `debug_reabertura_exames` | RLS desativado | Tabelas acessíveis pela API para qualquer cliente com a chave pública |
| `especialidade_dependencias` | só a política de admin | Usuários que não são admin não leem as dependências pela API |

### Correções recomendadas

1. Remover as políticas para o papel `anon` em `pacientes`, `exames`, `exame_dependencias` e `atendimentos`. O aplicativo Java gera senha pela função `gerar_senha_java` (`SECURITY DEFINER`), que não depende dessas políticas.
2. Trocar as políticas `true` de `pacientes` e `unidades` por isolamento de unidade (`unidade_id = get_my_unit()`), deixando inclusão e exclusão de unidades só para admin.
3. Em `profiles`, separar leitura (mesma unidade) de alteração (apenas admin) e impedir que o próprio usuário altere `role`, `unidade_id` e `ativo`.
4. Restringir "Admins acessam tudo" à unidade do admin.
5. Ativar RLS em `chamadas_bloqueio` com isolamento pela etapa, e remover ou bloquear `debug_reabertura_exames`.
6. Validar a unidade dentro das funções `SECURITY DEFINER` (ver [funcoes-banco.md](funcoes-banco.md#pontos-de-atenção)).

Antes de aplicar, teste em homologação com cada perfil e com o distribuidor SSE e o aplicativo Java, que podem depender das políticas atuais.

## Regras de modelagem

- Dados operacionais devem carregar `unidade_id`. Hoje oito tabelas têm a coluna sem chave estrangeira; o isolamento delas depende do código e do RLS.
- Chaves estrangeiras devem impedir vínculos entre unidades diferentes.
- Exclusões de cadastros referenciados devem ser bloqueadas ou tratadas explicitamente.
- Datas de auditoria devem usar `timestamptz`; algumas colunas antigas usam `timestamp` sem fuso.
- Estados devem ser documentados e migrados junto com todos os consumidores.

## Estados

`atendimentos.status` (texto): `AGUARDANDO_RECEPCAO`, `EM_FILA`, `EM_RECEPCAO`, `NAO_ATENDIDO`, `AGUARDANDO_EXAMES`, `FINALIZADO`, `CANCELADO`. Durante o atendimento em uma especialidade, recebe o texto de `especialidades.status` (ex.: "EM CLÍNICO").

`atendimento_exames.status` (enum `status_exame`): `AGUARDANDO`, `EM_FILA`, `EM_ATENDIMENTO`, `FINALIZADO`, `CANCELADO`. O enum também tem `DISPONIVEL`, `NAO_ATENDIDO` e `FICHA_CRIADA`, que as funções atuais não usam.

As transições de status feitas por cada função estão em [funcoes-banco.md](funcoes-banco.md#ciclo-de-status-pelas-funções).

`pacientes_assinatura.acao`: `null` aguarda assinatura; `ASSINADO` aguarda envio; `PENDENCIA` aguarda envio da justificativa; `ENVIADO`, `ENVIADO_DIRETO` e `PENDENCIA_ENVIADA` são estados finais.

## Regras de ASO

Em `prazos_exames`, o campo legado `ignorar_exame` não remove o exame do fluxo. Quando `true`, ele apenas dispensa o documento GED: com data do exame, o exame está concluído; sem data, continua pendente. O nome da coluna foi preservado por compatibilidade. A tela grava prazos com upsert por (`unidade_id`, `nome_exame`), garantido pela restrição única `prazos_exames_unidade_exame_key`.

`pacientes_assinatura` guarda o estado atual do fluxo; `pacientes_assinatura_logs` guarda o histórico de cada ação com o usuário autenticado. As políticas RLS permitem leitura apenas para usuários da mesma unidade e inserção apenas em nome do próprio usuário.

`pacientes_assinatura.ativo` controla a retenção visual sem excluir dados. O workflow `limpa_asos_enviados_banco` (diário, 3h) marca como `false` os registros `ENVIADO` e `ENVIADO_DIRETO` com mais de 30 dias desde `created_at`; `PENDENCIA`, `PENDENCIA_ENVIADA`, `ASSINADO` e `null` permanecem ativos. A tela de assinatura consulta somente registros ativos. Uma nova liberação atualiza o registro existente com `ativo = true`, sem duplicar.

## Volume

Em 28/10/2026 o banco ocupava 265 MB. `log_status_atendimento` concentra 55% (147 MB) e recebe cerca de 1.700 registros por dia; é o primeiro alvo de uma política de retenção. Detalhes na seção 10 do documento técnico.

## Esquema e migrações

O esquema completo (tabelas, funções, triggers, índices e políticas RLS, sem dados) está em [`docs/sql/schema_public.sql`](sql/schema_public.sql), exportado em 28/10/2026. As funções e triggers estão explicados em [funcoes-banco.md](funcoes-banco.md).

Ainda não há migrações versionadas: o arquivo é uma fotografia do banco. Scripts de alteração aplicados depois da exportação ficam em [`docs/sql/migracoes/`](sql/migracoes/), com a reversão comentada no fim de cada um. Ao alterar o banco, prepare script reversível, adicione default para coluna obrigatória nova, atualize tipos e consultas, confirme o RLS e exporte o esquema de novo (comando em [funcoes-banco.md](funcoes-banco.md#como-atualizar-o-esquema-versionado)). Adotar migrações (por exemplo, com Supabase CLI) continua sendo prioridade técnica.

`atendimento_exames` tem índices repetidos (quatro em `atendimento_id`, três em `status`) e o chat também; remover as cópias reduz espaço e acelera as gravações.

A coluna `painel_config.fala_terreo` deve ser booleana, `not null` e ter padrão `false`.
