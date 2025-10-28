import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side authentication check for API routes
 * Returns user ID if authenticated, null otherwise
 */
export async function getAuthenticatedUserId(request?: NextRequest): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (e) {
    console.error('Auth check error:', e);
    return null;
  }
}

/**
 * Verify user has sufficient balance for operation
 */
export async function checkUserBalance(userId: string, requiredAmount: number): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('account_balance_usd')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return false;
    }

    return profile.account_balance_usd >= requiredAmount;
  } catch (e) {
    console.error('Balance check error:', e);
    return false;
  }
}

/**
 * Deduct balance from user account (for ML analysis usage)
 */
export async function deductBalance(userId: string, amount: number): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // Get current balance
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('account_balance_usd')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      return false;
    }

    const newBalance = profile.account_balance_usd - amount;
    if (newBalance < 0) {
      return false; // Insufficient funds
    }

    // Update balance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ account_balance_usd: newBalance })
      .eq('id', userId);

    return !updateError;
  } catch (e) {
    console.error('Deduct balance error:', e);
    return false;
  }
}

/**
 * Log audit event for compliance (LFPIORPI)
 */
export async function logAuditEvent(
  userId: string,
  action: string,
  metadata?: Record<string, any>,
  resourceId?: string,
  resourceType?: string,
  status: 'success' | 'failure' | 'pending' = 'success'
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) return;

    await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: userId,
        action,
        metadata: metadata || {},
        resource_id: resourceId,
        resource_type: resourceType,
        status,
        ip_address: 'unknown', // Can be enhanced with actual IP
        user_agent: 'api',
      }),
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
}
