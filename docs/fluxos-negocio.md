# Regras e fluxos de negócio

## Atendimento

1. A senha (Normal ou Preferencial) é gerada e impressa pelo aplicativo Java da recepção. O botão de gerar senha da tela também registra a senha, mas não imprime.
2. A recepcionista ativa o guichê, chama a senha (o painel anuncia) e importa a ficha do SOC por PDF ou número sequencial.
3. Após conferir dados e exames, a ficha é salva: o sistema grava `atendimentos` e os itens em `atendimento_exames`. Só entram exames cadastrados no sistema.
4. Ao finalizar a recepção (contagem de 30 segundos, ou 30 minutos para encaixe, cancelável), o paciente passa a `AGUARDANDO_EXAMES` e aparece nas filas das especialidades.
5. O especialista chama apenas pacientes liberados pelas dependências e inicia o atendimento.
6. Ao concluir a etapa, o sistema libera as etapas dependentes ou finaliza o paciente.
7. O painel de TV acompanha as chamadas e anuncia sala e andar conforme a configuração.

Status do atendimento na recepção:

| Status | Significado |
|---|---|
| `AGUARDANDO_RECEPCAO` | Senha gerada, aguardando chamada no guichê |
| `EM_FILA` | Aguardando ser chamado no painel |
| `EM_RECEPCAO` | Paciente chamado e em atendimento no guichê |
| `NAO_ATENDIDO` | Não compareceu à chamada; pode ser chamado novamente |
| `AGUARDANDO_EXAMES` | Recepção concluída; paciente nas filas das especialidades |
| `FINALIZADO` / `CANCELADO` | Atendimento encerrado ou cancelado |

O cancelamento é feito apenas na recepção; a especialidade não cancela atendimentos.

A identificação de sala e profissional da fila fica no `localStorage` por usuário durante no máximo uma hora. Ao expirar com a fila aberta, o sistema limpa a identificação e reabre o modal. Todo login bem-sucedido também remove a identificação anterior, obrigando nova confirmação. A sessão de guichê da recepção é independente.

Antes de mudar um status, pesquise o valor em recepção, fila dinâmica, painel, componentes de status e relatórios.

## Painel

O painel carrega salas, unidade e `painel_config`. `fala_andar` controla o anúncio do andar; `fala_terreo` decide se o piso zero é pronunciado como térreo. A apresentação visual do térreo permanece independente da voz.

## Relatórios e indicadores

As telas enviam período e filtros ao servidor, que anexa a unidade da sessão e chama o n8n. Relatório geral e indicadores retornam um `jobId`, consultado a cada 3 segundos; o relatório de exames pendentes responde diretamente. A tela apresenta tabelas e gráficos com o resultado.

## ASO

### Origem dos dados

Os ASOs vêm diretamente da base do SOC, por sincronização agendada no n8n (`busca_ged_asos` → `consulta_asos_ged` → `identificar_exames`). Não dependem da conclusão do atendimento no sistema: o status da recepção é exibido apenas como informação complementar. O GED é uma funcionalidade do SOC.

### Gestão

`/aso/aso-pendente` consome a última sincronização, mostra período de 30 dias, classifica exames e separa pendentes e concluídos. `prazos_exames` controla dias, tipo e a dispensa de documento GED.

Prazo `0` é válido e significa o mesmo dia útil. Ausência de configuração é "Sem prazo". A coluna legada `ignorar_exame` significa **dispensar documento GED**: com data do exame, o item está concluído; sem data, permanece pendente. A flag não exclui o exame da classificação nem do cálculo de prazo.

O gráfico de situação do prazo no dashboard apresenta apenas ASOs com prazo calculável, nas categorias **No prazo** e **Vencidos**. Registros sem configuração ou sem data-base não entram nesse gráfico. Para prazo `0`, a data-limite é a própria data do exame; depois dela, o ASO é vencido.

As views de exames pendentes e concluídos exibem no `CardHeader` a ação em massa laranja **Atendimento concluído**, usando os funcionários selecionados pelos checkboxes. Após confirmação, a ação chama `POST /api/enviar-asos-concluidos` com `acao: "CONCLUIDO"`; ela não cria estado em `pacientes_assinatura`. Quando a API confirma o envio, os itens processados são removidos da fonte visual compartilhada pelas duas views, pelos cards e pelos gráficos, atualizando imediatamente todas as estatísticas da página. Essa marcação fica no `localStorage`, isolada por unidade e por `processadoEm`: sobrevive ao F5 e a consultas que retornem a mesma sincronização, sendo reiniciada automaticamente quando chegar uma sincronização com novo `processadoEm`. A tabela de exames pendentes não exibe a coluna de status do atendimento.

