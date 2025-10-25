import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/app/lib/supabaseServer';

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const supa = getServiceSupabase();
    const { data: userData, error: userErr } = await supa.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'invalid-auth' }, { status: 401 });
    }

    const userId = userData.user.id;
    const { data, error } = await supa
      .from('profiles')
      .select('subscription_tier, free_reports_used, max_free_reports, tx_used_free, tx_limit_free')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'profile-not-found' }, { status: 404 });
    }

    const freeReportsRemaining = Math.max((data.max_free_reports ?? 0) - (data.free_reports_used ?? 0), 0);
    const txRemaining = Math.max((data.tx_limit_free ?? 0) - (data.tx_used_free ?? 0), 0);
    const freeExceeded = freeReportsRemaining <= 0 || txRemaining <= 0;

    return NextResponse.json({
      ok: true,
      subscription_tier: data.subscription_tier,
      freeReportsUsed: data.free_reports_used,
      maxFreeReports: data.max_free_reports,
      txUsedFree: data.tx_used_free,
      txLimitFree: data.tx_limit_free,
      freeReportsRemaining,
      txRemaining,
      freeExceeded,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'usage-error' }, { status: 500 });
  }
}
