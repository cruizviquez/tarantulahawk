# 🚨 Guía de Solución Rápida - Errores Actuales

## ❌ Problema 1: Magic Link muestra homepage brevemente + token visible

### Causa
Los **Redirect URLs** en Supabase Dashboard aún apuntan al home (`/`) en lugar de `/auth/redirect`

### ✅ Solución (EN SUPABASE DASHBOARD)

1. **Ir a**: [Supabase Dashboard](https://supabase.com/dashboard/project/jhjlxjaicjorzeaqdbsv/auth/url-configuration)

2. **En "Redirect URLs", agregar**:
   ```
   https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev/auth/redirect
   ```

3. **En "Site URL", actualizar a**:
   ```
   https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev
   ```

4. **Guardar cambios**

5. **Probar**: Solicitar nuevo magic link → debe ir directo a `/auth/redirect` (spinner) → dashboard (sin pasar por home)

---

## ❌ Problema 2: CORS Error al subir Excel

### Error actual
```
Access to fetch at 'https://...-8000.app.github.dev/api/portal/upload' 
from origin 'https://...-3000.app.github.dev' 
has been blocked by CORS policy
```

### Causa
Backend Python no permite requests desde el dominio de Codespaces

### ✅ Solución APLICADA

He actualizado el archivo `/app/backend/api/enhanced_main_api.py`:

```python
# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "https://tarantulahawk.ai",
        "https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev",  # Frontend
        "https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev",  # Backend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Backend reiniciándose
El backend está reiniciando ahora. Espera ~30 segundos.

### ✅ Verificación
```bash
# En terminal
curl -I https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev/api/health

# Debe retornar:
# HTTP/2 200
# access-control-allow-origin: https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev
```

---

## 🧪 Testing después de los fixes

### Test 1: Magic Link sin rebote
```bash
1. Hacer logout
2. Solicitar magic link
3. Abrir email → click en link
4. ✅ Debe ir a /auth/redirect (spinner)
5. ✅ NO debe mostrar homepage
6. ✅ URL sin #access_token
7. ✅ Redirige a /dashboard
```

### Test 2: Excel Upload sin CORS
```bash
1. En dashboard → Upload tab
2. Seleccionar archivo .xlsx
3. ✅ "📊 Excel parseado" en console
4. ✅ Request a backend sin error CORS
5. ✅ Procesamiento completo
```

---

## 🔍 Debug Commands

### Ver estado del backend
```bash
# Ver logs en tiempo real
tail -f /workspaces/tarantulahawk/app/backend/uvicorn.log

# O buscar proceso
ps aux | grep uvicorn
```

### Ver env vars del frontend
```javascript
// En browser console
console.log('SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
console.log('BACKEND:', process.env.NEXT_PUBLIC_BACKEND_API_URL);
```

### Test CORS manualmente
```bash
curl -X OPTIONS \
  -H "Origin: https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev" \
  -H "Access-Control-Request-Method: POST" \
  https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev/api/portal/upload
```

---

## 📋 Checklist

- [x] CORS actualizado en backend Python
- [x] Backend reiniciando con nueva config
- [ ] **CRÍTICO**: Actualizar Redirect URLs en Supabase
- [ ] Probar magic link flow
- [ ] Probar Excel upload

---

## ⚡ Si backend no arranca

```bash
# Matar proceso existente
pkill -f uvicorn

# Iniciar manualmente
cd /workspaces/tarantulahawk/app/backend
source venv/bin/activate 2>/dev/null || python -m venv venv && source venv/bin/activate
pip install -q -r requirements.txt
python -m uvicorn api.enhanced_main_api:app --host 0.0.0.0 --port 8000 --reload
```

---

**Última actualización**: Ahora  
**Estado**: Backend reiniciando | Frontend corriendo | Falta Supabase config
