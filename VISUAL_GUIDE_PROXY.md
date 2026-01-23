# 🎨 Visual Guide: Backend Proxy Implementation

## 📍 Mapa de Archivos Modificados/Creados

```
/workspaces/tarantulahawk/
│
├── 🆕 app/lib/proxy-backend.ts
│   └── Helper function para proxy backend
│       - Autentica usuarios
│       - Reenvía requests
│       - Maneja headers y errors
│
├── 🆕 app/api/portal/[...path]/route.ts
│   └── Proxy para /api/portal/*
│       - GET, POST, PUT, PATCH, DELETE
│       - Requiere auth
│       - Usa proxyToBackend()
│
├── 🆕 app/api/history/[...path]/route.ts
│   └── Proxy para /api/history/*
│       - GET, POST, PUT, PATCH, DELETE
│       - Requiere auth
│       - Usa proxyToBackend()
│
├── 🔄 next.config.ts
│   └── REMOVED: async rewrites() section
│       (Era el rewrite directo al backend)
│
├── 🔄 middleware.ts
│   └── UPDATED: 
│       - Incluye /api/history en bypass
│       - Comentario actualizado
│
└── 📚 Documentación (4 nuevos archivos):
    ├── PROXY_BACKEND_ARCHITECTURE.md
    ├── PROXY_QUICK_REFERENCE.md
    ├── MIGRATION_REWRITE_TO_PROXY.md
    ├── ARCHITECTURE_CHANGE_SUMMARY.md
    └── IMPLEMENTATION_CHECKLIST_PROXY.md
```

## 🔄 Flujo de Una Solicitud

### Ejemplo: Obtener Balance (GET)

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ NAVEGADOR HACE SOLICITUD                                 │
├─────────────────────────────────────────────────────────────┤
│ const balance = await fetch('/api/portal/balance', {       │
│   headers: { 'Authorization': `Bearer ${token}` }          │
│ })                                                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP GET /api/portal/balance
                 │ Header: Authorization: Bearer TOKEN
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ NEXT.JS ROUTE HANDLER                                    │
├─────────────────────────────────────────────────────────────┤
│ File: app/api/portal/[...path]/route.ts                    │
│                                                              │
│ export async function GET(request: NextRequest) {          │
│   return proxyToBackend(request, 'portal', {               │
│     requireAuth: true                                       │
│   });                                                        │
│ }                                                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Entra en proxyToBackend()
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ HELPER: PROXY-BACKEND.TS                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ✅ Paso 1: Verificar autenticación                          │
│   userId = await getAuthenticatedUserId(request)           │
│   if (!userId) return 401 "No autorizado"                  │
│                                                              │
│ ✅ Paso 2: Obtener URL del backend                          │
│   backendUrl = "http://localhost:8000"                     │
│                                                              │
│ ✅ Paso 3: Construir URL del backend                        │
│   relativePath = "/balance" (quita /api/portal)            │
│   backendUrl = "http://localhost:8000/api/portal/balance"  │
│                                                              │
│ ✅ Paso 4: Copiar headers importantes                       │
│   Authorization: Bearer TOKEN ← Del cliente                 │
│   Content-Type: application/json ← Si aplica               │
│                                                              │
│ ✅ Paso 5: Reenviar request                                 │
│   const backendResponse = await fetch(                      │
│     "http://localhost:8000/api/portal/balance",            │
│     { method: 'GET', headers }                             │
│   )                                                          │
│                                                              │
│ ✅ Paso 6: Devolver respuesta                               │
│   return NextResponse(backendResponse.data)                │
│                                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Reenvía: GET /api/portal/balance
                 │ Header: Authorization: Bearer TOKEN
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ BACKEND (FastAPI)                                        │
├─────────────────────────────────────────────────────────────┤
│ localhost:8000                                              │
│                                                              │
│ @app.get("/api/portal/balance")                            │
│ def get_balance(request: Request):                         │
│     user_id = validar_supabase_jwt(request)                │
│     balance = db.query(user_id)                            │
│     return { "balance": balance }                          │
│                                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Response: { balance: 1000 }
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5️⃣ NEXT.JS DEVUELVE RESPUESTA                               │
├─────────────────────────────────────────────────────────────┤
│ NextResponse.json({ balance: 1000 })                        │
│ Header: Content-Type: application/json                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP 200 OK
                 │ Body: { balance: 1000 }
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6️⃣ NAVEGADOR RECIBE RESPUESTA ✅                            │
├─────────────────────────────────────────────────────────────┤
│ const balance = await response.json()                       │
│ console.log(balance.balance) // 1000                        │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Arquitectura de Seguridad

