# Implementación LFPIORPI 2025 - Guía Integral

## 📋 Estado Actual

✅ **Backend completamente implementado:**
- `app/backend/models/config_modelos.json` - Configuración con umbrales corregidos
- `app/backend/api/utils/validador_lfpiorpi_2025.py` - Validación integral (5 reglas)
- `app/backend/api/utils/verificador_listas_negras.py` - Verificación UIF/OFAC/CSNU/69B
- `app/backend/api/utils/rastreador_acumulado_6m.py` - Acumulación 6 meses
- `app/backend/api/operaciones_api.py` - Endpoints REST con validación completa
- `app/backend/api/alertas_reportes_uif.py` - Generación de reportes para UIF

⏳ **Frontend - Requiere implementación:**
- Formulario de operaciones con campos obligatorios LFPIORPI
- Visualización de validación en tiempo real
- Panel de alertas y avisos
- Dashboard de cumplimiento normativo

---

## 🔴 REGLAS IMPLEMENTADAS (Backend)

### REGLA 1: Umbral de Aviso (Art. 23 LFPIORPI)
```
SI: monto_operacion >= umbral_aviso_UMA(actividad)
ENTONCES: Requiere Aviso Mensual a UIF (antes del 17 del mes siguiente)
```

**Thresholds 2025 (UMA: $113.14 MXN):**
- Joyería/Metales: 3,210 UMAs = $363,179 MXN
- Vehículos: 3,210 UMAs = $363,179 MXN
- Inmuebles: 16,050 UMAs = $1,816,297 MXN
- Criptomonedas: 210 UMAs = $23,759 MXN ⚠️ (Bajó 67%)
- Juegos/Apuestas: 6,420 UMAs = $726,359 MXN
- Otros: Ver `config_modelos.json`

**Backend:** `validador_lfpiorpi_2025.verificar_umbral_aviso()`

---

### REGLA 2: Acumulación 6 Meses (Art. 17 + Art. 7 Reglamento)
```
SI: (acumulado_6m + operacion_nueva) >= umbral_aviso_UMA
ENTONCES: Requiere Aviso Mensual a UIF
```

Sumar todas las operaciones del cliente en últimos 180 días por actividad vulnerable.

**Backend:** `rastreador_acumulado_6m.verificar_proximidad_umbral()`

---

### REGLA 3: Listas Negras → BLOQUEO INMEDIATO (Art. 24)
```
SI: cliente EN [lista_uif, lista_ofac, lista_csnu, lista_69b]
ENTONCES: 
  - BLOQUEAR operación
  - Aviso 24 horas a UIF
  - NO permitir procesar
```

Verificar ANTES de permitir cualquier operación.

**Backend:** `POST /api/kyc/validar-listas` (sistema existente)

**Listas verificadas:**
- 🇲🇽 UIF (SAT México)
- 🇺🇸 OFAC (USA Treasury)
- 🇺🇳 CSNU (Naciones Unidas)
- 🇲🇽 Lista 69B (Reforma jul-2025)
- 👤 PEP (Persona Expuesta Políticamente)

---

### REGLA 4: Efectivo Prohibido (Art. 32 LFPIORPI)
```
SI: metodo_pago = "efectivo" AND monto >= limite_efectivo_UMA
ENTONCES: BLOQUEAR operación
```

Límites de efectivo por actividad:
- Inmuebles: 8,025 UMAs = $908,149 MXN
- Joyería/Vehículos: 3,210 UMAs = $363,179 MXN
- Juegos/Apuestas: 1,605 UMAs = $181,590 MXN
- Otras: Ver config

**Backend:** `validador_lfpiorpi_2025.verificar_limite_efectivo()`

---

### REGLA 5: Indicios Procedencia Ilícita (Art. 24)
```
SI: detectar indicios de fuente ilícita
ENTONCES: Aviso 24 horas a UIF
```

**Señales analizadas:**
- 2+ operaciones similares en 7 días (fragmentación)
- Origen recursos NO documentado
- Desviación extrema del perfil (3σ+)
- Cliente en lista sospechosa (SAT)
- Actividad inconsistente con perfil

**Backend:** `validador_lfpiorpi_2025.verificar_indicios_ilicitos()`

---

## 🗃️ FLUJO GUARDADO DE OPERACIÓN

