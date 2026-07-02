# Setup do Sistema

## Pré-requisitos

* Node.js 18+
* VPS (para n8n e Supabase)
* Impressora térmica configurada em rede

---

## Instalação

```bash
git clone <repo>
cd projeto
npm install
```

---

## Variáveis de ambiente

Criar `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Definir variáveis de ambiente do n8n.

---

## Rodar localmente

```bash
npm run dev
```

---

## App de Impressão

Baixar arquivos do app e clicar duas vezes no .exe

---

## Deploy

### Frontend

* Netlify

### Backend

* VPS (Supabase + n8n)

---

## Importante

* App deve estar rodando para impressão funcionar
* Impressora deve estar acessível via IP
* Porta padrão: `9100`

---
