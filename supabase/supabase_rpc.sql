-- Tabla para almacenar rate limits
CREATE TABLE IF NOT EXISTS rate_limits (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para limpiar registros viejos
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset 
ON rate_limits(reset_at);

-- Función para verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ) AS $$
DECLARE
  v_count INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Obtener o crear registro
  SELECT count, rate_limits.reset_at INTO v_count, v_reset_at
  FROM rate_limits
  WHERE identifier = p_identifier;
  
  -- Si no existe o ya expiró, crear nuevo
  IF NOT FOUND OR v_reset_at < v_now THEN
    INSERT INTO rate_limits (identifier, count, reset_at)
    VALUES (p_identifier, 1, v_now + INTERVAL '1 hour')
    ON CONFLICT (identifier) DO UPDATE
    SET count = 1, reset_at = v_now + INTERVAL '1 hour'
    RETURNING rate_limits.count, rate_limits.reset_at INTO v_count, v_reset_at;
    
    RETURN QUERY SELECT TRUE, p_limit - 1, v_reset_at;
    RETURN;
  END IF;
  
  -- Si ya excedió límite
  IF v_count >= p_limit THEN
    RETURN QUERY SELECT FALSE, 0, v_reset_at;
    RETURN;
  END IF;
  
  -- Incrementar contador
  UPDATE rate_limits
  SET count = count + 1
  WHERE identifier = p_identifier
  RETURNING count, reset_at INTO v_count, v_reset_at;
  
  RETURN QUERY SELECT TRUE, p_limit - v_count, v_reset_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar registros viejos (ejecutar con cron)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE reset_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permisos
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_rate_limits() TO service_role;