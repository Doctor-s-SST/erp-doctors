-- Agendamentos do SOC (fase 1 da integração de agendamentos).
-- Depende de 2026-11-27_integracoes_soc.sql (código do usuário Agenda e chaves
-- dos Exporta Dados ficam em integracao_soc / integracao_soc_exporta_dados).
--
-- 1. agendamentos: lista de agendados por dia. Uma linha por (unidade, data,
--    empresa, funcionário). Guarda só o necessário para a fila e os indicadores
--    (sem e-mail, telefone ou endereço).
-- 2. sincronizar_agendamentos(...): grava os agendados de um período (upsert).
-- 3. agendamentos_sincronizacoes: log de cada execução do fluxo n8n
--    "sincronizar_agendamentos_soc". O n8n insere uma linha por unidade com o node
--    do Supabase; o trigger chama sincronizar_agendamentos, grava o resultado e
--    descarta a lista recebida (não duplica dados pessoais).
--
-- Fontes no SOC (ver docs/agendamentos.md):
--   ED1 Agendados por usuário Agenda  -> lista do dia (sem hora)
--   ED2 Agendamentos do funcionário   -> horário e código do agendamento
--                                        (só traz agendamentos FUTUROS: por isso
--                                        a sincronização roda no dia anterior)
--   ED Pedido de Exame                -> sequencial da ficha
--
-- O vínculo com o atendimento (atendimento_id) e a ordem das filas pelo horário
-- vêm nas próximas fases. Rodar no SQL Editor do Supabase. Não altera dados
-- existentes.

BEGIN;

-- 1. Agendamentos ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
    data date NOT NULL,
    horario time without time zone,
    codigo_agendamento text,
    codigo_usuario_agenda text,
    codigo_empresa text NOT NULL,
    nome_empresa text,
    codigo_funcionario text NOT NULL,
    nome text,
    cpf text,
    tipo_compromisso smallint,
    sequencial_ficha text,
    atendido_soc boolean,
    atendimento_id uuid REFERENCES public.atendimentos(id) ON DELETE SET NULL,
    vinculado_em timestamp with time zone,
    removido_soc_em timestamp with time zone,
    primeira_sincronizacao_em timestamp with time zone DEFAULT now() NOT NULL,
    sincronizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agendamentos_unidade_data_funcionario_key UNIQUE (unidade_id, data, codigo_empresa, codigo_funcionario)
);

CREATE INDEX IF NOT EXISTS agendamentos_unidade_data_idx ON public.agendamentos (unidade_id, data);
CREATE INDEX IF NOT EXISTS agendamentos_unidade_cpf_idx ON public.agendamentos (unidade_id, cpf);
CREATE INDEX IF NOT EXISTS agendamentos_atendimento_idx ON public.agendamentos (atendimento_id);

COMMENT ON TABLE public.agendamentos IS 'Agendados do SOC por dia (sincronizados pelo n8n). Base da lista de agendados, da ordem das filas e dos indicadores de comparecimento e encaixe.';
COMMENT ON COLUMN public.agendamentos.horario IS 'Horário agendado (ED2). Nulo quando o agendamento foi feito no próprio dia (o ED2 só traz agendamentos futuros).';
COMMENT ON COLUMN public.agendamentos.cpf IS 'CPF só com dígitos; usado para ligar o agendamento ao atendimento.';
COMMENT ON COLUMN public.agendamentos.tipo_compromisso IS 'TIPOCOMPROMISSO do SOC: 1 Periódico, 2 Admissional, 3 Retorno ao Trabalho, 4 Mudança de Função, 5 Demissional, 6 Monitoramento Pontual, 10 Consulta, 12 Acidente, 13 Licença Médica, 14 Enfermagem, 20 Terceiros, 30 Consulta Assistencial, 50 Odontológica, >900 Ficha Personalizada.';
COMMENT ON COLUMN public.agendamentos.atendimento_id IS 'Atendimento do sistema ligado a este agendamento (preenchido na recepção, fase 2).';
COMMENT ON COLUMN public.agendamentos.removido_soc_em IS 'O agendamento deixou de vir do SOC (cancelado ou remarcado). Nulo enquanto continuar na agenda.';
COMMENT ON COLUMN public.agendamentos.primeira_sincronizacao_em IS 'Quando o agendamento apareceu pela primeira vez (antecedência do agendamento nos indicadores).';

