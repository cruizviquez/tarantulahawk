-- Add Pay-As-You-Go columns to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS free_reports_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_free_reports INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS tx_limit_free INTEGER DEFAULT 500;

-- Increment function for free_reports_used
CREATE OR REPLACE FUNCTION increment_free_reports_used(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET free_reports_used = COALESCE(free_reports_used, 0) + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_profiles_free_reports ON profiles(free_reports_used);
