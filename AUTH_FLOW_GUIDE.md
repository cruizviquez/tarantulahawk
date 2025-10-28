# Guía de Flujos de Autenticación - TarantulaHawk

## 🎯 Problema Actual

El sistema tiene **doble redireccionamiento** al hacer login con Magic Link:

1. Magic Link → `/?auth_error=no_code` (primer redirect)
2. Cliente lee hash → `/dashboard` (segundo redirect)

**Causa raíz:** Supabase usa "Hash-based Auth" (tokens en `#access_token=...`) que el servidor no puede leer.

---

## ✅ Solución Recomendada: Server-Side Auth (PKCE)

### Ventajas
- ✅ **Más seguro**: Tokens nunca expuestos en URL del navegador
- ✅ **Un solo redirect**: `/auth/callback?code=...` → `/dashboard`
- ✅ **Compatible con SSR/middleware**: El servidor puede leer `?code=`
- ✅ **Sin JavaScript necesario**: Funciona incluso con JS deshabilitado
- ✅ **Mejor SEO**: No depende de client-side routing

### Cómo Implementar

#### 1. Configurar Supabase Dashboard

Ve a: **Authentication → URL Configuration**

```
Site URL: https://tu-dominio.com
Redirect URLs:
  - https://tu-dominio.com/auth/callback
  - http://localhost:3000/auth/callback (para desarrollo)

Auth Flow Type: SERVER-SIDE (PKCE enabled) ✅
```

**Importante:** Asegúrate que NO esté en "Implicit Flow" o "Hash-based".

#### 2. Código ya está listo

El código actual en `OnboardingForm.tsx` y `app/auth/callback/page.tsx` ya soporta PKCE:

```tsx
// OnboardingForm.tsx - YA CORRECTO ✅
emailRedirectTo: `${window.location.origin}/auth/callback`
```

```tsx
// app/auth/callback/page.tsx - YA CORRECTO ✅
const { data, error } = await supabase.auth.exchangeCodeForSession(code);
```

#### 3. Opcional: Eliminar código legacy

Si confirmas que PKCE funciona, puedes eliminar:

- `app/components/AuthHashHandler.tsx` (no se necesita)
- `app/api/auth/hash/route.ts` (no se necesita)
- Remover `<AuthHashHandler />` de `TarantulaHawkWebsite.tsx`

#### 4. Verificar el flujo

**Antes (Hash-based):**
```
Magic Link: https://tu-dominio.com/#access_token=abc123&refresh_token=xyz789
↓
GET /?auth_error=no_code (servidor no ve el hash)
↓
Cliente lee hash → POST /api/auth/hash
↓
GET /dashboard
```

**Después (PKCE):**
```
Magic Link: https://tu-dominio.com/auth/callback?code=pkce_abc123
↓
GET /auth/callback (servidor intercambia code por sesión)
↓
GET /dashboard
```

---

## 🔒 Seguridad del Middleware

### ¿Es válido el middleware actual?

**Sí, es válido y bien diseñado**. Protege correctamente:

✅ **Rutas protegidas**: `/dashboard`, `/admin`, `/settings`
✅ **Rate limiting**: Por tier (free/paid/enterprise)
✅ **Fallback a Supabase**: Si Upstash falla
✅ **Validación de cookies**: Antes de queries pesadas

### Mejoras aplicadas

1. **Quick auth check**: Si existe cookie válida, skip `getUser()` completo
2. **Bypass flag**: `?from=auth` para evitar re-verificación inmediata
3. **Fail-open en rate limit**: Si Redis falla, permite la request

### Alternativas de autenticación

Si quieres más control, puedes usar:

#### Opción A: JWT Verification in Middleware (Más rápido)
```typescript
// En vez de getUser(), verifica JWT directamente
import { jwtVerify } from 'jose';

async function verifyJWT(token: string) {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  return payload.sub; // user ID
}
```

**Ventajas:**
- ⚡ 10x más rápido que `getUser()`
- ✅ No hace request a Supabase
- ✅ Valida firma criptográfica

**Desventajas:**
- ❌ No detecta usuarios banned en tiempo real
- ❌ Requiere manejar expiración manual

#### Opción B: Edge Functions (Cloudflare Workers)
```typescript
// Mueve autenticación a Cloudflare Edge
// Intercepta antes de llegar a Next.js
// Latencia: <10ms global
```

**Ventajas:**
- ⚡ Ultra rápido (ejecuta en CDN)
- ✅ Reduce carga en servidor Next.js
- ✅ Geo-distribution automática

**Desventajas:**
- ❌ Más complejo de setup
- ❌ Costo adicional (Cloudflare Workers)

#### Opción C: Session Storage (Redis)
```typescript
// Cachea sesiones en Redis por 5 minutos
// Middleware solo verifica Redis
// Reduce llamadas a Supabase 90%
```

**Ventajas:**
- ⚡ Muy rápido (Redis in-memory)
- ✅ Reduce carga en Supabase
- ✅ Control total de sesión

**Desventajas:**
- ❌ Requiere sincronizar invalidación
- ❌ Costo de Redis

---

## 🚀 Recomendación Final

### Para Producción (Mejor seguridad + rendimiento):

1. **✅ Usar PKCE Flow** (elimina doble redirect)
2. **✅ Mantener middleware actual** (ya es bueno)
3. **✅ Agregar quick auth check** (ya implementado)
4. **✅ Considerar JWT verification** si necesitas < 50ms latencia

### Para Desarrollo Local:

1. **✅ Mantener Hash-based Flow** (más fácil debug)
2. **✅ Usar `AuthHashHandler`** (funciona sin config)
3. **✅ Logs en console** para troubleshooting

---

## 📊 Comparación de Flujos

| Aspecto | Hash-based (Actual) | PKCE (Recomendado) | JWT Middleware | Edge Functions |
|---------|---------------------|-------------------|----------------|----------------|
| Seguridad | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Velocidad | 🐢 Lento (2 redirects) | 🚀 Rápido (1 redirect) | ⚡ Ultra rápido | ⚡⚡ Instantáneo |
| Complejidad | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| SEO-friendly | ❌ No | ✅ Sí | ✅ Sí | ✅ Sí |
| Costo | Gratis | Gratis | Gratis | $$ (Workers) |
| Mantenimiento | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## 🛠️ Troubleshooting

### Error: "auth_error=no_code"
**Causa:** Supabase envía tokens en hash, no en query params.
**Solución:** Cambiar a PKCE flow en Supabase Dashboard.

### Error: "Invalid session"
**Causa:** Cookie expiró o fue invalidada.
**Solución:** Implementar refresh token automático:
```typescript
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Session refreshed');
  }
});
```

### Error: Rate limit en middleware
**Causa:** Upstash Redis no configurado o límite excedido.
**Solución:** Verificar `UPSTASH_REDIS_REST_URL` en `.env.local`.

---

## 📚 Referencias

- [Supabase PKCE Flow](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)

---

**Última actualización:** 2025-10-28
**Autor:** TarantulaHawk Dev Team
