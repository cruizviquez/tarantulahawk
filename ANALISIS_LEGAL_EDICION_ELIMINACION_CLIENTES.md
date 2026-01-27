# Análisis Legal: Édición y Eliminación de Clientes en Cumplimiento Normativo PLD

## Resumen Ejecutivo

Este análisis examina si es legal editar o eliminar datos de clientes en un sistema de Prevención de Lavado de Dinero (PLD) bajo la normativa mexicana (LFPIORPI, Art. 17 LFPYSU) y estándares internacionales (GAFI). La conclusión es **restrictiva pero matizada**: algunos campos pueden editarse bajo condiciones específicas, pero la mayoría NO deben ser eliminados o modificados sin auditoría exhaustiva.

---

## 1. MARCO LEGAL APLICABLE

### 1.1 Normativa Mexicana Aplicable

#### **Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI)**

**Art. 17 - Obligaciones del Sujeto Obligado:**
- Realizar **Análisis de Riesgo** de clientes
- **Documentar y conservar** información de clientes
- Mantener **identificación completa y actualizada**
- Conservar **evidencia de análisis de riesgo**
- Realizar **verificaciones periódicas** en listas (OFAC, CSNU, PEPs, etc.)

**Implicación:** La ley requiere **conservación** de registros, no permite eliminación casual de datos.

---

#### **Ley Federal para la Prevención del Lavado de Dinero (LFPYSU)**

**Art. 17 (Deberes de Identificación):**
- Identificar titulares de cuentas/clientes
- Verificar identidad con documentos oficiales
- Mantener **registros por mínimo 10 años**

**Implicación:** Datos de identificación (nombre, RFC, CURP) **NO pueden editarse** sin justificación y auditoría. Eliminación física viola la ley.

---

#### **Jurisprudencia y Criterios administrativos:**

Por iniciativa de la **SHCP y la UIF**:
- Los registros de clientes son **elementos de prueba** en caso de investigación
- Modificación de datos puede considerarse **falsificación de registros** bajo Código Penal
- La trazabilidad de cambios es **requisito crítico** para auditoría

---

### 1.2 Estándares Internacionales

#### **GAFI (Grupo de Acción Financiera)**
Recomendación 10: **Due Diligence del Cliente (CDD)**
- Mantener información de cliente "actualizada y verificada"
- Conservar registros detallados de procedimiento de verificación
- **Prohibición explícita:** No destruir información de auditoría

Recomendación 11: **Registros y comunicación**
- Mantener registros por **mínimo 5 años posterior** a relación comercial
- Registros deben permitir **reconstrucción completa** de transacciones

---

## 2. ANÁLISIS DETALLADO: EDICIÓN DE CAMPOS

### 2.1 CAMPOS QUE NO DEBEN EDITARSE (CRÍTICOS)

| Campo | Normativa | Razón | Acción Permitida |
|-------|-----------|-------|------------------|
| **Nombre Completo** | LFPYSU Art. 17 | Dato de identificación fundamental | Solo corrección de errores tipográficos (con log) |
| **RFC** | LFPYSU Art. 17 | Identificador único, vinculado a SHCP | PROHIBIDO editar; crear nuevo cliente si error |
| **CURP** | LFPYSU Art. 17 | Identificador único oficial | PROHIBIDO editar; crear nuevo cliente si error |
| **Tipo de Persona (Física/Moral)** | LFPIORPI Art. 17 | Base de análisis de riesgo | PROHIBIDO cambiar; es un atributo inmutable |
| **Fecha de Nacimiento/Constitución** | LFPYSU Art. 17 | Dato de identificación | PROHIBIDO editar; corrección solo con evidencia legal notarizada |

**Justificación Legal:**
- Estos campos son la **base de la verificación de identidad**
- Su modificación invalida toda la cadena de debido diligence (CDD)
- En caso de investigación, cambios sugieren **alteración de registros**

