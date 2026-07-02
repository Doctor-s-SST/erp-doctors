# API do Sistema

# POST /api/relatorio

## Descrição

Retorna o relatório de atendimentos realizados dentro do período informado.

A API recebe os filtros, encaminha a requisição para um webhook do n8n e retorna os dados processados.

---

## Endpoint

```
POST /api/relatorio
```

---

## Content-Type

```
multipart/form-data
```

---

## Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| dataInicio | string | Sim | Data inicial do período (`YYYY-MM-DD`) |
| dataFim | string | Sim | Data final do período (`YYYY-MM-DD`) |
| unidadeId | string | Sim | ID da unidade. |

### Exemplo de envio

```http
POST /api/relatorio
Content-Type: multipart/form-data
```

| Campo | Valor |
|--------|-------|
| dataInicio | 2026-06-01 |
| dataFim | 2026-06-30 |
| unidadeId | (uuid) |

---

## Resposta (200)

```json
[
  {
    "cabecalho": {
      "nome": "João da Silva",
      "senha": "A001",
      "acionamento": "09/06/2026 08:15:20"
    },
    "exames": [
      {
        "data": "09/06/2026",
        "exame": "Micológico de unhas",
        "exame_id": "45f70a6d-8eac-46d2-ba02-377209a39432",
        "realizado": true,
        "obrigatorio_checkbox": false
      },
      {
        "data": "09/06/2026",
        "exame": "Hemograma completo",
        "exame_id": "065b3c7c-cf62-49ce-b236-c4349bf8963b",
        "realizado": true,
        "obrigatorio_checkbox": false
      },
      {
        "data": "09/06/2026",
        "exame": "Acuidade visual",
        "exame_id": "c8909472-26e7-4947-9181-300c8580cdf0",
        "realizado": true,
        "obrigatorio_checkbox": false
      },
      {
        "data": "09/06/2026",
        "exame": "Exame clínico",
        "exame_id": "830e97ca-14e1-4ed8-b628-5c1b12a1c7d3",
        "realizado": true,
        "obrigatorio_checkbox": false
      }
    ],
    "especialidades": [
      "TRIAGEM",
      "LABORATÓRIO",
      "CLÍNICO"
    ]
  }
]
```

---

## Estrutura da Resposta

### cabecalho

| Campo | Tipo | Descrição |
|--------|------|-----------|
| nome | string | Nome do paciente |
| senha | string | Senha do atendimento |
| acionamento | string | Data e hora do início do atendimento |

### exames

| Campo | Tipo | Descrição |
|--------|------|-----------|
| data | string | Data de realização do exame |
| exame | string | Nome do exame |
| exame_id | string (UUID) | Identificador do exame |
| realizado | boolean | Indica se o exame foi realizado |
| obrigatorio_checkbox | boolean | Indica se o exame exige confirmação manual |

### especialidades

Lista contendo as especialidades pelas quais o paciente passou durante o atendimento.

Exemplo:

```json
[
  "TRIAGEM",
  "LABORATÓRIO",
  "CLÍNICO"
]
```

---

## Códigos de Retorno

| Código | Descrição |
|---------|-----------|
| 200 | Relatório retornado com sucesso |
| 400 | Datas não informadas |
| 500 | Erro interno do servidor |
| 502 | Erro retornado pelo n8n (caso o webhook esteja indisponível ou recuse a requisição) |

---

## Observações

- As datas devem estar no formato `YYYY-MM-DD`.
- O envio deve ser realizado utilizando `multipart/form-data`.
- O campo `unidadeId` é obrigatório.
- A API atua como intermediária entre o frontend e o workflow do n8n.
- O retorno pode conter um ou mais atendimentos, dependendo do período informado.

---

# POST /api/relatorio-aso

## Descrição

Retorna os dados de ASO (Atestado de Saúde Ocupacional) dos atendimentos realizados no período informado.

A API recebe os filtros, encaminha a requisição para um webhook do n8n e retorna os dados processados.

---

## Endpoint

```
POST /api/relatorio-aso
```

---

## Content-Type

```
multipart/form-data
```

---

## Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| dataInicio | string | Sim | Data inicial do período (`YYYY-MM-DD`) |
| dataFim | string | Sim | Data final do período (`YYYY-MM-DD`) |
| unidadeId | string | Sim | ID da unidade. Caso não informado, consulta todas as unidades. |

### Exemplo de envio

```http
POST /api/relatorio-aso
Content-Type: multipart/form-data
```

| Campo | Valor |
|--------|-------|
| dataInicio | 2026-06-01 |
| dataFim | 2026-06-30 |
| unidadeId | 13 |

---

## Resposta (200)

```json
[
  {
    "dados_gerais": {
      "msg": "",
      "unidade": "13 Cond. Res. Paulo Roberto VI",
      "cpf": "28580227801",
      "rg": "572942813",
      "nome": "Ana Paula da Silva",
      "data_nascimento": "06/11/1974",
      "setor": "Operacional",
      "cargo": "Faxineiro",
      "sequencial_ficha": "361104860",
      "data_aso": "30/06/2026",
      "aptidao": "Apto para função",
      "cnpj": "05.982.013/0001-27",
      "razao_social": "13 Cond. Res. Paulo Roberto VI",
      "tipo_aso": "Periódico"
    },
    "riscos": [
      {
        "agente": "Químico",
        "descricao_risco": "Produtos de limpeza domissanitários [Cod: 09.01.001]"
      },
      {
        "agente": "Ergonômicos",
        "descricao_risco": "Posturas desconfortáveis [Cod: 09.01.001]"
      }
    ],
    "exames": [
      {
        "nome_exame": "Exame clínico",
        "data_exame": "30/06/2026",
        "codigo_exame": "CLINICO"
      }
    ]
  }
]
```

---

## Estrutura da Resposta

### dados_gerais

Informações do colaborador e do ASO.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| msg | string | Mensagem de retorno. Vazia quando não houver observações. |
| unidade | string | Unidade onde ocorreu o atendimento |
| cpf | string | CPF do colaborador |
| rg | string | RG do colaborador |
| nome | string | Nome completo |
| data_nascimento | string | Data de nascimento |
| setor | string | Setor do colaborador |
| cargo | string | Cargo exercido |
| sequencial_ficha | string | Número da ficha clínica |
| data_aso | string | Data de emissão do ASO |
| aptidao | string | Resultado da avaliação ocupacional |
| cnpj | string | CNPJ da empresa |
| razao_social | string | Razão social da empresa |
| tipo_aso | string | Tipo do ASO (Admissional, Periódico, Demissional, Retorno ao Trabalho, Mudança de Função etc.) |

---

### riscos

Lista contendo os riscos ocupacionais identificados para o colaborador.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| agente | string | Grupo do agente de risco |
| descricao_risco | string | Descrição do risco ocupacional |

Exemplo:

```json
[
  {
    "agente": "Químico",
    "descricao_risco": "Produtos de limpeza domissanitários [Cod: 09.01.001]"
  }
]
```

---

### exames

Lista de exames que compõem o ASO.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| nome_exame | string | Nome do exame |
| data_exame | string | Data de realização |
| codigo_exame | string | Código interno do exame |

Exemplo:

```json
[
  {
    "nome_exame": "Exame clínico",
    "data_exame": "30/06/2026",
    "codigo_exame": "CLINICO"
  }
]
```

---

## Códigos de Retorno

| Código | Descrição |
|---------|-----------|
| 200 | Consulta realizada com sucesso |
| 400 | Datas não informadas |
| 500 | Erro interno do servidor |
| 502 | Erro retornado pelo n8n (webhook indisponível ou requisição recusada) |

---

## Observações

- As datas devem ser enviadas no formato `YYYY-MM-DD`.
- O envio deve utilizar `multipart/form-data`.
- O campo `unidadeId` é opcional.
- A API atua como intermediária entre o frontend e o workflow do n8n.
- O retorno pode conter um ou mais ASOs, conforme os filtros informados.
- O conteúdo do campo `msg` pode ser utilizado para informar inconsistências ou observações relacionadas ao ASO.

---

# POST /api/relatorio-exames

## Descrição