```
1. Usuario ingresa datos en formulario
   ↓
2. Frontend valida campos obligatorios
   ↓
3. Frontend envía POST /api/operaciones/crear
   ↓
4. Backend ejecuta:
   a) Verificar listas negras
      → SI está en listas: BLOQUEAR + Aviso 24h
   b) Verificar límite efectivo
      → SI excede: BLOQUEAR
   c) Obtener acumulado 6 meses
   d) Verificar umbral aviso (individual + acumulado)
   e) Verificar indicios procedencia ilícita
   f) Calcular EBR del cliente
   g) Consolidar alertas
   ↓
5. Backend responde:
   {
     "exito": true,
     "operacion_id": "OP-...",
     "debe_bloquearse": false,
     "requiere_aviso_uif": true/false,
     "requiere_aviso_24hrs": true/false,
     "alertas": [...],
     "score_ebr": 52,
     "recomendacion": "⚠️ Requiere aviso mensual"
   }
   ↓
6. Frontend:
   - SI bloqueada: Mostrar error rojo + no guardar
   - SI valid: Guardar + mostrar resumen de alertas
   - Mostrar recomendaciones de acción
```

---

## 📊 CAMPOS OBLIGATORIOS POR TIPO DE OPERACIÓN

### Todos los casos:
```json
{
  "cliente_id": "string (requerido)",
  "fecha_operacion": "datetime (requerido)",
  "hora_operacion": "HH:MM:SS (requerido)",
  "actividad_vulnerable": "string (16 opciones Art. 17)",
  "tipo_operacion": "venta|compra|arrendamiento|etc",
  "monto": "float > 0",
  "moneda": "MXN|USD|EUR|CNY",
  "metodo_pago": "efectivo|transferencia|cheque|tarjeta|deposito",
  "producto_servicio": "string (obligatorio)",
  "descripcion": "string (recomendado)"
}
```

### Campos opcionales pero útiles:
```json
{
  "factura_numero": "para auditoría",
  "referencia_pago": "para rastreo",
  "banco_origen": "si es transferencia",
  "notas_internas": "para equipo de compliance"
}
```

---

## 🎨 CAMBIOS FRONTEND NECESARIOS

### 1. **Formulario de Operaciones** (`/app/kyc/operaciones`)

**Estructura:**
```
┌─────────────────────────────────────────────────────────┐
│  NUEVA OPERACIÓN - Validación LFPIORPI 2025             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CLIENTE                                                │
│  ├─ [Selector: Cliente_ID]                             │
│  ├─ [Automático: Nombre/Datos]                         │
│  ├─ [Automático: EBR Score] ← Color según riesgo      │
│  └─ [Botón: Verificar Listas] → Modal de resultado    │
│                                                         │
│  OPERACIÓN                                              │
│  ├─ Fecha: [_______] Hora: [________]                 │
│  ├─ Actividad Vulnerable: [Dropdown - 16 opciones]    │
│  ├─ Tipo Operación: [venta|compra|arrendamiento...]   │
│  ├─ Monto: [$_________] MXN                           │
│  └─ Método Pago:                                       │
│     ├─ [ ] Efectivo                                    │
│     ├─ [ ] Transferencia                               │
│     ├─ [ ] Cheque                                      │
│     └─ [ ] Otra                                        │
│                                                         │
│  VALIDACIÓN EN TIEMPO REAL                             │
│  ├─ Umbral Aviso: $363,179 (3,210 UMAs)               │
│  ├─ Acumulado 6m: $150,000 [Botón: +$400k = ?]       │
│  ├─ Límite Efectivo: $363,179 [⚠️ Si efect.]         │
│  └─ Status: ✅ Verde | ⚠️ Amarillo | 🔴 Rojo          │
│                                                         │
│  ALERTAS (si aplican)                                  │
│  ├─ 📊 EBR: 52/100 (Riesgo ALTO) ← Análisis cliente  │
│  └─ ⚠️ Requiere Aviso Mensual a UIF                   │
│                                                         │
│  [GUARDAR]  [CANCELAR]  [VALIDAR ANTES DE GUARDAR]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Funcionalidades clave:**
1. Selector dinámico de cliente (autocomplete + búsqueda)
2. Mostrar datos de cliente (nombre, RFC, estado, sector)
3. Mostrar EBR score en tiempo real con color
4. Validación en tiempo real mientras escribe
5. Mostrar umbrales relevantes cuando selecciona actividad
6. Botón "Verificar Listas" para búsqueda manual
7. Si efectivo: mostrar límite de efectivo permitido
8. Validar al guardar antes de enviar

### 2. **Dashboard de Acumulados** 

```
ACUMULADO 6 MESES - Cliente: Juan Pérez García
┌────────────────────────────────────────────────────┐
│  ACTIVIDADES VULNERABLES                           │
├────────────────────────────────────────────────────┤
│                                                    │
│ 💎 Joyería/Metales                                │
│    Acumulado: $280,000 / $363,179 umbral (77%)   │
│    Operaciones: 3 en últimos 180 días              │
│    Fechas: 2025-01-05, 2025-01-15, 2025-01-25     │
│    Status: ⚠️ Próximo a umbral                     │
│                                                    │
│ 🏠 Inmuebles                                       │
│    Acumulado: $500,000 / $1,816,297 umbral (27%)  │
│    Status: ✅ Bajo control                         │
│                                                    │
│ 🚗 Vehículos                                       │
│    Acumulado: $0 (sin operaciones)                 │
│                                                    │
└────────────────────────────────────────────────────┘

