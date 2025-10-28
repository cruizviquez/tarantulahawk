import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/app/lib/api-auth';
import { PRICING_TIERS } from '@/app/lib/pricing';
import { promises as fs } from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pricingConfig from '@/config/pricing.json';

function isAdmin(userId: string | null): boolean {
  if (!userId) return false;
  const list = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.includes(userId);
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    ok: true,
    pricing: pricingConfig,
    normalizedTiers: PRICING_TIERS,
  });
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    // Basic validation
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const currency = typeof body.currency === 'string' ? body.currency : 'USD';
    const tiers = Array.isArray(body.tiers) ? body.tiers : null;
    if (!tiers || tiers.length === 0) {
      return NextResponse.json({ error: 'tiers required' }, { status: 400 });
    }
    for (const t of tiers) {
      if (!('rate' in t)) return NextResponse.json({ error: 'each tier must include rate' }, { status: 400 });
      if (!('upto' in t)) return NextResponse.json({ error: 'each tier must include upto (or null)' }, { status: 400 });
      if (t.upto !== null && (!Number.isFinite(Number(t.upto)) || Number(t.upto) <= 0)) {
        return NextResponse.json({ error: 'upto must be a positive number or null' }, { status: 400 });
      }
      if (!Number.isFinite(Number(t.rate)) || Number(t.rate) < 0) {
        return NextResponse.json({ error: 'rate must be a non-negative number' }, { status: 400 });
      }
    }

    const repoRoot = path.join(process.cwd());
    const configPath = path.join(repoRoot, 'config', 'pricing.json');
    const payload = JSON.stringify({ currency, tiers }, null, 2) + '\n';
    await fs.writeFile(configPath, payload, 'utf-8');

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed-to-update-pricing' }, { status: 500 });
  }
}
