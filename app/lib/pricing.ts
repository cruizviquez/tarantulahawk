// app/lib/pricing.ts
// Centralized pricing logic to keep pricing consistent across the app

export type Tier = {
  upto: number | null; // null means no upper bound (infinite)
  rate: number; // USD per transaction
};

// Pricing tiers:
// 1-2,000 => $1.00 c/u
// 2,001-5,000 => $0.75 c/u
// 5,001+ => $0.50 c/u
// Load pricing from config/pricing.json (single source of truth)
// tsconfig has resolveJsonModule enabled
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Next supports JSON imports at build time
import pricingConfig from '../../config/pricing.json';

export const PRICING_TIERS: Tier[] = Array.isArray(pricingConfig?.tiers)
  ? pricingConfig.tiers.map((t: any) => ({
      upto: t.upto === null ? null : Number(t.upto),
      rate: Number(t.rate),
    }))
  : [
      { upto: 2000, rate: 1.0 },
      { upto: 5000, rate: 0.75 },
      { upto: 10000, rate: 0.5 },
      { upto: null, rate: 0.35 },
    ];

export function calculateTieredCost(numTransactions: number): number {
  if (!Number.isFinite(numTransactions) || numTransactions <= 0) return 0;
  let remaining = Math.floor(numTransactions);
  let cost = 0;
  let prevLimit = 0;

  for (const tier of PRICING_TIERS) {
    const isInfinite = tier.upto === null;
    const limit = isInfinite ? Number.POSITIVE_INFINITY : (tier.upto as number);
    const tierSize = Math.min(remaining, isInfinite ? remaining : (limit - prevLimit));
    if (tierSize <= 0) break;
    cost += tierSize * tier.rate;
    remaining -= tierSize;
    prevLimit = isInfinite ? prevLimit + tierSize : limit;
    if (remaining <= 0) break;
  }
  return cost;
}

export function formatPricingSummary(language: 'es' | 'en' = 'es'): string[] {
  const fmt = new Intl.NumberFormat('en-US');
  const lines: string[] = [];
  let prev = 0;
  for (const tier of PRICING_TIERS) {
    const label = tier.upto === null
      ? `${fmt.format(prev + 1)}+`
      : `${fmt.format(prev + 1)}-${fmt.format(tier.upto)}`;
    const rate = `$${tier.rate.toFixed(2)}`;
    lines.push(
      language === 'es'
        ? `${label} transacciones: ${rate} c/u`
        : `${label} transactions: ${rate} each`
    );
    if (tier.upto !== null) prev = tier.upto;
  }
  return lines;
}
