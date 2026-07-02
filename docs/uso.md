# Guia de Uso - Sistema de Filas

# Chamada de Senha - Recepção

## Identifição de atendente

* Acessar a fila de senhas da recepção
* Informar guichê e nome

## Gerar senha

1. Acessar sistema ou App Acionador (imprime senha)
3. Escolher tipo:

   * Normal
   * Preferencial


## Chamar paciente

* Selecionar senha
* Clicar em **Chamar Paciente** ou **Chamar Novamente**

## Não atendido

* Controle interno para identificação de senhas chamadas, mas sem sucesso de atendimento

## Preenchimento ou edição de ficha

* Possível importação via ASO em PDF ou Sequencial de ficha.
* Preenchimento manual
* Campos: Nome e data são obrigatório para concluir a ficha.
* Opção de senha encaixe: altera o tempo de finalização de 30 segundos para 30 minutos 
* Sempre verificar exames e especialdades
* Clicar em Salvar
* Abrirá automáticamente a opção de imprimir ou baixar essa ficha (após criação da ficha, é possível imprimir novamente).

## Cancelar senha

* Deixa senha indisponível e inutilizável para as especialidades
* Não é possível reverter a ação

## Finalizar

* Encerra o atendimento da recepção
* Especialidades destinadas enxergam senha disponíveis
* Caso a senha for encaixe, terá a opção **Forçar finalização**, quebrando os 30 minutos de espera.

## Mapeamento de status de senha

* Ao clicar no nome do paciente, abrirá um modal com informações básicas do paicente e as especialdidades destinadas, por qual está sendo atendido, qual já foi finalizada.
* Disponível apenas para senhas com fichas criadas

## Copiar dados rápidos

* Ao clicar no número do sequencial de ficha, copia para área de transferência.

---

# Filas

* Exibe filas de especialdades da clínica
* É necessário identificar a sala e profissional que irá atender

## Chamar paciente

* Selecionar senha
* Clicar em **Chamar Paciente** ou **Chamar Novamente**

## Não atendido

* Controle interno para identificação de senhas chamadas, mas sem sucesso de atendimento

## Finalizar

* Encerra o atendimento da especialidade.
* Especialidades destinadas enxergam senha disponíveis
* Caso a especialidade corrente for a última do paciente, haverá uma aviso **Última especialidade!**, para poder dispensar.
* Se o atendimento passar de 15 minutos, aparecerá um alerta para confirmar se o atendimento ainda está acontecendo.

## Mapeamento de status de senha

* Ao clicar no nome do paciente, abrirá um modal com informações básicas do paicente e as especialdidades destinadas, por qual está sendo atendido, qual já foi finalizada.

## Copiar dados rápidos

* Ao clicar no icone ao lado do nome do paciente, copia o nome da empresa para área de transferência.
* Ao clicar no número do sequencial de ficha, copia para área de transferência.

---

# Kanban

## Especialidades

* Criar ou editar especialidades
* Informar nome, tempo de finalização, bloqueio de finalização por confirmação de exames, dependências de outras especialidades
* Cada especialdadade é uma coluna

## Exames

* Criar ou editar exames
* Informar nome, a qual especialidade pertence e se é obrigado a marcar como concluido
* Cada exame é um card no kanban

---

# Painel TV

* Responsável pelas chamadas sonoras e visuais das senhas em fila
* É necessário um clique a cada refresh de página, para carregar o áudio no navegador

---

# Dashboard

* Exibe os dados de atendimentos em tempo real, em forma de gráficos.
* Possível alternar a data de exibição

---

# Relatórios

* Todos possuem filtros por data, nome, períodos, tipo de senha, grupos de filtros. Quando não selecionado, buscam as infromações sem filtros.
* Possível exportação por Excel e/ou PDF.

---

# Configurações

## Grupos de Especialidades

* Define uma ou mais especialidades para poder filtrar nos relatórios

## Definições do Painel

* Opções do painel de chamada

## Salas e profisionais

* Controle, criação, edição e inativação de salas e profissionais da clinica.
* Salas: define o andar (ou não) da sala e quais as especialidades atendidas
* Profissionais: define o profissinal, quais especialdades atende, jornada de trabalho (importante para dashboard)
 
## Unidade

* Cadastro de informações da clínico (logo, endereço e etc)

## Usuários

* Define os logins de cada sala/atendente
* Controle de permissões para cada usuário
* Admin: acesso a todas as telas
* Recepção: acesso a chamada de senhas da recepção, filas de especialidades e relatórios
* Especialistas: acesso a chamada de senhas da recepção, filas de especialidades e relatórios
* Operador: acesso aos relatórios
* Painel: acesso ao painel, chamada de senhas da recepção, filas de especialidades e relatórios

---

# Chat interno

* Permite comunicação de usuários logados
* Chat geral (todos os usuários conversam, grupo único)
* Chat da especialidade (quando logado em alguma fila, o chat cria um grupo apenas para aquela especialidade)

---

# Perfil

* Possível alteração de senha