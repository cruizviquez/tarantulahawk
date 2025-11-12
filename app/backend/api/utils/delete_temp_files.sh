#!/bin/bash
# Script para eliminar archivos temporales ya integrados

cd "$(dirname "$0")"

echo "🗑️  Eliminando archivos temporales..."

if [ -f "ml_runner_FINAL.py" ]; then
    rm ml_runner_FINAL.py
    echo "✅ Eliminado: ml_runner_FINAL.py"
else
    echo "⚠️  No encontrado: ml_runner_FINAL.py"
fi

if [ -f "predictor_adaptive_CORRECTED.py" ]; then
    rm predictor_adaptive_CORRECTED.py
    echo "✅ Eliminado: predictor_adaptive_CORRECTED.py"
else
    echo "⚠️  No encontrado: predictor_adaptive_CORRECTED.py"
fi

echo "✅ Limpieza completada"
rm delete_temp_files.sh
