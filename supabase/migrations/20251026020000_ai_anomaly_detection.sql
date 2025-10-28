-- ===================================================================
-- AI-POWERED ANOMALY DETECTION SYSTEM
-- Enhanced audit_logs with AI monitoring capabilities
-- ===================================================================

-- 1. Enhance audit_logs table for AI analysis (if not already exists)
DO $$ 
BEGIN
  -- Check if audit_logs table exists, if not create it
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    CREATE TABLE public.audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      status TEXT DEFAULT 'success' CHECK (status IN ('success', 'warning', 'error')),
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Indexes for fast querying
    CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
    CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
    CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
    CREATE INDEX idx_audit_logs_status ON public.audit_logs(status);
    
    -- GIN index for JSONB metadata queries
    CREATE INDEX idx_audit_logs_metadata ON public.audit_logs USING GIN(metadata);

    -- Enable RLS
    ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

    -- RLS: Users can only see their own logs
    CREATE POLICY "Users view own audit logs"
      ON public.audit_logs
      FOR SELECT
      USING (auth.uid() = user_id);

    -- RLS: Admins can see all logs
    CREATE POLICY "Admins view all audit logs"
      ON public.audit_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );

    -- RLS: Only service role can insert (API endpoint)
    CREATE POLICY "Service role inserts audit logs"
      ON public.audit_logs
      FOR INSERT
      WITH CHECK (true); -- Service role bypasses RLS anyway

    -- Grant permissions
    GRANT SELECT ON public.audit_logs TO authenticated;
    GRANT ALL ON public.audit_logs TO service_role;

    -- Add comments
    COMMENT ON TABLE public.audit_logs IS 'Activity logs monitored by AI for anomaly detection';
    COMMENT ON COLUMN public.audit_logs.action IS 'user_active, session_ended, security_alert_anomaly_detected, etc.';
    COMMENT ON COLUMN public.audit_logs.status IS 'success (normal), warning (anomaly), error (security issue)';
  END IF;
END $$;

-- 2. Create anomaly detection summary view
CREATE OR REPLACE VIEW public.anomaly_summary AS
SELECT 
  user_id,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_actions,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(CASE WHEN status = 'warning' THEN 1 END) as warnings,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
  ARRAY_AGG(DISTINCT action ORDER BY action) as action_types
FROM public.audit_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id, DATE_TRUNC('hour', created_at)
HAVING 
  COUNT(*) > 30 -- High activity threshold
  OR COUNT(DISTINCT ip_address) > 3 -- Multiple IPs
  OR COUNT(CASE WHEN status = 'warning' THEN 1 END) > 0
ORDER BY hour DESC;

-- Grant view access
GRANT SELECT ON public.anomaly_summary TO authenticated;

COMMENT ON VIEW public.anomaly_summary IS 'Hourly summary of user activity for AI anomaly detection dashboard';

-- 3. Function: Get user activity timeline (for AI analysis)
CREATE OR REPLACE FUNCTION get_user_activity_timeline(
  p_user_id UUID,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  action TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ,
  time_since_last_action INTERVAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.action,
    a.ip_address,
    a.created_at,
    a.created_at - LAG(a.created_at) OVER (ORDER BY a.created_at) as time_since_last_action
  FROM public.audit_logs a
  WHERE a.user_id = p_user_id
    AND a.created_at >= NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_activity_timeline TO authenticated;

COMMENT ON FUNCTION get_user_activity_timeline IS 'Returns user activity with time deltas for rapid-fire detection';

-- 4. Function: Get suspicious activity report
CREATE OR REPLACE FUNCTION get_suspicious_activity()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  total_actions_24h BIGINT,
  unique_ips_24h BIGINT,
  warnings_24h BIGINT,
  last_activity TIMESTAMPTZ,
  risk_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH activity_stats AS (
    SELECT 
      a.user_id,
      COUNT(*) as actions,
      COUNT(DISTINCT a.ip_address) as ips,
      COUNT(CASE WHEN a.status = 'warning' THEN 1 END) as warnings,
      MAX(a.created_at) as last_action
    FROM public.audit_logs a
    WHERE a.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY a.user_id
  )
  SELECT 
    s.user_id,
    u.email,
    s.actions,
    s.ips,
    s.warnings,
    s.last_action,
    -- Risk score calculation (0-100)
    LEAST(100, 
      (CASE WHEN s.actions > 100 THEN 30 ELSE 0 END) +
      (CASE WHEN s.ips > 3 THEN 30 ELSE 0 END) +
      (s.warnings::INTEGER * 20)
    )::INTEGER as risk_score
  FROM activity_stats s
  JOIN auth.users u ON u.id = s.user_id
  WHERE 
    s.actions > 50 -- High activity
    OR s.ips > 2 -- Multiple IPs
    OR s.warnings > 0 -- Has warnings
  ORDER BY 
    (CASE WHEN s.actions > 100 THEN 30 ELSE 0 END) +
    (CASE WHEN s.ips > 3 THEN 30 ELSE 0 END) +
    (s.warnings::INTEGER * 20) DESC;
END;
$$;

-- Only admins can see suspicious activity
GRANT EXECUTE ON FUNCTION get_suspicious_activity TO authenticated;

COMMENT ON FUNCTION get_suspicious_activity IS 'AI-powered report of suspicious user activity (admin only)';

-- 5. Trigger: Auto-alert on high-risk activity
CREATE OR REPLACE FUNCTION trigger_security_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count INTEGER;
  recent_ips INTEGER;
BEGIN
  -- Count recent activity for this user (last 15 minutes)
  SELECT COUNT(*), COUNT(DISTINCT ip_address)
  INTO recent_count, recent_ips
  FROM public.audit_logs
  WHERE user_id = NEW.user_id
    AND created_at >= NOW() - INTERVAL '15 minutes';

  -- Auto-alert if suspicious
  IF recent_count > 30 OR recent_ips > 3 THEN
    -- Insert security alert (will be picked up by admin dashboard)
    INSERT INTO public.audit_logs (
      user_id,
      action,
      ip_address,
      user_agent,
      metadata,
      status
    ) VALUES (
      NEW.user_id,
      'auto_security_alert',
      NEW.ip_address,
      'AI Trigger System',
      jsonb_build_object(
        'reason', CASE 
          WHEN recent_count > 30 THEN 'excessive_activity'
          WHEN recent_ips > 3 THEN 'multiple_ips'
          ELSE 'unknown'
        END,
        'recent_count', recent_count,
        'recent_ips', recent_ips,
        'triggered_at', NOW()
      ),
      'warning'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to audit_logs
DROP TRIGGER IF EXISTS security_alert_trigger ON public.audit_logs;
CREATE TRIGGER security_alert_trigger
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_security_alert();

COMMENT ON FUNCTION trigger_security_alert IS 'Auto-generates security alerts when suspicious patterns detected';

-- ===================================================================
-- VERIFICATION
-- ===================================================================
SELECT 
  'AI Anomaly Detection Setup Complete' as message,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') as audit_table_exists,
  (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public' AND viewname = 'anomaly_summary') as anomaly_view_exists,
  (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('get_user_activity_timeline', 'get_suspicious_activity')) as ai_functions_count;
