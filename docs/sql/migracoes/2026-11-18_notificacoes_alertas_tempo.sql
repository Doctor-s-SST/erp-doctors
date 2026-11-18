-- Notificações e alertas de tempo (paciente parado e atendimento prolongado).
--
-- 1. unidades: liga/desliga os alertas e define os limites padrão.
-- 2. notificacoes: avisos por unidade (base do sino do cabeçalho; serve para outros
--    tipos no futuro). Uma linha por situação, garantida por (unidade_id, referencia).
-- 3. notificacoes_lidas: o que cada usuário já leu.
-- 4. gerar_alertas_tempo(unidade): confere as regras e grava os alertas que ainda
--    não existem. Chamada pelo navegador do admin a cada minuto; pode virar um
--    agendamento (pg_cron) depois, sem mudar as telas.
--
-- Regras (atendimentos do dia):
--   ATENDIMENTO_PROLONGADO  etapa EM_ATENDIMENTO (sem contador de finalização) há mais
--                           que meta + tolerância da especialidade; sem meta, o limite
--                           padrão da unidade.
--   RECEPCAO_PROLONGADA     atendimento EM_RECEPCAO há mais que meta + tolerância da
--                           recepção; sem meta, o limite padrão da unidade.
--   PACIENTE_PARADO         atendimento AGUARDANDO_RECEPCAO ou AGUARDANDO_EXAMES, sem
--                           etapa EM_FILA/EM_ATENDIMENTO, sem mudança de status há mais
--                           que o limite de espera da unidade.
--
-- Rodar no SQL Editor do Supabase. Não altera dados existentes.

BEGIN;

-- 1. Configuração na unidade --------------------------------------------------
ALTER TABLE public.unidades
    ADD COLUMN IF NOT EXISTS alertas_tempo_ativos boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS tempo_alerta_espera_minutos smallint NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS tempo_alerta_atendimento_minutos smallint NOT NULL DEFAULT 10;

ALTER TABLE public.unidades
    DROP CONSTRAINT IF EXISTS unidades_tempo_alerta_espera_minutos_check,
    DROP CONSTRAINT IF EXISTS unidades_tempo_alerta_atendimento_minutos_check;

ALTER TABLE public.unidades
    ADD CONSTRAINT unidades_tempo_alerta_espera_minutos_check CHECK (tempo_alerta_espera_minutos BETWEEN 1 AND 600),
    ADD CONSTRAINT unidades_tempo_alerta_atendimento_minutos_check CHECK (tempo_alerta_atendimento_minutos BETWEEN 1 AND 600);

COMMENT ON COLUMN public.unidades.alertas_tempo_ativos IS 'Liga ou desliga os alertas de paciente parado e atendimento prolongado.';
COMMENT ON COLUMN public.unidades.tempo_alerta_espera_minutos IS 'Minutos com o paciente parado (sem atendimento em lugar nenhum) até gerar alerta.';
COMMENT ON COLUMN public.unidades.tempo_alerta_atendimento_minutos IS 'Limite de atendimento prolongado (min) quando a especialidade ou a recepção não tem meta.';

-- 2. Notificações -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensagem text,
    atendimento_id uuid REFERENCES public.atendimentos(id) ON DELETE CASCADE,
    atendimento_exame_id uuid REFERENCES public.atendimento_exames(id) ON DELETE CASCADE,
    referencia text NOT NULL,
    dados jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notificacoes_unidade_referencia_key UNIQUE (unidade_id, referencia)
);

CREATE INDEX IF NOT EXISTS notificacoes_unidade_created_at_idx
    ON public.notificacoes (unidade_id, created_at DESC);

COMMENT ON TABLE public.notificacoes IS 'Avisos por unidade exibidos no sino do cabeçalho (alertas de tempo e outros no futuro).';
COMMENT ON COLUMN public.notificacoes.referencia IS 'Chave da situação que gerou o aviso; evita repetir o mesmo alerta.';

-- 3. Leitura por usuário --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes_lidas (
    notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lida_em timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (notificacao_id, usuario_id)
);

COMMENT ON TABLE public.notificacoes_lidas IS 'Notificações já lidas por cada usuário.';

