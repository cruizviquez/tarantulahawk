#!/bin/bash
# QUICK START - Consolidación de Carpetas
# Ejecuta este archivo para consolidar automáticamente

echo "╔════════════════════════════════════════════════════════╗"
echo "║   🧹 CONSOLIDACIÓN DE CARPETAS - TarantulaHawk       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Este script va a:"
echo "  ✅ Preservar archivos importantes"
echo "  ✅ Consolidar outputs/ y uploads/ en app/backend/"
echo "  ❌ Eliminar carpetas duplicadas/redundantes"
echo ""
read -p "¿Continuar? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelado por el usuario"
    exit 0
fi

echo ""
echo "🚀 Iniciando consolidación..."
echo ""

# Ejecutar el script principal
bash consolidate_folders.sh

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   ✅ CONSOLIDACIÓN COMPLETADA                         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📋 SIGUIENTE PASO CRÍTICO:"
echo ""
echo "   1. Verifica que el backend funciona:"
echo "      cd app/backend"
echo "      source venv/bin/activate"
echo "      python api/enhanced_main_api.py"
echo ""
echo "   2. Prueba un upload + análisis completo"
echo ""
echo "   3. Si algo falla, revisa:"
echo "      - CONSOLIDATION_EXECUTIVE_SUMMARY.md"
echo "      - FOLDER_CONSOLIDATION.md"
echo ""
echo "   4. Reporta cualquier problema inmediatamente"
echo ""
echo "═════════════════════════════════════════════════════════"
echo ""
