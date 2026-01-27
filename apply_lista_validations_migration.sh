#!/bin/bash
# Script para aplicar migración de columnas de validación de listas

echo "🔄 Aplicando migración: agregar columnas en_lista_uif y en_lista_peps..."

# Verificar si existe psql o si debemos usar Supabase CLI
if command -v supabase &> /dev/null; then
    echo "✅ Usando Supabase CLI..."
    cd /workspaces/tarantulahawk
    supabase db push
else
    echo "⚠️  Supabase CLI no encontrado"
    echo ""
    echo "📋 Por favor, ejecuta el siguiente SQL manualmente en Supabase Dashboard:"
    echo "   https://supabase.com/dashboard/project/[TU_PROJECT_ID]/editor"
    echo ""
    cat supabase/migrations/20260126_add_lista_validations.sql
    echo ""
    echo "O copia el archivo: supabase/migrations/20260126_add_lista_validations.sql"
fi
