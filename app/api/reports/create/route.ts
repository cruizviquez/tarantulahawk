import { NextRequest, NextResponse } from 'next/server';
import { calculateTieredCost } from '@/app/lib/pricing';
import { getAuthenticatedUserId, checkUserBalance, deductBalance, logAuditEvent } from '@/app/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const transactions: any[] = Array.isArray(body?.transactions) ? body.transactions : [];
    const transactionCount: number = body?.transactionCount ?? transactions.length;

    // Calculate cost using unified tiered pricing
    const costUsd = calculateTieredCost(Number(transactionCount || 0));
    if (costUsd <= 0) {
      return NextResponse.json({ error: 'Invalid transaction count' }, { status: 400 });
    }

    // Verify sufficient balance
    const hasBalance = await checkUserBalance(userId, costUsd);
    if (!hasBalance) {
      return NextResponse.json(
        {
          error: 'Payment required',
          paymentRequired: true,
          reason: 'Insufficient balance for requested analysis',
          requiredAmount: costUsd,
          payUrl: '/pay',
        },
        { status: 402 }
      );
    }

    // TODO: Implement real report creation logic here
    // For now, simulate a report ID and success
    const reportId = `rep_${Math.random().toString(36).slice(2)}`;

    // Deduct balance immediately on report creation
    await deductBalance(userId, costUsd);

    await logAuditEvent(
      userId,
      'report_generated',
      { transactionCount, mode: 'api', cost_usd: costUsd },
      reportId,
      'report',
      'success'
    );

    return NextResponse.json({ reportId, status: 'ok', costUsd }, { status: 200 });
  } catch (err: any) {
    console.error('Report creation error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
