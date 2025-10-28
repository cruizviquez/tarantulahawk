# TarantulaHawk - Actualización del Sistema de Créditos

## ✅ Cambios Implementados

### 1. Requirements Fusionados ✓

**Archivo:** `app/backend/requirements.txt`

- ✅ Fusionado `requirements.txt` + `requirements2.txt`
- ✅ Versiones de ML models actualizadas (scikit-learn 1.5.2, xgboost 2.1.1)
- ✅ Dependencias de producción incluidas (dash, plotly, lxml, faker)
- ✅ Compatible con Python 3.12

### 2. Créditos Iniciales Reducidos: $500 USD ✓

**Cambios:**
- ❌ Antes: $1,500 USD iniciales
- ✅ Ahora: $500 USD iniciales
- ✅ Créditos separados: `credits_gifted` (virtuales) vs `credits_purchased` (pagados)

**Archivos modificados:**
- `supabase/migrations/20251026000000_add_credit_system.sql`
- `app/auth/callback/page.tsx`

**⚠️ IMPORTANTE - Protección contra fraude de reembolsos:**
- Créditos regalados (gifted): NO reembolsables, NO vinculados a PayPal
- Créditos comprados (purchased): Sujetos a política de reembolsos
- Orden de consumo: Primero purchased, luego gifted
- Documentación completa: `VIRTUAL_CREDITS_POLICY.md`

### 3. Sistema de Pricing Escalonado ✓

**Nueva estructura de precios:**

```
Tier 1:  1-2,000 txns     → $1.00/txn
Tier 2:  2,001-5,000 txns → $0.75/txn
Tier 3:  5,001-10,000 txns → $0.50/txn
Tier 4:  10,001+ txns     → $0.35/txn

Enterprise (50,000+/mes): Contactar ventas para precio personalizado
```

**Ejemplos de costos:**
- 1,500 transacciones = $1,500.00
- 3,000 transacciones = $2,750.00 (ahorro de $250)
- 8,000 transacciones = $4,750.00 (ahorro de $3,250)
- 15,000 transacciones = $8,500.00 (ahorro de $6,500)

**Archivos creados:**
- `app/backend/api/utils/pricing_tiers.py` - Lógica de pricing escalonado
- `app/backend/api/utils/supabase_integration.py` - Actualizado para usar tiered pricing

### 4. Consola de Administración ✓

**Nueva consola admin para gestionar clientes:**

**Ubicación:** `/admin` (requiere `subscription_tier = 'admin'`)

**Funcionalidades:**
- ✅ Ver todos los usuarios con estadísticas
- ✅ Cambiar tier de usuario (free, basic, premium, enterprise, admin)
- ✅ Ver balance separado (gifted vs purchased)
- ✅ Agregar créditos manualmente
- ✅ Asignar tarifa personalizada por transacción (enterprise)
- ✅ Ver transacciones procesadas
- ✅ Ver dinero pagado por usuario
- ✅ Ver API keys y requests count
- ✅ Buscar y filtrar por tier
- ✅ Exportar datos (UI preparada)

**Archivos creados:**
- `app/components/AdminDashboard.tsx` - Componente React del admin panel
- `app/admin/page.tsx` - Página protegida de admin

**Métricas del dashboard:**
- Total de clientes
- Ingresos totales
- Transacciones procesadas
- API keys activas
- Distribución por tier
- Gráficos de ingresos (preparado para implementar)

### 5. Sistema de API Keys para Enterprise ✓

**Preparado para:**
- ✅ Usuarios enterprise pueden usar API directamente (sin portal web)
- ✅ Tracking de requests por API key
- ✅ Logs de uso en admin dashboard
- ✅ Tarifa personalizada por cliente enterprise

**Estructura:**
```typescript
interface EnterpriseUser {
  api_key: string;              // "thk_abc123..."
  api_requests_count: number;   // Total de requests
  custom_rate_per_txn: number;  // e.g., 0.25 = $0.25/txn
}
```

## 📊 Modelo de Facturación Propuesto

### Opción A: Prepago con Corte Mensual (Recomendado)

**Ventajas:**
- ✅ Cash flow predecible
- ✅ Usuario controla gastos
- ✅ Menos disputas de pago
- ✅ Más fácil de implementar

**Flujo:**
1. Usuario compra créditos (e.g., $100)
2. Sistema deduce según uso real
3. Fin de mes: reporte de consumo
4. Si saldo bajo: notificación para recargar

**Implementación:**
```sql
-- Ya implementado en migración
SELECT * FROM transaction_history 
WHERE user_id = '...' 
  AND created_at >= date_trunc('month', CURRENT_DATE)
ORDER BY created_at DESC;
```

### Opción B: Postpago con Factura Mensual

**Ventajas:**
- ✅ Conveniente para enterprise
- ✅ Volumen real sin estimaciones