Retorna o relatório de exames dos atendimentos realizados no período informado, contendo os exames solicitados, realizados, pendentes e indicadores de conclusão.

A API recebe os filtros, encaminha a requisição para um webhook do n8n e retorna os dados processados.

---

## Endpoint

```
POST /api/relatorio-exames
```

---

## Content-Type

```
multipart/form-data
```

---

## Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| dataInicio | string | Sim | Data inicial do período (`YYYY-MM-DD`) |
| dataFim | string | Sim | Data final do período (`YYYY-MM-DD`) |
| unidadeId | string | Sim | ID da unidade |

### Exemplo de envio

```http
POST /api/relatorio-exames
Content-Type: multipart/form-data
```

| Campo | Valor |
|--------|-------|
| dataInicio | 2026-06-01 |
| dataFim | 2026-06-30 |
| unidadeId | (uuid) |

---

## Resposta (200)

```json
[
  {
    "cabecalho": {
      "atendimento_id": "3f19ad60-44de-4223-ba5e-f3ce52a2c22b",
      "nome": "Wlisses Lartefanio Santos Sodre",
      "cpf": "35627305860",
      "empresa": "16 Hugo Navarro Flat-Service",
      "idade": "38 anos",
      "nascimento": "1987-11-17",
      "senha": "N022",
      "acionamento": "30/06/2026 08:14:13",
      "encaixe": false,
      "sequencial_ficha": "360874303",
      "tipo_exame": "Retorno ao Trabalho"
    },
    "especialidades": [
      "TRIAGEM",
      "CLÍNICO"
    ],
    "exames_atendimento": [
      {
        "data": "30/06/2026",
        "exame": "Exame clínico"
      }
    ],
    "exames_realizados": [],
    "exames_pendentes": [
      {
        "data": "30/06/2026",
        "exame": "Exame clínico"
      }
    ],
    "total_exames": 1,
    "total_realizados": 0,
    "total_pendentes": 1,
    "percentual_conclusao": 0,
    "percentual_pendencia": 100
  }
]
```

---

## Estrutura da Resposta

### cabecalho

Informações gerais do atendimento.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| atendimento_id | string (UUID) | Identificador do atendimento |
| nome | string | Nome do paciente |
| cpf | string | CPF do paciente |
| empresa | string | Empresa vinculada ao atendimento |
| idade | string | Idade do paciente |
| nascimento | string | Data de nascimento |
| senha | string | Senha do atendimento |
| acionamento | string | Data e hora do início do atendimento |
| encaixe | boolean | Indica se o atendimento foi realizado como encaixe |
| sequencial_ficha | string | Número da ficha clínica |
| tipo_exame | string | Tipo do exame ocupacional |

---

### especialidades

Lista contendo as especialidades pelas quais o paciente passou.

Exemplo:

```json
[
  "TRIAGEM",
  "CLÍNICO"
]
```

---

### exames_atendimento

Lista de todos os exames previstos para o atendimento.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| data | string | Data prevista ou realizada |
| exame | string | Nome do exame |

---

### exames_realizados

Lista contendo apenas os exames concluídos.

Estrutura:

| Campo | Tipo | Descrição |
|--------|------|-----------|
| data | string | Data de realização |
| exame | string | Nome do exame |

---

### exames_pendentes

Lista contendo apenas os exames ainda pendentes.

Estrutura:

| Campo | Tipo | Descrição |
|--------|------|-----------|
| data | string | Data do atendimento |
| exame | string | Nome do exame pendente |

---

### Indicadores

| Campo | Tipo | Descrição |
|--------|------|-----------|
| total_exames | integer | Quantidade total de exames previstos |
| total_realizados | integer | Quantidade de exames realizados |
| total_pendentes | integer | Quantidade de exames pendentes |
| percentual_conclusao | number | Percentual de exames concluídos |
| percentual_pendencia | number | Percentual de exames pendentes |

---

## Códigos de Retorno

| Código | Descrição |
|---------|-----------|
| 200 | Consulta realizada com sucesso |
| 400 | Datas não informadas |
| 500 | Erro interno do servidor |
| 502 | Erro retornado pelo n8n (webhook indisponível ou requisição recusada) |

