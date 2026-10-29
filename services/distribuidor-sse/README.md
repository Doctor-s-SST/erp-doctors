# Distribuidor SSE

Serviço Node que envia em tempo real os dados de recepção, filas, painel de TV, dashboard e chat do Gestão de Fila Doctor's.

Este diretório guarda uma cópia do código que roda em produção, na VPS (EasyPanel, imagem `node:20-alpine`), para consulta e versionamento. Ele não faz parte do build do Next.js. Ao alterar o serviço em produção, atualize esta cópia na mesma entrega.

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL
npm start
```

As versões das dependências em `package.json` são referência; confirme as instaladas no container de produção.

Funcionamento, endpoints, mensagens e pontos de atenção: [docs/distribuidor-sse.md](../../docs/distribuidor-sse.md).
