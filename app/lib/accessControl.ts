import type { NextRequest } from 'next/server';
import { getServiceSupabase } from './supabaseServer';
import { logAuditEvent } from './audit-log';

export interface PaywallCheck {
  allowed: boolean;
  paymentRequired: boolean;
  reason?: string;
  maxFreeReports?: number;
  freeReportsUsed?: number;
  txLimitFree?: number;
  txUsedFree?: number;
}

export function extractUserIdFromRequest(req: NextRequest): string | null {
  // Supabase sets sb-access-token cookie. We decode the JWT payload to get sub (user id).
  try {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (!cookie) return null;
    const payload = JSON.parse(Buffer.from(cookie.split('.')[1], 'base64').toString('utf8'));
    return payload?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Enforce pay-as-you-go limits: first 3 reports free, up to 1,500 TOTAL transactions across all free reports.
 */
export async function canCreateReport(userId: string, transactionCount: number): Promise<PaywallCheck> {
  const supabase = getServiceSupabase();

  // Fetch profile
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, subscription_tier, free_reports_used, max_free_reports, tx_limit_free, tx_used_free')
    .eq('id', userId)
    .limit(1);

  if (error || !profiles || profiles.length === 0) {
    return { allowed: false, paymentRequired: true, reason: 'No profile found' };
  }

  const profile = profiles[0] as any;
  const tier = profile.subscription_tier || 'free';
  const used = Number(profile.free_reports_used ?? 0);
  const maxFree = Number(profile.max_free_reports ?? 3);
  const txLimit = Number(profile.tx_limit_free ?? 1500); // Total across all free reports
  const txUsed = Number(profile.tx_used_free ?? 0);

  if (tier === 'paid' || tier === 'enterprise') {
    return { allowed: true, paymentRequired: false };
  }

  // Free tier checks: max 3 reports AND max 1,500 total transactions
  if (used >= maxFree) {
    return {
      allowed: false,
      paymentRequired: true,
      reason: 'Free report limit reached (3 reports maximum)',
      freeReportsUsed: used,
      maxFreeReports: maxFree,
      txLimitFree: txLimit,
      txUsedFree: txUsed,
    };
  }

  // Check if adding this report would exceed total transaction limit
  if (txUsed + transactionCount > txLimit) {
    return {
      allowed: false,
      paymentRequired: true,
      reason: `Total transaction limit exceeded (${txUsed + transactionCount} > ${txLimit}). Payment required to continue.`,
      freeReportsUsed: used,
      maxFreeReports: maxFree,
      txLimitFree: txLimit,
      txUsedFree: txUsed,
    };
  }

  return {
    allowed: true,
    paymentRequired: false,
    freeReportsUsed: used,
    maxFreeReports: maxFree,
    txLimitFree: txLimit,
    txUsedFree: txUsed,
  };
}

/**
 * Increment the user's used free report count and transaction count after a successful creation.
 */
export async function markFreeReportUsed(userId: string, transactionCount: number): Promise<void> {
  const supabase = getServiceSupabase();
  // Increment free_reports_used and tx_used_free
  await supabase.rpc('increment_free_reports_used', { p_user_id: userId });
  await supabase.rpc('increment_tx_used_free', { p_user_id: userId, tx_count: transactionCount });

  await logAuditEvent({
    user_id: userId,
    action: 'report_generated',
    metadata: { plan: 'free', source: 'api', free_report_consumed: true, transaction_count: transactionCount },
  });
}