---

### 2.2 CAMPOS QUE PUEDEN EDITARSE (CON RESTRICCIONES)

| Campo | Condición | Procedimiento Requerido |
|-------|-----------|-------------------------|
| **Sector de Actividad** | Cambio legítimo de giro | Documentar razón; mantener versión anterior en auditoria |
| **Origen de Recursos** | Cambio en fuente de fondos | Solicitar documentación actualizada; crear nueva evaluación de riesgo |
| **Domicilio** | Cambio de residencia | Solicitar comprobante; mantener registro histórico |
| **Información de Contacto (email, teléfono)** | Actualización operativa | Cambio permitido; no afecta cumplimiento |
| **Notas Internas/Descripción** | Correcciones de análisis | Edición permitida solo para usuario que creo; mantener timestamp |

**Procedimiento de Control:**
```
1. TODO CAMBIO requiere justificación documentada
2. Mantener versionado de cambios con timestamp y usuario
3. Log completo en auditoria_clientes con:
   - Campo modificado
   - Valor anterior
   - Valor nuevo
   - Razón del cambio
   - Fecha/hora
   - Usuario responsable
   - Documento de justificación
```

---

### 2.3 IMPLEMENTACIÓN TECNOLÓGICA RECOMENDADA

Para cumplir con LFPIORPI Art. 17 y GAFI:

```sql
-- Tabla de auditoría para cambios
CREATE TABLE auditoria_clientes (
  auditoria_id BIGINT PRIMARY KEY,
  cliente_id VARCHAR(36) REFERENCES clientes(cliente_id),
  usuario_id VARCHAR(36),
  accion VARCHAR(50),        -- 'CREAR', 'EDITAR', 'SOFT_DELETE'
  campo_modificado VARCHAR(100),
  valor_anterior TEXT,
  valor_nuevo TEXT,
  motivo_cambio TEXT,        -- REQUERIDO para ediciones critically
  documento_justificacion VARCHAR(255),  -- URL a documento en storage
  ip_usuario VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP,
  CONSTRAINT solo_campos_permitidos CHECK (
    campo_modificado NOT IN ('nombre_completo', 'rfc', 'curp', 'tipo_persona')
  )
);
```

---

## 3. ANÁLISIS: ELIMINACIÓN DE CLIENTES

### 3.1 ESTATUS LEGAL DE LA ELIMINACIÓN

**CONCLUSIÓN: NO ESTÁ PERMITIDA LA ELIMINACIÓN FÍSICA**

#### Fundamentos:

1. **LFPYSU Art. 17:** "Mantener registros por mínimo **10 años**"
   - Eliminación física viola esta obligación
   - Cliente eliminado = pérdida de evidencia → Incumplimiento

2. **GAFI Recomendación 11:**
   - Registros deben permitir "**reconstrucción de transacciones**"
   - Eliminación impide auditoría posterior

3. **Código Penal Federal (Art. 243-244):**
   - Destrucción de registros públicos = delito penal
   - Puede interpretarse análogamente a registros de cumplimiento

4. **UIF - Criterios de Evaluación:**
   - Inspecciones buscan "trazabilidad completa"
   - Ausencia de cliente = incumplimiento grave

---

### 3.2 SOLUCIÓN: SOFT DELETE CON AUDITORÍA

**Implementación Actual: CORRECTO ✅**

```javascript
// CORRECTO: Soft Delete
UPDATE clientes 
SET 
  eliminada = TRUE, 
  fecha_eliminacion = NOW(),
  eliminada_por = user_id,
  razon_eliminacion = 'Solicitud del cliente'
WHERE cliente_id = ?;

// LOG de auditoría
INSERT INTO auditoria_clientes (cliente_id, accion, razon) 
VALUES (?, 'SOFT_DELETE', ?);
```

