#!/bin/bash
# verify_consolidation.sh - Verifica que la consolidación se ejecutó correctamente

echo "╔════════════════════════════════════════════════════════╗"
echo "║   🔍 VERIFICACIÓN POST-CONSOLIDACIÓN                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

echo "1️⃣ Verificando que carpetas redundantes fueron eliminadas..."
echo ""

# Carpetas que NO deben existir
for dir in "outputs" "uploads" "app/outputs" "app/backend/api/outputs" "app/backend/api/uploads"; do
    if [ -d "$dir" ]; then
        echo "   ❌ ERROR: /$dir/ aún existe (debería estar eliminada)"
        ERRORS=$((ERRORS + 1))
    else
        echo "   ✅ /$dir/ eliminada correctamente"
    fi
done

echo ""
echo "2️⃣ Verificando que carpetas centralizadas existen..."
echo ""

# Carpetas que DEBEN existir
for dir in "app/backend/outputs" "app/backend/uploads" "app/backend/outputs/enriched" "app/backend/outputs/enriched/pending" "app/backend/outputs/enriched/processed" "app/backend/outputs/enriched/failed" "app/backend/outputs/xml" "app/backend/outputs/reports"; do
    if [ -d "$dir" ]; then
        echo "   ✅ /$dir/ existe"
    else
        echo "   ❌ ERROR: /$dir/ no existe (debería existir)"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "3️⃣ Verificando archivos importantes..."
echo ""

# Verificar sample.csv
if [ -f "app/backend/uploads/sample.csv" ]; then
    echo "   ✅ sample.csv preservado en ubicación centralizada"
else
    echo "   ⚠️  WARNING: sample.csv no encontrado"
    WARNINGS=$((WARNINGS + 1))
fi

# Verificar modelos
if [ -f "app/backend/outputs/modelo_ensemble_stack.pkl" ]; then
    echo "   ✅ Modelos ML encontrados"
else
    echo "   ⚠️  WARNING: Modelos ML no encontrados"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "4️⃣ Verificando scripts Python..."
echo ""

# Verificar que no hay referencias hardcodeadas problemáticas
if grep -r "outputs/" app/backend --include="*.py" | grep -v "BASE_DIR" | grep -v "#" | grep -v "\"\"\"" | head -n 1 > /dev/null; then
    echo "   ⚠️  WARNING: Posibles referencias hardcodeadas a outputs/ (revisar manualmente)"
    WARNINGS=$((WARNINGS + 1))
else
    echo "   ✅ No se detectaron referencias hardcodeadas problemáticas"
fi

echo ""
echo "5️⃣ Probando que el backend puede importar módulos..."
echo ""

cd app/backend
if python -c "from api.predictor_adaptive import TarantulaHawkAdaptivePredictor; print('✅ predictor_adaptive importa OK')" 2>/dev/null; then
    echo "   ✅ predictor_adaptive importa correctamente"
else
    echo "   ❌ ERROR: No se puede importar predictor_adaptive"
    ERRORS=$((ERRORS + 1))
fi

if python -c "from api.ml_runner import main; print('✅ ml_runner importa OK')" 2>/dev/null; then
    echo "   ✅ ml_runner importa correctamente"
else
    echo "   ❌ ERROR: No se puede importar ml_runner"
    ERRORS=$((ERRORS + 1))
fi

cd ../..

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   📊 RESUMEN DE VERIFICACIÓN                           ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "   ✅ TODAS LAS VERIFICACIONES PASARON"
    echo ""
    echo "   🎉 La consolidación se ejecutó correctamente"
    echo ""
    echo "   📋 Siguiente paso:"
    echo "      cd app/backend"
    echo "      source venv/bin/activate"
    echo "      python api/enhanced_main_api.py"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "   ⚠️  $WARNINGS WARNING(S) - Revisar pero no crítico"
    echo ""
    echo "   📋 Puedes continuar, pero revisa los warnings arriba"
    echo ""
    exit 0
else
    echo "   ❌ $ERRORS ERROR(S) detectados"
    if [ $WARNINGS -gt 0 ]; then
        echo "   ⚠️  $WARNINGS WARNING(S) adicionales"
    fi
    echo ""
    echo "   ⚠️  LA CONSOLIDACIÓN PUEDE NO HABERSE COMPLETADO CORRECTAMENTE"
    echo ""
    echo "   📋 Acciones sugeridas:"
    echo "      1. Revisa los errores arriba"
    echo "      2. Consulta CONSOLIDATION_EXECUTIVE_SUMMARY.md"
    echo "      3. Considera ejecutar rollback si es necesario"
    echo ""
    exit 1
fi
