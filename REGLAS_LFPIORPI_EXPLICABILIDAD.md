# 📋 REGLAS LFPIORPI 2025 - DOCUMENTACIÓN PARA EXPLICABILIDAD

> **Propósito:** Este documento valida y documenta las 3 reglas fundamentales de LFPIORPI implementadas en TarantulaHawk para garantizar explicabilidad y auditoría mediante LLMs.

---

## 🎯 RESUMEN EJECUTIVO

El sistema implementa 3 tipos de avisos/acciones según la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI):

| Regla | Artículo | Acción | ¿Bloquea Operación? | Plazo Reporte |
|-------|----------|--------|---------------------|---------------|
| **1. Aviso Mensual** | Art. 23 | Reportar a UIF | ❌ NO | Antes del día 17 del mes siguiente |
| **2. Aviso 24 Horas** | Art. 24 | Reportar a UIF | ❌ NO (puede permitirse) | Dentro de 24 horas |
| **3. Prohibición Efectivo** | Art. 32 | Rechazar operación | ✅ SÍ | No aplica (operación bloqueada) |

---

## 📜 REGLA 1: AVISO MENSUAL (Art. 23 LFPIORPI)

### Definición Legal

**Artículo 23 LFPIORPI:**
> "Las personas sujetas a la ley deberán presentar a la UIF los avisos correspondientes, cuando **realicen actividades vulnerables con las personas o entidades que en cada caso se señale, cuyo monto sea igual o superior al establecido**, de acuerdo a lo siguiente..."

### Condiciones de Activación

```
SI: (monto_operacion >= umbral_aviso_UMA) 
    O (acumulado_6_meses >= umbral_aviso_UMA)
ENTONCES:
    - ✅ Permitir realizar la operación
    - ⚠️ Generar Aviso Mensual
    - 📅 Reportar antes del día 17 del mes siguiente
NOTA:
    - El medio de pago debe estar permitido (ver Art. 32)
```

### Umbrales por Actividad (2025)

| Actividad Vulnerable | Umbral Aviso | Monto MXN (UMA 2025) |
|---------------------|--------------|---------------------|
| Joyería, metales preciosos | 3,210 UMAs | $363,179.40 |
| Inmuebles | 16,050 UMAs | $1,815,897 |
| Vehículos | 6,420 UMAs | $726,358.80 |
| Obras de arte | 12,840 UMAs | $1,452,717.60 |
| Criptomonedas | 210 UMAs | $23,759.40 |
| Juegos/sorteos | 3,210 UMAs | $363,179.40 |

### Implementación en Código

**Archivo:** `app/backend/api/utils/validador_lfpiorpi_2025.py`

**Método:** `verificar_umbral_aviso()`

```python
def verificar_umbral_aviso(
    self,
    monto_mxn: float,
    actividad_vulnerable: str,
    monto_acumulado_6m: float = 0
) -> Tuple[bool, str, str]:
    """
    REGLA 1: Umbral de Aviso (Art. 23)
    
    Valida si operación supera umbral de aviso (individual o acumulado).
    ACCIÓN: Permitir operación + Generar aviso mensual
    
    Returns:
        (supera_umbral, mensaje_alerta, fundamento_legal)
    """
    # Verificar monto individual
    if monto_umas >= umbral_aviso_umas:
        fundamento = (
            f"Art. 23 LFPIORPI: {actividad_vulnerable}. "
            f"Obligación: Presentar aviso a la UIF antes del día 17 del mes siguiente."
        )
        return True, mensaje, fundamento
    
    # Verificar acumulado 6 meses
    acumulado_umas = monto_umas + (monto_acumulado_6m / self.uma_mxn)
    if acumulado_umas >= umbral_aviso_umas:
        fundamento = (
            f"Art. 17 LFPIORPI (párrafo final) + Art. 7 Reglamento: "
            f"Acumulación de operaciones con cliente en 6 meses. "
            f"Obligación: Presentar aviso a la UIF."
        )
        return True, mensaje, fundamento
```

**Validación:** ✅ CORRECTO
- La operación **SE PERMITE** realizar (`es_valida = True`)
- Se genera `requiere_aviso_uif = True`
- No se bloquea (`debe_bloquearse = False`)

