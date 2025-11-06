#!/bin/bash
# Start backend in background for testing

cd /workspaces/tarantulahawk/app/backend

echo "🕷️  Iniciando TarantulaHawk Backend..."

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "📦 Creando virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Check if requirements installed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📦 Instalando dependencias..."
    pip install -r requirements.txt -q
fi

# Set PORT
export PORT=8000

# Start uvicorn from api directory
cd api
echo "🚀 Iniciando servidor en puerto $PORT..."
echo "📚 Docs: http://localhost:$PORT/api/docs"
echo ""

# Run in foreground (use Ctrl+C to stop)
uvicorn enhanced_main_api:app --host 0.0.0.0 --port $PORT --reload
