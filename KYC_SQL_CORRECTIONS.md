## Análisis y Correcciones al Script SQL para KYC en Supabase

### 🔍 PROBLEMAS ENCONTRADOS Y CORREGIDOS

#### 1. **Orden de Creación de Tablas**
**Problema**: Las referencias de Foreign Keys iban hacia adelante (a tablas que aún no existían)
- `operaciones` referenciaba `analisis_ml` antes de crearla
- `operaciones` referenciaba `reportes_uif` antes de crearla

**Solución**: Reorganicé el orden de creación:
1. `configuracion_so` (sin references, tabla base)
2. `clientes` (con self-reference a `beneficiario_controlador_id`)
3. `cliente_documentos`
4. `busquedas_listas`
5. `analisis_ml`
6. `reportes_uif`
7. `operaciones` (al final, con todas sus referencias)

---

#### 2. **Missing RLS Policies**
**Problema**: Las tablas `busquedas_listas` y `analisis_ml` tenían RLS habilitado pero sin políticas definidas

**Solución**: Agregué políticas RLS específicas para:
- `busquedas_user_policy` en `busquedas_listas`
- `analisis_user_policy` en `analisis_ml`
- `configuracion_user_policy` en `configuracion_so`

---

#### 3. **Valores JSONB mal formados**
**Problema**: 
```sql
factores_riesgo JSONB DEFAULT '[]',
```
Supabase requiere format explícito

**Solución**:
```sql
factores_riesgo JSONB DEFAULT '[]'::jsonb,
```

---

#### 4. **Foreign Keys sin ON DELETE**
**Problema**: Algunos FKs no especificaban comportamiento en DELETE

**Solución**: Agregué `ON DELETE SET NULL` o `ON DELETE CASCADE` según corresponde:
- `beneficiario_controlador_id` → `ON DELETE SET NULL`
- `cliente_id` en documentos → `ON DELETE CASCADE`
- `analisis_id` en operaciones → `ON DELETE SET NULL`
- `reporte_uif_id` en operaciones → `ON DELETE SET NULL`

---

#### 5. **IF NOT EXISTS agregados**
**Problema**: Sin validación, si el script se ejecuta dos veces causa error

**Solución**: Agregué `IF NOT EXISTS` a todas las creaciones:
```sql
CREATE TABLE IF NOT EXISTS clientes (...)
CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id);
```

---

#### 6. **DROP IF EXISTS para Triggers y Policies**
**Problema**: Re-ejecutar el script causaba conflictos

**Solución**: Agregué limpieza previa:
```sql
DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
DROP POLICY IF EXISTS clientes_user_policy ON clientes;
```

---

#### 7. **GROUP BY incompleto en VIEW**
**Problema**: Vista `clientes_alto_riesgo` tenía GROUP BY incompleto
```sql
GROUP BY c.cliente_id;  -- ❌ Falta rest de columnas
```

**Solución**: Agregué todas las columnas SELECT al GROUP BY:
```sql
GROUP BY c.cliente_id, c.nombre_completo, c.rfc, c.nivel_riesgo, c.score_ebr, c.es_pep, c.en_lista_69b, c.en_lista_ofac;
```

---

#### 8. **COALESCE en agregación**
**Problema**: SUM puede retornar NULL si no hay registros
```sql
SUM(o.monto) as monto_total_mes  -- Puede ser NULL
```

**Solución**:
```sql
COALESCE(SUM(o.monto), 0) as monto_total_mes
```

---

#### 9. **Referencias de auth.users removidas**
**Problema**: No puedes usar `REFERENCES auth.users(id)` directamente en Supabase
```sql
aprobado_por UUID REFERENCES auth.users(id),  -- ❌ Error en Supabase
```

**Solución**: Cambié a solo UUID sin CONSTRAINT:
```sql
aprobado_por UUID,  -- ✅ Solo UUID, sin constraint
```

**Nota**: Valida en la aplicación con un trigger o middleware.

---

#### 10. **Índices adicionales útiles**
**Agregados**:
- `idx_clientes_beneficiario` en `beneficiario_controlador_id`
- `idx_operaciones_analisis` en `analisis_id`
- `idx_operaciones_reporte` en `reporte_uif_id`

---

### ✅ CAMBIOS PRINCIPALES

| Aspecto | Antes | Después |
|---------|-------|---------|
| Orden tablas | Desordenado | Correcto (sin referencias adelante) |
| RLS Policies | Incompleto | Todas las tablas con políticas |
| JSONB defaults | Incorrecto | Con `::jsonb` casting |
| ON DELETE | Ausente | Definido para todas las FKs |
| Idempotencia | ❌ | ✅ IF NOT EXISTS en todo |
| GROUP BY | Incompleto | Correcto en ambas vistas |
| auth.users ref | REFERENCES auth.users | UUID solo (sin CONSTRAINT) |

---

### 🚀 CÓMO EJECUTAR

1. **Opción A - Supabase SQL Editor**:
   - Ve a tu proyecto Supabase
   - SQL Editor → New Query
   - Copia todo el contenido de `kyc_schema_fixed.sql`
   - Ejecuta

2. **Opción B - Desde CLI**:
   ```bash
   supabase db push  # Si estás usando migrations
   ```

3. **Opción C - Desde Node/TypeScript**:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   const supabase = createClient(url, key);
   const schema = await fetch('/kyc_schema_fixed.sql').then(r => r.text());
   await supabase.rpc('exec_sql', { sql: schema });
   ```

---

### ⚠️ CONSIDERACIONES ADICIONALES

1. **FIELs y Certificados**: Las columnas de FIEL están en texto plano. Considera encriptación:
   ```sql
   fiel_password_encrypted TEXT,  -- Debe ser decriptado en app
   fiel_certificado_path TEXT,     -- Considera almacenar en S3, no en DB
   ```

2. **Validación de RFC/CURP**: Implementa en tu aplicación (ya está en `kyc-validators.ts`)

3. **Auditoría completa**: Considera agregar tabla de audit logs:
   ```sql
   CREATE TABLE audit_logs (
     id SERIAL PRIMARY KEY,
     table_name VARCHAR(255),
     action VARCHAR(20),
     old_data JSONB,
     new_data JSONB,
     changed_by UUID REFERENCES auth.users(id),
     changed_at TIMESTAMP DEFAULT NOW()
   );
   ```

4. **Permisos de columnas**: Si necesitas sensibilidad en datos (ej: CURP, RFC), considera agregar RLS a nivel de columna.

---

### 📋 Siguiente Paso
Ejecuta el script en Supabase y verifica que todas las tablas se crearon correctamente con:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```
