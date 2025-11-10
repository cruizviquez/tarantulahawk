import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/app/lib/supabaseServer';
import { validateAuth } from '@/app/lib/api-auth-helpers';
import { calculateTieredCost, PRICING_TIERS } from '@/app/lib/pricing';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pricingConfig from '@/config/pricing.json';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateAuth(req);
    if (auth.error || !auth.user.id) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }
    const userId = auth.user.id;

    const supa = getServiceSupabase();
    const { data, error } = await supa
      .from('profiles')
      .select('subscription_tier, account_balance_usd')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'profile-not-found' }, { status: 404 });
    }

    // Optional estimate if client passes ?transactions=12345
    const url = new URL(req.url);
    const transactionsParam = url.searchParams.get('transactions');
    const txCount = transactionsParam ? Number(transactionsParam) : undefined;
    const estimateUsd = txCount && Number.isFinite(txCount) && txCount > 0
      ? calculateTieredCost(Math.floor(txCount))
      : undefined;

    return NextResponse.json({
      ok: true,
      subscription_tier: data.subscription_tier,
      balanceUsd: data.account_balance_usd ?? 0,
      currency: pricingConfig?.currency || 'USD',
      pricingTiers: PRICING_TIERS,
      estimate: estimateUsd ? { transactions: Math.floor(txCount as number), costUsd: estimateUsd } : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'usage-error' }, { status: 500 });
  }
}
