# Sistema de filas

Este módulo cobre a recepção, filas por especialidade, relatórios e painéis analíticos. As páginas continuam responsáveis pela coordenação de estado e pelas operações no Supabase; contratos e regras puras ficam fora delas.

## Estrutura

- `senhas-recepcao/`: geração de senhas, importação de ficha, atendimento da recepção e impressão.
  - `page.tsx`: coordena consultas, RPCs, modais e ações da tela.
  - `types.ts`: contratos de atendimento, perfil e especialidade.
  - `utils.ts`: formatação e cálculo visual de tempo de espera.
- `filas/`: seleção e operação das filas por especialidade.
  - `page.tsx`: entrada na fila e escolha de sala/profissional.
  - `[id]/page.tsx`: atendimento de uma especialidade.
  - `types.ts`: contratos compartilhados das filas.
  - `utils.ts`: normalização, horários e tempo de espera.
  - `components/SortableTableHead.tsx`: cabeçalho ordenável compartilhado.
- `relatorios/`: relatório geral e exames pendentes.
- `analise-dados/`: indicadores mensais e recortes por especialidade.
- `shared/relatorios.ts`: períodos, ordenação textual e contrato de polling usados por relatórios e indicadores.
- `kanban/`: rota de redirecionamento para a seleção de filas.

## Fluxos principais

### Recepção

1. O perfil autenticado determina a unidade.
2. A sessão de guichê é recuperada por usuário no `localStorage`.
3. A tela consulta os atendimentos e acompanha mudanças em tempo real.
4. Ações de chamada/finalização continuam usando os RPCs definidos na página.
5. Importação por PDF ou sequencial alimenta a mesma ficha antes da gravação.

### Fila de especialidade

1. O usuário escolhe sala e profissional.
2. A sessão é persistida pelas funções de `@/lib/fila-session`.
3. A página `[id]` consulta pacientes e exames da especialidade selecionada.
4. Grupos de especialidade e estados recentes permanecem persistidos no navegador.
5. Bloqueios, chamadas, cancelamentos e finalizações mantêm os RPCs atuais.

### Relatórios e indicadores

As páginas que recebem `jobId` usam `shared/relatorios.ts`:

1. `iniciarJobRelatorio` inicia o processamento no endpoint específico.
2. `aguardarJobRelatorio` consulta `/api/consulta-relatorios` a cada 3 segundos.
3. A página interpreta `empty` ou `done` e mantém suas mensagens e transformação de dados.

O relatório de exames pendentes não usa job assíncrono e continua consumindo diretamente `/api/relatorio-exames`.

## Regras para manutenção

- Não duplicar polling ou normalização dentro das páginas.
- Manter consultas e segredos do n8n nas rotas server-side.
- Não alterar nomes ou parâmetros de RPC durante refatorações visuais.
- Regras de seleção, bloqueio e finalização pertencem ao fluxo onde são executadas.
- Tipos retornados pelo Supabase devem ser adicionados ao `types.ts` mais próximo.
- Funções puras de data, texto e tempo devem ficar em `utils.ts` ou `shared/`.
- Antes de concluir mudanças, executar `npx tsc --noEmit`, lint nos módulos novos e build de produção.
