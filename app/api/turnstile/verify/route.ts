import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token as string | undefined;
    if (!token) {
      return NextResponse.json({ success: false, error: 'missing-token' }, { status: 400 });
    }

    // Prefer real secret; in development fall back to Cloudflare test secret to avoid setup blockers
    const secret =
      process.env.TURNSTILE_SECRET_KEY ||
      (process.env.NODE_ENV !== 'production' ? '1x0000000000000000000000000000000AA' : undefined);
    if (!secret) {
      return NextResponse.json({ success: false, error: 'server-misconfigured: missing TURNSTILE_SECRET_KEY' }, { status: 500 });
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

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: 'turnstile-upstream-error', status: resp.status, body: text?.slice(0, 200) },
        { status: 502 }
      );
    }

    const json = (await resp.json()) as { success: boolean; "error-codes"?: string[] };
    if (!json.success) {
      return NextResponse.json({ success: false, errors: json["error-codes"] || [] }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'verify-failed' }, { status: 500 });
  }
}
