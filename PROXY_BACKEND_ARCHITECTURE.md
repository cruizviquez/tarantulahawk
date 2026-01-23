# Arquitectura de Proxy Backend con Route Handlers

## Resumen del Cambio

Se ha eliminado la dependencia directa del rewrite `/api/kyc → backend` en `next.config.ts` y se ha reemplazado con **Route Handlers en Next.js** que actúan como proxy del lado del servidor.

## ✅ Ventajas

### 1. **Mayor Estabilidad con Tunnels Estrictos**
- El navegador SOLO habla con Next.js (`localhost:3000/api/*`)
- Next.js reenvía las solicitudes al backend desde el servidor
- Menos "magia" del tunnel - comunicación más directa

### 2. **Control Total del Lado del Servidor**
- Validación de autenticación centralizada
- Transformación de requests/responses si es necesario
- Manejo consistente de errores

### 3. **Mejor Seguridad**
- El backend no queda expuesto directamente al navegador
- Todas las solicitudes pasan por autenticación Next.js
- Headers sensibles manejados desde el servidor

## 📁 Estructura de Ficheros

### Nuevos ficheros creados:

```
app/
├── lib/
│   └── proxy-backend.ts          ← Helper función para proxy genérico
├── api/
│   ├── portal/
│   │   └── [...path]/route.ts    ← Proxy para /api/portal/*
│   ├── history/
│   │   └── [...path]/route.ts    ← Proxy para /api/history/*
│   └── kyc/
│       └── clientes/route.ts     ← Ya existía (sin cambios)
```

## 🔄 Flujo de Solicitud

### Antes (Rewrite)
```
Browser → /api/portal/analyze
                ↓ (rewrite en next.config.ts)
        Backend → http://localhost:8000/api/portal/analyze
                ↓
Browser (devuelve respuesta)
```

**Problema:** Con tunnels estrictos, el rewrite puede no funcionar correctamente.

### Ahora (Route Handlers)
```
Browser → /api/portal/analyze (Next.js)
                ↓ (autentica y reenvía desde servidor)
        Backend → http://localhost:8000/api/portal/analyze
                ↓
Browser (devuelve respuesta desde Next.js)
```

**Ventaja:** Todo pasa por Next.js, túnel más simple y estable.

## 📝 Cómo Funciona el Proxy

### proxy-backend.ts (Helper)

```typescript
export async function proxyToBackend(
  request: NextRequest,
  pathSegment: string,
  options?: {
    requireAuth?: boolean;
    preserveHeaders?: string[];
  }
): Promise<NextResponse>
```

**Qué hace:**
1. Verifica autenticación (si `requireAuth: true`)
2. Obtiene la URL del backend desde `NEXT_PUBLIC_BACKEND_API_URL`
3. Construye el path correcto eliminando `/api/portal/` u `/api/history/`
4. Copia headers relevantes (Authorization, Content-Type, etc.)
5. Reenvía el request al backend
6. Devuelve la respuesta del backend al navegador

### Route Handlers

Cada ruta soporta todos los métodos HTTP:

```typescript
export async function GET(request: NextRequest) {
  return proxyToBackend(request, 'portal', { requireAuth: true });
}

export async function POST(request: NextRequest) {
  return proxyToBackend(request, 'portal', { requireAuth: true });
}
// ... PUT, PATCH, DELETE
```

## 🔐 Autenticación

Todos los endpoints están protegidos por autenticación (`requireAuth: true`) que verifica el token Bearer en el header `Authorization`.

## 🚀 Uso

**No hay cambios en el lado del cliente.** Las solicitudes funcionan exactamente igual:

```javascript
// Sigue funcionando igual
const response = await fetch('/api/portal/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: '...' })
});
```

## 📊 Endpoints Proxy Disponibles

### /api/portal/*
- `/api/portal/validate` - Validación de datos
- `/api/portal/analyze` - Análisis de archivos
- `/api/portal/results/{analysisId}` - Resultados de análisis
- `/api/portal/balance` - Saldo disponible
- `/api/portal/history` - Historial
- `/api/portal/pending-payments` - Pagos pendientes
- ... (todos los demás)

### /api/history/*
- `/api/history` - Historial general
- `/api/history/...` - Cualquier otro endpoint de history

### /api/kyc/*
- `/api/kyc/clientes` - Gestión de clientes KYC
- ... (extensible según sea necesario)

## ⚙️ Variables de Entorno

```env
# En .env.local
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
# O en producción:
NEXT_PUBLIC_BACKEND_API_URL=https://backend.example.com
```

## 🛠️ Troubleshooting

### "Backend no responde"
- Verificar que el backend esté corriendo en el puerto configurado
- Verificar `NEXT_PUBLIC_BACKEND_API_URL`
- Revisar logs de Next.js en la consola

### "401 No autorizado"
- Verificar que el token Bearer esté siendo enviado correctamente
- Revisar que el usuario tenga una sesión válida en Supabase
- Verificar `getAuthenticatedUserId()` en los logs

### "CORS errors"
- No debería haber CORS errors ya que todo se maneja del lado del servidor
- Si aparecen, revisar headers en la respuesta del backend

## 📈 Próximos Pasos Opcionales

1. **Agregar Caching**: Implementar cache de respuestas del backend
2. **Rate Limiting**: Limitar solicitudes desde el cliente
3. **Transformación de Datos**: Modificar respuestas antes de devolverlas
4. **Logging**: Agregar logging detallado de todas las solicitudes proxy
5. **Timeout**: Establecer timeouts para las solicitudes del backend

## ✅ Checklist de Validación

- [x] Crear `proxy-backend.ts` helper
- [x] Crear `/api/portal/[...path]/route.ts`
- [x] Crear `/api/history/[...path]/route.ts`
- [x] Remover rewrites de `next.config.ts`
- [x] Validar que `/api/kyc/clientes` sigue funcionando
- [ ] Probar con tunnels estrictos
- [ ] Probar todos los endpoints principales
- [ ] Actualizar documentación del equipo
