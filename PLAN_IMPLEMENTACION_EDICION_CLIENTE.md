# Plan de Implementación Técnica: Edición Segura de Clientes

## Estado Actual vs. Requerimientos

### 1. AUDITORÍA DE CLIENTES - ESTADO ACTUAL

#### ✅ YA IMPLEMENTADO
```javascript
// auditoria_clientes tabla existente con:
- usuario_id (quién hizo el cambio)
- accion (CREAR, EDITAR, ELIMINAR)
- razon (por qué)
- fecha_accion
- ip_usuario
- user_agent

Ejemplo: Cuando se elimina una operación, se registra:
{
  "usuario_id": "user123",
  "cliente_id": "client456",
  "accion": "ELIMINAR",
  "razon": "Datos incorrectos",
  "fecha_accion": "2026-01-27T10:30:00Z",
  "ip_usuario": "192.168.1.1",
  "user_agent": "Mozilla/5.0..."
}
```

#### ⚠️ BRECHA IDENTIFICADA
- **NO hay auditoría de EDICIÓN de datos de cliente**
- **NO hay bloqueo de campos críticos** (nombre, RFC, CURP)
- **NO hay validación en API** que prevenga editar estos campos
- **NO hay distinción** entre ediciones permitidas vs. prohibidas

---

### 2. IMPLEMENTACIÓN: AUDITORÍA DE EDICIÓN DE CLIENTE

#### Paso 1: Extender endpoint DELETE cliente para incluir razon_eliminacion

**YA EXISTE** en [app/api/kyc/clientes/[id]/route.ts](app/api/kyc/clientes/[id]/route.ts)

```typescript
// Verificar que existe DELETE con auditoría completa
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { razon_eliminacion } = body;
  
  await supabase.from('auditoria_clientes').insert({
    accion: 'ELIMINAR',
    razon: razon_eliminacion,
    ...
  });
}
```

✅ **STATUS: CORRECTO**

---

#### Paso 2: Crear/Mejorar endpoint PATCH para edición con auditoría

**NECESARIO** en [app/api/kyc/clientes/[id]/route.ts](app/api/kyc/clientes/[id]/route.ts)

```typescript
// AGREGAR: Endpoint PATCH para edición segura de cliente
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await validateAuth(request);
  if (!auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clienteId = params.id;
  const body = await request.json();
  const { 
    sector_actividad, 
    origen_recursos,
    domicilio,
    telefono,
    email,
    notas_internas,
    razon_edicion,
    documento_justificacion_url
  } = body;

  const supabase = getServiceSupabase();

  // VALIDACIÓN CRÍTICA: Campos que NO se pueden editar
  const CAMPOS_PROHIBIDOS = ['nombre_completo', 'rfc', 'curp', 'tipo_persona'];
  const camposEnviados = Object.keys(body).filter(k => k !== 'razon_edicion' && k !== 'documento_justificacion_url');
  
  const intentoModificarCritico = camposEnviados.some(campo => 
    CAMPOS_PROHIBIDOS.includes(campo) && body[campo] !== undefined
  );

  if (intentoModificarCritico) {
    return NextResponse.json({
      error: 'Campos inmutables no pueden editarse',
      campos_prohibidos: CAMPOS_PROHIBIDOS,
      mensaje: 'Para modificar nombre, RFC, CURP o tipo de persona, debe crear un nuevo cliente'
    }, { status: 400 });
  }

  // Obtener cliente actual para auditoría
  const { data: clienteActual } = await supabase
    .from('clientes')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('user_id', auth.user.id)
    .single();

  if (!clienteActual) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  }

  // Preparar cambios para auditoría
  const cambios: Record<string, { anterior: any; nuevo: any }> = {};
  
  [sector_actividad, origen_recursos, domicilio, telefono, email, notas_internas].forEach(campo => {
    const nombreCampo = Object.keys(body).find(k => body[k] === campo);
    if (nombreCampo && body[nombreCampo] !== clienteActual[nombreCampo]) {
      cambios[nombreCampo] = {
        anterior: clienteActual[nombreCampo],
        nuevo: body[nombreCampo]
      };
    }
  });

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({
      success: true,
      mensaje: 'No hay cambios para guardar'
    });
  }

  // REQUERIMIENTO: Razón obligatoria para edición
  if (!razon_edicion || !razon_edicion.trim()) {
    return NextResponse.json({
      error: 'razon_edicion es requerida',
      campos_editables: ['sector_actividad', 'origen_recursos', 'domicilio', 'telefono', 'email', 'notas_internas']
    }, { status: 400 });
  }

  // Actualizar cliente
  const { data: clienteActualizado, error: updateError } = await supabase
    .from('clientes')
    .update({
      sector_actividad: sector_actividad || clienteActual.sector_actividad,
      origen_recursos: origen_recursos || clienteActual.origen_recursos,
      updated_at: new Date().toISOString()
    })
    .eq('cliente_id', clienteId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // AUDITORÍA: Registrar cambios
  await supabase.from('auditoria_clientes').insert({
    cliente_id: clienteId,
    usuario_id: auth.user.id,
    accion: 'EDITAR',
    tabla_afectada: 'clientes',
    campos_modificados: cambios,
    razon: razon_edicion.trim(),
    documento_justificacion: documento_justificacion_url || null,
    ip_usuario: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
    timestamp: new Date().toISOString()
  });

  return NextResponse.json({
    success: true,
    cliente: clienteActualizado,
    cambios_auditados: cambios,
    mensaje: `Cliente actualizado. Se registraron ${Object.keys(cambios).length} cambio(s) en auditoría`
  });
}
```

