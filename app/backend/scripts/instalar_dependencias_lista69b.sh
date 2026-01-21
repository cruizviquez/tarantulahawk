#!/bin/bash
# Script para instalar dependencias necesarias para actualizar Lista 69B

echo "======================================"
echo "📦 INSTALANDO DEPENDENCIAS LISTA 69B"
echo "======================================"

# Instalar dependencias Python
pip install requests beautifulsoup4 pandas openpyxl tabula-py PyPDF2

echo ""
echo "✅ Dependencias instaladas"
echo ""
echo "Para actualizar la Lista 69B, ejecutar:"
echo "  python app/backend/scripts/actualizar_lista_69b.py"
echo ""
echo "Para automatizar (cron diario 6am):"
echo "  0 6 * * * cd /workspaces/tarantulahawk && python app/backend/scripts/actualizar_lista_69b.py"
echo ""
