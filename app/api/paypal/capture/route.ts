import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/app/lib/supabaseServer';
import { validateAuth } from '@/app/lib/api-auth-helpers';
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

    // Resolve current user from auth
    const auth = await validateAuth(req);
    if (auth.error || !auth.user.id) {
      return NextResponse.json({ ok: false, error: 'no-auth' }, { status: 401 });
    }
    const userId = auth.user.id;

    const supa = getServiceSupabase();

    // Convert payment amount to USD credits (1:1 ratio, e.g., $15 = $15 credits)
    const creditsToAdd = parseFloat(amount);
    
    // Call add_credits function
    const { data: creditResult, error: creditError } = await supa.rpc('add_credits', {
      p_user_id: userId,
      p_amount: creditsToAdd,
      p_transaction_type: 'credit_purchase',
      p_description: `PayPal purchase: Order ${orderID}`,
      p_metadata: { provider: 'paypal', orderID, amount, currency: curr }
    });

    if (creditError || !creditResult?.[0]?.success) {
      console.error('Failed to add credits:', creditError);
      return NextResponse.json({ 
        ok: false, 
        error: 'credit-add-failed',
        details: creditError?.message || creditResult?.[0]?.message 
      }, { status: 500 });
    }

    const newBalance = creditResult[0].new_balance;

    // Audit log
    await logAuditEvent({
      user_id: userId,
      action: 'credits_purchased',
      status: 'success',
      metadata: { 
        provider: 'paypal', 
        orderID, 
        amount_paid: amount, 
        currency: curr,
        credits_added: creditsToAdd,
        new_balance: newBalance
      },
    });

    return NextResponse.json({ 
      ok: true, 
      creditsAdded: creditsToAdd,
      newBalance: newBalance
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown-error' }, { status: 500 });
  }
}
