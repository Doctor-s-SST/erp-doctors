# Setup e ambiente

## Requisitos

- Node.js compatível com Next.js 16 e npm;
- Supabase acessível;
- webhooks n8n configurados;
- worker e impressora em rede para impressão de senhas.

## Instalação

```bash
git clone <repositorio>
cd erp-doctors
npm install
npm run dev
```

## Variáveis

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública; segurança depende de RLS |
| `N8N_API_KEY` | autenticação server-side com n8n |
| `N8N_WEBHOOK_URL` | importação de ficha |
| `N8N_WEBHOOK_SEQUENCIAL_URL` | importação por sequencial |
| `N8N_WEBHOOK_CONSULTA_RELAT_URL` | consulta de jobs |
| `N8N_WEBHOOK_RELATORIO_ATENDIMENTOS_URL` | relatório geral |
| `N8N_WEBHOOK_INDICADORES_URL` | indicadores mensais |
| `N8N_WEBHOOK_INDICADORES_ESPECIALIDADES_URL` | indicadores por especialidade |
| `N8N_WEBHOOK_RELATORIO_EXAMES_PENDENTES_URL` | relatório de pendências |
| `N8N_WEBHOOK_CONSULTA_ASOS_URL` | consulta/sincronização de ASOs |
| `N8N_WEBHOOK_ENVIAR_ASOS_CONCLUIDOS_URL` | ações de ASO |
| `N8N_WEBHOOK_DOWNLOAD_GED_URL` | download GED |

`N8N_WEBHOOK_RELAT_ASO_URL` pertencia a uma tela legada removida. Elimine-o depois de confirmar que nenhuma automação externa o usa.

## Banco compartilhado

Desenvolvimento e produção usam atualmente o mesmo banco. Operações feitas em `npm run dev` podem alterar produção. Recomenda-se projeto Supabase, unidade e webhooks separados para homologação.

## Validação

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Diagnóstico

- `401`: sessão ausente ou expirada.
- `403`: usuário inativo, sem unidade ou sem permissão.
- webhook: confira URL, chave, método, payload e logs do n8n.
- dados vazios: confira `unidade_id`, RLS e período.
- imagem bloqueada: confira `images.remotePatterns`.
