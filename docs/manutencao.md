# Guia de manutenção

## Onde alterar cada recurso

| Recurso | Arquivos principais |
|---|---|
| menu e papéis | `src/layout/AppSidebar.tsx`, `src/lib/proxy-supabase.ts` |
| sessão em APIs | `src/lib/api-auth.ts`, `src/lib/server-supabase.ts` |
| recepção/emissão | `sistema-filas/senhas-recepcao/page.tsx` |
| lista de filas | `sistema-filas/filas/page.tsx`, `docs/filas.md` |
| atendimento | `sistema-filas/filas/[id]/page.tsx`, `docs/filas.md` |
| sessão de sala/profissional | `src/lib/fila-session.ts` |
| painel de TV | `painel-senhas/page.tsx`, `configuracoes/painel/page.tsx` |
| salas/profissionais | `configuracoes/salas-profissionais/page.tsx` |
| dashboard | `dashboards/atendimento/page.tsx`, `lib/dashboard-analytics.ts` |
| relatórios | `sistema-filas/relatorios/*`, `src/app/api/relatorio*` |
| indicadores | `analise-dados/*`, `api/indicadores*` |
| ASO | `aso/*`, `lib/aso-assinatura.ts`, `api/enviar-asos-concluidos` |
| status do atendimento no ASO | `aso/aso-pendente/hooks/useStatusAtendimentos.ts` |
| GED | `FuncionarioModal.tsx`, `api/download-documento-ged` |
| chat | `src/components/chat/*` |

## Procedimento seguro

Regra permanente: toda alteração funcional deve atualizar, na mesma entrega, os documentos relacionados em `docs/` e o `README.md` quando a navegação ou a visão geral forem afetadas.

1. identifique rota, perfil, unidade e tabelas afetadas;
2. verifique consumidores com `rg`;
3. preserve contratos de status e payloads externos;
4. faça mudança pequena e tipada;
5. valide `npx tsc --noEmit`, lint direcionado e build;
6. teste com usuário de cada papel afetado;
7. confira n8n e banco quando houver integração;
8. atualize documentação e migração.

## Nova página

Crie `page.tsx`, defina permissão no proxy, adicione ao menu com os mesmos papéis, aplique unidade em consultas e documente em `paginas.md`.

## Novo estado de atendimento

Pesquise estados atuais em `atendimentos`, `atendimento_exames`, recepção, fila dinâmica, painel, relatórios e componentes `StatusSenha*`. Atualize todos em uma única entrega e coordene automações.

## Alteração de banco

Prepare migração reversível, adicione default para coluna obrigatória nova, atualize tipos/consultas e confirme RLS. Como não há migrações versionadas hoje, instituí-las é prioridade técnica.

## Alteração de webhook

Atualize variável, Route Handler, validação, documentação e workflow n8n. Nunca faça o frontend chamar webhook privado diretamente.

## Consultas em massa no Supabase

Evite enviar listas grandes diretamente para `.in(...)`: o PostgREST codifica os valores na URL e proxies podem rejeitar a requisição antes de devolver os cabeçalhos CORS. Divida nomes, CPFs, fichas e IDs em lotes pequenos e nunca converta silenciosamente uma resposta com `error` em uma lista vazia, pois isso pode produzir estados falsos como “Sem atendimento”.

## Débitos técnicos conhecidos

- páginas operacionais muito extensas concentram consulta, regra e UI;
- uso frequente de `any` reduz proteção de tipos;
- esquema e migrações do Supabase não estão versionados;
- desenvolvimento compartilha dados de produção;
- permissões aparecem em proxy e menu, exigindo sincronização manual;
- há rota de análise por especialidade implementada, mas oculta no menu;
- há dois conjuntos históricos de componentes UI; evite criar uma terceira variante.

## Refatorações recomendadas

Priorize extração gradual, com testes de comportamento:

1. hooks de contexto do usuário/unidade;
2. repositórios tipados para tabelas Supabase;
3. constantes únicas de status e papéis;
4. serviços para transições de atendimento;
5. componentes menores nas páginas acima de 800 linhas;
6. testes de contrato para payloads n8n;
7. ambiente de homologação.

## Checklist de entrega

- nenhuma credencial adicionada ao Git;
- consultas isoladas por unidade;
- rota e menu com os mesmos papéis;
- estados tratados em todos os consumidores;
- loading, erro e confirmação preservados;
- TypeScript e build aprovados;
- documentação atualizada.

## Limpeza realizada em setembro de 2026

Foram removidas páginas demonstrativas do template e seus componentes exclusivos: exemplos de gráficos, formulários, tabela, calendário, página vazia e elementos UI. Também foram removidos a tela privada `_aso` e seu endpoint exclusivo `relatorio-aso`. Não foram removidos componentes compartilhados com funcionalidades do produto.
