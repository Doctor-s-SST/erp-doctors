# Atualização da documentação técnica e do Swagger

Passo a passo para manter a documentação em dia quando o sistema Gestão de Fila Doctor's ganhar ou mudar rotas de API, workflows, telas ou tabelas.

## Arquivos envolvidos

| Arquivo | O que é |
|---|---|
| `docs/Documentacao_Tecnica_Gestao_de_Fila_Doctors.docx` | Documento técnico completo (Word) |
| `docs/api/openapi.json` | Especificação das APIs no padrão OpenAPI 3.0 (Swagger) |
| `docs/api/swagger.html` | Página do Swagger UI com a especificação embutida; abre direto no navegador |
| `docs/api.md` | Tabela resumida das rotas `/api` |

## Quando atualizar

| Mudança no sistema | Swagger | DOCX |
|---|---|---|
| Nova rota `/api` | Sim | Seções 3.4, 7.1 (se chamar o n8n) e 12.2 |
| Mudança no que uma rota recebe ou devolve | Sim | Seção 12.2, se mudar a descrição |
| Rota removida | Sim | Remover das seções 3.4, 7.1 e 12.2 |
| Novo workflow ou webhook do n8n | Sim, se for chamado pelo sistema | Seção 7 (tabela 7.1 e subseção nova) |
| Nova tela | Não | Seções 2.3, 5 e 11.1 |
| Nova tabela ou coluna no banco | Não | Seção 8 |
| Mudança de servidor ou segurança | Não | Seção 9 |

---

## 1. Swagger

### 1.1 Descrever a rota no `openapi.json`

1. Acesse <https://editor.swagger.io>.
2. Menu **File → Import file** e selecione `docs/api/openapi.json`.
3. Dentro de `"paths"`, adicione a rota nova. Use uma rota parecida como modelo ou os modelos abaixo.
4. O painel da direita mostra a página e os erros de validação. Só continue quando não houver erros.
5. Menu **File → Save as JSON** e substitua `docs/api/openapi.json` pelo arquivo salvo.

**Modelo: rota do sistema que exige login**

```json
"/api/nome-da-rota": {
  "post": {
    "tags": ["Relatórios e indicadores"],
    "summary": "Frase curta do que a rota faz",
    "description": "Explicação: o que faz, qual workflow do n8n chama (se chamar) e regras importantes.",
    "security": [{ "sessaoSupabase": [] }],
    "requestBody": {
      "required": true,
      "content": {
        "application/json": {
          "schema": {
            "type": "object",
            "required": ["campo1"],
            "properties": {
              "campo1": { "type": "string", "example": "valor de exemplo" },
              "campo2": { "type": "integer" }
            }
          }
        }
      }
    },
    "responses": {
      "200": { "description": "Sucesso." },
      "400": { "description": "Entrada inválida.", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Erro" } } } },
      "401": { "description": "Sem sessão válida.", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Erro" } } } },
      "403": { "description": "Usuário inativo ou sem unidade.", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Erro" } } } }
    }
  }
}
```

**Modelo: webhook do n8n**

```json
"/webhook/path-do-webhook": {
  "post": {
    "tags": ["Webhooks n8n (internos)"],
    "summary": "Workflow nome_do_workflow",
    "description": "O que o workflow faz.\n\nURL completa configurada no servidor em `NOME_DA_VARIAVEL_DE_AMBIENTE`. Host do n8n não publicado nesta especificação.",
    "servers": [{ "url": "https://{hostWebhookN8n}", "variables": { "hostWebhookN8n": { "default": "host-de-webhook-do-n8n" } } }],
    "security": [{ "chaveN8n": [] }],
    "responses": {
      "200": { "description": "Processado." },
      "401": { "description": "Chave x-api-key inválida." }
    }
  }
}
```

**Ajustes comuns**

| Situação | Como fazer |
|---|---|
| Rota `GET` | Troque `"post"` por `"get"` e use `"parameters"` em vez de `"requestBody"` |
| Parâmetro na URL (`?id=...`) | `"parameters": [{ "name": "id", "in": "query", "required": true, "schema": { "type": "string" } }]` |
| Envio de formulário ou arquivo | Troque `application/json` por `multipart/form-data`; arquivo usa `{ "type": "string", "format": "binary" }` |
| Resposta em PDF | `"content": { "application/pdf": { "schema": { "type": "string", "format": "binary" } } }` |
| Rota sem login | `"security": []` (evite: todas as rotas devem exigir sessão) |
| Rota com processamento assíncrono | Resposta `200` com `"schema": { "$ref": "#/components/schemas/JobIniciado" }` |
| Formato reaproveitado em várias rotas | Crie em `components → schemas` e use `"$ref": "#/components/schemas/NomeDoSchema"` |
| Grupo novo na página | Adicione em `"tags"` no topo do arquivo e use o mesmo nome na rota |

