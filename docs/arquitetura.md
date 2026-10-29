# Arquitetura do Gestão de Fila Doctor's

## Visão geral

```text
Navegadores e TV do painel
  ├─ Front-end Next.js (Netlify)
  │     ├─ Supabase JS: login, dados e funções (RPC), protegidos por RLS
  │     └─ /api/* (servidor): valida sessão e unidade e chama os webhooks do n8n
  └─ Distribuidor SSE: atualizações em tempo real (filas, recepção, painel, dashboard, chat)

VPS (Hostinger, EasyPanel/Docker)
  ├─ Traefik: proxy reverso e HTTPS
  ├─ Supabase: PostgreSQL, Auth, REST, Realtime, Storage
  ├─ n8n (editor, webhook e worker) + PostgreSQL próprio
  ├─ Redis: cache e resultado dos jobs do n8n
  └─ Distribuidor SSE (Node)

n8n ⇄ SOC (web services; o GED é uma funcionalidade do SOC)
Aplicativo Java de senhas (desktop da recepção) → gera e imprime a senha
```

O grupo `src/app/(admin)` contém a aplicação autenticada. `(full-width-pages)` contém login, erros e o painel de TV. Componentes de domínio ficam em `src/components`; clientes, contratos e utilitários ficam em `src/lib`.

## Hospedagem

| Componente | Onde roda |
|---|---|
| Front-end e rotas `/api` | Netlify |
| Supabase, n8n, Redis, distribuidor SSE | VPS na Hostinger (KVM 4, São Paulo), com EasyPanel sobre Docker Swarm e Traefik |
| Emissão de senha impressa | Aplicativo Java (.exe) instalado na recepção |

Detalhes do servidor, portas, situação de segurança e riscos estão na seção 9 do documento técnico.

## Supabase e multiunidade

`src/lib/supabase.ts` cria o cliente do navegador. `server-supabase.ts` cria o cliente do servidor com cookies. `api-auth.ts` valida usuário, perfil ativo e unidade antes dos endpoints protegidos.

O vínculo principal é `profiles.unidade_id`. Toda leitura ou escrita operacional deve ser limitada à unidade autenticada. As políticas RLS repetem essa garantia no banco (ver [banco-de-dados.md](banco-de-dados.md)).

## Autenticação e autorização

`proxy-supabase.ts` atualiza a sessão, protege prefixos de rota e direciona cada perfil:

| Perfil | Destino padrão |
|---|---|
| admin | `/dashboards/atendimento` |
| recepcao | `/sistema-filas/senhas-recepcao` |
| painel | `/painel-senhas` |
| operador | `/aso/aso-pendente` |
| especialista | fila vinculada ou lista de filas |

`AppSidebar.tsx` controla apenas a visibilidade do menu. Ao criar uma página protegida, atualize o proxy (`ROUTE_PERMISSIONS`), o menu e o RLS. Esconder um item não autoriza nem protege a rota: rotas que não estão em `ROUTE_PERMISSIONS` ficam acessíveis a qualquer usuário logado (ver [paginas.md](paginas.md)).

## Domínios do código

- `components/atendimento`: dashboard, impressão, relatórios e status.
- `components/kanban`: exames, especialidades e dependências.
- `components/chat`: mensagens e leitura em tempo real.
- `components/grupos`: grupos de especialidades.
- `components/user`: perfis e usuários.
- `components/ui`: primitivas visuais compartilhadas.

## Tempo real

O distribuidor SSE escuta os avisos `fila_alterada` e `chat_nova_mensagem` do PostgreSQL e publica `stream-fila` (por unidade e tipo: `recepcao`, `especialidade` ou `painel_tv`) e `stream-chat`. Recepção, filas, painel, dashboard do dia e chat dependem dele. Não substitua o SSE por polling sem avaliar volume e atraso. Funcionamento e pontos de atenção em [distribuidor-sse.md](distribuidor-sse.md); o código está em [`services/distribuidor-sse`](../services/distribuidor-sse/server.js).

## n8n e SOC

As rotas `/api` recebem os dados, validam a sessão, impõem a unidade e chamam os webhooks do n8n com o cabeçalho `x-api-key` (`N8N_API_KEY`). Segredos nunca vão para o código do navegador. O n8n é a única camada que conversa com o SOC.

| Grupo | Workflows |
|---|---|
| Recepção | `extracao_aso_sequencial`, `extracao_aso_pdf` |
| ASO | `consulta_asos_ged`, `altera_socged_asos`, `download_ged`, `identificar_exames` |
| Agendados | `busca_ged_asos`, `limpa_asos_enviados_banco` |
| Relatórios e indicadores | `relatorio_atendimento_geral_erp`, `relatorio_exames_pendentes`, `indicadores_mensais`, indicadores por especialidade |
| Jobs | `consultar_relatorio` |

Relatórios, indicadores e ações de ASO são assíncronos: a chamada inicial retorna um `jobId`, gravado no Redis, e a tela consulta `/api/consulta-relatorios?id=...` a cada 3 segundos até a conclusão. A relação completa entre rotas e workflows está em [api.md](api.md) e na seção 7 do documento técnico.

## ASO

O módulo fica em `src/app/(admin)/(others-pages)/aso`. Os ASOs vêm da base do SOC por sincronização agendada no n8n, sem depender da conclusão do atendimento no sistema. `src/lib/aso-assinatura.ts` e `src/lib/resultado-acao-aso.ts` centralizam o contrato de `/api/enviar-asos-concluidos`. Cada item contém `paciente`, `acao` e `observacao`; os dois últimos não devem ser duplicados dentro de `paciente`.

## Pontos sensíveis

- Valores de status são contratos compartilhados com telas, banco, SSE e automações.
- Filas, painel, dashboard e chat dependem do distribuidor SSE.
- A senha impressa é emitida pelo aplicativo Java da recepção; o botão da tela apenas registra a senha.
- `next.config.ts` permite imagens apenas do host Supabase configurado.
