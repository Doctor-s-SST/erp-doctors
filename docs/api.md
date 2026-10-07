# APIs internas

## Segurança

Os handlers operacionais usam `getAuthSession()`: exigem sessão, perfil ativo e unidade. Sempre use `auth.unidadeId`, nunca confie em uma unidade recebida do navegador.

| Método e rota | Entrada | Resultado | Serviço |
|---|---|---|---|
| `POST /api/importar-ficha` | form data `file` | ficha importada | n8n/SOC |
| `POST /api/importar-ficha-sequencial` | JSON com sequencial | ficha localizada | n8n/SOC |
| `POST /api/relatorio` | datas e filtros | `jobId` | relatório geral |
| `POST /api/relatorio-exames` | datas e filtros | relatório de pendências | n8n |
| `POST /api/indicadores` | datas | `jobId` | indicadores |
| `POST /api/indicadores-especialidades` | datas e especialidades | `jobId` | indicadores |
| `GET /api/consulta-relatorios?id=...` | `jobId` | estado/resultado | n8n |
| `GET /api/consulta-asos` | sessão | última sincronização da unidade | n8n |
| `POST /api/enviar-asos-concluidos` | payload de ações | encaminha ações | n8n |
| `POST /api/download-documento-ged` | códigos GED/arquivo | arquivo binário | GED/n8n |
| `POST /api/gerar-declaracao` | dados da declaração | PDF | geração local |

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
  }]
}
```

Ações externas: `CONCLUIDO`, `LIBERAR`, `LIBERAR-ENVIAR`, `ASSINADO`, `PENDENCIA`, `ENVIAR-PENDENCIA`, `ENVIADO`, `REENVIAR-ASO` e `REENVIAR-PENDENCIA`. Estados adicionais no banco: `ENVIADO_DIRETO` e `PENDENCIA_ENVIADA`.

Depois que o n8n confirma uma ação, `POST /api/enviar-asos-concluidos` grava uma linha em `pacientes_assinatura_logs` para cada item, contendo paciente, unidade, ação, observação, usuário autenticado, e-mail e horário. A unidade e o usuário são obtidos da sessão validada no servidor, não do corpo enviado pelo navegador. Antes do deploy desse recurso, execute `docs/sql/pacientes-assinatura-logs.sql`.

## Erros

- `400`: entrada inválida;
- `401`: sem sessão;
- `403`: perfil inativo/sem unidade;
- `502`: serviço externo falhou;
- `500`: erro interno.

## Nova API

Valide entrada, autentique antes de processar, imponha a unidade, mantenha segredos no servidor, limite logs sensíveis e atualize este documento.
