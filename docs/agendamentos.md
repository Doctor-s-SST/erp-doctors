# Agendamentos do SOC

Integração dos agendamentos do SOC com as filas, a recepção e os indicadores do time de agendamento. Hoje o atendimento é por ordem de chegada; com os agendados do dia no banco, as filas passam a considerar o horário agendado e a recepção ganha a lista de agendados e a busca por CPF.

## Fases

| Fase | O que entrega | Situação |
|---|---|---|
| 1. Sincronização | tela Configurações > Integrações (códigos e chaves no banco), tabela `agendamentos`, log `agendamentos_sincronizacoes` e fluxo n8n `sincronizar_agendamentos_soc` | feito (migrações `2026-11-27_integracoes_soc.sql` e `2026-11-27_agendamentos_soc.sql`, nessa ordem; fluxo em `docs/n8n/`) |
| 2. Recepção | troca Fila de senhas \| Agendados do dia, busca de agendado (CPF, nome ou empresa) na ficha e vínculo automático do atendimento com o agendamento | feito (migração `2026-11-27_agendamentos_vinculo.sql`) |
| 3. Filas | ordem pelo horário agendado; hora agendada, chegada, espera e atraso na recepção e nas filas | a fazer |
| 4. Indicadores | comparecimento, não comparecimento, encaixe e aderência à capacidade do corpo médico (ver abaixo) | a fazer |

## Fontes no SOC (Exporta Dados)

Todas pelo web service `ExportaDadosWs` (SOAP). O ED1 é pedido em `tipoSaida` xml, porque não aceita json (o SOC responde "Tipo de Retorno Não permitido / definido"); os demais em json. A leitura aceita json, xml e csv. Empresa principal, código do responsável (`codigoResponsavel`), código do usuário do web service na conta do SOC (`codigoUsuario`), username e chave de acesso do WS-Security, URL, usuário Agenda e o código e a chave de cada Exporta Dados ficam no banco, cadastrados em **Configurações > Integrações** (`integracao_soc`, `integracao_soc_exporta_dados`). O fluxo busca cada ED pelo identificador: `agendados_agenda` (ED1), `agendamentos_funcionario` (ED2) e `pedido_exame`.

| Exporta Dados | Parâmetros usados | O que traz | Limite |
|---|---|---|---|
| ED1 – agendados por usuário Agenda | `codigoUsuarioAgenda`, `dataInicial`, `dataFinal` | empresa, funcionário, nome, CPF, `DATACOMPROMISSO` (só a data), `TIPOCOMPROMISSO` | não traz a hora |
| ED2 – agendamentos do funcionário | `empresaTrabalho`, `codigoFuncionario`, `tipoBuscaFuncionario` = 1 | `agenda`, `data`, `horario`, `tipo`, `atendido`, `codigoAgendamento` | só agendamentos **futuros**; uma consulta por funcionário |
| Pedido de Exame | só `empresa` = **código da empresa cliente** (não a principal), `funcionarioInicio` = 1, `funcionarioFim` = 9999, `paramData` = 1, `dataInicio` e `dataFim` (com outros parâmetros, mesmo vazios, o SOC não devolve os pedidos) | `SEQUENCIAFICHA`, empresa, funcionário, CPF, `DATAFICHA`, exames | período de até 30 dias; uma linha por exame |

O web service não aceita requisições em paralelo (a integração pode ser desligada pelo SOC). O fluxo faz uma chamada por vez.

## Sincronização (n8n `sincronizar_agendamentos_soc`)

Arquivo para importar: [`docs/n8n/sincronizar_agendamentos_soc.json`](n8n/sincronizar_agendamentos_soc.json) (sem segredos: tudo vem do banco).

1. Roda às 7h, 12h e 17h, de segunda a sábado (fuso de São Paulo), ou manualmente.
2. Nodes do Supabase leem `integracao_soc` (unidades com usuário Agenda), `integracao_soc_exporta_dados` (ativos) e os agendamentos que já têm horário.
3. Período: de hoje até o próximo dia útil (na sexta, vai até segunda, incluindo o fim de semana). Como o ED2 só devolve agendamentos futuros, o horário é obtido **no dia anterior**; quem é agendado para o próprio dia fica sem horário.
4. **Monta consultas iniciais** gera uma consulta por unidade ao ED1 → **Loop consultas**.
5. Cada chamada ao SOC, dentro de um loop (lote de 1), passa por: **Prepara segurança** (nonce, created e binário `digestInput`) → **Crypto** (SHA1 em base64 = PasswordDigest) → **Monta SOAP** (envelope com `wsse:Security`, username e PasswordDigest; as chaves não seguem adiante) → **HTTP Request** (`ws_url`, formato de resposta no padrão do node, erro segue adiante; não use "Response Format: Text", que entrega o stream compactado em vez do XML) → **Interpreta resposta** (erro do ED, `faultstring` do WS-Security ou dados) → volta ao loop. O cabeçalho é gerado logo antes de cada envio porque o timestamp vale 1 minuto.
6. **Monta consultas por empresa**, a partir do ED1: um **Pedido de Exame por empresa** com agendado (parâmetro `empresa` = código da empresa cliente; funcionários 1–9999, que dá para trocar nas constantes `FUNCIONARIO_INICIO`/`FUNCIONARIO_FIM` do node; até 200 por execução) e um **ED2 por funcionário** com agendamento futuro ainda sem horário (até 300). **Há consultas por empresa?** → **Loop por empresa**, com a mesma sequência de nodes.
7. **Monta sincronização** junta tudo: horário e código do agendamento vêm do ED2; o sequencial da ficha é o da mesma data do agendamento ou, se não houver, o mais recente até essa data.
8. **Gravar sincronização** insere uma linha por unidade em `agendamentos_sincronizacoes`. O trigger chama `sincronizar_agendamentos`, guarda o resultado e descarta a lista recebida. Se o ED1 da unidade falhar (ou não estiver configurado), a linha fica como `falha_consulta` e nada é gravado. As últimas execuções aparecem em Configurações > Integrações.

