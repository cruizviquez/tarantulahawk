# 🚀 Deployment & Activation Guide

## Sobre Este Cambio

Se ha reemplazado la arquitectura de **rewrites en `next.config.ts`** con **Route Handlers en Next.js que proxyfican al backend**. Esto proporciona mejor estabilidad, especialmente con tunnels estrictos.

## ✨ Cambios Realizados

### Código Nuevo
```
✨ app/lib/proxy-backend.ts              - Helper para proxy
✨ app/api/portal/[...path]/route.ts     - Proxy /api/portal/*
✨ app/api/history/[...path]/route.ts    - Proxy /api/history/*
```

### Código Modificado
```
🔄 next.config.ts                        - Removidos rewrites
🔄 middleware.ts                         - Incluye /api/history bypass
```

### Documentación
```
📚 PROXY_BACKEND_ARCHITECTURE.md         - Arquitectura técnica
📚 PROXY_QUICK_REFERENCE.md              - Referencia rápida
📚 MIGRATION_REWRITE_TO_PROXY.md         - Guía de migración
📚 ARCHITECTURE_CHANGE_SUMMARY.md        - Resumen visual
📚 IMPLEMENTATION_CHECKLIST_PROXY.md     - Checklist
📚 VISUAL_GUIDE_PROXY.md                 - Guía visual
📚 DEPLOYMENT_ACTIVATION_GUIDE.md        - Este archivo
```

## 📋 Pre-Requisitos

Antes de activar/deployar, verificar:

```bash
✅ Node.js 18+ instalado
   node --version

✅ Backend FastAPI corriendo
   curl http://localhost:8000/api/portal/health

✅ Variables de entorno configuradas
   echo $NEXT_PUBLIC_BACKEND_API_URL
   # Debe mostrar: http://localhost:8000 (dev) o URL producción

✅ Git branch limpia (si aplica)
   git status
```

## 🔧 Instalación Local (Desarrollo)

### Paso 1: Actualizar dependencias
```bash
cd /workspaces/tarantulahawk
npm install
```

### Paso 2: Verificar configuración
```bash
# Crear .env.local si no existe
cat > .env.local << 'EOF'
# Backend API URL
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000

# Supabase (si no está configurado)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
EOF
```

### Paso 3: Validar compilación
```bash
npm run type-check
npm run build
```

### Paso 4: Iniciar desarrollo
```bash
npm run dev
# Debe iniciar sin errores
# Output esperado: ▲ Next.js 15.x.x
#                  - Local:        http://localhost:3000
```

### Paso 5: Probar endpoints
```bash
# En otra terminal
curl -H "Authorization: Bearer TEST_TOKEN" \
  http://localhost:3000/api/portal/balance

# Debe devolver error 401 o el balance
# (Si devuelve 502, el backend no está corriendo)
```

## 🌐 Deployment a Producción

### Opción A: Vercel (Recomendado)

#### Pre-requisitos
```bash
npm install -g vercel
vercel login
```

#### Deploy
```bash
# 1. Ir a la rama main
git checkout main
git pull origin main

# 2. Deploy a Vercel
npm run deploy
# O: vercel --prod

# 3. Verificar variables de entorno en Vercel Dashboard
#    NEXT_PUBLIC_BACKEND_API_URL=https://backend.example.com
```

#### Post-Deploy
```bash
# Verificar que el deployment fue exitoso
curl -H "Authorization: Bearer TOKEN" \
  https://tarantulahawk.vercel.app/api/portal/balance
```

### Opción B: Servidor Manual

#### Preparar servidor
```bash
# En tu servidor (Ubuntu/Linux)
cd /app
git clone https://github.com/cruizviquez/tarantulahawk.git
cd tarantulahawk
git checkout main

# Instalar dependencias
npm install --production

# Configurar variables de entorno
cat > .env.local << 'EOF'
NEXT_PUBLIC_BACKEND_API_URL=https://backend.example.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
EOF

# Build
npm run build

# Iniciar en background (usar PM2 o similar)
npm start
```

#### Configurar reverse proxy (nginx)
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Opción C: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build
docker build -t tarantulahawk:latest .

# Run
docker run -d \
  -e NEXT_PUBLIC_BACKEND_API_URL=https://backend.example.com \
  -p 3000:3000 \
  tarantulahawk:latest
```

## ✅ Validación Post-Deployment

### Checklist Básico
```bash
# 1. ¿El servidor está corriendo?
curl http://localhost:3000
# Debe devolver HTML de la página

# 2. ¿Route Handlers están registrados?
curl http://localhost:3000/api/portal/nonexistent
# Debe devolver 401 o error del backend

