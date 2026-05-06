# Sistema de Gestão de Filas - Clínicas de Medicina Ocupacional

Sistema completo para gerenciamento de atendimentos, controle de fluxo de pacientes, emissão de senhas e relatórios analíticos. 

---

## Tecnologias

* **Frontend / Backend:** Next.js (App Router + API Routes)
* **Banco de dados:** Supabase (PostgreSQL)
* **Automações:** n8n
* **Worker de impressão:** Java .exe + ESC/POS (TCP)
* **Deploy:** Netlify + VPS

---

## Estrutura do Projeto

```bash
src/
  app/  
    api/           # Endpoints (relatórios, fihca, declaração de comparecimento)
  components/      # Componentes UI
  hooks/           # Hooks customizados
  layout/           # Sidebar e Header customizados
  lib/             # Integrações (supabase, utils)
```

---

## Documentação

* [Arquitetura](./docs/arquitetura.md)
* [Setup](./docs/setup.md)
* [Guia de Uso](./docs/uso.md)
* [API](./docs/api.md)

---

## Rodando localmente

```bash
npm install
npm run dev
```

---

## Produção

* Frontend hospedado na Netlify
* Supabase e n8n rodando em VPS
* Worker de impressão rodando via .exe feito em Java, sendo instalado em cada máquina que chama senhas

---

## Observações importantes

* Impressão depende de worker local ativo
* Impressora térmica usa protocolo TCP (porta 9100)
* Sistema depende de conexão com Supabase

---

## Funcionalidades

* Emissão de senhas (normal, preferencial)
* Painel de chamada
* Kanban de exames e especialidades
* Relatórios e dashboards de atendimento
* Filas de atendimentos com autonomia de trabalho
* Impressão automática
* Controle de tempo de espera e permanência
* Controle de usuários e permissões (admin)
* Controle de salas e profissionais

---
