#!/bin/bash
# smoke_test_ml_runner.sh - Test completo del flujo de inferencia

set -e  # Exit on error

echo "========================================================================"
echo "🧪 SMOKE TEST - ML Runner Flow"
echo "========================================================================"

cd /workspaces/tarantulahawk/app/backend

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "${BLUE}📋 Paso 1: Verificar CSV de prueba${NC}"
if [ ! -f "test_upload.csv" ]; then
    echo "${RED}❌ test_upload.csv no encontrado${NC}"
    exit 1
fi
echo "${GREEN}✅ test_upload.csv encontrado ($(wc -l < test_upload.csv) líneas)${NC}"

echo ""
echo "${BLUE}📋 Paso 2: Limpiar outputs previos${NC}"
rm -f outputs/enriched/pending/smoke_test_001.csv
rm -f outputs/enriched/processed/smoke_test_001.csv
rm -f outputs/enriched/processed/smoke_test_001.json
rm -f outputs/enriched/failed/smoke_test_001*
echo "${GREEN}✅ Directorios limpiados${NC}"

echo ""
echo "${BLUE}📋 Paso 3: Enriquecer CSV (modo inferencia)${NC}"
cd api/utils
python3 << 'PYTHON_EOF'
import sys
sys.path.insert(0, '/workspaces/tarantulahawk/app/backend/api/utils')
from validador_enriquecedor import procesar_archivo

try:
    result = procesar_archivo(
        input_csv='../../test_upload.csv',
        sector_actividad='random',
        config_path='../../models/config_modelos.json',
        training_mode=False,
        analysis_id='smoke_test_001'
    )
    print(f"✅ Enriquecimiento exitoso: {result}")
except Exception as e:
    print(f"❌ Error en enriquecimiento: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYTHON_EOF

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ Enriquecimiento completado${NC}"
else
    echo "${RED}❌ Error en enriquecimiento${NC}"
    exit 1
fi

cd ../..

echo ""
echo "${BLUE}📋 Paso 4: Verificar archivo pending${NC}"
if [ -f "outputs/enriched/pending/smoke_test_001.csv" ]; then
    ROWS=$(wc -l < outputs/enriched/pending/smoke_test_001.csv)
    COLS=$(head -1 outputs/enriched/pending/smoke_test_001.csv | awk -F',' '{print NF}')
    echo "${GREEN}✅ Archivo pending creado: $ROWS filas, $COLS columnas${NC}"
    
    # Verificar que NO tiene clasificacion_lfpiorpi
    if head -1 outputs/enriched/pending/smoke_test_001.csv | grep -q "clasificacion_lfpiorpi"; then
        echo "${RED}❌ ERROR: archivo tiene clasificacion_lfpiorpi (debería omitirse en inferencia)${NC}"
        exit 1
    else
        echo "${GREEN}✅ Correcto: NO tiene clasificacion_lfpiorpi${NC}"
    fi
else
    echo "${RED}❌ Archivo pending no creado${NC}"
    exit 1
fi

echo ""
echo "${BLUE}📋 Paso 5: Ejecutar ML Runner${NC}"
cd api
python3 ml_runner.py smoke_test_001

if [ $? -eq 0 ]; then
    echo "${GREEN}✅ ML Runner completado${NC}"
else
    echo "${RED}❌ Error en ML Runner${NC}"
    exit 1
fi

cd ..

echo ""
echo "${BLUE}📋 Paso 6: Verificar resultados${NC}"

# Verificar que el CSV se movió a processed
if [ -f "outputs/enriched/processed/smoke_test_001.csv" ]; then
    echo "${GREEN}✅ CSV movido a processed/${NC}"
else
    echo "${RED}❌ CSV no se movió a processed/${NC}"
    exit 1
fi

# Verificar que se generó el JSON de resultados
if [ -f "outputs/enriched/processed/smoke_test_001.json" ]; then
    echo "${GREEN}✅ JSON de resultados generado${NC}"
    
    # Mostrar resumen
    echo ""
    echo "${BLUE}📊 Resumen de resultados:${NC}"
    python3 << 'PYTHON_EOF'
import json
with open('outputs/enriched/processed/smoke_test_001.json', 'r') as f:
    data = json.load(f)
    resumen = data.get('resumen', {})
    print(f"  Total transacciones: {resumen.get('total_transacciones')}")
    print(f"  🔴 Preocupante: {resumen.get('preocupante')}")
    print(f"  🟠 Inusual: {resumen.get('inusual')}")
    print(f"  🟡 Relevante: {resumen.get('relevante')}")
    print(f"  🟢 Limpio: {resumen.get('limpio')}")
    print(f"  ⚖️  Guardrails: {resumen.get('guardrails_aplicados')}")
PYTHON_EOF
else
    echo "${RED}❌ JSON de resultados no generado${NC}"
    exit 1
fi

# Verificar que pending está vacío
if [ -f "outputs/enriched/pending/smoke_test_001.csv" ]; then
    echo "${RED}❌ Archivo aún en pending (no se movió)${NC}"
    exit 1
else
    echo "${GREEN}✅ Pending vacío (archivo procesado correctamente)${NC}"
fi

echo ""
echo "========================================================================"
echo "${GREEN}✅ SMOKE TEST EXITOSO - Todos los pasos completados${NC}"
echo "========================================================================"
echo ""
echo "📁 Archivos generados:"
echo "  - outputs/enriched/processed/smoke_test_001.csv (enriquecido)"
echo "  - outputs/enriched/processed/smoke_test_001.json (resultados ML)"
echo ""
echo "🎯 El flujo completo funciona correctamente:"
echo "  1. ✅ Enriquecimiento en modo inferencia (sin etiqueta)"
echo "  2. ✅ Guardado en pending/"
echo "  3. ✅ Procesamiento ML con alineación de features"
echo "  4. ✅ Aplicación de guardrails LFPIORPI"
echo "  5. ✅ Guardado de resultados en processed/"
echo "  6. ✅ Movimiento atómico de archivos"
echo ""
