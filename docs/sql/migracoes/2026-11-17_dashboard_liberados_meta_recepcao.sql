-- Dashboard: "Liberados" nos cards das especialidades e meta de tempo da recepção.
--
-- 1. unidades.tempo_meta_recepcao_minutos / tolerancia_meta_recepcao_percentual
--    Meta e tolerância do farol da recepção na Gestão de Tempo (configuração da unidade).
--
-- 2. get_dashboard_completo(unidade, inicio, fim) — alterada no lugar.
--    Única mudança: em cada especialidade, "aguardando" passa a contar atendimentos
--    (não linhas de exame, e sem cancelados/não atendidos/finalizados) e ganha
--    "liberados". Efeito imediato também no front em produção: o número de
--    "Aguardando" dos cards pode diminuir; "liberados" é ignorado até o deploy.
--
-- Rodar no SQL Editor do Supabase. Não altera dados existentes.

BEGIN;

ALTER TABLE public.unidades
    ADD COLUMN IF NOT EXISTS tempo_meta_recepcao_minutos numeric(5,1),
    ADD COLUMN IF NOT EXISTS tolerancia_meta_recepcao_percentual smallint NOT NULL DEFAULT 20;

ALTER TABLE public.unidades
    DROP CONSTRAINT IF EXISTS unidades_tempo_meta_recepcao_minutos_check,
    DROP CONSTRAINT IF EXISTS unidades_tolerancia_meta_recepcao_percentual_check;

ALTER TABLE public.unidades
    ADD CONSTRAINT unidades_tempo_meta_recepcao_minutos_check CHECK (tempo_meta_recepcao_minutos IS NULL OR tempo_meta_recepcao_minutos > 0),
    ADD CONSTRAINT unidades_tolerancia_meta_recepcao_percentual_check CHECK (tolerancia_meta_recepcao_percentual BETWEEN 0 AND 500);

COMMENT ON COLUMN public.unidades.tempo_meta_recepcao_minutos IS 'Meta de tempo de atendimento da recepção (min) no farol da Gestão de Tempo; vazio = sem farol.';
COMMENT ON COLUMN public.unidades.tolerancia_meta_recepcao_percentual IS 'Percentual acima da meta da recepção que ainda é amarelo no farol.';

CREATE OR REPLACE FUNCTION public.get_dashboard_completo(p_unidade_id uuid, p_data_inicio date, p_data_fim date) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$declare result JSON;