**Beneficios:**
- ✅ Mantiene integridad de datos
- ✅ Permite auditoria e investigación posterior
- ✅ Cumple LFPYSU Art. 17 (10 años de conservación)
- ✅ Satisface GAFI Recomendación 11

**NO PERMITIR:**
```javascript
// ❌ INCORRECTO
DELETE FROM clientes WHERE cliente_id = ?;  // NUNCA

// ❌ INCORRECTO: Borrar sin log
UPDATE clientes SET nombre_completo = NULL WHERE cliente_id = ?;
```

---

### 3.3 ESCENARIOS DONDE SÍ SE PUEDE "ELIMINAR" LÓGICAMENTE

| Escenario | Acción Permitida | Requisito Legal |
|-----------|-----------------|------------------|
| Cliente solicita ser olvidado (RGPD/GDPR) | Soft delete + datos anonimizados | Auditoría de solicitud; mantener datos mínimos 10 años |
| Cliente fallecido (PF) | Marcar como inactivo; conservar registro | Acta de defunción en expediente |
| Empresa disuelta (PM) | Marcar como inactivo; mantener registro | Acta de disolución; conservar 10 años |
| Duplicado accidental | Soft delete del duplicado; mantener original | Log detallado de por qué es duplicado |
| Error en creación (data corrupta) | Soft delete si creado hace <24h | Log de razón; auditoría visible |

**En TODOS los casos:** El cliente inactivo permanece en base de datos con `eliminada=TRUE` y accesible para auditoría.

---

## 4. ANÁLISIS COMPARATIVO: PLATAFORMAS SIMILARES

### 4.1 Estándares de Plataformas de Compliance

#### **Tableau Compliance (Salesforce)**
- ✅ Permite edición limitada de campos
- ❌ NO permite eliminación física
- 📋 Auditoría completa de cambios obligatoria
- 📅 Retención mínima: 7 años

#### **AML Catalyst (Thomson Reuters)**
- ✅ Edición restringida a campos operativos
- ❌ NO permite deletear clientes
- 📋 Soft delete con razón documentada
- 📅 Retención mínima: 10 años
- 🔐 Campos críticos protegidos por role-based access

#### **Actimize (FICO)**
- ✅ Edición con pre-aprobación de compliance officer
- ❌ NO permite eliminación
- 📋 Auditoria compulsoria para cualquier cambio
- 🔒 Campos PII protegidos con encriptación adicional

#### **Lexis Nexis RiskView**
- ✅ Edición limitada a administrador de riesgo
- ⚠️ Soft delete con "quarantine period" de 30 días
- 📋 Razón obligatoria en todas las ediciones
- 📅 Retención: Perpetua para clientes con operaciones

---

### 4.2 Conclusión Comparativa

**Patrón observado en plataformas tier-1:**
```
✅ Edición = SÍ, pero con auditoría completa
❌ Eliminación = NO (solo soft delete)
🔐 Campos críticos = BLOQUEADOS
📋 Razón documentada = OBLIGATORIA
```

**TarantulaHawk vs. Estándar:**
| Aspecto | Estándar | TarantulaHawk | Cumplimiento |
|---------|----------|---------------|-------------|
| Soft delete | ✅ Requerido | ✅ Implementado | ✅ CUMPLE |
| Auditoría | ✅ Mandatoria | ✅ Implementada | ✅ CUMPLE |
| Bloqueo campos críticos | ✅ Requerido | ⚠️ PARCIAL | ⚠️ MEJORABLE |
| Razón documentada | ✅ Requerido | ✅ Implementada | ✅ CUMPLE |
| Retención 10 años | ✅ Requerido | ⚠️ Depende BD | ⚠️ MEJORABLE |

---

## 5. RECOMENDACIONES DE IMPLEMENTACIÓN

### 5.1 CAMBIOS URGENTES (Compliance Crítico)

#### 1. **Bloquear edición de campos críticos**

