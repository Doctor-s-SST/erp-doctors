-- Integrações com o SOC: configuração do web service e dos Exporta Dados por
-- unidade (tela Configurações > Integrações). Rodar ANTES de
-- 2026-11-27_agendamentos_soc.sql.
--
-- 1. integracao_soc: empresa principal, código do responsável, código do usuário
--    do web service, username e chave de acesso do WS-Security (padrão ligado),
--    URL e código do usuário Agenda da unidade.
-- 2. integracao_soc_exporta_dados: código e chave de cada Exporta Dados, por
--    identificador (ex.: agendados_agenda, agendamentos_funcionario, pedido_exame).
--
-- Segredos (ws_senha, chave): o navegador nunca lê. As tabelas não têm acesso
-- direto para usuários; a tela usa get_integracao_soc (devolve só "definida" e os
-- 4 últimos caracteres) e salvar_integracao_soc, ambas só para admin da própria
-- unidade. O n8n lê com service_role (node do Supabase).
--
-- Rodar no SQL Editor do Supabase. Não altera dados existentes.

BEGIN;

-- 1. Configuração do web service ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.integracao_soc (
    unidade_id uuid NOT NULL PRIMARY KEY REFERENCES public.unidades(id) ON DELETE CASCADE,
    empresa_principal text,
    codigo_responsavel text,
    codigo_usuario text,
    ws_username text,
    ws_url text,
    ws_urls jsonb DEFAULT '{}'::jsonb NOT NULL,
    ws_senha text,
    ws_security boolean DEFAULT true NOT NULL,
    codigo_usuario_agenda text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Caso uma versão anterior desta migração já tenha sido rodada (pode rodar de novo).
DO $$
BEGIN
    -- A primeira versão chamava o username de ws_usuario.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integracao_soc' AND column_name = 'ws_usuario')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integracao_soc' AND column_name = 'ws_username') THEN
        ALTER TABLE public.integracao_soc RENAME COLUMN ws_usuario TO ws_username;
    END IF;
END $$;
ALTER TABLE public.integracao_soc
    ADD COLUMN IF NOT EXISTS codigo_responsavel text,
    ADD COLUMN IF NOT EXISTS codigo_usuario text,
    ADD COLUMN IF NOT EXISTS ws_username text,
    ADD COLUMN IF NOT EXISTS ws_urls jsonb DEFAULT '{}'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS ws_security boolean DEFAULT true NOT NULL,
    DROP COLUMN IF EXISTS ws_autenticacao,
    DROP COLUMN IF EXISTS ws_usuario;
ALTER TABLE public.integracao_soc ALTER COLUMN ws_url DROP DEFAULT, ALTER COLUMN ws_url DROP NOT NULL;

COMMENT ON TABLE public.integracao_soc IS 'Configuração do web service do SOC por unidade (Configurações > Integrações). Lida pelo n8n com service_role.';
COMMENT ON COLUMN public.integracao_soc.empresa_principal IS 'Código da empresa principal no SOC (parâmetro "empresa" dos Exporta Dados).';
COMMENT ON COLUMN public.integracao_soc.codigo_responsavel IS 'codigoResponsavel: código do responsável da empresa principal no SOC.';
COMMENT ON COLUMN public.integracao_soc.codigo_usuario IS 'codigoUsuario: código do usuário do web service na conta do SOC (identificacaoWsVo).';
COMMENT ON COLUMN public.integracao_soc.ws_username IS 'Username da autenticação WS-Security (ex.: U + código, conforme a configuração de integração do SOC).';
COMMENT ON COLUMN public.integracao_soc.ws_url IS 'URL do web service Exporta Dados.';
COMMENT ON COLUMN public.integracao_soc.ws_urls IS 'URL (WSDL) dos demais web services do SOC, por identificador (ex.: {"socged": "...", "download_arquivos": "..."}).';
COMMENT ON COLUMN public.integracao_soc.ws_senha IS 'Chave de acesso (password) da autenticação WS-Security. Segredo: não é devolvida ao navegador.';
COMMENT ON COLUMN public.integracao_soc.ws_security IS 'Envia o cabeçalho WS-Security (ws_username e chave de acesso em PasswordDigest) nas chamadas ao SOC. Padrão: ligado. Não aparece na tela.';
COMMENT ON COLUMN public.integracao_soc.codigo_usuario_agenda IS 'Código do usuário Agenda da unidade (ED de agendados). Vazio = unidade fora da sincronização de agendamentos.';

