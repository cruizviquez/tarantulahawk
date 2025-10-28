-- Add user information columns to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT;

-- Create index for company searches
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company);

-- Comment columns
COMMENT ON COLUMN profiles.name IS 'Full name of the user from registration';
COMMENT ON COLUMN profiles.company IS 'Company/organization name from registration (required field)';
