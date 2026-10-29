# Setup e ambiente

## Requisitos

- Node.js compatível com Next.js 16 e npm;
- acesso ao Supabase da VPS (URL e chave pública);
- webhooks do n8n configurados e chave `N8N_API_KEY`;
- Google Chrome instalado em `C:\Program Files\Google\Chrome\Application\chrome.exe` para gerar a declaração de comparecimento em desenvolvimento (em produção é usado o `@sparticuz/chromium`);
- na recepção, o aplicativo Java de senhas, que gera e imprime a senha (não faz parte deste repositório).

## Instalação

```bash
git clone <repositorio>
cd erp-doctors
npm install
npm run dev
```

O servidor local inicia em `http://localhost:3000`.

## Variáveis

Ficam em `.env.local` (não versionado). As variáveis `N8N_*` são usadas apenas no servidor; nunca as exponha com o prefixo `NEXT_PUBLIC_`.

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública; a segurança depende do RLS |
| `N8N_API_KEY` | chave enviada no cabeçalho `x-api-key` aos webhooks |
| `N8N_WEBHOOK_URL` | importação de ficha por PDF (`extracao_aso_pdf`) |
| `N8N_WEBHOOK_SEQUENCIAL_URL` | importação por sequencial (`extracao_aso_sequencial`) |
| `N8N_WEBHOOK_CONSULTA_RELAT_URL` | consulta de jobs (`consultar_relatorio`) |
| `N8N_WEBHOOK_RELATORIO_ATENDIMENTOS_URL` | relatório geral (`relatorio_atendimento_geral_erp`) |
| `N8N_WEBHOOK_INDICADORES_URL` | indicadores (`indicadores_mensais`) |
| `N8N_WEBHOOK_INDICADORES_ESPECIALIDADES_URL` | indicadores por especialidade |
| `N8N_WEBHOOK_RELATORIO_EXAMES_PENDENTES_URL` | relatório de exames pendentes (`relatorio_exames_pendentes`) |
| `N8N_WEBHOOK_CONSULTA_ASOS_URL` | última sincronização de ASOs (`consulta_asos_ged`) |
| `N8N_WEBHOOK_ENVIAR_ASOS_CONCLUIDOS_URL` | ações de ASO (`altera_socged_asos`) |
| `N8N_WEBHOOK_DOWNLOAD_GED_URL` | download de documento do GED (`download_ged`) |

`N8N_WEBHOOK_RELAT_ASO_URL` pertencia a uma tela legada removida. Elimine-a depois de confirmar que nenhuma automação externa a usa.

O endereço do distribuidor SSE está fixo no código das telas (`stream-fila` e `stream-chat`), não em variável de ambiente.

## Banco compartilhado

Desenvolvimento e produção usam atualmente o mesmo banco e os mesmos webhooks. Operações feitas em `npm run dev` alteram dados reais, inclusive ações de ASO que gravam no SOC e enviam e-mails. Recomenda-se um ambiente de homologação com Supabase, unidade e webhooks separados.

## Deploy

O front-end e as rotas `/api` são publicados na Netlify. Supabase, n8n, Redis e o distribuidor SSE rodam na VPS (ver [arquitetura.md](arquitetura.md)). Configure as mesmas variáveis no painel da Netlify.

## Validação

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Diagnóstico

- `401`: sessão ausente ou expirada.
- `403`: usuário inativo, sem unidade ou sem permissão.
- Webhook: confira URL, chave, método, payload e a execução no n8n (menu Executions).
- Job que não termina: confira a execução do workflow e a chave do job no Redis.
- Dados vazios: confira `unidade_id`, RLS e período.
- Lista ou painel sem atualizar: confira a conexão com o distribuidor SSE.
- Imagem bloqueada: confira `images.remotePatterns` em `next.config.ts`.
