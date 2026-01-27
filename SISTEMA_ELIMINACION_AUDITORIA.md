# Resumen: Sistema de Eliminación con Auditoría

## Cambios Implementados

### 1. Frontend - KYCModule.tsx

**Estados Agregados:**
- `showDeleteReasonModal` - Controla modal de razón de eliminación
- `deleteReasonType` - Especifica si es 'documento' u 'operacion'
- `deleteReasonText` - Texto de la razón de eliminación
- `itemToDelete` - Referencia al item siendo eliminado
- `selectedOperacionesToDelete` - Array de IDs de operaciones seleccionadas
- `selectedDocumentsToDelete` - Array de IDs de documentos seleccionados
- `documentosDelCliente` - Array de documentos del cliente

**UI Cambios:**

#### Pestaña Operaciones (detailTab === 'operaciones')
- ✅ Checkboxes en cada operación del historial
- ✅ Indicador visual cuando se seleccionan items (fondo azul)
- ✅ Mostrador de items seleccionados
- ✅ Botón "Eliminar Seleccionadas (N)" que aparece solo cuando hay items seleccionados
- ✅ El botón abre el modal de razón de eliminación

#### Pestaña Documentos (detailTab === 'documentos')
- ✅ Estructura mejorada con lista de documentos
- ✅ Checkboxes en cada documento
- ✅ Link "Ver" para descargar cada documento
- ✅ Indicador de tipo de documento
- ✅ Botón "Eliminar Seleccionados (N)" en zona de botones contextuales
- ✅ Mensaje "No hay documentos cargados aún" si está vacío

#### Botones Contextuales (por pestaña)
- ✅ **datosGenerales**: Editar, Eliminar (cliente completo)
- ✅ **operaciones**: Nueva Operación, Eliminar Seleccionadas (si hay items)
- ✅ **documentos**: Agregar Documento, Eliminar Seleccionados (si hay items)
- ✅ **validaciones**: Actualizar Listas (sin Editar/Eliminar)

**Modal de Razón de Eliminación:**
- Título dinámico (Eliminar Documento/Operación)
- Textarea para ingresar razón (field requerida)
- Aviso de auditoría en color naranja
- Botones: Cancelar, Confirmar Eliminación (deshabilitado hasta escribir razón)
- Loading spinner durante eliminación

**Función: handleConfirmDelete()**
```typescript
// Flujo:
1. Valida razón de eliminación
2. Obtiene token de autenticación
3. Para cada item seleccionado:
   - Llama a DELETE /api/operaciones/{id} o /api/clientes/{id}/documentos/{docId}
   - Envía razon_eliminacion en el body
4. Si éxito:
   - Muestra mensaje de confirmación
   - Limpia arrays de selección
   - Recarga datos (operaciones o documentos)
5. Si error:
   - Muestra error en UI
   - No se cierran el modal automáticamente
```

---

### 2. Backend APIs

#### DELETE /api/operaciones/[id]/route.ts

**Responsabilidades:**
```typescript
// Entrada:
{
  razon_eliminacion: string,  // Razón del usuario
  cliente_id: UUID            // Para registro de auditoría
}

// Salida (éxito):
{
  success: true,
  message: "Operación OP-2026-001 eliminada. Registro de auditoría guardado.",
  operacion_id: UUID
}

// Errores:
- 401: Unauthorized
- 400: Falta cliente_id o razon_eliminacion
- 404: Operación no encontrada
- 500: Error DB
```

**Lógica:**
1. Valida autenticación
2. Verifica que el usuario es propietario de la operación
3. **Soft Delete**: Actualiza operación con:
   - `eliminada = true`
   - `fecha_eliminacion = ahora`
   - `eliminada_por = user_id`
   - `razon_eliminacion = texto`
4. Registra en tabla `auditoria_operaciones`:
   - folio_operacion, monto, moneda
   - IP del usuario, User-Agent
   - Razón completa
5. Retorna éxito

#### DELETE /api/clientes/[id]/documentos/[docId]/route.ts

**Responsabilidades:**
```typescript
// Entrada:
{
  razon_eliminacion: string  // Razón del usuario
}

// Salida (éxito):
{
  success: true,
  message: "Documento \"DNI_frente.pdf\" eliminado. Registro de auditoría guardado.",
  documento_id: UUID
}

// Errores:
- 401: Unauthorized
- 400: Falta razon_eliminacion
- 404: Cliente o documento no encontrado
- 500: Error DB
```

**Lógica:**
1. Valida autenticación
2. Verifica que cliente pertenece al usuario
3. Obtiene documento para verificar permisos
4. **Soft Delete**: Actualiza documento con:
   - `eliminado = true`
   - `fecha_eliminacion = ahora`
   - `eliminado_por = user_id`
   - `razon_eliminacion = texto`
5. Registra en tabla `auditoria_documentos`:
   - nombre_documento, tipo
   - IP del usuario, User-Agent
   - Razón completa
6. Retorna éxito

---

### 3. Database Schema (Supabase)

**Archivo:** `/workspaces/tarantulahawk/app/backend/sql/auditoria_eliminaciones_migration.sql`

**Nuevas Tablas:**

#### auditoria_operaciones
```sql
auditoria_id (UUID, PK)
user_id (UUID, FK auth.users)
cliente_id (UUID, FK clientes)
operacion_id (UUID, FK operaciones)
accion (VARCHAR: "ELIMINAR")
razon (TEXT) -- Razón del usuario
folio_operacion (VARCHAR)
monto (DECIMAL)
moneda (VARCHAR)
fecha_accion (TIMESTAMP)
ip_usuario (VARCHAR)
user_agent (TEXT)
created_at (TIMESTAMP)
```

