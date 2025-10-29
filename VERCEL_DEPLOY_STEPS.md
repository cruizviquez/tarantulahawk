# 🚀 Deployment a Vercel - Pasos Inmediatos

**Status:** ✅ Código pushed a GitHub (3 commits)  
**Fecha:** 29 de Octubre, 2025

---

## 📦 LO QUE SE ACABA DE SUBIR

### **Commit 1: Integración de 3 Modelos ML**
```
baf5bd6 - feat: Integrar 3 modelos ML reales en procesamiento
- modelo_ensemble_stack.pkl (Supervised 50%)
- modelo_no_supervisado_th.pkl (Unsupervised 30%)
- modelo_refuerzo_th.pkl (Reinforcement 20%)
```

### **Commit 2: AI Monitoring System**
```
11f3632 - feat: AI monitoring system with ML-based anomaly detection
- Isolation Forest algorithm (7 features)
- SecurityDashboard con auto-refresh
- AdminDashboard con gestión de usuarios
- SessionMonitor auto-ejecutándose
- SQL functions: get_suspicious_activity(), etc.
- Validadores LFPIORPI (170k threshold)
- XML generator oficial UIF/SAT
- Documentación completa
```

### **Commit 3: Dependencies Update**
```
55726d8 - chore: update backend requirements with security dependencies
- bcrypt==4.1.2
- slowapi==0.1.9
- supabase==2.3.4
- postgrest==0.16.2
```

---

## 🎯 DEPLOYMENT EN VERCEL (5 MINUTOS)

### **OPCIÓN 1: Via Dashboard (Recomendado)**

#### **Paso 1: Ir a Vercel**
```
https://vercel.com/new
```

#### **Paso 2: Import Repository**
1. Click "**Import Git Repository**"
2. Seleccionar: `cruizviquez/tarantulahawk`
3. Branch: `main`
4. Click "**Import**"

#### **Paso 3: Configure Project**

**Framework Preset:**
```
Next.js
```

**Root Directory:**
```
./
```

**Build Command:**
```
npm run build
```

**Output Directory:**
```
.next
```

**Install Command:**
```
npm install
```

**Node.js Version:**
```
18.x
```

#### **Paso 4: Environment Variables**

Click "**Add Environment Variable**" y agregar:

```env
# ===== SUPABASE (Obligatorio) =====
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# ===== BACKEND URL (Agregar después de Railway deploy) =====
NEXT_PUBLIC_BACKEND_URL=https://tarantulahawk-backend.up.railway.app

# ===== OPCIONAL =====
NEXT_PUBLIC_TURNSTILE_SITE_KEY=tu_turnstile_key
```

**IMPORTANTE:**
- Marcar todas como: ✅ Production, ✅ Preview, ✅ Development
- `SUPABASE_SERVICE_ROLE_KEY` es **SECRETO** - nunca exponerlo en cliente

#### **Paso 5: Deploy**

1. Click "**Deploy**"
2. Esperar 2-3 minutos
3. ✅ Deployment exitoso → Obtener URL: `https://tarantulahawk.vercel.app`

#### **Paso 6: Verificar**

```bash
# Test que carga
curl -I https://tarantulahawk.vercel.app

# Expected: HTTP/2 200
```

---

### **OPCIÓN 2: Via CLI**

```bash
# Install Vercel CLI (si no está instalado)
npm i -g vercel

# Login
vercel login

# Deploy
cd /workspaces/tarantulahawk
vercel --prod

# Seguir prompts:
# - Link to existing project? No
# - Project name? tarantulahawk
# - Directory? ./
# - Override settings? No

# Configurar environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Redeploy para aplicar variables
vercel --prod
```

---

## 🔧 POST-DEPLOY: Configurar Supabase

### **Actualizar Redirect URLs**

1. Ir a: **Supabase Dashboard → Authentication → URL Configuration**
2. Agregar:
   ```
   https://tarantulahawk.vercel.app/auth/callback
   https://tarantulahawk.vercel.app/auth/redirect
   ```
3. **Site URL:**
   ```
   https://tarantulahawk.vercel.app
   ```
4. Click "**Save**"

### **Verificar Migraciones SQL**

```sql
-- En Supabase SQL Editor:

-- 1. Verificar audit_logs
SELECT COUNT(*) FROM public.audit_logs;

-- 2. Verificar funciones AI
SELECT proname FROM pg_proc 
WHERE proname IN (
  'get_suspicious_activity',
  'get_user_activity_timeline'
);

-- Debe retornar 2 filas
```

**Si faltan:**
```bash
# Ejecutar en Supabase SQL Editor:
# Copiar contenido de: /supabase/migrations/20251026020000_ai_anomaly_detection.sql
# Pegar y Run
```

---

## 🧪 TESTING PRODUCCIÓN

### **Test 1: Frontend**
```bash
# Verificar que carga
curl -I https://tarantulahawk.vercel.app
# Expected: HTTP/2 200
```

### **Test 2: Auth Flow**
1. Ir a: `https://tarantulahawk.vercel.app`
2. Click "Login"
3. Ingresar email → Recibir Magic Link
4. Click en link → Debe redirigir a `/dashboard`

### **Test 3: Session Monitoring**
1. Abrir DevTools Console
2. Ir a `/dashboard`
3. Mover mouse
4. Ver en console: `"SessionMonitor: User active, resetting timer"`

