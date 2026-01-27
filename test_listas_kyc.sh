#!/bin/bash
#
# Script de prueba rápida del sistema de listas KYC
#

echo "=================================="
echo "🧪 TEST: Sistema Listas KYC Gratis"
echo "=================================="
echo ""

# Verificar Python
echo "1️⃣ Verificando Python..."
if command -v python3 &> /dev/null; then
    echo "   ✅ Python: $(python3 --version)"
else
    echo "   ❌ Python3 no encontrado"
    exit 1
fi

# Verificar dependencias
echo ""
echo "2️⃣ Verificando dependencias..."
python3 -c "import requests, bs4, pandas" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ Dependencias instaladas"
else
    echo "   ⚠️  Instalando dependencias..."
    pip install -q requests beautifulsoup4 pandas openpyxl lxml
fi

# Verificar estructura de directorios
echo ""
echo "3️⃣ Verificando directorios..."
dirs=("app/backend/data/lista_69b" "app/backend/data/ofac_cache" "app/backend/data/csnu_cache" "app/backend/data/uif_bloqueados" "app/backend/data/peps_mexico")

for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "   ✅ $dir"
    else
        echo "   ⚠️  Creando $dir..."
        mkdir -p "$dir"
    fi
done

# Verificar scripts
echo ""
echo "4️⃣ Verificando scripts..."
if [ -f "app/backend/scripts/actualizar_listas_todas.py" ]; then
    echo "   ✅ actualizar_listas_todas.py"
else
    echo "   ❌ Script principal no encontrado"
    exit 1
fi

# Verificar estado de listas
echo ""
echo "5️⃣ Estado actual de listas:"
python3 << 'PYTHON'
import json
from pathlib import Path

listas = {
    'Lista 69B': 'app/backend/data/lista_69b/metadata.json',
    'OFAC': 'app/backend/data/ofac_cache/metadata.json',
    'CSNU': 'app/backend/data/csnu_cache/metadata.json',
    'UIF': 'app/backend/data/uif_bloqueados/metadata.json',
    'PEPs': 'app/backend/data/peps_mexico/metadata.json'
}

for nombre, path in listas.items():
    meta_path = Path(path)
    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
            total = meta.get('total_rfcs', meta.get('total_registros', meta.get('total_personas', meta.get('total_peps', 0))))
            fecha = meta.get('fecha_actualizacion', 'N/A')
            print(f"   ✅ {nombre:12} → {total:6} registros | {fecha[:10] if fecha != 'N/A' else 'N/A'}")
    else:
        print(f"   ⚠️  {nombre:12} → NO DESCARGADO")
PYTHON

# Pregunta si quiere ejecutar actualización
echo ""
echo "6️⃣ ¿Desea ejecutar actualización ahora? (puede tardar 3-5 min)"
read -p "   [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Ejecutando actualización completa..."
    echo "   (Esto descargará ~30MB de datos)"
    echo ""
    python3 app/backend/scripts/actualizar_listas_todas.py
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Actualización completada exitosamente"
    else
        echo ""
        echo "❌ Error en la actualización"
        exit 1
    fi
else
    echo "   ⏭️  Saltando actualización"
fi

# Resumen final
echo ""
echo "=================================="
echo "📊 RESUMEN"
echo "=================================="
echo ""
echo "Scripts disponibles:"
echo "  • Actualizar todas: python3 app/backend/scripts/actualizar_listas_todas.py"
echo "  • Solo Lista 69B:   python3 app/backend/scripts/actualizar_lista_69b.py"
echo ""
echo "Configurar cron (actualización diaria 6 AM):"
echo "  crontab -e"
echo "  0 6 * * * cd $(pwd) && python3 app/backend/scripts/actualizar_listas_todas.py >> /var/log/kyc_listas.log 2>&1"
echo ""
echo "Ver estado:"
echo "  ls -lh app/backend/data/*/"
echo ""
echo "Ver logs:"
echo "  tail -f /var/log/kyc_listas.log"
echo ""
echo "✅ Sistema listo para validaciones KYC!"
echo "=================================="
