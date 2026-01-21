# TarantulaHawk - AI-Powered AML Compliance Platform

AI-powered platform for Anti-Money Laundering (AML) compliance with LFPIORPI and BSA regulations.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (see SETUP_GUIDE.md)
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📚 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Complete setup instructions (Supabase, Redis, Turnstile, PayPal)
- **[SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md)** - Security features and compliance
- **[SUPABASE_CONFIG.md](SUPABASE_CONFIG.md)** - Database configuration and auth setup
- **[LISTA_69B_AUTOMATIZACION.md](LISTA_69B_AUTOMATIZACION.md)** - 📋 Lista 69B SAT automation (KYC)
- **[supabase/README.md](supabase/README.md)** - Database schema and migrations
- **[CONSOLIDATION_EXECUTIVE_SUMMARY.md](CONSOLIDATION_EXECUTIVE_SUMMARY.md)** - ⚠️ Folder consolidation (run once after clone)

## 🔑 Features

- **Passwordless Auth** - Magic Links via Supabase (no passwords)
- **Bot Protection** - Cloudflare Turnstile CAPTCHA
- **Rate Limiting** - Upstash Redis with DB fallback
- **Audit Logging** - LFPIORPI compliance trail
- **API Keys** - Enterprise programmatic access
- **Pay-as-you-go** - 3 free reports, then PayPal
- **3-Layer AI** - Supervised, unsupervised, and reinforcement learning
- **KYC Automation** - OFAC, CSNU, Lista 69B SAT verification (free APIs)

## 📋 Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run deploy   # Deploy to Vercel

# Backend scripts (Python)
bash INSTALAR_LISTA_69B.sh                  # Install & setup Lista 69B SAT
python3 app/backend/scripts/ejemplo_lista_69b.py  # Interactive KYC example
```

## 🧪 Testing

```bash
# Start dev server
npm run dev

# Test registration flow
# 1. Visit http://localhost:3000
# 2. Click "Try Free"
# 3. Complete form + CAPTCHA
# 4. Check email for Magic Link
# 5. Click link to verify

# Test rate limiting (should return 429 on 11th request)
for i in {1..11}; do curl -I http://localhost:3000/api/health; done

# Test health check
curl http://localhost:3000/api/health
```

## 🔒 Security

- No passwords stored (Magic Links only)
- Server-side CAPTCHA verification
- Tiered rate limiting (10/100/10k per hour)
- Row-Level Security on all database tables
- SHA-256 hashed API keys
- Comprehensive audit logging

## 🌍 Deployment

1. Push to GitHub
2. Import to Vercel
3. Add environment variables (see `SETUP_GUIDE.md`)
4. Deploy automatically on push to `main`

## 📞 Support

For setup help, see **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for step-by-step instructions.

## 📄 License

Proprietary - TarantulaHawk Inc.
