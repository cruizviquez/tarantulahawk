#!/bin/bash
# Script de inicio rápido para sistema Lista 69B SAT
# Instala dependencias y ejecuta primera descarga

set -e  # Salir si hay errores

echo "======================================"
echo "🚀 INICIO RÁPIDO - LISTA 69B SAT"
echo "======================================"
echo ""

# Detectar directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Paso 1: Instalar dependencias
echo "📦 Paso 1/3: Instalando dependencias Python..."
pip install -q requests beautifulsoup4 pandas openpyxl tabula-py PyPDF2

if [ $? -eq 0 ]; then
    echo "✅ Dependencias instaladas correctamente"
else
    echo "❌ Error al instalar dependencias"
    exit 1
fi

echo ""

# Paso 2: Descargar Lista 69B
echo "📥 Paso 2/3: Descargando Lista 69B del SAT..."
echo "(Esto puede tardar 1-2 minutos dependiendo de la conexión)"
echo ""

python actualizar_lista_69b.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Lista 69B descargada exitosamente"
else
    echo ""
    echo "⚠️  Error al descargar lista automáticamente"
    echo "💡 Puedes descargar manualmente desde:"
    echo "   https://www.sat.gob.mx/consulta/92764/descarga-de-listados-completos"
    echo ""
    echo "   Luego coloca los archivos Excel en:"
    echo "   ../data/lista_69b/"
    echo ""
fi

echo ""

# Paso 3: Ejecutar prueba
echo "🧪 Paso 3/3: Ejecutando prueba del sistema..."
echo ""

python test_lista_69b.py

echo ""
echo "======================================"
echo "✅ CONFIGURACIÓN COMPLETADA"
echo "======================================"
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "1. Ver datos descargados:"
echo "   ls -lh ../data/lista_69b/"
echo ""
echo "2. Ejecutar ejemplo interactivo:"
echo "   python ejemplo_lista_69b.py"
echo ""
echo "3. Configurar actualización automática (cron):"
echo "   crontab -e"
echo "   Agregar: 0 6 * * * cd $(pwd) && python actualizar_lista_69b.py"
echo ""
echo "4. Ver documentación completa:"
echo "   cat ../../../LISTA_69B_AUTOMATIZACION.md"
echo ""
echo "======================================"
