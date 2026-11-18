-- Contadores de finalização que sobrevivem a recarregar ou sair da tela.
--
-- 1. unidades.tempo_finalizacao_encaixe_minutos: contador da recepção para encaixe
--    (padrão 30 min), configurável em Configurações > Unidade > Atendimento.
-- 2. atendimentos.finaliza_recepcao_em: quando o contador da recepção termina.
--    Antes o contador da recepção só existia na memória da tela.
-- 3. finalizar_especialidade_novo: passa a ignorar etapa já finalizada. Evita que
--    uma segunda chamada (outra tela aberta, ou a função abaixo) devolva para
--    AGUARDANDO_EXAMES um paciente que já foi chamado em outra especialidade.
-- 4. processar_finalizacoes_vencidas(unidade): conclui as etapas com finaliza_em
--    vencido e as recepções com finaliza_recepcao_em vencido. Chamada a cada 15 s
--    por qualquer tela aberta do sistema (cabeçalho), pela fila e pela recepção.
--
-- Rodar no SQL Editor do Supabase. Não altera dados existentes.

BEGIN;

ALTER TABLE public.unidades
    ADD COLUMN IF NOT EXISTS tempo_finalizacao_encaixe_minutos smallint NOT NULL DEFAULT 30;

ALTER TABLE public.unidades
    DROP CONSTRAINT IF EXISTS unidades_tempo_finalizacao_encaixe_minutos_check;

ALTER TABLE public.unidades
    ADD CONSTRAINT unidades_tempo_finalizacao_encaixe_minutos_check
        CHECK (tempo_finalizacao_encaixe_minutos BETWEEN 1 AND 240);

COMMENT ON COLUMN public.unidades.tempo_finalizacao_encaixe_minutos IS 'Contador de finalização da recepção para atendimentos de encaixe (min).';

ALTER TABLE public.atendimentos
    ADD COLUMN IF NOT EXISTS finaliza_recepcao_em timestamp with time zone;

COMMENT ON COLUMN public.atendimentos.finaliza_recepcao_em IS 'Fim do contador de finalização da recepção; vazio quando não há contador ativo.';

CREATE OR REPLACE FUNCTION public.finalizar_especialidade_novo(p_atendimento_id uuid, p_atendimento_exame_id uuid, p_sala text, p_num_sala text) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
    v_restam_exames BOOLEAN;
BEGIN
    -- 1. Finaliza o exame específico (só se ainda não estiver finalizado)
    UPDATE public.atendimento_exames
    SET
        status = 'FINALIZADO',
        finalizado_em = NOW(),
        finaliza_em = NULL
    WHERE id = p_atendimento_exame_id
      AND status::text <> 'FINALIZADO';

    -- Já finalizada por outra chamada: não mexe no atendimento.
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- 2. Verifica se ainda existe algum exame que não foi finalizado nem cancelado
    SELECT EXISTS (
        SELECT 1
        FROM public.atendimento_exames
        WHERE atendimento_id = p_atendimento_id
          AND status NOT IN ('FINALIZADO', 'NAO_ATENDIDO')
    ) INTO v_restam_exames;

    -- 3. Atualiza o atendimento pai baseado no que resta
    IF v_restam_exames THEN
        UPDATE public.atendimentos
        SET
            status = 'AGUARDANDO_EXAMES',
            updated_at = NOW()
        WHERE id = p_atendimento_id;
    ELSE
        UPDATE public.atendimentos
        SET
            status = 'FINALIZADO',
            updated_at = NOW(),
            tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
        WHERE id = p_atendimento_id;
    END IF;
END;$$;

CREATE OR REPLACE FUNCTION public.processar_finalizacoes_vencidas(p_unidade_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_qtd integer := 0;
    r record;
BEGIN
    -- Roda com o dono da função: só aceita a unidade do próprio usuário.
    IF p_unidade_id IS DISTINCT FROM public.get_my_unit() THEN
        RAISE EXCEPTION 'Unidade não permitida';
    END IF;

    -- Etapas das especialidades com contador vencido.
    FOR r IN
        SELECT ae.id, ae.atendimento_id, ae.sala, ae.num_sala
        FROM public.atendimento_exames ae
        JOIN public.atendimentos a ON a.id = ae.atendimento_id
        WHERE a.unidade_id = p_unidade_id
          AND ae.finaliza_em IS NOT NULL
          AND ae.finaliza_em <= NOW()
          AND ae.status::text NOT IN ('FINALIZADO', 'CANCELADO', 'NAO_ATENDIDO')
    LOOP
        PERFORM public.finalizar_especialidade_novo(r.atendimento_id, r.id, r.sala, r.num_sala);
        v_qtd := v_qtd + 1;
    END LOOP;

    -- Recepções com contador vencido. O UPDATE com condição garante que só uma
    -- chamada conclua cada atendimento.
    FOR r IN
        UPDATE public.atendimentos
        SET finaliza_recepcao_em = NULL
        WHERE unidade_id = p_unidade_id
          AND status = 'EM_RECEPCAO'
          AND finaliza_recepcao_em IS NOT NULL
          AND finaliza_recepcao_em <= NOW()
        RETURNING id
    LOOP
        PERFORM public.finalizar_recepcao_novo(r.id, ARRAY[]::uuid[]);
        v_qtd := v_qtd + 1;
    END LOOP;

    -- Contadores que sobraram em atendimentos que já saíram da recepção.
    UPDATE public.atendimentos
    SET finaliza_recepcao_em = NULL
    WHERE unidade_id = p_unidade_id
      AND finaliza_recepcao_em IS NOT NULL
      AND status <> 'EM_RECEPCAO';

    RETURN v_qtd;
END;
$$;

COMMENT ON FUNCTION public.processar_finalizacoes_vencidas(uuid) IS 'Conclui os contadores de finalização vencidos (especialidades e recepção) da unidade do usuário; devolve quantos concluiu.';

REVOKE ALL ON FUNCTION public.processar_finalizacoes_vencidas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_finalizacoes_vencidas(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Reversão:
-- DROP FUNCTION IF EXISTS public.processar_finalizacoes_vencidas(uuid);
-- (finalizar_especialidade_novo: voltar à versão anterior, sem o "AND status <> 'FINALIZADO'" e o IF NOT FOUND)
-- ALTER TABLE public.atendimentos DROP COLUMN IF EXISTS finaliza_recepcao_em;
-- ALTER TABLE public.unidades
--     DROP CONSTRAINT IF EXISTS unidades_tempo_finalizacao_encaixe_minutos_check,
--     DROP COLUMN IF EXISTS tempo_finalizacao_encaixe_minutos;