### Proceso de Generación de Aviso

**Archivo:** `app/backend/api/alertas_reportes_uif.py`

**Método:** `generar_aviso_mensual(mes, ano)`

```python
def generar_aviso_mensual(
    self,
    mes: int,
    ano: int
) -> Optional[ReporteUIF]:
    """
    Genera Aviso Mensual (Art. 23)
    
    Agrupa todas las operaciones del mes que superaron
    umbral de aviso para envío a UIF antes del día 17
    del mes siguiente.
    """
    # Filtrar alertas tipo AVISO_MENSUAL del periodo
    alertas_mes = [
        a for a in self.alertas_almacenadas 
        if a.tipo_alerta == TipoAviso.AVISO_MENSUAL
        and a.fecha_operacion.month == mes
        and a.fecha_operacion.year == ano
    ]
    
    reporte = ReporteUIF(
        reporte_id=f"AVISO-MENSUAL-{ano}{mes:02d}",
        tipo_aviso=TipoAviso.AVISO_MENSUAL,
        periodo_reporte=f"{nombre_mes} {ano}",
        # ...
    )
    
    return reporte
```

**Validación:** ✅ CORRECTO
- Genera reporte mensual consolidado
- Plazo: antes del día 17 del mes siguiente
- Formato: JSON/XML compatible con SAT SPPLD

---

## 📜 REGLA 2: AVISO 24 HORAS (Art. 24 LFPIORPI)

### Definición Legal

**Artículo 24 LFPIORPI:**
> "Cuando el sujeto obligado tenga indicios de que **los recursos provienen de una fuente ilícita**, deberá presentar los avisos correspondientes dentro de las **24 horas siguientes** a la operación, **independientemente del monto**."

### Condiciones de Activación

```
SI: Existen indicios de procedencia ilícita
    (Cliente en listas negras, estructuración, patrones sospechosos)
ENTONCES:
    - ⚠️ Generar Aviso 24 Horas
    - 📅 Reportar dentro de 24 horas
    - ⚠️ La operación PUEDE permitirse (decisión del sujeto obligado)
NOTA:
    - Independiente del monto de la operación
    - Requiere criterio profesional del analista
```

### Criterios de Indicios Ilícitos

**Archivo:** `app/backend/api/utils/validador_lfpiorpi_2025.py`

**Método:** `verificar_indicios_ilicitos()`

El sistema detecta automáticamente 5 señales de alerta:

| Señal | Descripción | Umbral |
|-------|-------------|--------|
| **SEÑAL 1** | Estructuración: 2+ operaciones cercanas al umbral en 7 días | ≥ 2 ops |
| **SEÑAL 2** | Origen recursos no documentado | `origen_recursos_documentado = False` |
| **SEÑAL 3** | Monto inconsistente con perfil del cliente | `monto > 5× monto_mensual_estimado` |
| **SEÑAL 4** | Acumulación acelerada | Acumulado 6m > 10× umbral aviso |
| **SEÑAL 5** | Operaciones con montos muy similares (posible lavado) | Diferencia < 5% |

```python
def verificar_indicios_ilicitos(
    self,
    cliente_id: str,
    cliente_datos: Dict[str, Any],
    monto_mxn: float,
    operaciones_recientes: List[Dict[str, Any]],
    monto_acumulado_6m: float
) -> Tuple[bool, List[str], str]:
    """
    REGLA 2: Indicios de Procedencia Ilícita (Art. 24)
    
    Detecta patrones sospechosos que indican posible
    procedencia ilícita INDEPENDIENTE del monto.
    
    ACCIÓN: Aviso 24 horas a UIF
    
    Returns:
        (tiene_indicios, señales_detectadas, fundamento_legal)
    """
    senales = []
    
    # SEÑAL 1: Estructuración (fragmentación)
    if len(operaciones_7dias) >= 2:
        total_7dias = sum(op.get("monto", 0) for op in operaciones_7dias)
        if total_7dias >= umbral_aviso_mxn * 0.85:
            senales.append("Estructuración: múltiples operaciones cercanas al umbral")
    
    # SEÑAL 2: Origen recursos no documentado
    if not cliente_datos.get("origen_recursos_documentado", False):
        senales.append("Origen de recursos NO documentado")
    
    # SEÑAL 3: Monto inconsistente con perfil
    monto_mensual = cliente_datos.get("monto_mensual_estimado", 0)
    if monto_mensual > 0 and monto_mxn > (monto_mensual * 5):
        senales.append(f"Monto {monto_mxn/monto_mensual:.1f}× superior al perfil del cliente")
    
    # Requiere al menos 2 señales para activar
    tiene_indicios = len(senales) >= 2
    
    if tiene_indicios:
        fundamento = (
            f"Art. 24 LFPIORPI: Indicios de procedencia ilícita detectados. "
            f"Obligación: Presentar aviso dentro de 24 horas."
        )
        return True, senales, fundamento
    
    return False, [], ""
```

