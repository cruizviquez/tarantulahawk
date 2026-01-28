# Guía de Implementación LFPIORPI en KYCModule

## Resumen de Cambios

Se han creado los siguientes archivos nuevos:
1. `/app/lib/lfpiorpi-types.ts` - Tipos TypeScript
2. `/app/hooks/useValidacionLFPIORPI.ts` - Hooks para validación
3. `/app/components/lfpiorpi/AlertasLFPIORPI.tsx` - Componente de alertas
4. `/app/components/lfpiorpi/AcumuladoCliente.tsx` - Componente de acumulado

## Cambios Necesarios en KYCModule.tsx

### 1. Agregar Imports (después de línea 24)

```tsx
// Componentes y hooks LFPIORPI
import { useValidacionLFPIORPI, useAcumuladoCliente } from '../../hooks/useValidacionLFPIORPI';
import { AlertasLFPIORPI, StatusValidacionLFPIORPI } from '../lfpiorpi/AlertasLFPIORPI';
import { AcumuladoCliente, AcumuladoCompacto } from '../lfpiorpi/AcumuladoCliente';
import type { ValidacionLFPIORPIResponse, OperacionValidarRequest } from '../../lib/lfpiorpi-types';
```

### 2. Eliminar/Actualizar Interfaces Existentes

ELIMINAR referencias a `clasificacion_pld` de tipo `Operacion`:
- ❌ `clasificacion_pld: string;`

ELIMINAR el ResumenOperaciones con clasificaciones:
- ❌ `clasificaciones: { relevante: number; preocupante: number; normal: number; }`

### 3. Agregar Nuevos Estados (después de líneas existentes de useState)

```tsx
// Estados de validación LFPIORPI
const [validacionActual, setValidacionActual] = useState<ValidacionLFPIORPIResponse | null>(null);
const [validandoTiempoReal, setValidandoTiempoReal] = useState(false);

// Hook de acumulado 6 meses
const { acumulado, cargando: cargandoAcumulado, recargar: recargarAcumulado } = useAcumuladoCliente(
  selectedCliente?.cliente_id || null,
  operacionForm.actividad_vulnerable
);
```

### 4. Actualizar función `crearOperacionCliente`

REEMPLAZAR el cuerpo completo de la función con:

