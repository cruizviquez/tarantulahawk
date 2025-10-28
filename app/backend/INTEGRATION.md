# TarantulaHawk Backend Integration Guide

## Sistema de Créditos USD

### Arquitectura

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Next.js        │      │  Python FastAPI  │      │  Supabase       │
│  Frontend       │◄────►│  Backend         │◄────►│  PostgreSQL     │
│  (Port 3000)    │      │  (Port 8000)     │      │  (Credits DB)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

### Flujo de Créditos

1. **Usuario sube archivo** → Frontend envía a Python backend
2. **Backend verifica créditos** → Llama a `/api/credits/balance`
3. **Si tiene créditos suficientes**:
   - Backend deduce créditos vía `/api/credits/deduct`
   - Backend procesa el análisis ML
   - Retorna resultados
4. **Si créditos insuficientes**:
   - Retorna error 402 (Payment Required)
   - Frontend muestra modal de PayPal
   - Usuario compra créditos
   - Backend recarga y procesa

### Modelo de Precios

**Nuevo modelo (2025):**
- **Crédito inicial**: $1,500 USD (usuarios nuevos)
- **Costo por análisis**: $1.00 USD (modelo flat rate)
- **Recarga**: PayPal ($15, $50, $100, custom)

**Alternativa per-transaction:**
- $0.01 por transacción analizada
- Configurar `PRICING_MODEL=per_transaction` en `.env.backend`

### Configuración Backend

**1. Instalar dependencias:**
```bash
cd app/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**2. Configurar variables de entorno:**
```bash
cp .env.backend.example .env.backend
# Editar NEXTJS_API_URL si no es localhost
```

**3. Iniciar servidor:**
```bash
chmod +x start_backend.sh
./start_backend.sh
```

### Endpoints Principales

#### `/api/portal/upload` (POST)
Sube archivo CSV/Excel para análisis AML.

**Headers:**
- `X-User-ID`: ID del usuario de Supabase

**Request:**
```bash
curl -X POST http://localhost:8000/api/portal/upload \
  -H "X-User-ID: user-uuid-here" \
  -F "file=@transactions.csv"
```

**Response (éxito - 200):**
```json
{
  "success": true,
  "analysis_id": "abc-123",
  "resumen": {
    "total_transacciones": 1500,
    "preocupante": 12,
    "inusual": 52,
    "relevante": 225,
    "limpio": 1211
  },
  "cost": 1.00,
  "credits_deducted": 1.00,
  "new_balance": 1499.00
}
```

**Response (créditos insuficientes - 402):**
```json
{
  "success": false,
  "requires_payment": true,
  "cost": 1.00,
  "current_balance": 0.50,
  "amount_needed": 0.50,
  "message": "Insufficient credits"
}
```

### Integración con Frontend

**Portal UI** (`complete_portal_ui.tsx`) ya está configurado para:
1. Detectar error 402
2. Mostrar modal de PayPal
3. Recargar créditos
4. Reintentar análisis

**Ejemplo de uso:**
```typescript
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/portal/upload`, {
    method: 'POST',
    headers: { 'X-User-ID': user.id },
    body: formData
  });

  if (response.status === 402) {
    // Créditos insuficientes
    const data = await response.json();
    showPaymentModal(data.amount_needed);
  } else {
    // Análisis completado
    const results = await response.json();
    displayResults(results);
  }
};
```

### Base de Datos

**Tabla `profiles`:**
```sql
- account_balance_usd: DECIMAL(10,2)  -- Balance en USD
- subscription_tier: TEXT             -- free, basic, premium, enterprise
```

**Tabla `transaction_history`:**
```sql
- user_id: UUID
- transaction_type: TEXT              -- aml_report, credit_purchase
- amount_usd: DECIMAL(10,2)
- balance_before: DECIMAL(10,2)
- balance_after: DECIMAL(10,2)
- created_at: TIMESTAMPTZ
```

### Migración a Producción

**Pasos:**

1. **Ejecutar migración SQL en Supabase:**
   ```sql
   -- Ver: supabase/migrations/20251026000000_add_credit_system.sql
   ```

2. **Configurar CORS en backend:**
   ```python
   allow_origins=["https://tarantulahawk.cloud"]
   ```

3. **Actualizar URLs:**
   - `.env.backend`: `NEXTJS_API_URL=https://tarantulahawk.cloud/api`
   - `.env.local`: `NEXT_PUBLIC_BACKEND_API_URL=https://api.tarantulahawk.cloud/api`

4. **Deploy backend:**
   - Railway, Render, o EC2
   - Asegurar que pueda llamar a Next.js API

5. **Probar flujo completo:**
   - Registro → Onboarding → Dashboard → Upload → Análisis
   - Verificar deducción de créditos en Supabase

### Testing Local

**1. Next.js (Terminal 1):**
```bash
cd /workspaces/tarantulahawk
npm run dev
```

**2. Python Backend (Terminal 2):**
```bash
cd /workspaces/tarantulahawk/app/backend
./start_backend.sh
```

**3. Probar:**
```bash
# Verificar health
curl http://localhost:8000/health

# Ver docs interactivos
open http://localhost:8000/api/docs
```

### Troubleshooting

**Error: "Failed to verify user balance"**
- Verificar que Next.js esté corriendo en puerto 3000
- Verificar `NEXTJS_API_URL` en `.env.backend`

**Error: "User not found"**
- Usuario debe estar registrado vía onboarding
- Verificar que ID de usuario existe en Supabase

**Error: "Insufficient credits"**
- Normal si balance < $1.00
- Agregar créditos manualmente o vía PayPal

**Agregar créditos manualmente (testing):**
```sql
-- En Supabase SQL Editor
UPDATE profiles 
SET account_balance_usd = 1500.00 
WHERE email = 'tu-email@test.com';
```

### Próximos Pasos

- [ ] Conectar modelos ML reales en `credit_aware_routes.py`
- [ ] Implementar persistencia de análisis en DB
- [ ] Agregar rate limiting por usuario
- [ ] Implementar webhooks de PayPal para recargas automáticas
- [ ] Dashboard de administración para ver uso de créditos
