-- Vínculo entre atendimento e agendamento do SOC (fase 2 dos agendamentos).
-- Depende de 2026-11-27_agendamentos_soc.sql.
--
-- O agendamento do dia é ligado ao atendimento (agendamentos.atendimento_id)
-- automaticamente, procurando, nesta ordem de preferência:
--   1. mesmo sequencial da ficha;
--   2. mesmo CPF do paciente;
--   3. mesma empresa e código do funcionário.
-- Só agendamentos da mesma unidade e da data do atendimento (fuso de São Paulo),
-- e cada lado é ligado uma vez só.
--
-- Quando acontece:
--   - ao salvar a ficha (trigger em atendimentos: paciente_id ou ficha_sequencial);
--   - a cada sincronização do n8n (agendamento que chegou depois do paciente).
--
-- Rodar no SQL Editor do Supabase. No fim, liga os atendimentos de hoje.

BEGIN;

-- 1. Liga um atendimento ao agendamento correspondente ---------------------------
CREATE OR REPLACE FUNCTION public.vincular_agendamento_atendimento(p_atendimento_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_at public.atendimentos%ROWTYPE;
    v_pac public.pacientes%ROWTYPE;
    v_data date;
    v_seq text;
    v_cpf text;
    v_agendamento uuid;
BEGIN
    SELECT * INTO v_at FROM public.atendimentos WHERE id = p_atendimento_id;
    IF NOT FOUND OR v_at.unidade_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Já ligado: mantém.
    SELECT id INTO v_agendamento FROM public.agendamentos WHERE atendimento_id = p_atendimento_id LIMIT 1;
    IF v_agendamento IS NOT NULL THEN
        RETURN v_agendamento;
    END IF;

    IF v_at.paciente_id IS NOT NULL THEN
        SELECT * INTO v_pac FROM public.pacientes WHERE id = v_at.paciente_id;
    END IF;

    v_data := (COALESCE(v_at.created_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date;
    v_seq := NULLIF(trim(COALESCE(v_at.ficha_sequencial, '')), '');
    v_cpf := NULLIF(regexp_replace(COALESCE(v_pac.cpf, ''), '\D', '', 'g'), '');

    IF v_seq IS NULL AND v_cpf IS NULL AND v_pac.codigo_funcionario IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT a.id INTO v_agendamento
    FROM public.agendamentos a
    WHERE a.unidade_id = v_at.unidade_id
      AND a.data = v_data
      AND a.atendimento_id IS NULL
      AND (
          (v_seq IS NOT NULL AND a.sequencial_ficha = v_seq)
          OR (v_cpf IS NOT NULL AND a.cpf = v_cpf)
          OR (
              NULLIF(trim(COALESCE(v_pac.codigo_funcionario, '')), '') IS NOT NULL
              AND a.codigo_funcionario = trim(v_pac.codigo_funcionario)
              AND a.codigo_empresa = trim(COALESCE(v_pac.codigo_empresa, ''))
          )
      )
    ORDER BY
        COALESCE(v_seq IS NOT NULL AND a.sequencial_ficha = v_seq, false) DESC,
        COALESCE(v_cpf IS NOT NULL AND a.cpf = v_cpf, false) DESC,
        a.removido_soc_em NULLS FIRST,
        a.horario NULLS LAST
    LIMIT 1;

    IF v_agendamento IS NOT NULL THEN
        UPDATE public.agendamentos
        SET atendimento_id = p_atendimento_id,
            vinculado_em = now()
        WHERE id = v_agendamento;
    END IF;

    RETURN v_agendamento;
END;
$$;

COMMENT ON FUNCTION public.vincular_agendamento_atendimento(uuid) IS 'Liga o atendimento ao agendamento do SOC do mesmo dia (sequencial, CPF ou empresa + funcionário). Devolve o agendamento ligado.';

REVOKE ALL ON FUNCTION public.vincular_agendamento_atendimento(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_agendamento_atendimento(uuid) TO service_role;

-- 2. Liga os agendamentos pendentes de um período -----------------------------
CREATE OR REPLACE FUNCTION public.vincular_agendamentos_pendentes(p_unidade_id uuid, p_data_inicio date, p_data_fim date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_at record;
    v_qtd integer := 0;
BEGIN
    FOR v_at IN
        SELECT at.id
        FROM public.atendimentos at
        WHERE at.unidade_id = p_unidade_id
          AND (at.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_data_inicio AND p_data_fim
          AND NOT EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.atendimento_id = at.id)
        ORDER BY at.created_at
    LOOP
        IF public.vincular_agendamento_atendimento(v_at.id) IS NOT NULL THEN
            v_qtd := v_qtd + 1;
        END IF;
    END LOOP;
    RETURN v_qtd;
END;
$$;

COMMENT ON FUNCTION public.vincular_agendamentos_pendentes(uuid, date, date) IS 'Liga aos agendamentos os atendimentos do período ainda sem vínculo. Devolve quantos foram ligados.';

REVOKE ALL ON FUNCTION public.vincular_agendamentos_pendentes(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_agendamentos_pendentes(uuid, date, date) TO service_role;

-- 3. Ao salvar a ficha --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_vincular_agendamento_atendimento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
BEGIN
    -- Falha no vínculo nunca impede gravar a ficha.
    BEGIN
        PERFORM public.vincular_agendamento_atendimento(NEW.id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Vínculo com agendamento não feito (%): %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_vincular_agendamento_atendimento ON public.atendimentos;
CREATE TRIGGER tr_vincular_agendamento_atendimento
    AFTER INSERT OR UPDATE OF paciente_id, ficha_sequencial ON public.atendimentos
    FOR EACH ROW EXECUTE FUNCTION public.fn_vincular_agendamento_atendimento();

-- 4. A cada sincronização do n8n ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_processar_sincronizacao_agendamentos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_itens jsonb := NEW.itens;
    v_vinculados integer;
BEGIN
    -- O node do Supabase pode mandar a lista como texto JSON.
    IF v_itens IS NOT NULL AND jsonb_typeof(v_itens) = 'string' THEN
        v_itens := (v_itens #>> '{}')::jsonb;
    END IF;

    IF v_itens IS NULL OR jsonb_typeof(v_itens) <> 'array' OR NEW.data_inicio IS NULL OR NEW.data_fim IS NULL THEN
        NEW.situacao := COALESCE(NEW.situacao, 'falha_consulta');
    ELSE
        BEGIN
            NEW.quantidade := jsonb_array_length(v_itens);
            NEW.resultado := public.sincronizar_agendamentos(NEW.unidade_id, NEW.data_inicio, NEW.data_fim, v_itens);
            -- Agendamento que chegou depois do paciente: liga agora.
            v_vinculados := public.vincular_agendamentos_pendentes(NEW.unidade_id, NEW.data_inicio, NEW.data_fim);
            NEW.resultado := NEW.resultado || jsonb_build_object('vinculados', v_vinculados);
            NEW.situacao := 'ok';
        EXCEPTION WHEN OTHERS THEN
            NEW.situacao := 'erro';
            NEW.erro := SQLERRM;
        END;
    END IF;

    NEW.itens := NULL;

    -- Guarda 90 dias de histórico.
    DELETE FROM public.agendamentos_sincronizacoes
    WHERE unidade_id = NEW.unidade_id
      AND created_at < now() - interval '90 days';

    RETURN NEW;
END;
$$;

-- 5. Liga os atendimentos de hoje -------------------------------------------------
SELECT u.id, public.vincular_agendamentos_pendentes(
    u.id,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
) AS vinculados
FROM public.unidades u;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Reversão:
-- DROP TRIGGER IF EXISTS tr_vincular_agendamento_atendimento ON public.atendimentos;
-- DROP FUNCTION IF EXISTS public.fn_vincular_agendamento_atendimento();
-- DROP FUNCTION IF EXISTS public.vincular_agendamentos_pendentes(uuid, date, date);
-- DROP FUNCTION IF EXISTS public.vincular_agendamento_atendimento(uuid);
-- (e rodar de novo a fn_processar_sincronizacao_agendamentos de 2026-11-27_agendamentos_soc.sql)
