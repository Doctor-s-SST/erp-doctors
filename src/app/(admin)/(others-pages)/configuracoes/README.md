# Configurações

O módulo reúne configurações administrativas vinculadas à unidade do usuário autenticado.

## Estrutura

- `users/`: usuários, papéis, especialidades e situação ativa.
- `unidade/`: dados cadastrais, endereço e identidade visual da unidade.
- `painel/`: comportamento de voz e localização usado no painel de chamadas.
- `salas-profissionais/`: salas, vínculos com especialidades, profissionais e jornadas.
- `grupos-especialidades/`: grupos usados nos filtros de filas e relatórios.
- `types.ts`: contratos compartilhados das entidades de configuração.
- `utils.ts`: filtros, ordenação, mensagens e metadados de papéis.
- `unidade/utils.ts`: validação de logos e formatação de CNPJ/CEP.

## Fluxo comum

1. A página obtém o usuário autenticado.
2. O perfil determina a unidade ativa.
3. Todas as consultas e gravações são restringidas por essa unidade.
4. Após alterações, a página atualiza somente os dados sob sua responsabilidade.

## Cuidados ao evoluir

- Não remover o filtro por `unidade_id` das consultas e vínculos.
- Manter exclusões de vínculos antes da exclusão das entidades principais.
- Não alterar nomes ou formatos de colunas durante refatorações visuais.
- Tipar novos retornos em `types.ts` em vez de adicionar `any` às páginas.
- Manter filtros e transformações puras em `utils.ts`.
- Logos aceitam somente PNG, JPEG ou SVG com até 2 MB.
- Validar TypeScript, lint dos arquivos alterados e build antes de concluir.
