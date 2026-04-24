CREATE OR REPLACE FUNCTION public.get_dashboard_completo(
  p_unidade_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH
  base_atendimentos AS (
    SELECT *
    FROM public.atendimentos
    WHERE unidade_id = p_unidade_id
      AND created_at::date BETWEEN p_data_inicio AND p_data_fim
  ),
  base_exames AS (
    SELECT
      ae.*,
      e.nome AS especialidade_nome,
      e.id AS especialidade_id,
      TRIM(COALESCE(ae.num_sala, '')) AS sala_num
    FROM public.atendimento_exames ae
    INNER JOIN public.atendimentos a ON ae.atendimento_id = a.id
    INNER JOIN public.exames ex ON ae.exame_id = ex.id
    INNER JOIN public.especialidades e ON ex.especialidade_id = e.id
    WHERE ae.unidade_id = p_unidade_id
      AND a.created_at::date BETWEEN p_data_inicio AND p_data_fim
  ),
  cards AS (
    SELECT json_build_object(
      'geradas', COUNT(*),
      'acumulado',
        COALESCE(COUNT(*) FILTER (
          WHERE status IN (
            'EM_RECEPCAO','FINALIZADO','EM_AUDIOMETRIA','EM_CLÍNICO',
            'EM_ECG_EEG_ESPIRO','EM_LABORATÓRIO','EM_TOXICOLÓGICO',
            'EM_TRIAGEM','AGUARDANDO_EXAMES'
          )
        ), 0)
        +
        COALESCE((
          SELECT COUNT(*)
          FROM base_exames
          WHERE status IN ('EM_ATENDIMENTO', 'FINALIZADO')
        ), 0),
      'em_atendimento', COUNT(*) FILTER (WHERE status::text LIKE 'EM_%'),
      'aguardando', COUNT(*) FILTER (
        WHERE status IN ('AGUARDANDO_RECEPCAO', 'AGUARDANDO_EXAMES')
      ),
      'finalizadas', COUNT(*) FILTER (WHERE status = 'FINALIZADO'),
      'cancelados', COUNT(*) FILTER (WHERE status IN ('CANCELADO', 'NAO_ATENDIDO'))
    ) AS data
    FROM base_atendimentos
  ),
  recepcao AS (
    SELECT COALESCE(json_agg(t ORDER BY t.nome), '[]'::json) AS data
    FROM (
      SELECT
        p.nome,
        COUNT(a.id) FILTER (WHERE a.status IN ('EM_RECEPCAO', 'FINALIZADO')) AS total,
        COUNT(a.id) FILTER (WHERE a.status = 'AGUARDANDO_RECEPCAO') AS aguardando,
        ROUND(
          AVG(a.tempo_espera_min) FILTER (
            WHERE a.status = 'FINALIZADO' AND a.tempo_espera_min IS NOT NULL
          )::numeric,
          1
        ) AS tempo_medio
      FROM public.profissionais p
      LEFT JOIN base_atendimentos a ON a.atendente = p.nome
      WHERE p.unidade_id = p_unidade_id
        AND p.recepcao = true
        AND p.ativo = true
      GROUP BY p.nome
    ) t
  ),
  janela_trabalho AS (
    SELECT (p_data_fim - p_data_inicio + 1) * 480 AS minutos_disponiveis
  ),
  exame_por_sala AS (
    SELECT
      be.especialidade_id,
      be.sala_num,
      COUNT(*) FILTER (WHERE be.status IN ('EM_ATENDIMENTO', 'FINALIZADO')) AS total,
      COUNT(*) FILTER (WHERE be.status = 'AGUARDANDO') AS aguardando,
      ROUND(
        AVG(EXTRACT(EPOCH FROM (be.finalizado_em - be.iniciado_em)) / 60.0) FILTER (
          WHERE be.status = 'FINALIZADO'
            AND be.finalizado_em IS NOT NULL
            AND be.iniciado_em IS NOT NULL
        )::numeric,
        1
      ) AS tempo_medio,
      GREATEST(
        0,
        ROUND(
          (
            (SELECT minutos_disponiveis FROM janela_trabalho)
            - COALESCE(
              SUM(EXTRACT(EPOCH FROM (be.finalizado_em - be.iniciado_em)) / 60.0) FILTER (
                WHERE be.status = 'FINALIZADO'
              ),
              0
            )
          )::numeric,
          1
        )
      ) AS ociosidade
    FROM base_exames be
    GROUP BY be.especialidade_id, be.sala_num
  ),
  especialidades AS (
    SELECT COALESCE(json_agg(esp_agg ORDER BY esp_agg.especialidade), '[]'::json) AS data
    FROM (
      SELECT
        e.nome AS especialidade,
        COALESCE(SUM(es.total), 0) AS total,
        ROUND(AVG(es.tempo_medio)::numeric, 1) AS media_min,
        COALESCE(SUM(es.aguardando), 0) AS aguardando,
        json_agg(
          json_build_object(
            'nome', COALESCE(NULLIF(es.sala_num, ''), s.numero, 'Rotativo'),
            'total', COALESCE(es.total, 0),
            'aguardando', COALESCE(es.aguardando, 0),
            'tempo_medio', COALESCE(es.tempo_medio, 0),
            'ociosidade', COALESCE(es.ociosidade, 0)
          )
          ORDER BY CASE
            WHEN COALESCE(NULLIF(es.sala_num, ''), s.numero) ~ '^[0-9]+$'
            THEN COALESCE(NULLIF(es.sala_num, ''), s.numero)::int
            ELSE 999
          END
        ) AS salas
      FROM public.especialidades e
      LEFT JOIN public.salas s
        ON s.especialidade_id = e.id
       AND s.unidade_id = p_unidade_id
       AND s.ativo = true
      LEFT JOIN exame_por_sala es
        ON es.especialidade_id = e.id
       AND (es.sala_num = TRIM(s.numero) OR s.numero IS NULL)
      WHERE e.unidade_id = p_unidade_id
      GROUP BY e.nome
    ) esp_agg
  ),
  salas_todas AS (
    SELECT COALESCE(json_agg(t ORDER BY t.especialidade, t.sala), '[]'::json) AS data
    FROM (
      SELECT
        s.numero AS sala,
        e.nome AS especialidade,
        COALESCE(es.total, 0) AS total
      FROM public.salas s
      INNER JOIN public.especialidades e ON e.id = s.especialidade_id
      LEFT JOIN exame_por_sala es
        ON es.especialidade_id = s.especialidade_id
       AND TRIM(es.sala_num) = TRIM(s.numero)
      WHERE s.unidade_id = p_unidade_id
        AND s.ativo = true
      ORDER BY e.nome, s.numero
    ) t
  ),
  atendimentos_com_paciente AS (
    SELECT
      a.id,
      COALESCE(NULLIF(TRIM(p.empresa_razao), ''), 'Sem empresa') AS empresa
    FROM base_atendimentos a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id
  ),
  top_empresas AS (
    SELECT COALESCE(json_agg(t ORDER BY t.total DESC), '[]'::json) AS data
    FROM (
      SELECT empresa, COUNT(*) AS total
      FROM atendimentos_com_paciente
      GROUP BY empresa
      ORDER BY total DESC
      LIMIT 10
    ) t
  ),
  atendimento_especialidades AS (
    SELECT
      a.id AS atendimento_id,
      COUNT(be.id) AS qtd_exames,
      BOOL_OR(
        NOT (
          COALESCE(be.especialidade_nome, '') ILIKE 'clini%'
          OR COALESCE(be.especialidade_nome, '') ILIKE 'triag%'
        )
      ) AS tem_complementar
    FROM base_atendimentos a
    LEFT JOIN base_exames be ON be.atendimento_id = a.id
    GROUP BY a.id
  ),
  tipo_atendimento AS (
    SELECT json_build_array(
      json_build_object(
        'tipo',
        'Clinico/Triagem',
        'total',
        COUNT(*) FILTER (WHERE ae.qtd_exames = 0 OR ae.tem_complementar = false)
      ),
      json_build_object(
        'tipo',
        'Complementar',
        'total',
        COUNT(*) FILTER (WHERE ae.tem_complementar = true)
      )
    ) AS data
    FROM atendimento_especialidades ae
  ),
  fluxo_hora AS (
    SELECT COALESCE(json_agg(t ORDER BY t.hora), '[]'::json) AS data
    FROM (
      SELECT EXTRACT(HOUR FROM created_at)::int AS hora, COUNT(*) AS total
      FROM base_atendimentos
      GROUP BY hora
    ) t
  ),
  heatmap_hora_dia AS (
    SELECT COALESCE(json_agg(t ORDER BY t.dia, t.hora), '[]'::json) AS data
    FROM (
      SELECT
        TO_CHAR(created_at::date, 'YYYY-MM-DD') AS dia,
        EXTRACT(HOUR FROM created_at)::int AS hora,
        COUNT(*) AS total
      FROM base_atendimentos
      GROUP BY created_at::date, EXTRACT(HOUR FROM created_at)::int
    ) t
  ),
  tempo_permanencia AS (
    SELECT json_build_object(
      'media_minutos', ROUND(AVG(duracao_min)::numeric, 1),
      'total_amostras', COUNT(*)
    ) AS data
    FROM (
      SELECT
        atendimento_id,
        EXTRACT(EPOCH FROM (
          MAX(data_hora) FILTER (WHERE status_novo = 'FINALIZADO')
          - MIN(COALESCE(acionamento, data_hora))
        )) / 60.0 AS duracao_min
      FROM public.log_status_atendimento
      WHERE unidade_id = p_unidade_id
        AND data_hora::date BETWEEN p_data_inicio AND p_data_fim
      GROUP BY atendimento_id
      HAVING COUNT(*) FILTER (WHERE status_novo = 'FINALIZADO') > 0
    ) sub
    WHERE duracao_min > 0 AND duracao_min < 600
  )
  SELECT json_build_object(
    'analytics', json_build_object(
      'cards', (SELECT data FROM cards),
      'series', json_build_object(
        'fluxoHora', (SELECT data FROM fluxo_hora),
        'heatmapHoraDia', (SELECT data FROM heatmap_hora_dia)
      ),
      'distribuicoes', json_build_object(
        'recepcao', (SELECT data FROM recepcao),
        'especialidades', (SELECT data FROM especialidades),
        'salasTodas', (SELECT data FROM salas_todas)
      ),
      'pacientes', json_build_object(
        'topEmpresas', (SELECT data FROM top_empresas),
        'tipoAtendimento', (SELECT data FROM tipo_atendimento)
      ),
      'tempos', json_build_object(
        'permanencia', (SELECT data FROM tempo_permanencia)
      )
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


/*
CREATE OR REPLACE FUNCTION get_dashboard_completo(
  p_unidade_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH

    /* ================================================================
       BASE: atendimentos do período
    ================================================================ */
    base_atendimentos AS (
        SELECT *
        FROM public.atendimentos
        WHERE unidade_id = p_unidade_id
          AND created_at::date BETWEEN p_data_inicio AND p_data_fim
    ),

    /* ================================================================
       BASE: exames do período (com nome da especialidade)
    ================================================================ */
    base_exames AS (
        SELECT
            ae.*,
            e.nome    AS especialidade_nome,
            e.id      AS especialidade_id,
            TRIM(COALESCE(ae.num_sala, '')) AS sala_num
        FROM public.atendimento_exames ae
        INNER JOIN public.atendimentos  a  ON ae.atendimento_id   = a.id
        INNER JOIN public.exames        ex ON ae.exame_id         = ex.id
        INNER JOIN public.especialidades e ON ex.especialidade_id = e.id
        WHERE ae.unidade_id = p_unidade_id
          -- filtra pelo dia em que o ATENDIMENTO pai foi criado:
          -- garante que exames AGUARDANDO (ainda sem updated_at) entrem no período correto
          AND a.created_at::date BETWEEN p_data_inicio AND p_data_fim
    ),

    /* ================================================================
       CARDS  –  contadores gerais de atendimentos
    ================================================================ */
    /* acumulado_recepcao: soma dos totais por atendente na recepção */
    acum_recepcao AS (
        SELECT COALESCE(SUM(
            CASE WHEN a.status IN (
                'EM_RECEPCAO','FINALIZADO','EM_AUDIOMETRIA','EM_CLÍNICO',
                'EM_ECG_EEG_ESPIRO','EM_LABORATÓRIO','EM_TOXICOLÓGICO',
                'EM_TRIAGEM','AGUARDANDO_EXAMES'
            ) THEN 1 ELSE 0 END
        ), 0) AS total
        FROM base_atendimentos a
    ),

    /* acumulado_exames: soma de todos os totais por sala (EM_ATENDIMENTO + FINALIZADO) */
    acum_exames AS (
        SELECT COALESCE(SUM(
            CASE WHEN status IN ('EM_ATENDIMENTO','FINALIZADO') THEN 1 ELSE 0 END
        ), 0) AS total
        FROM base_exames
    ),

    cards AS (
        SELECT json_build_object(
            -- senhas emitidas no período (independente do status atual)
            'geradas',            COUNT(*),

            -- acumulado real: recepção + todas as salas de exame
            -- ex: 1 paciente na recepção + 3 especialidades = 4 atendimentos
            'acumulado',          (SELECT total FROM acum_recepcao)
                                  + (SELECT total FROM acum_exames),

            -- em algum setor agora
            'em_atendimento',     COUNT(*) FILTER (WHERE status::text LIKE 'EM_%'),

            -- aguardando em alguma fila
            'aguardando',         COUNT(*) FILTER (
                                      WHERE status IN (
                                        'AGUARDANDO_RECEPCAO',
                                        'AGUARDANDO_EXAMES'
                                      )
                                  ),

            -- concluídos
            'finalizadas',        COUNT(*) FILTER (WHERE status = 'FINALIZADO'),

            -- cancelados / não atendidos (para taxa de evasão)
            'cancelados',         COUNT(*) FILTER (
                                      WHERE status IN ('CANCELADO', 'NAO_ATENDIDO')
                                  )
        ) AS data
        FROM base_atendimentos
    ),

    /* ================================================================
       RECEPÇÃO  –  pizza por atendente
         · total     = EM_RECEPCAO + FINALIZADO  (atendimentos trabalhados)
         · aguardando = AGUARDANDO_RECEPCAO       (fila atual)
         · tempo_medio = média dos atendimentos FINALIZADOS (em minutos)
    ================================================================ */
    recepcao AS (
        SELECT COALESCE(json_agg(t ORDER BY t.nome), '[]'::json) AS data
        FROM (
            SELECT
                p.nome,
                COUNT(a.id) FILTER (
                    WHERE a.status IN ('EM_RECEPCAO', 'FINALIZADO')
                )                                                           AS total,
                COUNT(a.id) FILTER (
                    WHERE a.status = 'AGUARDANDO_RECEPCAO'
                )                                                           AS aguardando,
                ROUND(
                    AVG(a.tempo_espera_min) FILTER (
                        WHERE a.status = 'FINALIZADO'
                          AND a.tempo_espera_min IS NOT NULL
                    )::numeric, 1
                )                                                           AS tempo_medio
            FROM public.profissionais p
            LEFT JOIN base_atendimentos a ON a.atendente = p.nome
            WHERE p.unidade_id = p_unidade_id
              AND p.recepcao   = true
              AND p.ativo      = true
            GROUP BY p.nome
            ORDER BY p.nome
        ) t
    ),

    /* ================================================================
       JANELA DE TRABALHO  –  480 min/dia (08:00–17:00 - 1h almoço)
         Multiplicamos pelo nº de dias úteis do período.
         Para simplificar usamos dias corridos; ajuste para dias úteis
         com uma tabela de feriados se necessário.
    ================================================================ */
    janela_trabalho AS (
        SELECT
            -- número de dias no período (inclusivo)
            (p_data_fim - p_data_inicio + 1)           AS dias,
            -- minutos de trabalho disponíveis por sala no período
            (p_data_fim - p_data_inicio + 1) * 480     AS minutos_disponiveis
    ),

    /* ================================================================
       ESPECIALIDADES DETALHADAS  –  por especialidade → por sala
         Cada sala expõe:
           · nome        = numero da sala
           · total       = EM_ATENDIMENTO + FINALIZADO
           · aguardando  = AGUARDANDO (status_exame)
           · tempo_medio = média (finalizado_em - iniciado_em) em minutos
           · ociosidade  = minutos_disponiveis - soma(tempo dos finalizados)
                           nunca negativo
    ================================================================ */
    exame_por_sala AS (
        SELECT
            be.especialidade_id,
            be.sala_num,
            COUNT(*) FILTER (WHERE be.status IN ('EM_ATENDIMENTO', 'FINALIZADO')) AS total,
            COUNT(*) FILTER (WHERE be.status = 'AGUARDANDO') AS aguardando,
            ROUND(AVG(EXTRACT(EPOCH FROM (be.finalizado_em - be.iniciado_em)) / 60.0) FILTER (WHERE be.status = 'FINALIZADO' AND be.finalizado_em IS NOT NULL AND be.iniciado_em IS NOT NULL)::numeric, 1) AS tempo_medio,
            GREATEST(0, ROUND(((SELECT minutos_disponiveis FROM janela_trabalho) - COALESCE(SUM(EXTRACT(EPOCH FROM (be.finalizado_em - be.iniciado_em)) / 60.0) FILTER (WHERE be.status = 'FINALIZADO'), 0))::numeric, 1)) AS ociosidade
        FROM base_exames be
        GROUP BY be.especialidade_id, be.sala_num
    ),

    /* ================================================================
       ESPECIALIDADES – CORREÇÃO PARA ESPECIALIDADES ROTATIVAS
    ================================================================ */
    especialidades AS (
        SELECT COALESCE(json_agg(esp_agg ORDER BY esp_agg.especialidade), '[]'::json) AS data
        FROM (
            SELECT
                e.nome AS especialidade,
                json_agg(
                    json_build_object(
                        'nome',        COALESCE(NULLIF(es.sala_num, ''), s.numero, 'Rotativo'),
                        'total',       COALESCE(es.total, 0),
                        'aguardando',  COALESCE(es.aguardando, 0),
                        'tempo_medio', COALESCE(es.tempo_medio, 0),
                        'ociosidade',  COALESCE(es.ociosidade, 0)
                    )
                    ORDER BY CASE WHEN COALESCE(NULLIF(es.sala_num, ''), s.numero) ~ '^[0-9]+$' THEN COALESCE(NULLIF(es.sala_num, ''), s.numero)::int ELSE 999 END
                ) AS salas
            FROM public.especialidades e
            -- LEFT JOIN garante que a especialidade apareça mesmo sem sala fixa
            LEFT JOIN public.salas s ON s.especialidade_id = e.id 
                AND s.unidade_id = p_unidade_id 
                AND s.ativo = true
            -- LEFT JOIN com os exames reais filtrando pelo par especialidade+sala
            LEFT JOIN exame_por_sala es ON es.especialidade_id = e.id 
                AND (es.sala_num = TRIM(s.numero) OR s.numero IS NULL)
            WHERE e.unidade_id = p_unidade_id
            GROUP BY e.nome
        ) esp_agg
    ),

    /* ================================================================
       FLUXO POR HORA  –  volume de atendimentos iniciados por hora
    ================================================================ */
    fluxo_hora AS (
        SELECT COALESCE(json_agg(t ORDER BY t.hora), '[]'::json) AS data
        FROM (
            SELECT
                EXTRACT(HOUR FROM created_at)::int AS hora,
                COUNT(*)                            AS total
            FROM base_atendimentos
            GROUP BY hora
        ) t
    ),

    /* ================================================================
       TEMPO DE PERMANÊNCIA  –  do acionamento da senha até FINALIZADO
         Usa log_status_atendimento para calcular exatamente como o n8n:
           inicio = data_hora do primeiro log (ou campo acionamento)
           fim    = data_hora do log com status_novo = 'FINALIZADO'
         Retorna a média em minutos dos atendimentos finalizados no período.
    ================================================================ */
    tempo_permanencia AS (
        SELECT json_build_object(
            'media_minutos', ROUND(AVG(duracao_min)::numeric, 1),
            'total_amostras', COUNT(*)
        ) AS data
        FROM (
            SELECT
                atendimento_id,
                -- inicio: campo acionamento se preenchido, senão primeiro log
                EXTRACT(EPOCH FROM (
                    MAX(data_hora) FILTER (WHERE status_novo = 'FINALIZADO')
                    - MIN(COALESCE(acionamento, data_hora))
                )) / 60.0 AS duracao_min
            FROM public.log_status_atendimento
            WHERE unidade_id = p_unidade_id
              AND data_hora::date BETWEEN p_data_inicio AND p_data_fim
            GROUP BY atendimento_id
            -- só conta atendimentos que chegaram a FINALIZADO
            HAVING COUNT(*) FILTER (WHERE status_novo = 'FINALIZADO') > 0
        ) sub
        WHERE duracao_min > 0
          AND duracao_min < 600  -- descarta outliers acima de 10h (dados sujos)
    )

    /* ================================================================
       RESULTADO FINAL
    ================================================================ */
    SELECT json_build_object(
        'cards',                  (SELECT data FROM cards),
        'recepcao',               (SELECT data FROM recepcao),
        'especialidadesDetalhado',(SELECT data FROM especialidades),
        'fluxoHora',              (SELECT data FROM fluxo_hora),
        'tempoPermanencia',       (SELECT data FROM tempo_permanencia)
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/