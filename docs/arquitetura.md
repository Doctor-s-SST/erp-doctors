# Arquitetura do Sistema

## Visão Geral

O sistema foi criado pensando em lógica de mudança de status por atendimento. É composto por múltiplas camadas integradas:

```
Usuário (Frontend)
↓
Next.js (API Routes)
↓
Supabase (Banco de Dados)
↓
n8n (Automações)
↓
App de Impressão (Java .exe)
↓
Impressora térmica (TCP)
```

---

## Componentes

### 1. Frontend (Next.js)

* Interface de atendimento (recepção + especialidades)
* Painel de chamadas
* Kanban de exames e especialidades
* Relatórios
* Dashboards
* Configurações (permissões, salas, profissionais)

---

### 2. API (Next.js)

* `/api/gerar-declaracao`
* `/api/importar-ficha`
* `/api/importar-ficha-sequencial`
* `/api/relatorio`
* `/api/relatorio-aso`
* `/api/relatorio-exames`
* Processamento de dados
* Integração com n8n

---

### 3. Supabase

* Banco PostgreSQL
* Tabela principal: `atendimentos` e `atendimento_exames`
* Controle de permissões, troca de unidades, atendimentos

---

### 4. n8n

* Fluxos automatizados
* Integração com eventos do sistema (relatórios, importação de ficha)
* Processamento assíncrono

---

### 5. App de Impressão

* Executa em máquina local (Java .exe)
* Inclui atendimento no Supabase
* Envia comandos ESC/POS via TCP
* Imprime senha gerada

<!-- ## Fluxo de Impressão

1. App Acionador gera senha
3. App Acionador chama função `gerar_senha` do Supabase
2. Registro inserido em `atendimento`
4. App Acionador envia comando para impressora
5. Senha gerada no frontend e impressa

---

## Fluxo de Importação de Ficha

1. Usuário seleciona a senha
2. Frontend chama `/api/importar ficha`
3. API chama n8n que puxa dados do ASO importado (pdf)
4. Dados são processados
5. Retorno para UI

---

## Fluxo de Relatórios

1. Usuário seleciona período e/ou filtros
2. Frontend chama `/api/relatorio`
3. API chama n8n que puxa dados do Supabase
4. Dados são processados
5. Retorno para UI com filtros e ordenação

---

## Fluxo de Gerar Declaração de Comparecimento

1. Usuário seleciona o atendimento
2. Frontend chama `/api/gerar-declaracao`
3. API chama n8n que puxa dados do Supabase
4. Dados são processados
5. Retorno para UI com filtros e ordenação

--- -->
