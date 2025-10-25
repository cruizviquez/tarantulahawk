import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token as string | undefined;
    if (!token) {
      return NextResponse.json({ success: false, error: 'missing-token' }, { status: 400 });
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ success: false, error: 'server-misconfigured' }, { status: 500 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    const json = (await resp.json()) as { success: boolean; "error-codes"?: string[] };
    if (!json.success) {
      return NextResponse.json({ success: false, errors: json["error-codes"] || [] }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'verify-failed' }, { status: 500 });
  }
}