WS-Security é o padrão em todas as chamadas (username e chave de acesso de Integrações). A coluna `integracao_soc.ws_security` (fora da tela) desliga o cabeçalho, se algum dia for preciso.

Para ativar: rodar as duas migrações; em Configurações > Integrações, preencher URL do web service, empresa principal, usuário Agenda (ex.: 9010 na Praia Grande) e código e chave dos três Exporta Dados; importar o fluxo, escolher a credencial do Supabase (service_role) nos quatro nodes do Supabase e executar manualmente uma vez.

## Tabela `agendamentos`

Uma linha por unidade, data, empresa e funcionário. Guarda só o necessário para a fila e os indicadores: sem e-mail, telefone, endereço ou RG.

| Campo | Origem / uso |
|---|---|
| `data`, `horario`, `codigo_agendamento`, `atendido_soc` | ED1 (data) e ED2 (horário, código, atendido) |
| `codigo_empresa`, `nome_empresa`, `codigo_funcionario`, `nome`, `cpf`, `tipo_compromisso` | ED1 |
| `sequencial_ficha` | Pedido de Exame |
| `atendimento_id`, `vinculado_em` | vínculo com o atendimento (ver "Vínculo com o atendimento") |
| `removido_soc_em` | o agendamento deixou de vir do SOC (cancelado ou remarcado); volta a nulo se reaparecer |
| `primeira_sincronizacao_em` | quando apareceu pela primeira vez (antecedência do agendamento) |

Na sincronização, horário, código e sequencial já conhecidos não são apagados quando chegam vazios. Leitura: usuários da própria unidade (RLS). Gravação: só a função, pelo n8n.

## Recepção (fase 2)

- **Agendados do dia** (`components/recepcao/AgendadosDoDia.tsx`): troca "Fila de senhas \| Agendados do dia" no topo da Chamada de Senhas. Lista os agendados de hoje com horário, funcionário e CPF, empresa, tipo de compromisso, sequencial (clique copia) e situação: **Chegou** (senha e hora de chegada; clique abre o atendimento na fila), **Aguardando chegada**, **Atrasado** (há quanto tempo), **Sem horário** (agendado no próprio dia) e **Saiu da agenda** (`removido_soc_em`). Filtros por situação com contagem, busca por nome, CPF, empresa ou sequencial, hora da última sincronização; atualiza a cada minuto.
- **Busca de agendado na ficha** (`components/recepcao/BuscaAgendado.tsx`): no topo do diálogo da ficha, digitar CPF, nome ou empresa (3 caracteres ou mais) lista os agendados de hoje. Escolhido um com sequencial, a ficha é importada pela mesma busca por sequencial; sem sequencial, preenche nome, CPF, empresa e código do funcionário. Avisa quando o agendado já está ligado a outra senha.

## Vínculo com o atendimento

Funções `vincular_agendamento_atendimento` e `vincular_agendamentos_pendentes`. O agendamento do dia (mesma unidade e data do atendimento, fuso de São Paulo) é ligado ao atendimento pelo mesmo sequencial da ficha; senão, pelo CPF do paciente; senão, por empresa + código do funcionário. Cada lado é ligado uma vez só.

- Ao salvar a ficha: trigger `tr_vincular_agendamento_atendimento` em `atendimentos` (inserção ou mudança de `paciente_id`/`ficha_sequencial`). Uma falha no vínculo nunca impede gravar a ficha.
- A cada sincronização: o trigger da sincronização liga os atendimentos do período ainda sem vínculo (agendamento que chegou depois do paciente) e grava `vinculados` no resultado.

## Regras de fila (fase 3)

- Recepção: continua por ordem de senha. Ao chamar, a recepcionista identifica o paciente pelo documento, escolhe na lista de agendados ou busca pelo CPF, e a ficha vem completa.
- Especialidades:
  1. agendados cujo horário já chegou, pela hora agendada (quem chega atrasado não perde a vez);
  2. depois, sem agendamento e quem chegou antes do horário, por ordem de chegada. Ao chegar o horário do adiantado, ele passa para o grupo 1.
- Preferencial: continua decidido pelos usuários, como hoje.

## Indicadores do time de agendamento (fase 4)

Objetivo: tirar o agendamento do modo reativo, conhecendo o índice de encaixe e de não comparecimento para dimensionar a agenda e ajustá-la ao corpo médico disponível.

| Indicador | Cálculo previsto |
|---|---|
| Agendados | agendamentos do dia sem `removido_soc_em` |
| Comparecimento | agendados com atendimento vinculado ÷ agendados |
| Não comparecimento | agendados sem atendimento no fim do dia ÷ agendados |
| Encaixe | atendimentos do dia sem agendamento vinculado ÷ atendimentos do dia |
| Agendado no dia | agendamentos que apareceram pela primeira vez no próprio dia (sem horário) |
| Pontualidade | chegada (emissão da senha) − horário agendado: adiantados, no horário, atrasados |
| Cancelados/remarcados | agendamentos com `removido_soc_em` |
| Aderência à capacidade | agendados por faixa de horário e especialidade × profissionais disponíveis pela jornada (Configurações > Salas e Profissionais) |

Recortes: dia, semana, mês, empresa, tipo de compromisso, especialidade e faixa de horário.
