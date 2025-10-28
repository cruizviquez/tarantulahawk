# TarantulaHawk - Sistema de Créditos USD Implementado

## ✅ Componentes Completados

### 1. Base de Datos (Supabase)

**Migración:** `supabase/migrations/20251026000000_add_credit_system.sql`

- ✅ Columna `account_balance_usd` en tabla `profiles`
- ✅ Tabla `transaction_history` para auditoría
- ✅ Función `deduct_credits()` - Deducción atómica con locks
- ✅ Función `add_credits()` - Agregar créditos (compras/recargas)
- ✅ RLS policies configuradas
- ✅ Índices para performance

**Migrar usuarios existentes:** Todos los usuarios free reciben $1,500 USD inicial

### 2. Frontend (Next.js)

**Endpoints API:**
- ✅ `/api/credits/deduct` - Deducir créditos
- ✅ `/api/credits/add` - Agregar créditos
- ✅ `/api/credits/balance` - Consultar balance
- ✅ `/api/paypal/capture` - Modificado para agregar créditos en vez de cambiar tier

**Componentes:**
- ✅ `app/dashboard/page.tsx` - Dashboard protegido con autenticación
- ✅ `app/components/complete_portal_ui.tsx` - Portal UI integrado con props reales
- ✅ `app/lib/auth.ts` - Helpers de autenticación server-side

**Auth Flow:**
- ✅ `app/auth/callback/page.tsx` - Da $1,500 USD a nuevos usuarios
- ✅ Redirige a `/dashboard` después de verificación

### 3. Backend (Python FastAPI)

**Ubicación:** `app/backend/`

**Archivos Creados:**
- ✅ `api/utils/supabase_integration.py` - Integración con Next.js API
- ✅ `api/routes/credit_aware_routes.py` - Endpoints con verificación de créditos
- ✅ `requirements.txt` - Dependencias Python
- ✅ `.env.backend.example` - Variables de entorno
- ✅ `start_backend.sh` - Script de inicio
- ✅ `INTEGRATION.md` - Documentación completa

**Funcionalidad:**
- ✅ Verificar balance antes de procesar
- ✅ Deducir créditos vía Next.js API
- ✅ Retornar 402 si créditos insuficientes
- ✅ Calcular costo por tiers ($1/$0.75/$0.50 por transacción según volumen)

### 4. Configuración

**Variables de Entorno:**
- ✅ `.env.local` - Agregada `NEXT_PUBLIC_BACKEND_API_URL`
- ✅ `.env.backend.example` - Template para backend Python

## 📋 Checklist de Deployment

### Pre-requisitos
- [ ] **Ejecutar migración en Supabase:**
  - Ir a Supabase Dashboard → SQL Editor
  - Copiar contenido de `supabase/migrations/20251026000000_add_credit_system.sql`
  - Ejecutar
  - Verificar: `SELECT account_balance_usd FROM profiles LIMIT 1;`

### Backend Python
- [ ] Instalar Python 3.10+
- [ ] Crear `.env.backend` (copiar desde `.env.backend.example`)
- [ ] Instalar dependencias: `pip install -r app/backend/requirements.txt`
- [ ] Dar permisos: `chmod +x app/backend/start_backend.sh`
- [ ] Iniciar: `cd app/backend && ./start_backend.sh`
- [ ] Verificar: `curl http://localhost:8000/health`

### Frontend Next.js
- [ ] Verificar `.env.local` tiene todas las variables
- [ ] Instalar dependencias si falta: `npm install`
- [ ] Iniciar dev server: `npm run dev`
- [ ] Verificar: `http://localhost:3000/dashboard`

### Testing
- [ ] Registrarse vía onboarding
- [ ] Verificar email y entrar al dashboard
- [ ] Verificar que muestra balance $1,500
- [ ] Subir archivo CSV de prueba
- [ ] Verificar deducción de $1.00
- [ ] Verificar nuevo balance en UI

## 💰 Modelo de Créditos

### Pricing
- **Crédito inicial:** configurable (ej.: $500 USD para pruebas)
- **Costo por transacción (pago por uso):**
  - 1-2,000: $1.00 c/u
  - 2,001-5,000: $0.75 c/u
  - 5,001-10,000: $0.50 c/u
  - 10,001+: $0.35 c/u
- **Recarga:** PayPal/Stripe (montos: $100, $500, $1,000 y personalizado)

> La estructura de precios es unificada y centralizada. No se usa más PRICING_MODEL.

## 🔄 Flujo Completo

```
1. Usuario se registra → Recibe $1,500 USD
2. Usuario sube archivo en /dashboard
3. Frontend envía a Python backend
4. Backend verifica créditos (Next.js API)
5a. Si tiene créditos:
  - Calcula costo por tiers y deduce del balance
    - Procesa análisis ML
    - Retorna resultados
5b. Si NO tiene créditos:
    - Retorna 402 Payment Required
    - Frontend muestra modal PayPal
    - Usuario compra créditos
    - Frontend recarga página
```

## 🚀 Próximos Pasos

### Inmediato
1. Ejecutar migración SQL en Supabase
2. Probar flujo completo localmente
3. Verificar deducción de créditos funciona

### Corto Plazo
- Conectar modelos ML reales en `credit_aware_routes.py`
- Implementar historial de análisis persistente
- Agregar dashboard de administración

### Largo Plazo
- Rate limiting por usuario
- Webhooks PayPal para recargas automáticas
- Notificaciones de saldo bajo
- Sistema de promociones/cupones

## 📝 Notas Importantes

### Backwards Compatibility
Las columnas antiguas (`free_reports_used`, `tx_limit_free`) se mantienen para compatibilidad pero están marcadas como DEPRECATED en la migración.

### Seguridad
- Todas las operaciones de créditos usan `SECURITY DEFINER` functions
- Row Level Security (RLS) habilitado
- Service role key solo en servidor
- Transacciones atómicas con locks

### Performance
- Índices en `transaction_history` para queries rápidas
- Funciones PostgreSQL optimizadas
- Rate limiting en Next.js API

## 🐛 Troubleshooting

**Error: Column "account_balance_usd" does not exist**
→ No ejecutaste la migración. Ver Pre-requisitos arriba.

**Error: "Failed to verify user balance"**
→ Next.js no está corriendo o `NEXTJS_API_URL` mal configurado.

**Balance no se actualiza en UI**
→ Hacer refresh del dashboard después de análisis.

**Backend no conecta con Next.js**
→ Verificar CORS en `enhanced_main_api.py` incluye localhost:3000.

## 📞 Comandos Útiles

```bash
# Ver balance de un usuario en Supabase
SELECT email, account_balance_usd FROM profiles WHERE email = 'tu@email.com';

# Ver historial de transacciones
SELECT * FROM transaction_history WHERE user_id = 'uuid' ORDER BY created_at DESC;

# Agregar créditos manualmente (testing)
UPDATE profiles SET account_balance_usd = 1500 WHERE email = 'tu@email.com';

# Probar deducción
SELECT * FROM deduct_credits(
  'user-uuid'::uuid, 
  1.00, 
  'aml_report', 
  'Test deduction'
);
```

---

**Estado:** ✅ Sistema completamente implementado y listo para testing
**Autor:** GitHub Copilot
**Fecha:** 26 de Octubre, 2025