---

## Observações

- As datas devem ser enviadas no formato `YYYY-MM-DD`.
- O envio deve utilizar `multipart/form-data`.
- O campo `unidadeId` é opcional.
- A API atua como intermediária entre o frontend e o workflow do n8n.
- O retorno pode conter um ou mais atendimentos.
- As listas `exames_realizados` e `exames_pendentes` podem estar vazias.
- Os percentuais são calculados com base na quantidade total de exames do atendimento.

---

# POST /api/gerar-declaracao

## Descrição

Gera uma **Declaração de Comparecimento** em formato PDF a partir dos dados de um atendimento e da unidade selecionada.

A API recebe as informações do atendimento em formato JSON, monta um documento HTML, converte-o para PDF utilizando o Puppeteer e retorna o arquivo gerado.

---

## Endpoint

```
POST /api/gerar-declaracao
```

---

## Content-Type

```
application/json
```

---

## Body

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| item | object | Sim | Dados do atendimento. |
| unidade | object | Sim | Dados da unidade responsável pela emissão da declaração. |

### Estrutura do objeto `item`

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| cabecalho.nome | string | Sim | Nome do paciente. |
| cabecalho.cpf | string | Sim | CPF do paciente. |
| cabecalho.acionamento | string | Sim | Data e hora de entrada no formato `DD/MM/AAAA HH:mm:ss`. |
| cabecalho.horario_saida | string | Sim | Data e hora de saída no formato `DD/MM/AAAA HH:mm:ss`. |

### Estrutura do objeto `unidade`

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| cnpj | string | Sim | CNPJ da empresa. |
| razao_social | string | Sim | Razão social da empresa. |
| cidade | string | Sim | Cidade onde a declaração foi emitida. |

---

## Exemplo de Requisição

```json
{
  "item": {
    "cabecalho": {
      "nome": "Ana Paula da Silva",
      "cpf": "28580227801",
      "acionamento": "30/06/2026 08:14:13",
      "horario_saida": "30/06/2026 09:32:45"
    }
  },
  "unidade": {
    "cnpj": "05.982.013/0001-27",
    "razao_social": "Doctor's Medicina e Segurança do Trabalho",
    "cidade": "Praia Grande"
  }
}
```

---

## Resposta (200)

A API retorna um arquivo PDF.

### Headers

```
Content-Type: application/pdf
Content-Disposition: inline; filename="declaracao.pdf"
```

O documento contém:

- Nome do paciente;
- CPF;
- Empresa;
- CNPJ;
- Data do atendimento;
- Horário de entrada;
- Horário de saída;
- Cidade de emissão;
- Data de emissão;
- Assinatura eletrônica da empresa.

---

## Códigos de Retorno

| Código | Descrição |
|---------|-----------|
| 200 | PDF gerado com sucesso |
| 500 | Erro ao gerar o documento |

---

## Observações

- A requisição deve ser enviada em formato `application/json`.
- O PDF é gerado dinamicamente utilizando **Puppeteer**.
- Caso algum campo obrigatório não seja informado, o documento será gerado utilizando textos de preenchimento (linhas em branco) para os respectivos campos.
- A data e hora de emissão são geradas automaticamente utilizando o fuso horário **America/Sao_Paulo**.
- O PDF é retornado para visualização (`inline`), podendo ser salvo pelo cliente conforme necessidade.

---

# POST /api/importar-ficha

## Descrição

Importa uma ficha clínica em formato **PDF**, realiza o processamento do documento através de um workflow do n8n e retorna os dados estruturados extraídos do arquivo.

A API recebe um arquivo PDF utilizando `multipart/form-data`, encaminha o documento para o n8n e devolve todas as informações identificadas na ficha.

---

## Endpoint

```
POST /api/importar-ficha
```

---

## Content-Type

```
multipart/form-data
```

---

## Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| file | File (PDF) | Sim | Arquivo PDF da ficha clínica. |

### Exemplo de envio

```http
POST /api/importar-ficha
Content-Type: multipart/form-data
```

| Campo | Valor |
|--------|-------|
| file | ficha.pdf |

---