**ESTADO:** ❌ **NO IMPLEMENTADO - URGENTE**

---

### 3. IMPLEMENTACIÓN: VALIDACIÓN EN FRONTEND (KYCModule.tsx)

#### Paso 1: Bloquear campos en UI

```typescript
// EN: KYCModule.tsx - Modificar renderizado de formulario

const CAMPOS_CRITICOS = ['nombre_completo', 'rfc', 'curp', 'tipo_persona'];
const CAMPOS_EDITABLES = ['sector_actividad', 'origen_recursos'];

{isEditing && editedCliente ? (
  <div className="space-y-6">
    {/* CAMPOS CRÍTICOS: MOSTRAR BLOQUEADOS */}
    {CAMPOS_CRITICOS.map(campo => (
      <div key={campo} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {campo.replace(/_/g, ' ').toUpperCase()}
              <span className="ml-2 text-xs text-red-400">(NO EDITABLE - Ley LFPYSU Art. 17)</span>
            </label>
            <input 
              type="text" 
              disabled
              value={selectedCliente[campo]}
              className="w-full bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2 text-red-300 cursor-not-allowed"
              title="Este campo no puede editarse según normativa PLD/LFPYSU"
            />
            <p className="text-xs text-red-400 mt-2">
              ⚠️ Para cambiar este dato, debe crear un nuevo cliente
            </p>
          </div>
        </div>
      </div>
    ))}

    {/* CAMPOS EDITABLES */}
    {CAMPOS_EDITABLES.map(campo => (
      <div key={campo}>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {campo.replace(/_/g, ' ').toUpperCase()}
          <span className="ml-2 text-xs text-green-400">(Editable)</span>
        </label>
        <input 
          type="text" 
          value={editedCliente[campo] || ''}
          onChange={(e) => setEditedCliente({ ...editedCliente, [campo]: e.target.value })}
          className="w-full bg-gray-900/50 border border-emerald-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
    ))}

    {/* CAMPO: RAZÓN DE EDICIÓN (OBLIGATORIO) */}
    <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Razón de la edición *
        <span className="ml-2 text-xs text-blue-400">(Requerido por compliance)</span>
      </label>
      <textarea
        placeholder="Ej: Cambio de sector porque empresa cambió giro de negocio"
        value={razonEdicion}
        onChange={(e) => setRazonEdicion(e.target.value)}
        className="w-full bg-gray-900/50 border border-blue-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
        rows={3}
      />
      <p className="text-xs text-blue-300 mt-2">
        📋 Esta razón será registrada en auditoría y visible para inspecciones UIF/SHCP
      </p>
    </div>
  </div>
) : null}
```

