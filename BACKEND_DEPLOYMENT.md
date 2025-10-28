# Backend Deployment Strategy

## Problema Actual

El backend FastAPI corre en un proceso separado (puerto 8000) y necesita ser accesible desde el frontend Next.js. Esto funciona en desarrollo local y GitHub Codespaces, pero requiere configuración especial para producción.

## Opciones de Deployment

### Opción 1: Vercel + Servidor Externo (Actual en Codespaces)
**✅ Pros:**
- Backend Python completo con todas las librerías ML
- FastAPI con todas sus capacidades (WebSockets, background tasks)
- Fácil de debuggear y desarrollar
- No hay límites de tiempo de ejecución

**❌ Contras:**
- Requiere servidor separado (costo adicional)
- Más complejo de mantener (2 deployments)
- Necesita CORS configurado correctamente
- Posibles problemas de latencia

**Servicios Recomendados:**
1. **Railway.app** (Recomendado)
   - Deploy directo desde GitHub
   - $5/mes para empezar
   - Auto-scaling
   - Logs y monitoring incluidos

2. **Render.com**
   - Free tier disponible (con sleep)
   - $7/mes tier básico
   - Simple deploy

3. **Google Cloud Run**
   - Pay per use
   - Escala a 0 (no cobran si no se usa)
   - Muy económico para tráfico bajo

### Opción 2: Next.js API Routes + Python Serverless (Vercel)
**✅ Pros:**
- Un solo deployment (simplifica ops)
- No necesita CORS (mismo origen)
- Gratis en Vercel tier hobby
- Auto-scaling incluido

**❌ Contras:**
- Límite de 10 segundos en funciones serverless (Hobby)
- Límite de 50MB en funciones
- Necesita adaptar código para serverless
- Librerías ML pesadas pueden exceder límites

**Implementación:**
```typescript
// app/api/portal/upload/route.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  // Llamar script Python
  const { stdout } = await execAsync('python3 process.py input.csv');
  return Response.json(JSON.parse(stdout));
}
```

### Opción 3: Híbrido (Vercel Frontend + Vercel AI SDK + ML Backend)
**✅ Pros:**
- Frontend en Vercel (rápido y gratis)
- Procesamiento pesado en servidor dedicado
- Lo mejor de ambos mundos

**Estructura:**
```
Vercel (Frontend + API Routes ligeros)
  ↓ HTTP
Railway/Render (FastAPI con ML)
  ↓ Resultados
Vercel (Presenta resultados al usuario)
```

## Recomendación para TarantulaHawk

**Para Desarrollo (GitHub Codespaces):**
- ✅ Continuar usando FastAPI en puerto 8000
- ✅ Frontend en puerto 3000
- ✅ API_URL dinámico (ya implementado)

**Para Producción (Recomendado):**
1. **Frontend en Vercel** (gratis)
   - Deploy automático desde GitHub
   - Edge network global
   - SSL incluido

2. **Backend en Railway** ($5-10/mes)
   - Deploy automático desde mismo repo
   - Variables de entorno compartidas
   - Logs y monitoring

3. **Base de Datos Supabase** (ya configurado)
   - Auth y base de datos
   - Row Level Security
   - Backups automáticos

## Configuración Actual

### GitHub Codespaces
```typescript
// app/components/complete_portal_ui.tsx
const API_URL = window.location.hostname.includes('github.dev')
  ? `https://${window.location.hostname.replace('-3000.app', '-8000.app')}`
  : 'http://localhost:8000';
```

### Para Producción
```typescript
// .env.local (desarrollo)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000

// .env.production (Vercel)
NEXT_PUBLIC_BACKEND_API_URL=https://tarantulahawk-backend.railway.app
```

```typescript
// app/components/complete_portal_ui.tsx
useEffect(() => {
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_BACKEND_API_URL) {
      // Producción: usar variable de entorno
      setApiUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL);
    } else if (window.location.hostname.includes('github.dev')) {
      // Codespaces: puerto 8000 en mismo dominio
      const backendHost = window.location.hostname.replace('-3000.app', '-8000.app');
      setApiUrl(`https://${backendHost}`);
    } else {
      // Local: localhost
      setApiUrl('http://localhost:8000');
    }
  }
}, []);
```

## Deployment Steps para Railway

1. **Crear cuenta en Railway.app**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Conectar repositorio**
   - New Project → Deploy from GitHub
   - Seleccionar repo tarantulahawk
   - Railway detecta Python automáticamente

3. **Configurar variables de entorno**
   ```
   SUPABASE_URL=https://jhj...
   SUPABASE_KEY=eyJ...
   ALLOWED_ORIGINS=https://tarantulahawk.vercel.app
   ```

4. **Configurar root directory** (en Railway Settings)
   ```
   Root Directory: app/backend
   Start Command: uvicorn api.enhanced_main_api:app --host 0.0.0.0 --port $PORT
   ```

5. **Actualizar Vercel**
   ```bash
   # En Vercel dashboard
   Environment Variables:
   NEXT_PUBLIC_BACKEND_API_URL = https://tarantulahawk-backend.railway.app
   ```

6. **Update CORS en backend**
   ```python
   # app/backend/api/enhanced_main_api.py
   allow_origins=[
       "http://localhost:3000",
       "https://tarantulahawk.vercel.app",
       "https://*.vercel.app",  # Preview deployments
       "https://*.railway.app",
   ]
   ```

## Costos Estimados

**Opción Development:**
- GitHub Codespaces: $0.18/hora (~$130/mes uso full-time)
- Solo para desarrollo, no producción

**Opción Production (Recomendada):**
- Vercel (Frontend): $0/mes (Hobby tier)
- Railway (Backend): $5-10/mes (según uso)
- Supabase: $0/mes (Free tier suficiente para empezar)
- **Total: $5-10/mes**

**Opción Enterprise:**
- Vercel Pro: $20/mes
- Railway Pro: $20/mes
- Supabase Pro: $25/mes
- **Total: $65/mes** (incluye mejor soporte y más recursos)

## Siguiente Paso

Para deploy a producción:
```bash
# 1. Crear proyecto Railway
railway init

# 2. Deploy backend
cd app/backend
railway up

# 3. Obtener URL del backend
railway domain

# 4. Configurar en Vercel
# Dashboard → Environment Variables
NEXT_PUBLIC_BACKEND_API_URL=https://tu-backend.railway.app

# 5. Redeploy frontend
git push origin main  # Vercel auto-deploys
```

## Testing

```bash
# Test local
curl http://localhost:8000/health

# Test Codespaces
curl https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev/health

# Test Production (después de deploy)
curl https://tarantulahawk-backend.railway.app/health
```

## Monitoreo

**Railway Dashboard:**
- CPU/Memory usage
- Request logs
- Error tracking
- Deployment history

**Vercel Dashboard:**
- Function invocations
- Edge network latency
- Build logs
- Analytics

**Supabase Dashboard:**
- Database size
- Active connections
- Query performance
- Auth metrics
