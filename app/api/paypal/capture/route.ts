import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/app/lib/supabaseServer';
import { logAuditEvent } from '@/app/lib/audit-log';

function getPaypalApiBase() {
  const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  return env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getPaypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('PayPal credentials not configured');

  const base = getPaypalApiBase();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get PayPal token: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

export async function POST(req: NextRequest) {
  try {
    const { orderID, expectedAmount = '15.00', currency = 'USD' } = await req.json();
    if (!orderID) {
      return NextResponse.json({ ok: false, error: 'missing-orderID' }, { status: 400 });
    }

    const token = await getPaypalAccessToken();
    const base = getPaypalApiBase();

    // Retrieve order details
    const orderRes = await fetch(`${base}/v2/checkout/orders/${orderID}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!orderRes.ok) {
      const text = await orderRes.text();
      return NextResponse.json({ ok: false, error: `paypal-order-fetch-failed: ${text}` }, { status: 400 });
    }
    const order = await orderRes.json();

    const status = order?.status;
    const amount = order?.purchase_units?.[0]?.amount?.value;
    const curr = order?.purchase_units?.[0]?.amount?.currency_code;

    if (status !== 'COMPLETED') {
      return NextResponse.json({ ok: false, error: `order-not-completed: ${status}` }, { status: 400 });
    }
    if (amount !== expectedAmount || curr !== currency) {
      return NextResponse.json({ ok: false, error: 'amount-mismatch', amount, currency: curr }, { status: 400 });
    }

    // Resolve current user from Supabase auth cookie
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: 'no-auth' }, { status: 401 });
    }
    const supa = getServiceSupabase();
    const { data: userData, error: userErr } = await supa.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'invalid-auth' }, { status: 401 });
    }

    const userId = userData.user.id;

    // Update subscription server-side
    const { error: upErr } = await supa
      .from('profiles')
      .update({ subscription_tier: 'paid' })
      .eq('id', userId);
    if (upErr) {
      return NextResponse.json({ ok: false, error: 'db-update-failed' }, { status: 500 });
    }

    // Audit log
    await logAuditEvent({
      user_id: userId,
      action: 'account_upgraded',
      status: 'success',
      metadata: { provider: 'paypal', orderID, amount, currency: curr },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown-error' }, { status: 500 });
  }
}
