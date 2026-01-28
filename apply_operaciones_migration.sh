#!/bin/bash
# Script para aplicar migración 20260128_add_operaciones_fields.sql a Supabase
# Uso: ./apply_operaciones_migration.sh

set -e

echo "🔧 Aplicando migración de campos de operaciones..."

# Verificar que existe el archivo de migración
MIGRATION_FILE="supabase/migrations/20260128_add_operaciones_fields.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: No se encontró el archivo $MIGRATION_FILE"
    exit 1
fi

# Leer las credenciales de Supabase desde variables de entorno
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Variable DATABASE_URL no está configurada."
    echo ""
    echo "Opción 1: Configurar variable de entorno"
    echo "  export DATABASE_URL='postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres'"
    echo ""
    echo "Opción 2: Aplicar manualmente desde Supabase Dashboard"
    echo "  1. Ve a https://supabase.com/dashboard"
    echo "  2. Selecciona tu proyecto"
    echo "  3. SQL Editor → New Query"
    echo "  4. Copia el contenido de: $MIGRATION_FILE"
    echo "  5. Click en Run"
    echo ""
    exit 1
fi

# Aplicar migración usando psql
echo "📊 Conectando a Supabase..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Migración aplicada exitosamente!"
    echo ""
    echo "Columnas agregadas:"
    echo "  - metodo_pago"
    echo "  - actividad_vulnerable"
    echo "  - referencia_factura"
    echo "  - notas_internas"
    echo "  - ubicacion_operacion (nuevo - factor EBR)"
    echo "  - eliminada, fecha_eliminacion, eliminada_por, razon_eliminacion"
    echo "  - updated_at, updated_by"
    echo ""
    echo "Tabla creada:"
    echo "  - auditoria_operaciones"
else
    echo "❌ Error al aplicar la migración"
    exit 1
fi
