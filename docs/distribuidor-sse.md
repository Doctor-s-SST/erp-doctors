# Distribuidor SSE

Serviço Node (Express + `pg`) que mantém as telas atualizadas em tempo real usando Server-Sent Events. O código está em [`services/distribuidor-sse/server.js`](../services/distribuidor-sse/server.js); em produção roda na VPS (EasyPanel, `node:20-alpine`), atrás do Traefik, no endereço `doctors-distribuidor-sse.cgalnz.easypanel.host`, e também na porta 8765 exposta diretamente.

## Como funciona

```text
Mudança em atendimentos / atendimento_exames ──trigger──▶ pg_notify('fila_alterada', { unidade_id })
Nova mensagem em chat_mensagens ──────────────trigger──▶ pg_notify('chat_nova_mensagem', mensagem)
                                                              │
                                     Distribuidor SSE (LISTEN nos dois canais)
                                                              │
        consulta as funções de leitura da unidade e envia aos navegadores conectados
```

1. Ao iniciar, abre uma conexão com o PostgreSQL (`DATABASE_URL`) e executa `LISTEN fila_alterada` e `LISTEN chat_nova_mensagem`.
2. **Fila:** cada aviso de `fila_alterada` marca a unidade como alterada. Após 500 ms, para cada unidade marcada que tenha telas conectadas, o serviço consulta só o que essas telas precisam e envia a cada uma o seu tipo de dado. Vários avisos seguidos viram um único envio.
3. **Chat:** a mensagem recebida em `chat_nova_mensagem` é repassada, sem consulta ao banco, a todos os navegadores conectados ao chat da unidade.
4. A cada 30 segundos envia um comentário `: ping` para manter as conexões abertas.

## Endpoints

| Endpoint | Parâmetros | Uso |
|---|---|---|
| `GET /` | — | Verificação de saúde; responde `OK` |
| `GET /stream-fila` | `unidadeId` (obrigatório), `tipo` (obrigatório), `sala` (para `especialidade`) | Fluxo de dados das filas. Ao conectar, envia a carga inicial; depois, a cada alteração |
| `GET /stream-chat` | `unidadeId` | Fluxo de mensagens novas do chat (sem carga inicial) |

### Tipos de cliente em `/stream-fila`

| `tipo` | Tela | Função consultada | Mensagem enviada |
|---|---|---|---|
| `recepcao` | Chamada de Senhas e Dashboard (dia atual) | `get_painel_recepcao_novo(unidade)` | `{ "tipo": "recepcao", "dados": [...] }` |
| `especialidade` | Fila da especialidade (`sala` = nome da especialidade) | `get_fila_especialidade_novo(sala, unidade)` | `{ "tipo": "especialidade", "dados": [...] }` |
| `painel_tv` | Painel de Senhas | `get_painel_tv_fila(unidade)` | `{ "tipo": "painel_tv", "dados": [...] }` |

O dashboard usa o tipo `recepcao` apenas como gatilho: ao receber uma mensagem, recarrega os próprios dados com `get_dashboard_completo`. As colunas devolvidas por cada função estão em [funcoes-banco.md](funcoes-banco.md).

### Mensagem do chat

```json
{ "id": "uuid", "unidade_id": "uuid", "sala_id": "uuid ou null", "usuario_id": "uuid", "usuario_nome": "Nome", "mensagem": "texto", "created_at": "data" }
```

## Configuração

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão direta com o PostgreSQL do Supabase |
| `PORT` | Porta HTTP (padrão `8765`) |

## Pontos de atenção

- **Sem autenticação:** `/stream-fila` e `/stream-chat` não validam sessão nem token, e o CORS aceita qualquer origem. Quem souber o `unidadeId` (visível no navegador) recebe em tempo real nomes de pacientes, empresas, senhas e as mensagens do chat. Recomenda-se exigir o token do Supabase na conexão e conferir a unidade do usuário.
- **Porta 8765 exposta:** além do acesso pelo Traefik (HTTPS), a porta está aberta diretamente na VPS (ver seção 9 do documento técnico). Mantenha só o acesso pelo Traefik.
- **Conexão única sem reconexão:** usa um único cliente PostgreSQL. Se a conexão cair, o erro é apenas registrado: o serviço continua no ar, mas para de receber avisos, e as telas deixam de atualizar até o container ser reiniciado. Recomenda-se reconectar automaticamente e refazer o `LISTEN`.
- **Acesso direto ao banco:** a consulta usa o usuário de `DATABASE_URL`, fora do RLS. A separação por unidade depende só do parâmetro `unidadeId`.
- **Sem limpeza no chat:** quando a última conexão de chat de uma unidade fecha, a lista vazia continua em memória (efeito pequeno).
- **Datas:** as funções de leitura filtram pelo dia do servidor do banco (ver [funcoes-banco.md](funcoes-banco.md#pontos-de-atenção)).

## Manutenção

- O código em `services/distribuidor-sse` é uma cópia para consulta e versionamento; o deploy continua sendo feito no EasyPanel. Ao alterar em produção, atualize a cópia na mesma entrega.
- Ao mudar o nome ou as colunas de `get_painel_recepcao_novo`, `get_fila_especialidade_novo` ou `get_painel_tv_fila`, atualize o serviço e as telas que consomem os dados.
- Um novo tipo de tela exige: um `tipo` novo no serviço (carga inicial e envio), a função de leitura no banco e a conexão na tela.
