# Pricing System - Setup Guide

## Overview

TarantulaHawk now uses a **centralized, config-driven pricing system** that eliminates code changes when adjusting prices. All pricing logic reads from a single JSON configuration file.

## Pricing Structure

Current tiers (defined in `config/pricing.json`):

- **1-2,000 transactions**: $1.00 per transaction
- **2,001-5,000 transactions**: $0.75 per transaction
- **5,001-10,000 transactions**: $0.50 per transaction
- **10,001+ transactions**: $0.35 per transaction

## Architecture

### Single Source of Truth

**File**: `config/pricing.json`

```json
{
  "currency": "USD",
  "tiers": [
    { "upto": 2000, "rate": 1.0 },
    { "upto": 5000, "rate": 0.75 },
    { "upto": 10000, "rate": 0.5 },
    { "upto": null, "rate": 0.35 }
  ]
}
```

### Frontend (TypeScript)

**File**: `app/lib/pricing.ts`

- Imports `config/pricing.json` at build time
- Exports:
  - `PRICING_TIERS` - normalized tier array
  - `calculateTieredCost(numTransactions)` - cost calculation
  - `formatPricingSummary(language)` - UI-ready pricing labels

**Used by**:
- `app/components/complete_portal_ui.tsx` - displays pricing, estimates costs on file upload
- `app/api/reports/create/route.ts` - calculates cost, checks balance, deducts on success
- `app/api/usage/route.ts` - returns pricing tiers and optional cost estimates

### Backend (Python)

**File**: `app/backend/api/utils/pricing_tiers.py`

- Loads `config/pricing.json` at runtime
- Falls back to hardcoded defaults if file missing
- `PricingTier.calculate_cost(num_transactions)` - main calculation method
- `PricingTier.get_rate_breakdown()` - detailed tier breakdown

**Used by**:
- `app/backend/api/enhanced_main_api.py` - FastAPI cost calculation with config loader fallback

## Admin Management

### Admin API

**Endpoints**: `app/api/admin/pricing/route.ts`

- `GET /api/admin/pricing` - View current pricing configuration
- `PUT /api/admin/pricing` - Update pricing (admin-only)

**Access Control**:
Set environment variable with comma-separated Supabase user IDs:
```bash
ADMIN_USER_IDS=uuid1,uuid2,uuid3
```

### Admin UI

**URL**: `/admin/pricing`

**File**: `app/admin/pricing/page.tsx`

Features:
- View current pricing tiers
- Add/remove/edit tiers via web form
- Live preview of pricing structure
- JSON display of current config
- Validation before save
- Access restricted to admin users

## How to Change Pricing

### Method 1: Direct File Edit (Simple)

1. Edit `config/pricing.json`
2. Update `tiers` array
3. Restart Next.js dev server (frontend picks up changes at build time)
4. Restart Python backend (if running)

Example - adding a new tier:
```json
{
  "currency": "USD",
  "tiers": [
    { "upto": 1000, "rate": 1.25 },
    { "upto": 2000, "rate": 1.0 },
    { "upto": 5000, "rate": 0.75 },
    { "upto": 10000, "rate": 0.5 },
    { "upto": null, "rate": 0.35 }
  ]
}
```

### Method 2: Admin UI (Recommended)

1. Set `ADMIN_USER_IDS` environment variable
2. Log in as admin user
3. Navigate to `/admin/pricing`
4. Edit tiers in web form
5. Click "Guardar Cambios"
6. **Important**: Restart app to load new config

### Method 3: Admin API (Programmatic)

```bash
# View current pricing
curl -X GET https://your-domain.com/api/admin/pricing \
  -H "Cookie: sb-access-token=YOUR_TOKEN"

# Update pricing
curl -X PUT https://your-domain.com/api/admin/pricing \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD",
    "tiers": [
      { "upto": 2000, "rate": 1.0 },
      { "upto": 5000, "rate": 0.75 },
      { "upto": 10000, "rate": 0.5 },
      { "upto": null, "rate": 0.35 }
    ]
  }'
```

## Balance-Based Flow

### Report Creation

**Endpoint**: `POST /api/reports/create`

1. User uploads transactions (or provides count)
2. API calculates cost via `calculateTieredCost()`
3. Checks user balance via `checkUserBalance(userId, costUsd)`
4. If insufficient: returns `402 Payment Required` with `requiredAmount`
5. If sufficient: deducts balance, creates report, returns `reportId` and `costUsd`

### Usage Info

**Endpoint**: `GET /api/usage`

Returns:
```json
{
  "ok": true,
  "subscription_tier": "free",
  "balanceUsd": 500.0,
  "currency": "USD",
  "pricingTiers": [...],
  "estimate": {
    "transactions": 8000,
    "costUsd": 5750.0
  }
}
```

Optional estimate: `GET /api/usage?transactions=8000`

