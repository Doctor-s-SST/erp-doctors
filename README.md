# ERP Doctor's

Sistema web para operação de clínicas de saúde ocupacional. Reúne gestão de filas, emissão e chamada de senhas, atendimento por especialidade, relatórios, indicadores, painel de TV e gestão do ciclo de ASOs.

## Visão rápida

- Next.js 16, App Router, React 19 e TypeScript.
- Supabase para autenticação, PostgreSQL, storage e realtime.
- n8n como camada de integração com SOC, GED, relatórios e indicadores.
- Controle multiunidade por `profiles.unidade_id`.
- Perfis: `admin`, `recepcao`, `especialista`, `operador` e `painel`.
- Impressão local e comunicação ESC/POS para senhas.

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

- [Arquitetura](docs/arquitetura.md)
- [Setup e ambiente](docs/setup.md)
- [Mapa de páginas](docs/paginas.md)
- [APIs](docs/api.md)
- [Banco de dados](docs/banco-de-dados.md)
- [Regras e fluxos de negócio](docs/fluxos-negocio.md)
- [Guia de manutenção](docs/manutencao.md)
- [Guia funcional](docs/uso.md)
- [Manual de ASO](docs/Manual_do_Usuario_Gestao_de_ASO.docx)

## Estrutura principal

```text
src/
  app/          rotas, layouts e Route Handlers
  components/   componentes de domínio e visuais
  context/      tema e estado da barra lateral
  hooks/        hooks reutilizáveis
  layout/       cabeçalho, menu e estrutura administrativa
  lib/          Supabase, autenticação, contratos e utilitários
public/         recursos estáticos
docs/           documentação técnica e funcional
```

## Regras essenciais

1. Toda consulta operacional deve respeitar a unidade do perfil autenticado.
2. Segredos de n8n permanecem no servidor; o frontend chama `/api/*`.
3. Visibilidade no menu não substitui autorização no proxy e no banco.
4. Mudanças em estados de atendimento ou ASO afetam Supabase, realtime e n8n.
5. Desenvolvimento e produção usam atualmente o mesmo banco; testes locais podem alterar dados reais.

## Deploy

O frontend é preparado para Next.js/Netlify. Supabase e n8n são serviços externos. Consulte o setup antes de alterar variáveis, URLs ou credenciais.
