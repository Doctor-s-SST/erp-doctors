# API do Sistema

## POST /api/relatorio

### Descrição

Retorna dados de atendimentos no período informado.

---

### Body

```json
{
  "dataInicio": "2025-01-01",
  "dataFim": "2025-01-31",
  "unidadeId": "1"
}
```

---

### Resposta

```json
[
  {
    "cabecalho": {
      "nome": "João",
      "senha": "N001",
      "acionamento": "01/01/2025 08:00:00"
    },
    "tempo_total_dispensado": "(1h 20m)"
  }
]
```

---

## Observações

* Datas devem estar no formato `YYYY-MM-DD`
* Retorno pode variar conforme filtros
* Endpoint depende de dados do Supabase

---

## Erros

* `400` → parâmetros inválidos
* `500` → erro interno

---