Nunca coloque no Swagger chaves, senhas, tokens ou o endereço real do n8n.

### 1.2 Atualizar a página `swagger.html`

A página tem a especificação colada dentro dela, numa única linha que começa com `spec:`.

1. Abra `docs/api/swagger.html` no VS Code.
2. Localize a linha que começa com `      spec: {`. É uma linha muito longa.
3. Substitua tudo entre `spec: ` e a vírgula do final dessa linha pelo conteúdo completo do `openapi.json` novo:

   ```text
         spec: { ...conteúdo inteiro do openapi.json... },
   ```

4. Salve.

Não remova a linha `<base href="https://erp.doctorspraiagrande.com.br/" />` no início do arquivo. Sem ela, as rotas ficam carregando sem parar quando a página é aberta como arquivo local.

### 1.3 Conferir

1. Abra `docs/api/swagger.html` no navegador (F5 se já estiver aberto).
2. Clique na rota nova: devem aparecer a descrição, o corpo da requisição, os exemplos e as respostas.
3. Pressione F12 e confira se a aba **Console** não mostra erros em vermelho.

---

## 2. Documento técnico (DOCX)

O documento é editado diretamente no Word.

### 2.1 Onde mexer em cada caso

**Nova rota `/api`**
1. **3.4 Rotas de servidor (API interna):** adicione uma linha na tabela (rota e função).
2. **7.1 Padrão de comunicação:** se a rota chamar o n8n, adicione uma linha na tabela "Rotas de API e workflows do n8n".
3. **12.2 Endpoints documentados:** adicione uma linha (método, rota, autenticação e descrição), igual ao que foi colocado no Swagger.
4. Se a rota fizer parte de uma tela, atualize o passo a passo da tela na seção 5.

**Novo workflow do n8n**
1. **7.1:** adicione o workflow em uma das tabelas: "Rotas de API e workflows" se for chamado pelo sistema, ou "Workflows agendados e auxiliares" se for agendado ou chamado por outro workflow.
2. Crie uma subseção nova na seção 7, copiando uma existente (por exemplo, a 7.11) e mantendo a mesma estrutura:
   - título no estilo **Título 2**, numerado na sequência (7.15, 7.16...);
   - parágrafo de resumo;
   - tabela Item/Descrição (nome no n8n, acionamento, rota, variável do webhook, tela, entrada, saída e link do workflow);
   - **Etapas do workflow** em lista numerada, citando os nodes em negrito;
   - **Print do workflow:** em **Inserir → Imagens**, com a legenda "Figura N – Workflow n8n – Nome" abaixo.
3. **Seção 10.2:** quando houver números de execução, inclua o workflow na tabela.

**Nova tela**
1. **2.3 Mapa de telas e permissões:** tela, rota e perfis.
2. **Seção 5:** nova subseção no padrão das demais (tabela Rota/Perfis/Objetivo, "Como a tela funciona", regras e fluxograma).
3. **11.1 Requisitos funcionais:** novo RF com a referência da seção.

**Nova tabela ou coluna no banco**
1. **8.3 Dicionário de dados:** tabela nova ou linha nova na tabela existente.
2. **8.2 Diagramas ER:** se houver relacionamento novo, atualize ou anote abaixo do diagrama.
3. **8.5 RLS:** inclua a tabela, indicando se o RLS está ativo e quantas políticas tem.

**Nova regra de negócio ou requisito**
- **Seção 11:** acrescente RF, RNF ou RN com o próximo número disponível e a seção de referência.

### 2.2 Numeração de figuras e tabelas

As legendas ("Figura N – ..." e "Tabela N – ...") são texto comum. Ao inserir uma figura ou tabela no meio do documento:
1. Dê à nova o número seguinte ao da anterior.
2. Use **Ctrl+L** (Localizar) com "Figura " ou "Tabela " para renumerar as seguintes.

Ao incluir no final de uma seção, basta continuar a sequência.

### 2.3 Fechamento

1. **Capa:** aumente a versão (ex.: 2.5 → 2.6) e atualize a data.
2. **Sumário:** clique com o botão direito sobre ele → **Atualizar campo** → **Atualizar o índice inteiro**.
3. Salve e, se for enviar, gere o PDF em **Arquivo → Exportar → Criar PDF**.
4. Envie junto `docs/api/swagger.html` e `docs/api/openapi.json` quando o Swagger tiver mudado.

---

## 3. Checklist de nova rota

- [ ] `openapi.json` atualizado e sem erros no Swagger Editor
- [ ] `swagger.html` com a linha `spec:` substituída e testada no navegador
- [ ] `docs/api.md` com a rota na tabela
- [ ] DOCX: seções 3.4, 12.2 e, se chamar o n8n, 7.1 e 7.x
- [ ] DOCX: versão e data da capa atualizadas e sumário atualizado
- [ ] Nenhuma chave, senha ou endereço interno incluído