[BOTÓN: Análisis de Patrones] → Detecta estructuración
```

### 3. **Panel de Alertas**

```
ALERTAS Y AVISOS A UIF
┌─────────────────────────────────────────────────────┐
│ FILTROS: [Tipo ▼] [Estado ▼] [Período ▼] [Buscar] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 🔴 OPERACIÓN BLOQUEADA - ALT-20250127120000-0001  │
│   Cliente: Carlos López (en Lista 69B)              │
│   Operación: Venta vehículo - $250,000              │
│   Mandatorio: AVISO 24 HORAS a UIF (Art. 24)       │
│   Estado: 🔴 PENDIENTE - Enviar urgente             │
│   [Botón: Generar Aviso 24h] [VER DETALLES]        │
│                                                     │
│ ⚠️ AVISO MENSUAL PENDIENTE - ALT-20250125080000-...│
│   Cliente: Juan Pérez García                        │
│   Operación: Venta joyería - $380,000               │
│   Razón: Supera umbral de aviso (3,210 UMAs)       │
│   Estado: ⌛ Para incluir en aviso mensual          │
│   Mes: Enero 2025 (plazo: antes 17 de febrero)     │
│   [Botón: VER DETALLES] [MARCAR REVISADA]          │
│                                                     │
│ ✅ CONFIRMADA - ALT-20250120150000-...             │
│   Cliente: María García                             │
│   Estado: Confirmada por SAT el 2025-01-25          │
│   Referencia: REP-MENSUAL-202501-...                │
│                                                     │
└─────────────────────────────────────────────────────┘

ESTADÍSTICAS
├─ Total Alertas: 45
├─ Pendientes de envío: 8
├─ 24 horas urgentes: 2 ⚠️
├─ Confirmadas: 35
└─ Tasa confirmación: 77.8%
```

### 4. **Panel de Reportes a UIF**

```
REPORTES MENSUALES PARA UIF
┌──────────────────────────────────────────────────────┐
│                                                      │
│ 📄 ENERO 2025 - Aviso Mensual                       │
│   Estado: 📋 Generado, pendiente envío               │
│   Operaciones reportables: 12                        │
│   Monto total: $4,850,000 MXN (42,850 UMAs)         │
│   Clientes afectados: 9                              │
│   Plazo SAT: Antes del 17 de febrero 2025           │
│   [Botón: VER DETALLES] [Descargar JSON] [Enviar]  │
│                                                      │
│ ✅ DICIEMBRE 2024 - Aviso Mensual                   │
│    Estado: ✅ Enviado 2024-12-31                     │
│    Acuse SAT: REP-MENSUAL-202412-001                │
│    [VER DETALLES] [Ver acuse SAT]                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🔌 INTEGRACIÓN BACKEND-FRONTEND

### Endpoint: `POST /api/operaciones/crear`

