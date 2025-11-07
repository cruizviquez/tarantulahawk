#!/usr/bin/env python3
"""
Script rápido para verificar los modelos .pkl y sus features esperadas
"""
import joblib
from pathlib import Path

outputs_dir = Path("outputs")

print("=" * 80)
print("VERIFICANDO MODELOS EN outputs/")
print("=" * 80)

# Modelo Supervisado
supervised_files = list(outputs_dir.glob("modelo_ensemble_stack*.pkl"))
if supervised_files:
    for f in supervised_files:
        print(f"\n📊 {f.name}")
        try:
            bundle = joblib.load(f)
            model = bundle.get("model")
            scaler = bundle.get("scaler")
            if scaler:
                print(f"   ✅ Scaler n_features_in_: {getattr(scaler, 'n_features_in_', 'N/A')}")
            if model:
                print(f"   ✅ Model n_features_in_: {getattr(model, 'n_features_in_', 'N/A')}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
else:
    print("\n❌ No se encontraron modelos supervisados")

# Modelo No Supervisado
unsupervised_files = list(outputs_dir.glob("no_supervisado_bundle*.pkl"))
if unsupervised_files:
    for f in unsupervised_files:
        print(f"\n🔍 {f.name}")
        try:
            bundle = joblib.load(f)
            iso = bundle.get("isolation_forest")
            kmeans = bundle.get("kmeans")
            scaler = bundle.get("scaler")
            
            if scaler:
                print(f"   ✅ Scaler n_features_in_: {getattr(scaler, 'n_features_in_', 'N/A')}")
            if iso:
                print(f"   ✅ IsolationForest n_features_in_: {getattr(iso, 'n_features_in_', 'N/A')}")
            if kmeans:
                print(f"   ✅ KMeans n_features_in_: {getattr(kmeans, 'n_features_in_', 'N/A')}")
            
            # Mostrar qué contiene el bundle
            print(f"   📦 Keys en bundle: {list(bundle.keys())}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
else:
    print("\n❌ No se encontraron modelos no supervisados")

# Modelo Refuerzo
refuerzo_files = list(outputs_dir.glob("refuerzo_bundle*.pkl"))
if refuerzo_files:
    for f in refuerzo_files:
        print(f"\n🎯 {f.name}")
        try:
            bundle = joblib.load(f)
            print(f"   📦 Keys en bundle: {list(bundle.keys())}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

print("\n" + "=" * 80)
print("RECOMENDACIONES:")
print("=" * 80)
print("1. El modelo supervisado y no supervisado deben tener el MISMO número de features")
print("2. Si no coinciden, necesitas re-entrenar el modelo no supervisado")
print("3. O deshabilitar el ajuste no supervisado en config_modelos.json:")
print('   "use_for_adjustment": false')
print("=" * 80)
