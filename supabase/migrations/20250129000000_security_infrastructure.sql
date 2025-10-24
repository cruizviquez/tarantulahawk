-- Security Infrastructure Migration for TarantulaHawk
-- LFPIORPI Compliance: Audit logs, API keys, subscription tiers

-- ========================================
-- 1. PROFILES TABLE EXTENSIONS
-- ========================================
-- Add subscription tier and credits tracking (only if profiles exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'paid', 'enterprise')),
      ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 10,
      ADD COLUMN IF NOT EXISTS api_access_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS rate_limit_tier TEXT DEFAULT 'standard' CHECK (rate_limit_tier IN ('standard', 'elevated', 'unlimited'));

    -- Create index for faster subscription queries
    CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);
    CREATE INDEX IF NOT EXISTS idx_profiles_api_access ON public.profiles(api_access_enabled);
  END IF;
END
$$;

-- ========================================
-- 2. AUDIT LOGS TABLE (LFPIORPI COMPLIANCE)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- registration, login, report_generated, transaction_uploaded, export_xml, api_key_created, etc.
  metadata JSONB DEFAULT '{}', -- Flexible storage for action-specific data
  ip_address TEXT,
  user_agent TEXT,
  resource_id TEXT, -- ID of affected resource (report_id, transaction_id, etc.)
  resource_type TEXT, -- Type of resource (report, transaction, api_key)
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Enable Row-Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ========================================
-- 3. API KEYS TABLE (ENTERPRISE ACCESS)
-- ========================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_prefix TEXT NOT NULL, -- First 16 chars visible (e.g., "sk_live_12345678...")
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of full key
  name TEXT NOT NULL, -- User-defined name for the key
  environment TEXT NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'live')),
  rate_limit_per_hour INTEGER DEFAULT 10,
  rate_limit_per_day INTEGER DEFAULT 50,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(revoked, expires_at) WHERE revoked = FALSE;

-- Enable Row-Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own API keys (but NOT the key_hash)
CREATE POLICY "Users can view their own API keys"
  ON api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own API keys
CREATE POLICY "Users can create their own API keys"
  ON api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can revoke their own API keys
CREATE POLICY "Users can revoke their own API keys"
  ON api_keys
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ========================================
-- 4. API KEY USAGE TRACKING
-- ========================================
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- API endpoint called (e.g., /api/reports)
  method TEXT NOT NULL, -- HTTP method (GET, POST, etc.)
  status_code INTEGER, -- HTTP response code
  response_time_ms INTEGER, -- Response time in milliseconds
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage analytics
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_user_id ON api_key_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage(created_at DESC);

-- Enable Row-Level Security
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view usage for their own keys
CREATE POLICY "Users can view their own API key usage"
  ON api_key_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert usage logs
CREATE POLICY "Service role can insert usage logs"
  ON api_key_usage
  FOR INSERT
  WITH CHECK (true);

-- ========================================
-- 5. HELPER FUNCTIONS
-- ========================================

-- Function to increment API key usage count
CREATE OR REPLACE FUNCTION increment_usage(key_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE api_keys
  SET usage_count = usage_count + 1
  WHERE id = key_id
  RETURNING usage_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has API access
CREATE OR REPLACE FUNCTION has_api_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN;
BEGIN
  SELECT api_access_enabled INTO has_access
  FROM profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(has_access, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active API key count for user
CREATE OR REPLACE FUNCTION get_active_key_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  key_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO key_count
  FROM api_keys
  WHERE user_id = p_user_id
    AND revoked = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN key_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 6. TRIGGERS
-- ========================================

-- Trigger to update updated_at timestamp on API keys
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================
COMMENT ON TABLE audit_logs IS 'LFPIORPI compliance audit trail - logs all user actions for regulatory reporting';
COMMENT ON TABLE api_keys IS 'Enterprise API keys for programmatic access to TarantulaHawk services';
COMMENT ON TABLE api_key_usage IS 'Detailed usage tracking for API keys - used for analytics and billing';
DO $$
BEGIN
  -- Only add column comments if profiles table/columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_tier'
  ) THEN
    COMMENT ON COLUMN public.profiles.subscription_tier IS 'User subscription level: free (10 credits), paid (100 credits), enterprise (API access)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'credits_remaining'
  ) THEN
    COMMENT ON COLUMN public.profiles.credits_remaining IS 'Number of remaining credits for transaction processing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'api_access_enabled'
  ) THEN
    COMMENT ON COLUMN public.profiles.api_access_enabled IS 'Whether user has API access (enterprise tier)';
  END IF;
END
$$;
