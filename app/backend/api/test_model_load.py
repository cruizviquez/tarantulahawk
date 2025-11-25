#!/usr/bin/env python3
"""
Script de prueba para verificar la carga del modelo con joblib
"""
import joblib
import os
from pathlib import Path

# Cambiar al directorio del script
script_dir = Path(__file__).parent
outputs_dir = script_dir.parent / "outputs"
model_path = outputs_dir / "modelo_ensemble_stack.pkl"

print("Verificando modelo con joblib...")
print(f"Ruta del modelo: {model_path}")
print(f"Existe: {model_path.exists()}")

if model_path.exists():
    print(f"Tamaño: {os.path.getsize(model_path)} bytes")
    try:
        bundle = joblib.load(model_path)
        print("✅ Modelo cargado exitosamente con joblib")
        print(f"Keys en bundle: {list(bundle.keys())}")

        if "model" in bundle:
            model = bundle["model"]
            print(f"✅ Modelo encontrado - Tipo: {type(model)}")
            print(f"   Clases: {list(model.classes_)}")

        if "scaler" in bundle:
            scaler = bundle["scaler"]
            print(f"✅ Scaler encontrado - Tipo: {type(scaler)}")

        if "feature_cols" in bundle:
            feature_cols = bundle["feature_cols"]
            print(f"✅ Features encontrados - Cantidad: {len(feature_cols)}")
            print(f"   Primeras 5: {feature_cols[:5]}")

    except Exception as e:
        print(f"❌ Error cargando modelo: {e}")
        import traceback
        traceback.print_exc()
else:
    print("❌ Archivo de modelo no encontrado")