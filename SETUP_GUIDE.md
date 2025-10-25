# TarantulaHawk Setup Guide

Complete step-by-step guide to deploy TarantulaHawk with all security features enabled.

---

## 📋 Prerequisites

- GitHub account (for deployment)
- Vercel account (free tier)
- Email (for Supabase, Upstash, Cloudflare accounts)

---

## 🗄️ Step 1: Supabase Setup (5 minutes)

### 1.1 Create Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"New project"**
3. Choose a name: `tarantulahawk-production`
4. Choose a strong database password (save it securely)
5. Choose region: **closest to your users** (e.g., US East for North America)
6. Click **"Create new project"** (wait ~2 minutes for provisioning)

### 1.2 Get API Keys

1. In your project dashboard, click **Settings** (⚙️) in the left sidebar
2. Click **API** under "Project Settings"
3. Copy these values (you'll need them later):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (starts with `eyJ`)
   - **service_role key**: `eyJhbGc...` (⚠️ SECRET - never expose to client)

### 1.3 Run Database Migrations

1. Click **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Open each migration file from your repo and paste the contents:

**Migration 1: Security Infrastructure**
```bash
# Copy contents of: supabase/migrations/20250129000000_security_infrastructure.sql
```
- Click **"Run"** at the bottom right
- Wait for "Success. No rows returned" or row count

**Migration 2: PAYG Columns**
```bash
# Copy contents of: supabase/migrations/20251024000000_payg_columns.sql
```
- Click **"Run"**

**Migration 3: Enforcement & RLS**
```bash
# Copy contents of: supabase/migrations/20251024010000_enforcement_profiles_rls.sql
```
- Click **"Run"**

**Migration 4: DB Rate Limiting (Fallback)**
```bash
# Copy contents of: supabase/migrations/20251024020000_db_rate_limit.sql
```
- Click **"Run"**

### 1.4 Verify Tables Created

Run this verification query in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'audit_logs', 'api_keys', 'api_key_usage', 'api_rate_limit');
```

You should see 5 tables listed.

### 1.5 Configure Auth Settings

1. Click **Authentication** → **Providers** in sidebar
2. Enable **Email** provider (should already be on)
3. Disable password authentication:
   - Scroll to **"Email Auth"** section
   - Turn OFF **"Enable email confirmations"** temporarily (we'll use Magic Links)
4. Click **Authentication** → **URL Configuration**
   - Site URL: `http://localhost:3000` (change later to production domain)
   - Redirect URLs: Add `http://localhost:3000/auth/callback`

### 1.6 Customize Email Templates

1. Click **Authentication** → **Email Templates**

**Magic Link Template:**
- Select **"Magic Link"** from dropdown
- Replace content with: `supabase/templates/magic-link.html`
- Click **"Save"**

**Confirm Signup Template:**
- Select **"Confirm signup"** from dropdown  
- Replace content with: `supabase/templates/confirm-signup.html`
- Click **"Save"**

✅ **Supabase setup complete!**

---

## 🔴 Step 2: Upstash Redis Setup (3 minutes)

### 2.1 Create Free Account