```typescript
// Request
{
  "operacion": {
    "cliente_id": "CLI-123",
    "fecha_operacion": "2025-01-27T10:30:00Z",
    "hora_operacion": "10:30:00",
    "actividad_vulnerable": "VI_joyeria_metales",
    "tipo_operacion": "venta",
    "monto": 400000,
    "moneda": "MXN",
    "metodo_pago": "transferencia",
    "producto_servicio": "Venta de joyas de oro"
  },
  "cliente": {
    "cliente_id": "CLI-123",
    "nombre": "Juan Pérez García",
    "rfc": "PEGJ800101AAA",
    "tipo_persona": "fisica",
    "sector_actividad": "joyeria_metales",
    "estado": "CDMX",
    "en_lista_uif": false,
    "en_lista_69b": false,
    "origin_recursos": "actividad_profesional",
    "origen_recursos_documentado": true
  },
  "operaciones_historicas": [
    {
      "folio_interno": "OP-2025-001",
      "cliente_id": "CLI-123",
      "fecha_operacion": "2025-01-05",
      "monto": 100000,
      "actividad_vulnerable": "VI_joyeria_metales"
    }
  ]
}

// Response
{
  "exito": true,
  "operacion_id": "OP-20250127103000-3423",
  "mensaje": "Operación guardada ✅ - REQUIERE AVISO MENSUAL A UIF (Art. 23)",
  "validacion": {
    "operacion_id": "OP-20250127103000-3423",
    "es_valida": true,
    "debe_bloquearse": false,
    "requiere_aviso_uif": true,
    "requiere_aviso_24hrs": false,
    "alertas": [
      "⚠️ Acumulado 6 meses supera umbral de aviso: 500,000 UMAs >= 3,210 UMAs ($363,179 MXN)"
    ],
    "fundamentos_legales": [
      "Art. 17 LFPIORPI (párrafo final) + Art. 7 Reglamento: Acumulación de operaciones en 6 meses."
    ],
    "score_ebr": 52,
    "recomendacion": "⚠️ Requiere Aviso Mensual a UIF (supera umbral)"
  },
  "timestamp": "2025-01-27T10:30:00Z"
}
```

### Endpoint: `GET /api/operaciones/cliente/{cliente_id}/acumulado-6m`

```typescript
// Response
{
  "cliente_id": "CLI-123",
  "fecha_reporte": "2025-01-27T10:30:00Z",
  "periodo": {
    "desde": "2024-08-02T00:00:00Z",
    "hasta": "2025-01-27T10:30:00Z",
    "dias": 180
  },
  "resumen": {
    "total_operaciones": 5,
    "monto_acumulado_umas": 4423.91,
    "monto_acumulado_mxn": 500000
  },
  "actividades_detectadas": ["VI_joyeria_metales"],
  "montos_por_actividad": {
    "VI_joyeria_metales": 500000
  },
  "montos_por_tipo_pago": {
    "transferencia": 350000,
    "efectivo": 150000
  },
  "alerta": {
    "umbral_alcanzado": true,
    "umbral_relevante": "3,210 UMAs (Art. 17 VI)",
    "fundamento_legal": "Art. 23 LFPIORPI..."
  }
}
```

### Endpoint: `POST /api/operaciones/validar`

Validar sin guardar (pre-validación en formulario)

---

## 📱 CAMBIOS EN COMPONENTES EXISTENTES

### `/app/kyc/page.tsx` (Pestaña Clientes KYC)
```diff
- Agregar columna: "EBR Score" con color
- Agregar botón: "Verificar Listas"
- Agregar botón: "Ver Operaciones" 
- Agregar columna: "Alertas Activas" (contador)
- Abrir modal con details al hacer click
```

### `/app/dashboard/` (Dashboard Principal)
```diff
+ Nueva sección: "Resumen Cumplimiento LFPIORPI"
  - Total operaciones procesadas (mes)
  - Avisos generados (mensuales + 24h)
  - Clientes en listas (riesgo crítico)
  - EBR promedio de cliente base
  - Próximo plazo SAT (17 del mes)

+ Nueva pestaña: "Tablerode Operaciones"
  - Listar operaciones del período
  - Filtros: estado, actividad, cliente, riesgo
  - Columnas: fecha, cliente, monto, actividad, status
  - Colores: Verde (ok), Amarillo (advertencia), Rojo (crítico)

+ Nueva pestaña: "Alertas y Avisos"
  - Ver todas las alertas activas
  - Generar reportes
  - Enviar a SAT (cuando esté integrado API)
```