#### auditoria_documentos
```sql
auditoria_id (UUID, PK)
user_id (UUID, FK auth.users)
cliente_id (UUID, FK clientes)
documento_id (UUID, FK documentos)
accion (VARCHAR: "ELIMINAR")
razon (TEXT)
nombre_documento (VARCHAR)
tipo (VARCHAR)
fecha_accion (TIMESTAMP)
ip_usuario (VARCHAR)
user_agent (TEXT)
created_at (TIMESTAMP)
```

**Modificaciones a Tablas Existentes:**

- `operaciones`: Agregar campos `eliminada`, `fecha_eliminacion`, `eliminada_por`, `razon_eliminacion`
- `documentos`: Agregar campos `eliminado`, `fecha_eliminacion`, `eliminado_por`, `razon_eliminacion`

**Vistas:**
- `operaciones_activas`: SELECT * FROM operaciones WHERE eliminada = FALSE
- `documentos_activos`: SELECT * FROM documentos WHERE eliminado = FALSE

**RLS (Row Level Security):**
- `auditoria_operaciones`: Solo ver registros propios (user_id = auth.uid())
- `auditoria_documentos`: Solo ver registros propios (user_id = auth.uid())

---

## Flujo Completo de Eliminación

### Ejemplo: Eliminar Operación

```
1. Usuario ve historial de operaciones en tab "Operaciones"
   ├─ Cada operación tiene un checkbox
   └─ Usuario selecciona checkboxes deseados

2. Aparece botón "Eliminar Seleccionadas (2)"
   └─ Usuario hace click

3. Se abre modal:
   ├─ Título: "Eliminar Operación"
   ├─ Textarea: "¿Cuál es la razón?"
   ├─ Usuario escribe: "Error de entrada de datos"
   └─ Botón "Confirmar Eliminación" se habilita

4. Usuario click "Confirmar Eliminación"
   ├─ handleConfirmDelete() se ejecuta
   ├─ Para each operación_id:
   │  ├─ POST /api/operaciones/{id}
   │  ├─ Body: { razon_eliminacion, cliente_id }
   │  └─ Endpoint retorna { success, message }
   ├─ Modal cierra
   ├─ Mensaje: "2 operación(es) eliminada(s). Registro de auditoría guardado."
   └─ Historial se actualiza (operaciones eliminadas desaparecen)

5. En Supabase, se registra:
   ├─ operaciones.eliminada = true (para esa operación)
   ├─ operaciones.razon_eliminacion = "Error de entrada de datos"
   └─ auditoria_operaciones.INSERT con detalles completos
```

---

## Casos de Uso Cubiertos

### ✅ Auditoría Completa
- **Qué** se eliminó (folio, documento, monto)
- **Cuándo** se eliminó (fecha_accion)
- **Quién** lo eliminó (user_id, email)
- **Por qué** se eliminó (razon_eliminacion)
- **De dónde** (IP, User-Agent)

### ✅ Soft Delete (No se pierde data)
- Las operaciones/documentos no se eliminan de verdad
- Siempre se puede restaurar manualmente en BD
- Las vistas normales filtran items eliminados automáticamente

### ✅ Seguridad
- RLS en tablas de auditoría (cada usuario solo ve la suya)
- Validación de permisos (usuario debe ser propietario)
- Token JWT requerido

### ✅ UX Mejorada
- Checkboxes claros para seleccionar
- Contador de items seleccionados
- Modal con razón _obligatoria_
- Mensajes de éxito/error claros
- Loading spinner durante operación

---

## Próximos Pasos (Futuros)

- [ ] Implementar GET /api/clientes/{id}/documentos (cargar lista actual)
- [ ] Agregar vista de auditoría para admin (ver todos los registros)
- [ ] Implementar restauración de items eliminados (undelete con razón)
- [ ] Exportar auditoría a CSV para compliance
- [ ] Agregar estadísticas de eliminaciones por período
- [ ] Notificaciones por email al detectar eliminaciones en lote

---

## Testing

Para probar localmente:

1. **Crear datos**:
   - Crear cliente
   - Crear 2-3 operaciones
   - (Documentos: mockear después)

2. **Test checkbox**:
   - Ir a tab "Operaciones"
   - Seleccionar checkbox en operación
   - Verificar que aparece botón "Eliminar Seleccionadas (1)"

3. **Test modal**:
   - Click botón "Eliminar Seleccionadas"
   - Verificar modal aparece
   - Escribir razón
   - Verificar botón "Confirmar" se habilita

4. **Test API**:
   - Click "Confirmar Eliminación"
   - Verificar en Supabase: operaciones.eliminada = true
   - Verificar auditoria_operaciones.INSERT con razón

5. **Test Soft Delete**:
   - Verificar que operación no aparece en historial
   - Verificar en BD que fila sigue ahí (eliminada = true)

---

## Archivos Modificados

- ✅ `/workspaces/tarantulahawk/app/components/kyc/KYCModule.tsx` - UI + funciones
- ✅ `/workspaces/tarantulahawk/app/api/operaciones/[id]/route.ts` - API DELETE operaciones
- ✅ `/workspaces/tarantulahawk/app/api/clientes/[id]/documentos/[docId]/route.ts` - API DELETE documentos
- ✅ `/workspaces/tarantulahawk/app/backend/sql/auditoria_eliminaciones_migration.sql` - Schema

---

## Acciones Requeridas (BD)

Ejecutar en Supabase SQL Editor:

```sql
-- Copiar contenido completo de auditoria_eliminaciones_migration.sql
-- y ejecutar en Supabase
```

Esto creará:
- ✅ Tablas `auditoria_operaciones`, `auditoria_documentos`
- ✅ Columnas en `operaciones` y `documentos`
- ✅ Vistas `operaciones_activas`, `documentos_activos`
- ✅ RLS policies para auditoría
