# ✅ Checklist de Configuración - Supabase Dashboard

## 📋 Estado Actual

### Variables de Entorno
- ✅ `NEXT_PUBLIC_SITE_URL`: `https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev`
- ✅ `NEXT_PUBLIC_BACKEND_API_URL`: `https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev`
- ✅ `emailRedirectTo`: Usa `NEXT_PUBLIC_SITE_URL/auth/redirect`

### Protección de Rutas
- ✅ `/dashboard`: Protegido en SSR con `getAuthUser()` (redirect automático)
- ✅ `/admin`, `/settings`: Protegidos en middleware
- ✅ APIs públicas: `/api/auth/hash`, `/api/excel`, `/api/turnstile`

---

## 🔧 Configuración Pendiente en Supabase

### 1. Redirect URLs (CRÍTICO)

**Ir a**: [Supabase Dashboard](https://supabase.com/dashboard/project/jhjlxjaicjorzeaqdbsv) → **Authentication** → **URL Configuration**

**Agregar estas URLs en "Redirect URLs"**:

```
https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev/auth/redirect
https://*.app.github.dev/auth/redirect
http://localhost:3000/auth/redirect
```

**Verificar "Site URL"**:
```
https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev
```

---

### 2. Aplicar Migración de Profile Fields (CRÍTICO)

**Ir a**: [Supabase Dashboard](https://supabase.com/dashboard/project/jhjlxjaicjorzeaqdbsv) → **SQL Editor** → **New Query**

**Copiar y ejecutar**:
```sql
-- Archivo: supabase/migrations/20251029000000_add_user_profile_fields.sql

-- Add new columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS position VARCHAR(100),
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index on updated_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON public.profiles(updated_at DESC);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.phone IS 'User phone number (optional)';
COMMENT ON COLUMN public.profiles.position IS 'Job position/title (optional)';
COMMENT ON COLUMN public.profiles.company_name IS 'Company name (can differ from profiles.company)';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp of last profile update';
```

**Verificar ejecución**:
```sql
-- Verificar columnas agregadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('phone', 'position', 'company_name', 'avatar_url', 'updated_at');
```

---

### 3. Verificar Migración de used_tokens (Ya Aplicada)

**Verificar que existe**:
```sql
-- Debe retornar filas con estructura de tabla
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'used_tokens';

-- Debe retornar: token_hash, used_at, expires_at
```

**Si NO existe, ejecutar**:
```sql
-- Archivo: supabase/migrations/20251028000000_prevent_magic_link_reuse.sql
-- (Ver contenido completo en el archivo)
```

---

## 🧪 Testing después de Configuración

### Test 1: Magic Link Flow
```bash
1. Reiniciar frontend: npm run dev
2. Abrir: https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev
3. Solicitar magic link con tu email
4. Abrir email → click en link
5. ✅ Debe redirigir a /auth/redirect (spinner "Estableciendo sesión...")
6. ✅ Debe llegar a /dashboard sin mostrar homepage
7. ✅ URL debe estar limpia (sin #access_token)
8. Copiar URL del magic link del email
9. Hacer logout
10. Pegar el mismo magic link
11. ✅ Debe mostrar "Tu enlace ha expirado o es inválido"
```

### Test 2: Excel Upload
```bash
1. En dashboard, ir a tab "Upload"
2. Seleccionar archivo .xlsx o .csv pequeño
3. ✅ Debe mostrar estimación exacta de filas
4. ✅ Debe procesar sin mostrar "ERR_BLOCKED_BY_CLIENT"
5. ✅ Si hay error, debe mostrar mensaje descriptivo
6. Verificar en Network tab del browser:
   - Request a /api/excel/parse (200 OK)
   - Request a backend -8000.app.github.dev/api/portal/upload
```

### Test 3: Profile Modal
```bash
1. Click en avatar (arriba derecha)
2. Click en "Mi Perfil"
3. ✅ Modal debe abrir con tabs "Perfil" y "Cuenta"
4. Editar: Nombre, Teléfono, Puesto, Empresa, Avatar URL
5. Click "Guardar Cambios"
6. ✅ Debe mostrar mensaje de éxito
7. Recargar página (F5)
8. Abrir modal de nuevo
9. ✅ Datos editados deben persistir
10. Tab "Cuenta": email y balance deben ser read-only
```

---

## 🔍 Debugging

### Verificar Variables de Entorno
```bash
# En browser console (F12)
console.log('SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
console.log('BACKEND:', process.env.NEXT_PUBLIC_BACKEND_API_URL);

# Debe mostrar:
# SITE_URL: https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev
# BACKEND: https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev
```

### Verificar Redirect URLs en Supabase
```bash
# En SQL Editor
SELECT * FROM auth.config;
# Buscar: additional_redirect_urls
```

### Verificar used_tokens Table
```sql
-- Ver tokens recientes
SELECT 
  LEFT(token_hash, 10) || '...' as hash_preview,
  used_at,
  expires_at,
  expires_at < NOW() as is_expired
FROM used_tokens 
ORDER BY used_at DESC 
LIMIT 10;
```

### Verificar Profile Fields
```sql
-- Ver perfiles con nuevos campos
SELECT 
  id,
  name,
  phone,
  position,
  company_name,
  LEFT(avatar_url, 30) || '...' as avatar_preview,
  updated_at
FROM profiles 
ORDER BY updated_at DESC 
LIMIT 5;
```

---

## ⚠️ Problemas Comunes

### "Link expirado" en primer uso de magic link
**Causa**: Redirect URL no configurada en Supabase  
**Solución**: Agregar URLs en Dashboard → Authentication

### "Failed to fetch" al subir Excel
**Causa**: BACKEND_API_URL incorrecta o puerto 8000 no público  
**Solución**: 
1. Verificar que puerto 8000 es público en Codespaces
2. Verificar env var: `echo $NEXT_PUBLIC_BACKEND_API_URL`

### Profile modal no guarda
**Causa**: Migración de profile fields no aplicada  
**Solución**: Ejecutar SQL migration en Supabase

### Magic link redirige a localhost
**Causa**: NEXT_PUBLIC_SITE_URL no cargada o frontend no reiniciado  
**Solución**: 
```bash
# Matar frontend
pkill -f "next dev"

# Reiniciar
npm run dev
```

---

## 📞 Próximos Pasos

1. ✅ Variables de entorno configuradas
2. ✅ Código actualizado y committed
3. ⏳ **HACER AHORA**: Actualizar Redirect URLs en Supabase
4. ⏳ **HACER AHORA**: Aplicar migration de profile fields
5. ⏳ Reiniciar frontend (`npm run dev`)
6. ⏳ Testing completo

---

**Última actualización**: 2025-01-29  
**Codespace**: `silver-funicular-wp59w7jgxvvf9j47`  
**Frontend**: Puerto 3000 (público)  
**Backend**: Puerto 8000 (público)