-- 2. Exporta Dados ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integracao_soc_exporta_dados (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
    identificador text NOT NULL,
    nome text NOT NULL,
    codigo text,
    chave text,
    ativo boolean DEFAULT true NOT NULL,
    observacao text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT integracao_soc_exporta_dados_unidade_identificador_key UNIQUE (unidade_id, identificador),
    CONSTRAINT integracao_soc_exporta_dados_identificador_check CHECK (identificador ~ '^[a-z0-9_]{2,60}$')
);

COMMENT ON TABLE public.integracao_soc_exporta_dados IS 'Código e chave de cada Exporta Dados do SOC por unidade. Os fluxos do n8n buscam pelo identificador.';
COMMENT ON COLUMN public.integracao_soc_exporta_dados.identificador IS 'Nome técnico usado pelos fluxos (ex.: agendados_agenda, agendamentos_funcionario, pedido_exame).';
COMMENT ON COLUMN public.integracao_soc_exporta_dados.chave IS 'Chave do Exporta Dados. Segredo: não é devolvida ao navegador.';

-- Sem acesso direto para usuários: só pelas funções abaixo e pelo service_role.
ALTER TABLE public.integracao_soc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracao_soc_exporta_dados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integracao_soc FROM anon, authenticated;
REVOKE ALL ON public.integracao_soc_exporta_dados FROM anon, authenticated;
GRANT ALL ON public.integracao_soc TO service_role;
GRANT ALL ON public.integracao_soc_exporta_dados TO service_role;

-- 3. Leitura pela tela (sem segredos) -----------------------------------------
CREATE OR REPLACE FUNCTION public.get_integracao_soc() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_unidade uuid := public.get_my_unit();
    v_config jsonb;
    v_eds jsonb;
BEGIN
    IF v_unidade IS NULL OR NOT COALESCE(public.check_is_admin(), false) THEN
        RAISE EXCEPTION 'Acesso permitido apenas ao administrador da unidade';
    END IF;

    SELECT jsonb_build_object(
        'empresa_principal', c.empresa_principal,
        'codigo_responsavel', c.codigo_responsavel,
        'codigo_usuario', c.codigo_usuario,
        'ws_username', c.ws_username,
        'ws_url', c.ws_url,
        'ws_urls', c.ws_urls,
        'ws_senha_definida', COALESCE(c.ws_senha, '') <> '',
        'ws_senha_final', CASE WHEN COALESCE(c.ws_senha, '') <> '' THEN right(c.ws_senha, 4) END,
        'codigo_usuario_agenda', c.codigo_usuario_agenda,
        'updated_at', c.updated_at
    )
    INTO v_config
    FROM public.integracao_soc c
    WHERE c.unidade_id = v_unidade;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'identificador', e.identificador,
        'nome', e.nome,
        'codigo', e.codigo,
        'chave_definida', COALESCE(e.chave, '') <> '',
        'chave_final', CASE WHEN COALESCE(e.chave, '') <> '' THEN right(trim(e.chave), 4) END,
        'ativo', e.ativo,
        'observacao', e.observacao,
        'updated_at', e.updated_at
    ) ORDER BY e.nome), '[]'::jsonb)
    INTO v_eds
    FROM public.integracao_soc_exporta_dados e
    WHERE e.unidade_id = v_unidade;

    RETURN jsonb_build_object('config', v_config, 'exporta_dados', v_eds);
END;
$$;

COMMENT ON FUNCTION public.get_integracao_soc() IS 'Configuração do SOC da unidade do admin, sem segredos (só se estão definidos e os 4 últimos caracteres).';