1. Go to [https://upstash.com](https://upstash.com)
2. Click **"Get Started"** (free, no credit card required)
3. Sign up with GitHub or email

### 2.2 Create Redis Database

1. On the Upstash dashboard, look for the **"Create Database"** button (big green/blue button)
2. Fill in the form:
   - **Name**: `tarantulahawk-ratelimit` (or any name you prefer)
   - **Type**: Select **"Regional"** (this is cheaper and perfect for rate limiting)
   - **Primary Region**: Choose **same region as your Supabase** (e.g., `us-east-1` if Supabase is in US East)
   - **Read Region**: Leave empty (not needed for rate limiting)
   - **TLS (Encryption)**: Keep **Enabled** ✅
   - **Eviction**: Select **"No eviction"** (we want rate limit counters to persist)
3. Click the **"Create"** button at the bottom
4. Wait ~10 seconds for provisioning to complete

✅ You now have a free Redis database!

### 2.3 Get Connection Details

1. On the database page, scroll to **"REST API"** section
2. Copy these values:
   - **UPSTASH_REDIS_REST_URL**: `https://us1-xxxxx.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: `AXXXXxxxxx==`

💡 **Tip**: Free tier gives you **10,000 commands per day** (plenty for rate limiting)

✅ **Upstash Redis setup complete!**

---

## 🛡️ Step 3: Cloudflare Turnstile Setup (2 minutes)

💡 **Already using Cloudflare for DNS/CDN?** Even better! You can access Turnstile directly from your existing dashboard.

### 3.1 Access Cloudflare Dashboard

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Log in to your existing account (if your domain is already proxied through Cloudflare)
   - OR sign up for free if you don't have an account yet
3. Verify email (if new account)

### 3.2 Get Turnstile Keys

1. In Cloudflare dashboard, click **"Turnstile"** in left sidebar
2. Click **"Add Site"**
3. Settings:
   - **Site name**: `TarantulaHawk Production`
   - **Domain**: Add your domain (or `localhost` for testing)
     - For testing: add `localhost`, `127.0.0.1`, `*.vercel.app`
   - **Widget Mode**: Select **"Managed"** ✅
     - ℹ️ Options explained:
       - **Managed**: Shows challenge only when needed (recommended)
       - **Non-Interactive**: Always shows "Verifying..." (more visible)
       - **Invisible**: Never shows anything (may block real users)
4. Click **"Create"**

5. Copy these keys:
   - **Site Key** (public): `0x4AAAAAAAA...` (this goes in client code)
   - **Secret Key** (private): `0x4AAAAAAAA...` (⚠️ SECRET - server-side only)

💡 **Turnstile is completely free** with unlimited requests.

✅ **Cloudflare Turnstile setup complete!**

---

## 💳 Step 4: PayPal Setup (5 minutes)

### 4.1 Create PayPal Developer Account

1. Go to [https://developer.paypal.com](https://developer.paypal.com)
2. Log in with your PayPal account (or create one)
3. Click **"Dashboard"** → **"My Apps & Credentials"**

### 4.2 Create Sandbox App (for testing)

1. Under **"REST API apps"**, click **"Create App"**
2. Settings:
   - **App Name**: `TarantulaHawk Sandbox`
   - **Sandbox Business Account**: Select the default or create one
3. Click **"Create App"**
4. Copy **Client ID** (starts with `AX...`)

### 4.3 Test with Sandbox (Optional)

For testing, use PayPal Sandbox credentials:
- Buyer account: Available in Dashboard → Sandbox → Accounts
- Use test credit cards (no real money charged)

### 4.4 Create Live App (for production)

1. Switch toggle from **"Sandbox"** to **"Live"** at top
2. Click **"Create App"** again
3. Settings:
   - **App Name**: `TarantulaHawk Live`
4. Copy **Client ID** for production

💡 **Important**: You'll need PayPal Business account approval for live transactions.

✅ **PayPal setup complete!**

---

## 🔧 Step 5: Local Development Setup

### 5.1 Clone and Install

```bash
cd /workspaces/tarantulahawk
npm install
```

### 5.2 Create `.env.local` File

Create a new file `.env.local` in the root directory:

```bash
# Supabase (from Step 1.2)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Cloudflare Turnstile (from Step 3.2)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAA...
TURNSTILE_SECRET_KEY=0x4AAAAAAAA...

# Upstash Redis (from Step 2.3)
UPSTASH_REDIS_REST_URL=https://us1-xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXXxxxxx==

# PayPal (from Step 4.2 - use Sandbox for testing)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AXxxx-sandbox

# Site URL (for redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

⚠️ **Never commit `.env.local` to git!** (it's already in `.gitignore`)

### 5.3 Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5.4 Test the Flow

1. **Sign Up Flow**:
   - Click **"Try Free"** on homepage
   - Fill in name, **any email** (Gmail, Outlook, corporate, etc. - all accepted ✅), company name
   - Complete Turnstile CAPTCHA (should be invisible or one-click)
   - Click **"Create Account"**
   - ✅ You should see "Magic Link Sent!" message

   💡 **Note**: Email validation is **open to all domains** (Gmail, Yahoo, personal emails accepted). This was changed to support small businesses without custom domains.

2. **Check Email**:
   - Open your email inbox
   - Find email from Supabase (check spam folder)
   - Click the Magic Link
   - ✅ Should redirect to `/auth/callback` and then dashboard

3. **Verify Database**:
   - Go to Supabase Dashboard → Table Editor → `profiles`
   - You should see your new user with:
     - `subscription_tier` = 'free'
     - `free_reports_used` = 0
     - `max_free_reports` = 3
     - `tx_limit_free` = 1500

4. **Test Rate Limiting**:
   - Open browser DevTools → Network tab
   - Make a request to any `/api/*` endpoint
   - Check response headers:
     - `X-RateLimit-Limit`: 10 (free tier)
     - `X-RateLimit-Remaining`: 9
     - `X-RateLimit-Tier`: free
   - Make 11 requests quickly
   - ✅ 11th request should return 429 Too Many Requests

5. **Test Health Check**:
   - Visit [http://localhost:3000/health](http://localhost:3000/health)
   - ✅ All tables should show "Exists: Yes"

✅ **Local development working!**

---

## 🚀 Step 6: Deploy to Vercel

### 6.1 Push to GitHub

```bash
git add .
git commit -m "feat: complete security setup with Redis, Turnstile, PayPal"
git push origin main
```

### 6.2 Connect to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository: `cruizviquez/tarantulahawk`
4. Click **"Import"**

### 6.3 Configure Environment Variables

In Vercel project settings:

1. Click **"Settings"** → **"Environment Variables"**
2. Add all variables from your `.env.local`:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | ⚠️ Production only (sensitive) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAAAAAAA...` | Production, Preview, Development |
| `TURNSTILE_SECRET_KEY` | `0x4AAAAAAAA...` | ⚠️ Production only (sensitive) |
| `UPSTASH_REDIS_REST_URL` | `https://us1-xxxxx.upstash.io` | Production, Preview, Development |
| `UPSTASH_REDIS_REST_TOKEN` | `AXXXXxxxxx==` | ⚠️ Production only (sensitive) |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | `AXxxx` (live client ID) | Production only |
| `NEXT_PUBLIC_SITE_URL` | `https://tarantulahawk.vercel.app` | Production |

3. Click **"Save"** after each variable

### 6.4 Deploy

1. Click **"Deployments"** tab
2. Vercel will automatically deploy from `main` branch
3. Wait ~2 minutes for build to complete
4. Click **"Visit"** to see your live site

### 6.5 Update Supabase Redirect URLs

1. Go back to Supabase Dashboard → Authentication → URL Configuration
2. Update:
   - **Site URL**: `https://tarantulahawk.vercel.app` (your Vercel URL)
   - **Redirect URLs**: Add `https://tarantulahawk.vercel.app/auth/callback`
3. Click **"Save"**

### 6.6 Update Turnstile Domain

1. Go to Cloudflare Dashboard → Turnstile
2. Edit your site
3. Add domain: `tarantulahawk.vercel.app` (or `*.vercel.app` for all preview branches)
4. Save

✅ **Production deployment complete!**

---

## 🧪 Step 7: Production Testing Checklist

Test on your live site:

- [ ] Homepage loads correctly
- [ ] Sign up with Turnstile CAPTCHA works
- [ ] Magic Link email arrives (check spam)
- [ ] Magic Link redirects to dashboard
- [ ] Profile created in Supabase with correct defaults
- [ ] Rate limiting enforces (check headers in DevTools)
- [ ] Health page shows all tables exist
- [ ] PayPal button renders on `/pay` page

---

## 📊 Cost Summary (Free Tier Limits)

| Service | Free Tier | Upgrade Trigger |
|---------|-----------|-----------------|
| **Supabase** | 500 MB database, 2 GB bandwidth, 50k auth users | Database size or bandwidth |
| **Upstash Redis** | 10k commands/day, 256 MB storage | Daily command limit |
| **Cloudflare Turnstile** | Unlimited requests | N/A (always free) |
| **PayPal** | No monthly fee | 2.9% + $0.30 per transaction |
| **Vercel** | 100 GB bandwidth, unlimited requests | Team features or bandwidth |

💡 **Total monthly cost to start: $0**

When to upgrade:
- **Supabase Pro** ($25/mo): >500 MB data or >50k users
- **Upstash Pay-as-you-go**: >10k Redis commands/day (~$0.20 per 100k)
- **Vercel Pro** ($20/mo): Custom domains, team collaboration, analytics

---

## 🐛 Troubleshooting

### Magic Link Not Arriving

1. Check Supabase Dashboard → Logs → Auth Logs for errors
2. Verify email templates are saved correctly
3. Check spam/junk folder
4. Test with a different email provider (Gmail, Outlook, etc.)

### Rate Limiting Not Working

1. Check Vercel logs for Redis connection errors
2. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
3. Test locally with `console.log()` in middleware to debug
4. Check Upstash dashboard for request count

### Turnstile Not Loading

1. Verify `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is correct
2. Check domain is whitelisted in Cloudflare Turnstile settings
   - If your domain is already proxied through Cloudflare: add your domain
   - For Vercel previews: add `*.vercel.app` as a wildcard
   - For local testing: add `localhost` and `127.0.0.1`
3. Look for CORS errors in browser console
4. Test with `theme="light"` to make widget visible for debugging
5. If you use Cloudflare proxy: ensure "Under Attack Mode" is OFF (it conflicts with Turnstile)

### PayPal Button Not Rendering

1. Verify `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is set
2. Check browser console for PayPal SDK errors
3. Ensure you're using **sandbox** client ID for testing
4. Wait for PayPal SDK script to load (check Network tab)

### Database Errors

1. Check Supabase Dashboard → Logs → Database Logs
2. Verify all migrations ran successfully (no red errors)
3. Check RLS policies are enabled: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
4. Ensure `handle_new_user()` trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`

---

## 🔐 Security Best Practices

1. **Never commit secrets to git**:
   - Use `.env.local` for local development
   - Use Vercel Environment Variables for production
   - Never share `SUPABASE_SERVICE_ROLE_KEY` or `TURNSTILE_SECRET_KEY`

2. **Rotate keys periodically**:
   - Supabase: Can regenerate keys in Settings → API
   - Upstash: Can create new database and migrate
   - Turnstile: Can regenerate secret key in Cloudflare dashboard

3. **Monitor usage**:
   - Check Supabase dashboard daily for unusual auth patterns
   - Review Upstash Redis command counts
   - Check Vercel analytics for traffic spikes

4. **Enable 2FA**:
   - Enable 2FA on Supabase, Upstash, Cloudflare, Vercel accounts

---

## 📞 Support

**Technical Issues**: Open an issue on GitHub  
**Compliance Questions**: Review `SECURITY_IMPLEMENTATION.md`  
**Supabase Help**: [https://supabase.com/docs](https://supabase.com/docs)  
**Upstash Help**: [https://upstash.com/docs](https://upstash.com/docs)  
**Turnstile Help**: [https://developers.cloudflare.com/turnstile](https://developers.cloudflare.com/turnstile)

---

## ✅ Quick Reference Card

Print this for easy access:

```
SUPABASE:
URL: https://xxxxx.supabase.co
Anon Key: eyJhbGc... (public)
Service Key: eyJhbGc... (SECRET)

UPSTASH:
URL: https://us1-xxxxx.upstash.io
Token: AXXXXxxxxx== (SECRET)

TURNSTILE:
Site Key: 0x4AAAAAAAA... (public)
Secret: 0x4AAAAAAAA... (SECRET)

PAYPAL:
Sandbox: AXxxx-sandbox
Live: AXxxx (when approved)

VERCEL:
Dashboard: https://vercel.com/cruizviquez/tarantulahawk
Domain: https://tarantulahawk.vercel.app
```

---

**Setup completed!** 🎉

Your TarantulaHawk platform is now running with:
- ✅ Passwordless authentication (Magic Links)
- ✅ Bot protection (Cloudflare Turnstile)
- ✅ Rate limiting (Upstash Redis + DB fallback)
- ✅ Audit logging (LFPIORPI compliance)
- ✅ API key management (Enterprise)
- ✅ Pay-as-you-go model (PayPal)
- ✅ Health monitoring