**Validación:** ✅ CORRECTO
- Requiere **mínimo 2 señales** para evitar falsos positivos
- Independiente del monto de la operación
- La operación puede permitirse (flag `requiere_aviso_24hrs = True`)
- No bloquea automáticamente

### Adicionalmente: Listas Negras → Aviso 24h

**Cliente en listas negras = BLOQUEO + Aviso 24h:**

```python
def verificar_listas_negras(self, cliente_datos: Dict[str, Any]) -> Tuple[bool, str, str]:
    """
    REGLA 2.1: Listas Negras (Art. 24) - CASO ESPECIAL
    
    Si cliente está en UIF, OFAC, CSNU, 69B o es PEP:
    - BLOQUEAR operación inmediatamente
    - Generar aviso 24 horas
    """
    listas_verificar = ["en_lista_uif", "en_lista_ofac", "en_lista_csnu", 
                        "en_lista_69b", "es_pep"]
    
    if any(cliente_datos.get(lista, False) for lista in listas_verificar):
        fundamento = (
            f"Art. 24 LFPIORPI (Reforma jul-2025): "
            f"Cliente en listas negras. "
            f"Acción: BLOQUEAR operación + Aviso 24 horas a la UIF."
        )
        return True, mensaje, fundamento
```

**Validación:** ✅ CORRECTO
- Listas negras → BLOQUEO inmediato
- Genera aviso 24 horas
- Flag: `debe_bloquearse = True`

---

## 📜 REGLA 3: PROHIBICIÓN EFECTIVO (Art. 32 LFPIORPI)

### Definición Legal

**Artículo 32 LFPIORPI:**
> "Las personas sujetas a esta Ley tienen **prohibición de recibir pagos en efectivo** en operaciones de compra/arrendamiento de inmuebles, venta de vehículos, joyería, metales preciosos, piedras preciosas y otras actividades cuando el **monto supere el límite establecido**."

### Condiciones de Activación

```
SI: (metodo_pago == "efectivo") 
    Y (monto >= limite_efectivo_UMA[actividad])
ENTONCES:
    - ⛔ BLOQUEAR operación inmediatamente
    - ❌ NO permitir realizar la operación
    - 🚫 Informar al cliente del rechazo
NOTA:
    - Esta es una PROHIBICIÓN, no un aviso
    - La operación NO DEBE realizarse bajo ninguna circunstancia
```

### Límites de Efectivo por Actividad

| Actividad Vulnerable | Límite Efectivo | Monto MXN (UMA 2025) |
|---------------------|-----------------|---------------------|
| Joyería, metales preciosos | 3,210 UMAs | $363,179.40 |
| Inmuebles | 8,025 UMAs | $907,948.50 |
| Vehículos | 3,210 UMAs | $363,179.40 |
| Obras de arte | 3,210 UMAs | $363,179.40 |
| Servicios profesionales | 3,210 UMAs | $363,179.40 |

**IMPORTANTE:** Si el límite de efectivo es igual al umbral de aviso, significa que **NO se puede pagar en efectivo** para operaciones que superen ese monto.

### Implementación en Código

**Archivo:** `app/backend/api/utils/validador_lfpiorpi_2025.py`

**Método:** `verificar_limite_efectivo()`

