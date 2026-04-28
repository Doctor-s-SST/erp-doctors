BEGIN

  -- 🔴 BLOQUEIA se já estiver em atendimento
  IF EXISTS (
    SELECT 1 
    FROM atendimento_exames
    WHERE atendimento_id = p_atendimento_id
      AND status = 'EM_ATENDIMENTO'
  ) THEN
    -- RAISE EXCEPTION 'Paciente já está em atendimento';
  END IF;

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
            REGEXP_REPLACE(UPPER(p_sala), '[^A-Z0-9À-ÿ]', '_', 'g'), -- 1. Aceita A-Z, 0-9 e caracteres acentuados (À-ÿ)
            '_{2,}', '_', 'g'                                         -- 2. Colapsa múltiplos underlines em um só
        )
    )::status_atendimento,
    updated_at = NOW(),
    tempo_espera_min = EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
  WHERE id = p_atendimento_id;

END;

SELECT atendimento_id, COUNT(*)
FROM atendimento_exames
WHERE status = 'EM_ATENDIMENTO'
GROUP BY atendimento_id
HAVING COUNT(*) > 1;