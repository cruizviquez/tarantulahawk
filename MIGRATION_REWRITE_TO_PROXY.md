# Migration Guide: Rewrite → Route Handlers Proxy

## 📋 Resumen

Se ha migrado de usar `next.config.ts` rewrites a **Route Handlers con proxy**, eliminando la dependencia directa del tunnel y mejorando la estabilidad.

## 🔄 Cambios Realizados

### 1. ✅ Eliminado `next.config.ts` rewrites

**Antes:**
```typescript
async rewrites() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
  return [
    { source: '/api/portal/:path*', destination: `${backendUrl}/api/portal/:path*` },
    { source: '/api/kyc/:path*', destination: `${backendUrl}/api/kyc/:path*` },
    { source: '/api/history/:path*', destination: `${backendUrl}/api/history/:path*` },
    { source: '/outputs/:path*', destination: `${backendUrl}/outputs/:path*` },
  ];
}
```

**Ahora:** ❌ Removido completamente

### 2. ✅ Creado `app/lib/proxy-backend.ts`

Función helper reutilizable que:
- Valida autenticación vía `getAuthenticatedUserId()`
- Reenvía requests al backend con headers correctos
- Maneja errores y respuestas

### 3. ✅ Creados Route Handlers proxy

**Archivos nuevos:**
- `app/api/portal/[...path]/route.ts` - Proxy para `/api/portal/*`
- `app/api/history/[...path]/route.ts` - Proxy para `/api/history/*`

**Archivo existente (sin cambios):**
- `app/api/kyc/clientes/route.ts` - Ya tenía implementación custom

### 4. ✅ Actualizado `middleware.ts`

- Incluye `/api/history` en el bypass (era olvidado)
- Comentario actualizado explicando nueva arquitectura

## 📊 Comparación

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Tecnología** | `next.config.ts` rewrites | Route Handlers + proxy |
| **Validación** | Backend FastAPI | Next.js Route Handler |
| **Comunicación** | Browser ↔ Backend (directo) | Browser ↔ Next ↔ Backend |
| **Tunnel** | Requería tunnel de `/api/kyc`, `/api/portal` | Solo necesita tunnel de Next.js |
| **Mantenimiento** | Config centralizada | Modular por ruta |
| **Control** | Limitado | Total del lado servidor |

## 🚀 Ventajas de la Nueva Arquitectura

### 1. **Tunnel Estricto Compatible**
- El tunnel solo necesita reenviar a Next.js (un único destino)
- No necesita reenviar múltiples endpoints del backend
- Más simple, más estable

### 2. **Validación Centralizada**
- `getAuthenticatedUserId()` en todos los proxies
- Consistencia de seguridad
- Fácil de auditar

### 3. **Transformación de Datos**
Ahora es fácil modificar requests/responses:
```typescript
// Ejemplo: Agregar metadata
export async function POST(request: NextRequest) {
  const body = await request.json();
  body.timestamp = new Date().toISOString();
  body.client = 'next-proxy';
  const newRequest = new NextRequest(request.url, { ...request, body: JSON.stringify(body) });
  return proxyToBackend(newRequest, 'portal');
}
```

### 4. **Mejor Observabilidad**
- Todos los logs en Next.js
- Fácil de monitorear
- Sin "magia" de rewrites

### 5. **Escalabilidad**
- Agregar nuevos endpoints es trivial
- Crear route handlers específicos cuando sea necesario
- Reutilizar `proxyToBackend()` helper

## 📝 Checklist de Validación

### Antes de pasar a producción:

- [ ] Backend corriendo en puerto configurado
- [ ] `NEXT_PUBLIC_BACKEND_API_URL` configurada correctamente
- [ ] Probar login: `/auth/callback` → obtener sesión
- [ ] Probar `/api/portal/balance` → devuelve datos
- [ ] Probar `/api/kyc/clientes` → devuelve clientes
- [ ] Probar `/api/history` → devuelve historial
- [ ] Sin errores 401 no esperados
- [ ] Headers `Authorization` se envían correctamente
- [ ] Con tunnel estricto: todo funciona igual

### Tests recomendados:

```bash
# Test con token Bearer
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/portal/balance

# Test con sesión de browser
# (abre DevTools → Network → verifica requests a /api/*)

# Test POST
curl -X POST -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}' \
  http://localhost:3000/api/portal/endpoint
```

## 🔧 Cómo Modificar el Proxy

### Agregar nuevo endpoint con lógica custom

Si necesitas validación especial para un endpoint:

```typescript
// app/api/portal/special/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend } from '../../../lib/proxy-backend';

export async function POST(request: NextRequest) {
  // Lógica custom antes de proxy
  const body = await request.json();
  
  if (!body.required_field) {
    return NextResponse.json(
      { error: 'Campo requerido faltante' },
      { status: 400 }
    );
  }
  
  // Luego proxy normal
  return proxyToBackend(request, 'portal');
}
```

### Agregar caching

```typescript
// app/api/portal/cached/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend } from '../../../lib/proxy-backend';

const cache = new Map<string, any>();

export async function GET(request: NextRequest) {
  const cacheKey = request.url;
  
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey), {
      headers: { 'X-Cache': 'HIT' }
    });
  }
  
  const response = await proxyToBackend(request, 'portal');
  const data = await response.json();
  
  cache.set(cacheKey, data);
  
  return NextResponse.json(data, {
    headers: { 'X-Cache': 'MISS' }
  });
}
```

## 🐛 Troubleshooting

### Error: "502 Bad Gateway"
**Causa:** Backend no está corriendo o URL es incorrecta
**Solución:** 
```bash
# Verificar backend
curl http://localhost:8000/api/portal/health

# Verificar variable de entorno
echo $NEXT_PUBLIC_BACKEND_API_URL
```

### Error: "401 No autorizado"
**Causa:** Token inválido o expirado
**Solución:**
- Hacer login nuevamente
- Verificar que token se incluye en headers
- Verificar que `getAuthenticatedUserId()` funciona

### Error: "404 Not Found"
**Causa:** Endpoint no existe en backend o path está incorrecto
**Solución:**
- Verificar que el endpoint existe en backend FastAPI
- Comprobar que el path se reenvía correctamente con logs

## 📚 Documentación Relacionada

- [PROXY_BACKEND_ARCHITECTURE.md](./PROXY_BACKEND_ARCHITECTURE.md) - Arquitectura completa
- [PROXY_QUICK_REFERENCE.md](./PROXY_QUICK_REFERENCE.md) - Referencia rápida

## ❓ Preguntas Frecuentes

**P: ¿Los clientes necesitan cambiar sus solicitudes?**
R: No. Las URLs siguen siendo `/api/portal/*`, `/api/kyc/*`, etc. Es transparent.

**P: ¿Funciona con tunnels estrictos?**
R: Sí, mejor que antes. El tunnel solo necesita reenviar a Next.js (un destino).

**P: ¿Qué pasa si el backend falla?**
R: El proxy devuelve un error 502 con detalles. El cliente sabe que es un problema backend.

**P: ¿Se puede deshabilitar la autenticación para algún endpoint?**
R: Sí, en `proxyToBackend()` pasa `requireAuth: false`, pero úsalo solo si es necesario.

**P: ¿Se pueden agregar más endpoints?**
R: Sí, crea nuevos archivos en `app/api/` con la estructura `[...path]/route.ts`.
