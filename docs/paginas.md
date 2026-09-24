# Mapa de páginas

## Acesso e tela cheia

| Rota | Uso |
|---|---|
| `/signin` | login |
| `/signup` | cadastro, quando habilitado |
| `/error-404` | erro 404 |
| `/painel-senhas` | exibição e anúncio das chamadas |

## Filas

| Rota | Perfis principais | Uso |
|---|---|---|
| `/sistema-filas/senhas-recepcao` | admin, recepcao, especialista, painel | importar ficha, criar atendimento e emitir senha |
| `/sistema-filas/filas` | admin, especialista, recepcao, painel | selecionar especialidade |
| `/sistema-filas/filas/[id]` | mesmos | chamar, iniciar, encaminhar e finalizar atendimento |
| `/sistema-filas/kanban` | admin | configurar exames e especialidades |

## Análise e relatórios

| Rota | Uso |
|---|---|
| `/dashboards/atendimento` | indicadores diários |
| `/sistema-filas/analise-dados/indicadores-mensais` | indicadores por período |
| `/sistema-filas/analise-dados/especialidades` | análise por especialidade; oculta no menu |
| `/sistema-filas/relatorios/geral` | relatório de atendimentos |
| `/sistema-filas/relatorios/exames-pendentes` | relatório de exames pendentes |

## ASO

| Rota | Perfis | Uso |
|---|---|---|
| `/aso/aso-pendente` | admin, operador, recepcao | sincronização, prazos e liberação |
| `/aso/assinatura-aso` | admin, operador, especialista | assinatura, pendências e envios |
| `/aso/prazo-exames` | admin, operador, recepcao | cadastro e importação de prazos |

## Configuração

| Rota | Perfis | Uso |
|---|---|---|
| `/configuracoes/grupos-especialidades` | admin, operador | grupos de especialidades |
| `/configuracoes/painel` | admin | áudio, andar e térreo |
| `/configuracoes/salas-profissionais` | admin | salas, profissionais e vínculos |
| `/configuracoes/unidade` | admin | dados e identidade da unidade |
| `/configuracoes/users` | admin | usuários, papéis e ativação |
| `/profile` | autenticado | perfil; oculto no menu |

`/` redireciona conforme o papel. Foram removidas as rotas demonstrativas herdadas do template, que não participavam do produto.