## Resposta (200)

```json
[
  {
    "empresa": {
      "razao_social": "Fornare Pizzaria Ltda",
      "cnpj": "30.531.125/0001-09",
      "endereco": "Rua Dair Borges, 232 - Boqueirão - CEP 11701-210",
      "cidade": "Praia Grande/SP"
    },
    "funcionario": {
      "nome": "Nathan Hiago Castro Bispo",
      "cpf": "414.201.498-65",
      "rg": "414",
      "nascimento": "24/09/1998",
      "idade": null,
      "cargo": "Cumin",
      "setor": "Operacional",
      "matricula": null,
      "ficha": "361085067"
    },
    "medico": {
      "nome": "Jayme Dantas P. de Pádua",
      "crm": "81191/SP"
    },
    "exame": {
      "tipo": "Admissional",
      "data_emissao": "30/06/2026"
    },
    "riscos": {
      "quimicos": [
        "Produtos de limpeza domissanitários [Cod: 09.01.001]."
      ],
      "ergonomicos": [
        "Posturas desconfortáveis [Cod: 09.01.001]."
      ],
      "acidentes": [
        "Objetos cortantes e/ou perfurocortantes [Cod: 09.01.001]",
        "Piso escorregadio e/ou irregular [Cod: 09.01.001]"
      ]
    },
    "exames": [
      {
        "data": "30/06/2026",
        "exame": "Acuidade visual"
      },
      {
        "data": "30/06/2026",
        "exame": "Hemograma completo"
      }
    ],
    "parecer": "Apto para função Apto para Manipulação de Alimentos",
    "observacoes": ""
  }
]
```

---

## Estrutura da Resposta

### empresa

Dados da empresa.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| razao_social | string | Razão social da empresa |
| cnpj | string | CNPJ da empresa |
| endereco | string | Endereço completo |
| cidade | string | Cidade/UF |

---

### funcionario

Dados do colaborador.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| nome | string | Nome completo |
| cpf | string | CPF |
| rg | string \| null | RG |
| nascimento | string | Data de nascimento |
| idade | string \| null | Idade |
| cargo | string | Cargo |
| setor | string | Setor |
| matricula | string \| null | Matrícula |
| ficha | string | Número da ficha clínica |

---

### medico

Dados do médico responsável.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| nome | string | Nome do médico |
| crm | string | CRM |

---

### exame

Informações do exame ocupacional.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| tipo | string | Tipo do exame (Admissional, Periódico, Demissional, etc.) |
| data_emissao | string | Data de emissão do exame |

---

### riscos

Agrupamento dos riscos ocupacionais identificados.

Cada categoria contém um vetor de descrições.

Categorias possíveis:

- quimicos
- fisicos
- biologicos
- ergonomicos
- acidentes
- inespecificos

Exemplo:

```json
{
  "quimicos": [
    "Produtos de limpeza domissanitários"
  ],
  "ergonomicos": [
    "Posturas desconfortáveis"
  ]
}
```

---

### exames

Lista dos exames encontrados na ficha.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| data | string | Data de realização |
| exame | string | Nome do exame |

---

### parecer

Texto contendo o parecer médico.

---

### observacoes

Campo destinado às observações da ficha.

---

## Códigos de Retorno

| Código | Descrição |
|---------|-----------|
| 200 | Arquivo processado com sucesso |
| 400 | Arquivo não enviado |
| 500 | Erro interno do servidor |
| 502 | Erro retornado pelo n8n (webhook indisponível ou requisição recusada) |

---

## Observações

- O arquivo deve ser enviado utilizando `multipart/form-data`.
- O campo deve possuir o nome **file**.
- O documento deve estar no formato **PDF**.
- A API atua como intermediária entre o frontend e o workflow do n8n responsável pela leitura e extração dos dados.
- Alguns campos podem retornar `null` quando a informação não estiver presente ou não puder ser identificada no documento.
- As categorias de riscos retornadas podem variar conforme o conteúdo da ficha clínica enviada.

---

# POST /api/importar-ficha-sequencial

## Descrição