```tsx
const crearOperacionCliente = async () => {
  if (!selectedCliente) return;
  setCreandoOperacion(true);
  setError(null);
  setSuccess(null);
  setOperacionResultado(null);
  
  try {
    const token = await getAuthToken();
    if (!token) {
      setError('Por favor inicia sesión para registrar operaciones');
      return;
    }

    if (!operacionForm.monto || Number(operacionForm.monto) <= 0) {
      setError('Ingresa un monto mayor a 0');
      setCreandoOperacion(false);
      return;
    }

    if (!operacionForm.actividad_vulnerable) {
      setError('Debes seleccionar una actividad vulnerable (Art. 17 LFPIORPI)');
      setCreandoOperacion(false);
      return;
    }

    // PASO 1: Preparar request de validación
    const validacionRequest: OperacionValidarRequest = {
      operacion: {
        cliente_id: selectedCliente.cliente_id,
        fecha_operacion: new Date(`${operacionForm.fecha_operacion}T${operacionForm.hora_operacion}`).toISOString(),
        hora_operacion: operacionForm.hora_operacion,
        actividad_vulnerable: operacionForm.actividad_vulnerable,
        tipo_operacion: operacionForm.tipo_operacion,
        monto: Number(operacionForm.monto),
        moneda: operacionForm.moneda,
        metodo_pago: operacionForm.metodo_pago,
        producto_servicio: operacionForm.actividad_vulnerable,
        descripcion: operacionForm.descripcion || undefined
      },
      cliente: {
        cliente_id: selectedCliente.cliente_id,
        nombre: selectedCliente.nombre_completo,
        rfc: selectedCliente.rfc || undefined,
        curp: selectedCliente.curp || undefined,
        tipo_persona: selectedCliente.tipo_persona,
        sector_actividad: selectedCliente.sector_actividad,
        estado: selectedCliente.estado || 'CDMX',
        origen_recursos: selectedCliente.origen_recursos || 'desconocido',
        origen_recursos_documentado: !!selectedCliente.origen_recursos,
        monto_mensual_estimado: selectedCliente.monto_total || 0,
        en_lista_uif: selectedCliente.en_lista_uif || false,
        en_lista_ofac: selectedCliente.en_lista_ofac || false,
        en_lista_csnu: selectedCliente.en_lista_csnu || false,
        en_lista_69b: selectedCliente.en_lista_69b || false,
        es_pep: selectedCliente.es_pep || false,
        beneficiario_controlador_identificado: selectedCliente.tipo_persona === 'moral' ? false : true
      },
      operaciones_historicas: operacionesDelCliente.map(op => ({
        folio_interno: op.folio_interno,
        cliente_id: selectedCliente.cliente_id,
        fecha_operacion: op.fecha_operacion,
        monto: op.monto,
        actividad_vulnerable: op.actividad_vulnerable || 'servicios_generales'
      }))
    };

    // PASO 2: Validar primero
    const respValidacion = await fetch('/api/operaciones/validar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validacionRequest)
    });

    if (!respValidacion.ok) {
      const errorData = await respValidacion.json().catch(() => ({}));
      throw new Error(errorData?.detail || `Error en validación: ${respValidacion.status}`);
    }

    const validacion: ValidacionLFPIORPIResponse = await respValidacion.json();
    setValidacionActual(validacion);

    // PASO 3: Verificar si está bloqueada
    if (validacion.debe_bloquearse) {
      setError('⛔ OPERACIÓN BLOQUEADA: ' + validacion.recomendacion);
      setCreandoOperacion(false);
      return;
    }

    // PASO 4: Si pasa validación, crear operación
    const payload = {
      cliente_id: selectedCliente.cliente_id,
      fecha_operacion: operacionForm.fecha_operacion,
      hora_operacion: operacionForm.hora_operacion,
      tipo_operacion: operacionForm.tipo_operacion,
      monto: Number(operacionForm.monto),
      moneda: operacionForm.moneda,
      metodo_pago: operacionForm.metodo_pago,
      actividad_vulnerable: operacionForm.actividad_vulnerable,
      ubicacion_operacion: operacionForm.ubicacion_operacion || null,
      descripcion: operacionForm.descripcion || null,
      referencia_factura: operacionForm.referencia_factura || null,
      banco_origen: operacionForm.banco_origen || null,
      numero_cuenta: operacionForm.numero_cuenta || null,
      notas_internas: operacionForm.notas_internas || null
    };

    const resp = await fetch('/api/operaciones', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data?.error || `Error HTTP ${resp.status}`);
    }

    const folio = data?.operacion?.folio_interno || data?.operacion_id;
    setOperacionResultado({ folio, clasificacion: validacion.recomendacion, alertas: validacion.alertas });
    
    setSuccess(`✅ Operación ${folio} creada exitosamente. ${validacion.recomendacion}`);
    
    // Recargar datos
    await cargarOperacionesDelCliente(selectedCliente.cliente_id);
    await cargarClientes();
    await recargarAcumulado();
    
  } catch (e: any) {
    setError(e?.message || 'No se pudo crear la operación');
  } finally {
    setCreandoOperacion(false);
  }
};
```

### 5. Agregar Validación en Tiempo Real

AGREGAR nueva función después de `crearOperacionCliente`:

```tsx
// Validación en tiempo real mientras usuario escribe
const validarEnTiempoReal = useCallback(async () => {
  if (!selectedCliente || !operacionForm.monto || Number(operacionForm.monto) <= 0 || !operacionForm.actividad_vulnerable) {
    setValidacionActual(null);
    return;
  }

  setValidandoTiempoReal(true);
  try {
    const validacionRequest: OperacionValidarRequest = {
      operacion: {
        cliente_id: selectedCliente.cliente_id,
        fecha_operacion: new Date(`${operacionForm.fecha_operacion}T${operacionForm.hora_operacion}`).toISOString(),
        hora_operacion: operacionForm.hora_operacion,
        actividad_vulnerable: operacionForm.actividad_vulnerable,
        tipo_operacion: operacionForm.tipo_operacion,
        monto: Number(operacionForm.monto),
        moneda: operacionForm.moneda,
        metodo_pago: operacionForm.metodo_pago,
        producto_servicio: operacionForm.actividad_vulnerable
      },
      cliente: {
        cliente_id: selectedCliente.cliente_id,
        nombre: selectedCliente.nombre_completo,
        rfc: selectedCliente.rfc || undefined,
        tipo_persona: selectedCliente.tipo_persona,
        sector_actividad: selectedCliente.sector_actividad,
        estado: selectedCliente.estado || 'CDMX',
        origen_recursos: selectedCliente.origen_recursos || 'desconocido',
        origen_recursos_documentado: !!selectedCliente.origen_recursos,
        monto_mensual_estimado: selectedCliente.monto_total || 0,
        en_lista_uif: selectedCliente.en_lista_uif || false,
        en_lista_ofac: selectedCliente.en_lista_ofac || false,
        en_lista_csnu: selectedCliente.en_lista_csnu || false,
        en_lista_69b: selectedCliente.en_lista_69b || false,
        es_pep: selectedCliente.es_pep || false
      },
      operaciones_historicas: operacionesDelCliente.map(op => ({
        folio_interno: op.folio_interno,
        cliente_id: selectedCliente.cliente_id,
        fecha_operacion: op.fecha_operacion,
        monto: op.monto,
        actividad_vulnerable: op.actividad_vulnerable || 'servicios_generales'
      }))
    };

    const resp = await fetch('/api/operaciones/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validacionRequest)
    });

    if (resp.ok) {
      const validacion: ValidacionLFPIORPIResponse = await resp.json();
      setValidacionActual(validacion);
    }
  } catch (err) {
    console.error('Error en validación tiempo real:', err);
  } finally {
    setValidandoTiempoReal(false);
  }
}, [selectedCliente, operacionForm, operacionesDelCliente]);

// Ejecutar validación cuando cambien campos relevantes
useEffect(() => {
  const timer = setTimeout(() => {
    validarEnTiempoReal();
  }, 500); // Debounce de 500ms

  return () => clearTimeout(timer);
}, [validarEnTiempoReal]);
```

