#!/bin/bash
# =============================================================================
# INSTALADOR Y CONFIGURADOR - LISTA 69B SAT
# =============================================================================
# 
# Este archivo ejecuta todo lo necesario para:
# ✅ Instalar dependencias
# ✅ Descargar Lista 69B del SAT
# ✅ Configurar actualización automática (cron - 6am diario)
#
# USO:
#   bash INSTALAR_LISTA_69B.sh
#
# =============================================================================

set -e

echo ""
echo "╔═════════════════════════════════════════════════════════════════╗"
echo "║        📋 INSTALADOR LISTA 69B SAT - TARANTULAHAWK             ║"
echo "╚═════════════════════════════════════════════════════════════════╝"
echo ""

# Detectar directorio del script
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_SCRIPTS="$PROJECT_ROOT/app/backend/scripts"

echo "📍 Ubicación del proyecto: $PROJECT_ROOT"
echo ""

# Verificar que Python está disponible
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "❌ Error: Python no está instalado"
        exit 1
    fi
    PYTHON_CMD="python"
else
    PYTHON_CMD="python3"
fi

echo "🐍 Python detectado: $PYTHON_CMD ($($PYTHON_CMD --version))"
echo ""

# Ejecutar setup con Python
echo "🚀 Ejecutando setup completo..."
echo ""

$PYTHON_CMD "$PROJECT_ROOT/setup_lista69b_completo.py"

exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo "╔═════════════════════════════════════════════════════════════════╗"
    echo "║                   ✅ INSTALACIÓN COMPLETADA                     ║"
    echo "╚═════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📋 ARCHIVOS DISPONIBLES:"
    echo "   • Actualizar manualmente:"
    echo "     $PYTHON_CMD $BACKEND_SCRIPTS/actualizar_lista_69b.py"
    echo ""
    echo "   • Probar sistema:"
    echo "     $PYTHON_CMD $BACKEND_SCRIPTS/test_lista_69b.py"
    echo ""
    echo "   • Ejemplo interactivo:"
    echo "     $PYTHON_CMD $BACKEND_SCRIPTS/ejemplo_lista_69b.py"
    echo ""
    echo "⏰ CRON (actualización automática diaria 6am):"
    echo "   Ver:    crontab -l | grep actualizar_lista_69b"
    echo "   Editar: crontab -e"
    echo ""
    echo "📖 DOCUMENTACIÓN:"
    echo "   • Guía completa: cat LISTA_69B_AUTOMATIZACION.md"
    echo "   • Quick ref:     cat LISTA_69B_QUICK_REFERENCE.txt"
    echo ""
else
    echo "⚠️  INSTALACIÓN COMPLETADA CON ADVERTENCIAS"
    echo "Revisa los mensajes arriba para más detalles."
    echo ""
fi

echo "═════════════════════════════════════════════════════════════════"