```
┌──────────────────────────────────────────────────────┐
│                    INTERNET                          │
└────────────────────┬─────────────────────────────────┘
                     │
          ┌──────────▼─────────────┐
          │   🌐 Navegador         │
          │   localhost:3000       │
          │                        │
          │   fetch('/api/portal') │
          └──────────┬─────────────┘
                     │
         ┌───────────▼────────────────┐
         │   Tunnel (si existe)      │
         │   - Reenvía a Next.js     │
         │   - Destino único y claro │
         │   - Más estable ✅        │
         └───────────┬────────────────┘
                     │
    ┌────────────────▼─────────────────────┐
    │  🔷 NEXT.JS (localhost:3000)         │
    │                                      │
    │  ┌──────────────────────────────┐   │
    │  │ Route Handler                │   │
    │  │ /api/portal/[...path]/       │   │
    │  │                              │   │
    │  │ ✅ Autentica usuario         │   │
    │  │ ✅ Valida token Bearer       │   │
    │  │ ✅ Reenvía al backend        │   │
    │  │ ✅ Devuelve respuesta        │   │
    │  │ ✅ Maneja errores            │   │
    │  └──────────────────┬───────────┘   │
    │                     │                 │
    └─────────────────────┼─────────────────┘
                          │
             ┌────────────▼─────────────┐
             │  🐍 BACKEND (FastAPI)   │
             │  localhost:8000         │
             │                         │
             │  @app.get(...)          │
             │  → Procesa lógica       │
             │  → Accede a DB          │
             │  → Devuelve JSON        │
             └─────────────────────────┘

GARANTÍAS DE SEGURIDAD:
✅ Navegador NUNCA habla directamente con backend
✅ Autenticación validada en Next.js
✅ Tokens nunca expuestos en URL
✅ Headers sensibles manejados en servidor
✅ CORS issues eliminados (todo servidor)
```

## 📊 Tabla de Endpoints

| Ruta | Método | Quién Maneja | Ubicación |
|------|--------|--------------|-----------|
| `/api/portal/*` | GET/POST/PUT/PATCH/DELETE | Route Handler | `app/api/portal/[...path]/route.ts` |
| `/api/history/*` | GET/POST/PUT/PATCH/DELETE | Route Handler | `app/api/history/[...path]/route.ts` |
| `/api/kyc/clientes` | GET/POST | Route Handler | `app/api/kyc/clientes/route.ts` |

Todos usan `proxyToBackend()` helper que:
- ✅ Verifica autenticación
- ✅ Reenvía al backend
- ✅ Devuelve respuesta

## 🚀 Estados de Implementación

```
✅ COMPLETADO
├─ app/lib/proxy-backend.ts           ← Helper creado
├─ app/api/portal/[...path]/route.ts  ← Route Handler
├─ app/api/history/[...path]/route.ts ← Route Handler
├─ next.config.ts actualizado         ← Removido rewrites
├─ middleware.ts actualizado          ← Incluye /api/history
└─ Documentación completa             ← 5 archivos

🔄 LISTA PARA PROBAR
├─ npm run dev → Iniciar servidor
├─ curl test → Probar endpoints
└─ Browser test → Verificar funcionalidad

📋 PRÓXIMO
└─ Validar en environment real con tunnel estricto
```

## 💡 Ejemplos Prácticos

### Test 1: Login y obtener balance

```javascript
// 1. Login
const loginResponse = await fetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'user@example.com', password: '...' })
});
// → Sesión Supabase creada

// 2. Obtener balance (con autenticación)
const balanceResponse = await fetch('/api/portal/balance');
// → Route Handler valida sesión ✅
// → Reenvía a backend ✅
// → Devuelve { balance: 1000 } ✅
```

### Test 2: POST con datos

```javascript
// POST /api/portal/analyze
const response = await fetch('/api/portal/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    file_data: '...',
    analysis_type: 'kyc'
  })
});
// → Route Handler recibe POST
// → Copia body y headers
// → Reenvía a backend
// → Devuelve resultado del análisis
```

### Test 3: Sin autenticación (debe fallar)

```javascript
// Sin sesión/token
const response = await fetch('/api/portal/balance');
// → Route Handler: ¿Está autenticado?
// → NO → Retorna 401 "No autorizado"
// → Navegador: No tienes permiso
```

## 🎯 Checklist Pre-Deploy

```
ANTES DE PASAR A PRODUCCIÓN:

Code Quality:
  ✅ npm run type-check (sin errores)
  ✅ npm run build (compila exitosamente)
  ✅ Archivos creados sin errores

Testing Manual:
  [ ] npm run dev (inicia sin issues)
  [ ] Login funciona
  [ ] /api/portal/balance devuelve datos
  [ ] /api/history funciona
  [ ] /api/kyc/clientes funciona
  [ ] POST endpoints funcionan
  [ ] Errores sin auth devuelven 401

Tunnel (Si aplica):
  [ ] Con tunnel estricto, todo funciona igual
  [ ] Sin tunnel, todo funciona igual
  [ ] Performance es similar

Variables de Entorno:
  [ ] NEXT_PUBLIC_BACKEND_API_URL está configurada
  [ ] Backend accesible en la URL configurada
  [ ] No hay conflictos de puertos

Deploy:
  [ ] Merge a main branch
  [ ] Deploy a staging (opcional)
  [ ] Deploy a producción
  [ ] Monitorear logs
  [ ] Verificar endpoints
```

## 🔍 Indicadores de Éxito

```
✅ Frontend no hace rewrite directo al backend
   - Antes: Browser → /api/kyc → (rewrite) → Backend
   - Ahora: Browser → /api/kyc → NextRoute → Backend

✅ Tunnel más estable
   - Solo necesita reenviar a Next.js (un destino)
   - No múltiples destinos

✅ Autenticación centralizada
   - Validada en proxyToBackend()
   - Consistente en todos los endpoints

✅ Sin CORS issues
   - Todo manejado del lado servidor

✅ Mejor observabilidad
   - Logs centralizados en Next.js
   - Más fácil de debuggear
```

---

**Implementación**: ✅ COMPLETADA  
**Status**: Listo para testing y deployment  
**Documentación**: Exhaustiva con 5 guías + ejemplos  