### 6. Actualizar JSX del Formulario

En la sección del formulario de operaciones (línea ~2686), AGREGAR después de la sección de "Actividad Vulnerable":

```tsx
        {/* VALIDACIÓN EN TIEMPO REAL */}
        {validandoTiempoReal && (
          <div className="flex items-center gap-2 text-sm text-blue-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
            Validando operación...
          </div>
        )}

        {/* MOSTRAR VALIDACIÓN */}
        {validacionActual && (
          <AlertasLFPIORPI
            validacion={validacionActual}
            monto={Number(operacionForm.monto)}
            actividad={operacionForm.actividad_vulnerable}
            umbralUMA={actividadesVulnerables.find(a => a.id === operacionForm.actividad_vulnerable)?.aviso_uma}
          />
        )}

        {/* MOSTRAR ACUMULADO 6 MESES */}
        {selectedCliente && operacionForm.actividad_vulnerable && (
          <AcumuladoCliente
            acumulado={acumulado}
            cargando={cargandoAcumulado}
            umbralAvisoUMA={actividadesVulnerables.find(a => a.id === operacionForm.actividad_vulnerable)?.aviso_uma}
          />
        )}
      </div>
```

### 7. Actualizar Botón de Guardar

REEMPLAZAR el botón submit para que esté deshabilitado si la operación está bloqueada:

```tsx
<button
  type="submit"
  disabled={creandoOperacion || (validacionActual?.debe_bloquearse === true)}
  className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all font-medium ${
    validacionActual?.debe_bloquearse 
      ? 'bg-red-500/20 text-red-400 border border-red-500 cursor-not-allowed opacity-60'
      : 'bg-emerald-500 text-white hover:bg-emerald-600'
  } disabled:opacity-50`}
  title={validacionActual?.debe_bloquearse ? 'Operación bloqueada por LFPIORPI' : ''}
>
  {creandoOperacion ? (
    <>
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
      Guardando...
    </>
  ) : validacionActual?.debe_bloquearse ? (
    <>
      <XCircle className="w-5 h-5" />
      Operación Bloqueada
    </>
  ) : (
    <>
      <CheckCircle className="w-5 h-5" />
      Guardar Operación
    </>
  )}
</button>
```

## Checklist de Implementación

- [x] Crear archivos de tipos y hooks
- [x] Crear componentes de alertas y acumulado
- [ ] Actualizar imports en KYCModule.tsx
- [ ] Agregar estados de validación
- [ ] Actualizar función crearOperacionCliente
- [ ] Agregar validación en tiempo real
- [ ] Actualizar JSX del formulario
- [ ] Actualizar botón de guardar
- [ ] Testear flujo completo

## Notas Importantes

1. **Eliminar clasificaciones PLD antiguas**: El sistema ya NO usa "relevante", "inusual", "preocupante"
2. **Solo UMAs, NO USD**: Todos los umbrales se manejan en UMAs
3. **5 Reglas LFPIORPI**: Umbral aviso, acumulado 6m, listas negras, efectivo prohibido, indicios ilícitos
4. **Validación en tiempo real**: Muestra alertas mientras el usuario escribe
5. **Acumulado 6 meses**: Se muestra automáticamente según la actividad seleccionada