---

## 🚀 FASES DE IMPLEMENTACIÓN FRONTEND

### FASE 1: Componentes Base
- Formulario de nueva operación
- Selector de cliente con búsqueda
- Validación de campos obligatorios

### FASE 2: Integración Backend
- Llamadas a `/api/operaciones/validar` en tiempo real
- Mostrar validación LFPIORPI
- Handleres de bloqueadores

### FASE 3: Dashboards
- Panel de acumulados 6m
- Panel de alertas
- Estadísticas de cumplimiento

### FASE 4: Reportes
- Generación de avisos mensuales
- Exportar JSON/XML
- Integración SAT (cuando API disponible)

---

## ⚡ EJEMPLO: Validar Operación en Frontend

```typescript
// hooks/useValidarOperacion.ts
import { useState } from 'react';

export function useValidarOperacion() {
  const [validacion, setValidacion] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const validar = async (operacionData) => {
    setCargando(true);
    try {
      const response = await fetch('/api/operaciones/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operacionData)
      });

      if (!response.ok) throw new Error('Error validación');
      
      const resultado = await response.json();
      setValidacion(resultado);
      
      // Mostrar alertas si aplican
      if (resultado.debe_bloquearse) {
        setError(`🔴 OPERACIÓN BLOQUEADA: ${resultado.alertas[0]}`);
      } else if (resultado.requiere_aviso_24hrs) {
        setError(`⚠️ 24 HORAS: ${resultado.alertas[0]}`);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return { validacion, cargando, error, validar };
}
```

```tsx
// components/FormularioOperacion.tsx
export function FormularioOperacion() {
  const { validacion, validar } = useValidarOperacion();
  const [formData, setFormData] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    
    // Validar en tiempo real
    if (formData.cliente_id && formData.monto) {
      validar({
        operacion: newData,
        cliente: {...}, // Datos del cliente
        operaciones_historicas: [...] // Ops previas
      });
    }
  };

  return (
    <form>
      <input name="cliente_id" onChange={handleChange} />
      <input name="monto" type="number" onChange={handleChange} />
      
      {/* Mostrar validación */}
      {validacion && (
        <div className={validacion.debe_bloquearse ? 'rojo' : 'verde'}>
          <h4>{validacion.recomendacion}</h4>
          {validacion.alertas.map(a => <p key={a}>{a}</p>)}
          {validacion.score_ebr > 50 && (
            <p>📊 EBR: {validacion.score_ebr}/100</p>
          )}
        </div>
      )}
      
      <button disabled={validacion?.debe_bloquearse}>
        Guardar
      </button>
    </form>
  );
}
```

---

## 📋 CHECKLIST IMPLEMENTACIÓN

- [ ] Frontend: Formulario nueva operación
- [ ] Frontend: Selector cliente con datos
- [ ] Frontend: Validación en tiempo real
- [ ] Frontend: Mostrar EBR score
- [ ] Frontend: Panel acumulados 6m
- [ ] Frontend: Panel alertas activas
- [ ] Backend: Integrar módulos en FastAPI
- [ ] Backend: Conectar BD para operaciones históricas
- [ ] Backend: Conectar BD para clientes (listas)
- [ ] Testing: Casos de bloqueo (listas)
- [ ] Testing: Casos de umbral aviso
- [ ] Testing: Casos de efectivo prohibido
- [ ] Testing: Acumulado 6m correcto
- [ ] Testing: EBR cálculo correcto
- [ ] Documentación: Guía usuario
- [ ] Capacitación: Equipo compliance

---

## 📞 REFERENCIAS LEGALES CLAVE

- **LFPIORPI** (Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita)
  - Art. 17: Operaciones de monto elevado
  - Art. 23: Aviso mensual operaciones
  - Art. 24: Aviso 24 horas procedencia ilícita
  - Art. 32: Limitación pago efectivo
  
- **Reglamento LFPIORPI**
  - Art. 7: Acumulación 6 meses
  - Art. 25: Informe de ausencia

- **Reforma Julio 2025**
  - Incluye verificación Lista 69B (SAT)
  - Reforma criptmonedas (aviso: 210 UMAs)
  - Actualiza PEP procedure

---

**Documento generado:** 2025-01-27
**Versión:** 2025.01
**Autor:** TarantulaHawk Compliance Team
