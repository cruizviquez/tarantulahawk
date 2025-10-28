# Sistema de Créditos USD - Integración Completa

## ✅ Cambios Implementados

### 1. **Migración de Base de Datos**
- **Archivo:** `supabase/migrations/20251026000000_add_credit_system.sql`
- **Cambios:**
  - Agregada columna `account_balance_usd` a `profiles` (DECIMAL 10,2)
  - Creada tabla `transaction_history` para auditoría completa
  - Funciones PL/pgSQL: `deduct_credits()` y `add_credits()`
  - Operaciones atómicas con locks (previene race conditions)
  - RLS policies configuradas
  - Usuarios existentes en tier 'free' migran automáticamente a $1,500 USD

### 2. **Endpoints de API para Créditos**
- **`/api/credits/deduct`** (POST)
  - Deduce créditos del balance del usuario
  - Verifica saldo suficiente (402 si no hay fondos)
  - Crea registro en transaction_history
  - Uso: `$1 USD por transacción AML`

- **`/api/credits/add`** (POST)
  - Agrega créditos al balance
  - Usado para recargas PayPal, promociones, refunds
  - Crea registro de transacción

### 3. **Integración PayPal con Créditos**
- **Modificado:** `app/api/paypal/capture/route.ts`
- **Cambio:** Ahora agrega créditos USD en vez de cambiar tier
- **Ratio:** 1:1 (pagar $15 USD = recibir $15 en créditos)
- **Flujo:**
  1. Usuario paga con PayPal (e.g., $15 USD)
  2. Verificación server-side del orden
  3. Llamada a `add_credits()` con metadata del pago
  4. Audit log registra compra
  5. Respuesta incluye `creditsAdded` y `newBalance`

### 4. **Auth Callback - Créditos Iniciales**
- **Modificado:** `app/auth/callback/page.tsx`
- **Cambio:** Nuevos usuarios reciben $1,500 USD automáticamente
- **Campos guardados:** name, company, account_balance_usd
- **Redirige:** `/dashboard` (en vez de homepage)
- **Mensaje:** "Has recibido $1,500 USD en créditos iniciales"

### 5. **Portal UI Integrado**
- **Nuevo:** `app/dashboard/page.tsx` (ruta protegida)
- **Auth:** `getAuthUser()` y `getUserProfile()` en `app/lib/auth.ts`
- **Componente:** `complete_portal_ui.tsx` adaptado para props reales
- **Props pasadas:**
  - `id`, `email`, `name`, `company`
  - `balance` (muestra créditos USD)
  - `subscription_tier`
- **Funcionalidad:** 
  - Upload de archivos
  - Dashboard de análisis
  - Historial de transacciones
  - API keys (enterprise)
  - Pagos con PayPal

### 6. **Variables de Entorno**
- **Agregado:** `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000/api`
- **Uso:** El portal UI llama al backend Python

---

## 🔧 Para Completar la Integración

### 1. **Ejecutar Migración en Supabase**
```sql
-- En Supabase SQL Editor, ejecutar:
-- /workspaces/tarantulahawk/supabase/migrations/20251026000000_add_credit_system.sql
```

### 2. **Backend Python API (Pendiente)**
Necesitas crear/subir los archivos del backend:

```
backend/
├── main_api.py                  # FastAPI app
├── api/
│   ├── routes/
│   │   ├── portal.py           # POST /portal/upload
│   │   ├── analysis.py         # GET /analysis/:id
│   │   ├── history.py          # GET /history
│   │   ├── payment.py          # POST /payment/process
│   │   └── enterprise.py       # GET /enterprise/api-keys
│   ├── utils/
│   │   ├── ml_models.py        # Modelos de ML (3 capas)
│   │   ├── supabase_client.py  # Cliente Supabase
│   │   └── credit_manager.py   # Llamadas a /api/credits/*
│   └── models/
│       ├── transaction.py      # Schemas Pydantic
│       └── analysis.py
└── requirements.txt
```

**Endpoints que el portal UI espera:**
- `POST /api/portal/upload` - Sube CSV, deduce $1 USD, procesa con ML
- `POST /api/payment/process` - Procesa pago pendiente
- `GET /api/analysis/:id` - Retorna resultados de análisis
- `GET /api/history` - Historial de análisis del usuario
- `GET /api/enterprise/api-keys` - Lista API keys (tier enterprise)

### 3. **Lógica de Deducción en Backend**
En cada análisis ML, el backend debe:

```python
import httpx

async def process_transaction(user_id: str, file_data):
    # 1. Llamar a Next.js para deducir créditos
    response = await httpx.post(
        f"{NEXTJS_URL}/api/credits/deduct",
        json={
            "userId": user_id,
            "amount": 1.00,  # $1 USD por transacción
            "transactionType": "aml_report",
            "description": f"AML analysis: {file_data.filename}",
            "metadata": {"filename": file_data.filename}
        }
    )
    
    if response.status_code == 402:  # Insufficient funds
        return {"error": "Saldo insuficiente", "requiere_pago": True}
    
    # 2. Procesar con ML models
    results = await run_ml_analysis(file_data)
    
    # 3. Guardar en DB
    await save_analysis(user_id, results)
    
    return {"success": True, "results": results}
```

### 4. **Prueba del Flujo Completo**
1. Usuario se registra → recibe $1,500 USD
2. Accede `/dashboard` → ve balance: $1,500.00
3. Sube archivo CSV → backend deduce $1 → balance: $1,499.00
4. Después de 1500 transacciones → balance: $0.00
5. Intenta otra transacción → Error 402 → modal PayPal
6. Paga $15 USD → recibe $15 créditos → balance: $15.00

---

## 📊 Modelo de Negocio

### Créditos Iniciales
- **Free Tier:** $1,500 USD (1,500 transacciones)
- **Ventaja:** Usuarios prueban el servicio sin límite artificial de "3 reportes"

### Costo por Transacción
- **$1 USD** por análisis AML
- Deducción automática en cada upload

### Recargas
- **PayPal:** Cualquier monto (mínimo $5, sugerido $15/$50/$100)
- **Ratio:** 1:1 (sin markup)
- **Opciones futuras:** Descuentos por volumen, planes mensuales

### Historial Transparente
- Tabla `transaction_history` registra:
  - Tipo: aml_report, credit_purchase, refund, adjustment
  - Balance antes/después
  - Metadata (filename, payment info, etc.)
- Usuario puede ver cada transacción en el portal

---

## 🚀 Siguiente Paso

**Ejecuta la migración:**
```bash
# Copiar contenido de:
cat supabase/migrations/20251026000000_add_credit_system.sql

# Ir a: https://supabase.com/dashboard/project/jhjlxjaicjorzeaqdbsv/sql
# Pegar y ejecutar
```

**Luego, súbeme los archivos del backend Python** o dime cómo quieres estructurarlo y yo lo creo.
