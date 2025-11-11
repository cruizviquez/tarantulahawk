# 🔍 Diagnóstico Completo - TarantulaHawk

## Problema Actual

**Síntomas:**
1. ❌ Magic link llega con `:3000` en la URL
2. ❌ CORS bloqueado: "No 'Access-Control-Allow-Origin' header"
3. ❌ Backend no responde en `/api/portal/validate`

**Causa raíz:**
- El backend FastAPI **NO está corriendo** o no aplicó cambios de CORS

---

## ✅ Solución Paso a Paso

### 1. Verificar si el backend está corriendo

```bash
# Ver procesos de uvicorn
ps aux | grep uvicorn

# Si NO aparece nada, el backend está detenido
```

### 2. DETENER cualquier proceso anterior

```bash
# Matar todos los procesos uvicorn
pkill -9 uvicorn

# O buscar por puerto 8000
lsof -ti:8000 | xargs kill -9
```

### 3. INICIAR el backend limpiamente

```bash
cd /workspaces/tarantulahawk/app/backend

# Activar venv
source venv/bin/activate

# Ir a directorio api
cd api

# Iniciar uvicorn con logs visibles
uvicorn enhanced_main_api:app --host 0.0.0.0 --port 8000 --reload
```

**Debes ver esto en la terminal:**
```
🚀 TarantulaHawk API Starting...
INFO:     Started server process [XXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4. Verificar CORS del backend (nueva terminal)

```bash
# Test 1: Health endpoint básico
curl -i https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev/health

# Test 2: Preflight CORS para validate
curl -i -X OPTIONS \
  -H "Origin: https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev" \
  -H "Access-Control-Request-Method: POST" \
  https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev/api/portal/validate
```

**Respuesta esperada del OPTIONS:**
```
HTTP/2 200
access-control-allow-origin: *
access-control-allow-methods: *
access-control-allow-headers: *
```

Si **NO ves** `access-control-allow-origin: *`, el backend no aplicó cambios.

### 5. Verificar frontend

```bash
# En otra terminal
cd /workspaces/tarantulahawk
npm run dev
```

---

## 🐛 Troubleshooting Específico

### Magic Link con :3000

**Archivo:** `app/components/OnboardingForm.tsx`

**Verificar:**
1. Abre DevTools (F12) → Console
2. Envía un magic link
3. Busca el log: `[ONBOARDING] emailRedirectTo:`
4. Debe mostrar: `https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev/auth/callback` (sin :3000)

**Si sigue mostrando :3000:**
- Verifica `.env.local`:
  ```env
  NEXT_PUBLIC_SITE_URL=https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev
  ```
  (sin :3000 al final)
- Reinicia frontend: Ctrl+C y `npm run dev`
- Borra caché: Ctrl+Shift+R

### CORS Bloqueado

**Causas posibles:**

1. **Backend no corriendo**
   - Solución: Ver paso 3 arriba

2. **Backend en puerto incorrecto**
   ```bash
   # Verificar qué está en 8000
   lsof -i:8000
   ```

3. **Codespaces no expuso puerto 8000**
   - En VS Code, abre "Ports" tab
   - Verifica que puerto 8000 esté visible y público
   - URL debe ser: `https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev`

4. **Caché del navegador**
   - Abre DevTools → Network tab
   - Marca "Disable cache"
   - Recarga con Ctrl+Shift+R

---

## 📋 Checklist Final

Antes de intentar subir archivo:

- [ ] Backend corriendo en puerto 8000 (ver logs de uvicorn)
- [ ] curl a `/health` devuelve 200
- [ ] curl OPTIONS a `/api/portal/validate` devuelve `access-control-allow-origin: *`
- [ ] Frontend corriendo en puerto 3000
- [ ] `.env.local` tiene URLs sin :3000
- [ ] Navegador con caché deshabilitado
- [ ] Console del navegador muestra `[ONBOARDING] emailRedirectTo:` sin :3000

---

## 🚀 Comando Todo-en-Uno

Si quieres reiniciar todo limpio:

```bash
# Terminal 1: Backend
cd /workspaces/tarantulahawk/app/backend
pkill -9 uvicorn
source venv/bin/activate
cd api
uvicorn enhanced_main_api:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend (después de que backend inicie)
cd /workspaces/tarantulahawk
npm run dev

# Terminal 3: Verificación
sleep 5
curl -i https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev/health
```

---

## 🔬 Debug Avanzado

Si después de todo sigue fallando:

### Ver logs del backend en tiempo real

```bash
# En la terminal donde corre uvicorn, verás:
# - Cada request que llega
# - Errores de Python
# - Logs de CORS
```

### Ver request exacta del frontend

1. Abre DevTools → Network tab
2. Sube archivo
3. Click en request `validate` (en rojo)
4. Mira:
   - **Headers tab:** verifica `Origin`
   - **Response tab:** verifica error exacto
   - **Console tab:** busca mensajes de CORS

### Verificar archivo de configuración

```bash
# Ver CORS actual del código
grep -A10 "CORSMiddleware" /workspaces/tarantulahawk/app/backend/api/enhanced_main_api.py

# Debe mostrar:
#     allow_origins=["*"],
#     allow_credentials=False,
```

---

## 💡 Notas Importantes

1. **Hot reload:** El backend con `--reload` detecta cambios en `.py`, pero:
   - No detecta cambios en `.env`
   - No detecta cambios si modificaste mientras estaba detenido
   - Reinicia manualmente si dudas

2. **Codespaces ports:** 
   - Verifica visibilidad en Ports tab
   - Si dice "Private", cámbialo a "Public"

3. **CORS wildcard:**
   - `allow_origins=["*"]` con `allow_credentials=False` es la config más permisiva
   - Funciona para desarrollo
   - En producción, restringir a dominios específicos

4. **Frontend .env.local:**
   - Cambios requieren reinicio de `npm run dev`
   - No se aplican con hot reload
   - Usa `console.log` para verificar valores en runtime

---

## ✅ Test Exitoso

Cuando todo funcione correctamente:

1. **Magic link:**
   - Email llega con URL sin :3000
   - Click funciona y redirige a /dashboard

2. **Carga de archivo:**
   - Upload sin error de CORS
   - Se muestra botón "Analizar con IA"
   - Click ejecuta análisis y muestra resultados

3. **Console logs:**
   ```
   [ONBOARDING] emailRedirectTo: https://.../auth/callback
   📤 Validando archivo: {fileName: "archivo.csv", ...}
   ✅ Archivo validado: {success: true, ...}
   🎯 Estado actualizado: {fileReadyForAnalysis: true, ...}
   ```

4. **Backend logs:**
   ```
   INFO:     127.0.0.1:XXXX - "POST /api/portal/validate HTTP/1.1" 200 OK
   ✅ File validated: archivo.csv - 150 rows, 5 columns
   📋 Columns detected: ['cliente_id', 'monto', ...]
   ```
