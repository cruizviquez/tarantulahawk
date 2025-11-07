#!/usr/bin/env python3
"""
Debug script para inspeccionar modelos ML, ver qué features esperan y (opcional) validar
contra un CSV con etiquetas reales para medir accuracy y throughput.

Uso:
    python debug_models.py                # Solo inspección de bundles
    python debug_models.py --csv <path>   # Inspección + validación con etiquetas
"""
import argparse
import joblib
from pathlib import Path
import json
import sys
import time

models_dir = Path(__file__).parent / "outputs"

parser = argparse.ArgumentParser()
parser.add_argument("--csv", help="Ruta a CSV con 'clasificacion_real' para validación", default=None)
parser.add_argument("--min-accuracy", type=float, default=0.90, help="Umbral mínimo de accuracy")
args = parser.parse_args()

print("="*70)
print("🔍 DIAGNÓSTICO DE MODELOS ML")
print("="*70)

# 1. Modelo Supervisado
print("\n📘 Modelo Supervisado (Ensemble Stacking)")
print("-"*70)
supervised_path = None
for cand in [
    "modelo_ensemble_stack_v3.pkl",
    "modelo_ensemble_stack_v2.pkl",
    "modelo_ensemble_stack.pkl",
]:
    candidate = models_dir / cand
    if candidate.exists():
        supervised_path = candidate
        break

if supervised_path and supervised_path.exists():
    print(f"✅ Encontrado: {supervised_path.name}")
    try:
        model_data = joblib.load(supervised_path)
        print(f"✅ Cargado exitosamente")
        print(f"   Tipo: {type(model_data)}")
        print(f"   Keys: {model_data.keys() if isinstance(model_data, dict) else 'Not a dict'}")
        
        if isinstance(model_data, dict):
            if 'feature_names' in model_data:
                features = model_data['feature_names']
                print(f"   Features esperadas ({len(features)}): {features[:10]}...")
            else:
                print("   ⚠️  No tiene 'feature_names' key")
                print(f"   Keys disponibles: {list(model_data.keys())}")
            
            if 'scaler' in model_data:
                scaler = model_data['scaler']
                print(f"   Scaler type: {type(scaler)}")
                if hasattr(scaler, 'n_features_in_'):
                    print(f"   Scaler expects {scaler.n_features_in_} features")
                if hasattr(scaler, 'feature_names_in_'):
                    print(f"   Scaler feature names: {scaler.feature_names_in_[:10]}...")
            
            if 'model' in model_data:
                model = model_data['model']
                print(f"   Model type: {type(model)}")
                if hasattr(model, 'n_features_in_'):
                    print(f"   Model expects {model.n_features_in_} features")
    except Exception as e:
        print(f"❌ Error cargando: {e}")
else:
    print(f"❌ No encontrado ningún modelo supervisado en: modelo_ensemble_stack[_v2|_v3].pkl")

# 2. Modelo No Supervisado
print("\n📗 Modelo No Supervisado (Bundle)")
print("-"*70)
unsupervised_path = None
for cand in [
    "no_supervisado_bundle_v3.pkl",
    "no_supervisado_bundle_v2.pkl",
    "no_supervisado_bundle.pkl",
]:
    candidate = models_dir / cand
    if candidate.exists():
        unsupervised_path = candidate
        break

if unsupervised_path and unsupervised_path.exists():
    print(f"✅ Encontrado: {unsupervised_path.name}")
    try:
        model_data = joblib.load(unsupervised_path)
        print(f"✅ Cargado exitosamente")
        print(f"   Tipo: {type(model_data)}")
        print(f"   Keys: {model_data.keys() if isinstance(model_data, dict) else 'Not a dict'}")
        
        if isinstance(model_data, dict):
            if 'scaler' in model_data:
                scaler = model_data['scaler']
                print(f"   Scaler type: {type(scaler)}")
                if hasattr(scaler, 'n_features_in_'):
                    print(f"   Scaler expects {scaler.n_features_in_} features")
            
            if 'isolation_forest' in model_data:
    except Exception as e:
        print(f"❌ Error cargando: {e}")
else:
    print(f"❌ No encontrado ningún modelo no supervisado en: no_supervisado_bundle[_v2|_v3].pkl")

# 3. Modelo Refuerzo
print("\n📙 Modelo Refuerzo (Bundle)")
print("-"*70)
rl_path = None
for cand in [
    "refuerzo_bundle_v3.pkl",
    "refuerzo_bundle_v2.pkl",
    "refuerzo_bundle.pkl",
]:
    candidate = models_dir / cand
    if candidate.exists():
        rl_path = candidate
        break

if rl_path and rl_path.exists():
    print(f"✅ Encontrado: {rl_path.name}")
    try:
        model_data = joblib.load(rl_path)
        break
if rl_path.exists():
    try:
        model_data = joblib.load(rl_path)
        print(f"✅ Cargado exitosamente")
    except Exception as e:
        print(f"❌ Error cargando: {e}")
else:
    print(f"❌ No encontrado ningún modelo refuerzo en: refuerzo_bundle[_v2|_v3].pkl"){len(model_data) if not any(k in model_data for k in ['q_table', 'thresholds']) else 'N/A'}")
    except Exception as e:
        print(f"❌ Error cargando: {e}")
else:
    print(f"❌ No encontrado: {rl_path}")

# 4. Metadata del No Supervisado
print("\n📄 Metadata No Supervisado V2")
print("-"*70)
metadata_path = models_dir / "no_supervisado_metadata_v2.json"
if metadata_path.exists():
    with open(metadata_path) as f:
        metadata = json.load(f)
    print(json.dumps(metadata, indent=2))

print("\n" + "="*70)

# ================================================================
# Validación opcional sobre CSV con etiquetas reales
# ================================================================
if args.csv:
    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"❌ CSV no encontrado: {csv_path}")
        sys.exit(1)

    # Importar predictor
    sys.path.insert(0, str(Path(__file__).parent / "api" / "utils"))
    from predictor import TarantulaHawkPredictor  # type: ignore

    import pandas as pd
    df = pd.read_csv(csv_path)
    if "clasificacion_real" not in df.columns:
        print("❌ Falta columna 'clasificacion_real' en el CSV")
        sys.exit(1)

    print("\n🧪 Ejecutando validación de predictor contra históricos…")
    pred = TarantulaHawkPredictor(base_dir=str(Path(__file__).parent), verbose=True)

    t0 = time.time()
    y_pred, _ = pred.predict(df, return_probas=True)
    elapsed = time.time() - t0

    n = len(df)
    throughput = (n / elapsed) if elapsed > 0 else 0.0
    print(f"⏱️ Tiempo: {elapsed:.2f}s para {n} trans | {throughput:.0f} trans/s")

    y_true = df["clasificacion_real"].astype(str).str.lower().values
    import numpy as np
    y_pred = np.array([str(x).lower() for x in y_pred])

    accuracy = (y_pred == y_true).mean()
    print(f"🎯 Accuracy vs históricos: {accuracy:.2%}")

    mask_fn_p = (y_true == "preocupante") & (y_pred != "preocupante")
    mask_fp_p = (y_true != "preocupante") & (y_pred == "preocupante")
    fn_p = int(np.sum(mask_fn_p))
    fp_p = int(np.sum(mask_fp_p))
    print(f"   FN (preocupante): {fn_p}")
    print(f"   FP (preocupante): {fp_p}")

    if accuracy < args.min_accuracy:
        print(f"❌ Accuracy por debajo de {args.min_accuracy:.0%}")
        sys.exit(2)
    print("✅ Validación completada OK")
