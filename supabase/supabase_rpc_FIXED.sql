-- ============================================
-- TARANTULAHAWK RATE LIMITING DATABASE
-- Versión: 1.0 (Fixed)
-- Fecha: 2025-10-27
-- ============================================

-- 1. Tabla para almacenar rate limits
CREATE TABLE IF NOT EXISTS rate_limits (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índice para limpiar registros viejos (optimización)
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset 
ON rate_limits(reset_at);

-- 3. Habilitar Row-Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 4. Política RLS: Solo service_role puede acceder
CREATE POLICY "Service role full access" ON rate_limits
  FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Función principal: check_and_increment_rate (nombre correcto para middleware)
CREATE OR REPLACE FUNCTION check_and_increment_rate(
  p_key TEXT,
  p_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ) AS $$
DECLARE
  v_count INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Obtener registro existente
  SELECT count, rate_limits.reset_at INTO v_count, v_reset_at
  FROM rate_limits
  WHERE identifier = p_key;
  
  -- Si no existe o ya expiró, crear/resetear
  IF NOT FOUND OR v_reset_at < v_now THEN
    INSERT INTO rate_limits (identifier, count, reset_at)
    VALUES (p_key, 1, v_now + INTERVAL '1 hour')
    ON CONFLICT (identifier) DO UPDATE
    SET count = 1, reset_at = v_now + INTERVAL '1 hour'
    RETURNING rate_limits.count, rate_limits.reset_at INTO v_count, v_reset_at;
    
    RETURN QUERY SELECT TRUE, p_limit - 1, v_reset_at;
    RETURN;
  END IF;
  
  -- Si ya excedió límite, denegar
  IF v_count >= p_limit THEN
    RETURN QUERY SELECT FALSE, 0, v_reset_at;
    RETURN;
  END IF;
  
  -- Incrementar contador y permitir
  UPDATE rate_limits
  SET count = count + 1
  WHERE identifier = p_key
  RETURNING count, reset_at INTO v_count, v_reset_at;
  
  RETURN QUERY SELECT TRUE, p_limit - v_count, v_reset_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función de mantenimiento: cleanup_rate_limits
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE reset_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permisos a roles necesarios
GRANT EXECUTE ON FUNCTION check_and_increment_rate(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION check_and_increment_rate(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION check_and_increment_rate(TEXT, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION cleanup_rate_limits() TO service_role;

-- ============================================
-- NOTAS DE CONFIGURACIÓN POST-SQL
-- ============================================

-- PASO 1: Ejecutar este SQL completo en Supabase Dashboard → SQL Editor

-- PASO 2: Habilitar pg_cron extension (si no está habilitada)
--   Supabase Dashboard → Database → Extensions → Buscar "pg_cron" → Enable

-- PASO 3: Configurar cron job para cleanup automático
--   Ejecutar en SQL Editor:
--   SELECT cron.schedule(
--     'cleanup-rate-limits',
--     '0 * * * *',  -- Cada hora
--     $$SELECT cleanup_rate_limits()$$
--   );

-- PASO 4: Verificar que funciona
--   SELECT * FROM check_and_increment_rate('test:user', 10);
--   -- Debe retornar: allowed=true, remaining=9

-- PASO 5: Ver rate limits activos
--   SELECT * FROM rate_limits ORDER BY created_at DESC;

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- Si el middleware da error "function does not exist":
-- 1. Verifica que la función se creó: \df check_and_increment_rate
-- 2. Verifica permisos: SELECT has_function_privilege('anon', 'check_and_increment_rate(text, integer)', 'execute');
-- 3. Verifica schema: SELECT routine_schema FROM information_schema.routines WHERE routine_name = 'check_and_increment_rate';

-- Para resetear rate limit de un usuario manualmente:
-- DELETE FROM rate_limits WHERE identifier = 'free:USER_IP';

-- Para ver estadísticas:
-- SELECT 
--   substring(identifier, 1, position(':' in identifier)-1) as tier,
--   COUNT(*) as users,
--   AVG(count) as avg_requests
-- FROM rate_limits 
-- WHERE reset_at > NOW()
-- GROUP BY tier;