begin
with
  base_atendimentos as (
    select
      *
    from
      public.atendimentos
    where
      unidade_id = p_unidade_id
      and created_at >= p_data_inicio
      and created_at < p_data_fim + INTERVAL '1 day'
  ),
  primeira_recepcao as (
    select
      atendimento_id,
      MIN(data_hora) as entrada_recepcao
    from
      public.log_status_atendimento
    where
      status_novo = 'EM_RECEPCAO'
    group by
      atendimento_id
  ),
  base_exames as (
    select
      ae.*,
      ae.status::text as status_text,
      ex.nome as exame_nome,
      e.nome as especialidade_nome,
      e.id as especialidade_id,
      e.tempo_finalizacao_segundos,
      TRIM(COALESCE(ae.num_sala, '')) as sala_num
    from
      public.atendimento_exames ae
      inner join base_atendimentos a on ae.atendimento_id = a.id
      inner join public.exames ex on ae.exame_id = ex.id
      inner join public.especialidades e on ex.especialidade_id = e.id
    where
      ae.unidade_id = p_unidade_id
  ),
  cards as (
    select
      json_build_object(
        'geradas',
        COUNT(*),
        'acumulado',
        COUNT(*) filter (
          where
            status = 'EM_RECEPCAO'
            or status = 'FINALIZADO'
            or status = 'AGUARDANDO_EXAMES'
            or status::text like 'EM %'
        ),
        'em_atendimento',
        COUNT(*) filter (
          where
            status = 'EM_RECEPCAO'
            or status::text like 'EM %'
        ),
        'aguardando',
        COUNT(*) filter (
          where
            status in ('AGUARDANDO_RECEPCAO', 'AGUARDANDO_EXAMES')
        ),
        'finalizadas',
        COUNT(*) filter (
          where
            status = 'FINALIZADO'
        ),
        'cancelados',
        COUNT(*) filter (
          where
            status in ('CANCELADO', 'NAO_ATENDIDO')
        )
      ) as data
    from
      base_atendimentos
  ),
  recepcao as (
    select
      COALESCE(
        json_agg(
          t
          order by
            t.nome
        ),
        '[]'::json
      ) as data
    from
      (
        select
          p.nome,
          -- total atendido pela recepcionista
          COUNT(a.id) filter (
            where
              a.atendente = p.nome
          ) as total,
          -- atualmente em atendimento
          COUNT(a.id) filter (
            where
              a.atendente = p.nome
              and a.status = 'EM_RECEPCAO'
          ) as em_atendimento,
          -- fila geral aguardando recepção
          (
            select
              COUNT(*)
            from
              base_atendimentos ba
            where
              ba.status = 'AGUARDANDO_RECEPCAO'
          ) as aguardando,
          -- tempo médio da recepcionista
          ROUND(
            AVG(
              EXTRACT(
                EPOCH
                from
                  (
                    a.finalizado_recepcao::timestamptz - lr.entrada_recepcao::timestamptz
                  )
              ) / 60.0
            ) filter (
              where
                a.atendente = p.nome
                and a.finalizado_recepcao is not null
                and lr.entrada_recepcao is not null
            )::numeric,
            1
          ) as tempo_medio
        from
          public.profissionais p
          left join base_atendimentos a on a.atendente = p.nome
          left join primeira_recepcao lr on lr.atendimento_id = a.id
        where
          p.unidade_id = p_unidade_id
          and p.recepcao = true
          and p.ativo = true
        group by
          p.nome
      ) t
  ),
  jornada_profissional as (
    select
        p.id,
        p.nome,

        case
            when current_date between p_data_inicio::date and p_data_fim::date then
                greatest(
                    0,
                    extract(
                        epoch from (
                            least(localtime, p.hora_fim::time)
                            - p.hora_inicio::time
                        )
                    ) / 60
                )

            else
                extract(
                    epoch from (
                        p.hora_fim::time - p.hora_inicio::time
                    )
                ) / 60
        end as minutos_referencia

    from profissionais p
    where
        p.unidade_id = p_unidade_id
        and p.ativo = true
),
  tempo_exames as (
    select
      be.*,
      GREATEST(
        (
          EXTRACT(
            EPOCH
            from
              (be.finalizado_em - be.iniciado_em)
          ) - COALESCE(be.tempo_finalizacao_segundos, 0)
        ) / 60.0,
        0
      ) as minutos_reais
    from
      base_exames be
  ),
  exame_por_sala as (
    select
      be.especialidade_id,
      be.sala_num,
      be.profissional,
      COUNT(*) filter (
        where
          be.status_text in ('EM_ATENDIMENTO', 'FINALIZADO')
      ) as total,
      ROUND(
        AVG(be.minutos_reais) filter (
          where
            be.status_text = 'FINALIZADO'
            and be.finalizado_em is not null
            and be.iniciado_em is not null
        )::numeric,
        1
      ) as tempo_medio,
      GREATEST(
        0,
        ROUND(
          (
            jp.minutos_referencia - COALESCE(
              SUM(
                case
                  when be.status_text = 'FINALIZADO' then be.minutos_reais
                  when be.status_text = 'EM_ATENDIMENTO' then EXTRACT(
                    EPOCH
                    from
                      (NOW() - be.iniciado_em)
                  ) / 60.0
                  else 0
                end
              ),
              0
            )
          )::numeric,
          1
        )
      ) as ociosidade
    from
      tempo_exames be
      left join public.salas s on TRIM(s.numero) = be.sala_num
      and s.unidade_id = p_unidade_id
      left join jornada_profissional jp on LOWER(TRIM(jp.nome)) = LOWER(TRIM(be.profissional))
    group by
      be.especialidade_id,
      be.sala_num,
      be.profissional,
      jp.minutos_referencia
  ),
  -- aguardando: atendimentos com etapa AGUARDANDO na especialidade, mesmo que
  --   o paciente esteja na recepção ou sendo atendido em outra especialidade.
  -- liberados: dos aguardando, os que podem ser chamados agora, pela mesma regra
  --   da fila (get_fila_especialidade_novo): já passaram pela recepção, não estão
  --   em atendimento/chamada em outra etapa e não têm dependência pendente.
  aguardando_por_especialidade as (
    select
      be.especialidade_id,
      COUNT(distinct be.atendimento_id) as aguardando,
      COUNT(distinct be.atendimento_id) filter (
        where
          (
            a.status = 'AGUARDANDO_EXAMES'
            or (
              a.status like 'EM %'
              and a.status not in ('EM_RECEPCAO', 'EM_FILA')
            )
          )
          and not exists (
            select
              1
            from
              public.atendimento_exames ae2
            where
              ae2.atendimento_id = be.atendimento_id
              and ae2.id <> be.id
              and ae2.status::text in ('EM_ATENDIMENTO', 'EM_FILA')
          )
          and not exists (
            select
              1
            from
              public.exames ex_atual
              join public.especialidade_dependencias ed on ed.especialidade_id = ex_atual.especialidade_id
              join public.atendimento_exames ae_dep on ae_dep.atendimento_id = be.atendimento_id
              join public.exames ex_dep on ex_dep.id = ae_dep.exame_id
            where
              ex_atual.id = be.exame_id
              and ex_dep.especialidade_id = ed.depende_de_especialidade_id
              and ae_dep.id <> be.id
              and ae_dep.status::text <> 'FINALIZADO'
          )
      ) as liberados
    from
      base_exames be
      inner join base_atendimentos a on a.id = be.atendimento_id
    where
      be.status_text = 'AGUARDANDO'
      and COALESCE(a.status, '') not in ('CANCELADO', 'NAO_ATENDIDO', 'FINALIZADO')
    group by
      be.especialidade_id
  ),
  especialidades as (
    select
      COALESCE(
        json_agg(
          esp_agg
          order by
            esp_agg.especialidade
        ),
        '[]'::json
      ) as data
    from
      (
        select
          e.nome as especialidade,
          COALESCE(SUM(es.total), 0) as total,
          ROUND(AVG(es.tempo_medio)::numeric, 1) as media_min,
          COALESCE(ap.aguardando, 0) as aguardando,
          COALESCE(ap.liberados, 0) as liberados,
          json_agg(
            json_build_object(
              'nome',
              COALESCE(NULLIF(es.sala_num, ''), s.numero, 'Rotativo'),
              'profissional',
              COALESCE(es.profissional, 'Não definido'),
              'total',
              COALESCE(es.total, 0),
              'aguardando',
              COALESCE(ap.aguardando, 0),
              'tempo_medio',
              COALESCE(es.tempo_medio, 0),
              'ociosidade',
              COALESCE(es.ociosidade, 0)
            )
            order by
              case
                when COALESCE(NULLIF(es.sala_num, ''), s.numero) ~ '^[0-9]+$' then COALESCE(NULLIF(es.sala_num, ''), s.numero)::int
                else 999
              end
          ) as salas
        from
          public.especialidades e
          left join aguardando_por_especialidade ap on ap.especialidade_id = e.id
          left join public.sala_especialidades se on se.especialidade_id = e.id
          left join public.salas s on s.id = se.sala_id
          and s.unidade_id = p_unidade_id
          and s.ativo = true
          left join exame_por_sala es on es.especialidade_id = e.id
          and es.sala_num = TRIM(COALESCE(s.numero, ''))
        where
          e.unidade_id = p_unidade_id
        group by
          e.id,
          e.nome,
          ap.aguardando,
          ap.liberados
      ) esp_agg
  ),
  salas_todas as (
    select
      COALESCE(
        json_agg(
          t
          order by
            t.especialidade,
            t.sala
        ),
        '[]'::json
      ) as data
    from
      (
        select
          s.numero as sala,
          e.nome as especialidade,
          COALESCE(es.total, 0) as total
        from
          public.salas s
          inner join public.especialidades e on e.id = s.especialidade_id
          left join exame_por_sala es on es.especialidade_id = s.especialidade_id
          and TRIM(es.sala_num) = TRIM(s.numero)
        where
          s.unidade_id = p_unidade_id
          and s.ativo = true
        order by
          e.nome,
          s.numero
      ) t
  ),
  atendimentos_com_paciente as (
    select
      a.id,
      COALESCE(NULLIF(TRIM(p.empresa_razao), ''), 'Sem empresa') as empresa
    from
      base_atendimentos a
      left join public.pacientes p on p.id = a.paciente_id
  ),
  top_empresas as (
    select
      COALESCE(
        json_agg(
          t
          order by
            t.total desc
        ),
        '[]'::json
      ) as data
    from
      (
        select
          empresa,
          COUNT(*) as total
        from
          atendimentos_com_paciente
        group by
          empresa
        order by
          total desc,
          empresa
        limit
          10
      ) t
  ),
  atendimento_especialidades as (
    select
      a.id as atendimento_id,
      COUNT(be.id) as qtd_exames,
      BOOL_OR(
        not (
          COALESCE(be.especialidade_nome, '') ilike 'clini%'
          or COALESCE(be.especialidade_nome, '') ilike 'triag%'
        )
      ) as tem_complementar
    from
      base_atendimentos a
      left join base_exames be on be.atendimento_id = a.id
    group by
      a.id
  ),
  tipo_atendimento as (
    select
      json_build_array(
        json_build_object(
          'tipo',
          'Clinico/Triagem',
          'total',
          COUNT(*) filter (
            where
              ae.qtd_exames = 0
              or ae.tem_complementar = false
          )
        ),
        json_build_object(
          'tipo',
          'Complementar',
          'total',
          COUNT(*) filter (
            where
              ae.tem_complementar = true
          )
        )
      ) as data
    from
      atendimento_especialidades ae
  ),
  fluxo_hora as (
    select
      COALESCE(
        json_agg(
          t
          order by
            t.hora
        ),
        '[]'::json
      ) as data
    from
      (
        select
          EXTRACT(
            hour
            from
              created_at
          )::int as hora,
          COUNT(*) as total
        from
          base_atendimentos
        group by
          hora
      ) t
  ),
  heatmap_hora_dia as (
    select
      COALESCE(
        json_agg(
          t
          order by
            t.dia,
            t.hora
        ),
        '[]'::json
      ) as data
    from
      (
        select
          TO_CHAR(created_at::date, 'YYYY-MM-DD') as dia,
          EXTRACT(
            hour
            from
              created_at
          )::int as hora,
          COUNT(*) as total
        from
          base_atendimentos
        group by
          created_at::date,
          EXTRACT(
            hour
            from
              created_at
          )::int
      ) t
  ),
  tempo_permanencia as (
    select
      json_build_object(
        'media_minutos',
        ROUND(
          AVG(
            EXTRACT(
              EPOCH
              from
                (x.finalizado_em - x.primeiro_evento)
            ) / 60.0
          )::numeric,
          1
        ),
        'total_amostras',
        COUNT(*)
      ) as data
    from
      (
        select
          a.id,
          a.finalizado_em,
          MIN(COALESCE(l.acionamento, l.data_hora)) as primeiro_evento
        from
          base_atendimentos a
          inner join public.log_status_atendimento l on l.atendimento_id = a.id
        where
          a.finalizado_em is not null
        group by
          a.id,
          a.finalizado_em
      ) x
    where
      EXTRACT(
        EPOCH
        from
          (x.finalizado_em - x.primeiro_evento)
      ) / 60.0 between 0 and 600
  )
