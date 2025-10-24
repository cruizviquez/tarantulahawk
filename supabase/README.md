# Supabase Configuration for TarantulaHawk

This directory contains database migrations and email templates for TarantulaHawk's security infrastructure.

## 📋 Setup Steps

### 1. Run Database Migration

```bash
# Navigate to your Supabase project dashboard
# https://app.supabase.com/project/YOUR_PROJECT/editor

# Go to SQL Editor and run the migration file:
supabase/migrations/20250129000000_security_infrastructure.sql
```

This migration creates:
- **profiles** table extensions (subscription_tier, credits_remaining, api_access_enabled)
- **audit_logs** table for LFPIORPI compliance
- **api_keys** table for enterprise client access
- **api_key_usage** table for analytics and billing
- Helper functions and Row-Level Security policies

### 2. Configure Email Templates

#### Magic Link Email (for passwordless authentication)
1. Go to Supabase Dashboard → Authentication → Email Templates
2. Select "Magic Link" template
3. Copy content from `supabase/templates/magic-link.html`
4. Paste into the template editor
5. Save changes

#### Confirm Signup Email (for new user registration)
1. Go to Supabase Dashboard → Authentication → Email Templates
2. Select "Confirm signup" template
3. Copy content from `supabase/templates/confirm-signup.html`
4. Paste into the template editor
5. Save changes

### 3. Configure Email Settings

In Supabase Dashboard → Project Settings → Auth:

- **Site URL:** `https://tarantulahawk.ai` (production) or `http://localhost:3000` (dev)
- **Redirect URLs:** Add `https://tarantulahawk.ai/auth/callback` (and localhost version)
- **Email Auth:** Enable
- **Confirm email:** Enable (required for signup)
- **Magic Link:** Enable
- **Password auth:** Disable (we use passwordless only)

### 4. Configure Rate Limiting

Supabase has built-in rate limiting, but we use Upstash Redis for more granular control:

- Free tier: 10 requests/hour
- Paid tier: 100 requests/hour
- Enterprise tier: 10,000 requests/hour (effectively unlimited)

Configure in Upstash console: https://console.upstash.com/

### 5. Test the Setup

```bash
# Test database connection
npm run supabase:test

# Test email templates
# Register a new account at http://localhost:3000
# Check your email for the Magic Link

# Test rate limiting
# Make multiple API calls and verify 429 responses after limit
```

## 🔒 Security Features

### Passwordless Authentication
- Users receive Magic Links via email
- No passwords to steal or leak
- One-time use links with 60-minute expiration
- Protected by email access (2FA inherently)

### Audit Logging (LFPIORPI Compliance)
All user actions are logged to `audit_logs` table:
- Registration, login attempts
- Report generation, XML exports
- Transaction uploads
- API key creation and usage
- Account upgrades

Query audit logs for compliance:
```sql
SELECT * FROM audit_logs 
WHERE user_id = 'USER_UUID' 
ORDER BY created_at DESC;
```

### API Key Management
Enterprise clients can generate API keys for programmatic access:
- Keys are hashed (SHA-256) before storage
- Only prefix visible in dashboard (e.g., "sk_live_12345678...")
- Rate limits per tier
- Automatic revocation on expiration
- Usage tracking for billing

### Rate Limiting
Middleware automatically enforces limits based on subscription tier:
- Extracts user from Supabase auth token
- Queries subscription_tier from profiles table
- Applies tier-specific rate limiter
- Returns 429 with reset time when exceeded

## 📊 Database Schema

### profiles (extended)
```sql
id: UUID (PK, references auth.users)
subscription_tier: TEXT ('free' | 'paid' | 'enterprise')
credits_remaining: INTEGER (default: 10)
api_access_enabled: BOOLEAN (default: false)
rate_limit_tier: TEXT ('standard' | 'elevated' | 'unlimited')
```

### audit_logs
```sql
id: UUID (PK)
user_id: UUID (FK → auth.users)
action: TEXT (e.g., 'registration', 'report_generated')
metadata: JSONB (flexible action data)
ip_address: TEXT
user_agent: TEXT
resource_id: TEXT (e.g., report ID)
resource_type: TEXT (e.g., 'report')
status: TEXT ('success' | 'failure' | 'pending')
created_at: TIMESTAMPTZ
```

### api_keys
```sql
id: UUID (PK)
user_id: UUID (FK → auth.users)
key_prefix: TEXT (first 16 chars visible)
key_hash: TEXT (SHA-256 hash, unique)
name: TEXT (user-defined label)
environment: TEXT ('test' | 'live')
rate_limit_per_hour: INTEGER
rate_limit_per_day: INTEGER
usage_count: INTEGER
last_used_at: TIMESTAMPTZ
expires_at: TIMESTAMPTZ (nullable)
revoked: BOOLEAN
created_at: TIMESTAMPTZ
```

## 🧪 Testing Checklist

- [ ] Database migration runs successfully
- [ ] profiles table has new columns
- [ ] audit_logs table created with RLS policies
- [ ] api_keys table created with RLS policies
- [ ] Magic Link email template loads correctly
- [ ] Confirm signup email template loads correctly
- [ ] User can register with any email (no corporate restriction)
- [ ] Magic Link arrives in inbox within 1 minute
- [ ] Magic Link redirects to /auth/callback
- [ ] User profile created with 10 credits
- [ ] Audit log entry created for registration
- [ ] Rate limiting triggers 429 after limit exceeded
- [ ] CAPTCHA blocks bot registrations
- [ ] API key generation works (enterprise only)

## 🆘 Troubleshooting

### Migration fails with "relation already exists"
- Some tables may already exist from previous migrations
- Safe to ignore or use `IF NOT EXISTS` clauses (already included)

### Magic Link not arriving
- Check Supabase Dashboard → Logs for email delivery status
- Verify SMTP configuration in Project Settings
- Check spam folder
- Test with different email provider (Gmail, Outlook, etc.)

### Rate limiting not working
- Verify Upstash Redis credentials in .env
- Check middleware.ts is in root directory (not app/)
- Inspect response headers for X-RateLimit-* values
- Enable console logging in middleware for debugging

### API key generation fails
- Ensure user has `api_access_enabled = true` in profiles
- Check subscription_tier is 'enterprise'
- Verify nanoid package is installed

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Email Templates Customization](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [LFPIORPI Regulatory Requirements](https://www.cnbv.gob.mx/)

## 🤝 Support

For technical issues or questions:
- Email: dev@tarantulahawk.ai
- Documentation: https://docs.tarantulahawk.ai
- GitHub Issues: https://github.com/tarantulahawk/tarantulahawk/issues