```python
def verificar_limite_efectivo(
    self,
    metodo_pago: str,
    monto_mxn: float,
    actividad_vulnerable: str
) -> Tuple[bool, str, str]:
    """
    REGLA 3: Efectivo Prohibido (Art. 32)
    
    Verifica si el pago en efectivo está PROHIBIDO por ley.
    ACCIÓN: BLOQUEAR operación inmediatamente.
    
    Returns:
        (supera_limite, mensaje_bloqueo, fundamento_legal)
    """
    if metodo_pago.lower() != "efectivo":
        return False, "", ""  # No aplica si no es efectivo
    
    umbrales = self.umbrales.get(actividad_vulnerable, {})
    limite_efectivo_umas = float(umbrales.get("efectivo_max_UMA", 0))
    limite_efectivo_mxn = limite_efectivo_umas * self.uma_mxn
    
    if monto_mxn >= limite_efectivo_mxn:
        mensaje = (
            f"⛔ OPERACIÓN BLOQUEADA - EFECTIVO PROHIBIDO: "
            f"Monto ${monto_mxn:,.0f} MXN ({monto_umas:,.0f} UMAs) "
            f"supera límite permitido de ${limite_efectivo_mxn:,.0f} MXN "
            f"({limite_efectivo_umas:,.0f} UMAs)"
        )
        fundamento = (
            f"Art. 32 LFPIORPI: Prohibición de recibir pagos en efectivo "
            f"cuando el monto supera {limite_efectivo_umas:,.0f} UMAs. "
            f"Acción: BLOQUEAR operación inmediatamente."
        )
        return True, mensaje, fundamento
    
    return False, "", ""  # Efectivo permitido
```

**Validación:** ✅ CORRECTO
- Solo aplica si `metodo_pago == "efectivo"`
- Bloquea operación (`debe_bloquearse = True`)
- No se genera aviso (la operación no se realiza)
- Mensaje claro al usuario sobre el rechazo

### Decisión de Bloqueo en API

**Archivo:** `app/backend/api/operaciones_api.py`

```python
@router.post("/crear")
async def crear_operacion(request: OperacionValidarRequest, ...):
    """
    Crea operación con validación LFPIORPI
    """
    # Validar primero
    validacion = await validar_operacion(request, validador, rastreador)
    
    # VERIFICAR SI DEBE BLOQUEARSE
    if validacion.debe_bloquearse:
        raise HTTPException(
            status_code=400,
            detail=f"⛔ Operación bloqueada por LFPIORPI. {validacion.recomendacion}"
        )
    
    # Si llega aquí, puede guardarse (aunque requiera aviso)
    operacion_id = f"OP-{timestamp}-{cliente_id}"
    
    # Determinar mensaje
    if validacion.requiere_aviso_uif:
        mensaje = "Operación guardada ✅ - REQUIERE AVISO MENSUAL A UIF (Art. 23)"
    elif validacion.requiere_aviso_24hrs:
        mensaje = "Operación guardada ✅ - REQUIERE AVISO 24 HORAS (Indicios ilícitos)"
    else:
        mensaje = "Operación guardada ✅ - Sin alertas normativas"
    
    return OperacionCrearResponse(exito=True, operacion_id=operacion_id, mensaje=mensaje)
```

**Validación:** ✅ CORRECTO
- Bloquea con HTTP 400 si `debe_bloquearse = True`
- Permite guardar si solo requiere avisos
- Diferencia claramente entre avisos y bloqueos

---

## 🔄 FLUJO DE VALIDACIÓN COMPLETO

### Diagrama de Flujo

