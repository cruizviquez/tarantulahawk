# Configuración Completa de Autenticación Segura

## ✅ Cambios Implementados

### 1. Nuevo Flujo de Autenticación (Sin Rebote)

**Antes**:
```
Email → Home (con #tokens) → AuthRedirectHandler → /api/auth/hash?access_token=... → Dashboard
```
- ❌ Homepage visible 2-3 segundos
- ❌ Tokens expuestos en URL
- ❌ Tokens en logs del servidor

**Después**:
```
Email → /auth/redirect (con #tokens) → POST /api/auth/hash (body) → Dashboard
```
- ✅ Solo spinner "Estableciendo sesión..."
- ✅ Tokens en POST body (no en URL)
- ✅ Hash limpiado inmediatamente
- ✅ Cookies HttpOnly seguras

### 2. Archivos Actualizados

**✅ `/app/auth/redirect/page.tsx`** - Nuevo
- Intercepta hash con tokens
- Limpia URL inmediatamente
- POST a /api/auth/hash
- Spinner de carga

**✅ `/app/api/auth/hash/route.ts`** - Reescrito
- `runtime: 'nodejs'`, `maxDuration: 60`
- Acepta POST (recomendado) y GET (legacy)
- Cookies HttpOnly con Supabase SSR
- Previene replay attacks

**✅ `/app/lib/supabaseClient.ts`** - Actualizado
- `createBrowserClient` con `detectSessionInUrl: false`
- No procesa hash automáticamente
- Evita conflictos con nuestro handler

**✅ `/middleware.ts`** - Mejorado
- No redirige APIs públicas
- Permite `/api/auth/hash`, `/api/excel`, etc.
- Matcher optimizado
- Evita "Failed to fetch" por redirects

**✅ `/app/components/OnboardingForm.tsx`** - Actualizado
- `emailRedirectTo: '/auth/redirect'`
- Magic links apuntan al nuevo endpoint

**✅ `/app/page.tsx`** - Limpiado
- Eliminado `<AuthRedirectHandler />`
- Solo muestra landing page

**✅ `/app/components/AuthRedirectHandler.tsx`** - Deprecated
- Marcado como legacy
- Sin funcionalidad (return null)

---

## 📋 Configuración en Supabase Dashboard

### Paso 1: Actualizar Redirect URLs

1. Ir a **Supabase Dashboard** → Tu proyecto
2. Ir a **Authentication** → **URL Configuration**
3. En **Redirect URLs**, agregar:
   - `http://localhost:3000/auth/redirect`
   - `https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev/auth/redirect`
   - `https://*.app.github.dev/auth/redirect` (wildcard para Codespaces)
4. **Guardar**

### Paso 2: Verificar Site URL

- **Site URL**: `https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev`
- Actualizar cuando cambies de Codespace

---

## 🧪 Testing del Nuevo Flujo

### Test 1: Magic Link Básico
```bash
1. Hacer logout completo
2. Solicitar magic link con tu email
3. Abrir link en navegador
4. ✅ Debe ir directo a /auth/redirect (ver spinner)
5. ✅ Debe redirigir a /dashboard sin pasar por home
6. ✅ URL debe estar limpia (sin #access_token)
```

### Test 2: Magic Link Replay Attack
```bash
1. Copiar URL completa del magic link
2. Usarla una vez → ✅ Dashboard
3. Hacer logout
4. Pegar el mismo link → ❌ "Tu enlace ha expirado"
```

### Test 3: Logout y Limpieza
```bash
1. Loguearse normalmente
2. Hacer logout
3. Presionar Back (←) del navegador
4. ✅ Debe redirigir a home (no volver a dashboard)
```

---

## ⏳ Tareas Pendientes

### 1. Aplicar Migración de Profile
```bash
# En Supabase SQL Editor
# Ejecutar: supabase/migrations/20251029000000_add_user_profile_fields.sql
```
- Agrega: `phone`, `position`, `company_name`, `avatar_url`, `updated_at`
- Trigger automático para `updated_at`

