-- Enforcement: auto-profile creation, email-confirmation checks, and stricter RLS
-- Safe to run multiple times (IF EXISTS / IF NOT EXISTS used where possible)

-- ========================================
-- 1) AUTO-CREATE PROFILE ON NEW USER
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a minimal profile with sane defaults for PAYG
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    subscription_tier,
    free_reports_used,
    max_free_reports,
    tx_limit_free,
    tx_used_free,
    api_access_enabled
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    'free',
    0,
    3,
    1500,
    0,
    FALSE
  ) ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;

-- ========================================
-- 2) HELPER: CHECK IF EMAIL IS CONFIRMED
-- ========================================
CREATE OR REPLACE FUNCTION public.is_email_confirmed(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  confirmed boolean;
BEGIN
  SELECT (email_confirmed_at IS NOT NULL) INTO confirmed
  FROM auth.users
  WHERE id = p_user_id;

  RETURN COALESCE(confirmed, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 3) RLS: PROFILES (OWNER-ONLY + SERVICE INSERT)
-- ========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if present (to avoid duplicates)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view own profile'
  ) THEN
    DROP POLICY "Users can view own profile" ON public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update own profile'
  ) THEN
    DROP POLICY "Users can update own profile" ON public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Service role can insert profiles'
  ) THEN
    DROP POLICY "Service role can insert profiles" ON public.profiles;
  END IF;
END
$$;

-- Owner can view own profile (and must be email-confirmed)
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id AND public.is_email_confirmed(auth.uid()));

-- Owner can update own profile (and must be email-confirmed)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id AND public.is_email_confirmed(auth.uid()))
  WITH CHECK (auth.uid() = id AND public.is_email_confirmed(auth.uid()));

-- Inserts should generally be done by trigger/service role only
CREATE POLICY "Service role can insert profiles"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ========================================
-- 4) RLS: API KEYS & USAGE REQUIRE CONFIRMED EMAIL
-- ========================================
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;

-- Drop earlier permissive policies if they exist so we can re-create with confirmation check
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_keys' AND policyname='Users can view their own API keys'
  ) THEN
    DROP POLICY "Users can view their own API keys" ON public.api_keys;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_keys' AND policyname='Users can create their own API keys'
  ) THEN
    DROP POLICY "Users can create their own API keys" ON public.api_keys;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_keys' AND policyname='Users can revoke their own API keys'
  ) THEN
    DROP POLICY "Users can revoke their own API keys" ON public.api_keys;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='api_key_usage' AND policyname='Users can view their own API key usage'
  ) THEN
    DROP POLICY "Users can view their own API key usage" ON public.api_key_usage;
  END IF;
END
$$;

-- Recreate stricter policies (must own row and be email-confirmed)
CREATE POLICY "Users can view their own API keys"
  ON public.api_keys
  FOR SELECT
  USING (auth.uid() = user_id AND public.is_email_confirmed(auth.uid()));

CREATE POLICY "Users can create their own API keys"
  ON public.api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_email_confirmed(auth.uid()));

CREATE POLICY "Users can revoke their own API keys"
  ON public.api_keys
  FOR UPDATE
  USING (auth.uid() = user_id AND public.is_email_confirmed(auth.uid()));

CREATE POLICY "Users can view their own API key usage"
  ON public.api_key_usage
  FOR SELECT
  USING (auth.uid() = user_id AND public.is_email_confirmed(auth.uid()));

-- ========================================
-- 5) RLS: AUDIT LOGS (OPTIONAL CONFIRMATION)
-- ========================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='Users can view their own audit logs'
  ) THEN
    DROP POLICY "Users can view their own audit logs" ON public.audit_logs;
  END IF;
END
$$;

-- Only view own logs, and must be confirmed to read
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (auth.uid() = user_id AND public.is_email_confirmed(auth.uid()));

-- Insert logs allowed broadly (service role / server code). If you want to limit to service_role only, change TO clause.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='Service role can insert audit logs'
  ) THEN
    -- Keep as-is
    NULL;
  ELSE
    CREATE POLICY "Service role can insert audit logs"
      ON public.audit_logs
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END
$$;