import { NextRequest, NextResponse } from 'next/server';
import { extractUserIdFromRequest, canCreateReport, markFreeReportUsed } from '@/app/lib/accessControl';
import { getServiceSupabase } from '@/app/lib/supabaseServer';
import { logAuditEvent } from '@/app/lib/audit-log';

export async function POST(req: NextRequest) {
  try {
    const userId = extractUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const transactions: any[] = Array.isArray(body?.transactions) ? body.transactions : [];
    const transactionCount: number = body?.transactionCount ?? transactions.length;

    // Enforce pay-as-you-go policy
    const check = await canCreateReport(userId, transactionCount);
    if (!check.allowed) {
      const status = check.paymentRequired ? 402 : 400; // 402 Payment Required if out of freebies
      return NextResponse.json(
        {
          error: check.paymentRequired ? 'Payment required' : 'Limit exceeded',
          reason: check.reason,
          freeReportsUsed: check.freeReportsUsed,
          maxFreeReports: check.maxFreeReports,
          txLimitFree: check.txLimitFree,
          payUrl: check.paymentRequired ? '/pay' : undefined,
        },
        { status }
      );
    }

    // TODO: Implement real report creation logic here
    // For now, simulate a report ID and success
    const reportId = `rep_${Math.random().toString(36).slice(2)}`;

    // If on free tier, consume one free report
    const supabase = getServiceSupabase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (!profile || profile.subscription_tier === 'free') {
      await markFreeReportUsed(userId, transactionCount);
    }

    await logAuditEvent({
      user_id: userId,
      action: 'report_generated',
      metadata: { transactionCount, mode: 'api' },
      resource_id: reportId,
      resource_type: 'report',
    });

    return NextResponse.json({ reportId, status: 'ok' }, { status: 200 });
  } catch (err: any) {
    console.error('Report creation error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