## User Experience

### Portal Upload Flow

1. **Upload Tab**: User selects file
2. **File parsing**: Frontend counts transactions
3. **Cost estimation**: `calculateTieredCost()` displays "Costo estimado: $X.XX"
4. **Upload**: Sends to `/api/reports/create`
5. **Balance check**:
   - ✅ Sufficient: Report generated, balance deducted
   - ❌ Insufficient: Redirect to "Agregar Fondos" tab with required amount

### Add Funds Tab

- Displays volume pricing tiers (from `config/pricing.json`)
- Quick amount buttons ($100, $500, $1000)
- Custom amount input
- Payment buttons with TODO integration points:
  - Stripe/PayPal card payment
  - Bank transfer (contact support)

## Payment Integration (TODO)

### Stripe Checkout

```typescript
// In complete_portal_ui.tsx payment button
onClick={async () => {
  const res = await fetch('/api/stripe/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ amount: selectedAmount })
  });
  const { url } = await res.json();
  window.location.href = url;
}}
```

### PayPal

```typescript
// Use existing PayPal API at /api/paypal/create-order
onClick={() => {
  window.location.href = `/api/paypal/create-order?amount=${selectedAmount}`;
}}
```

## Migration Notes

### Removed Legacy Free-Tier Logic

**Before**: Free users got 3 reports + 1,500 total transactions via:
- `free_reports_used`, `max_free_reports`
- `tx_limit_free`, `tx_used_free`
- `canCreateReport()`, `markFreeReportUsed()`

**After**: All users follow pay-per-transaction model:
- Every user has `account_balance_usd`
- New signups receive $500 initial credit (`credits_gifted`)
- All operations check balance and deduct costs
- No report count limits, only balance limits

**Files cleaned**:
- ✅ `app/api/reports/create/route.ts` - now uses balance checks
- ✅ `app/api/usage/route.ts` - returns balance instead of free counters
- ✅ `app/auth/callback/page.tsx` - removed free-tier field initialization
- ⚠️ `app/lib/accessControl.ts` - still contains old logic (unused, can be deleted)

## Testing

### Frontend Cost Calculation

```typescript
import { calculateTieredCost } from '@/app/lib/pricing';

console.log(calculateTieredCost(1500));   // $1500.00
console.log(calculateTieredCost(3000));   // $2750.00
console.log(calculateTieredCost(8000));   // $5750.00
console.log(calculateTieredCost(15000));  // $8500.00
```

### Backend Cost Calculation

```python
from app.backend.api.utils.pricing_tiers import PricingTier

print(PricingTier.calculate_cost(1500))   # 1500.00
print(PricingTier.calculate_cost(3000))   # 2750.00
print(PricingTier.calculate_cost(8000))   # 5750.00
print(PricingTier.calculate_cost(15000))  # 8500.00
```

### API Testing

```bash
# Check usage and get estimate
curl -X GET "http://localhost:3000/api/usage?transactions=8000" \
  -H "Cookie: sb-access-token=YOUR_TOKEN"

# Create report (will check balance)
curl -X POST http://localhost:3000/api/reports/create \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transactionCount": 5000}'

# View admin pricing
curl -X GET http://localhost:3000/api/admin/pricing \
  -H "Cookie: sb-access-token=YOUR_ADMIN_TOKEN"
```

## File Reference

### Core Files

- `config/pricing.json` - Single source of truth
- `app/lib/pricing.ts` - Frontend utilities
- `app/backend/api/utils/pricing_tiers.py` - Backend utilities

### API Routes

- `app/api/reports/create/route.ts` - Report creation with balance checks
- `app/api/usage/route.ts` - Usage info and cost estimates
- `app/api/admin/pricing/route.ts` - Admin pricing management

### UI Components

- `app/components/complete_portal_ui.tsx` - Main portal (upload, add funds, pricing display)
- `app/admin/pricing/page.tsx` - Admin pricing editor

### Authentication

- `app/lib/api-auth.ts` - `getAuthenticatedUserId`, `checkUserBalance`, `deductBalance`

## Environment Variables

```bash
# Required for admin access to pricing editor
ADMIN_USER_IDS=uuid-of-admin-1,uuid-of-admin-2

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Deployment Checklist

- [ ] Set `ADMIN_USER_IDS` for production admins
- [ ] Verify `config/pricing.json` has correct production pricing
- [ ] Test balance deduction in staging
- [ ] Integrate payment provider (Stripe/PayPal)
- [ ] Update `app/components/complete_portal_ui.tsx` payment button handlers
- [ ] Test admin pricing editor in production
- [ ] Document pricing changes in audit log
- [ ] Notify users of any pricing updates

## Support

For pricing questions or custom enterprise tiers:
- Email: sales@tarantulahawk.cloud
- Admin Panel: `/admin/pricing`
- API Docs: `/api/docs`
