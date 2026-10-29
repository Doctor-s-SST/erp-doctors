# Mapa de páginas

Os perfis abaixo são os liberados pelo proxy de rotas (`ROUTE_PERMISSIONS` em `src/lib/proxy-supabase.ts`), que é o que de fato protege a página. Quando o menu (`AppSidebar.tsx`) mostra a opção para menos perfis, isso está indicado.

## Acesso e tela cheia

| Rota | Perfis | Uso |
|---|---|---|
| `/signin` | todos | login |
| `/signup` | todos | cadastro, quando habilitado |
| `/error-404` | todos | erro 404 |
| `/painel-senhas` | admin, painel | exibição e anúncio das chamadas |

## Filas

| Rota | Perfis | Uso |
|---|---|---|
| `/sistema-filas/senhas-recepcao` | admin, recepcao, especialista, painel | chamar senhas, importar ficha, conferir e encaminhar às especialidades |
| `/sistema-filas/filas` | admin, especialista, recepcao, painel | selecionar especialidade e identificar sala e profissional por uma hora |
| `/sistema-filas/filas/[id]` | admin, especialista, recepcao, painel | acompanhar a fila via SSE, chamar, conferir exames e finalizar a etapa |
| `/sistema-filas/kanban` | admin | configurar especialidades, exames, ordem e dependências |

## Análise e relatórios

| Rota | Perfis | Uso |
|---|---|---|
| `/dashboards/atendimento` | admin | indicadores do dia, período ou mês |
| `/sistema-filas/analise-dados/indicadores-mensais` | admin, especialista, recepcao, operador | indicadores por período |
| `/sistema-filas/analise-dados/especialidades` | admin, especialista, recepcao, operador | indicadores por especialidade; oculta no menu |
| `/sistema-filas/relatorios/geral` | admin, painel, recepcao, operador, especialista | relatório de atendimentos |
| `/sistema-filas/relatorios/exames-pendentes` | admin, painel, recepcao, operador, especialista | relatório de exames pendentes |

## ASO

| Rota | Perfis | Uso |
|---|---|---|
| `/aso/aso-pendente` | admin, operador, recepcao | sincronização, prazos e liberação |
| `/aso/assinatura-aso` | admin, operador, especialista, recepcao | assinatura, pendências e envios |
| `/aso/prazo-exames` | admin, operador, recepcao | cadastro e importação de prazos |

No módulo ASO, o especialista acessa apenas Assinatura e Envio. O proxy aplica todas as regras cujo prefixo casa com a rota: `/aso/` libera o módulo e as regras de `/aso/aso-pendente` e `/aso/prazo-exames` restringem essas duas telas.

## Configuração

| Rota | Perfis | Uso |
|---|---|---|
| `/configuracoes/grupos-especialidades` | admin, operador | grupos de especialidades |
| `/configuracoes/painel` | admin | voz do painel: andar e térreo |
| `/configuracoes/salas-profissionais` | admin | salas, profissionais e vínculos |
| `/configuracoes/unidade` | admin | dados e identidade da unidade |
| `/configuracoes/users` | admin | usuários, papéis e ativação |
| `/profile` | qualquer usuário logado | perfil; oculto no menu |

`/` redireciona conforme o perfil. As rotas demonstrativas herdadas do template foram removidas.

Proxy e menu estão alinhados em todas as rotas. Ao criar ou alterar uma página, mantenha os mesmos perfis nos dois lugares; rotas fora de `ROUTE_PERMISSIONS` ficam acessíveis a qualquer usuário logado.
