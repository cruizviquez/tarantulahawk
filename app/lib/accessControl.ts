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
 * Enforce pay-as-you-go limits: first 3 reports free, up to 500 transactions per free report.
 */
export async function canCreateReport(userId: string, transactionCount: number): Promise<PaywallCheck> {
  const supabase = getServiceSupabase();

  // Fetch profile
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, subscription_tier, free_reports_used, max_free_reports, tx_limit_free')
    .eq('id', userId)
    .limit(1);

  if (error || !profiles || profiles.length === 0) {
    return { allowed: false, paymentRequired: true, reason: 'No profile found' };
  }

  const profile = profiles[0] as any;
  const tier = profile.subscription_tier || 'free';
  const used = Number(profile.free_reports_used ?? 0);
  const maxFree = Number(profile.max_free_reports ?? 3);
  const txLimit = Number(profile.tx_limit_free ?? 500);

  if (tier === 'paid' || tier === 'enterprise') {
    return { allowed: true, paymentRequired: false };
  }

  // Free tier checks
  if (used >= maxFree) {
    return {
      allowed: false,
      paymentRequired: true,
      reason: 'Free report limit reached',
      freeReportsUsed: used,
      maxFreeReports: maxFree,
      txLimitFree: txLimit,
    };
  }

  if (transactionCount > txLimit) {
    return {
      allowed: false,
      paymentRequired: false,
      reason: `Transaction limit exceeded (${transactionCount} > ${txLimit})`,
      freeReportsUsed: used,
      maxFreeReports: maxFree,
      txLimitFree: txLimit,
    };
  }

  return {
    allowed: true,
    paymentRequired: false,
    freeReportsUsed: used,
    maxFreeReports: maxFree,
    txLimitFree: txLimit,
  };
}

/**
 * Increment the user's used free report count after a successful creation.
 */
export async function markFreeReportUsed(userId: string): Promise<void> {
  const supabase = getServiceSupabase();
  // Increment free_reports_used
  await supabase.rpc('increment_free_reports_used', { p_user_id: userId });

  await logAuditEvent({
    user_id: userId,
    action: 'report_generated',
    metadata: { plan: 'free', source: 'api', free_report_consumed: true },
  });
}
