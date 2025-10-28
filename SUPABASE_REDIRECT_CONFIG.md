# Configuración de Supabase para Auth Redirect

## Actualizar URL de Redirección en Supabase Dashboard

Para que Supabase redirija a `/auth/redirect` en lugar del home:

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