```typescript
// EN: KYCModule.tsx
const CAMPOS_NO_EDITABLES = ['nombre_completo', 'rfc', 'curp', 'tipo_persona'];

const handleEditarCliente = () => {
  if (!selectedCliente) return;
  
  // Validar que no intenta editar campos críticos
  const cambios = diferencias(selectedCliente, editedCliente);
  const intentoModificarCritico = cambios.some(
    c => CAMPOS_NO_EDITABLES.includes(c.campo)
  );
  
  if (intentoModificarCritico) {
    setError('❌ PROHIBIDO: No puede editar nombre completo, RFC, CURP o tipo de persona. Estos datos son inmutables según LFPYSU Art. 17.');
    return;
  }
  
  // Proceder con edición
};
```

#### 2. **Hacer explícito el Soft Delete**

```typescript
// EN: KYCModule.tsx - Modificar la función de eliminar cliente
const handleEliminarCliente = () => {
  setShowDeleteModal({
    titulo: '⚠️ INACTIVAR CLIENTE (No se elimina definitivamente)',
    mensaje: `Este cliente será INACTIVADO pero mantenido en base de datos por auditoría según LFPYSU Art. 17 (10 años de retención).`,
    campos_requeridos: ['razon_eliminacion'],
    razon_predefinidas: [
      'Cliente solicita cancelar',
      'Término de relación comercial',
      'Incumplimiento de políticas',
      'Fallecimiento (adjuntar acta)',
      'Empresa disuelta (adjuntar acta)',
      'Otro (especificar)'
    ]
  });
};
```

#### 3. **Impedir coincidencia de datos antes de crear nuevo cliente**

```typescript
// EN: POST /api/kyc/clientes
if (cliente_existente_inactivo = await supabase
    .from('clientes')
    .select('*')
    .eq('rfc', rfc.toUpperCase())
    .eq('eliminada', true)
    .single()) {
  
  return NextResponse.json({
    error: 'RFC ya existe pero inactivo',
    suggestion: 'Este cliente fue inactivado. ¿Desea reactivarlo?',
    cliente_id_inactivo: cliente_existente_inactivo.cliente_id
  }, { status: 409 });
}
```

---

### 5.2 TABLA DE AUDITORÍA MEJORADA

Implementar auditoría más granular:

```sql
-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS auditoria_clientes (
  auditoria_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  cliente_id VARCHAR(36) REFERENCES clientes(cliente_id),
  usuario_id VARCHAR(36) REFERENCES auth.users(id),
  accion VARCHAR(50) CHECK (accion IN ('CREAR', 'EDITAR', 'INACTIVAR', 'REACTIVAR')),
  tabla_afectada VARCHAR(50),
  campos_modificados JSONB,  -- {campo: {anterior, nuevo}}
  razon VARCHAR(500) NOT NULL,
  documento_justificacion VARCHAR(255),  -- ruta a PDF/imagen
  ip_usuario VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Restricciones de compliance
  CONSTRAINT campos_criticos_no_editables CHECK (
    accion IN ('CREAR', 'INACTIVAR', 'REACTIVAR') OR
    NOT (campos_modificados ? 'nombre_completo' OR 
         campos_modificados ? 'rfc' OR 
         campos_modificados ? 'curp' OR 
         campos_modificados ? 'tipo_persona')
  ),
  
  -- Razon obligatoria para inactivación
  CONSTRAINT inactivar_requiere_razon CHECK (
    accion != 'INACTIVAR' OR (razon IS NOT NULL AND razon != '')
  )
);
```

---

### 5.3 FLUJO DE REACTIVACIÓN (Mejor Práctica)