select
  json_build_object(
    'analytics',
    json_build_object(
      'cards',
      (
        select
          data
        from
          cards
      ),
      'series',
      json_build_object(
        'fluxoHora',
        (
          select
            data
          from
            fluxo_hora
        ),
        'heatmapHoraDia',
        (
          select
            data
          from
            heatmap_hora_dia
        )
      ),
      'distribuicoes',
      json_build_object(
        'recepcao',
        (
          select
            data
          from
            recepcao
        ),
        'especialidades',
        (
          select
            data
          from
            especialidades
        ),
        'salasTodas',
        (
          select
            data
          from
            salas_todas
        )
      ),
      'pacientes',
      json_build_object(
        'topEmpresas',
        (
          select
            data
          from
            top_empresas
        ),
        'tipoAtendimento',
        (
          select
            data
          from
            tipo_atendimento
        )
      ),
      'tempos',
      json_build_object(
        'permanencia',
        (
          select
            data
          from
            tempo_permanencia
        )
      )
    )
  ) into result;

RETURN result;

end;$_$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Reversão: recriar a get_dashboard_completo com a versão anterior do bloco
-- aguardando_por_especialidade (COUNT(*) de exames AGUARDANDO, sem "liberados"),
-- que está no histórico do git em docs/sql/schema_public.sql, e:
-- ALTER TABLE public.unidades
--     DROP CONSTRAINT IF EXISTS unidades_tolerancia_meta_recepcao_percentual_check,
--     DROP CONSTRAINT IF EXISTS unidades_tempo_meta_recepcao_minutos_check,
--     DROP COLUMN IF EXISTS tolerancia_meta_recepcao_percentual,
--     DROP COLUMN IF EXISTS tempo_meta_recepcao_minutos;
