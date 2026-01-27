# 🔧 Solución al Error: Columnas de Validación Faltantes

## ❌ Problema
```
Error: Could not find the 'en_lista_peps' column of 'clientes' in the schema cache
Error: Could not find the 'validaciones' column of 'clientes' in the schema cache
```

## ✅ Solución: Agregar Columnas Faltantes

### Método 1: Supabase Dashboard (RECOMENDADO)

1. **Abre Supabase Dashboard**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto "TarantulaHawk"

2. **Abre SQL Editor**
   - En el menú lateral: `SQL Editor` > `New Query`

3. **Ejecuta este SQL:**

```sql
-- Agregar columnas de validación de listas faltantes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS en_lista_uif BOOLEAN DEFAULT false;

ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS en_lista_peps BOOLEAN DEFAULT false;

-- Agregar columna para almacenar JSON de todas las validaciones
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS validaciones JSONB DEFAULT '{}'::jsonb;

-- Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_clientes_lista_uif ON clientes(en_lista_uif) 
WHERE en_lista_uif = true;

CREATE INDEX IF NOT EXISTS idx_clientes_lista_peps ON clientes(en_lista_peps) 
WHERE en_lista_peps = true;

-- Índice GIN para búsquedas rápidas en el JSON de validaciones
CREATE INDEX IF NOT EXISTS idx_clientes_validaciones ON clientes USING GIN (validaciones);
```

4. **Haz clic en "Run"** o presiona `Ctrl+Enter`

5. **Verifica el resultado:**
   - Deberías ver: `Success. No rows returned`

6. **Recarga la página de KYC** en tu app

---

### Método 2: Supabase CLI (Alternativo)

Si tienes Supabase CLI instalado:

```bash
cd /workspaces/tarantulahawk
supabase db push
```

Esto aplicará automáticamente la migración en:
`supabase/migrations/20260126_add_lista_validations.sql`

---

### Método 3: Script de Node.js

```bash
npx tsx scripts/apply-kyc-migration.ts
```

Esto mostrará el SQL que debes copiar y pegar en Supabase Dashboard.

---

## 📋 Verificación

Después de aplicar la migración, verifica que las columnas existen:

1. En Supabase Dashboard: `Table Editor` > `clientes`
2. Busca las nuevas columnas:
   - `en_lista_uif` (boolean)
   - `en_lista_peps` (boolean)
   - `validaciones` (jsonb)

## 🎯 Resultado Esperado

Una vez aplicada la migración:
- ✅ El botón "Actualizar Listas" funcionará correctamente
- ✅ Las validaciones de UIF y PEPs se guardarán en la BD
- ✅ La fecha de última actualización se persistirá
- ✅ El nivel de riesgo se actualizará correctamente

## 📝 Notas

- **en_lista_uif**: Indica si el cliente aparece en la lista de Personas Bloqueadas de la UIF (crítico para PLD)
- **en_lista_peps**: Indica si el cliente aparece en listas de PEPs México (obligatorio Art. 17 LFPIORPI)
- **validaciones**: JSON con resultados detallados de todas las validaciones (OFAC, CSNU, Lista 69B, UIF, PEPs, etc.)
- Todas las columnas tienen índices para optimizar consultas

## 🆘 ¿Problemas?

Si encuentras algún error al ejecutar el SQL:
1. Verifica que estás en el proyecto correcto de Supabase
2. Asegúrate de tener permisos de administrador
3. Si el error persiste, envíame el mensaje de error completo
