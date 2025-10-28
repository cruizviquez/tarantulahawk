-- Migration: Roles (client/auditor/admin) and auditor-client mapping

-- 1) Add role column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('client','auditor','admin')) DEFAULT 'client';

-- Backfill: map existing admin
UPDATE public.profiles
SET role = 'admin'
WHERE subscription_tier = 'admin';

COMMENT ON COLUMN public.profiles.role IS 'Access role: client (default), auditor (read-only per assigned clients), admin (full access)';

-- 2) Auditor-Client mapping table
CREATE TABLE IF NOT EXISTS public.auditor_client_access (
  auditor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view_financials BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (auditor_id, client_id)
);

ALTER TABLE public.auditor_client_access ENABLE ROW LEVEL SECURITY;

-- Helper to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.role = 'admin'
  );
$$;

-- RLS: auditors can see their own mappings
CREATE POLICY "Auditors see their mappings"
ON public.auditor_client_access
FOR SELECT
TO authenticated
USING (auditor_id = auth.uid());

-- RLS: admins can manage all mappings
CREATE POLICY "Admins manage mappings"
ON public.auditor_client_access
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3) Extend transaction_history RLS to allow auditors and admins
-- Existing policy: users can view own transaction history (kept)
-- Add: auditors can view assigned clients
CREATE POLICY "Auditors can view assigned clients' history"
ON public.transaction_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.auditor_client_access a
    WHERE a.auditor_id = auth.uid()
      AND a.client_id = user_id
  )
);

-- Add: admins can view all
CREATE POLICY "Admins can view all transaction history"
ON public.transaction_history
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