-- RLS: leitura só da própria unidade; gravação de notificações só pela função.
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_lidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificacoes_leitura_unidade ON public.notificacoes;
CREATE POLICY notificacoes_leitura_unidade ON public.notificacoes
    FOR SELECT TO authenticated
    USING (unidade_id = public.get_my_unit());

DROP POLICY IF EXISTS notificacoes_lidas_proprias ON public.notificacoes_lidas;
CREATE POLICY notificacoes_lidas_proprias ON public.notificacoes_lidas
    FOR ALL TO authenticated
    USING (usuario_id = auth.uid())
    WITH CHECK (
        usuario_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.notificacoes n
            WHERE n.id = notificacao_id AND n.unidade_id = public.get_my_unit()
        )
    );

REVOKE ALL ON public.notificacoes FROM anon;
REVOKE ALL ON public.notificacoes_lidas FROM anon;
GRANT SELECT ON public.notificacoes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.notificacoes_lidas TO authenticated;

-- 4. Geração dos alertas ------------------------------------------------------
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
    INSERT INTO public.notificacoes (unidade_id, tipo, titulo, mensagem, atendimento_id, atendimento_exame_id, referencia, dados)
    SELECT
        a.unidade_id,
        'ATENDIMENTO_PROLONGADO',
        'Atendimento prolongado: ' || COALESCE(e.nome, ae.sala, 'especialidade'),
        format(
            'Senha %s (%s) está em atendimento há %s min na sala %s com %s. Limite: %s min.',
            a.senha_codigo,
            COALESCE(p.nome, 'paciente'),
            FLOOR(EXTRACT(EPOCH FROM (now() - ae.iniciado_em)) / 60)::int,
            COALESCE(NULLIF(TRIM(ae.num_sala), ''), '-'),
            COALESCE(NULLIF(TRIM(ae.profissional), ''), 'profissional não informado'),
            ROUND(lim.minutos, 1)
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

    -- Atendimento prolongado na recepção
    INSERT INTO public.notificacoes (unidade_id, tipo, titulo, mensagem, atendimento_id, referencia, dados)
    SELECT
        a.unidade_id,
        'RECEPCAO_PROLONGADA',
        'Atendimento prolongado: Recepção',
        format(
            'Senha %s (%s) está na recepção há %s min com %s%s. Limite: %s min.',
            a.senha_codigo,
            COALESCE(p.nome, 'paciente não identificado'),
            FLOOR(EXTRACT(EPOCH FROM (now() - r.desde)) / 60)::int,
            COALESCE(NULLIF(TRIM(a.atendente), ''), 'atendente não informado'),
            CASE WHEN NULLIF(TRIM(a.guiche), '') IS NOT NULL THEN ' no guichê ' || a.guiche ELSE '' END,
            ROUND(lim.minutos, 1)
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

    -- Paciente parado (sem atendimento em lugar nenhum)
    INSERT INTO public.notificacoes (unidade_id, tipo, titulo, mensagem, atendimento_id, referencia, dados)
    SELECT
        a.unidade_id,
        'PACIENTE_PARADO',
        'Paciente parado há ' || FLOOR(EXTRACT(EPOCH FROM (now() - s.desde)) / 60)::int || ' min',
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

    RETURN v_qtd;
END;
$$;

COMMENT ON FUNCTION public.gerar_alertas_tempo(uuid) IS 'Grava alertas de paciente parado e atendimento prolongado da unidade do usuário; devolve quantos foram criados.';

REVOKE ALL ON FUNCTION public.gerar_alertas_tempo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_alertas_tempo(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Reversão:
-- DROP FUNCTION IF EXISTS public.gerar_alertas_tempo(uuid);
-- DROP TABLE IF EXISTS public.notificacoes_lidas;
-- DROP TABLE IF EXISTS public.notificacoes;
-- ALTER TABLE public.unidades
--     DROP CONSTRAINT IF EXISTS unidades_tempo_alerta_atendimento_minutos_check,
--     DROP CONSTRAINT IF EXISTS unidades_tempo_alerta_espera_minutos_check,
--     DROP COLUMN IF EXISTS tempo_alerta_atendimento_minutos,
--     DROP COLUMN IF EXISTS tempo_alerta_espera_minutos,
--     DROP COLUMN IF EXISTS alertas_tempo_ativos;