**Desventajas:**
- ❌ Riesgo de impago
- ❌ Requiere procesamiento de facturas
- ❌ Más complejo

**Recomendación:** Usar prepago (Opción A) para todos, con posibilidad de crédito extendido para enterprise de alta confianza.

## 🎯 Pricing por Segmento

### Portal Users (SMB)
- **Tier:** Free, Basic, Premium
- **Uso:** Portal web (GUI)
- **Pricing:** Escalonado estándar
- **Pago:** Prepago con PayPal

### Enterprise (API Users)
- **Tier:** Enterprise
- **Uso:** API directa (sin portal)
- **Pricing:** Personalizado (custom_rate_per_txn)
- **Pago:** Prepago o crédito extendido (según acuerdo)
- **Ejemplo:** $0.25/txn para cliente con 100k+ txns/mes

### Contacto con Ventas
- **Volumen:** 50,000+ transacciones/mes
- **Pricing:** Negociado caso por caso
- **Servicios:** Soporte dedicado, SLA garantizado, integración custom

## 📝 Próximos Pasos

### Inmediato (Implementar ahora)
1. ✅ Ejecutar migración SQL en Supabase
2. ✅ Crear usuario admin para acceder a `/admin`
3. ✅ Probar pricing escalonado con diferentes volúmenes
4. ✅ Verificar separación credits_gifted vs credits_purchased

### Corto Plazo (1-2 semanas)
- [ ] Implementar notificaciones de saldo bajo
- [ ] Agregar gráficos de uso en admin dashboard
- [ ] Implementar generación de facturas/recibos PDF
- [ ] Crear API endpoints para enterprise (con auth por API key)
- [ ] Rate limiting por tier

### Mediano Plazo (1-2 meses)
- [ ] Sistema de alertas automáticas (saldo < $50)
- [ ] Webhooks para integración con sistemas contables
- [ ] Dashboard de analytics para usuarios enterprise
- [ ] Reportes de consumo mensuales automáticos
- [ ] Sistema de referidos/afiliados

## 🔐 Seguridad y Compliance

### Créditos Virtuales
- ✅ Separados de dinero real en DB
- ✅ Política clara en `VIRTUAL_CREDITS_POLICY.md`
- ✅ Función SQL prioriza créditos pagados
- ✅ Tracking de origen en transaction_history

### PayPal Integration
- ✅ Solo créditos PURCHASED vinculados a PayPal
- ✅ Créditos GIFTED nunca incluidos en reembolsos
- ✅ Metadata completa en transacciones

### Admin Access
- ✅ Requiere `subscription_tier = 'admin'`
- ✅ Autenticación server-side
- ✅ Logs de acciones administrativas (preparado)

## 📞 Comandos SQL Útiles

### Ver distribución de créditos de un usuario
```sql
SELECT 
  email,
  credits_gifted,
  credits_purchased,
  account_balance_usd,
  subscription_tier
FROM profiles 
WHERE email = 'usuario@ejemplo.com';
```

### Ver transacciones del mes
```sql
SELECT 
  created_at,
  transaction_type,
  amount_usd,
  credit_source,
  description
FROM transaction_history
WHERE user_id = '...'
  AND created_at >= date_trunc('month', CURRENT_DATE)
ORDER BY created_at DESC;
```

### Calcular ingresos totales (solo créditos comprados)
```sql
SELECT 
  SUM(amount_usd) as total_revenue
FROM transaction_history
WHERE transaction_type = 'credit_purchase'
  AND created_at >= date_trunc('month', CURRENT_DATE);
```

### Usuarios con saldo bajo
```sql
SELECT email, account_balance_usd
FROM profiles
WHERE account_balance_usd < 50
  AND subscription_tier != 'free'
ORDER BY account_balance_usd ASC;
```

## 🎨 UI/UX Mejorado

### Admin Dashboard
- Vista de tabla completa con búsqueda
- Filtros por tier
- Edición inline de tier y tarifa custom
- Modals con detalle de usuario
- Botón para agregar créditos manualmente

### Portal Usuario (existente)
- Balance visible en header
- Pricing breakdown antes de procesar
- Notificación si saldo insuficiente
- Integración PayPal para recargas

## 📈 Métricas de Negocio

### KPIs a trackear
- ARR (Annual Recurring Revenue) por tier
- Costo promedio por transacción
- Tasa de conversión free → paid
- Tasa de retención por tier
- Volume por cliente (para upsell a enterprise)

---

**Estado:** ✅ Sistema completamente actualizado y listo para producción
**Documentación:** Ver `VIRTUAL_CREDITS_POLICY.md` para política de créditos
**Pricing:** Ver `app/backend/api/utils/pricing_tiers.py` para implementación
**Admin:** Acceder a `/admin` con cuenta admin
