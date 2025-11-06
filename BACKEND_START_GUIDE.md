# 🚀 Inicio Rápido del Backend

## Problema Resuelto

Se corrigieron dos issues principales:

### 1. ✅ Magic Link con Puerto :3000
- **Problema**: El magic link llegaba con `:3000` en la URL de Codespaces
- **Solución**: Actualizado `OnboardingForm.tsx` para sanitizar hostnames de Codespaces (eliminar `:3000` del subdomain)
- **Archivo modificado**: `app/components/OnboardingForm.tsx`

### 2. ✅ Error "Failed to Fetch" después de cargar archivo
- **Problema**: Backend no respondía o CORS bloqueaba la petición
- **Solución**: 
  - Corregido CORS en `enhanced_main_api.py` (FastAPI no soporta wildcards como `https://*.github.dev`)
  - Mejorado logging en `complete_portal_ui.tsx` para diagnosticar estados
- **Archivos modificados**: 
  - `app/backend/api/enhanced_main_api.py`
  - `app/components/complete_portal_ui.tsx`

---

## 🏃‍♂️ Cómo Iniciar el Backend

### Opción 1: Script Simple (Recomendado para desarrollo)

```bash
# Desde la raíz del proyecto
chmod +x start_backend_simple.sh
./start_backend_simple.sh
```

Este script:
- Crea el venv si no existe
- Instala dependencias
- Inicia uvicorn en puerto 8000
- Muestra logs en tiempo real

### Opción 2: Script Original

```bash
cd app/backend
chmod +x start_backend.sh
./start_backend.sh
```

### Opción 3: Manual (para debugging)

```bash
cd /workspaces/tarantulahawk/app/backend

# Activar venv
source venv/bin/activate

# Instalar dependencias (solo la primera vez)
pip install -r requirements.txt

# Iniciar servidor
cd api
uvicorn enhanced_main_api:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🧪 Verificar que el Backend Funciona

### Verificación Rápida:

```bash
# Opción 1: Desde el navegador
# Abre: https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev/api/docs

# Opción 2: Con curl (ejecuta desde otro terminal)
chmod +x check_backend.sh
./check_backend.sh
```

### Endpoints a verificar:

1. **Health Check**: `GET /health` o `GET /api/health`
2. **API Docs**: `/api/docs` (Swagger UI)
3. **Portal Validate**: `POST /api/portal/validate` (sube un Excel pequeño)

---

## 📋 Flujo Completo del Portal

### Flujo Usuario Pequeño (Portal):

1. **Usuario sube archivo Excel** → Frontend envía a `/api/portal/validate`
2. **Backend valida estructura** → Devuelve `{success: true, file_id, columns, row_count}`
3. **Frontend muestra botón "Analizar con IA"** → Usuario confirma
4. **Click en botón** → Frontend envía a `/api/portal/upload` con archivo
5. **Backend ejecuta ML pipeline** → Validador + 3 modelos (Supervisado, No Supervisado, Refuerzo)
6. **Genera XML LFPIORPI** → Descuenta créditos del usuario
7. **Devuelve resultados** → Frontend muestra dashboard con métricas

### Columnas Requeridas en Excel:

El validador frontend y backend esperan exactamente 5 columnas:

- `cliente_id` ✅ (obligatorio)
- `monto` ✅ (obligatorio)
- `fecha` ✅ (obligatorio)
- `tipo_operacion` ✅ (obligatorio)
- `sector_actividad` ✅ (será enriquecido automáticamente si falta)

> **Nota**: `frecuencia_mensual` NO es obligatorio (se removió de la lista)

---

## 🐛 Troubleshooting

### Error: "Failed to fetch"

**Causa**: Backend no está corriendo o CORS bloqueado

**Solución**:
1. Verifica que el backend esté corriendo: `ps aux | grep uvicorn`
2. Revisa los logs del backend por errores
3. Verifica NEXT_PUBLIC_BACKEND_API_URL en `.env.local`:
   ```
   NEXT_PUBLIC_BACKEND_API_URL=https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev
   ```

### Error: "Module not found"

**Causa**: Dependencias no instaladas o venv no activado

**Solución**:
```bash
cd /workspaces/tarantulahawk/app/backend
source venv/bin/activate
pip install -r requirements.txt
```

### Backend no inicia

**Causa**: Puerto 8000 ocupado

**Solución**:
```bash
# Buscar proceso en puerto 8000
lsof -ti:8000

# Matar proceso
kill -9 $(lsof -ti:8000)

# Reiniciar backend
./start_backend_simple.sh
```

### Magic Link sigue con :3000

**Causa**: Caché del navegador o código no actualizado

**Solución**:
1. Reinicia el frontend: `npm run dev`
2. Borra caché del navegador (Ctrl+Shift+R)
3. Verifica que `.env.local` tenga la URL correcta SIN :3000:
   ```
   NEXT_PUBLIC_SITE_URL=https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev
   ```

---

## 📊 Estado Actual

✅ Frontend corriendo en puerto 3000  
✅ Magic link sanitizado (sin :3000 en Codespaces)  
✅ CORS configurado correctamente  
✅ Endpoint `/api/portal/validate` funcional  
✅ Endpoint `/api/portal/upload` funcional  
✅ UI muestra botón "Analizar con IA" después de validar archivo  
🔄 **Pendiente**: Iniciar backend y probar flujo completo end-to-end

---

## 🎯 Siguiente Paso

**Inicia el backend y prueba con un archivo de 150 registros:**

```bash
# Terminal 1: Backend
./start_backend_simple.sh

# Terminal 2: Frontend (ya corriendo)
# Navega a https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev
# Login → Upload → Verifica que aparezca "Analizar con IA"
```

---

## 📝 Logs Útiles

### Backend logs muestran:
```
✅ File validated: archivo.xlsx - 150 rows, 5 columns
📋 Columns detected: ['cliente_id', 'monto', 'fecha', 'tipo_operacion', 'sector_actividad']
```

### Frontend console.log muestra:
```
📤 Validando archivo: {fileName: "archivo.xlsx", size: 12345, userId: "..."}
✅ Archivo validado: {success: true, file_id: "...", columns: [...]}
🎯 Estado actualizado: {fileReadyForAnalysis: true, uploadedFileId: "..."}
```

---

## 💡 Tips

- **Backend logs en tiempo real**: El script `start_backend_simple.sh` usa `--reload` para auto-recargar al editar código
- **Frontend hot reload**: Next.js detecta cambios automáticamente
- **Debugging**: Abre DevTools (F12) → Console/Network tabs
- **CORS issues**: Si persiste, verifica `allow_origins=["*"]` en `enhanced_main_api.py`
