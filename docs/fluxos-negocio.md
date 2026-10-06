# Regras e fluxos de negócio

## Atendimento

1. Recepção importa a ficha por arquivo ou sequencial.
2. O sistema grava `atendimentos` e os itens em `atendimento_exames`.
3. A senha aguarda a especialidade elegível.
4. O especialista chama e inicia o atendimento.
5. Ao concluir, o sistema libera etapas dependentes ou finaliza o paciente.
6. Painel de TV acompanha chamadas e anuncia sala/andar conforme configuração.

A identificação de sala e profissional da fila fica no `localStorage` por usuário durante no máximo uma hora. Ao expirar com a fila aberta, o sistema limpa a identificação e reabre o modal. Todo login bem-sucedido também remove a identificação anterior, obrigando uma nova confirmação de sala e profissional. A sessão de guichê da recepção é independente.

Antes de mudar um status, pesquise o valor em recepção, fila dinâmica, painel, componentes de status e relatórios.

## Painel

O painel carrega salas, unidade e `painel_config`. `fala_andar` controla anúncio do andar; `fala_terreo` decide se o piso zero é pronunciado como térreo. A apresentação visual do térreo permanece independente da voz.

## Relatórios e indicadores

As telas enviam período e filtros ao backend. O n8n processa e geralmente retorna `jobId`. O frontend consulta o job e apresenta tabelas/gráficos. A unidade vem da sessão server-side.

## ASO

### Gestão

`/aso/aso-pendente` consome a última sincronização, mostra período de 30 dias, classifica exames e separa pendentes/concluídos. `prazos_exames` controla dias, tipo e a dispensa de documento GED.

Prazo `0` é válido e significa o mesmo dia útil. Ausência de configuração é “Sem prazo”. A coluna legada `ignorar_exame` significa **dispensar documento GED**: com data do exame, o item está concluído; sem data, permanece pendente. A flag não exclui o exame da classificação nem do cálculo de prazo.

O gráfico de situação do prazo no dashboard apresenta apenas ASOs com prazo calculável, nas categorias **No prazo** e **Vencidos**. Registros sem configuração ou sem data-base não entram nesse gráfico. Para prazo `0`, a data-limite é a própria data do exame; depois dela, o ASO é vencido.

As views de exames pendentes e concluídos exibem no `CardHeader` a ação em massa laranja **Atendimento concluído**, usando os funcionários selecionados pelos checkboxes. Após confirmação, a ação chama `POST /api/enviar-asos-concluidos` com `acao: "CONCLUIDO"`; ela não cria estado em `pacientes_assinatura`. Quando a API confirma o envio, os itens processados são ocultados das duas views, com atualização dos contadores e da paginação. Essa marcação fica no `localStorage`, isolada por unidade e por `processadoEm`: sobrevive ao F5 e a consultas que retornem a mesma sincronização, sendo reiniciada automaticamente quando chegar uma sincronização com novo `processadoEm`. A tabela de exames pendentes não exibe a coluna de status do atendimento.

### Vínculo com o atendimento

As views de exames pendentes e concluídos consultam o status da recepção pelo hook `useStatusAtendimentos`. O vínculo prioriza CPF, depois nome e ficha sequencial. Quando há mais de um atendimento para o paciente, a data da ficha seleciona o registro correspondente; ficha exata, observação e atendimento mais recente funcionam como alternativas. As consultas ao Supabase são divididas em lotes com concorrência limitada para evitar URLs REST extensas e sobrecarga, todos os cadastros encontrados para o mesmo CPF são considerados e somente a requisição mais recente pode atualizar a tela.

### Liberação

Selecionar e liberar grava o paciente em `pacientes_assinatura`, envia ação `LIBERAR` e observação `ASO montado`. A interface marca temporariamente o item como montado até nova sincronização.

### Especialista

Na fila Assinar, registra `ASSINADO` ou `PENDENCIA`. A pendência exige justificativa individual, inclusive em massa.

### Operador/recepção

Na fila Enviar, envia registros `ASSINADO` como `ENVIADO` e registros `PENDENCIA` como `PENDENCIA_ENVIADA`. Cada pendência pode ser revisada individualmente. Envios diretos ficam como `ENVIADO_DIRETO`.

## Configurações

- Grupos afetam filtros e consolidações.
- No filtro de obrigatórias + opcionais, um item pode ser marcado como excludente; se essa especialidade estiver no atendimento, ele não entra no grupo. Especialidades não selecionadas são neutras.
- Salas e profissionais determinam onde e por quem uma fila pode ser atendida.
- Usuários combinam papel, unidade, especialidade e ativo.
- Unidade fornece identidade e dados usados em telas/documentos.