### **Test 4: Admin Dashboard** (Solo con role='admin')
```
https://tarantulahawk.vercel.app/admin
https://tarantulahawk.vercel.app/admin/security
```

---

## 🚂 PRÓXIMO PASO: Railway.app (Backend)

**NOTA:** El frontend funciona, pero para ML endpoints necesitas deployar backend.

### **Deployment Backend en Railway:**

1. **Ir a:** https://railway.app/new
2. **Deploy from GitHub:**
   - Connect GitHub: `cruizviquez/tarantulahawk`
3. **Configure:**
   ```
   Name: tarantulahawk-backend
   Root Directory: /app/backend
   Start Command: uvicorn api.enhanced_main_api:app --host 0.0.0.0 --port $PORT
   ```
4. **Environment Variables:**
   ```env
   SUPABASE_URL=https://tuproyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   JWT_SECRET_KEY=random-secret-key-here
   ALLOWED_ORIGINS=https://tarantulahawk.vercel.app
   PORT=${{RAILWAY_PORT}}
   ```
5. **Deploy** → Obtener URL: `https://tarantulahawk-backend.up.railway.app`
6. **Actualizar Vercel:**
   - Ir a: Vercel Dashboard → Settings → Environment Variables
   - Editar: `NEXT_PUBLIC_BACKEND_URL`
   - Value: `https://tarantulahawk-backend.up.railway.app`
   - Redeploy

---

## 📊 MONITOREO POST-DEPLOY

### **Vercel Dashboard:**
```
https://vercel.com/dashboard
```
Ver:
- ✅ Build logs
- ✅ Function logs
- ✅ Analytics
- ✅ Environment variables

### **Supabase Dashboard:**
```
https://supabase.com/dashboard/project/tu-proyecto
```
Ver:
- ✅ Auth users
- ✅ Database size
- ✅ API requests
- ✅ Table Editor (audit_logs)

---

## 🔐 SEGURIDAD POST-DEPLOY

### **Verificar Variables Secretas:**
```bash
# En Vercel Dashboard → Settings → Environment Variables
# SUPABASE_SERVICE_ROLE_KEY debe estar marcada como "Sensitive" ✅
```

### **Rate Limiting:**
```bash
# Frontend ya tiene middleware.ts con rate limiting
# Verificar en Vercel logs que está activo
```

### **HTTPS:**
```bash
# Vercel auto-habilita HTTPS ✅
curl -I https://tarantulahawk.vercel.app
# Debe retornar: HTTP/2 200
```

---

## 🎯 URLs FINALES (Después de Railway)

| Servicio | URL | Status |
|----------|-----|--------|
| **Frontend** | `https://tarantulahawk.vercel.app` | ✅ Deployed |
| **Backend** | `https://tarantulahawk-backend.up.railway.app` | ⏳ Pending |
| **Database** | `https://tuproyecto.supabase.co` | ✅ Configured |
| **Admin** | `https://tarantulahawk.vercel.app/admin` | ✅ Deployed |
| **Security** | `https://tarantulahawk.vercel.app/admin/security` | ✅ Deployed |

---

## 🐛 TROUBLESHOOTING

### **Error: "Module not found: Can't resolve '@/app/...'"**

**Solución:** Verificar `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### **Error: "Missing environment variable"**

**Solución:**
```bash
# Verificar que estén configuradas:
vercel env ls

# Si falta alguna:
vercel env add VARIABLE_NAME production
```

### **Error: Build fails con "Type error"**

**Solución:**
```bash
# Verificar localmente primero:
npm run build

# Si falla, revisar errores de TypeScript
# Luego push fix y Vercel auto-redeploys
```

---

## ✅ CHECKLIST FINAL

### **Pre-Deploy:**
- [x] Código pushed a GitHub (3 commits)
- [x] requirements.txt actualizado
- [x] package.json con todas las dependencias
- [x] Documentation completa (3 archivos .md)

### **Vercel:**
- [ ] Proyecto importado desde GitHub
- [ ] Environment variables configuradas (3 obligatorias)
- [ ] Build exitoso
- [ ] URL funcionando: `https://tarantulahawk.vercel.app`
- [ ] Auth flow testeado
- [ ] Session monitoring activo

### **Supabase:**
- [ ] Redirect URLs actualizadas
- [ ] Migraciones ejecutadas (20251026020000_ai_anomaly_detection.sql)
- [ ] Funciones RPC verificadas
- [ ] Magic Link expiration: 600 seg (10 min)

### **Railway (Próximo):**
- [ ] Servicio creado
- [ ] Environment variables configuradas
- [ ] Health check `/health` OK
- [ ] Backend URL agregada a Vercel
- [ ] CORS configurado

---

## 📞 SOPORTE

**Documentación Completa:**
- `/AI_MONITORING_IMPLEMENTATION.md` - Detalles técnicos del sistema
- `/DEPLOYMENT_GUIDE.md` - Guía completa Vercel + Railway
- `/AI_ANOMALY_DETECTION_CONFIG.md` - Configuración AI monitoring

**Git Status:**
```bash
# Ver commits
git log --oneline -5

# Ver archivos cambiados
git show --stat
```

---

**Ready to Deploy!** 🚀  
**Estimated Time:** 5 minutos (Vercel) + 10 minutos (Railway)  
**Status:** ✅ All code committed and pushed to GitHub