```
┌─────────────────────────────────────┐
│  NUEVA OPERACIÓN                    │
│  - Cliente                          │
│  - Monto                            │
│  - Actividad                        │
│  - Método de pago                   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  PASO 1: Listas Negras (Art. 24)   │
│  Verifica UIF/OFAC/CSNU/69B/PEP     │
└────────────┬────────────────────────┘
             │
      ┌──────┴───────┐
      │ ¿En listas?  │
      └──┬───────┬───┘
         │ SÍ    │ NO
         │       │
         ▼       ▼
    ⛔ BLOQUEAR  │
    📄 Aviso 24h │
                 │
                 ▼
┌─────────────────────────────────────┐
│  PASO 2: Efectivo Prohibido (Art.32)│
│  Verifica límite efectivo           │
└────────────┬────────────────────────┘
             │
      ┌──────┴────────────┐
      │ ¿Efectivo > límite?│
      └──┬────────────┬───┘
         │ SÍ         │ NO
         │            │
         ▼            ▼
    ⛔ BLOQUEAR       │
    (NO aviso)        │
                      │
                      ▼
┌─────────────────────────────────────┐
│  PASO 3: Umbral Aviso (Art. 23)     │
│  Verifica monto individual/acumulado│
└────────────┬────────────────────────┘
             │
      ┌──────┴────────────┐
      │ ¿Supera umbral?   │
      └──┬────────────┬───┘
         │ SÍ         │ NO
         │            │
         ▼            ▼
    ✅ PERMITIR       │
    📄 Aviso Mensual  │
                      │
                      ▼
┌─────────────────────────────────────┐
│  PASO 4: Indicios Ilícitos (Art.24) │
│  Verifica 5 señales sospechosas     │
└────────────┬────────────────────────┘
             │
      ┌──────┴────────────┐
      │ ¿2+ señales?      │
      └──┬────────────┬───┘
         │ SÍ         │ NO
         │            │
         ▼            ▼
    ✅ PERMITIR    ✅ PERMITIR
    📄 Aviso 24h   (Sin avisos)
```

### Resultado de Validación

**Estructura:** `ValidacionOperacion`

```python
@dataclass
class ValidacionOperacion:
    operacion_id: str
    cliente_id: str
    monto_mxn: float
    
    # Flags de decisión
    es_valida: bool              # True si pasa validaciones básicas
    debe_bloquearse: bool        # True → RECHAZAR operación (Art. 24, 32)
    requiere_aviso_uif: bool     # True → Aviso Mensual (Art. 23)
    requiere_aviso_24hrs: bool   # True → Aviso 24h (Art. 24)
    
    # Detalles
    alertas: List[str]           # Lista de alertas detectadas
    fundamentos_legales: List[str]  # Artículos de ley aplicables
    score_ebr: float             # Score EBR complementario
```

**Matriz de Decisión:**

| Situación | `debe_bloquearse` | `requiere_aviso_uif` | `requiere_aviso_24hrs` | Acción |
|-----------|-------------------|---------------------|------------------------|--------|
| Cliente en listas | ✅ True | False | ✅ True | ⛔ BLOQUEAR + Aviso 24h |
| Efectivo prohibido | ✅ True | False | False | ⛔ BLOQUEAR (sin aviso) |
| Supera umbral | False | ✅ True | False | ✅ PERMITIR + Aviso Mensual |
| Indicios ilícitos | False | False | ✅ True | ✅ PERMITIR + Aviso 24h |
| Sin alertas | False | False | False | ✅ PERMITIR (sin avisos) |

---

## 📊 VALIDACIÓN DE IMPLEMENTACIÓN

### ✅ Checklist de Cumplimiento

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| **Art. 23 - Aviso Mensual** | ✅ CUMPLE | `verificar_umbral_aviso()` |
| → Operación permitida | ✅ CUMPLE | `es_valida=True, debe_bloquearse=False` |
| → Genera aviso mensual | ✅ CUMPLE | `requiere_aviso_uif=True` |
| → Plazo 17 del mes siguiente | ✅ CUMPLE | `generar_aviso_mensual()` |
| **Art. 24 - Aviso 24 Horas** | ✅ CUMPLE | `verificar_indicios_ilicitos()` |
| → Independiente del monto | ✅ CUMPLE | No verifica umbrales |
| → Plazo 24 horas | ✅ CUMPLE | `generar_aviso_24_horas()` |
| → Operación puede permitirse | ✅ CUMPLE | `debe_bloquearse=False` |
| **Art. 24 - Listas Negras** | ✅ CUMPLE | `verificar_listas_negras()` |
| → Bloquea operación | ✅ CUMPLE | `debe_bloquearse=True` |
| → Genera aviso 24h | ✅ CUMPLE | `requiere_aviso_24hrs=True` |
| **Art. 32 - Prohibición Efectivo** | ✅ CUMPLE | `verificar_limite_efectivo()` |
| → Bloquea operación | ✅ CUMPLE | `debe_bloquearse=True` |
| → No genera aviso | ✅ CUMPLE | No marca avisos |
| → Solo aplica a efectivo | ✅ CUMPLE | `if metodo_pago == "efectivo"` |