Consulta uma ficha clínica a partir do seu número sequencial e retorna os dados estruturados do ASO, incluindo informações do colaborador, empresa, riscos ocupacionais e exames realizados.

A API recebe o número sequencial da ficha, encaminha a consulta para um workflow do n8n e retorna os dados encontrados.

---

## Endpoint

```
POST /api/importar-ficha-sequencial
```

---

## Content-Type

```
application/json
```

---

## Body

| Campo | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| sequencial | string | Sim | Número sequencial da ficha clínica. |

### Exemplo de Requisição

```json
{
  "sequencial": "361371645"
}
```

---

## Resposta (200)

```json
[
  {
    "dados_gerais": {
      "unidade": "Escola De Educacao Infantil Constance Kamil",
      "cpf": "36897018805",
      "rg": "438694764",
      "nome": "Ayana Angelica da Silva Braz",
      "data_nascimento": "03/06/1988",
      "setor": "Administrativo",
      "cargo": "Auxiliar de Secretaria",
      "sequencial_ficha": "361371645",
      "data_aso": "02/07/2026",
      "codigo_funcionario": "5",
      "medico_coordenador": "699.702.549-87",
      "cnpj": "03.851.389/0001-77",
      "razao_social": "C.R.E.C.I Constance Kamil Ltda",
      "tipo_aso": "Periódico"
    },
    "riscos": [
      {
        "agente": "Ergonômicos",
        "descricao_risco": "Posturas desconfortáveis [Cod: 09.01.001]"
      }
    ],
    "exames": [
      {
        "nome_exame": "Acuidade visual",
        "data_exame": "02/07/2026",
        "codigo_exame": "50.01.001-8",
        "codigo_empresa": "1468240",
        "codigo_funcionario": "5"
      },
      {
        "nome_exame": "Exame clínico",
        "data_exame": "02/07/2026",
        "codigo_exame": "CLINICO",
        "codigo_empresa": "1468240",
        "codigo_funcionario": "5"
      }
    ]
  }
]
```

---

## Estrutura da Resposta

### dados_gerais

Informações gerais da ficha clínica.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| unidade | string | Unidade onde o atendimento foi realizado |
| cpf | string | CPF do colaborador |
| rg | string | RG do colaborador |
| nome | string | Nome completo |
| data_nascimento | string | Data de nascimento |
| setor | string | Setor |
| cargo | string | Cargo |
| sequencial_ficha | string | Número sequencial da ficha |
| data_aso | string | Data de emissão do ASO |
| codigo_funcionario | string | Código interno do funcionário |
| medico_coordenador | string | Identificação do médico coordenador |
| cnpj | string | CNPJ da empresa |
| razao_social | string | Razão social da empresa |
| tipo_aso | string | Tipo do ASO |

---

### riscos

Lista contendo os riscos ocupacionais encontrados na ficha.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| agente | string | Categoria do risco |
| descricao_risco | string | Descrição do risco ocupacional |

Exemplo:

```json
[
  {
    "agente": "Ergonômicos",
    "descricao_risco": "Posturas desconfortáveis [Cod: 09.01.001]"
  }
]
```

---

### exames

Lista dos exames vinculados à ficha.

| Campo | Tipo | Descrição |
|--------|------|-----------|
| nome_exame | string | Nome do exame |
| data_exame | string | Data de realização |
| codigo_exame | string | Código do exame |
| codigo_empresa | string | Código interno da empresa |
| codigo_funcionario | string | Código interno do funcionário |

---

## Códigos de Retorno

| Código | Descrição |
|---------|-----------|
| 200 | Consulta realizada com sucesso |
| 400 | Sequencial não informado |
| 500 | Erro interno do servidor |
| 502 | Erro retornado pelo n8n (webhook indisponível ou requisição recusada) |

---

## Observações

- A requisição deve ser enviada em formato `application/json`.
- O campo `sequencial` corresponde ao número sequencial da ficha clínica.
- A API atua como intermediária entre o frontend e o workflow do n8n responsável pela consulta da ficha.
- O retorno pode conter um ou mais registros, dependendo da resposta do workflow.
- Os códigos de empresa, funcionário e exames são identificadores internos utilizados para integração com outros sistemas.
