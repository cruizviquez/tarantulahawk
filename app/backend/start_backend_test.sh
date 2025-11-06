#!/bin/bash
# start_backend_test.sh - Inicia backend con billing deshabilitado para testing

cd /workspaces/tarantulahawk/app/backend

echo "🚀 Iniciando backend en modo TEST (billing deshabilitado)..."
echo ""

# Configurar variables de entorno
export DISABLE_BILLING=1
export PYTHONUNBUFFERED=1

# Matar procesos previos
pkill -f "uvicorn.*enhanced_main_api" || true
sleep 2

# Iniciar backend
cd api
echo "📍 Puerto: 8000"
echo "🔧 DISABLE_BILLING=1"
echo ""
echo "Logs del backend:"
echo "========================================================================"

python3 -m uvicorn enhanced_main_api:app --host 0.0.0.0 --port 8000 --reload
