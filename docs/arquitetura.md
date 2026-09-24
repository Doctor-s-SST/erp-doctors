# Arquitetura do ERP Doctor's

## Visão geral

```text
Navegador
  ├─ páginas e componentes React
  ├─ Supabase JS: autenticação, dados e realtime
  └─ /api/*: autenticação server-side e webhooks n8n
          ├─ SOC
          ├─ GED
          └─ relatórios e indicadores
```

O grupo `src/app/(admin)` contém a aplicação autenticada. `(full-width-pages)` contém login, erros e o painel de TV. Componentes de domínio ficam em `src/components`; clientes, contratos e utilitários ficam em `src/lib`.

## Supabase e multiunidade

`src/lib/supabase.ts` cria o cliente do navegador. `server-supabase.ts` cria o cliente do servidor com cookies. `api-auth.ts` valida usuário, perfil ativo e unidade antes dos endpoints protegidos.

O vínculo principal é `profiles.unidade_id`. Toda leitura ou escrita operacional deve ser limitada à unidade autenticada. As políticas RLS devem repetir essa garantia no banco.

## Autenticação e autorização

`proxy-supabase.ts` atualiza a sessão, protege prefixos de rota e direciona cada perfil:

| Perfil | Destino padrão |
|---|---|
| admin | `/dashboards/atendimento` |
| recepcao | `/sistema-filas/senhas-recepcao` |
| painel | `/painel-senhas` |
| operador | `/aso/aso-pendente` |
| especialista | fila vinculada ou lista de filas |

`AppSidebar.tsx` controla apenas visibilidade. Ao criar uma página protegida, atualize proxy, menu e RLS. Esconder um item não autoriza nem protege a rota.

## Domínios

- `components/atendimento`: dashboard, impressão, relatórios e status.
- `components/kanban`: exames, especialidades e dependências.
- `components/chat`: mensagens e leitura via realtime.
- `components/grupos`: grupos de especialidades.
- `components/user`: perfis e usuários.
- `components/ui`: primitivas visuais compartilhadas.

## n8n e serviços externos

Route Handlers de `src/app/api` recebem dados, validam sessão, impõem a unidade e encaminham aos webhooks com `N8N_API_KEY`. Segredos nunca devem ir para código cliente.

Relatórios e indicadores são assíncronos: a chamada inicial retorna `jobId`; `/api/consulta-relatorios?id=...` consulta até conclusão.

## ASO

O módulo fica em `src/app/(admin)/(others-pages)/aso`. `src/lib/aso-assinatura.ts` centraliza o contrato de `/api/enviar-asos-concluidos`. Cada item contém `paciente`, `acao` e `observacao`; os dois últimos não devem ser duplicados dentro de `paciente`.

## Pontos sensíveis

- Valores de status são contratos compartilhados com telas e automações.
- Filas, painel e chat dependem de atualizações em tempo real.
- Impressão de senha depende de infraestrutura local/ESC-POS.
- `next.config.ts` permite imagens apenas do host Supabase configurado.