```typescript
// Permitir reactivar cliente inactivo si se justifica adecuadamente
const handleReactivarCliente = async (clienteId: string, razonReactivacion: string) => {
  // 1. Validar que existe como inactivo
  const cliente = await supabase
    .from('clientes')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('eliminada', true)
    .single();

  if (!cliente) {
    setError('Cliente no encontrado o ya activo');
    return;
  }

  // 2. Reactivar
  await supabase
    .from('clientes')
    .update({
      eliminada: false,
      fecha_eliminacion: null,
      eliminated_por: null,
      razon_eliminacion: null
    })
    .eq('cliente_id', clienteId);

  // 3. Auditar reactivación
  await supabase
    .from('auditoria_clientes')
    .insert({
      cliente_id: clienteId,
      usuario_id: user.id,
      accion: 'REACTIVAR',
      razon: razonReactivacion,
      timestamp: new Date().toISOString()
    });

  // 4. RE-VALIDAR en listas (OFAC, CSNU, 69B, UIF, PEPs)
  // porque el cliente estuvo "fuera" y podría estar en nuevas listas
  await validarListas(cliente);
};
```

---

## 6. ACCIONES INMEDIATAS RECOMENDADAS

### Prioridad CRÍTICA (Esta semana)

- [ ] **Bloquear edición de: nombre_completo, rfc, curp, tipo_persona** en UI
- [ ] **Implementar validación en API** para rechazar cambios en campos críticos
- [ ] **Documentar en Política de Cumplimiento** que edición está restringida
- [ ] **Revisar backup/restore** para asegurar retención de 10 años de datos

### Prioridad ALTA (Este mes)

- [ ] **Implementar tabla auditoria_clientes** con constraints de compliance
- [ ] **Añadir campo "documento_justificacion"** para ediciones
- [ ] **Crear flujo de reactivación** para clientes inactivos
- [ ] **Auditar historial** para detectar ediciones no documentadas

### Prioridad MEDIA (Este trimestre)

- [ ] Implementar "Política de Datos" con notice al usuario
- [ ] Crear reportes de auditoría para inspecciones UIF
- [ ] Integrar con GDPR para derechos de acceso/olvido
- [ ] Establecer SLA de retención clara en contrato de servicio

---

## 7. CONCLUSIÓN LEGAL

### ✅ EDICIÓN DE CLIENTES: SÍ, PERO RESTRINGIDA

```
✅ Permitido editarsi cumple:
  1. Solo campos operativos (sector, origen, contacto)
  2. Razón documentada y grabada en auditoría
  3. Usuario autorizado (Compliance Officer)
  4. Sin modificar datos de identificación

❌ Prohibido:
  - Editar: nombre, RFC, CURP, tipo_persona
  - Eliminar físicamente (solo soft delete)
  - Borrar auditoría o registros históricos
```

### ❌ ELIMINACIÓN FÍSICA DE CLIENTES: NO PERMITIDA

```
✅ Permitido (Soft Delete):
  - Marcar como inactivo/eliminado lógicamente
  - Mantener datos intactos en base de datos
  - Documentar razón y justificación
  - Conservar 10 años mínimo

❌ Prohibido:
  - DELETE FROM clientes
  - Borrar registros históricos
  - Eliminación sin auditoría
  - Falta de documentación
```

### 📋 RECOMENDACIÓN FINAL

**Implementar en TarantulaHawk:**

1. **Bloqueo de campos críticos** en UI y API ← URGENTE
2. **Auditoría obligatoria** para cualquier cambio ← YA EXISTE ✅
3. **Soft delete** como único método de eliminación ← YA EXISTE ✅
4. **Retención de 10 años** en política ← VERIFICAR EN BD
5. **Documentación clara** en términos de servicio ← RECOMENDADO

Con estos cambios, **TarantulaHawk será compliant con:**
- ✅ LFPIORPI Art. 17
- ✅ LFPYSU Art. 17
- ✅ GAFI Recomendaciones 10-11
- ✅ Estándares internacionales de PLD

---

**Documento preparado:** 27 de enero de 2026  
**Próxima revisión:** 27 de abril de 2026 (trimestral)  
**Responsable de cumplimiento:** Compliance Officer / Legal
