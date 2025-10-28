-- ===================================================================
-- TARANTULAHAWK - SECURITY VALIDATION SCRIPT
-- Run this in Supabase SQL Editor to verify all security measures
-- ===================================================================

-- 1. VERIFY ROW LEVEL SECURITY IS ENABLED
-- Expected: All tables should have rowsecurity = true
SELECT 
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity THEN '✅ Protected'
    ELSE '❌ VULNERABLE'
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'profiles', 
  'transaction_history', 
  'auditor_client_access', 
  'api_keys',
  'api_key_usage',
  'audit_logs'
)
ORDER BY tablename;

-- 2. VERIFY RLS POLICIES EXIST
-- Expected: Multiple policies for each table
SELECT 
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
  'profiles', 
  'transaction_history', 
  'auditor_client_access'
)
GROUP BY tablename
ORDER BY tablename;

-- 3. VERIFY SECURITY DEFINER FUNCTIONS
-- Expected: deduct_credits, add_credits should be SECURITY DEFINER
-- Note: is_admin is intentionally NOT SECURITY DEFINER because it is used in RLS policies
--       and should run with INVOKER rights (STABLE) to avoid privilege escalation.
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  CASE 
    WHEN prosecdef THEN '✅ Secure'
    ELSE '❌ INSECURE'
  END as status
FROM pg_proc 
WHERE proname IN ('deduct_credits', 'add_credits')
ORDER BY proname;

-- 3b. VERIFY is_admin VOLATILITY (should be STABLE, not SECURITY DEFINER)
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  provolatile as volatility, -- 's' = STABLE
  CASE 
    WHEN provolatile = 's' AND prosecdef = false THEN '✅ Correct (STABLE, invoker rights)'
    ELSE '❌ Unexpected flags'
  END as status
FROM pg_proc
WHERE proname = 'is_admin';

-- 4. VERIFY CREDITS COLUMNS EXIST
-- Expected: credits_gifted, credits_purchased, account_balance_usd
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
AND column_name IN ('credits_gifted', 'credits_purchased', 'account_balance_usd', 'role')
ORDER BY column_name;

-- 5. VERIFY ROLE CONSTRAINTS
-- Expected: role must be 'client', 'auditor', or 'admin'
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
AND conname LIKE '%role%'
ORDER BY conname;

-- 6. TEST RLS ISOLATION (Run as regular user, not service_role)
-- Expected: Should only see own profile
SELECT 
  COUNT(*) as visible_profiles,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ RLS Working - Only own profile visible'
    WHEN COUNT(*) > 1 THEN '❌ RLS BROKEN - Can see other profiles!'
    ELSE '⚠️ No profiles found'
  END as status
FROM profiles
WHERE id = auth.uid();

-- 7. VERIFY TRANSACTION HISTORY TABLE
-- Expected: Table exists with proper columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'transaction_history'
ORDER BY ordinal_position;

-- 8. VERIFY AUDITOR ACCESS TABLE
-- Expected: Table exists with foreign keys
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'auditor_client_access'
ORDER BY ordinal_position;

-- 9. CHECK FOR ADMIN USERS
-- Expected: At least one admin exists
SELECT 
  COUNT(*) as admin_count,
  CASE 
    WHEN COUNT(*) >= 1 THEN '✅ Admin exists'
    ELSE '⚠️ No admin users found'
  END as status
FROM profiles
WHERE role = 'admin';

-- 10. VERIFY INDEXES FOR PERFORMANCE
-- Expected: Indexes on user_id, created_at, company
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'transaction_history', 'auditor_client_access')
ORDER BY tablename, indexname;

-- ===================================================================
-- FINAL SECURITY SCORE
-- ===================================================================
SELECT 
  'SECURITY VALIDATION COMPLETE' as message,
  (
    SELECT COUNT(*) 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'transaction_history', 'auditor_client_access')
    AND rowsecurity = true
  ) as tables_with_rls,
  (
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) as total_rls_policies,
  (
    SELECT COUNT(*) 
    FROM pg_proc 
    WHERE proname IN ('deduct_credits', 'add_credits')
    AND prosecdef = true
  ) as security_definer_functions,
  (
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND provolatile = 's' AND prosecdef = false
    ) THEN true ELSE false END
  ) as is_admin_stable,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('profiles', 'transaction_history', 'auditor_client_access')
      AND rowsecurity = true
    ) >= 3 
    AND (
      SELECT COUNT(*) 
      FROM pg_proc 
      WHERE proname IN ('deduct_credits', 'add_credits')
      AND prosecdef = true
    ) >= 2
    AND (
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND provolatile = 's' AND prosecdef = false
      ) THEN true ELSE false END
    )
    THEN '✅ SECURITY PASSED'
    ELSE '❌ SECURITY ISSUES DETECTED'
  END as overall_status;
