#!/usr/bin/env python3
"""
Debug script para inspeccionar modelos ML y ver qué features esperan
"""
import joblib
from pathlib import Path
import json

models_dir = Path(__file__).parent / "outputs"

print("="*70)
print("🔍 DIAGNÓSTICO DE MODELOS ML")
print("="*70)

# 1. Modelo Supervisado V2
print("\n📘 Modelo Supervisado (Ensemble Stacking V2)")
print("-"*70)
supervised_path = models_dir / "modelo_ensemble_stack_v2.pkl"
if supervised_path.exists():
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
    print(f"❌ No encontrado: {supervised_path}")

# 2. Modelo No Supervisado V2
print("\n📗 Modelo No Supervisado (Bundle V2)")
print("-"*70)
unsupervised_path = models_dir / "no_supervisado_bundle_v2.pkl"
if unsupervised_path.exists():
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
                iso = model_data['isolation_forest']
                print(f"   IsolationForest type: {type(iso)}")
                if hasattr(iso, 'n_features_in_'):
                    print(f"   IsolationForest expects {iso.n_features_in_} features")
    except Exception as e:
        print(f"❌ Error cargando: {e}")
else:
    print(f"❌ No encontrado: {unsupervised_path}")

# 3. Modelo Refuerzo V2
print("\n📙 Modelo Refuerzo (Bundle V2)")
print("-"*70)
rl_path = models_dir / "refuerzo_bundle_v2.pkl"
if rl_path.exists():
    try:
        model_data = joblib.load(rl_path)
        print(f"✅ Cargado exitosamente")
        print(f"   Tipo: {type(model_data)}")
        if isinstance(model_data, dict):
            print(f"   Keys: {list(model_data.keys())}")
            print(f"   Q-table entries: {len(model_data) if not any(k in model_data for k in ['q_table', 'thresholds']) else 'N/A'}")
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
