# Gestão de Fila Doctor's

Sistema web para operação de clínicas de saúde ocupacional. Reúne gestão de filas, chamada de senhas, atendimento por especialidade, painel de TV, relatórios, indicadores e gestão do ciclo de ASOs.

## Visão rápida

- Next.js 16, App Router, React 19 e TypeScript, publicado na Netlify.
- Supabase para autenticação, PostgreSQL, storage e funções (RPC), com RLS.
- Distribuidor SSE para atualização em tempo real de recepção, filas, painel, dashboard e chat.
- n8n como camada de integração com o SOC (fichas, ASOs e documentos do GED), relatórios e indicadores.
- Supabase, n8n, Redis e distribuidor SSE hospedados em VPS (Hostinger, EasyPanel).
- Controle multiunidade por `profiles.unidade_id`.
- Perfis: `admin`, `recepcao`, `especialista`, `operador` e `painel`.
- Senha impressa gerada pelo aplicativo Java da recepção (fora deste repositório).

## Começando

```bash
npm install
npm run dev
```

O servidor local inicia em `http://localhost:3000`. Configure antes as variáveis descritas em [Setup e ambiente](docs/setup.md).

## Comandos

```bash
npm run dev      # desenvolvimento na porta 3000
npm run build    # build de produção
npm run start    # executa o build
npm run lint     # análise estática
npx tsc --noEmit # validação TypeScript
```

## Documentação

**Para quem mantém o sistema**

- [Setup e ambiente](docs/setup.md)
- [Arquitetura](docs/arquitetura.md)
- [Mapa de páginas](docs/paginas.md)
- [APIs](docs/api.md)
- [Banco de dados](docs/banco-de-dados.md)
- [Funções e triggers do banco](docs/funcoes-banco.md) e [esquema versionado](docs/sql/schema_public.sql)
- [Módulo de filas](docs/filas.md)
- [Distribuidor SSE](docs/distribuidor-sse.md) (tempo real) e [código do serviço](services/distribuidor-sse)
- [Regras e fluxos de negócio](docs/fluxos-negocio.md)
- [Guia de manutenção](docs/manutencao.md)
- [Atualização da documentação e do Swagger](docs/atualizacao-documentacao.md)

**Para quem usa o sistema**

- [Guia funcional](docs/uso.md)
- [Manual de ASO](docs/Manual_do_Usuario_Gestao_de_ASO.docx)

**Entregáveis**

- [Documento técnico](docs/Documentacao_Tecnica_Gestao_de_Fila_Doctors.docx): tecnologias, fluxogramas por tela, workflows do n8n, banco de dados, infraestrutura e segurança, volume de dados, requisitos e APIs.
- [Especificação OpenAPI](docs/api/openapi.json) e [página do Swagger](docs/api/swagger.html), que abre direto no navegador.

## Estrutura principal

```text
src/
  app/          rotas, layouts e Route Handlers (/api)
  components/   componentes de domínio e visuais
  context/      tema e estado da barra lateral
  hooks/        hooks reutilizáveis
  layout/       cabeçalho, menu e estrutura administrativa
  lib/          Supabase, autenticação, proxy de rotas, contratos e utilitários
public/         recursos estáticos
docs/           documentação técnica e funcional
docs/api/       especificação OpenAPI e página do Swagger
docs/sql/       esquema do banco exportado (estrutura, funções, triggers e RLS)
services/distribuidor-sse/  cópia do serviço SSE de produção (fora do build do Next.js)
```

## Regras essenciais

1. Toda consulta operacional deve respeitar a unidade do perfil autenticado.
2. Segredos do n8n permanecem no servidor; o front-end chama apenas `/api/*`.
3. Toda página protegida precisa estar no proxy de rotas (`src/lib/proxy-supabase.ts`) com os mesmos perfis do menu; esconder no menu não protege a rota.
4. Mudanças em estados de atendimento ou ASO afetam Supabase, SSE e n8n.
5. Desenvolvimento e produção usam atualmente o mesmo banco e os mesmos webhooks; testes locais podem alterar dados reais e enviar e-mails de ASO.
6. Toda mudança funcional atualiza a documentação na mesma entrega (ver [guia de atualização](docs/atualizacao-documentacao.md)).

## Deploy

O front-end e as rotas `/api` são publicados na Netlify. Supabase, n8n, Redis e o distribuidor SSE rodam na VPS. Consulte o [setup](docs/setup.md) e a [arquitetura](docs/arquitetura.md) antes de alterar variáveis, URLs ou credenciais.
