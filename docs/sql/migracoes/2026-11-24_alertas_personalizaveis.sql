-- Alertas de tempo personalizáveis e limpeza de notificações.
--
-- 1. unidades: liga/desliga cada tipo de alerta (paciente parado, atendimento
--    prolongado na especialidade e na recepção). "alertas_tempo_ativos" continua
--    como chave geral.
-- 2. notificacoes_lidas.oculta: o usuário limpou a notificação do sino (só para ele).
--    O sino grava com upsert, por isso o UPDATE passa a ser permitido.
-- 3. gerar_alertas_tempo: mesma função de 2026-11-18, agora pulando os tipos
--    desligados na unidade.
--
-- Depende de 2026-11-18_notificacoes_alertas_tempo.sql. Rodar no SQL Editor do
-- Supabase. Não altera dados existentes.

BEGIN;

-- 1. Tipos de alerta na unidade -----------------------------------------------
ALTER TABLE public.unidades
    ADD COLUMN IF NOT EXISTS alerta_paciente_parado_ativo boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS alerta_atendimento_prolongado_ativo boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS alerta_recepcao_prolongada_ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.unidades.alerta_paciente_parado_ativo IS 'Gera e exibe o alerta de paciente parado.';
COMMENT ON COLUMN public.unidades.alerta_atendimento_prolongado_ativo IS 'Gera e exibe o alerta de atendimento prolongado na especialidade.';
COMMENT ON COLUMN public.unidades.alerta_recepcao_prolongada_ativo IS 'Gera e exibe o alerta de atendimento prolongado na recepção.';

-- 2. Limpeza por usuário ------------------------------------------------------
ALTER TABLE public.notificacoes_lidas
    ADD COLUMN IF NOT EXISTS oculta boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notificacoes_lidas.oculta IS 'O usuário limpou a notificação do sino.';

GRANT UPDATE ON public.notificacoes_lidas TO authenticated;

