#!/bin/bash
# Script de consolidación de carpetas duplicadas
# Ejecutar desde la raíz del proyecto: bash consolidate_folders.sh

set -e  # Exit on error

echo "==================================="
echo "🧹 CONSOLIDACIÓN DE CARPETAS"
echo "==================================="
echo ""

# Verificar que estamos en la raíz del proyecto
if [ ! -d "app/backend" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

echo "📂 Directorio actual: $(pwd)"
echo ""

# PASO 1: Preservar archivos importantes
echo "1️⃣ Preservando archivos importantes..."
echo ""

# Copiar sample.csv si existe
if [ -f "uploads/sample.csv" ]; then
    cp -v uploads/sample.csv app/backend/uploads/
    echo "   ✅ sample.csv preservado"
else
    echo "   ℹ️  sample.csv no encontrado en uploads/"
fi

# Mover archivos pending de app/outputs a backend
if [ -d "app/outputs/enriched/pending" ]; then
    for file in app/outputs/enriched/pending/*.csv; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            cp -v "$file" app/backend/outputs/enriched/pending/
            echo "   ✅ Movido: $filename"
        fi
    done
else
    echo "   ℹ️  No hay carpeta app/outputs/enriched/pending/"
fi

echo ""
echo "2️⃣ Eliminando carpetas redundantes..."
echo ""

# Eliminar /outputs (raíz)
if [ -d "outputs" ]; then
    rm -rf outputs
    echo "   ✅ Eliminado: /outputs"
else
    echo "   ℹ️  /outputs no existe"
fi

# Eliminar /uploads (raíz)
if [ -d "uploads" ]; then
    rm -rf uploads
    echo "   ✅ Eliminado: /uploads"
else
    echo "   ℹ️  /uploads no existe"
fi

# Eliminar /app/outputs
if [ -d "app/outputs" ]; then
    rm -rf app/outputs
    echo "   ✅ Eliminado: /app/outputs"
else
    echo "   ℹ️  /app/outputs no existe"
fi

# Eliminar /app/backend/api/outputs (redundante)
if [ -d "app/backend/api/outputs" ]; then
    # Preservar XMLs si hay alguno importante
    if [ -d "app/backend/api/outputs/xml" ] && [ "$(ls -A app/backend/api/outputs/xml)" ]; then
        cp -v app/backend/api/outputs/xml/*.xml app/backend/outputs/xml/ 2>/dev/null || true
        echo "   ✅ XMLs preservados"
    fi
    rm -rf app/backend/api/outputs
    echo "   ✅ Eliminado: /app/backend/api/outputs"
else
    echo "   ℹ️  /app/backend/api/outputs no existe"
fi

# Eliminar /app/backend/api/uploads (redundante)
if [ -d "app/backend/api/uploads" ]; then
    rm -rf app/backend/api/uploads
    echo "   ✅ Eliminado: /app/backend/api/uploads"
else
    echo "   ℹ️  /app/backend/api/uploads no existe"
fi

echo ""
echo "3️⃣ Verificando estructura final..."
echo ""

echo "📁 Estructura de carpetas después de consolidación:"
echo ""
echo "   ✅ /app/backend/outputs/"
tree -L 3 app/backend/outputs/ 2>/dev/null || ls -R app/backend/outputs/
echo ""
echo "   ✅ /app/backend/uploads/"
ls -lh app/backend/uploads/ | head -20
echo "   ... (mostrando primeros 20 archivos)"
echo ""

echo "==================================="
echo "✅ CONSOLIDACIÓN COMPLETADA"
echo "==================================="
echo ""
echo "📋 Resumen:"
echo "   - Carpetas eliminadas: /outputs, /uploads, /app/outputs, /app/backend/api/outputs, /app/backend/api/uploads"
echo "   - Carpetas centralizadas:"
echo "     • /app/backend/outputs/ (salidas, modelos, XMLs)"
echo "     • /app/backend/uploads/ (archivos de trabajo)"
echo ""
echo "⚠️  SIGUIENTE PASO: Verificar que el backend funciona correctamente"
echo "   cd app/backend && python api/enhanced_main_api.py"
echo ""