**ESTADO:** ⚠️ **PARCIALMENTE IMPLEMENTADO**

---

#### Paso 2: Modificar guardarEdicion para incluir razon_edicion

```typescript
// EN: handleGuardarEdicion

const handleGuardarEdicion = async () => {
  if (!selectedCliente || !editedCliente) return;

  // VALIDAR: Razón obligatoria
  if (!razonEdicion.trim()) {
    setError('Debe proporcionar una razón para editar');
    return;
  }

  // VALIDAR: Cambios reales
  const cambios = {};
  ['sector_actividad', 'origen_recursos', 'domicilio', 'telefono', 'email'].forEach(campo => {
    if (editedCliente[campo] !== selectedCliente[campo]) {
      cambios[campo] = editedCliente[campo];
    }
  });

  if (Object.keys(cambios).length === 0) {
    setError('No hay cambios para guardar');
    return;
  }

  setLoading(true);
  setError(null);
  setSuccess(null);

  try {
    const token = await getAuthToken();
    if (!token) {
      setError('Sesión expirada');
      return;
    }

    const payload = {
      ...cambios,
      razon_edicion: razonEdicion.trim(),
      documento_justificacion: null // Implementar upload de documento después
    };

    const resp = await fetch(`/api/kyc/clientes/${selectedCliente.cliente_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || `Error HTTP ${resp.status}`);
    }

    setSuccess(`✅ Cliente actualizado. ${Object.keys(cambios).length} campo(s) modificado(s). Cambios registrados en auditoría.`);
    setEditedCliente(null);
    setIsEditing(false);
    setRazonEdicion('');

    // Recargar cliente
    const clienteActualizado = data.cliente;
    setSelectedCliente(clienteActualizado);

  } catch (err) {
    setError(err instanceof Error ? err.message : 'Error al guardar cambios');
  } finally {
    setLoading(false);
  }
};
```

**ESTADO:** ⚠️ **NECESITA ACTUALIZACIÓN**

---

## Summary de Cambios Requeridos

### Checklist de Implementación

- [ ] **BACKEND - PATCH endpoint (app/api/kyc/clientes/[id]/route.ts)**
  - [ ] Validar campos prohibidos
  - [ ] Requerir razón de edición
  - [ ] Auditar cambios en tabla auditoria_clientes
  - [ ] Timestamp automático
  - [ ] IP y user agent

- [ ] **FRONTEND - Bloquear campos críticos (KYCModule.tsx)**
  - [ ] Marcar nombre, RFC, CURP, tipo_persona como NO EDITABLES
  - [ ] Mostrar advertencia legal LFPYSU Art. 17
  - [ ] Hacer obligatorio campo "razón de edición"
  - [ ] Recargar cliente después de guardar

- [ ] **DATABASE - Validaciones en tabla**
  ```sql
  -- Agregar constraint a auditoria_clientes
  CONSTRAINT no_editar_criticos CHECK (
    accion != 'EDITAR' OR
    NOT (campos_modificados ? 'nombre_completo' OR 
         campos_modificados ? 'rfc' OR 
         campos_modificados ? 'curp' OR 
         campos_modificados ? 'tipo_persona')
  )
  ```

- [ ] **DOCUMENTACIÓN**
  - [ ] Actualizar términos de servicio
  - [ ] Crear política de edición para clientes
  - [ ] Documentar procedimiento de auditoría

---

## Impacto Esperado

### ✅ Cumplimiento Normativo
- LFPIORPI Art. 17: Trazabilidad completa ✅
- LFPYSU Art. 17: No deletear datos ✅
- GAFI Rec. 10-11: Auditoría compulsoria ✅

### ✅ Seguridad
- Prevenir alteración accidental de PII
- Auditoría completa de cambios
- Rol-based access control (RBAC)

### ✅ Compliance Ready
- Reportes de auditoría para inspecciones
- Chain of custody de datos
- Documentación de decisiones

---

**Última actualización:** 27 Enero 2026
**Próxima revisión:** 27 Febrero 2026
