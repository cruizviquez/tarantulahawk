#!/bin/bash
# Quick backend health check

echo "🔍 Verificando estado del backend..."
echo ""

# Check if backend is running
BACKEND_URL="${NEXT_PUBLIC_BACKEND_API_URL:-https://silver-funicular-wp59w7jgxvvf9j47-8000.app.github.dev}"

echo "Backend URL: $BACKEND_URL"
echo ""

# Try to hit health endpoint
echo "Verificando /health endpoint..."
curl -v "$BACKEND_URL/health" 2>&1 | head -20

echo ""
echo "Verificando /api/health endpoint..."
curl -v "$BACKEND_URL/api/health" 2>&1 | head -20

echo ""
echo "✅ Verificación completada"
