-- Migration: Add credit-based system to replace transaction limits
-- Replace free_reports_used/max_free_reports/tx_limit_free/tx_used_free with account_balance_usd

-- Step 1: Add new columns for USD credit balance
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_balance_usd DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS credits_gifted DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS credits_purchased DECIMAL(10,2) DEFAULT 0.00;

-- Update account_balance_usd to be computed column (gifted + purchased)
COMMENT ON COLUMN public.profiles.account_balance_usd IS 'Total balance = credits_gifted + credits_purchased';
COMMENT ON COLUMN public.profiles.credits_gifted IS 'Virtual credits (not refundable, given by platform)';
COMMENT ON COLUMN public.profiles.credits_purchased IS 'Purchased credits (refundable per policy, paid by user)';

-- Step 2: Migrate existing free tier users to $500 initial GIFTED credit
-- (Existing users in 'free' tier get $500 in GIFTED credits, others keep 0)
-- IMPORTANT: These are VIRTUAL credits, NOT real money. Do NOT link to PayPal refunds.
UPDATE public.profiles
SET credits_gifted = 500.00,
    account_balance_usd = 500.00
WHERE subscription_tier = 'free'
  AND credits_gifted = 0
  AND credits_purchased = 0;

-- Step 3: Add transaction history table for auditing
CREATE TABLE IF NOT EXISTS public.transaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('aml_report', 'api_call', 'credit_purchase', 'credit_gift', 'credit_adjustment', 'refund')),
  amount_usd DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  credit_source TEXT CHECK (credit_source IN ('gifted', 'purchased', 'mixed')),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN public.transaction_history.credit_source IS 'Source of credits used: gifted (virtual), purchased (paid), or mixed';

-- Step 4: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_history_user_id ON public.transaction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_history_created_at ON public.transaction_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_history_type ON public.transaction_history(transaction_type);

-- Step 5: RLS policies for transaction_history
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own transaction history
CREATE POLICY "Users can view own transaction history"
ON public.transaction_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role can insert transaction records
CREATE POLICY "Service role can insert transactions"
ON public.transaction_history
FOR INSERT
TO service_role
WITH CHECK (true);

-- Step 6: Function to deduct credits safely (atomic operation)
-- Prioritizes purchased credits first, then gifted credits
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount DECIMAL,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance DECIMAL,
  transaction_id UUID,
  message TEXT,
  credit_source TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchased DECIMAL;
  v_gifted DECIMAL;
  v_total_balance DECIMAL;
  v_new_balance DECIMAL;
  v_transaction_id UUID;
  v_from_purchased DECIMAL;
  v_from_gifted DECIMAL;
  v_source TEXT;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT credits_purchased, credits_gifted, account_balance_usd 
  INTO v_purchased, v_gifted, v_total_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0.00, NULL::UUID, 'User not found'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if sufficient balance
  IF v_total_balance < p_amount THEN
    RETURN QUERY SELECT false, v_total_balance, NULL::UUID, 
      format('Insufficient balance. Current: $%.2f, Required: $%.2f', v_total_balance, p_amount)::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Deduct from purchased credits first, then from gifted
  v_from_purchased := LEAST(v_purchased, p_amount);
  v_from_gifted := p_amount - v_from_purchased;
  
  -- Determine source
  IF v_from_purchased > 0 AND v_from_gifted > 0 THEN
    v_source := 'mixed';
  ELSIF v_from_purchased > 0 THEN
    v_source := 'purchased';
  ELSE
    v_source := 'gifted';
  END IF;

  -- Calculate new balance
  v_new_balance := v_total_balance - p_amount;

  -- Update profile balance
  UPDATE public.profiles
  SET credits_purchased = v_purchased - v_from_purchased,
      credits_gifted = v_gifted - v_from_gifted,
      account_balance_usd = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  -- Insert transaction record
  INSERT INTO public.transaction_history (
    user_id, transaction_type, amount_usd, balance_before, balance_after, 
    credit_source, description, metadata
  ) VALUES (
    p_user_id, p_transaction_type, p_amount, v_total_balance, v_new_balance, 
    v_source, p_description, p_metadata
  )
  RETURNING id INTO v_transaction_id;

  -- Return success
  RETURN QUERY SELECT true, v_new_balance, v_transaction_id, 
    format('Successfully deducted $%.2f (%s credits). New balance: $%.2f', 
           p_amount, v_source, v_new_balance)::TEXT,
    v_source;
END;
$$;

-- Step 7: Function to add credits (for purchases/refunds)
-- Always adds to 'purchased' credits (except for credit_gift type)
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount DECIMAL,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance DECIMAL,
  transaction_id UUID,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
  v_transaction_id UUID;
  v_is_gift BOOLEAN;
BEGIN
  -- Determine if this is a gift (virtual credit) or purchase
  v_is_gift := (p_transaction_type = 'credit_gift');

  -- Lock the row
  SELECT account_balance_usd INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0.00, NULL::UUID, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Update appropriate credit column
  IF v_is_gift THEN
    UPDATE public.profiles
    SET credits_gifted = credits_gifted + p_amount,
        account_balance_usd = v_new_balance,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET credits_purchased = credits_purchased + p_amount,
        account_balance_usd = v_new_balance,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Insert transaction record
  INSERT INTO public.transaction_history (
    user_id, transaction_type, amount_usd, balance_before, balance_after, 
    credit_source, description, metadata
  ) VALUES (
    p_user_id, p_transaction_type, p_amount, v_current_balance, v_new_balance,
    CASE WHEN v_is_gift THEN 'gifted' ELSE 'purchased' END,
    p_description, p_metadata
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id, 
    format('Successfully added $%.2f (%s). New balance: $%.2f', 
           p_amount, 
           CASE WHEN v_is_gift THEN 'gifted' ELSE 'purchased' END,
           v_new_balance)::TEXT;
END;
$$;

-- Step 8: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.deduct_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits TO service_role;

-- Step 9: Comment old columns (keep for backwards compatibility, will remove later)
COMMENT ON COLUMN public.profiles.free_reports_used IS 'DEPRECATED: Use account_balance_usd instead';
COMMENT ON COLUMN public.profiles.max_free_reports IS 'DEPRECATED: Use account_balance_usd instead';
COMMENT ON COLUMN public.profiles.tx_limit_free IS 'DEPRECATED: Use account_balance_usd instead';
COMMENT ON COLUMN public.profiles.tx_used_free IS 'DEPRECATED: Use account_balance_usd instead';