Nas views de exames pendentes e concluídos, a aba **Montados** reconhece tanto os CPFs salvos na sessão quanto registros cuja observação contenha `ASO montado`, `ASO emitido` ou `montado`. A view pendente resolve a observação no item analítico e, como alternativa, no funcionário completo retornado pela sincronização.

As duas views oferecem busca textual e filtros combináveis por médico, exame, credenciada (`prestador`) e período inclusivo da data da ficha. A data inicial significa "a partir de" e a data final significa "até o fim daquele dia"; não é necessário existir uma ficha exatamente nas datas-limite. Se o intervalo não tiver resultados, o card, os filtros e a tabela permanecem visíveis com uma mensagem de lista vazia. O filtro de exame verifica a lista completa de exames do funcionário apenas para decidir se ele participa do resultado; os demais exames do registro continuam disponíveis na visualização. O botão **Limpar filtros** restaura todos esses campos sem alterar a aba ativa.

O cabeçalho das views mantém as ações centralizadas em uma faixa compacta acima dos filtros e distribui os campos horizontalmente por toda a largura disponível. As datas usam controles horizontais `De` e `Até`; os indicadores **ASOs vencidos** e **ASOs no prazo** usam uma apresentação reduzida, sem subtítulo, para aproximar a tabela do topo. Em telas menores, filtros e ações quebram linhas de forma responsiva.

Em `/aso/assinatura-aso`, operadores podem selecionar e reenviar em massa ASOs enviados e pendências enviadas tanto nas abas específicas quanto na visão **Todos**. Os checkboxes usam borda e estado marcado de alto contraste. Toda ação confirmada pela API gera auditoria em `pacientes_assinatura_logs` com a identidade obtida da sessão do servidor.

Nas views de `/aso/aso-pendente`, o envio direto persiste os CPFs no `localStorage`, isolados por unidade e por `processadoEm`. A identificação visual **Enviado direto** sobrevive ao F5 e a consultas da mesma sincronização; a lista é reiniciada automaticamente quando chega uma sincronização real com novo `processadoEm`.

### Vínculo com o atendimento

As views de exames pendentes e concluídos consultam o status da recepção pelo hook `useStatusAtendimentos`. O vínculo prioriza CPF, depois nome e ficha sequencial. Quando há mais de um atendimento para o paciente, a data da ficha seleciona o registro correspondente; ficha exata, observação e atendimento mais recente funcionam como alternativas. As consultas ao Supabase são divididas em lotes com concorrência limitada para evitar URLs REST extensas e sobrecarga, todos os cadastros encontrados para o mesmo CPF são considerados e somente a requisição mais recente pode atualizar a tela.

### Liberação

Selecionar e liberar grava o paciente em `pacientes_assinatura`, envia a ação `LIBERAR` e a observação `ASO montado`, que o n8n grava no GED do SOC. A interface marca temporariamente o item como montado até nova sincronização.

### Especialista

Na fila Assinar, registra `ASSINADO` ou `PENDENCIA`. A pendência exige justificativa individual, inclusive em massa.

### Operador e recepção

Na fila Enviar, envia registros `ASSINADO` como `ENVIADO` e registros `PENDENCIA` como `PENDENCIA_ENVIADA`. Cada pendência pode ser revisada individualmente. Envios diretos ficam como `ENVIADO_DIRETO`. O e-mail vai para os endereços da empresa cadastrados no SOC e anexa apenas arquivos do GED com "ASO" no nome.

### Retenção

Registros `ENVIADO` e `ENVIADO_DIRETO` com mais de 30 dias são inativados diariamente às 3h pelo workflow `limpa_asos_enviados_banco` e saem da tela de assinatura, sem exclusão de dados.

## Configurações

- Grupos afetam filtros e consolidações.
- No filtro de obrigatórias + opcionais, um item pode ser marcado como excludente; se essa especialidade estiver no atendimento, ele não entra no grupo. Especialidades não selecionadas são neutras.
- Salas e profissionais determinam onde e por quem uma fila pode ser atendida.
- Usuários combinam papel, unidade, especialidade e situação ativa.
- A unidade fornece identidade e dados usados em telas e documentos.
