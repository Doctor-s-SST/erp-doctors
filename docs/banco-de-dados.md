# Banco de dados

Este mapa foi inferido das consultas do código. O esquema e as políticas RLS do Supabase são a fonte definitiva.

| Tabela | Responsabilidade | Relações/campos importantes |
|---|---|---|
| `profiles` | perfil do usuário | `id`, `role`, `ativo`, `unidade_id`, `especialidade_id` |
| `unidades` | dados da clínica | nome e URLs de logotipo |
| `logos` | arquivos/identidade da unidade | usado na configuração da unidade |
| `especialidades` | filas/especialidades | unidade, nome, ordem e estado |
| `exames` | exames disponíveis | vínculo e ordem na especialidade |
| `especialidade_dependencias` | precedência entre especialidades | usada no Kanban/fluxo |
| `grupos_especialidades` | agrupamento configurável | unidade e nome |
| `grupo_especialidade_itens` | itens do grupo | grupo e especialidade |
| `atendimentos` | senha e ciclo do paciente | status, prioridade, unidade e datas |
| `atendimento_exames` | andamento por exame/especialidade | atendimento, exame e status |
| `salas` | locais de atendimento | número/nome, unidade e estado |
| `sala_especialidades` | especialidades permitidas na sala | sala e especialidade |
| `profissionais` | profissionais da unidade | sala, ativo e dados do profissional |
| `profissional_especialidades` | atuação do profissional | profissional e especialidade |
| `painel_config` | comportamento do painel | áudio, andar e `fala_terreo` |
| `prazos_exames` | regras de prazo de ASO | nome, dias, tipo, dispensa de GED e unidade |
| `pacientes_assinatura` | workflow de assinatura/envio | paciente, ficha, ação, observação e unidade |
| `chat_mensagens` | mensagens internas | autor, destino/contexto e criação |
| `chat_ultima_leitura` | controle de não lidas | usuário/contexto e instante |

## Regras de modelagem

- Dados operacionais devem carregar `unidade_id`.
- Chaves externas devem impedir vínculos entre unidades diferentes.
- Exclusões de cadastros referenciados devem ser bloqueadas ou tratadas explicitamente.
- Datas de auditoria devem usar timezone consistente.
- Estados devem ser documentados e migrados junto com todos os consumidores.

## Estados de ASO

`null` aguarda assinatura; `ASSINADO` aguarda envio; `PENDENCIA` aguarda envio da justificativa; `ENVIADO`, `ENVIADO_DIRETO` e `PENDENCIA_ENVIADA` são estados finais de suas filas.

Em `prazos_exames`, o campo legado `ignorar_exame` não remove o exame do fluxo. Quando `true`, ele apenas dispensa a relação com um documento GED: com `dataExame`, o exame está concluído; sem data, continua pendente. O nome da coluna foi preservado por compatibilidade.

## Migrações

Não há diretório de migrações versionado. Isso é um risco de manutenção. Crie `supabase/migrations` ou equivalente antes de novas alterações estruturais. A coluna `painel_config.fala_terreo` deve ser booleana, `not null` e ter padrão `false`.
