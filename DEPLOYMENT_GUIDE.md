# 🚀 TarantulaHawk - Deployment Guide

**Target:** Vercel (Frontend) + Railway.app (Backend)  
**Date:** October 29, 2025

---

## 🏗️ ARQUITECTURA DE DEPLOYMENT

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────────┐            │
│  │   VERCEL     │◄────▶│  Railway.app     │            │
│  │  (Next.js)   │ HTTPS│  (FastAPI)       │            │
│  │              │      │                  │            │
│  │ • Frontend   │      │ • 3 ML Models    │            │
│  │ • SSR        │      │ • Validador      │            │
│  │ • API Routes │      │ • XML Generator  │            │
│  │ • Dashboard  │      │ • 15 Endpoints   │            │
│  └──────────────┘      └──────────────────┘            │
│         │                      │                        │
│         │                      │                        │
│         └──────────┬───────────┘                        │
│                    ▼                                    │
│           ┌─────────────────┐                           │
│           │   SUPABASE      │                           │
│           │                 │                           │
│           │ • PostgreSQL    │                           │
│           │ • Auth          │                           │
│           │ • audit_logs    │                           │
│           │ • RLS Policies  │                           │
│           └─────────────────┘                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### **1. Verificar Archivos Locales**

- [x] `.env.local` configurado correctamente
- [x] `next.config.ts` sin errores
- [x] `package.json` con todas las dependencias
- [x] Backend `requirements.txt` actualizado
- [x] Migraciones SQL ejecutadas en Supabase
- [x] Archivos `.pkl` (modelos ML) en `/app/backend/models/`

### **2. Dependencias Backend (Python)**

```bash
cd /workspaces/tarantulahawk/app/backend
pip freeze > requirements.txt
```

**Verificar que incluya:**
```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-multipart>=0.0.6
pandas>=2.1.0
numpy>=1.24.0
scikit-learn>=1.3.0
xgboost>=2.0.0
joblib>=1.3.0
openpyxl>=3.1.0
bcrypt>=4.1.0
python-jose[cryptography]>=3.3.0
slowapi>=0.1.9
supabase>=2.0.0
```

### **3. Variables de Entorno**

**Frontend (Vercel):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
NEXT_PUBLIC_BACKEND_URL=https://your-app.railway.app
```

**Backend (Railway):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
JWT_SECRET_KEY=your-random-secret-key-here
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

---

## 🚀 DEPLOYMENT PASO A PASO

### **PASO 1: Preparar Repositorio GitHub**

```bash
cd /workspaces/tarantulahawk

# Verificar que .gitignore incluya:
echo "
.env
.env.local
.env.production
node_modules/
.next/
__pycache__/
*.pyc
.DS_Store
*.log
" >> .gitignore

# Add, commit y push
git add .
git commit -m "feat: AI monitoring system with ML anomaly detection

- Implemented Isolation Forest algorithm for anomaly detection
- Added SecurityDashboard with real-time monitoring
- Created AdminDashboard for user management
- Auto-executing SessionMonitor with activity logging
- SQL functions: get_suspicious_activity, get_user_activity_timeline
- Auto-alert triggers for high-risk activity
- 7 ML features: actions/min, IPs, entropy, timing, etc.
- Risk score calculation (0-100) with color-coded UI
- Backend ML models: modelo_ensemble_stack.pkl, modelo_no_supervisado_th.pkl, modelo_refuerzo_th.pkl
- LFPIORPI compliance: 170k threshold, structuring detection
- Enterprise features: HMAC, idempotency, rate limiting

Closes #XXX"

git push origin main
```

---

### **PASO 2: Deploy Frontend en Vercel**

#### **A) Via Dashboard (Recomendado):**

1. **Ir a:** https://vercel.com/new
2. **Import Git Repository:**
   - Seleccionar: `cruizviquez/tarantulahawk`
   - Branch: `main`
3. **Configure Project:**
   ```
   Framework Preset: Next.js
   Root Directory: ./
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   Node.js Version: 18.x
   ```
4. **Environment Variables:**
   - Click "Add Environment Variable"
   - Agregar todas las de Frontend (ver arriba)
   - Marcar: "Production", "Preview", "Development"
5. **Deploy:**
   - Click "Deploy"
   - Esperar 2-3 minutos
   - Obtener URL: `https://tarantulahawk.vercel.app`

