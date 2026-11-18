-- Especialidade vinculada: finalizada junto com outra especialidade.
--
-- Substitui a regra fixa do Toxicológico no código (botão "Realizado").
--
-- especialidades.finaliza_com_especialidade_id
--   Preenchida: a especialidade é "vinculada". Quando o atendimento tem a
--   especialidade indicada, a vinculada não é chamada na fila e é finalizada
--   automaticamente junto com ela. Quando o atendimento não tem a especialidade
--   indicada, a vinculada é chamada e finalizada normalmente na própria fila.
--
-- A finalização passa por EM_ATENDIMENTO e FINALIZADO em atendimento_exames, como
-- uma etapa normal; o trigger de log (tr_log_status_exames_mudanca) grava as duas
-- linhas em log_status_atendimento e a especialidade vinculada aparece na timeline
-- dos relatórios. Sala, profissional e horários são os da especialidade principal.
-- A Gestão de Tempo ignora essas etapas (o tempo já é da principal).
--
-- Rodar no SQL Editor do Supabase. Não altera dados existentes.

BEGIN;

ALTER TABLE public.especialidades
    ADD COLUMN IF NOT EXISTS finaliza_com_especialidade_id uuid;

ALTER TABLE public.especialidades
    DROP CONSTRAINT IF EXISTS especialidades_finaliza_com_especialidade_id_fkey,
    DROP CONSTRAINT IF EXISTS especialidades_finaliza_com_diferente_check;

ALTER TABLE public.especialidades
    ADD CONSTRAINT especialidades_finaliza_com_especialidade_id_fkey
        FOREIGN KEY (finaliza_com_especialidade_id) REFERENCES public.especialidades(id) ON DELETE SET NULL,
    ADD CONSTRAINT especialidades_finaliza_com_diferente_check
        CHECK (finaliza_com_especialidade_id IS NULL OR finaliza_com_especialidade_id <> id);

COMMENT ON COLUMN public.especialidades.finaliza_com_especialidade_id IS 'Especialidade vinculada: é finalizada junto com esta especialidade quando o atendimento a tiver; sem ela, é chamada normalmente.';

CREATE OR REPLACE FUNCTION public.fn_finalizar_especialidades_vinculadas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_especialidade_id uuid;
    v_ids uuid[];
BEGIN
    -- Evita cascata infinita entre vínculos.
    IF pg_trigger_depth() > 3 THEN
        RETURN NEW;
    END IF;

    -- Especialidade da etapa que acabou de ser finalizada.
    SELECT ex.especialidade_id INTO v_especialidade_id
    FROM public.exames ex
    WHERE ex.id = NEW.exame_id;

    -- Etapas pendentes das especialidades vinculadas a ela no mesmo atendimento.
    SELECT array_agg(ae.id) INTO v_ids
    FROM public.atendimento_exames ae
    JOIN public.exames ex ON ex.id = ae.exame_id
    JOIN public.especialidades esp ON esp.id = ex.especialidade_id
    WHERE ae.atendimento_id = NEW.atendimento_id
      AND ae.id <> NEW.id
      AND ae.status::text NOT IN ('FINALIZADO', 'CANCELADO', 'NAO_ATENDIDO')
      AND esp.finaliza_com_especialidade_id = v_especialidade_id;

    IF v_ids IS NULL THEN
        RETURN NEW;
    END IF;

    -- Duas mudanças, como uma etapa atendida normalmente: o trigger de log grava
    -- "EM <especialidade>" e depois "FINALIZADO", com os mesmos horários, sala e
    -- profissional da principal. Assim a etapa aparece na timeline dos relatórios.
    UPDATE public.atendimento_exames
    SET
        status = 'EM_ATENDIMENTO',
        iniciado_em = COALESCE(NEW.iniciado_em, NOW()),
        finaliza_em = NULL,
        num_sala = NEW.num_sala,
        profissional = NEW.profissional
    WHERE id = ANY (v_ids);

    UPDATE public.atendimento_exames
    SET
        status = 'FINALIZADO',
        finalizado_em = COALESCE(NEW.finalizado_em, NOW())
    WHERE id = ANY (v_ids);

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_finalizar_especialidades_vinculadas() IS 'Ao finalizar uma etapa, finaliza as etapas das especialidades vinculadas a ela no mesmo atendimento.';

DROP TRIGGER IF EXISTS tr_finalizar_especialidades_vinculadas ON public.atendimento_exames;
CREATE TRIGGER tr_finalizar_especialidades_vinculadas
    AFTER UPDATE OF status ON public.atendimento_exames
    FOR EACH ROW
    WHEN (NEW.status::text = 'FINALIZADO' AND OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.fn_finalizar_especialidades_vinculadas();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Reversão:
-- DROP TRIGGER IF EXISTS tr_finalizar_especialidades_vinculadas ON public.atendimento_exames;
-- DROP FUNCTION IF EXISTS public.fn_finalizar_especialidades_vinculadas();
-- ALTER TABLE public.especialidades
--     DROP CONSTRAINT IF EXISTS especialidades_finaliza_com_diferente_check,
--     DROP CONSTRAINT IF EXISTS especialidades_finaliza_com_especialidade_id_fkey,
--     DROP COLUMN IF EXISTS finaliza_com_especialidade_id;
