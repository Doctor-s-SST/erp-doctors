--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: status_atendimento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.status_atendimento AS ENUM (
    'AGUARDANDO_RECEPCAO',
    'EM_RECEPCAO',
    'AGUARDANDO_EXAMES',
    'FINALIZADO',
    'CANCELADO',
    'NAO_ATENDIDO',
    'EM_FILA',
    'EM_TRIAGEM',
    'EM_AUDIOMETRIA',
    'EM_CLÍNICO',
    'EM_LABORATÓRIO',
    'EM_ECG_EEG',
    'EM_TOXICOLÓGICO',
    'EM_ESPIROMETRIA',
    'EM_TESTANDO',
    'EM_EM_ITANHAEM',
    'EM_ITA_TESTE',
    'EM_ECG_EEG_ESPIRO',
    'EM_CL_NICO',
    'EM_TESTE_ESP',
    'EM_TESTE_ESPECIALIDADE',
    'EM_GAMA_GT'
);


--
-- Name: status_exame; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.status_exame AS ENUM (
    'AGUARDANDO',
    'DISPONIVEL',
    'EM_ATENDIMENTO',
    'FINALIZADO',
    'NAO_ATENDIDO',
    'CANCELADO',
    'FICHA_CRIADA',
    'EM_FILA'
);


--
-- Name: tipo_senha; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_senha AS ENUM (
    'NORMAL',
    'PREFERENCIAL'
);


