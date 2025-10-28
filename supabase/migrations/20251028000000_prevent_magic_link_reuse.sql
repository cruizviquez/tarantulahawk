-- Tabla para prevenir reuso de magic links
CREATE TABLE IF NOT EXISTS public.used_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_used_tokens_hash ON public.used_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_used_tokens_expires ON public.used_tokens(expires_at);

-- Auto-limpiar tokens expirados (más de 1 hora)
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.used_tokens 
  WHERE expires_at < NOW();
END;
$$;

-- Comentarios
COMMENT ON TABLE public.used_tokens IS 'Prevents magic link replay attacks by tracking used tokens';
COMMENT ON COLUMN public.used_tokens.token_hash IS 'Hash of access token (first 20 chars)';
COMMENT ON COLUMN public.used_tokens.used_at IS 'When the token was first used';
COMMENT ON COLUMN public.used_tokens.expires_at IS 'When to auto-delete this record';

-- RLS policies
ALTER TABLE public.used_tokens ENABLE ROW LEVEL SECURITY;

-- Solo service role puede insertar/leer
CREATE POLICY "Service role only" ON public.used_tokens
  FOR ALL
  USING (auth.role() = 'service_role');
