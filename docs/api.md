# APIs internas

A especificação completa, com campos, respostas e exemplos, está em `docs/api/openapi.json` e pode ser navegada em `docs/api/swagger.html`. Para incluir uma rota nova, siga [atualizacao-documentacao.md](atualizacao-documentacao.md).

## Segurança

As rotas usam `getAuthSession()`, que exige sessão, perfil ativo e unidade vinculada. Sempre use `auth.unidadeId`; nunca confie em uma unidade enviada pelo navegador.

Exceção: `POST /api/gerar-declaracao` **não valida sessão** e gera PDF com o timbrado da unidade para qualquer chamada. Inclua `getAuthSession()` nessa rota assim que possível.

As rotas chamam o n8n com o cabeçalho `x-api-key` (`N8N_API_KEY`). No n8n, o bloco **Valida Token** recusa chamadas sem a chave correta.

## Rotas

| Método e rota | Entrada | Resultado | Workflow n8n |
|---|---|---|---|
| `POST /api/importar-ficha-sequencial` | JSON `{ sequencial }` | dados da ficha (`dados_gerais`, `exames`) | `extracao_aso_sequencial` |
| `POST /api/importar-ficha` | form data `file` (PDF) | dados da ficha (`funcionario`, `empresa`, `exames`) | `extracao_aso_pdf` |
| `POST /api/relatorio` | form data `dataInicio`, `dataFim` | `jobId` | `relatorio_atendimento_geral_erp` |
| `POST /api/relatorio-exames` | form data `dataInicio`, `dataFim` | resultado direto (sem job) | `relatorio_exames_pendentes` |
| `POST /api/indicadores` | form data `dataInicio`, `dataFim` | `jobId` | `indicadores_mensais` |
| `POST /api/indicadores-especialidades` | form data `dataInicio`, `dataFim`, `especialidades` | `jobId` | indicadores por especialidade |
| `GET /api/consulta-relatorios?id=` | `jobId` | situação e resultado do job | `consultar_relatorio` |
| `GET /api/consulta-asos` | sessão | última sincronização de ASOs | `consulta_asos_ged` (ramo webhook) |
| `POST /api/enviar-asos-concluidos` | `{ selecionados, jobId }` | job concluído (200) ou em processamento (202) | `altera_socged_asos` |
| `POST /api/download-documento-ged` | `{ codigoGed, codigoEmpresa, codigoFuncionario }` | arquivo PDF | `download_ged` |
| `POST /api/gerar-declaracao` | `{ item, unidade }` | arquivo PDF | geração local (Puppeteer) |

Nas rotas de relatório e indicadores, a unidade é anexada pelo servidor a partir da sessão.

## Processamento assíncrono (jobs)

1. A rota de início devolve `{ status: "processing", jobId }`; o n8n grava o job no Redis.
2. A tela consulta `GET /api/consulta-relatorios?id={jobId}` a cada 3 segundos, por até 15 minutos.
3. O job termina com `status` igual a `done` (com `data`, `charts` ou `problematicos`), `empty` ou `error`.

A consulta preserva o status HTTP devolvido pelo n8n; a decisão final é tomada pela tela com base no `status` e no `jobId` do corpo.

## Ações de ASO

```json
{
  "selecionados": [{
    "paciente": {
      "nome_paciente": "Nome",
      "sequencial_ficha": "123",
      "codigo_empresa_soc": "456",
      "codigo_ged_soc": "789",
      "data_criacao_ged_soc": "24/09/2026",
      "unidade_id": "uuid"
    },
    "acao": "LIBERAR",
    "observacao": "ASO montado"
  }],
  "jobId": "job-gerado-pela-tela"
}
```

Ações aceitas: `CONCLUIDO`, `LIBERAR`, `LIBERAR-ENVIAR`, `ASSINADO`, `PENDENCIA`, `ENVIAR-PENDENCIA`, `ENVIADO`, `REENVIAR-ASO` e `REENVIAR-PENDENCIA`. Estados adicionais no banco: `ENVIADO_DIRETO` e `PENDENCIA_ENVIADA`.

Comportamento da rota:

- Se o gateway devolver 408, 502, 503 ou 504 antes do n8n responder, a rota devolve `202 { status: "processing", jobId }` e a tela segue consultando o job.
- Nenhum paciente é confirmado enquanto o job não chega a `done`. Em `done`, os itens fora de `problematicos` são considerados confirmados.
- Depois da resposta do n8n, a rota grava uma linha em `pacientes_assinatura_logs` por item (paciente, unidade, ação, observação, usuário e e-mail obtidos da sessão). Falha nessa gravação não transforma a resposta em erro, para evitar reenvio duplicado.

O script SQL de criação de `pacientes_assinatura_logs` não está versionado no repositório; a tabela já existe no banco.

## Erros

- `400`: entrada inválida;
- `401`: sem sessão;
- `403`: perfil inativo ou sem unidade;
- `502`: o n8n falhou ou não devolveu JSON válido;
- `500`: erro interno.

## Nova API

Valide a entrada, autentique antes de processar, imponha a unidade, mantenha segredos no servidor e limite logs sensíveis. Depois atualize esta tabela, o Swagger e o documento técnico (ver [atualizacao-documentacao.md](atualizacao-documentacao.md)).