--
-- Name: cancelar_atendimento(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancelar_atendimento(p_atendimento_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
    v_chegada TIMESTAMP;
    v_minutos INTEGER;
BEGIN
    SELECT created_at
    INTO v_chegada
    FROM atendimentos
    WHERE id = p_atendimento_id;

    -- Calcula a diferença em minutos
    v_minutos := EXTRACT(EPOCH FROM (NOW() - v_chegada)) / 60;

    -- Cancela o atendimento
    UPDATE atendimentos
    SET
        status = 'CANCELADO',
        tempo_espera_min = v_minutos,
        updated_at = NOW()
    WHERE id = p_atendimento_id;

    -- Cancela todos os exames que NÃO foram finalizados
    UPDATE atendimento_exames
    SET
        status = 'CANCELADO',
        updated_at = NOW()
    WHERE atendimento_id = p_atendimento_id
    AND status <> 'FINALIZADO';

END;$$;


--
-- Name: cancelar_atendimento_novo(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancelar_atendimento_novo(p_atendimento_id uuid, p_usuario_id text, p_usuario_nome text, p_unidade_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
    v_chegada TIMESTAMP;
    v_minutos INTEGER;
    v_status_antigo TEXT;
    v_senha TEXT;
BEGIN

    SELECT
        created_at,
        status,
        senha_codigo
    INTO
        v_chegada,
        v_status_antigo,
        v_senha
    FROM atendimentos
    WHERE id = p_atendimento_id;

    -- Calcula a diferença em minutos
    v_minutos := EXTRACT(EPOCH FROM (NOW() - v_chegada)) / 60;

    -- Cancela o atendimento
    UPDATE atendimentos
    SET
        status = 'CANCELADO',
        tempo_espera_min = v_minutos,
        updated_at = NOW()
    WHERE id = p_atendimento_id;

    -- Cancela exames
    UPDATE atendimento_exames
    SET
        status = 'CANCELADO',
        updated_at = NOW()
    WHERE atendimento_id = p_atendimento_id
      AND status <> 'FINALIZADO';

    -- Auditoria
    PERFORM registrar_auditoria(
        p_usuario_id::uuid,
        p_usuario_nome,
        p_unidade_id::uuid,

        'atendimentos',
        p_atendimento_id,

        'ATENDIMENTO_CANCELADO',

        jsonb_build_object(
            'status', v_status_antigo,
            'senha', v_senha
        ),

        jsonb_build_object(
            'status', 'CANCELADO'
        ),

        'Cancelamento pela recepção'
    );

END;$$;


--
-- Name: cancelar_atendimento_novo2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancelar_atendimento_novo2(p_atendimento_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
    v_chegada TIMESTAMP;
    v_minutos INTEGER;
BEGIN
    SELECT created_at
    INTO v_chegada
    FROM atendimentos
    WHERE id = p_atendimento_id;

    -- Calcula a diferença em minutos
    v_minutos := EXTRACT(EPOCH FROM (NOW() - v_chegada)) / 60;

    -- Cancela o atendimento
    UPDATE atendimentos
    SET
        status = 'CANCELADO',
        tempo_espera_min = v_minutos,
        updated_at = NOW()
    WHERE id = p_atendimento_id;

    -- Cancela todos os exames que NÃO foram finalizados
    UPDATE atendimento_exames
    SET
        status = 'CANCELADO',
        updated_at = NOW()
    WHERE atendimento_id = p_atendimento_id
    AND status <> 'FINALIZADO';

END;$$;


--
-- Name: chamar_paciente(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chamar_paciente(p_atendimento_id uuid, p_atendimento_exame_id uuid, p_sala text, p_num_sala text, p_profissional text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_status_atual TEXT;
BEGIN
  -- 🔴🔒 BLOQUEIO ATÔMICO: Verifica E BLOQUEIA em uma única transação
  PERFORM 1 FROM atendimento_exames
  WHERE id = p_atendimento_exame_id
    AND (
      status = 'EM_ATENDIMENTO' OR
      (status = 'EM_FILA' AND num_sala = p_num_sala AND profissional = p_profissional)
    )
  FOR UPDATE NOWAIT;

  -- Se chegou aqui, está livre para este profissional/sala
  -- 1. Atualiza exame
  UPDATE atendimento_exames
  SET
    status = 'EM_FILA',
    iniciado_em = NOW(),
    num_sala = p_num_sala,
    profissional = p_profissional
  WHERE id = p_atendimento_exame_id;

  -- 2. Atualiza atendimento
  UPDATE atendimentos
  SET
    status = (
        'EM_' ||
        REGEXP_REPLACE(
            REGEXP_REPLACE(UPPER(p_sala), '[^A-Z0-9À-ÿ]', '_', 'g'),
            '_{2,}', '_', 'g'
        )
    )::status_atendimento,
    updated_at = NOW(),
    tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
  WHERE id = p_atendimento_id;

END;
$$;


--
-- Name: chamar_paciente_bloqueado(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chamar_paciente_bloqueado(p_atendimento_id uuid, p_atendimento_exame_id uuid, p_sala text, p_num_sala text, p_profissional text) RETURNS json
    LANGUAGE plpgsql
    AS $$DECLARE
  v_status_atendimento_atual TEXT;
BEGIN
  -- 1. Tenta inserir o bloqueio.
  -- Se já existir, o PostgreSQL vai disparar um erro de violação de chave única.
  BEGIN
    INSERT INTO public.chamadas_bloqueio (atendimento_exame_id, sala, profissional)
    VALUES (p_atendimento_exame_id, p_sala, p_profissional);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Paciente já foi chamado por outra sala!');
  END;

  -- 2. Lock no atendimento pai para garantir consistência do status global
  SELECT status::text INTO v_status_atendimento_atual
  FROM public.atendimentos
  WHERE id = p_atendimento_id
  FOR UPDATE;

  -- 3. Verifica se o atendimento pai já não está em outra especialidade
  IF v_status_atendimento_atual LIKE 'EM_%'
     AND v_status_atendimento_atual NOT IN ('EM_RECEPCAO', 'EM_FILA') THEN
    RAISE EXCEPTION 'Paciente já está em atendimento em outra sala.';
  END IF;

  -- 4. Atualiza o exame para EM_FILA (para o seu painel buscar)
  UPDATE public.atendimento_exames
  SET
    status = 'EM_FILA',
    iniciado_em = NOW(),
    num_sala = p_num_sala,
    profissional = p_profissional
  WHERE id = p_atendimento_exame_id;

  -- 5. Atualiza o Atendimento Pai
  UPDATE atendimentos
  SET
    status = (
        'EM_' ||
        REGEXP_REPLACE(
            REGEXP_REPLACE(UPPER(p_sala), '[^A-Z0-9À-ÿ]', '_', 'g'),
            '_{2,}', '_', 'g'
        )
    )::status_atendimento,
    updated_at = NOW(),
    tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
  WHERE id = p_atendimento_id;

  RETURN json_build_object('sucesso', true);
END;$$;


--
-- Name: chamar_paciente_bloqueado_novo(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chamar_paciente_bloqueado_novo(p_atendimento_id uuid, p_atendimento_exame_id uuid, p_sala text, p_num_sala text, p_profissional text) RETURNS json
    LANGUAGE plpgsql
    AS $$DECLARE
  v_status_atendimento_atual TEXT;
BEGIN
  -- 1. Tenta inserir o bloqueio.
  -- Se já existir, o PostgreSQL vai disparar um erro de violação de chave única.
  BEGIN
    INSERT INTO public.chamadas_bloqueio (atendimento_exame_id, sala, profissional)
    VALUES (p_atendimento_exame_id, p_sala, p_profissional);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('sucesso', false, 'mensagem', 'Paciente já foi chamado por outra sala!');
  END;

  -- 2. Lock no atendimento pai para garantir consistência do status global
  SELECT status::text INTO v_status_atendimento_atual
  FROM public.atendimentos
  WHERE id = p_atendimento_id
  FOR UPDATE;

  -- 3. Verifica se o atendimento pai já não está em outra especialidade
  IF v_status_atendimento_atual LIKE 'EM %'
   AND v_status_atendimento_atual NOT IN ('EM_RECEPCAO', 'EM_FILA') THEN
    RAISE EXCEPTION 'Paciente já está em atendimento em outra sala.';
  END IF;

  -- 4. Atualiza o exame para EM_FILA (para o seu painel buscar)
  UPDATE public.atendimento_exames
  SET
    status = 'EM_FILA',
    iniciado_em = NOW(),
    num_sala = p_num_sala,
    profissional = p_profissional
  WHERE id = p_atendimento_exame_id;

  -- 5. Atualiza o Atendimento Pai
  UPDATE atendimentos
  SET
    status = (
    SELECT esp.status
    FROM atendimento_exames ae
    JOIN exames ex ON ex.id = ae.exame_id
    JOIN especialidades esp ON esp.id = ex.especialidade_id
    WHERE ae.id = p_atendimento_exame_id
),
    updated_at = NOW(),
    tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
  WHERE id = p_atendimento_id;

  RETURN json_build_object('sucesso', true);
END;$$;


--
-- Name: chamar_paciente_novo(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chamar_paciente_novo(p_atendimento_id uuid, p_atendimento_exame_id uuid, p_sala text, p_num_sala text, p_profissional text) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
  v_status_atual TEXT;
BEGIN
  -- 🔴🔒 BLOQUEIO ATÔMICO: Verifica E BLOQUEIA em uma única transação
  PERFORM 1 FROM atendimento_exames
  WHERE id = p_atendimento_exame_id
    AND (
      status = 'EM_ATENDIMENTO' OR
      (status = 'EM_FILA' AND num_sala = p_num_sala AND profissional = p_profissional)
    )
  FOR UPDATE NOWAIT;

  -- Se chegou aqui, está livre para este profissional/sala
  -- 1. Atualiza exame
  UPDATE atendimento_exames
  SET
    status = 'EM_FILA',
    iniciado_em = NOW(),
    num_sala = p_num_sala,
    profissional = p_profissional
  WHERE id = p_atendimento_exame_id;

  -- 2. Atualiza atendimento
  UPDATE atendimentos
  SET
    status = (
    SELECT esp.status
    FROM atendimento_exames ae
    JOIN exames ex ON ex.id = ae.exame_id
    JOIN especialidades esp ON esp.id = ex.especialidade_id
    WHERE ae.id = p_atendimento_exame_id
),
    updated_at = NOW(),
    tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
  WHERE id = p_atendimento_id;

END;$$;


--
-- Name: check_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT (role = 'admin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$;


--
-- Name: debug_log_reabertura_exame(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_log_reabertura_exame() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_claims jsonb;
BEGIN
    IF OLD.status = 'FINALIZADO'
       AND NEW.status = 'EM_ATENDIMENTO' THEN

        BEGIN
            v_claims :=
                NULLIF(
                    current_setting('request.jwt.claims', true),
                    ''
                )::jsonb;
        EXCEPTION WHEN OTHERS THEN
            v_claims := NULL;
        END;

        INSERT INTO public.debug_reabertura_exames (
            atendimento_exame_id,
            status_anterior,
            status_novo,
            finalizado_em,
            usuario_banco,
            role_configurada,
            jwt_sub,
            jwt_role,
            application_name,
            client_addr,
            backend_pid,
            transaction_id,
            comando_executado
        )
        VALUES (
            NEW.id,
            OLD.status::text,
            NEW.status::text,
            NEW.finalizado_em,
            session_user,
            current_setting('role', true),
            v_claims ->> 'sub',
            v_claims ->> 'role',
            current_setting('application_name', true),
            inet_client_addr()::text,
            pg_backend_pid(),
            txid_current(),
            current_query()
        );
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: debug_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.debug_user() RETURNS json
    LANGUAGE sql
    AS $$
select json_build_object(
    'uid', auth.uid(),
    'role', auth.role()
);
$$;


--
-- Name: finalizar_especialidade(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalizar_especialidade(p_atendimento_id uuid, p_atendimento_exame_id uuid, p_sala text, p_num_sala text) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
    v_restam_exames BOOLEAN;
BEGIN
    -- 1. Finaliza o exame específico
    UPDATE public.atendimento_exames
    SET
        status = 'FINALIZADO',
        finalizado_em = NOW()
    WHERE id = p_atendimento_exame_id;

    -- 2. Verifica se ainda existe algum exame que não foi finalizado nem cancelado
    SELECT EXISTS (
        SELECT 1
        FROM public.atendimento_exames
        WHERE atendimento_id = p_atendimento_id
          AND status NOT IN ('FINALIZADO', 'NAO_ATENDIDO')
    ) INTO v_restam_exames;

    -- 3. Atualiza o atendimento pai baseado no que resta
    IF v_restam_exames THEN
        -- Se ainda tem exames, volta para o status de espera por outros
        UPDATE public.atendimentos
        SET
            status = 'AGUARDANDO_EXAMES'::status_atendimento,
            updated_at = NOW()
        WHERE id = p_atendimento_id;
    ELSE
        -- SE NÃO RESTA NADA, o atendimento completo da clínica acabou
        UPDATE public.atendimentos
        SET
            status = 'FINALIZADO'::status_atendimento,
            updated_at = NOW(),
            tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
        WHERE id = p_atendimento_id;
    END IF;
END;$$;


--
-- Name: finalizar_especialidade_novo(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalizar_especialidade_novo(p_atendimento_id uuid, p_atendimento_exame_id uuid, p_sala text, p_num_sala text) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
    v_restam_exames BOOLEAN;
BEGIN
    -- 1. Finaliza o exame específico
    UPDATE public.atendimento_exames
    SET
        status = 'FINALIZADO',
        finalizado_em = NOW(),
        finaliza_em = NULL
    WHERE id = p_atendimento_exame_id;

    -- 2. Verifica se ainda existe algum exame que não foi finalizado nem cancelado
    SELECT EXISTS (
        SELECT 1
        FROM public.atendimento_exames
        WHERE atendimento_id = p_atendimento_id
          AND status NOT IN ('FINALIZADO', 'NAO_ATENDIDO')
    ) INTO v_restam_exames;

    -- 3. Atualiza o atendimento pai baseado no que resta
    IF v_restam_exames THEN
        -- Se ainda tem exames, volta para o status de espera por outros
        UPDATE public.atendimentos
        SET
            status = 'AGUARDANDO_EXAMES',
            updated_at = NOW()
        WHERE id = p_atendimento_id;
    ELSE
        -- SE NÃO RESTA NADA, o atendimento completo da clínica acabou
        UPDATE public.atendimentos
        SET
            status = 'FINALIZADO',
            updated_at = NOW(),
            tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
        WHERE id = p_atendimento_id;
    END IF;
END;$$;


--
-- Name: finalizar_recepcao(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalizar_recepcao(p_atendimento_id uuid, p_especialidades_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$BEGIN
    -- 1. Atualiza o status do atendimento
    UPDATE public.atendimentos
    SET
        status = 'AGUARDANDO_EXAMES',
        updated_at = NOW(),
        tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60,
        finalizado_recepcao = NOW()
    WHERE id = p_atendimento_id;
END;$$;


--
-- Name: finalizar_recepcao_novo(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalizar_recepcao_novo(p_atendimento_id uuid, p_especialidades_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    AS $$BEGIN
    -- 1. Atualiza o status do atendimento
    UPDATE public.atendimentos
    SET
        status = 'AGUARDANDO_EXAMES',
        updated_at = NOW(),
        tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60,
        finalizado_recepcao = NOW()
    WHERE id = p_atendimento_id;
END;$$;


--
-- Name: fn_log_mudanca_status_atendimento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_log_mudanca_status_atendimento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$BEGIN
    -- Captura tanto o INSERT quanto a mudança de status
    IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN

        INSERT INTO public.log_status_atendimento (
            atendimento_id,
            unidade_id,
            status_anterior,
            status_novo,
            localizacao,
            profissional,
            paciente_nome,
            paciente_cpf,
            paciente_empresa,
            paciente_nascimento,
            senha,
            acionamento,
            encaixe,
            exames_atendimento,
            sequencial_ficha,
            tipo_exame
        )
        -- Usamos VALUES em vez de SELECT para garantir que o log ocorra
        -- mesmo que a busca pelo paciente falhe
        VALUES (
            NEW.id,
            NEW.unidade_id,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
            NEW.status,
            COALESCE(NEW.guiche, 'TOTEM'),
            NEW.atendente,
            (SELECT nome FROM public.pacientes WHERE id = NEW.paciente_id),
            (SELECT cpf FROM public.pacientes WHERE id = NEW.paciente_id),
            (SELECT empresa_razao FROM public.pacientes WHERE id = NEW.paciente_id),
            (SELECT data_nascimento FROM public.pacientes WHERE id = NEW.paciente_id),
            NEW.senha_codigo,
            NEW.created_at,
            NEW.encaixe,
            NEW.exames_list,
            NEW.ficha_sequencial,
            NEW.tipo_exame
        );

    END IF;
    RETURN NEW;
END;$$;


--
-- Name: fn_log_status_exames(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_log_status_exames() RETURNS trigger
    LANGUAGE plpgsql
    AS $$BEGIN
    -- Quando o status do exame muda
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.log_status_atendimento (
            atendimento_id,
            unidade_id,
            status_anterior,
            status_novo,
            localizacao,
            num_sala,
            profissional,
            paciente_nome,
            paciente_cpf,
            paciente_empresa,
            paciente_nascimento,
            senha,
            tempo_finalizacao_segundos,
            iniciado_em,
            finalizado_em
        )
        SELECT
            NEW.atendimento_id,
            NEW.unidade_id,
            OLD.status,
            -- Mantém o padrão do n8n: se for FINALIZADO mantém, senão vira 'EM_NOMEDASALA'
            CASE WHEN NEW.status = 'FINALIZADO' THEN 'FINALIZADO' ELSE ('EM ' || NEW.sala) END,
            NEW.sala,
            NEW.num_sala,
            NEW.profissional,
            p.nome,
            p.cpf,
            p.empresa_razao,
            p.data_nascimento,
            a.senha_codigo,
            esp.tempo_finalizacao_segundos,
            NEW.iniciado_em,
            NEW.finalizado_em
        FROM public.atendimentos a
        JOIN public.pacientes p ON p.id = a.paciente_id
        LEFT JOIN public.especialidades esp ON
            UPPER(TRIM(esp.nome)) = UPPER(TRIM(NEW.sala))
            AND esp.unidade_id = NEW.unidade_id
        WHERE a.id = NEW.atendimento_id;
    END IF;
    RETURN NEW;
END;$$;


--
-- Name: gerar_senha(public.tipo_senha, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_senha(tipo_param public.tipo_senha, guiche_param text, atendente_param text, unidade_param uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    nova_sequencia int;
    prefixo text;
    senha_gerada text;
BEGIN
    -- 1. Próxima sequência do dia FILTRADA POR UNIDADE
    -- Isso garante que a contagem N001, N002 recomece para cada clínica
    SELECT COALESCE(MAX(CAST(substring(senha_codigo from 2) AS INT)), 0) + 1
    into nova_sequencia
    FROM public.atendimentos
    WHERE tipo_senha = tipo_param
      AND unidade_id = unidade_param  -- Trava a contagem na unidade atual
      AND created_at::date = now()::date;

    -- 2. Prefixo
    prefixo := CASE
        WHEN tipo_param = 'PREFERENCIAL' THEN 'P'
        ELSE 'N'
    END;

    -- 3. Monta senha (Ex: N001)
    senha_gerada := prefixo || LPAD(nova_sequencia::text, 3, '0');

    -- 4. Insere o atendimento vinculado à unidade
    INSERT INTO public.atendimentos (
        senha_codigo,
        tipo_senha,
        guiche,
        atendente,
        status,
        created_at,
        tempo_espera_min,
        unidade_id -- Campo essencial para o multi-tenant
    )
    VALUES (
        senha_gerada,
        tipo_param,
        guiche_param,
        atendente_param,
        'AGUARDANDO_RECEPCAO',
        now(),
        0,
        unidade_param
    );

    -- 5. Retorna a senha para o frontend exibir/imprimir
    RETURN senha_gerada;
END;
$$;


--
-- Name: gerar_senha_java(public.tipo_senha, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_senha_java(tipo_param public.tipo_senha, guiche_param text, atendente_param text, unidade_param uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    nova_sequencia int;
    prefixo text;
    senha_gerada text;
    data_base date;
begin
    -- 🔒 Garante que duas requisições não gerem a mesma senha
    lock table public.atendimentos in exclusive mode;

    -- 🕒 Define data no timezone correto (Brasil)
    data_base := (now() at time zone 'America/Sao_Paulo')::date;

    -- 🔢 Busca próxima sequência do dia (por unidade + tipo)
    select coalesce(max(cast(substring(senha_codigo from 2) as int)), 0) + 1
    into nova_sequencia
    from public.atendimentos
    where tipo_senha = tipo_param
      and unidade_id = unidade_param
      and (created_at at time zone 'America/Sao_Paulo')::date = data_base;

    -- 🔤 Define prefixo
    prefixo := case
        when tipo_param = 'PREFERENCIAL' then 'P'
        else 'N'
    end;

    -- 🧾 Monta senha (ex: N001 / P023)
    senha_gerada := prefixo || lpad(nova_sequencia::text, 3, '0');

    -- 💾 Insere registro
    insert into public.atendimentos (
        senha_codigo,
        tipo_senha,
        guiche,
        atendente,
        status,
        created_at,
        tempo_espera_min,
        unidade_id
    )
    values (
        senha_gerada,
        tipo_param,
        guiche_param,
        atendente_param,
        'AGUARDANDO_RECEPCAO',
        now(),
        0,
        unidade_param
    );

    -- 📤 Retorna senha gerada
    return senha_gerada;
end;
$$;


--
-- Name: gerar_senha_novo(public.tipo_senha, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_senha_novo(tipo_param public.tipo_senha, guiche_param text, atendente_param text, unidade_param uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$DECLARE
    nova_sequencia int;
    prefixo text;
    senha_gerada text;
BEGIN
    -- 1. Próxima sequência do dia FILTRADA POR UNIDADE
    -- Isso garante que a contagem N001, N002 recomece para cada clínica
    SELECT COALESCE(MAX(CAST(substring(senha_codigo from 2) AS INT)), 0) + 1
    into nova_sequencia
    FROM public.atendimentos
    WHERE tipo_senha = tipo_param
      AND unidade_id = unidade_param  -- Trava a contagem na unidade atual
      AND created_at::date = now()::date;

    -- 2. Prefixo
    prefixo := CASE
        WHEN tipo_param = 'PREFERENCIAL' THEN 'P'
        ELSE 'N'
    END;

    -- 3. Monta senha (Ex: N001)
    senha_gerada := prefixo || LPAD(nova_sequencia::text, 3, '0');

    -- 4. Insere o atendimento vinculado à unidade
    INSERT INTO public.atendimentos (
        senha_codigo,
        tipo_senha,
        guiche,
        atendente,
        status,
        created_at,
        tempo_espera_min,
        unidade_id -- Campo essencial para o multi-tenant
    )
    VALUES (
        senha_gerada,
        tipo_param,
        guiche_param,
        atendente_param,
        'AGUARDANDO_RECEPCAO',
        now(),
        0,
        unidade_param
    );

    -- 5. Retorna a senha para o frontend exibir/imprimir
    RETURN senha_gerada;
END;$$;


--
-- Name: gerenciar_chamada_recepcao(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerenciar_chamada_recepcao(p_atendimento_id uuid, p_status text, p_guiche text DEFAULT NULL::text, p_atendente text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$BEGIN
    UPDATE public.atendimentos
    SET
        status = p_status::status_atendimento,

        -- Se o status for EM_FILA, podemos forçar o valor vindo do parâmetro
        -- ou decidir se limpamos o guichê (caso seja um retorno à fila)
        guiche = CASE
            WHEN p_status = 'EM_FILA' THEN p_guiche -- Ou NULL se quiser limpar o guichê na fila
            ELSE COALESCE(p_guiche, guiche)
        END,

        atendente = CASE
            WHEN p_status = 'EM_FILA' THEN p_atendente
            ELSE COALESCE(p_atendente, atendente)
        END,

        updated_at = NOW(),

        tempo_espera_min = CASE
            WHEN p_status IN ('EM_FILA', 'EM_RECEPCAO', 'FINALIZADO')
            THEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
            ELSE tempo_espera_min
        END
    WHERE id = p_atendimento_id;
END;$$;


--
-- Name: gerenciar_chamada_recepcao_novo(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerenciar_chamada_recepcao_novo(p_atendimento_id uuid, p_status text, p_guiche text, p_atendente text) RETURNS void
    LANGUAGE plpgsql
    AS $$BEGIN
    UPDATE public.atendimentos
    SET
        status = p_status,

        -- Se o status for EM_FILA, podemos forçar o valor vindo do parâmetro
        -- ou decidir se limpamos o guichê (caso seja um retorno à fila)
        guiche = CASE
            WHEN p_status = 'EM_FILA' THEN p_guiche -- Ou NULL se quiser limpar o guichê na fila
            ELSE COALESCE(p_guiche, guiche)
        END,

        atendente = CASE
            WHEN p_status = 'EM_FILA' THEN p_atendente
            ELSE COALESCE(p_atendente, atendente)
        END,

        updated_at = NOW(),

        tempo_espera_min = CASE
            WHEN p_status IN ('EM_FILA', 'EM_RECEPCAO', 'FINALIZADO')
            THEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
            ELSE tempo_espera_min
        END
    WHERE id = p_atendimento_id;
END;$$;


--
-- Name: get_dashboard_completo(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_completo(p_unidade_id uuid, p_data_inicio date, p_data_fim date) RETURNS json
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
  aguardando_por_especialidade as (
    select
      be.especialidade_id,
      COUNT(*) as aguardando
    from
      base_exames be
    where
      be.status_text = 'AGUARDANDO'
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
          ap.aguardando
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


--
-- Name: get_fila_especialidade(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_fila_especialidade(p_sala text, p_unidade_id uuid) RETURNS TABLE(id uuid, senha text, tipo_senha text, status text, status_atendimento text, num_sala text, profissional text, bloqueado boolean, sala text, nome text, empresa_razao text, ficha_sequencial text, created_at timestamp with time zone, atendimento_id uuid, observacao text, finaliza_em timestamp with time zone, ultimo_atendimento boolean, codigo_empresa text)
    LANGUAGE plpgsql
    AS $$BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    a.senha_codigo as senha,
    a.tipo_senha::text,
    ae.status::text as status,
    a.status::text as status_atendimento,

    -- NUM_SALA
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.num_sala
      ELSE COALESCE(
        (
          SELECT ae2.num_sala
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.num_sala
      )
    END,

    -- PROFISSIONAL
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.profissional
      ELSE COALESCE(
        (
          SELECT ae2.profissional
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.profissional
      )
    END,

    -- BLOQUEADO
    (
      EXISTS (
        SELECT 1
        FROM atendimento_exames ae2
        WHERE ae2.atendimento_id = ae.atendimento_id
          AND ae2.status = 'EM_ATENDIMENTO'
          AND ae2.id != ae.id
      )
      OR
      (
        ae.status != 'EM_ATENDIMENTO'
        AND EXISTS (
          SELECT 1
          FROM exame_dependencias ed
          JOIN atendimento_exames ae_dep
            ON ae_dep.exame_id = ed.depende_de_exame_id
          WHERE ed.exame_id = ae.exame_id
            AND ae_dep.atendimento_id = ae.atendimento_id
            AND ae_dep.status != 'FINALIZADO'
        )
      )
    ) AS bloqueado,

    -- SALA
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.sala
      ELSE COALESCE(
        (
          SELECT ae2.sala
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.sala
      )
    END,

    p.nome::TEXT,
    p.empresa_razao::TEXT,
    a.ficha_sequencial::text,
    a.created_at::timestamptz,
    a.id as atendimento_id,
    a.observacao::TEXT,

    ae.finaliza_em,

    -- ÚLTIMO ATENDIMENTO
    NOT EXISTS (
      SELECT 1
      FROM atendimento_exames ae2
      WHERE ae2.atendimento_id = ae.atendimento_id
        AND ae2.id != ae.id
        AND ae2.status NOT IN (
          'FINALIZADO',
          'CANCELADO',
          'NAO_ATENDIDO'
        )
    ) AS ultimo_atendimento,

    -- NOVO CAMPO
    p.codigo_empresa::TEXT

  FROM atendimento_exames ae
  JOIN atendimentos a ON a.id = ae.atendimento_id
  JOIN pacientes p ON p.id = a.paciente_id

  WHERE ae.sala = p_sala
  AND a.unidade_id = p_unidade_id
  AND (
    a.status::text = 'AGUARDANDO_EXAMES'
    OR (a.status::text LIKE 'EM_%' AND a.status::text NOT IN ('EM_RECEPCAO', 'EM_FILA'))
    OR (
      a.status::text = 'FINALIZADO'
      AND ae.status = 'FINALIZADO'
    )
  )
  AND ae.status NOT IN ('CANCELADO')
  AND a.created_at::date = CURRENT_DATE
  AND (
    ae.exame_id IS NULL
    OR
    NOT EXISTS (
      SELECT 1
      FROM exame_dependencias ed
      WHERE ed.exame_id = ae.exame_id
    )
    OR
    NOT EXISTS (
      SELECT 1
      FROM exame_dependencias ed
      JOIN atendimento_exames ae_dep
        ON ae_dep.exame_id = ed.depende_de_exame_id
      WHERE ed.exame_id = ae.exame_id
        AND ae_dep.atendimento_id = ae.atendimento_id
        AND ae_dep.status != 'FINALIZADO'
    )
  )

  ORDER BY bloqueado ASC, a.created_at ASC;
END;$$;


--
-- Name: get_fila_especialidade1(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_fila_especialidade1(p_sala text, p_unidade_id uuid) RETURNS TABLE(id uuid, senha text, tipo_senha text, status text, status_atendimento text, num_sala text, profissional text, bloqueado boolean, sala_atual text, nome text, empresa_razao text, ficha_sequencial text, created_at timestamp with time zone, atendimento_id uuid, observacao text, finaliza_em timestamp with time zone, ultimo_atendimento boolean)
    LANGUAGE plpgsql
    AS $$BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    a.senha_codigo as senha,
    a.tipo_senha::text,
    ae.status::text as status,
    a.status::text as status_atendimento,

    -- NUM_SALA
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.num_sala
      ELSE COALESCE(
        (
          SELECT ae2.num_sala
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.num_sala
      )
    END,

    -- PROFISSIONAL
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.profissional
      ELSE COALESCE(
        (
          SELECT ae2.profissional
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.profissional
      )
    END,

    -- BLOQUEADO
    (
      EXISTS (
        SELECT 1
        FROM atendimento_exames ae2
        WHERE ae2.atendimento_id = ae.atendimento_id
          AND ae2.status = 'EM_ATENDIMENTO'
          AND ae2.id != ae.id
      )
      OR
      (
        ae.status != 'EM_ATENDIMENTO'
        AND EXISTS (
          SELECT 1
          FROM exame_dependencias ed
          JOIN atendimento_exames ae_dep
            ON ae_dep.exame_id = ed.depende_de_exame_id
          WHERE ed.exame_id = ae.exame_id
            AND ae_dep.atendimento_id = ae.atendimento_id
            AND ae_dep.status != 'FINALIZADO'
        )
      )
    ) AS bloqueado,

    -- SALA
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.sala
      ELSE COALESCE(
        (
          SELECT ae2.sala
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.sala
      )
    END,

    p.nome::TEXT,
    p.empresa_razao::TEXT,
    a.ficha_sequencial::text,
    a.created_at::timestamptz,
    a.id as atendimento_id,
    a.observacao::TEXT,

    ae.finaliza_em,

    -- ÚLTIMO ATENDIMENTO
    NOT EXISTS (
      SELECT 1
      FROM atendimento_exames ae2
      WHERE ae2.atendimento_id = ae.atendimento_id
        AND ae2.id != ae.id
        AND ae2.status NOT IN (
          'FINALIZADO',
          'CANCELADO',
          'NAO_ATENDIDO'
        )
    ) AS ultimo_atendimento

  FROM atendimento_exames ae
  JOIN atendimentos a ON a.id = ae.atendimento_id
  JOIN pacientes p ON p.id = a.paciente_id

  WHERE ae.sala = p_sala
  AND a.unidade_id = p_unidade_id
  AND (
    a.status::text = 'AGUARDANDO_EXAMES'
    OR (a.status::text LIKE 'EM_%' AND a.status::text NOT IN ('EM_RECEPCAO', 'EM_FILA'))
    OR (
      a.status::text = 'FINALIZADO'
      AND ae.status = 'FINALIZADO'
    )
  )
  AND ae.status NOT IN ('CANCELADO')
  AND a.created_at::date = CURRENT_DATE
  AND (
    ae.exame_id IS NULL
    OR
    NOT EXISTS (
      SELECT 1
      FROM exame_dependencias ed
      WHERE ed.exame_id = ae.exame_id
    )
    OR
    NOT EXISTS (
      SELECT 1
      FROM exame_dependencias ed
      JOIN atendimento_exames ae_dep
        ON ae_dep.exame_id = ed.depende_de_exame_id
      WHERE ed.exame_id = ae.exame_id
        AND ae_dep.atendimento_id = ae.atendimento_id
        AND ae_dep.status != 'FINALIZADO'
    )
  )

  ORDER BY bloqueado ASC, a.created_at ASC;
END;$$;


--
-- Name: get_fila_especialidade_novo(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_fila_especialidade_novo(p_sala text, p_unidade_id uuid) RETURNS TABLE(id uuid, senha text, tipo_senha text, status text, status_atendimento text, num_sala text, profissional text, bloqueado boolean, sala text, nome text, empresa_razao text, ficha_sequencial text, created_at timestamp with time zone, atendimento_id uuid, observacao text, finaliza_em timestamp with time zone, ultimo_atendimento boolean, codigo_empresa text)
    LANGUAGE plpgsql
    AS $$BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    a.senha_codigo as senha,
    a.tipo_senha::text,
    ae.status::text as status,
    a.status as status_atendimento,

    -- NUM_SALA
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.num_sala
      ELSE COALESCE(
        (
          SELECT ae2.num_sala
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.num_sala
      )
    END,

    -- PROFISSIONAL
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.profissional
      ELSE COALESCE(
        (
          SELECT ae2.profissional
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.profissional
      )
    END,

    -- BLOQUEADO
    (
      EXISTS (
        SELECT 1
        FROM atendimento_exames ae2
        WHERE ae2.atendimento_id = ae.atendimento_id
          AND ae2.status = 'EM_ATENDIMENTO'
          AND ae2.id != ae.id
      )
      OR
      (
        ae.status != 'EM_ATENDIMENTO'
        AND EXISTS (
          SELECT 1
          FROM exames ex_atual

          JOIN especialidade_dependencias ed
            ON ed.especialidade_id = ex_atual.especialidade_id

          JOIN atendimento_exames ae_dep
            ON ae_dep.atendimento_id = ae.atendimento_id

          JOIN exames ex_dep
            ON ex_dep.id = ae_dep.exame_id

          WHERE ex_atual.id = ae.exame_id
            AND ex_dep.especialidade_id = ed.depende_de_especialidade_id
            AND ae_dep.id != ae.id
            AND ae_dep.status != 'FINALIZADO'
      )
      )
    ) AS bloqueado,

    -- SALA
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.sala
      ELSE COALESCE(
        (
          SELECT ae2.sala
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.sala
      )
    END,

    p.nome::TEXT,
    p.empresa_razao::TEXT,
    a.ficha_sequencial::text,
    a.created_at::timestamptz,
    a.id as atendimento_id,
    a.observacao::TEXT,

    ae.finaliza_em,

    -- ÚLTIMO ATENDIMENTO
    NOT EXISTS (
      SELECT 1
      FROM atendimento_exames ae2
      WHERE ae2.atendimento_id = ae.atendimento_id
        AND ae2.id != ae.id
        AND ae2.status NOT IN (
          'FINALIZADO',
          'CANCELADO',
          'NAO_ATENDIDO'
        )
    ) AS ultimo_atendimento,

    -- NOVO CAMPO
    p.codigo_empresa::TEXT

  FROM atendimento_exames ae
  JOIN atendimentos a ON a.id = ae.atendimento_id
  JOIN pacientes p ON p.id = a.paciente_id

  WHERE ae.sala = p_sala
  AND a.unidade_id = p_unidade_id
  AND (
    a.status::text = 'AGUARDANDO_EXAMES'
    OR (a.status::text LIKE 'EM %' AND a.status::text NOT IN ('EM_RECEPCAO', 'EM_FILA'))
    OR (
      a.status::text = 'FINALIZADO'
      AND ae.status = 'FINALIZADO'
    )
  )
  AND ae.status NOT IN ('CANCELADO')
  AND a.created_at::date = CURRENT_DATE
  AND (
  ae.exame_id IS NULL

  OR

  NOT EXISTS (
    SELECT 1
    FROM exames ex_atual
    JOIN especialidade_dependencias ed
      ON ed.especialidade_id = ex_atual.especialidade_id
    WHERE ex_atual.id = ae.exame_id
  )

  OR

  NOT EXISTS (
    SELECT 1
    FROM exames ex_atual

    JOIN especialidade_dependencias ed
      ON ed.especialidade_id = ex_atual.especialidade_id

    JOIN atendimento_exames ae_dep
      ON ae_dep.atendimento_id = ae.atendimento_id

    JOIN exames ex_dep
      ON ex_dep.id = ae_dep.exame_id

    WHERE ex_atual.id = ae.exame_id
      AND ex_dep.especialidade_id = ed.depende_de_especialidade_id
      AND ae_dep.id != ae.id
      AND ae_dep.status != 'FINALIZADO'
  )
)

  ORDER BY bloqueado ASC, a.created_at ASC;
END;$$;


--
-- Name: get_fila_especialidade_novo_1(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_fila_especialidade_novo_1(p_sala text, p_unidade_id uuid) RETURNS TABLE(id uuid, senha text, tipo_senha text, status text, status_atendimento text, num_sala text, profissional text, bloqueado boolean, sala text, nome text, empresa_razao text, ficha_sequencial text, created_at timestamp with time zone, atendimento_id uuid, observacao text, finaliza_em timestamp with time zone, ultimo_atendimento boolean, codigo_empresa text)
    LANGUAGE plpgsql
    AS $$BEGIN
  RETURN QUERY

  WITH atendimento_em_andamento AS (
    SELECT
        atendimento_id,
        num_sala,
        profissional,
        sala
    FROM atendimento_exames
    WHERE status = 'EM_ATENDIMENTO'
)

  SELECT
    ae.id,
    a.senha_codigo as senha,
    a.tipo_senha::text,
    ae.status::text as status,
    a.status as status_atendimento,

    -- NUM_SALA
    CASE
    WHEN ae.status = 'FINALIZADO'
        THEN ae.num_sala
    ELSE COALESCE(
        em.num_sala,
        ae.num_sala
    )
END AS num_sala,

    -- PROFISSIONAL
    CASE
    WHEN ae.status = 'FINALIZADO'
        THEN ae.profissional
    ELSE COALESCE(
        em.profissional,
        ae.profissional
    )
END AS profissional,

    -- BLOQUEADO
    (
      EXISTS (
        SELECT 1
        FROM atendimento_exames ae2
        WHERE ae2.atendimento_id = ae.atendimento_id
          AND ae2.status = 'EM_ATENDIMENTO'
          AND ae2.id != ae.id
      )
      OR
      (
        ae.status != 'EM_ATENDIMENTO'
        AND EXISTS (
          SELECT 1
          FROM exames ex_atual

          JOIN especialidade_dependencias ed
            ON ed.especialidade_id = ex_atual.especialidade_id

          JOIN atendimento_exames ae_dep
            ON ae_dep.atendimento_id = ae.atendimento_id

          JOIN exames ex_dep
            ON ex_dep.id = ae_dep.exame_id

          WHERE ex_atual.id = ae.exame_id
            AND ex_dep.especialidade_id = ed.depende_de_especialidade_id
            AND ae_dep.id != ae.id
            AND ae_dep.status != 'FINALIZADO'
      )
      )
    ) AS bloqueado,

    -- SALA
    CASE
    WHEN ae.status = 'FINALIZADO'
        THEN ae.sala
    ELSE COALESCE(
        em.sala,
        ae.sala
    )
END AS sala,

    p.nome::TEXT,
    p.empresa_razao::TEXT,
    a.ficha_sequencial::text,
    a.created_at::timestamptz,
    a.id as atendimento_id,
    a.observacao::TEXT,

    ae.finaliza_em,

    -- ÚLTIMO ATENDIMENTO
    NOT EXISTS (
      SELECT 1
      FROM atendimento_exames ae2
      WHERE ae2.atendimento_id = ae.atendimento_id
        AND ae2.id != ae.id
        AND ae2.status NOT IN (
          'FINALIZADO',
          'CANCELADO',
          'NAO_ATENDIDO'
        )
    ) AS ultimo_atendimento,

    -- NOVO CAMPO
    p.codigo_empresa::TEXT

  FROM atendimento_exames ae
  JOIN atendimentos a ON a.id = ae.atendimento_id
  JOIN pacientes p ON p.id = a.paciente_id

  WHERE ae.sala = p_sala
  AND a.unidade_id = p_unidade_id
  AND (
    a.status::text = 'AGUARDANDO_EXAMES'
    OR (a.status::text LIKE 'EM %' AND a.status::text NOT IN ('EM_RECEPCAO', 'EM_FILA'))
    OR (
      a.status::text = 'FINALIZADO'
      AND ae.status = 'FINALIZADO'
    )
  )
  AND ae.status NOT IN ('CANCELADO')
AND a.created_at >= CURRENT_DATE
AND a.created_at < CURRENT_DATE + INTERVAL '1 day'
  AND (
  ae.exame_id IS NULL

  OR

  NOT EXISTS (
    SELECT 1
    FROM exames ex_atual
    JOIN especialidade_dependencias ed
      ON ed.especialidade_id = ex_atual.especialidade_id
    WHERE ex_atual.id = ae.exame_id
  )

  OR

  NOT EXISTS (
    SELECT 1
    FROM exames ex_atual

    JOIN especialidade_dependencias ed
      ON ed.especialidade_id = ex_atual.especialidade_id

    JOIN atendimento_exames ae_dep
      ON ae_dep.atendimento_id = ae.atendimento_id

    JOIN exames ex_dep
      ON ex_dep.id = ae_dep.exame_id

    WHERE ex_atual.id = ae.exame_id
      AND ex_dep.especialidade_id = ed.depende_de_especialidade_id
      AND ae_dep.id != ae.id
      AND ae_dep.status != 'FINALIZADO'
  )
)

  ORDER BY bloqueado ASC, a.created_at ASC;
END;$$;


--
-- Name: get_fila_especialidade_novo_duplicate(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_fila_especialidade_novo_duplicate(p_sala text, p_unidade_id uuid) RETURNS TABLE(id uuid, senha text, tipo_senha text, status text, status_atendimento text, num_sala text, profissional text, bloqueado boolean, sala text, nome text, empresa_razao text, ficha_sequencial text, created_at timestamp with time zone, atendimento_id uuid, observacao text, finaliza_em timestamp with time zone, ultimo_atendimento boolean, codigo_empresa text)
    LANGUAGE plpgsql
    AS $$BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    a.senha_codigo as senha,
    a.tipo_senha::text,
    ae.status::text as status,
    a.status as status_atendimento,

    -- NUM_SALA
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.num_sala
      ELSE COALESCE(
        (
          SELECT ae2.num_sala
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.num_sala
      )
    END,

    -- PROFISSIONAL
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.profissional
      ELSE COALESCE(
        (
          SELECT ae2.profissional
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.profissional
      )
    END,

    -- BLOQUEADO
    (
      EXISTS (
        SELECT 1
        FROM atendimento_exames ae2
        WHERE ae2.atendimento_id = ae.atendimento_id
          AND ae2.status = 'EM_ATENDIMENTO'
          AND ae2.id != ae.id
      )
      OR
      (
        ae.status != 'EM_ATENDIMENTO'
        AND EXISTS (
          SELECT 1
          FROM exames ex_atual

          JOIN especialidade_dependencias ed
            ON ed.especialidade_id = ex_atual.especialidade_id

          JOIN atendimento_exames ae_dep
            ON ae_dep.atendimento_id = ae.atendimento_id

          JOIN exames ex_dep
            ON ex_dep.id = ae_dep.exame_id

          WHERE ex_atual.id = ae.exame_id
            AND ex_dep.especialidade_id = ed.depende_de_especialidade_id
            AND ae_dep.id != ae.id
            AND ae_dep.status != 'FINALIZADO'
      )
      )
    ) AS bloqueado,

    -- SALA
    CASE
      WHEN ae.status = 'FINALIZADO' THEN ae.sala
      ELSE COALESCE(
        (
          SELECT ae2.sala
          FROM atendimento_exames ae2
          WHERE ae2.atendimento_id = ae.atendimento_id
            AND ae2.status = 'EM_ATENDIMENTO'
            AND ae2.id != ae.id
          LIMIT 1
        ),
        ae.sala
      )
    END AS sala,

    p.nome::TEXT,
    p.empresa_razao::TEXT,
    a.ficha_sequencial::text,
    a.created_at::timestamptz,
    a.id as atendimento_id,
    a.observacao::TEXT,

    ae.finaliza_em,

    -- ÚLTIMO ATENDIMENTO
    NOT EXISTS (
      SELECT 1
      FROM atendimento_exames ae2
      WHERE ae2.atendimento_id = ae.atendimento_id
        AND ae2.id != ae.id
        AND ae2.status NOT IN (
          'FINALIZADO',
          'CANCELADO',
          'NAO_ATENDIDO'
        )
    ) AS ultimo_atendimento,

    -- NOVO CAMPO
    p.codigo_empresa::TEXT

  FROM atendimento_exames ae
  JOIN atendimentos a ON a.id = ae.atendimento_id
  JOIN pacientes p ON p.id = a.paciente_id

  WHERE ae.sala = p_sala
  AND a.unidade_id = p_unidade_id
  AND (
    a.status::text = 'AGUARDANDO_EXAMES'
    OR (a.status::text LIKE 'EM %' AND a.status::text NOT IN ('EM_RECEPCAO', 'EM_FILA'))
    OR (
      a.status::text = 'FINALIZADO'
      AND ae.status = 'FINALIZADO'
    )
  )
  AND ae.status NOT IN ('CANCELADO')
  AND a.created_at::date = CURRENT_DATE
  AND (
  ae.exame_id IS NULL

  OR

  NOT EXISTS (
    SELECT 1
    FROM exames ex_atual
    JOIN especialidade_dependencias ed
      ON ed.especialidade_id = ex_atual.especialidade_id
    WHERE ex_atual.id = ae.exame_id
  )

  OR

  NOT EXISTS (
    SELECT 1
    FROM exames ex_atual

    JOIN especialidade_dependencias ed
      ON ed.especialidade_id = ex_atual.especialidade_id

    JOIN atendimento_exames ae_dep
      ON ae_dep.atendimento_id = ae.atendimento_id

    JOIN exames ex_dep
      ON ex_dep.id = ae_dep.exame_id

    WHERE ex_atual.id = ae.exame_id
      AND ex_dep.especialidade_id = ed.depende_de_especialidade_id
      AND ae_dep.id != ae.id
      AND ae_dep.status != 'FINALIZADO'
  )
)

  ORDER BY bloqueado ASC, a.created_at ASC;
END;$$;


--
-- Name: get_my_unit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_unit() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Esta query ignora o RLS porque a função é SECURITY DEFINER
  RETURN (SELECT unidade_id FROM public.profiles WHERE id = auth.uid());
END;
$$;


--
-- Name: get_painel_recepcao(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_painel_recepcao(p_unidade_id uuid) RETURNS TABLE(id uuid, senha_codigo text, tipo_senha text, nome text, ficha_sequencial text, created_at timestamp with time zone, status text, guiche text, tempo_espera_min integer, ficha_preenchida boolean, sala_atual text, num_sala text, profissional text, tipo_exame text, observacao text, encaixe boolean, codigo_empresa text)
    LANGUAGE plpgsql
    AS $$BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.senha_codigo::TEXT,
        a.tipo_senha::TEXT,
        p.nome::TEXT,
        a.ficha_sequencial::TEXT,
        a.created_at::TIMESTAMPTZ,
        a.status::TEXT,
        a.guiche::TEXT,
        COALESCE(a.tempo_espera_min, 0)::INTEGER,
        (p.id IS NOT NULL),

        -- sala atual
        (
            SELECT ae.num_sala
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- num_sala
        (
            SELECT ae.num_sala
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- profissional
        (
            SELECT ae.profissional
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- tipo_exame
        a.tipo_exame::TEXT,

        a.observacao::TEXT,
        a.encaixe,

        -- NOVO CAMPO
        p.codigo_empresa::TEXT

    FROM
        public.atendimentos a
        LEFT JOIN public.pacientes p ON p.id = a.paciente_id

    WHERE
        a.created_at::date = CURRENT_DATE
        AND a.unidade_id = p_unidade_id

    ORDER BY
        CASE
            WHEN a.status = 'EM_RECEPCAO' THEN 1
            WHEN a.status = 'EM_FILA' THEN 2
            WHEN a.status = 'AGUARDANDO_RECEPCAO' THEN 3
            WHEN a.status::text LIKE 'EM_%' THEN 4
            ELSE 5
        END,
        a.created_at ASC;
END;$$;


--
-- Name: get_painel_recepcao1(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_painel_recepcao1(p_unidade_id uuid) RETURNS TABLE(id uuid, senha_codigo text, tipo_senha text, nome text, ficha_sequencial text, created_at timestamp with time zone, status text, guiche text, tempo_espera integer, ficha_preenchida boolean, sala_atual text, num_sala text, profissional text, tipo_exame text, observacao text, encaixe boolean)
    LANGUAGE plpgsql
    AS $$BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.senha_codigo::TEXT,
        a.tipo_senha::TEXT,
        p.nome::TEXT,
        a.ficha_sequencial::TEXT,
        a.created_at::TIMESTAMPTZ,
        a.status::TEXT,
        a.guiche::TEXT,
        COALESCE(a.tempo_espera_min, 0)::INTEGER,
        (p.id IS NOT NULL),

        -- sala atual
        (
            SELECT ae.num_sala
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- num_sala
        (
            SELECT ae.num_sala
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- profissional
        (
            SELECT ae.profissional
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- ✅ tipo_exame (NOVO)
       a.tipo_exame::TEXT,

        a.observacao::TEXT,
        a.encaixe

    FROM
        public.atendimentos a
        LEFT JOIN public.pacientes p ON p.id = a.paciente_id

    WHERE
        a.created_at::date = CURRENT_DATE
        AND a.unidade_id = p_unidade_id

    ORDER BY
        CASE
            WHEN a.status = 'EM_RECEPCAO' THEN 1
            WHEN a.status = 'EM_FILA' THEN 2
            WHEN a.status = 'AGUARDANDO_RECEPCAO' THEN 3
            WHEN a.status::text LIKE 'EM_%' THEN 4
            ELSE 5
        END,
        a.created_at ASC;
END;$$;


--
-- Name: get_painel_recepcao_novo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_painel_recepcao_novo(p_unidade_id uuid) RETURNS TABLE(id uuid, senha_codigo text, tipo_senha text, nome text, ficha_sequencial text, created_at timestamp with time zone, status text, guiche text, tempo_espera_min integer, ficha_preenchida boolean, sala_atual text, num_sala text, profissional text, tipo_exame text, observacao text, encaixe boolean, codigo_empresa text)
    LANGUAGE plpgsql
    AS $$BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.senha_codigo::TEXT,
        a.tipo_senha::TEXT,
        p.nome::TEXT,
        a.ficha_sequencial::TEXT,
        a.created_at::TIMESTAMPTZ,
        a.status::TEXT,
        a.guiche::TEXT,
        COALESCE(a.tempo_espera_min, 0)::INTEGER,
        (p.id IS NOT NULL),

        -- sala atual
        (
            SELECT ae.num_sala
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- num_sala
        (
            SELECT ae.num_sala
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- profissional
        (
            SELECT ae.profissional
            FROM public.atendimento_exames ae
            WHERE ae.atendimento_id = a.id
              AND ae.status = 'EM_ATENDIMENTO'
            LIMIT 1
        ),

        -- tipo_exame
        a.tipo_exame::TEXT,

        a.observacao::TEXT,
        a.encaixe,

        -- NOVO CAMPO
        p.codigo_empresa::TEXT

    FROM
        public.atendimentos a
        LEFT JOIN public.pacientes p ON p.id = a.paciente_id

    WHERE
        a.created_at::date = CURRENT_DATE
        AND a.unidade_id = p_unidade_id

    ORDER BY
        CASE
            WHEN a.status = 'EM_RECEPCAO' THEN 1
            WHEN a.status = 'EM_FILA' THEN 2
            WHEN a.status = 'AGUARDANDO_RECEPCAO' THEN 3
            WHEN a.status::text LIKE 'EM %' THEN 4
            ELSE 5
        END,
        a.created_at ASC;
END;$$;


--
-- Name: get_painel_tv_fila(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_painel_tv_fila(p_unidade_id uuid) RETURNS TABLE(id uuid, senha_codigo text, nome_paciente text, guiche text, origem text, updated_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$with recepcao as (

    select
        a.id,
        a.senha_codigo,
        p.nome as nome_paciente,
        a.guiche::text,
        'RECEPCAO'::text as origem,
        a.updated_at,
        row_number() over(order by a.updated_at) as rn

    from atendimentos a
    left join pacientes p
        on p.id = a.paciente_id

    where a.status = 'EM_FILA'
      and a.unidade_id = p_unidade_id
      and a.created_at >= date_trunc('day', now())
),

exames as (

    select
        ae.id,
        a.senha_codigo,
        p.nome as nome_paciente,
        ae.num_sala::text as guiche,
        'EXAME'::text as origem,
        a.updated_at,
        row_number() over(order by a.updated_at) as rn

    from atendimento_exames ae

    inner join atendimentos a
        on a.id = ae.atendimento_id

    left join pacientes p
        on p.id = a.paciente_id

    where ae.status = 'EM_FILA'
      and a.unidade_id = p_unidade_id
      and a.created_at >= date_trunc('day', now())
),

intercalado as (

    select
        rn * 2 - 1 as ordem,
        *
    from recepcao

    union all

    select
        rn * 2 as ordem,
        *
    from exames

)

select
    id,
    senha_codigo,
    nome_paciente,
    guiche,
    origem,
    updated_at
from intercalado
order by ordem;$$;


--
-- Name: get_painel_tv_fila_1(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_painel_tv_fila_1(p_unidade_id uuid) RETURNS TABLE(id uuid, senha_codigo text, nome_paciente text, guiche text, origem text, updated_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$with recepcao as (

    select
        a.id,
        a.senha_codigo,
        COALESCE(NULLIF(TRIM(p.nome_social), ''), p.nome) as nome_paciente,
        a.guiche::text,
        'RECEPCAO'::text as origem,
        a.updated_at,
        row_number() over(order by a.updated_at) as rn

    from atendimentos a
    left join pacientes p
        on p.id = a.paciente_id

    where a.status = 'EM_FILA'
      and a.unidade_id = p_unidade_id
      and a.created_at >= date_trunc('day', now())
),

exames as (

    select
        ae.id,
        a.senha_codigo,
        COALESCE(NULLIF(TRIM(p.nome_social), ''), p.nome) as nome_paciente,
        ae.num_sala::text as guiche,
        'EXAME'::text as origem,
        a.updated_at,
        row_number() over(order by a.updated_at) as rn

    from atendimento_exames ae

    inner join atendimentos a
        on a.id = ae.atendimento_id

    left join pacientes p
        on p.id = a.paciente_id

    where ae.status = 'EM_FILA'
      and a.unidade_id = p_unidade_id
      and a.created_at >= date_trunc('day', now())
),

intercalado as (

    select
        rn * 2 - 1 as ordem,
        *
    from recepcao

    union all

    select
        rn * 2 as ordem,
        *
    from exames

)

select
    id,
    senha_codigo,
    nome_paciente,
    guiche,
    origem,
    updated_at
from intercalado
order by ordem;$$;


--
-- Name: get_profissionais(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_profissionais() RETURNS TABLE(id uuid, nome text, especialidade_id uuid, especialidade_nome text)
    LANGUAGE sql
    AS $$
  SELECT
    p.id,
    p.nome,
    p.especialidade_id,
    e.nome
  FROM profissionais p
  LEFT JOIN especialidades e ON e.id = p.especialidade_id
  WHERE p.ativo = true
  ORDER BY p.nome;
$$;


--
-- Name: get_salas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_salas() RETURNS TABLE(id uuid, numero text, nome text, especialidade_id uuid, especialidade_nome text)
    LANGUAGE sql
    AS $$
  SELECT
    s.id,
    s.numero,
    s.nome,
    s.especialidade_id,
    e.nome
  FROM salas s
  LEFT JOIN especialidades e ON e.id = s.especialidade_id
  WHERE s.ativo = true
  ORDER BY s.numero;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$begin
  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    unidade_id,
    role,
    especialidade_id
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',

    -- unidade do admin
    (new.raw_user_meta_data->>'unidade_id')::uuid,

    -- role
    coalesce(
      new.raw_user_meta_data->>'role',
      'especialista'
    ),

    -- especialidade
    case
      when new.raw_user_meta_data->>'especialidade_id' is null
      then null
      else (new.raw_user_meta_data->>'especialidade_id')::uuid
    end
  );

  return new;
end;$$;


--
-- Name: limpar_bloqueio_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.limpar_bloqueio_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Remove bloqueio quando NÃO é EM_FILA
  IF NEW.status != 'EM_FILA' THEN
    DELETE FROM chamadas_bloqueio WHERE atendimento_exame_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: nao_atendido_especialidade(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nao_atendido_especialidade(p_atendimento_id uuid, p_atendimento_exame_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$BEGIN
    -- 1. Atualiza o registro específico do exame (Retorna para AGUARDANDO)
    UPDATE public.atendimento_exames
    SET
        status = 'AGUARDANDO'::status_exame
    WHERE id = p_atendimento_exame_id;

    -- 2. Atualiza a tabela pai (atendimentos)
    UPDATE public.atendimentos
    SET
        status = 'AGUARDANDO_EXAMES'::status_atendimento,
        updated_at = NOW()
    WHERE id = p_atendimento_id;
END;$$;


--
-- Name: nao_atendido_especialidade_novo(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nao_atendido_especialidade_novo(p_atendimento_id uuid, p_atendimento_exame_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$BEGIN
    -- 1. Atualiza o registro específico do exame (Retorna para AGUARDANDO)
    UPDATE public.atendimento_exames
    SET
        status = 'AGUARDANDO'::status_exame
    WHERE id = p_atendimento_exame_id;

    -- 2. Atualiza a tabela pai (atendimentos)
    UPDATE public.atendimentos
    SET
        status = 'AGUARDANDO_EXAMES',
        updated_at = NOW()
    WHERE id = p_atendimento_id;
END;$$;


--
-- Name: notify_chat(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_chat() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin

  perform pg_notify(
    'chat_nova_mensagem',
    json_build_object(
      'id', NEW.id,
      'unidade_id', NEW.unidade_id,
      'sala_id', NEW.sala_id,
      'usuario_id', NEW.usuario_id,
      'usuario_nome', NEW.usuario_nome,
      'mensagem', NEW.mensagem,
      'created_at', NEW.created_at
    )::text
  );

  return NEW;

end;
$$;


--
-- Name: notify_realtime_local(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_realtime_local() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_unidade_id uuid;
begin
    if (tg_table_name = 'atendimentos') then
        v_unidade_id := coalesce(new.unidade_id, old.unidade_id);
    elsif (tg_table_name = 'atendimento_exames') then
        v_unidade_id := coalesce(new.unidade_id, old.unidade_id);
    end if;

    -- Dispara o evento nativo 'fila_alterada' com o ID da unidade
    perform pg_notify('fila_alterada', json_build_object('unidade_id', v_unidade_id)::text);

    return new;
end;
$$;


--
-- Name: painel_chamar_paciente(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.painel_chamar_paciente(p_atendimento_exame_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_atendimento_id UUID;
  v_num_sala TEXT;
  v_profissional TEXT;
  v_sala TEXT;
BEGIN
  -- Pega dados do exame
  SELECT ae.atendimentos_id, ae.num_sala, ae.profissional, esp.nome
  INTO v_atendimento_id, v_num_sala, v_profissional, v_sala
  FROM atendimento_exames ae
  JOIN especialidades esp ON esp.id = (SELECT especialidade_id FROM salas WHERE numero = ae.num_sala LIMIT 1)
  WHERE ae.id = p_atendimento_exame_id;

  -- 1. LIMPA intent antigo
  DELETE FROM chamadas_intent WHERE atendimento_exame_id = p_atendimento_exame_id;

  -- 2. Atualiza para EM_ATENDIMENTO
  UPDATE atendimento_exames
  SET status = 'EM_ATENDIMENTO'
  WHERE id = p_atendimento_exame_id;

  -- 3. Atualiza atendimento
  UPDATE atendimentos
  SET status = ('EM_' || REGEXP_REPLACE(REGEXP_REPLACE(UPPER(v_sala), '[^A-Z0-9À-ÿ]', '_', 'g'), '_{2,}', '_', 'g'))::status_atendimento
  WHERE id = v_atendimento_id;
END;
$$;


--
-- Name: painel_chamar_paciente_novo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.painel_chamar_paciente_novo(p_atendimento_exame_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$DECLARE
  v_atendimento_id UUID;
  v_num_sala TEXT;
  v_profissional TEXT;
  v_sala TEXT;
  v_status TEXT;
BEGIN
  -- Pega dados do exame + status da especialidade
  SELECT
    ae.atendimento_id,
    ae.num_sala,
    ae.profissional,
    esp.nome,
    esp.status
  INTO
    v_atendimento_id,
    v_num_sala,
    v_profissional,
    v_sala,
    v_status
  FROM atendimento_exames ae
  JOIN salas s
    ON s.numero = ae.num_sala
  JOIN especialidades esp
    ON esp.id = s.especialidade_id
  WHERE ae.id = p_atendimento_exame_id
  LIMIT 1;

  -- 1. LIMPA intent antigo
  DELETE FROM chamadas_intent
  WHERE atendimento_exame_id = p_atendimento_exame_id;

  -- 2. Atualiza exame
  UPDATE atendimento_exames
  SET status = 'EM_ATENDIMENTO'
  WHERE id = p_atendimento_exame_id;

  -- 3. Atualiza atendimento com status da especialidade
  UPDATE atendimentos
  SET status = v_status
  WHERE id = v_atendimento_id;

END;$$;


--
-- Name: registrar_auditoria(uuid, text, uuid, text, uuid, text, jsonb, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_auditoria(p_usuario_id uuid, p_usuario_nome text, p_unidade_id uuid, p_tabela text, p_registro_id uuid, p_acao text, p_valor_anterior jsonb DEFAULT NULL::jsonb, p_valor_novo jsonb DEFAULT NULL::jsonb, p_observacao text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin

    insert into auditoria_acoes (
        usuario_id,
        usuario_nome,
        unidade_id,

        tabela_origem,
        registro_id,

        acao,

        valor_anterior,
        valor_novo,

        observacao
    )
    values (
        p_usuario_id,
        p_usuario_nome,
        p_unidade_id,

        p_tabela,
        p_registro_id,

        p_acao,

        p_valor_anterior,
        p_valor_novo,

        p_observacao
    );

end;
$$;


--
-- Name: registrar_dados_ficha(uuid, text, text, date, text, text, text, text, text, text, jsonb, uuid[], text, text, boolean, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_dados_ficha(p_atendimento_id uuid, p_paciente_nome text, p_paciente_cpf text, p_paciente_nascimento date, p_paciente_rg text, p_paciente_cargo text, p_paciente_setor text, p_empresa_razao text, p_empresa_cnpj text, p_codigo_empresa text, p_exames_nomes jsonb, p_especialidades_ids uuid[], p_sequencial text, p_observacao text, p_encaixe boolean, p_tipo_exame text, p_unidade_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$declare v_paciente_id UUID;

v_esp_id UUID;

begin
-- 1. Cadastro do Paciente
insert into
  public.pacientes (
    nome,
    cpf,
    data_nascimento,
    rg,
    cargo,
    setor,
    empresa_razao,
    empresa_cnpj,
    codigo_empresa,
    unidade_id
  )
values
  (
    p_paciente_nome,
    p_paciente_cpf,
    p_paciente_nascimento,
    p_paciente_rg,
    p_paciente_cargo,
    p_paciente_setor,
    p_empresa_razao,
    p_empresa_cnpj,
    p_codigo_empresa,
    p_unidade_id
  )
returning
  id into v_paciente_id;

-- 2. Atualiza Atendimento
update public.atendimentos
set
  paciente_id = v_paciente_id,
  exames_list = p_exames_nomes,
  ficha_sequencial = p_sequencial,
  observacao = p_observacao,
  encaixe = p_encaixe,
  tipo_exame = p_tipo_exame,
  updated_at = NOW()
where
  id = p_atendimento_id
  and unidade_id = p_unidade_id;

-- 4. Remove especialidades desmarcadas
DELETE FROM public.atendimento_exames ae
WHERE ae.atendimento_id = p_atendimento_id
AND NOT EXISTS (
    SELECT 1
    FROM public.exames e
    WHERE e.id = ae.exame_id
      AND e.especialidade_id = ANY(p_especialidades_ids)
);

-- 5. Adiciona apenas especialidades novas
IF p_especialidades_ids IS NOT NULL THEN

    FOREACH v_esp_id IN ARRAY p_especialidades_ids LOOP

        INSERT INTO public.atendimento_exames (
            atendimento_id,
            exame_id,
            sala,
            unidade_id
        )
        SELECT
            p_atendimento_id,
            (
                SELECT e.id
                FROM public.exames e
                WHERE e.especialidade_id = esp.id
                LIMIT 1
            ),
            esp.nome,
            p_unidade_id
        FROM public.especialidades esp
        WHERE esp.id = v_esp_id

        AND NOT EXISTS (
            SELECT 1
            FROM public.atendimento_exames ae
            JOIN public.exames ex
              ON ex.id = ae.exame_id
            WHERE ae.atendimento_id = p_atendimento_id
              AND ex.especialidade_id = v_esp_id
        );

    END LOOP;

END IF;

end;$$;


--
-- Name: registrar_dados_ficha_novo(uuid, text, text, date, text, text, text, text, text, text, jsonb, uuid[], text, text, boolean, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_dados_ficha_novo(p_atendimento_id uuid, p_paciente_nome text, p_paciente_cpf text, p_paciente_nascimento date, p_paciente_rg text, p_paciente_cargo text, p_paciente_setor text, p_empresa_razao text, p_empresa_cnpj text, p_codigo_empresa text, p_exames_nomes jsonb, p_especialidades_ids uuid[], p_sequencial text, p_observacao text, p_encaixe boolean, p_tipo_exame text, p_unidade_id uuid, p_codigo_funcionario text) RETURNS void
    LANGUAGE plpgsql
    AS $$declare v_paciente_id UUID;

v_esp_id UUID;

begin
-- 1. Cadastro do Paciente
insert into
  public.pacientes (
    nome,
    cpf,
    data_nascimento,
    rg,
    cargo,
    setor,
    empresa_razao,
    empresa_cnpj,
    codigo_empresa,
    codigo_funcionario,
    unidade_id
  )
values
  (
    p_paciente_nome,
    p_paciente_cpf,
    p_paciente_nascimento,
    p_paciente_rg,
    p_paciente_cargo,
    p_paciente_setor,
    p_empresa_razao,
    p_empresa_cnpj,
    p_codigo_empresa,
    p_codigo_funcionario,
    p_unidade_id
  )
returning
  id into v_paciente_id;

-- 2. Atualiza Atendimento
update public.atendimentos
set
  paciente_id = v_paciente_id,
  exames_list = p_exames_nomes,
  ficha_sequencial = p_sequencial,
  observacao = p_observacao,
  encaixe = p_encaixe,
  tipo_exame = p_tipo_exame,
  updated_at = NOW()
where
  id = p_atendimento_id
  and unidade_id = p_unidade_id;

-- 4. Remove especialidades desmarcadas
DELETE FROM public.atendimento_exames ae
WHERE ae.atendimento_id = p_atendimento_id
AND NOT EXISTS (
    SELECT 1
    FROM public.exames e
    WHERE e.id = ae.exame_id
      AND e.especialidade_id = ANY(p_especialidades_ids)
);

-- 5. Adiciona apenas especialidades novas
IF p_especialidades_ids IS NOT NULL THEN

    FOREACH v_esp_id IN ARRAY p_especialidades_ids LOOP

        INSERT INTO public.atendimento_exames (
            atendimento_id,
            exame_id,
            sala,
            unidade_id
        )
        SELECT
            p_atendimento_id,
            (
                SELECT e.id
                FROM public.exames e
                WHERE e.especialidade_id = esp.id
                LIMIT 1
            ),
            esp.nome,
            p_unidade_id
        FROM public.especialidades esp
        WHERE esp.id = v_esp_id

        AND NOT EXISTS (
            SELECT 1
            FROM public.atendimento_exames ae
            JOIN public.exames ex
              ON ex.id = ae.exame_id
            WHERE ae.atendimento_id = p_atendimento_id
              AND ex.especialidade_id = v_esp_id
        );

    END LOOP;

END IF;

end;$$;


--
-- Name: registrar_dados_ficha_novo_duplicate(uuid, text, text, date, text, text, text, text, text, text, jsonb, uuid[], text, text, boolean, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_dados_ficha_novo_duplicate(p_atendimento_id uuid, p_paciente_nome text, p_paciente_cpf text, p_paciente_nascimento date, p_paciente_rg text, p_paciente_cargo text, p_paciente_setor text, p_empresa_razao text, p_empresa_cnpj text, p_codigo_empresa text, p_exames_nomes jsonb, p_especialidades_ids uuid[], p_sequencial text, p_observacao text, p_encaixe boolean, p_tipo_exame text, p_unidade_id uuid, p_codigo_funcionario text) RETURNS void
    LANGUAGE plpgsql
    AS $$declare v_paciente_id UUID;

v_esp_id UUID;

begin
-- 1. Cadastro do Paciente
insert into
  public.pacientes (
    nome,
    nome_social,
    cpf,
    data_nascimento,
    rg,
    cargo,
    setor,
    empresa_razao,
    empresa_cnpj,
    codigo_empresa,
    codigo_funcionario,
    unidade_id
  )
values
  (
    p_paciente_nome,
    p_paciente_nome_social,
    p_paciente_cpf,
    p_paciente_nascimento,
    p_paciente_rg,
    p_paciente_cargo,
    p_paciente_setor,
    p_empresa_razao,
    p_empresa_cnpj,
    p_codigo_empresa,
    p_codigo_funcionario,
    p_unidade_id
  )
returning
  id into v_paciente_id;

-- 2. Atualiza Atendimento
update public.atendimentos
set
  paciente_id = v_paciente_id,
  exames_list = p_exames_nomes,
  ficha_sequencial = p_sequencial,
  observacao = p_observacao,
  encaixe = p_encaixe,
  tipo_exame = p_tipo_exame,
  updated_at = NOW()
where
  id = p_atendimento_id
  and unidade_id = p_unidade_id;

-- 4. Remove especialidades desmarcadas
DELETE FROM public.atendimento_exames ae
WHERE ae.atendimento_id = p_atendimento_id
AND NOT EXISTS (
    SELECT 1
    FROM public.exames e
    WHERE e.id = ae.exame_id
      AND e.especialidade_id = ANY(p_especialidades_ids)
);

-- 5. Adiciona apenas especialidades novas
IF p_especialidades_ids IS NOT NULL THEN

    FOREACH v_esp_id IN ARRAY p_especialidades_ids LOOP

        INSERT INTO public.atendimento_exames (
            atendimento_id,
            exame_id,
            sala,
            unidade_id
        )
        SELECT
            p_atendimento_id,
            (
                SELECT e.id
                FROM public.exames e
                WHERE e.especialidade_id = esp.id
                LIMIT 1
            ),
            esp.nome,
            p_unidade_id
        FROM public.especialidades esp
        WHERE esp.id = v_esp_id

        AND NOT EXISTS (
            SELECT 1
            FROM public.atendimento_exames ae
            JOIN public.exames ex
              ON ex.id = ae.exame_id
            WHERE ae.atendimento_id = p_atendimento_id
              AND ex.especialidade_id = v_esp_id
        );

    END LOOP;

END IF;

end;$$;


--
-- Name: registrar_dados_ficha_novo_duplicate_1(uuid, text, text, date, text, text, text, text, text, text, jsonb, uuid[], text, text, boolean, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_dados_ficha_novo_duplicate_1(p_atendimento_id uuid, p_paciente_nome text, p_paciente_cpf text, p_paciente_nascimento date, p_paciente_rg text, p_paciente_cargo text, p_paciente_setor text, p_empresa_razao text, p_empresa_cnpj text, p_codigo_empresa text, p_exames_nomes jsonb, p_especialidades_ids uuid[], p_sequencial text, p_observacao text, p_encaixe boolean, p_tipo_exame text, p_unidade_id uuid, p_codigo_funcionario text, p_paciente_nome_social text) RETURNS void
    LANGUAGE plpgsql
    AS $$declare v_paciente_id UUID;

v_esp_id UUID;

begin
-- 1. Cadastro do Paciente
insert into
  public.pacientes (
    nome,
    nome_social,
    cpf,
    data_nascimento,
    rg,
    cargo,
    setor,
    empresa_razao,
    empresa_cnpj,
    codigo_empresa,
    codigo_funcionario,
    unidade_id
  )
values
  (
    p_paciente_nome,
    p_paciente_nome_social,
    p_paciente_cpf,
    p_paciente_nascimento,
    p_paciente_rg,
    p_paciente_cargo,
    p_paciente_setor,
    p_empresa_razao,
    p_empresa_cnpj,
    p_codigo_empresa,
    p_codigo_funcionario,
    p_unidade_id
  )
returning
  id into v_paciente_id;

-- 2. Atualiza Atendimento
update public.atendimentos
set
  paciente_id = v_paciente_id,
  exames_list = p_exames_nomes,
  ficha_sequencial = p_sequencial,
  observacao = p_observacao,
  encaixe = p_encaixe,
  tipo_exame = p_tipo_exame,
  updated_at = NOW()
where
  id = p_atendimento_id
  and unidade_id = p_unidade_id;

-- 4. Remove especialidades desmarcadas
DELETE FROM public.atendimento_exames ae
WHERE ae.atendimento_id = p_atendimento_id
AND NOT EXISTS (
    SELECT 1
    FROM public.exames e
    WHERE e.id = ae.exame_id
      AND e.especialidade_id = ANY(p_especialidades_ids)
);

-- 5. Adiciona apenas especialidades novas
IF p_especialidades_ids IS NOT NULL THEN

    FOREACH v_esp_id IN ARRAY p_especialidades_ids LOOP

        INSERT INTO public.atendimento_exames (
            atendimento_id,
            exame_id,
            sala,
            unidade_id
        )
        SELECT
            p_atendimento_id,
            (
                SELECT e.id
                FROM public.exames e
                WHERE e.especialidade_id = esp.id
                LIMIT 1
            ),
            esp.nome,
            p_unidade_id
        FROM public.especialidades esp
        WHERE esp.id = v_esp_id

        AND NOT EXISTS (
            SELECT 1
            FROM public.atendimento_exames ae
            JOIN public.exames ex
              ON ex.id = ae.exame_id
            WHERE ae.atendimento_id = p_atendimento_id
              AND ex.especialidade_id = v_esp_id
        );

    END LOOP;

END IF;

end;$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: atendimento_exames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atendimento_exames (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    atendimento_id uuid,
    exame_id uuid,
    status public.status_exame DEFAULT 'AGUARDANDO'::public.status_exame,
    liberado_em timestamp without time zone,
    iniciado_em timestamp without time zone,
    finalizado_em timestamp without time zone,
    observacoes text,
    sala text,
    profissional text,
    num_sala text,
    updated_at timestamp with time zone DEFAULT now(),
    unidade_id uuid,
    finaliza_em timestamp with time zone
);

ALTER TABLE ONLY public.atendimento_exames REPLICA IDENTITY FULL;


--
-- Name: atendimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atendimentos (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    unidade_id uuid,
    paciente_id uuid,
    senha_codigo text NOT NULL,
    tipo_senha public.tipo_senha DEFAULT 'NORMAL'::public.tipo_senha,
    status text,
    guiche text,
    atendente text,
    created_at timestamp with time zone DEFAULT now(),
    finalizado_em timestamp without time zone,
    tempo_espera_min integer,
    ficha_sequencial text,
    updated_at timestamp with time zone DEFAULT now(),
    exames_list jsonb DEFAULT '[]'::jsonb,
    observacao text,
    encaixe boolean DEFAULT false,
    tipo_exame text,
    finalizado_recepcao timestamp with time zone,
    status_teste text
);

ALTER TABLE ONLY public.atendimentos REPLICA IDENTITY FULL;


--
-- Name: auditoria_acoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_acoes (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    usuario_id uuid,
    usuario_nome text,
    unidade_id uuid,
    tabela_origem text,
    registro_id uuid,
    acao text NOT NULL,
    valor_anterior jsonb,
    valor_novo jsonb,
    observacao text
);


--
-- Name: auditoria_acoes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auditoria_acoes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auditoria_acoes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: chamadas_bloqueio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chamadas_bloqueio (
    atendimento_exame_id uuid NOT NULL,
    sala text NOT NULL,
    profissional text NOT NULL,
    bloqueado_em timestamp with time zone DEFAULT now()
);


--
-- Name: chat_mensagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_mensagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unidade_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    usuario_nome text NOT NULL,
    mensagem text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sala_id uuid
);


--
-- Name: chat_ultima_leitura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_ultima_leitura (
    usuario_id uuid NOT NULL,
    ultima_mensagem_lida timestamp with time zone,
    sala_id text,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: debug_reabertura_exames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debug_reabertura_exames (
    id bigint NOT NULL,
    registrado_em timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    atendimento_exame_id uuid,
    status_anterior text,
    status_novo text,
    finalizado_em timestamp with time zone,
    usuario_banco text,
    role_configurada text,
    jwt_sub text,
    jwt_role text,
    application_name text,
    client_addr text,
    backend_pid integer,
    transaction_id bigint,
    comando_executado text
);


--
-- Name: debug_reabertura_exames_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.debug_reabertura_exames ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.debug_reabertura_exames_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: especialidade_dependencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.especialidade_dependencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    especialidade_id uuid NOT NULL,
    depende_de_especialidade_id uuid NOT NULL
);


--
-- Name: especialidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.especialidades (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    unidade_id uuid,
    nome text NOT NULL,
    tempo_finalizacao_segundos smallint,
    obrigar_check_exames boolean DEFAULT false,
    status text
);


--
-- Name: exame_dependencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exame_dependencias (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    exame_id uuid,
    depende_de_exame_id uuid
);


--
-- Name: exames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exames (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    especialidade_id uuid,
    tempo_execucao_segundos integer DEFAULT 0,
    observacao text,
    ordem integer,
    obrigatorio_checkbox boolean DEFAULT false
);


--
-- Name: grupo_especialidade_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grupo_especialidade_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grupo_id uuid,
    especialidade_id uuid NOT NULL,
    unidade_id uuid,
    obrigatoria boolean DEFAULT false NOT NULL,
    excludente boolean DEFAULT false NOT NULL,
    CONSTRAINT grupo_item_papel_check CHECK ((NOT (obrigatoria AND excludente)))
);


--
-- Name: COLUMN grupo_especialidade_itens.excludente; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.grupo_especialidade_itens.excludente IS 'Quando true, a presença desta especialidade elimina o atendimento do filtro do grupo.';


--
-- Name: grupos_especialidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grupos_especialidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamp without time zone DEFAULT now(),
    unidade_id uuid,
    tipo_filtro text DEFAULT 'todos'::text,
    exibir_fila boolean DEFAULT true NOT NULL,
    exibir_dashboard boolean DEFAULT false NOT NULL,
    especialidade_fila_id uuid
);


--
-- Name: COLUMN grupos_especialidades.exibir_fila; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.grupos_especialidades.exibir_fila IS 'Quando false, o grupo não aparece no seletor de filtro das filas.';


--
-- Name: COLUMN grupos_especialidades.exibir_dashboard; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.grupos_especialidades.exibir_dashboard IS 'Quando true (e com especialidade_fila_id), o grupo vira um card próprio no dashboard diário.';


--
-- Name: COLUMN grupos_especialidades.especialidade_fila_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.grupos_especialidades.especialidade_fila_id IS 'Especialidade cuja fila o grupo representa; limita o grupo à fila dessa especialidade.';


--
-- Name: log_status_atendimento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.log_status_atendimento (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    atendimento_id uuid NOT NULL,
    unidade_id uuid,
    status_anterior text,
    status_novo text,
    localizacao text,
    profissional text,
    data_hora timestamp with time zone DEFAULT now(),
    paciente_nome text,
    paciente_empresa text,
    paciente_nascimento date,
    senha text,
    paciente_cpf text,
    acionamento timestamp with time zone,
    num_sala text,
    encaixe boolean,
    tempo_finalizacao_segundos smallint,
    exames_atendimento jsonb,
    sequencial_ficha text,
    tipo_exame text,
    iniciado_em timestamp with time zone,
    finalizado_em timestamp with time zone
);


--
-- Name: pacientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pacientes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nome text,
    cpf text,
    data_nascimento date,
    created_at timestamp without time zone DEFAULT now(),
    rg text,
    cargo text,
    setor text,
    empresa_razao text,
    empresa_cnpj text,
    unidade_id uuid,
    codigo_empresa text,
    codigo_funcionario text,
    nome_social text
);


--
-- Name: pacientes_assinatura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pacientes_assinatura (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    nome_paciente text,
    sequencial_ficha text,
    unidade_id uuid NOT NULL,
    acao text,
    observacao text,
    codigo_empresa_soc text,
    codigo_ged_soc text,
    data_criacao_ged_soc text,
    ativo boolean DEFAULT true NOT NULL
);


--
-- Name: pacientes_assinatura_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pacientes_assinatura_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paciente_assinatura_id uuid,
    unidade_id uuid NOT NULL,
    nome_paciente text,
    sequencial_ficha text,
    acao text NOT NULL,
    observacao text,
    usuario_id uuid NOT NULL,
    usuario_email text
);


--
-- Name: painel_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.painel_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unidade_id uuid NOT NULL,
    fala_andar boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    fala_terreo boolean DEFAULT false NOT NULL
);


--
-- Name: prazos_exames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prazos_exames (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unidade_id uuid NOT NULL,
    nome_exame text NOT NULL,
    prazo_dias integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tipo_filtro text,
    ignorar_exame boolean DEFAULT false
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    first_name text,
    last_name text,
    role text DEFAULT 'operador'::text,
    especialidade_id uuid,
    unidade_id uuid DEFAULT 'ba83f0b4-1b16-4b07-9473-fe929f16f881'::uuid,
    ativo boolean DEFAULT true NOT NULL
);


--
-- Name: profissionais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profissionais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    recepcao boolean,
    unidade_id uuid,
    hora_inicio time without time zone,
    hora_fim time without time zone
);


--
-- Name: profissional_especialidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profissional_especialidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profissional_id uuid,
    especialidade_id uuid,
    unidade_id uuid
);


--
-- Name: sala_especialidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sala_especialidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sala_id uuid NOT NULL,
    especialidade_id uuid NOT NULL,
    unidade_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: salas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero text NOT NULL,
    nome text,
    especialidade_id uuid,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    unidade_id uuid,
    andar text DEFAULT '0'::text
);


--
-- Name: senha_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.senha_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unidades (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    flag text,
    logo_url text,
    logo_icone_url text,
    cnpj text,
    razao_social text,
    endereco text,
    numero text,
    complemento text,
    bairro text,
    cidade text,
    estado text,
    cep text
);


--
-- Name: atendimento_exames atendimento_exames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_exames
    ADD CONSTRAINT atendimento_exames_pkey PRIMARY KEY (id);


--
-- Name: atendimentos atendimentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_pkey PRIMARY KEY (id);


--
-- Name: auditoria_acoes auditoria_acoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_acoes
    ADD CONSTRAINT auditoria_acoes_pkey PRIMARY KEY (id);


--
-- Name: chamadas_bloqueio chamadas_bloqueio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chamadas_bloqueio
    ADD CONSTRAINT chamadas_bloqueio_pkey PRIMARY KEY (atendimento_exame_id);


--
-- Name: chat_mensagens chat_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mensagens
    ADD CONSTRAINT chat_mensagens_pkey PRIMARY KEY (id);


--
-- Name: chat_ultima_leitura chat_ultima_leitura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_ultima_leitura
    ADD CONSTRAINT chat_ultima_leitura_pkey PRIMARY KEY (id);


--
-- Name: debug_reabertura_exames debug_reabertura_exames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debug_reabertura_exames
    ADD CONSTRAINT debug_reabertura_exames_pkey PRIMARY KEY (id);


--
-- Name: especialidade_dependencias especialidade_dependencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidade_dependencias
    ADD CONSTRAINT especialidade_dependencias_pkey PRIMARY KEY (id);


--
-- Name: especialidades especialidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_pkey PRIMARY KEY (id);


--
-- Name: exame_dependencias exame_dependencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exame_dependencias
    ADD CONSTRAINT exame_dependencias_pkey PRIMARY KEY (id);


--
-- Name: exames exames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exames
    ADD CONSTRAINT exames_pkey PRIMARY KEY (id);


--
-- Name: grupo_especialidade_itens grupo_especialidade_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupo_especialidade_itens
    ADD CONSTRAINT grupo_especialidade_itens_pkey PRIMARY KEY (id);


--
-- Name: grupos_especialidades grupos_especialidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos_especialidades
    ADD CONSTRAINT grupos_especialidades_pkey PRIMARY KEY (id);


--
-- Name: log_status_atendimento log_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.log_status_atendimento
    ADD CONSTRAINT log_status_pkey PRIMARY KEY (id);


--
-- Name: pacientes_assinatura_logs pacientes_assinatura_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes_assinatura_logs
    ADD CONSTRAINT pacientes_assinatura_logs_pkey PRIMARY KEY (id);


--
-- Name: pacientes_assinatura pacientes_assinatura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes_assinatura
    ADD CONSTRAINT pacientes_assinatura_pkey PRIMARY KEY (id);


--
-- Name: pacientes pacientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pacientes_pkey PRIMARY KEY (id);


--
-- Name: painel_config painel_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.painel_config
    ADD CONSTRAINT painel_config_pkey PRIMARY KEY (id);


--
-- Name: painel_config painel_config_unidade_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.painel_config
    ADD CONSTRAINT painel_config_unidade_id_key UNIQUE (unidade_id);


--
-- Name: prazos_exames prazos_exames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prazos_exames
    ADD CONSTRAINT prazos_exames_pkey PRIMARY KEY (id);


--
-- Name: prazos_exames prazos_exames_unidade_exame_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prazos_exames
    ADD CONSTRAINT prazos_exames_unidade_exame_key UNIQUE (unidade_id, nome_exame);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profissionais profissionais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissionais
    ADD CONSTRAINT profissionais_pkey PRIMARY KEY (id);


--
-- Name: profissional_especialidades profissional_especialidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_especialidades
    ADD CONSTRAINT profissional_especialidades_pkey PRIMARY KEY (id);


--
-- Name: profissional_especialidades profissional_especialidades_profissional_id_especialidade_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_especialidades
    ADD CONSTRAINT profissional_especialidades_profissional_id_especialidade_i_key UNIQUE (profissional_id, especialidade_id);


--
-- Name: sala_especialidades sala_especialidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_especialidades
    ADD CONSTRAINT sala_especialidades_pkey PRIMARY KEY (id);


--
-- Name: sala_especialidades sala_especialidades_sala_id_especialidade_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_especialidades
    ADD CONSTRAINT sala_especialidades_sala_id_especialidade_id_key UNIQUE (sala_id, especialidade_id);


--
-- Name: salas salas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_pkey PRIMARY KEY (id);


--
-- Name: especialidade_dependencias uk_especialidade_dependencia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidade_dependencias
    ADD CONSTRAINT uk_especialidade_dependencia UNIQUE (especialidade_id, depende_de_especialidade_id);


--
-- Name: unidades unidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unidades
    ADD CONSTRAINT unidades_pkey PRIMARY KEY (id);


--
-- Name: chamadas_bloqueio unique_atendimento_exame; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chamadas_bloqueio
    ADD CONSTRAINT unique_atendimento_exame UNIQUE (atendimento_exame_id);


--
-- Name: chat_ultima_leitura_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_ultima_leitura_uidx ON public.chat_ultima_leitura USING btree (usuario_id, sala_id);


--
-- Name: chat_ultima_leitura_usuario_sala; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_ultima_leitura_usuario_sala ON public.chat_ultima_leitura USING btree (usuario_id, COALESCE(sala_id, '00000000-0000-0000-0000-000000000000'::text));


--
-- Name: idx_ae_atendimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ae_atendimento ON public.atendimento_exames USING btree (atendimento_id);


--
-- Name: idx_ae_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ae_status ON public.atendimento_exames USING btree (status);


--
-- Name: idx_atendimento_exames_atendimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_atendimento ON public.atendimento_exames USING btree (atendimento_id);


--
-- Name: idx_atendimento_exames_atendimento_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_atendimento_id ON public.atendimento_exames USING btree (atendimento_id);


--
-- Name: idx_atendimento_exames_atendimento_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_atendimento_status ON public.atendimento_exames USING btree (atendimento_id, status);


--
-- Name: idx_atendimento_exames_exame; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_exame ON public.atendimento_exames USING btree (exame_id);


--
-- Name: idx_atendimento_exames_liberado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_liberado ON public.atendimento_exames USING btree (liberado_em);


--
-- Name: idx_atendimento_exames_sala; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_sala ON public.atendimento_exames USING btree (sala);


--
-- Name: idx_atendimento_exames_sala_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_sala_status ON public.atendimento_exames USING btree (sala, status, atendimento_id);


--
-- Name: idx_atendimento_exames_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_status ON public.atendimento_exames USING btree (status);


--
-- Name: idx_atendimento_exames_unidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimento_exames_unidade ON public.atendimento_exames USING btree (unidade_id);


--
-- Name: idx_atendimentos_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_created ON public.atendimentos USING btree (created_at);


--
-- Name: idx_atendimentos_paciente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_paciente ON public.atendimentos USING btree (paciente_id);


--
-- Name: idx_atendimentos_painel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_painel ON public.atendimentos USING btree (status, updated_at);


--
-- Name: idx_atendimentos_status_unidade_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_status_unidade_updated ON public.atendimentos USING btree (status, unidade_id, updated_at);


--
-- Name: idx_atendimentos_unidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_unidade ON public.atendimentos USING btree (unidade_id);


--
-- Name: idx_atendimentos_unidade_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_unidade_created ON public.atendimentos USING btree (unidade_id, created_at);


--
-- Name: idx_atendimentos_unidade_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_unidade_status ON public.atendimentos USING btree (unidade_id, status);


--
-- Name: idx_atendimentos_unidade_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_unidade_status_date ON public.atendimentos USING btree (unidade_id, status, created_at);


--
-- Name: idx_atendimentos_unidade_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_unidade_updated ON public.atendimentos USING btree (unidade_id, updated_at);


--
-- Name: idx_atendimentos_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_atendimentos_updated ON public.atendimentos USING btree (updated_at);


--
-- Name: idx_chamadas_bloqueio_exame; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chamadas_bloqueio_exame ON public.chamadas_bloqueio USING btree (atendimento_exame_id);


--
-- Name: idx_chat_leitura_usuario_sala; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_leitura_usuario_sala ON public.chat_ultima_leitura USING btree (usuario_id, sala_id);


--
-- Name: idx_chat_mensagens_sala_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_mensagens_sala_created ON public.chat_mensagens USING btree (sala_id, created_at);


--
-- Name: idx_chat_mensagens_unidade_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_mensagens_unidade_created ON public.chat_mensagens USING btree (unidade_id, created_at);


--
-- Name: idx_chat_mensagens_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_mensagens_usuario ON public.chat_mensagens USING btree (usuario_id);


--
-- Name: idx_chat_sala_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sala_data ON public.chat_mensagens USING btree (sala_id, created_at DESC);


--
-- Name: idx_chat_unidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_unidade ON public.chat_mensagens USING btree (unidade_id, created_at DESC);


--
-- Name: idx_chat_unidade_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_unidade_data ON public.chat_mensagens USING btree (unidade_id, created_at DESC);


--
-- Name: idx_exame_dependencias_busca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exame_dependencias_busca ON public.exame_dependencias USING btree (exame_id, depende_de_exame_id);


--
-- Name: idx_exame_dependencias_depende; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exame_dependencias_depende ON public.exame_dependencias USING btree (depende_de_exame_id);


--
-- Name: idx_exame_dependencias_exame; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exame_dependencias_exame ON public.exame_dependencias USING btree (exame_id);


--
-- Name: idx_exames_atendimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exames_atendimento ON public.atendimento_exames USING btree (atendimento_id);


--
-- Name: idx_exames_especialidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exames_especialidade ON public.exames USING btree (especialidade_id);


--
-- Name: idx_exames_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exames_status ON public.atendimento_exames USING btree (status);


--
-- Name: idx_logs_atendimento_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_atendimento_status ON public.log_status_atendimento USING btree (atendimento_id, status_novo);


--
-- Name: idx_logs_unidade_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_logs_unidade_data ON public.log_status_atendimento USING btree (unidade_id, data_hora);


--
-- Name: idx_pacientes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pacientes_id ON public.pacientes USING btree (id);


--
-- Name: idx_unidades_cnpj; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unidades_cnpj ON public.unidades USING btree (cnpj);


--
-- Name: idx_unidades_flag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unidades_flag ON public.unidades USING btree (flag);


--
-- Name: pacientes_assinatura_logs_paciente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pacientes_assinatura_logs_paciente_idx ON public.pacientes_assinatura_logs USING btree (paciente_assinatura_id);


--
-- Name: pacientes_assinatura_logs_unidade_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pacientes_assinatura_logs_unidade_created_idx ON public.pacientes_assinatura_logs USING btree (unidade_id, created_at DESC);


--
-- Name: atendimento_exames tr_log_status_exames_mudanca; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_log_status_exames_mudanca AFTER UPDATE ON public.atendimento_exames FOR EACH ROW EXECUTE FUNCTION public.fn_log_status_exames();


--
-- Name: atendimentos tr_log_status_mudanca; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_log_status_mudanca AFTER INSERT OR UPDATE ON public.atendimentos FOR EACH ROW EXECUTE FUNCTION public.fn_log_mudanca_status_atendimento();


--
-- Name: atendimento_exames trg_atendimento_exames_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_atendimento_exames_change AFTER INSERT OR DELETE OR UPDATE ON public.atendimento_exames FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_local();


--
-- Name: atendimentos trg_atendimentos_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_atendimentos_change AFTER INSERT OR DELETE OR UPDATE ON public.atendimentos FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_local();


--
-- Name: chat_mensagens trg_chat_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chat_notify AFTER INSERT ON public.chat_mensagens FOR EACH ROW EXECUTE FUNCTION public.notify_chat();


--
-- Name: atendimento_exames trg_debug_reabertura_exame; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_debug_reabertura_exame AFTER UPDATE OF status ON public.atendimento_exames FOR EACH ROW WHEN (((old.status = 'FINALIZADO'::public.status_exame) AND (new.status = 'EM_ATENDIMENTO'::public.status_exame))) EXECUTE FUNCTION public.debug_log_reabertura_exame();


--
-- Name: atendimento_exames trigger_limpar_bloqueio_exames; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_limpar_bloqueio_exames AFTER UPDATE ON public.atendimento_exames FOR EACH ROW EXECUTE FUNCTION public.limpar_bloqueio_status_change();


--
-- Name: atendimento_exames update_atendimento_exames_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_atendimento_exames_updated_at BEFORE UPDATE ON public.atendimento_exames FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: atendimento_exames atendimento_exames_atendimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_exames
    ADD CONSTRAINT atendimento_exames_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id) ON DELETE CASCADE;


--
-- Name: atendimento_exames atendimento_exames_exame_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_exames
    ADD CONSTRAINT atendimento_exames_exame_id_fkey FOREIGN KEY (exame_id) REFERENCES public.exames(id) ON DELETE CASCADE;


--
-- Name: atendimento_exames atendimento_exames_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimento_exames
    ADD CONSTRAINT atendimento_exames_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id);


--
-- Name: atendimentos atendimentos_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id);


--
-- Name: atendimentos atendimentos_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atendimentos
    ADD CONSTRAINT atendimentos_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;


--
-- Name: chamadas_bloqueio chamadas_bloqueio_atendimento_exame_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chamadas_bloqueio
    ADD CONSTRAINT chamadas_bloqueio_atendimento_exame_id_fkey FOREIGN KEY (atendimento_exame_id) REFERENCES public.atendimento_exames(id) ON DELETE CASCADE;


--
-- Name: especialidade_dependencias especialidade_dependencias_depende_de_especialidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidade_dependencias
    ADD CONSTRAINT especialidade_dependencias_depende_de_especialidade_id_fkey FOREIGN KEY (depende_de_especialidade_id) REFERENCES public.especialidades(id);


--
-- Name: especialidade_dependencias especialidade_dependencias_especialidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidade_dependencias
    ADD CONSTRAINT especialidade_dependencias_especialidade_id_fkey FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id);


--
-- Name: especialidades especialidades_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;


--
-- Name: exame_dependencias exame_dependencias_depende_de_exame_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exame_dependencias
    ADD CONSTRAINT exame_dependencias_depende_de_exame_id_fkey FOREIGN KEY (depende_de_exame_id) REFERENCES public.exames(id) ON DELETE CASCADE;


--
-- Name: exame_dependencias exame_dependencias_exame_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exame_dependencias
    ADD CONSTRAINT exame_dependencias_exame_id_fkey FOREIGN KEY (exame_id) REFERENCES public.exames(id) ON DELETE CASCADE;


--
-- Name: exames exames_especialidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exames
    ADD CONSTRAINT exames_especialidade_id_fkey FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id) ON DELETE CASCADE;


--
-- Name: grupo_especialidade_itens fk_grupo_especialidade_itens_especialidade; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupo_especialidade_itens
    ADD CONSTRAINT fk_grupo_especialidade_itens_especialidade FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id);


--
-- Name: profiles fk_profiles_especialidade; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT fk_profiles_especialidade FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id) ON DELETE SET NULL;


--
-- Name: grupo_especialidade_itens grupo_especialidade_itens_grupo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupo_especialidade_itens
    ADD CONSTRAINT grupo_especialidade_itens_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos_especialidades(id);


--
-- Name: grupos_especialidades grupos_especialidades_especialidade_fila_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grupos_especialidades
    ADD CONSTRAINT grupos_especialidades_especialidade_fila_id_fkey FOREIGN KEY (especialidade_fila_id) REFERENCES public.especialidades(id) ON DELETE SET NULL;


--
-- Name: log_status_atendimento log_status_atendimento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.log_status_atendimento
    ADD CONSTRAINT log_status_atendimento_fkey FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id);


--
-- Name: pacientes_assinatura_logs pacientes_assinatura_logs_paciente_assinatura_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes_assinatura_logs
    ADD CONSTRAINT pacientes_assinatura_logs_paciente_assinatura_id_fkey FOREIGN KEY (paciente_assinatura_id) REFERENCES public.pacientes_assinatura(id) ON DELETE SET NULL;


--
-- Name: pacientes_assinatura_logs pacientes_assinatura_logs_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes_assinatura_logs
    ADD CONSTRAINT pacientes_assinatura_logs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: pacientes pacientes_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pacientes_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id);


--
-- Name: painel_config painel_config_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.painel_config
    ADD CONSTRAINT painel_config_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id);


--
-- Name: profissionais profissionais_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissionais
    ADD CONSTRAINT profissionais_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id);


--
-- Name: profissional_especialidades profissional_especialidades_especialidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_especialidades
    ADD CONSTRAINT profissional_especialidades_especialidade_id_fkey FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id) ON DELETE CASCADE;


--
-- Name: profissional_especialidades profissional_especialidades_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_especialidades
    ADD CONSTRAINT profissional_especialidades_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissionais(id) ON DELETE CASCADE;


--
-- Name: profissional_especialidades profissional_especialidades_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_especialidades
    ADD CONSTRAINT profissional_especialidades_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id);


--
-- Name: sala_especialidades sala_especialidades_especialidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_especialidades
    ADD CONSTRAINT sala_especialidades_especialidade_id_fkey FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id) ON DELETE CASCADE;


--
-- Name: sala_especialidades sala_especialidades_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_especialidades
    ADD CONSTRAINT sala_especialidades_sala_id_fkey FOREIGN KEY (sala_id) REFERENCES public.salas(id) ON DELETE CASCADE;


--
-- Name: salas salas_especialidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_especialidade_id_fkey FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id);


--
-- Name: salas salas_unidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salas
    ADD CONSTRAINT salas_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id);


--
-- Name: atendimento_exames Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.atendimento_exames USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: atendimentos Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.atendimentos USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: chat_mensagens Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.chat_mensagens USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: especialidade_dependencias Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.especialidade_dependencias USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: especialidades Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.especialidades USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: grupo_especialidade_itens Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.grupo_especialidade_itens USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: grupos_especialidades Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.grupos_especialidades USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: painel_config Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.painel_config USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: profiles Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.profiles USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: profissionais Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.profissionais USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: profissional_especialidades Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.profissional_especialidades USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: sala_especialidades Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.sala_especialidades USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: salas Admins acessam tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins acessam tudo" ON public.salas USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: pacientes_assinatura Enable delete for users based on user_id; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for users based on user_id" ON public.pacientes_assinatura USING ((public.check_is_admin() OR (auth.uid() = id)));


--
-- Name: exame_dependencias Permitir delete para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir delete para autenticados" ON public.exame_dependencias FOR DELETE TO authenticated USING (true);


--
-- Name: exames Permitir delete para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir delete para autenticados" ON public.exames FOR DELETE TO authenticated USING (true);


--
-- Name: pacientes Permitir delete para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir delete para autenticados" ON public.pacientes FOR DELETE TO authenticated USING (true);


--
-- Name: unidades Permitir delete para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir delete para autenticados" ON public.unidades FOR DELETE TO authenticated USING (true);


--
-- Name: exame_dependencias Permitir insert para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para autenticados" ON public.exame_dependencias FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: exames Permitir insert para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para autenticados" ON public.exames FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: pacientes Permitir insert para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para autenticados" ON public.pacientes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: unidades Permitir insert para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir insert para autenticados" ON public.unidades FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: pacientes Permitir leitura de nomes para o painel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura de nomes para o painel" ON public.pacientes FOR SELECT USING (true);


--
-- Name: exame_dependencias Permitir leitura para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para autenticados" ON public.exame_dependencias FOR SELECT TO authenticated USING (true);


--
-- Name: exames Permitir leitura para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para autenticados" ON public.exames FOR SELECT TO authenticated USING (true);


--
-- Name: pacientes Permitir leitura para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para autenticados" ON public.pacientes FOR SELECT TO authenticated USING (true);


--
-- Name: unidades Permitir leitura para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir leitura para autenticados" ON public.unidades FOR SELECT TO authenticated USING (true);


--
-- Name: exame_dependencias Permitir update para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para autenticados" ON public.exame_dependencias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: exames Permitir update para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para autenticados" ON public.exames FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: pacientes Permitir update para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para autenticados" ON public.pacientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: unidades Permitir update para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir update para autenticados" ON public.unidades FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: exame_dependencias allow delete exame_dependencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow delete exame_dependencias" ON public.exame_dependencias FOR DELETE TO anon USING (true);


--
-- Name: exames allow delete exames; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow delete exames" ON public.exames FOR DELETE TO anon USING (true);


--
-- Name: exame_dependencias allow insert exame_dependencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow insert exame_dependencias" ON public.exame_dependencias FOR INSERT TO anon WITH CHECK (true);


--
-- Name: exames allow insert exames; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow insert exames" ON public.exames FOR INSERT TO anon WITH CHECK (true);


--
-- Name: exame_dependencias allow read exame_dependencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read exame_dependencias" ON public.exame_dependencias FOR SELECT TO anon USING (true);


--
-- Name: exames allow read exames; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow read exames" ON public.exames FOR SELECT TO anon USING (true);


--
-- Name: exame_dependencias allow update exame_dependencias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow update exame_dependencias" ON public.exame_dependencias FOR UPDATE TO anon USING (true);


--
-- Name: exames allow update exames; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow update exames" ON public.exames FOR UPDATE TO anon USING (true);


--
-- Name: atendimento_exames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atendimento_exames ENABLE ROW LEVEL SECURITY;

--
-- Name: atendimentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

--
-- Name: atendimento_exames atendimentos_exames_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atendimentos_exames_unit_isolation ON public.atendimento_exames TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: atendimentos atendimentos_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY atendimentos_unit_isolation ON public.atendimentos TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: auditoria_acoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auditoria_acoes ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_mensagens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_mensagens chat_mensagens_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_mensagens_unit_isolation ON public.chat_mensagens TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: chat_ultima_leitura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_ultima_leitura ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_ultima_leitura chat_ultima_leitura_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_ultima_leitura_user ON public.chat_ultima_leitura TO authenticated USING ((auth.uid() = usuario_id)) WITH CHECK ((auth.uid() = usuario_id));


--
-- Name: especialidade_dependencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.especialidade_dependencias ENABLE ROW LEVEL SECURITY;

--
-- Name: especialidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;

--
-- Name: especialidades especialidades_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY especialidades_unit_isolation ON public.especialidades TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: exame_dependencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exame_dependencias ENABLE ROW LEVEL SECURITY;

--
-- Name: exames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;

--
-- Name: grupo_especialidade_itens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grupo_especialidade_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: grupo_especialidade_itens grupo_especialidade_itens_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grupo_especialidade_itens_unit_isolation ON public.grupo_especialidade_itens TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: grupos_especialidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grupos_especialidades ENABLE ROW LEVEL SECURITY;

--
-- Name: grupos_especialidades grupos_especialidades_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grupos_especialidades_unit_isolation ON public.grupos_especialidades TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: atendimentos insert atendimentos anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert atendimentos anon" ON public.atendimentos FOR INSERT TO anon WITH CHECK (true);


--
-- Name: log_status_atendimento; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.log_status_atendimento ENABLE ROW LEVEL SECURITY;

--
-- Name: log_status_atendimento log_status_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY log_status_unit_isolation ON public.log_status_atendimento TO authenticated USING ((unidade_id = public.get_my_unit()));


--
-- Name: pacientes_assinatura_logs logs_aso_insert_proprio_usuario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_aso_insert_proprio_usuario ON public.pacientes_assinatura_logs FOR INSERT TO authenticated WITH CHECK (((usuario_id = auth.uid()) AND (unidade_id = ( SELECT profiles.unidade_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: pacientes_assinatura_logs logs_aso_select_unidade; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logs_aso_select_unidade ON public.pacientes_assinatura_logs FOR SELECT TO authenticated USING ((unidade_id = ( SELECT profiles.unidade_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: pacientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

--
-- Name: pacientes_assinatura; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pacientes_assinatura ENABLE ROW LEVEL SECURITY;

--
-- Name: pacientes_assinatura_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pacientes_assinatura_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: pacientes_assinatura pacientes_assinatura_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pacientes_assinatura_unit_isolation ON public.pacientes_assinatura TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: painel_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.painel_config ENABLE ROW LEVEL SECURITY;

--
-- Name: painel_config painel_config_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY painel_config_unit_isolation ON public.painel_config TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: profiles policy_profiles_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY policy_profiles_isolation ON public.profiles TO authenticated USING (((id = auth.uid()) OR (unidade_id = public.get_my_unit())));


--
-- Name: prazos_exames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prazos_exames ENABLE ROW LEVEL SECURITY;

--
-- Name: prazos_exames prazos_exames_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prazos_exames_unit_isolation ON public.prazos_exames TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profissionais; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

--
-- Name: profissionais profissionais_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profissionais_unit_isolation ON public.profissionais TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: profissional_especialidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profissional_especialidades ENABLE ROW LEVEL SECURITY;

--
-- Name: sala_especialidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sala_especialidades ENABLE ROW LEVEL SECURITY;

--
-- Name: salas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

--
-- Name: salas salas_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY salas_unit_isolation ON public.salas TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: auditoria_acoes somente_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY somente_insert ON public.auditoria_acoes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: unidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

--
-- Name: profissional_especialidades vinculos_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vinculos_unit_isolation ON public.profissional_especialidades TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));


--
-- Name: sala_especialidades vinculos_unit_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vinculos_unit_isolation ON public.sala_especialidades TO authenticated USING ((unidade_id = public.get_my_unit())) WITH CHECK ((unidade_id = public.get_my_unit()));
