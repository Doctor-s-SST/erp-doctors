-- Grupos de especialidades: exibição na fila, no dashboard e especialidade da fila.
--
-- exibir_fila             mostra o grupo no seletor de filtro da fila (padrão: sim, mantém o comportamento atual)
-- exibir_dashboard        mostra o grupo ao expandir o card da especialidade no dashboard (padrão: não)
-- especialidade_fila_id   especialidade cuja fila o grupo representa. Quando preenchida, o grupo
--                         aparece só na fila dessa especialidade e o card do dashboard usa os
--                         atendimentos dessa especialidade. Vazia: aparece em todas as filas das
--                         especialidades do grupo (comportamento atual) e não gera card.
--
-- Rodar no SQL Editor do Supabase. Não altera dados existentes.

BEGIN;

ALTER TABLE public.grupos_especialidades
    ADD COLUMN IF NOT EXISTS exibir_fila boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS exibir_dashboard boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS especialidade_fila_id uuid;

ALTER TABLE public.grupos_especialidades
    DROP CONSTRAINT IF EXISTS grupos_especialidades_especialidade_fila_id_fkey;

ALTER TABLE public.grupos_especialidades
    ADD CONSTRAINT grupos_especialidades_especialidade_fila_id_fkey
    FOREIGN KEY (especialidade_fila_id) REFERENCES public.especialidades(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.grupos_especialidades.exibir_fila IS 'Quando false, o grupo não aparece no seletor de filtro das filas.';
COMMENT ON COLUMN public.grupos_especialidades.exibir_dashboard IS 'Quando true (e com especialidade_fila_id), o grupo aparece ao expandir o card da especialidade no dashboard.';
COMMENT ON COLUMN public.grupos_especialidades.especialidade_fila_id IS 'Especialidade cuja fila o grupo representa; limita o grupo à fila dessa especialidade.';

COMMIT;

-- Reversão:
-- ALTER TABLE public.grupos_especialidades
--     DROP CONSTRAINT IF EXISTS grupos_especialidades_especialidade_fila_id_fkey,
--     DROP COLUMN IF EXISTS especialidade_fila_id,
--     DROP COLUMN IF EXISTS exibir_dashboard,
--     DROP COLUMN IF EXISTS exibir_fila;