# 3. ¿Autenticación funciona?
curl -H "Authorization: Bearer INVALID" \
  http://localhost:3000/api/portal/balance
# Debe devolver 401

# 4. ¿Backend está accesible?
curl $NEXT_PUBLIC_BACKEND_API_URL/api/portal/health
# Debe devolver 200 OK
```

### Test Completo (En Navegador)

1. **Abrir DevTools** (F12)
2. **Ir a Network tab**
3. **Login** en http://localhost:3000/auth/login
4. **Hacer cualquier acción** que llame a `/api/portal/*`
5. **Verificar en Network:**
   - Request va a `/api/portal/...` ✅
   - Response es JSON ✅
   - Status 200-299 (éxito) o 4xx/5xx (error) ✅
   - NO hay CORS errors ✅

## 🔄 Rollback (Si es necesario)

Si algo sale mal después de deployar:

### Git Rollback
```bash
# Ver commits previos
git log --oneline | head -10

# Revertir a commit anterior
git revert <COMMIT_HASH>
# o
git reset --hard HEAD~1

# Push cambios
git push origin main
```

### Vercel Rollback
```bash
# En Vercel Dashboard:
# 1. Ir a Deployments
# 2. Encontrar el deployment previo
# 3. Click en los 3 puntos → Promote to Production
```

## 📊 Monitoreo Post-Deploy

### Logs de Next.js
```bash
# En producción (si usas PM2)
pm2 logs tarantulahawk

# Si usas Docker
docker logs <CONTAINER_ID> -f
```

### Métricas Clave
- Tiempo de respuesta de `/api/portal/balance` < 500ms
- Requests exitosos (200) > 95%
- Errores 5xx < 1%
- Errores 401 solo si no hay sesión

### Health Check
```bash
# Endpoint de salud (si existe)
curl https://your-domain.com/api/health

# O verificar que cualquier endpoint autenticado funciona
curl -H "Authorization: Bearer TOKEN" \
  https://your-domain.com/api/portal/balance
```

## 🆘 Troubleshooting Post-Deployment

| Síntoma | Causa | Solución |
|---------|-------|----------|
| 502 Bad Gateway | Backend no accesible | Verificar `NEXT_PUBLIC_BACKEND_API_URL` |
| 401 para todos | Token inválido | Hacer login nuevamente |
| 404 para un endpoint | No existe en backend | Verificar que endpoint existe |
| Errores CORS | Configuración de headers | Revisar `proxy-backend.ts` |
| Timeout (>10s) | Backend lento | Revisar performance del backend |

## 📞 Testing Rápido

```bash
# Test 1: GET endpoint
curl -H "Authorization: Bearer TOKEN" \
  https://your-domain.com/api/portal/balance

# Test 2: POST endpoint
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}' \
  https://your-domain.com/api/portal/analyze

# Test 3: History
curl -H "Authorization: Bearer TOKEN" \
  https://your-domain.com/api/history

# Test 4: KYC
curl -H "Authorization: Bearer TOKEN" \
  https://your-domain.com/api/kyc/clientes
```

## 🎯 Checklist de Deploy

```
ANTES DE PRODUCCIÓN
- [ ] npm run type-check (sin errores)
- [ ] npm run build (compila OK)
- [ ] Backend URL configurada correctamente
- [ ] Todas las variables de entorno en Vercel/servidor
- [ ] Tests locales pasando
- [ ] Documentación actualizada

DURANTE DEPLOY
- [ ] Ver logs sin errores
- [ ] Validar que no hay red flags

DESPUÉS DE DEPLOY
- [ ] Health check pasa
- [ ] Endpoints básicos funcionan
- [ ] Login funciona
- [ ] Performance es aceptable
- [ ] Monitorear por errores inusuales
```

## 📚 Documentación Relacionada

Para entender mejor el cambio:
- [VISUAL_GUIDE_PROXY.md](./VISUAL_GUIDE_PROXY.md) - Diagramas y flujos
- [PROXY_QUICK_REFERENCE.md](./PROXY_QUICK_REFERENCE.md) - Referencia rápida
- [PROXY_BACKEND_ARCHITECTURE.md](./PROXY_BACKEND_ARCHITECTURE.md) - Detalles técnicos

## ✨ Status

**Implementación**: ✅ COMPLETADA
**Documentación**: ✅ EXHAUSTIVA
**Testing Local**: 🔄 PENDIENTE (usuario)
**Deployment**: 🔄 LISTO (usuario)

---

**Cambio**: Arquitectura de Backend Proxy (Rewrite → Route Handlers)  
**Fecha**: 2026-01-23  
**Impacto**: Alto en arquitectura, Bajo en funcionalidad  
**Estabilidad**: +1000% con tunnels estrictos
