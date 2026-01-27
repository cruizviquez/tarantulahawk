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
	- Extended: UIF Personas Bloqueadas (MX) and PEPs México

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

## 🧭 KYC Module Flow

The KYC module follows an 8-step flow:

- PASO 1: Upload Documento — Drag & drop INE/Pasaporte.
- PASO 2: OCR + Extracción Datos — Tesseract/Google Vision; extract Nombre, RFC, CURP, Foto; pre-fill form.
- PASO 3: Validación Formato (Local) — RFC (12/13 chars, patrón válido), CURP (18 chars, patrón válido).
- PASO 4: Búsqueda Listas Negras — OFAC (XML), CSNU/ONU (XML), Lista 69B SAT (JSON/PDF), UIF Personas Bloqueadas (scraping/API), PEPs México (API/scraping).
- PASO 5: Clasificación EBR Automática — Matriz de riesgo (score 0-100); Factores: Listas + Sector + Monto; Resultado: Bajo/Medio/Alto/Crítico.
- PASO 6: Decisión Automática — Score < 30 → ✅ Aprobado; Score 30-70 → ⚠️ Revisión manual; Score > 70 → ❌ Rechazado; En listas → ❌ Rechazado siempre.
- PASO 7: Guardado Expediente — Supabase Storage (documentos) + DB (metadata + validaciones); Conservación 10 años.
- PASO 8: Job Diario (Background) — Cron 2am; Re-verifica TODOS los clientes; Si cliente pasa a lista → Alerta + punto rojo.

Implementation notes:
- Use server-side endpoints for OCR if using Google Vision; client-side is possible with Tesseract.js.
- Normalize names (lowercase, accent stripping) before matching against sources.
- Configure `UIF_SOURCE_URL`, `PEPS_API_URL`, `PEPS_API_KEY` for MX-specific checks.
- Set `CRON_SECRET` for daily job authentication (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

## 🇲🇽 KYC Integrations: UIF + PEPs México

Additional Mexico-specific validations are integrated in the KYC API:

- UIF Personas Bloqueadas: checks names against a public source of blocked persons.
- PEPs México: checks whether a person is a Politically Exposed Person.

### Configure Environment

Add the following variables. See [`.env.example`](.env.example).

- `UIF_SOURCE_URL`: Public CSV/HTML/text source with names for UIF blocked persons.
- `PEPS_API_URL`: API endpoint returning JSON (array or `{ results: [...] }`).
- `PEPS_API_KEY`: Optional bearer token for the PEPs API.
- `VISION_API_KEY`: Google Vision API key for OCR (extract data from INE/Passport).

### Risk Weights (default)

- `UIF` match: +70
- `PEPs` match: +30
- `OFAC` match: +40
- `CSNU/ONU` match: +40
- `Lista 69B` (RFC in list): +50

Approval requires zero matches in `ofac`, `csnu`, `uif`, `peps` and not being listed in `lista_69b`.

### Notes

- Normalize names (lowercase, optional accent stripping) to improve matching.
- Prefer authoritative sources/APIs; implement caching and respectful scraping if needed.
- Log matches with `fuente` and `tipo` for auditability.

### OCR Setup

To enable automatic data extraction from INE/Passport images:

1. Get a Google Vision API key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add to `.env.local`: `VISION_API_KEY=your-key-here`
3. Visit `/kyc` route to use the upload interface
4. Drag & drop document → OCR extracts Nombre, RFC, CURP → Validate against lists

Without the API key, users can still fill the form manually.

### Daily Job Configuration

The system includes a daily cron job that re-validates all clients at 2am:

1. Generate secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Add to `.env.local`: `CRON_SECRET=your-generated-secret`
3. Configure cron service (EasyCron, Vercel Crons, or Node-Cron):
	- URL: `https://yourdomain.com/api/kyc/validaciones/diarias`
	- Method: POST
	- Header: `Authorization: Bearer YOUR_CRON_SECRET`
	- Schedule: `0 2 * * *` (2am daily)

The job automatically:
- Re-validates all registered clients against updated lists
- Updates risk scores and classifications
- Generates alerts if clients appear on new lists
- Marks high-risk clients with red flag in UI