### 2. Crear Endpoint de Excel
**❌ BLOQUEADOR** - `/api/excel/parse/route.ts`
```typescript
export const runtime = 'nodejs';
export const maxDuration = 60;

// POST handler
// - Recibe FormData con file
// - Parse con XLSX.read(buffer)
// - Retorna {sheetName, rowCount, data}
// - Error handling robusto
```

### 3. Actualizar Upload en `complete_portal_ui.tsx`
```typescript
// Cambiar endpoint
const response = await fetch(`${API_URL}/api/excel/parse`, {
  method: 'POST',
  body: formData, // No setear Content-Type
  credentials: 'same-origin'
});

// Mejor manejo de errores
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Error ${response.status}: ${errorText}`);
}
```

---

## 🔍 Troubleshooting

### Issue: "Failed to fetch" en Upload
**Causa**: Middleware redirigiendo `/api/excel/*`  
**Solución**: Agregar a `PUBLIC_API_PREFIXES` en middleware.ts

### Issue: Homepage sigue mostrándose
**Causa**: Redirect URLs no actualizadas en Supabase  
**Solución**: Verificar configuración en Dashboard

### Issue: "Link expirado" en primer uso
**Causa**: Tabla `used_tokens` marcando como usado  
**Debug**: Verificar timestamps en `SELECT * FROM used_tokens;`

### Issue: ERR_BLOCKED_BY_CLIENT persiste
**Causa**: API_URL apuntando a localhost desde Codespaces  
**Solución**: Verificar useEffect en complete_portal_ui.tsx

---

## 📦 Dependencias Instaladas

✅ `xlsx@0.18.5` - Para parsing de Excel  
✅ `@supabase/ssr@latest` - Para cookies SSR

---

## 🎯 Estado Actual

| Feature | Status | Notes |
|---------|--------|-------|
| Auth redirect sin rebote | ✅ | Committed & pushed |
| Tokens en POST body | ✅ | No en URL |
| Magic link replay prevention | ✅ | Tabla `used_tokens` |
| Profile modal | ✅ | Necesita migration |
| Excel upload endpoint | ⏳ | xlsx instalado, falta endpoint |
| Supabase redirect config | ❌ | Pendiente actualizar Dashboard |

---

## 📞 Próximo Paso

**Crear `/app/api/excel/parse/route.ts`** con:
- Runtime: nodejs
- FormData handling
- xlsx.read() parsing
- Error messages descriptivos
- Integración con existing ML backend

Una vez creado, actualizar `complete_portal_ui.tsx` para usar nuevo endpoint.

1. Ve a Supabase Dashboard → Authentication → URL Configuration

2. **Site URL**: Mantener actual
   ```
   http://localhost:3000 (desarrollo)
   https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev (Codespaces)
   ```

3. **Redirect URLs** - Agregar:
   ```
   http://localhost:3000/auth/redirect
   https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev/auth/redirect
   https://*.app.github.dev/auth/redirect
   ```

4. Guardar cambios

## Verificar Magic Link Template

En Supabase Dashboard → Authentication → Email Templates → Magic Link:

El botón debe apuntar a:
```
{{ .ConfirmationURL }}
```

Supabase automáticamente agregará el # con los tokens a la URL de redirect configurada.

## Resultado

- **Antes**: Email → Home (con hash) → AuthRedirectHandler → /api/auth/hash → Dashboard
  - Problema: Se ve homepage por 2-3 segundos
  - Problema: Tokens expuestos en URL de `/api/auth/hash`

- **Después**: Email → /auth/redirect (con hash) → POST /api/auth/hash → Dashboard
  - ✅ Solo se ve "Estableciendo tu sesión..."
  - ✅ Tokens enviados por POST (no en URL)
  - ✅ Hash limpiado inmediatamente
