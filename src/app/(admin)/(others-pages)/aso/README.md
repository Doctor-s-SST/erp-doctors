# Módulo de ASO

Este diretório reúne as telas e regras do fluxo operacional de ASO. A organização busca manter componentes visuais separados das regras de interpretação de respostas e dos estados compartilhados.

## Estrutura

- `aso-pendente/`: consulta geral, dashboard e listas de exames pendentes/concluídos.
  - `page.tsx`: carrega os dados, controla a aba ativa e coordena atualizações.
  - `components/`: apresentação, diálogos e filtros das listas.
  - `hooks/`: estados reutilizados pelas views e persistência local.
  - `types.ts`: contratos de dados deste fluxo.
  - `utils.ts`: normalização, datas, prazos e transformações puras.
- `assinatura-aso/`: ações em lote e comunicação com o processamento de ASOs.
  - `page.tsx`: seleção, confirmação e atualização da interface.
  - `resultado-acao.ts`: chamada da ação e interpretação fail-safe do resultado.
  - `components/`: modais específicos das ações.
- `prazo-exames/`: configuração dos prazos usados na classificação dos exames.

## Componentes compartilhados das listas

- `FiltroPrazoCards.tsx`: cards clicáveis de vencidos, no prazo e suspensos.
- `PainelFiltrosExames.tsx`: layout e campos comuns de filtro.
- `FiltroGrupoExames.tsx`: criação, inspeção e edição dos grupos de exames.
- `useFiltrosTabelaExames.ts`: estado comum dos filtros e limpeza coordenada.
- `useConjuntoPersistido.ts`: conjuntos de CPFs armazenados no `localStorage`.

As regras próprias de cada lista continuam nas respectivas views. A view de pendentes e a de concluídos compartilham somente estrutura e estado realmente equivalentes.

## Fluxo de ações do n8n

1. A tela inicia a ação pela rota interna `/api/enviar-asos-concluidos`.
2. O backend conversa com o n8n sem expor URL privada ou `x-api-key` no navegador.
3. O front recebe um `jobId` e consulta o resultado pela rota interna de relatórios.
4. Enquanto o job estiver em `processing`, nenhum paciente é confirmado.
5. Em `done`, somente a lista `problematicos` é enviada à interpretação existente.
6. Os pacientes ausentes dessa lista são considerados confirmados e seguem as atualizações já definidas pela regra de negócio.
7. Em `error`, timeout, resposta ambígua ou formato inválido, ninguém é confirmado.

O arquivo `assinatura-aso/resultado-acao.ts` concentra essa fronteira. Alterações no contrato externo devem ser tratadas ali ou na biblioteca compartilhada de comunicação, mantendo `page.tsx` responsável apenas por coordenar a tela.

## Grupos de exames

Os grupos são persistidos para o usuário e não precisam ser recriados diariamente. Existem dois modos:

- `somente`: o atendimento deve corresponder ao conjunto definido pelo grupo;
- `contendo`: basta possuir pelo menos um dos exames selecionados (regra OU).

Ao alterar essa lógica, preserve a mesma semântica nas views de pendentes e concluídos.

## Regras de segurança funcional

- Não atualizar status antes da confirmação final do job.
- Não repetir automaticamente a chamada inicial após falha de polling.
- Não transformar resposta ambígua em sucesso.
- Não remover a identificação obrigatória dos itens problemáticos.
- Não duplicar regras de prazo, normalização ou interpretação nas páginas.
- Manter mensagens de erro voltadas ao funcionário afetado, sem expor detalhes técnicos desnecessários na interface.

## Como evoluir

Antes de adicionar estado ou markup duplicado às duas views, verifique se ele pertence a um hook ou componente compartilhado. Regras específicas de pendentes/concluídos devem permanecer locais; regras puras e comuns devem ficar em `utils.ts` ou em um hook dedicado. Rode `npx tsc --noEmit` e o lint dos arquivos alterados antes de concluir a mudança.