-- 3. Geração respeitando os tipos ligados -------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_alertas_tempo(p_unidade_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_unidade public.unidades%ROWTYPE;
    v_qtd integer := 0;
    v_parcial integer;
BEGIN
    -- Roda com o dono da função: só aceita a unidade do próprio usuário.
    IF p_unidade_id IS DISTINCT FROM public.get_my_unit() THEN
        RAISE EXCEPTION 'Unidade não permitida';
    END IF;

    SELECT * INTO v_unidade FROM public.unidades WHERE id = p_unidade_id;
    IF NOT FOUND OR NOT v_unidade.alertas_tempo_ativos THEN
        RETURN 0;
    END IF;

    -- Atendimento prolongado na especialidade
    IF v_unidade.alerta_atendimento_prolongado_ativo THEN
    INSERT INTO public.notificacoes (unidade_id, tipo, titulo, mensagem, atendimento_id, atendimento_exame_id, referencia, dados)
    SELECT
        a.unidade_id,
        'ATENDIMENTO_PROLONGADO',
        'Atendimento prolongado: ' || COALESCE(e.nome, ae.sala, 'especialidade'),
        format(
            'Senha %s (%s) está em atendimento há %s na sala %s com %s. Limite: %s.',
            a.senha_codigo,
            COALESCE(p.nome, 'paciente'),
            public.formatar_duracao_alerta(EXTRACT(EPOCH FROM (now() - ae.iniciado_em))),
            COALESCE(NULLIF(TRIM(ae.num_sala), ''), '-'),
            COALESCE(NULLIF(TRIM(ae.profissional), ''), 'profissional não informado'),
            public.formatar_duracao_alerta(lim.minutos * 60)
        ),
        a.id,
        ae.id,
        'ATENDIMENTO:' || ae.id || ':' || FLOOR(EXTRACT(EPOCH FROM ae.iniciado_em))::bigint,
        jsonb_build_object(
            'especialidade', COALESCE(e.nome, ae.sala),
            'sala', ae.num_sala,
            'profissional', ae.profissional,
            'senha', a.senha_codigo,
            'limite_minutos', ROUND(lim.minutos, 1),
            'desde', ae.iniciado_em
        )
    FROM public.atendimento_exames ae
    JOIN public.atendimentos a ON a.id = ae.atendimento_id
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id
    LEFT JOIN public.exames ex ON ex.id = ae.exame_id
    LEFT JOIN public.especialidades e ON e.id = ex.especialidade_id
    CROSS JOIN LATERAL (
        SELECT CASE
            WHEN e.tempo_meta_minutos IS NOT NULL
                THEN e.tempo_meta_minutos * (1 + COALESCE(e.tolerancia_meta_percentual, 20) / 100.0)
            ELSE v_unidade.tempo_alerta_atendimento_minutos::numeric
        END AS minutos
    ) lim
    WHERE a.unidade_id = p_unidade_id
      AND a.created_at::date = CURRENT_DATE
      AND ae.status::text = 'EM_ATENDIMENTO'
      AND ae.finaliza_em IS NULL
      AND ae.iniciado_em IS NOT NULL
      AND now() - ae.iniciado_em > make_interval(secs => (lim.minutos * 60)::double precision)
    ON CONFLICT (unidade_id, referencia) DO NOTHING;

    GET DIAGNOSTICS v_parcial = ROW_COUNT;
    v_qtd := v_qtd + v_parcial;
    END IF;

    -- Atendimento prolongado na recepção
    IF v_unidade.alerta_recepcao_prolongada_ativo THEN
    INSERT INTO public.notificacoes (unidade_id, tipo, titulo, mensagem, atendimento_id, referencia, dados)
    SELECT
        a.unidade_id,
        'RECEPCAO_PROLONGADA',
        'Atendimento prolongado: Recepção',
        format(
            'Senha %s (%s) está na recepção há %s com %s%s. Limite: %s.',
            a.senha_codigo,
            COALESCE(p.nome, 'paciente não identificado'),
            public.formatar_duracao_alerta(EXTRACT(EPOCH FROM (now() - r.desde))),
            COALESCE(NULLIF(TRIM(a.atendente), ''), 'atendente não informado'),
            CASE WHEN NULLIF(TRIM(a.guiche), '') IS NOT NULL THEN ' no guichê ' || a.guiche ELSE '' END,
            public.formatar_duracao_alerta(lim.minutos * 60)
        ),
        a.id,
        'RECEPCAO:' || a.id || ':' || FLOOR(EXTRACT(EPOCH FROM r.desde))::bigint,
        jsonb_build_object(
            'atendente', a.atendente,
            'guiche', a.guiche,
            'senha', a.senha_codigo,
            'limite_minutos', ROUND(lim.minutos, 1),
            'desde', r.desde
        )
    FROM public.atendimentos a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id
    CROSS JOIN LATERAL (
        SELECT MAX(l.data_hora) AS desde
        FROM public.log_status_atendimento l
        WHERE l.atendimento_id = a.id AND l.status_novo = 'EM_RECEPCAO'
    ) r
    CROSS JOIN LATERAL (
        SELECT CASE
            WHEN v_unidade.tempo_meta_recepcao_minutos IS NOT NULL
                THEN v_unidade.tempo_meta_recepcao_minutos * (1 + COALESCE(v_unidade.tolerancia_meta_recepcao_percentual, 20) / 100.0)
            ELSE v_unidade.tempo_alerta_atendimento_minutos::numeric
        END AS minutos
    ) lim
    WHERE a.unidade_id = p_unidade_id
      AND a.created_at::date = CURRENT_DATE
      AND a.status = 'EM_RECEPCAO'
      AND r.desde IS NOT NULL
      AND now() - r.desde > make_interval(secs => (lim.minutos * 60)::double precision)
    ON CONFLICT (unidade_id, referencia) DO NOTHING;

    GET DIAGNOSTICS v_parcial = ROW_COUNT;
    v_qtd := v_qtd + v_parcial;
    END IF;

    -- Paciente parado (sem atendimento em lugar nenhum)
    IF v_unidade.alerta_paciente_parado_ativo THEN
    INSERT INTO public.notificacoes (unidade_id, tipo, titulo, mensagem, atendimento_id, referencia, dados)
    SELECT
        a.unidade_id,
        'PACIENTE_PARADO',
        'Paciente parado há ' || public.formatar_duracao_alerta(EXTRACT(EPOCH FROM (now() - s.desde))),
        format(
            'Senha %s (%s) %s. Limite: %s min.',
            a.senha_codigo,
            COALESCE(p.nome, 'paciente não identificado'),
            CASE
                WHEN a.status = 'AGUARDANDO_RECEPCAO' THEN 'aguarda a recepção'
                ELSE 'aguarda a próxima especialidade' || COALESCE(' (' || pend.especialidades || ')', '')
            END,
            v_unidade.tempo_alerta_espera_minutos
        ),
        a.id,
        'ESPERA:' || a.id || ':' || FLOOR(EXTRACT(EPOCH FROM s.desde))::bigint,
        jsonb_build_object(
            'status', a.status,
            'senha', a.senha_codigo,
            'pendentes', pend.especialidades,
            'limite_minutos', v_unidade.tempo_alerta_espera_minutos,
            'desde', s.desde
        )
    FROM public.atendimentos a
    LEFT JOIN public.pacientes p ON p.id = a.paciente_id
    CROSS JOIN LATERAL (
        SELECT GREATEST(a.created_at, MAX(l.data_hora)) AS desde
        FROM public.log_status_atendimento l
        WHERE l.atendimento_id = a.id
    ) s
    LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT ae.sala, ', ') AS especialidades
        FROM public.atendimento_exames ae
        WHERE ae.atendimento_id = a.id AND ae.status::text = 'AGUARDANDO'
    ) pend ON true
    WHERE a.unidade_id = p_unidade_id
      AND a.created_at::date = CURRENT_DATE
      AND a.status IN ('AGUARDANDO_RECEPCAO', 'AGUARDANDO_EXAMES')
      AND NOT EXISTS (
          SELECT 1 FROM public.atendimento_exames ae2
          WHERE ae2.atendimento_id = a.id AND ae2.status::text IN ('EM_FILA', 'EM_ATENDIMENTO')
      )
      AND now() - s.desde > make_interval(mins => v_unidade.tempo_alerta_espera_minutos::integer)
    ON CONFLICT (unidade_id, referencia) DO NOTHING;

    GET DIAGNOSTICS v_parcial = ROW_COUNT;
    v_qtd := v_qtd + v_parcial;
    END IF;

    RETURN v_qtd;
END;
$$;

COMMENT ON FUNCTION public.gerar_alertas_tempo(uuid) IS 'Grava alertas de paciente parado e atendimento prolongado (tipos ligados na unidade) da unidade do usuário; devolve quantos foram criados.';

REVOKE ALL ON FUNCTION public.gerar_alertas_tempo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_alertas_tempo(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Reversão (rodar antes o CREATE OR REPLACE da função de 2026-11-18):
-- REVOKE UPDATE ON public.notificacoes_lidas FROM authenticated;
-- ALTER TABLE public.notificacoes_lidas DROP COLUMN IF EXISTS oculta;
-- ALTER TABLE public.unidades
--     DROP COLUMN IF EXISTS alerta_recepcao_prolongada_ativo,
--     DROP COLUMN IF EXISTS alerta_atendimento_prolongado_ativo,
--     DROP COLUMN IF EXISTS alerta_paciente_parado_ativo;