-- RLS: leitura da própria unidade; gravação só pela função (n8n).
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agendamentos_leitura_unidade ON public.agendamentos;
CREATE POLICY agendamentos_leitura_unidade ON public.agendamentos
    FOR SELECT TO authenticated
    USING (unidade_id = public.get_my_unit());

REVOKE ALL ON public.agendamentos FROM anon;
GRANT SELECT ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;

-- 2. Sincronização ------------------------------------------------------------
-- p_itens: [{ data, horario, codigo_agendamento, codigo_usuario_agenda,
--   codigo_empresa, nome_empresa, codigo_funcionario, nome, cpf,
--   tipo_compromisso, sequencial_ficha, atendido_soc }]
-- Horário, código do agendamento e sequencial já conhecidos não são apagados
-- quando vêm vazios (o ED2 deixa de trazer o agendamento no próprio dia).
-- Agendamento do período que não veio mais e ainda não foi atendido recebe
-- removido_soc_em; se voltar, o campo é limpo.
CREATE OR REPLACE FUNCTION public.sincronizar_agendamentos(
    p_unidade_id uuid,
    p_data_inicio date,
    p_data_fim date,
    p_itens jsonb
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_gravados integer := 0;
    v_removidos integer := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade_id) THEN
        RAISE EXCEPTION 'Unidade não encontrada';
    END IF;
    IF p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_fim < p_data_inicio THEN
        RAISE EXCEPTION 'Período inválido';
    END IF;

    WITH itens AS (
        SELECT DISTINCT ON (x.data, x.codigo_empresa, x.codigo_funcionario)
            x.data,
            x.horario,
            NULLIF(TRIM(x.codigo_agendamento), '') AS codigo_agendamento,
            NULLIF(TRIM(x.codigo_usuario_agenda), '') AS codigo_usuario_agenda,
            TRIM(x.codigo_empresa) AS codigo_empresa,
            NULLIF(TRIM(x.nome_empresa), '') AS nome_empresa,
            TRIM(x.codigo_funcionario) AS codigo_funcionario,
            NULLIF(TRIM(x.nome), '') AS nome,
            NULLIF(regexp_replace(COALESCE(x.cpf, ''), '\D', '', 'g'), '') AS cpf,
            x.tipo_compromisso,
            NULLIF(TRIM(x.sequencial_ficha), '') AS sequencial_ficha,
            x.atendido_soc
        FROM jsonb_to_recordset(COALESCE(p_itens, '[]'::jsonb)) AS x(
            data date,
            horario time,
            codigo_agendamento text,
            codigo_usuario_agenda text,
            codigo_empresa text,
            nome_empresa text,
            codigo_funcionario text,
            nome text,
            cpf text,
            tipo_compromisso smallint,
            sequencial_ficha text,
            atendido_soc boolean
        )
        WHERE x.data BETWEEN p_data_inicio AND p_data_fim
          AND NULLIF(TRIM(x.codigo_empresa), '') IS NOT NULL
          AND NULLIF(TRIM(x.codigo_funcionario), '') IS NOT NULL
        ORDER BY x.data, x.codigo_empresa, x.codigo_funcionario, x.horario NULLS LAST
    ),
    gravados AS (
        INSERT INTO public.agendamentos AS a (
            unidade_id, data, horario, codigo_agendamento, codigo_usuario_agenda,
            codigo_empresa, nome_empresa, codigo_funcionario, nome, cpf,
            tipo_compromisso, sequencial_ficha, atendido_soc
        )
        SELECT
            p_unidade_id, i.data, i.horario, i.codigo_agendamento, i.codigo_usuario_agenda,
            i.codigo_empresa, i.nome_empresa, i.codigo_funcionario, i.nome, i.cpf,
            i.tipo_compromisso, i.sequencial_ficha, i.atendido_soc
        FROM itens i
        ON CONFLICT (unidade_id, data, codigo_empresa, codigo_funcionario) DO UPDATE SET
            horario = COALESCE(EXCLUDED.horario, a.horario),
            codigo_agendamento = COALESCE(EXCLUDED.codigo_agendamento, a.codigo_agendamento),
            codigo_usuario_agenda = COALESCE(EXCLUDED.codigo_usuario_agenda, a.codigo_usuario_agenda),
            nome_empresa = COALESCE(EXCLUDED.nome_empresa, a.nome_empresa),
            nome = COALESCE(EXCLUDED.nome, a.nome),
            cpf = COALESCE(EXCLUDED.cpf, a.cpf),
            tipo_compromisso = COALESCE(EXCLUDED.tipo_compromisso, a.tipo_compromisso),
            sequencial_ficha = COALESCE(EXCLUDED.sequencial_ficha, a.sequencial_ficha),
            atendido_soc = COALESCE(EXCLUDED.atendido_soc, a.atendido_soc),
            removido_soc_em = NULL,
            sincronizado_em = now()
        RETURNING 1
    )
    SELECT count(*) INTO v_gravados FROM gravados;

    UPDATE public.agendamentos a
    SET removido_soc_em = now()
    WHERE a.unidade_id = p_unidade_id
      AND a.data BETWEEN p_data_inicio AND p_data_fim
      AND a.removido_soc_em IS NULL
      AND a.atendimento_id IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_to_recordset(COALESCE(p_itens, '[]'::jsonb)) AS x(data date, codigo_empresa text, codigo_funcionario text)
          WHERE x.data = a.data
            AND TRIM(x.codigo_empresa) = a.codigo_empresa
            AND TRIM(x.codigo_funcionario) = a.codigo_funcionario
      );
    GET DIAGNOSTICS v_removidos = ROW_COUNT;

    RETURN jsonb_build_object('gravados', v_gravados, 'removidos', v_removidos);