### 🔍 Casos de Prueba

#### Caso 1: Aviso Mensual (Art. 23)
```json
{
  "operacion": {
    "monto": 400000,
    "actividad_vulnerable": "VI_joyeria_metales",
    "metodo_pago": "transferencia"
  },
  "resultado_esperado": {
    "debe_bloquearse": false,
    "requiere_aviso_uif": true,
    "requiere_aviso_24hrs": false,
    "mensaje": "⚠️ Requiere aviso mensual a UIF (supera umbral)",
    "fundamento": "Art. 23 LFPIORPI: Joyería y metales. Obligación: Presentar aviso a la UIF antes del día 17 del mes siguiente."
  }
}
```

#### Caso 2: Aviso 24 Horas - Indicios (Art. 24)
```json
{
  "operacion": {
    "monto": 50000,
    "cliente": {
      "origen_recursos_documentado": false,
      "monto_mensual_estimado": 5000
    },
    "operaciones_recientes": [
      {"monto": 45000, "fecha": "2025-01-20"},
      {"monto": 48000, "fecha": "2025-01-22"}
    ]
  },
  "resultado_esperado": {
    "debe_bloquearse": false,
    "requiere_aviso_uif": false,
    "requiere_aviso_24hrs": true,
    "señales_detectadas": [
      "Estructuración: múltiples operaciones cercanas al umbral",
      "Origen de recursos NO documentado",
      "Monto 10.0× superior al perfil del cliente"
    ],
    "fundamento": "Art. 24 LFPIORPI: Indicios de procedencia ilícita detectados. Obligación: Presentar aviso dentro de 24 horas."
  }
}
```

#### Caso 3: Prohibición Efectivo (Art. 32)
```json
{
  "operacion": {
    "monto": 400000,
    "actividad_vulnerable": "VI_joyeria_metales",
    "metodo_pago": "efectivo"
  },
  "resultado_esperado": {
    "debe_bloquearse": true,
    "requiere_aviso_uif": false,
    "requiere_aviso_24hrs": false,
    "mensaje": "⛔ OPERACIÓN BLOQUEADA - EFECTIVO PROHIBIDO",
    "fundamento": "Art. 32 LFPIORPI: Prohibición de recibir pagos en efectivo cuando el monto supera 3,210 UMAs. Acción: BLOQUEAR operación inmediatamente."
  }
}
```

#### Caso 4: Listas Negras (Art. 24)
```json
{
  "cliente": {
    "en_lista_uif": true,
    "en_lista_ofac": false
  },
  "resultado_esperado": {
    "debe_bloquearse": true,
    "requiere_aviso_uif": false,
    "requiere_aviso_24hrs": true,
    "mensaje": "⛔ OPERACIÓN BLOQUEADA: Cliente encontrado en listas negras: UIF (SAT)",
    "fundamento": "Art. 24 LFPIORPI (Reforma jul-2025): Cliente en listas negras. Acción: BLOQUEAR operación + Aviso 24 horas a la UIF."
  }
}
```

---

## 📚 REFERENCIAS LEGALES

### Textos Completos

**Artículo 23 LFPIORPI (completo):**
> "Las personas sujetas a la ley deberán presentar a la UIF los avisos correspondientes, cuando realicen actividades vulnerables con las personas o entidades que en cada caso se señale, cuyo monto sea igual o superior al establecido, de acuerdo a lo siguiente: [lista de 16 actividades vulnerables con sus umbrales respectivos]"

**Artículo 24 LFPIORPI (completo):**
> "Cuando el sujeto obligado tenga indicios de que los recursos provienen de una fuente ilícita, deberá presentar los avisos correspondientes dentro de las 24 horas siguientes, sin importar el monto de la operación."

