-- Especialidades: meta de tempo de atendimento e tolerância do farol.
--
-- tempo_meta_minutos            tempo esperado de um atendimento na especialidade (minutos).
--                               Vazio: a especialidade não tem farol na Gestão de Tempo.
-- tolerancia_meta_percentual    quanto acima da meta ainda é amarelo. Ex.: meta 10 min e 20%:
--                               verde até 10 min, amarelo até 12 min, vermelho acima.
--
-- Usadas pela aba Gestão de Tempo do dashboard. Editadas no Kanban (admin).
-- Rodar no SQL Editor do Supabase. Não altera dados existentes.

BEGIN;

ALTER TABLE public.especialidades
    ADD COLUMN IF NOT EXISTS tempo_meta_minutos numeric(5,1),
    ADD COLUMN IF NOT EXISTS tolerancia_meta_percentual smallint NOT NULL DEFAULT 20;

ALTER TABLE public.especialidades
    DROP CONSTRAINT IF EXISTS especialidades_tempo_meta_minutos_check,
    DROP CONSTRAINT IF EXISTS especialidades_tolerancia_meta_percentual_check;

ALTER TABLE public.especialidades
    ADD CONSTRAINT especialidades_tempo_meta_minutos_check CHECK (tempo_meta_minutos IS NULL OR tempo_meta_minutos > 0),
    ADD CONSTRAINT especialidades_tolerancia_meta_percentual_check CHECK (tolerancia_meta_percentual BETWEEN 0 AND 500);

COMMENT ON COLUMN public.especialidades.tempo_meta_minutos IS 'Meta de tempo de atendimento (min) usada no farol da Gestão de Tempo; vazio = sem farol.';
COMMENT ON COLUMN public.especialidades.tolerancia_meta_percentual IS 'Percentual acima da meta que ainda é amarelo no farol; acima disso é vermelho.';

COMMIT;

-- Reversão:
-- ALTER TABLE public.especialidades
--     DROP CONSTRAINT IF EXISTS especialidades_tolerancia_meta_percentual_check,
--     DROP CONSTRAINT IF EXISTS especialidades_tempo_meta_minutos_check,
--     DROP COLUMN IF EXISTS tolerancia_meta_percentual,
--     DROP COLUMN IF EXISTS tempo_meta_minutos;