#### **B) Via CLI:**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd /workspaces/tarantulahawk
vercel --prod

# Configurar environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_BACKEND_URL
```

---

### **PASO 3: Deploy Backend en Railway.app**

#### **A) Via Dashboard:**

1. **Ir a:** https://railway.app/new
2. **Deploy from GitHub repo:**
   - Connect GitHub account
   - Seleccionar: `cruizviquez/tarantulahawk`
3. **Configure Service:**
   ```
   Name: tarantulahawk-backend
   Root Directory: /app/backend
   Start Command: uvicorn api.enhanced_main_api:app --host 0.0.0.0 --port $PORT
   ```
4. **Environment Variables:**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   JWT_SECRET_KEY=generate-random-secret-here
   ALLOWED_ORIGINS=https://tarantulahawk.vercel.app
   PORT=${{RAILWAY_PORT}}  # Auto-provided by Railway
   ```
5. **Settings:**
   - Python Version: 3.11
   - Health Check Path: `/health`
   - Health Check Timeout: 30s
6. **Deploy:**
   - Railway auto-deploys on push
   - Obtener URL: `https://tarantulahawk-backend.up.railway.app`

#### **B) Crear `railway.json` (Opcional):**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pip install -r requirements.txt"
  },
  "deploy": {
    "startCommand": "uvicorn api.enhanced_main_api:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

#### **C) Verificar Deployment:**

```bash
# Test health check
curl https://tarantulahawk-backend.up.railway.app/health

# Expected response:
# {"status":"healthy","timestamp":"2025-10-29T...","version":"1.0.0"}
```

---

### **PASO 4: Configurar CORS en Backend**

**Actualizar `enhanced_main_api.py`:**

```python
# En línea ~30 (después de app = FastAPI(...))
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tarantulahawk.vercel.app",
        "https://www.tarantulahawk.vercel.app",  # Si tienes custom domain
        "http://localhost:3000"  # Para desarrollo
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### **PASO 5: Actualizar Frontend con Backend URL**

**En Vercel Dashboard:**
1. Ir a: **Settings → Environment Variables**
2. Actualizar: `NEXT_PUBLIC_BACKEND_URL`
   - Value: `https://tarantulahawk-backend.up.railway.app`
3. **Redeploy:**
   - Deployments → Latest → "Redeploy"

---

### **PASO 6: Configurar Supabase Redirect URLs**

1. **Supabase Dashboard → Authentication → URL Configuration**
2. **Add Redirect URLs:**
   ```
   https://tarantulahawk.vercel.app/auth/callback
   https://tarantulahawk.vercel.app/auth/redirect
   http://localhost:3000/auth/callback  # Dev
   http://localhost:3000/auth/redirect  # Dev
   ```
3. **Site URL:**
   ```
   Production: https://tarantulahawk.vercel.app
   ```
4. **Save Changes**

---

### **PASO 7: Verificar SQL Migrations en Supabase**

```sql
-- En Supabase SQL Editor, ejecutar:

-- 1. Verificar tabla audit_logs
SELECT COUNT(*) FROM public.audit_logs;

-- 2. Verificar funciones AI
SELECT proname FROM pg_proc 
WHERE proname IN (
  'get_suspicious_activity',
  'get_user_activity_timeline',
  'trigger_security_alert'
);
-- Debe retornar 3 filas

-- 3. Test función suspicious activity
SELECT * FROM get_suspicious_activity();

-- 4. Verificar trigger
SELECT tgname FROM pg_trigger 
WHERE tgname = 'security_alert_trigger';
```

**Si faltan, ejecutar:**
```bash
# Copiar contenido de:
/workspaces/tarantulahawk/supabase/migrations/20251026020000_ai_anomaly_detection.sql

# Pegar en Supabase SQL Editor → Run
```

---

## 🧪 POST-DEPLOYMENT TESTING

### **Test 1: Frontend Health**

```bash
# Verificar que carga
curl -I https://tarantulahawk.vercel.app

# Expected: HTTP/2 200
```

### **Test 2: Backend Health**

```bash
curl https://tarantulahawk-backend.up.railway.app/health

# Expected:
# {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

### **Test 3: Auth Flow**

1. Ir a: `https://tarantulahawk.vercel.app`
2. Click "Login"
3. Ingresar email → Recibir Magic Link
4. Click en enlace → Redirigir a `/dashboard`
5. Verificar que `SessionMonitor` está activo (ver console logs)

### **Test 4: AI Anomaly Detection**

```bash
# Generar actividad sospechosa (desde backend):
for i in {1..35}; do
  curl -X POST https://tarantulahawk.vercel.app/api/audit/activity \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"test-user-id\",\"action\":\"test_bot_$i\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"path\":\"/dashboard\",\"user_agent\":\"curl/7.0\"}" &
done

# Verificar alerta en admin dashboard:
# https://tarantulahawk.vercel.app/admin/security
```

### **Test 5: Backend ML Endpoint**

```bash
# Test análisis de transacciones
curl -X POST https://tarantulahawk-backend.up.railway.app/api/v1/analizar \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "transacciones": [
      {
        "cliente_id": "TEST001",
        "monto": 180000,
        "tipo_operacion": "deposito",
        "tipo_moneda": "MXN",
        "fecha": "2025-10-29",
        "es_efectivo": "si",
        "sector": "otro"
      }
    ]
  }'

# Expected: JSON con resultado ML + risk_assessment
```

---

## 🔧 TROUBLESHOOTING

### **Error: "Failed to fetch" en Frontend**

**Causa:** CORS no configurado o Backend URL incorrecta

**Solución:**
```bash
# Verificar NEXT_PUBLIC_BACKEND_URL
vercel env ls

# Si está mal:
vercel env rm NEXT_PUBLIC_BACKEND_URL production
vercel env add NEXT_PUBLIC_BACKEND_URL production
# Value: https://tarantulahawk-backend.up.railway.app
```

### **Error: "Module not found: Can't resolve '@/app/...'"**

**Causa:** Paths absolutos no configurados

**Solución:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### **Error: "Database error: function get_suspicious_activity does not exist"**

**Causa:** Migración SQL no ejecutada

**Solución:**
```sql
-- En Supabase SQL Editor:
-- Copiar y ejecutar: supabase/migrations/20251026020000_ai_anomaly_detection.sql
```

### **Error: Backend "ModuleNotFoundError: No module named 'X'"**

**Causa:** requirements.txt desactualizado

**Solución:**
```bash
cd /workspaces/tarantulahawk/app/backend
pip freeze > requirements.txt
git add requirements.txt
git commit -m "fix: update requirements.txt"
git push

# Railway auto-redeploys
```

### **Error: "Models not found (.pkl files)"**

**Causa:** Archivos .pkl no committeados (ignorados por .gitignore)

**Solución:**
```bash
# Verificar si están en repo
ls -lh /workspaces/tarantulahawk/app/backend/models/

# Si NO están, comentar en .gitignore:
# *.pkl

# Luego:
git add app/backend/models/*.pkl
git commit -m "chore: add ML model files"
git push
```

---

## 📊 MONITORING POST-DEPLOY

### **1. Vercel Analytics**

- Dashboard: https://vercel.com/dashboard
- Ver: Request count, Response time, Errors
- Configurar: Alerts para >500ms response time

### **2. Railway Metrics**

- Dashboard: https://railway.app/project/your-project
- Ver: CPU, Memory, Network
- Configurar: Auto-scaling si necesario

### **3. Supabase Usage**

- Dashboard: https://supabase.com/dashboard/project/your-project
- Ver: Database size, API requests, Auth logins
- Configurar: Backups diarios

### **4. Custom Monitoring (Opcional)**

**Prometheus + Grafana:**

```python
# En enhanced_main_api.py
from prometheus_client import Counter, Histogram, generate_latest

# Métricas
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests')
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency')

@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain")
```

---

## 🔐 SECURITY POST-DEPLOY

### **1. Secrets Management**

```bash
# NUNCA commitar secrets al repo
# Verificar que .env.local esté en .gitignore

# Rotar API keys cada 90 días
# Configurar en Supabase Dashboard → API Settings
```

### **2. Rate Limiting**

**Verificar que está activo en production:**
```python
# En enhanced_main_api.py debe estar:
@app.get("/api/v1/analizar")
@limiter.limit("100/hour")  # ✅ Configurado por tier
async def analizar_transacciones(...):
    ...
```

### **3. HTTPS Enforcement**

**Vercel:** ✅ Auto-habilitado  
**Railway:** ✅ Auto-habilitado  
**Supabase:** ✅ Auto-habilitado

### **4. Backup Strategy**

**Supabase:**
- Backups automáticos diarios ✅
- Point-in-time recovery (hasta 7 días)

**Código:**
- GitHub como source of truth ✅
- Branches protegidos (main)

---

## 📈 SCALING CONSIDERATIONS

### **Cuando Escalar:**

| Métrica | Threshold | Acción |
|---------|-----------|--------|
| API Response Time | >500ms | Escalar Railway a más CPU |
| DB Connections | >80% pool | Habilitar pgBouncer |
| Memory Usage | >85% | Aumentar RAM |
| Request Rate | >10k/min | Implementar CDN (Cloudflare) |

### **Railway Scaling:**

```json
// railway.json
{
  "deploy": {
    "numReplicas": 2,  // Horizontal scaling
    "resources": {
      "cpu": 2,        // vCPUs
      "memory": 4096   // MB
    }
  }
}
```

---

## ✅ DEPLOYMENT CHECKLIST FINAL

### **Pre-Deploy:**
- [x] Código testeado localmente
- [x] .env.local configurado
- [x] requirements.txt actualizado
- [x] Migraciones SQL ejecutadas
- [x] .gitignore configurado
- [x] Commit + push a GitHub

### **Vercel:**
- [ ] Proyecto importado
- [ ] Environment variables configuradas
- [ ] Build exitoso
- [ ] URL funcionando
- [ ] Custom domain (opcional)

### **Railway:**
- [ ] Servicio creado
- [ ] Root directory: `/app/backend`
- [ ] Environment variables configuradas
- [ ] Health check: `/health` OK
- [ ] CORS configurado

### **Supabase:**
- [ ] Redirect URLs actualizadas
- [ ] Migraciones ejecutadas
- [ ] RPC functions verificadas
- [ ] Backups habilitados

### **Testing:**
- [ ] Frontend carga correctamente
- [ ] Backend health check OK
- [ ] Auth flow funciona
- [ ] ML endpoints responden
- [ ] Admin dashboard accesible
- [ ] AI monitoring activo

---

## 🎯 URLS FINALES

**Frontend:**
- Production: `https://tarantulahawk.vercel.app`
- Admin: `https://tarantulahawk.vercel.app/admin`
- Security: `https://tarantulahawk.vercel.app/admin/security`

**Backend:**
- API Base: `https://tarantulahawk-backend.up.railway.app`
- Health: `https://tarantulahawk-backend.up.railway.app/health`
- Docs: `https://tarantulahawk-backend.up.railway.app/docs`

**Database:**
- Supabase: `https://your-project.supabase.co`
- Dashboard: `https://supabase.com/dashboard/project/your-project`

---

**Última Actualización:** 29 de Octubre, 2025  
**Status:** ✅ Ready for Production  
**Estimated Deploy Time:** 15-20 minutos
