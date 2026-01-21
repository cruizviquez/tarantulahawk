#!/bin/bash
# Script para configurar cron para Lista 69B

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/app/backend/scripts" && pwd)"
PYTHON_CMD=$(which python3 || which python)

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ Error: Python no encontrado"
    exit 1
fi

CRON_COMMAND="0 6 * * * cd $SCRIPT_PATH && $PYTHON_CMD actualizar_lista_69b.py"

# Verificar si ya existe
if crontab -l 2>/dev/null | grep -q "actualizar_lista_69b.py"; then
    echo "⚠️  Cron ya existe para Lista 69B"
    crontab -l | grep "actualizar_lista_69b.py"
else
    # Agregar a crontab
    (crontab -l 2>/dev/null || echo ""; echo "$CRON_COMMAND") | crontab -
    
    if [ $? -eq 0 ]; then
        echo "✅ Cron instalado exitosamente"
        echo ""
        echo "⏰ Horario: Diariamente a las 6:00 AM"
        echo "📂 Ubicación: $SCRIPT_PATH"
        echo "🐍 Python: $PYTHON_CMD"
        echo ""
        echo "Ver cron actual:"
        echo "   crontab -l | grep actualizar_lista_69b"
        echo ""
        echo "Eliminar cron:"
        echo "   crontab -e  # Busca y elimina la línea"
    else
        echo "❌ Error al instalar cron"
    fi
fi
