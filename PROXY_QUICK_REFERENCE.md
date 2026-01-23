# Quick Reference: Backend Proxy Architecture

## 🎯 El Cambio

**Antes:** `next.config.ts` → `rewrites()` → Backend (tunnel estricto = problema)

**Ahora:** Browser → Next.js Route Handlers → Backend (más estable ✅)

## 📍 Dónde Está Todo

| Ruta | Archivo | Propósito |
|------|---------|----------|
| `/api/portal/*` | `app/api/portal/[...path]/route.ts` | Proxy para análisis, balance, historial |
| `/api/history/*` | `app/api/history/[...path]/route.ts` | Proxy para historial |
| `/api/kyc/clientes` | `app/api/kyc/clientes/route.ts` | Gestión de clientes KYC |
| Helper | `app/lib/proxy-backend.ts` | Función auxiliar para proxy |

## 🚀 Cómo Funciona

### 1. **Cliente hace solicitud**
```javascript
fetch('/api/portal/analyze', { method: 'POST', body: {...} })
```

### 2. **Next.js Route Handler intercepta**
```typescript
// app/api/portal/[...path]/route.ts
export async function POST(request: NextRequest) {
  return proxyToBackend(request, 'portal', { requireAuth: true });
}
```

### 3. **Helper proxy-backend reenvía**
- ✅ Verifica autenticación
- ✅ Extrae el path (`/analyze` de `/api/portal/analyze`)
- ✅ Construye URL del backend (`http://localhost:8000/api/portal/analyze`)
- ✅ Copia headers necesarios (Authorization, Content-Type)
- ✅ Reenvía el request al backend
- ✅ Devuelve la respuesta al cliente

## 🔍 Ejemplos de Solicitudes

```javascript
// GET
const analysis = await fetch('/api/portal/results/abc123');

// POST
const result = await fetch('/api/portal/analyze', {
  method: 'POST',
  body: JSON.stringify({ file: '...' })
});

// Historial
const history = await fetch('/api/history');

// KYC
const clientes = await fetch('/api/kyc/clientes');
```

**NO necesitas cambiar nada en el código del cliente** - funciona exactamente igual.

## ⚙️ Configuración

### Variable de entorno obligatoria

```env
# .env.local
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
```

### Cambios opcionales en proxy

Si necesitas customizar el proxy, edita `app/lib/proxy-backend.ts`:

```typescript
// Saltarse autenticación para ciertos endpoints
return proxyToBackend(request, 'portal', {
  requireAuth: false  // ⚠️ Úsalo solo si es necesario
});

// Preservar headers adicionales
return proxyToBackend(request, 'portal', {
  preserveHeaders: ['content-type', 'authorization', 'x-custom-header']
});
```

## 🧪 Pruebas Rápidas

### Test con curl
```bash
# Portal
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/portal/balance

# Historial
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/history

# KYC
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/kyc/clientes
```

### Test en navegador (DevTools Console)
```javascript
fetch('/api/portal/balance', {
  headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
}).then(r => r.json()).then(console.log);
```

## ✅ Validación Post-Cambio

- [x] Remover rewrites de `next.config.ts`
- [x] Crear Route Handlers para `/api/portal/*`
- [x] Crear Route Handlers para `/api/history/*`
- [x] Crear helper `proxy-backend.ts`
- [x] Sin errores de TypeScript
- [ ] Probar con `npm run dev`
- [ ] Probar login y llamadas a API
- [ ] Probar con tunnel estricto

## 📚 Documentación Completa

Ver: [PROXY_BACKEND_ARCHITECTURE.md](./PROXY_BACKEND_ARCHITECTURE.md)

## 🐛 Problemas Comunes

| Problema | Solución |
|----------|----------|
| `401 No autorizado` | Verificar token Bearer en headers |
| `502 Bad Gateway` | Backend no está corriendo en puerto 8000 |
| `404 Not Found` | Verificar que el endpoint existe en el backend |
| CORS error | No debería ocurrir (todo desde servidor) |

## 📞 Soporte

Si algo no funciona:
1. Revisar logs en `npm run dev`
2. Verificar `NEXT_PUBLIC_BACKEND_API_URL`
3. Confirmar que backend está corriendo
4. Revisar autenticación en `getAuthenticatedUserId()`
