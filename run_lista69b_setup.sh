#!/bin/bash
# Script de ejecución e instalación de cron para Lista 69B
# Ejecutar con: bash run_and_cron.sh

set -e

echo "======================================"
echo "🚀 LISTA 69B SAT - SETUP + CRON"
echo "======================================"
echo ""

# Determinar directorio actual
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"
BACKEND_SCRIPTS="$PROJECT_ROOT/app/backend/scripts"

echo "📂 Directorios:"
echo "   Proyecto: $PROJECT_ROOT"
echo "   Scripts: $BACKEND_SCRIPTS"
echo ""

# Paso 1: Instalar dependencias
echo "📦 Paso 1/2: Instalando dependencias Python..."
echo ""

cd "$BACKEND_SCRIPTS"

pip install -q requests beautifulsoup4 pandas openpyxl 2>/dev/null || pip3 install -q requests beautifulsoup4 pandas openpyxl

if [ $? -eq 0 ]; then
    echo "✅ Dependencias instaladas"
else
    echo "⚠️  Algunas dependencias pueden no estar disponibles"
fi

echo ""

# Paso 2: Ejecutar descarga inicial
echo "📥 Descargando Lista 69B del SAT (puede tardar 1-2 minutos)..."
echo ""

python3 actualizar_lista_69b.py 2>/dev/null || python actualizar_lista_69b.py

echo ""
echo "✅ Descarga completada"
echo ""

# Paso 3: Configurar cron
echo "⏰ Paso 2/2: Configurando actualización automática (cron)..."
echo ""

# Crear el comando cron
CRON_COMMAND="0 6 * * * cd $BACKEND_SCRIPTS && python3 actualizar_lista_69b.py >> $BACKEND_SCRIPTS/../data/lista_69b/actualizacion_cron.log 2>&1"

# Verificar si ya existe en crontab
if crontab -l 2>/dev/null | grep -q "actualizar_lista_69b.py"; then
    echo "⚠️  Cron ya configurado para actualizar Lista 69B"
    echo ""
    echo "📋 Cron actual:"
    crontab -l | grep "actualizar_lista_69b.py"
else
    # Agregar nuevo cron
    (crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -
    
    if [ $? -eq 0 ]; then
        echo "✅ Cron configurado exitosamente"
        echo ""
        echo "⏰ Se ejecutará DIARIAMENTE a las 6:00 AM"
        echo ""
        echo "📋 Comando cron agregado:"
        echo "   $CRON_COMMAND"
    else
        echo "⚠️  Error al configurar cron (es normal en algunos sistemas)"
        echo ""
        echo "💡 Puedes configurarlo manualmente con:"
        echo "   crontab -e"
        echo ""
        echo "   Y agregar esta línea:"
        echo "   $CRON_COMMAND"
    fi
fi

echo ""

# Paso 4: Mostrar información
echo "======================================"
echo "✅ CONFIGURACIÓN COMPLETADA"
echo "======================================"
echo ""
echo "📊 Estado:"
crontab -l 2>/dev/null | grep -c "actualizar_lista_69b.py" && echo "   ✅ Actualización automática: ACTIVA" || echo "   ⚠️  Actualización automática: No configurada"
echo ""

if [ -f "$BACKEND_SCRIPTS/../data/lista_69b/metadata.json" ]; then
    TOTAL_RFCS=$(grep -o '"total_rfcs":[0-9]*' "$BACKEND_SCRIPTS/../data/lista_69b/metadata.json" | cut -d: -f2)
    if [ ! -z "$TOTAL_RFCS" ] && [ "$TOTAL_RFCS" -gt 0 ]; then
        echo "   ✅ Lista descargada: $TOTAL_RFCS RFCs"
    else
        echo "   ℹ️  Lista en descarga o procesamiento"
    fi
fi

echo ""
echo "📁 Archivos generados:"
echo "   app/backend/data/lista_69b/"
ls -lh "$BACKEND_SCRIPTS/../data/lista_69b/" 2>/dev/null | tail -n +2 | awk '{print "      " $9 " (" $5 ")"}'

echo ""
echo "💡 Próximos pasos:"
echo "   1. Ver metadata: cat app/backend/data/lista_69b/metadata.json"
echo "   2. Probar: python3 app/backend/scripts/ejemplo_lista_69b.py"
echo "   3. Ver cron: crontab -l"
echo ""
echo "======================================"