END;
$$;

COMMENT ON FUNCTION public.sincronizar_agendamentos(uuid, date, date, jsonb) IS 'Grava os agendados do SOC de um período (chamada pelo n8n com service_role).';

REVOKE ALL ON FUNCTION public.sincronizar_agendamentos(uuid, date, date, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_agendamentos(uuid, date, date, jsonb) TO service_role;

-- 3. Log das sincronizações (entrada do n8n) ------------------------------------
-- situacao: 'ok' (gravado), 'falha_consulta' (o SOC falhou para a unidade; nada
-- gravado), 'erro' (falha ao gravar; ver erro).
CREATE TABLE IF NOT EXISTS public.agendamentos_sincronizacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
    data_inicio date,
    data_fim date,
    itens jsonb,
    quantidade integer,
    resumo jsonb,
    erros jsonb,
    resultado jsonb,
    situacao text,
    erro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS agendamentos_sincronizacoes_unidade_idx
    ON public.agendamentos_sincronizacoes (unidade_id, created_at DESC);

COMMENT ON TABLE public.agendamentos_sincronizacoes IS 'Execuções da sincronização de agendamentos (n8n). itens é processado pelo trigger e descartado.';

CREATE OR REPLACE FUNCTION public.fn_processar_sincronizacao_agendamentos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_itens jsonb := NEW.itens;
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

DROP TRIGGER IF EXISTS tr_processar_sincronizacao_agendamentos ON public.agendamentos_sincronizacoes;
CREATE TRIGGER tr_processar_sincronizacao_agendamentos
    BEFORE INSERT ON public.agendamentos_sincronizacoes
    FOR EACH ROW EXECUTE FUNCTION public.fn_processar_sincronizacao_agendamentos();

ALTER TABLE public.agendamentos_sincronizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agendamentos_sincronizacoes_leitura_admin ON public.agendamentos_sincronizacoes;
CREATE POLICY agendamentos_sincronizacoes_leitura_admin ON public.agendamentos_sincronizacoes
    FOR SELECT TO authenticated
    USING (unidade_id = public.get_my_unit() AND COALESCE(public.check_is_admin(), false));

REVOKE ALL ON public.agendamentos_sincronizacoes FROM anon, authenticated;
GRANT SELECT ON public.agendamentos_sincronizacoes TO authenticated;
GRANT ALL ON public.agendamentos_sincronizacoes TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Depois de rodar: em Configurações > Integrações, informe o código do usuário
-- Agenda (ex.: 9010 na Praia Grande) e os Exporta Dados.

-- Reversão:
-- DROP TABLE IF EXISTS public.agendamentos_sincronizacoes;
-- DROP FUNCTION IF EXISTS public.fn_processar_sincronizacao_agendamentos();
-- DROP FUNCTION IF EXISTS public.sincronizar_agendamentos(uuid, date, date, jsonb);
-- DROP TABLE IF EXISTS public.agendamentos;