-- 4. Gravação pela tela ---------------------------------------------------------
-- p_config: { empresa_principal, codigo_responsavel, codigo_usuario, ws_username, ws_url, ws_urls,
--   ws_senha?, limpar_ws_senha?, codigo_usuario_agenda } (ws_security não é alterado pela tela)
-- p_exporta_dados: [{ identificador, nome, codigo, chave?, limpar_chave?, ativo, observacao }]
-- Segredo vazio ou ausente = mantém o atual; limpar_* = apaga.
-- p_remover: identificadores a excluir.
CREATE OR REPLACE FUNCTION public.salvar_integracao_soc(
    p_config jsonb,
    p_exporta_dados jsonb DEFAULT '[]'::jsonb,
    p_remover text[] DEFAULT '{}'::text[]
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_unidade uuid := public.get_my_unit();
    v_item jsonb;
BEGIN
    IF v_unidade IS NULL OR NOT COALESCE(public.check_is_admin(), false) THEN
        RAISE EXCEPTION 'Acesso permitido apenas ao administrador da unidade';
    END IF;

    IF p_config IS NOT NULL THEN
        INSERT INTO public.integracao_soc AS c (
            unidade_id, empresa_principal, codigo_responsavel, codigo_usuario, ws_username, ws_url, ws_urls, ws_senha,
            codigo_usuario_agenda, updated_at, updated_by
        )
        VALUES (
            v_unidade,
            NULLIF(trim(p_config->>'empresa_principal'), ''),
            NULLIF(trim(p_config->>'codigo_responsavel'), ''),
            NULLIF(trim(p_config->>'codigo_usuario'), ''),
            NULLIF(trim(p_config->>'ws_username'), ''),
            NULLIF(trim(p_config->>'ws_url'), ''),
            -- Só textos não vazios; vazio remove a URL.
            COALESCE((
                SELECT jsonb_object_agg(k, trim(v))
                FROM jsonb_each_text(CASE WHEN jsonb_typeof(p_config->'ws_urls') = 'object' THEN p_config->'ws_urls' ELSE '{}'::jsonb END) AS u(k, v)
                WHERE k ~ '^[a-z0-9_]{2,60}$' AND NULLIF(trim(v), '') IS NOT NULL
            ), '{}'::jsonb),
            NULLIF(trim(p_config->>'ws_senha'), ''),
            NULLIF(trim(p_config->>'codigo_usuario_agenda'), ''),
            now(),
            auth.uid()
        )
        ON CONFLICT (unidade_id) DO UPDATE SET
            empresa_principal = EXCLUDED.empresa_principal,
            codigo_responsavel = EXCLUDED.codigo_responsavel,
            codigo_usuario = EXCLUDED.codigo_usuario,
            ws_username = EXCLUDED.ws_username,
            ws_url = EXCLUDED.ws_url,
            ws_urls = EXCLUDED.ws_urls,
            ws_senha = CASE
                WHEN COALESCE((p_config->>'limpar_ws_senha')::boolean, false) THEN NULL
                ELSE COALESCE(EXCLUDED.ws_senha, c.ws_senha)
            END,
            codigo_usuario_agenda = EXCLUDED.codigo_usuario_agenda,
            updated_at = now(),
            updated_by = auth.uid();
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_exporta_dados, '[]'::jsonb))
    LOOP
        IF NULLIF(trim(v_item->>'identificador'), '') IS NULL OR NULLIF(trim(v_item->>'nome'), '') IS NULL THEN
            RAISE EXCEPTION 'Exporta Dados sem identificador ou nome';
        END IF;

        INSERT INTO public.integracao_soc_exporta_dados AS e (unidade_id, identificador, nome, codigo, chave, ativo, observacao, updated_at, updated_by)
        VALUES (
            v_unidade,
            lower(trim(v_item->>'identificador')),
            trim(v_item->>'nome'),
            NULLIF(trim(v_item->>'codigo'), ''),
            NULLIF(trim(v_item->>'chave'), ''),
            COALESCE((v_item->>'ativo')::boolean, true),
            NULLIF(trim(v_item->>'observacao'), ''),
            now(),
            auth.uid()
        )
        ON CONFLICT (unidade_id, identificador) DO UPDATE SET
            nome = EXCLUDED.nome,
            codigo = EXCLUDED.codigo,
            chave = CASE
                WHEN COALESCE((v_item->>'limpar_chave')::boolean, false) THEN NULL
                ELSE COALESCE(EXCLUDED.chave, e.chave)
            END,
            ativo = EXCLUDED.ativo,
            observacao = EXCLUDED.observacao,
            updated_at = now(),
            updated_by = auth.uid();
    END LOOP;

    IF array_length(p_remover, 1) > 0 THEN
        DELETE FROM public.integracao_soc_exporta_dados
        WHERE unidade_id = v_unidade
          AND identificador = ANY (p_remover);
    END IF;
END;
$$;

COMMENT ON FUNCTION public.salvar_integracao_soc(jsonb, jsonb, text[]) IS 'Grava a configuração do SOC e os Exporta Dados da unidade do admin; segredo vazio mantém o atual.';

REVOKE ALL ON FUNCTION public.get_integracao_soc() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_integracao_soc(jsonb, jsonb, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_integracao_soc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_integracao_soc(jsonb, jsonb, text[]) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Reversão:
-- DROP FUNCTION IF EXISTS public.salvar_integracao_soc(jsonb, jsonb, text[]);
-- DROP FUNCTION IF EXISTS public.get_integracao_soc();
-- DROP TABLE IF EXISTS public.integracao_soc_exporta_dados;
-- DROP TABLE IF EXISTS public.integracao_soc;