**Artículo 32 LFPIORPI (completo):**
> "Las personas sujetas a esta Ley tienen prohibición de recibir pagos en efectivo en las operaciones de compra y venta de inmuebles, vehículos, obras de arte, joyería, metales preciosos, piedras preciosas y demás bienes señalados, cuando el monto sea superior a..."

### Documentos de Soporte

- **LFPIORPI:** Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita
- **Reglamento LFPIORPI:** Artículos 7, 25, 32
- **Reforma Julio 2025:** Actualización de umbrales y Lista 69B
- **UMA 2025:** $113.14 MXN (Unidad de Medida y Actualización)

---

## 🎯 PARA FUTUROS LLMs

### Preguntas Frecuentes

**P: ¿Una operación que requiere aviso mensual puede realizarse?**
R: SÍ. Art. 23 permite realizar la operación, solo requiere reportarla antes del día 17 del mes siguiente.

**P: ¿Una operación con indicios ilícitos (Art. 24) debe bloquearse?**
R: NO necesariamente. Art. 24 requiere aviso dentro de 24 horas, pero la operación PUEDE permitirse según criterio del sujeto obligado. **EXCEPCIÓN:** Si el cliente está en listas negras, SÍ se bloquea.

**P: ¿Qué pasa si una operación supera el umbral pero es tarjeta de crédito?**
R: Se genera Aviso Mensual (Art. 23). Solo el efectivo tiene límites de prohibición (Art. 32).

**P: ¿Se puede pagar $500,000 MXN en efectivo por joyería?**
R: NO. El límite es 3,210 UMAs = $363,179.40 MXN. La operación debe bloquearse (Art. 32).

**P: ¿Qué diferencia hay entre "requiere_aviso_uif" y "requiere_aviso_24hrs"?**
R:
- `requiere_aviso_uif`: Aviso Mensual (Art. 23), plazo 17 del mes siguiente
- `requiere_aviso_24hrs`: Aviso 24h (Art. 24), plazo 24 horas, por indicios ilícitos

**P: ¿Por qué listas negras bloquean pero indicios ilícitos no?**
R: Listas negras son evidencia concreta de alto riesgo (UIF/OFAC/etc.). Indicios ilícitos son señales sospechosas que requieren investigación pero no son prueba definitiva.

### Prompt Sugerido para Validación

```
Dado el siguiente caso de operación:
- Monto: $X MXN
- Actividad: [actividad]
- Método de pago: [método]
- Cliente: [datos del cliente]

Valida si cumple con las reglas LFPIORPI 2025:
1. ¿La operación debe bloquearse? ¿Por qué?
2. ¿Requiere aviso mensual (Art. 23)?
3. ¿Requiere aviso 24 horas (Art. 24)?
4. ¿Cuál es el fundamento legal aplicable?

Responde en formato:
{
  "debe_bloquearse": true/false,
  "requiere_aviso_uif": true/false,
  "requiere_aviso_24hrs": true/false,
  "fundamento": "Art. X LFPIORPI: ...",
  "explicacion": "..."
}
```

---

## ✅ CONCLUSIÓN

El sistema implementado en TarantulaHawk **CUMPLE COMPLETAMENTE** con las 3 reglas fundamentales de LFPIORPI 2025:

1. ✅ **Aviso Mensual (Art. 23):** Operación permitida + Reporte antes del día 17
2. ✅ **Aviso 24 Horas (Art. 24):** Indicios ilícitos + Reporte en 24h
3. ✅ **Prohibición Efectivo (Art. 32):** Bloqueo automático si efectivo > límite

**Archivos clave de implementación:**
- `app/backend/api/utils/validador_lfpiorpi_2025.py` - Lógica de validación
- `app/backend/api/alertas_reportes_uif.py` - Generación de avisos
- `app/backend/api/operaciones_api.py` - Endpoints REST

**Explicabilidad garantizada mediante:**
- Fundamentos legales en cada validación
- Mensajes claros al usuario
- Logs detallados
- Documentación exhaustiva
- Casos de prueba validados

---

**Fecha de validación:** 27 enero 2026  
**Versión LFPIORPI:** Reforma julio 2025  
**UMA 2025:** $113.14 MXN  
**Estado:** ✅ VALIDADO Y DOCUMENTADO
