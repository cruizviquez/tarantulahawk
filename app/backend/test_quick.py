#!/usr/bin/env python3
"""
test_quick.py - Test rápido del enriquecedor + runner
"""

import sys
import os
from pathlib import Path

# Setup paths
os.chdir('/workspaces/tarantulahawk/app/backend')
sys.path.insert(0, '/workspaces/tarantulahawk/app/backend/api/utils')

print("\n" + "="*70)
print("🧪 QUICK TEST - Enriquecedor + Runner")
print("="*70)

# Test 1: Enriquecer
print("\n📋 Test 1: Enriquecimiento en modo inferencia")
try:
    from validador_enriquecedor import procesar_archivo
    
    result = procesar_archivo(
        input_csv='test_upload.csv',
        sector_actividad='random',
        config_path='models/config_modelos.json',
        training_mode=False,
        analysis_id='quick_test'
    )
    print("✅ Enriquecimiento OK")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 2: Verificar pending
print("\n📋 Test 2: Verificar archivo pending")
pending_path = Path('outputs/enriched/pending/quick_test.csv')
if pending_path.exists():
    import pandas as pd
    df = pd.read_csv(pending_path, nrows=1)
    cols = df.columns.tolist()
    
    print(f"✅ Archivo creado: {len(cols)} columnas")
    
    # Verificar que NO tiene clasificacion_lfpiorpi
    if 'clasificacion_lfpiorpi' in cols:
        print("❌ ERROR: Tiene clasificacion_lfpiorpi (debería omitirse)")
        sys.exit(1)
    else:
        print("✅ Correcto: NO tiene clasificacion_lfpiorpi")
    
    # Mostrar primeras columnas
    print(f"\nPrimeras 10 columnas: {cols[:10]}")
else:
    print("❌ Archivo pending no creado")
    sys.exit(1)

# Test 3: Runner
print("\n📋 Test 3: Ejecutar ML Runner")
print("Ejecuta manualmente:")
print("  cd /workspaces/tarantulahawk/app/backend/api")
print("  python3 ml_runner.py quick_test")

print("\n" + "="*70)
print("✅ Enriquecimiento completado. Ejecuta el runner manualmente.")
print("="*70)
