#!/usr/bin/env python3
# ===================================================================
# ARCHIVO 1: modelo_supervisado_lfpiorpi.py
# ===================================================================
"""
Supervised Ensemble Model - LFPIORPI Compliant
Target: 95%+ accuracy, minimize false negatives
"""

import os
import json
import logging
import joblib
import warnings
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
from sklearn.ensemble import StackingClassifier, RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from imblearn.over_sampling import BorderlineSMOTE
from imblearn.under_sampling import TomekLinks
from xgboost import XGBClassifier
import lightgbm as lgb

os.environ["LOKY_MAX_CPU_COUNT"] = "4"  # Or your CPU count

warnings.filterwarnings("ignore")

LOG_DIR = os.path.join("backend", "outputs", "logs")
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    filename=os.path.join(LOG_DIR, "modelo_supervisado_lfpiorpi.log"),
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config_modelos.json")

def cargar_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    logging.info("="*70)
    logging.info("SUPERVISED MODEL TRAINING - LFPIORPI")
    logging.info("="*70)
    
    cfg = cargar_config()
    dataset_path = cfg["dataset"]["path"]
    
    print(f"\n{'='*70}")
    print("🇲🇽 MODELO SUPERVISADO - LFPIORPI 2025")
    print(f"{'='*70}")
    print(f"Dataset: {dataset_path}\n")
    
    if not os.path.exists(dataset_path):
        print(f"❌ ERROR: Dataset no encontrado: {dataset_path}")
        return
    
    df = pd.read_csv(dataset_path)
    logging.info(f"Dataset cargado: {len(df)} registros")
    
    print("📊 Distribución de clases:")
    for clase, count in df["clasificacion_lfpiorpi"].value_counts().items():
        print(f"   {clase}: {count:,} ({count/len(df)*100:.1f}%)")
    
    # Prepare features - SIMPLIFIED DATASET
    X = df.drop(columns=["clasificacion_lfpiorpi"])
    y = df["clasificacion_lfpiorpi"]
    
    # Only 2 categorical columns now
    categorical_cols = ["tipo_operacion", "sector_actividad"]
    X_encoded = pd.get_dummies(X, columns=categorical_cols, drop_first=True, dtype=float)
    
    print(f"\n🔧 Features: {len(X_encoded.columns)} columnas")
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X_encoded, y, 
        test_size=0.20, 
        random_state=42, 
        stratify=y
    )
    
    # Balance classes
    print(f"\n⚖️  Balanceando clases...")
    print(f"   Antes: {Counter(y_train)}")
    
    sampling_strategy = {
        'preocupante': int(len(y_train) * 0.85),
        'inusual': int(len(y_train) * 0.80)
    }
    
    smote = BorderlineSMOTE(
        sampling_strategy=sampling_strategy,
        random_state=42,
        k_neighbors=3,
        m_neighbors=7
    )
    
    X_train_balanced, y_train_balanced = smote.fit_resample(X_train, y_train)
    
    tomek = TomekLinks(sampling_strategy='auto', n_jobs=-1)
    X_train_clean, y_train_clean = tomek.fit_resample(X_train_balanced, y_train_balanced)
    
    print(f"   Después: {Counter(y_train_clean)}")
    
    # Scale
    print(f"\n📊 Escalando features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_clean)
    X_test_scaled = scaler.transform(X_test)
    
    # Class mapping
    class_mapping = {cls: i for i, cls in enumerate(sorted(y_train_clean.unique()))}
    y_train_enc = y_train_clean.map(class_mapping)
    y_test_enc = y_test.map(class_mapping)
    
    # Build ensemble
    print(f"\n🚀 Entrenando ensemble...\n")
    
    base_models = [
        ('xgb', XGBClassifier(
            learning_rate=0.01,
            n_estimators=400,
            max_depth=8,
            min_child_weight=1,
            subsample=0.8,
            colsample_bytree=0.7,
            random_state=42,
            n_jobs=-1,
            tree_method='hist'
        )),
        ('lgb', lgb.LGBMClassifier(
            learning_rate=0.01,
            n_estimators=500,
            num_leaves=31,
            max_depth=10,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1,
            verbosity=-1
        )),
        ('rf', RandomForestClassifier(
            n_estimators=300,
            max_depth=15,
            class_weight='balanced_subsample',
            random_state=42,
            n_jobs=-1
        ))
    ]
    
    meta_model = LogisticRegression(
        max_iter=1000,
        class_weight='balanced',
        C=0.3,
        random_state=42,
        n_jobs=-1
    )
    
    ensemble = StackingClassifier(
        estimators=base_models,
        final_estimator=meta_model,
        cv=3,
        stack_method='predict_proba',
        n_jobs=-1,
        verbose=1
    )
    
    ensemble.fit(X_train_scaled, y_train_enc)
    
    print(f"\n✅ Entrenamiento completado")
    
    # Predictions with aggressive thresholds
    y_proba = ensemble.predict_proba(X_test_scaled)
    
    threshold_preocupante = 0.20
    threshold_inusual = 0.25
    
    y_pred = []
    for probs in y_proba:
        if probs[class_mapping["preocupante"]] > threshold_preocupante:
            y_pred.append("preocupante")
        elif probs[class_mapping["inusual"]] > threshold_inusual:
            y_pred.append("inusual")
        else:
            y_pred.append("relevante")
    
    y_pred = np.array(y_pred)
    
    # Apply LFPIORPI rules
    print(f"\n🏛️  Aplicando reglas LFPIORPI...")
    X_test_original = df.iloc[X_test.index]
    
    for i, (idx, row) in enumerate(X_test_original.iterrows()):
        monto = row.get("monto", 0)
        es_efectivo = row.get("EsEfectivo", 0)
        es_estructurada = row.get("EsEstructurada", 0)
        
        if monto >= 170_000:
            y_pred[i] = "preocupante"
        elif es_efectivo and monto >= 165_000:
            y_pred[i] = "preocupante"
        elif es_estructurada and es_efectivo:
            y_pred[i] = "preocupante"
    
    # Metrics
    acc = accuracy_score(y_test, y_pred)
    f1_weighted = f1_score(y_test, y_pred, average="weighted")
    report = classification_report(y_test, y_pred, output_dict=True)
    cm = confusion_matrix(y_test, y_pred, labels=["relevante", "inusual", "preocupante"])
    
    fn_preocupante = np.sum((y_test == "preocupante") & (y_pred != "preocupante"))
    fn_inusual = np.sum((y_test == "inusual") & (y_pred != "inusual"))
    
    print(f"\n{'='*70}")
    print("🎯 RESULTADOS")
    print(f"{'='*70}")
    print(f"✅ Accuracy: {acc:.4f} ({acc*100:.2f}%)")
    print(f"📊 F1 Weighted: {f1_weighted:.4f}")
    
    for clase in ["preocupante", "inusual", "relevante"]:
        if clase in report:
            m = report[clase]
            print(f"\n{clase.upper()}:")
            print(f"   Precision: {m['precision']:.3f}")
            print(f"   Recall: {m['recall']:.3f}")
            print(f"   F1: {m['f1-score']:.3f}")
    
    print(f"\n⚠️  FALSOS NEGATIVOS:")
    print(f"   Preocupante: {fn_preocupante}/{np.sum(y_test == 'preocupante')}")
    print(f"   Inusual: {fn_inusual}/{np.sum(y_test == 'inusual')}")
    
    if acc >= 0.95:
        print(f"\n🎉 META 95% ALCANZADA!")
    
    print(f"{'='*70}\n")
    
    # Save
    os.makedirs("backend/outputs", exist_ok=True)
    
    model_data = {
        'ensemble': ensemble,
        'scaler': scaler,
        'class_mapping': class_mapping,
        'feature_names': X_encoded.columns.tolist(),
        'thresholds': {
            'preocupante': threshold_preocupante,
            'inusual': threshold_inusual
        }
    }
    
    joblib.dump(model_data, "backend/outputs/modelo_ensemble_stack.pkl")
    
    metrics = {
        'accuracy': float(acc),
        'f1_weighted': float(f1_weighted),
        'report': report,
        'confusion_matrix': cm.tolist(),
        'fn_preocupante': int(fn_preocupante),
        'fn_inusual': int(fn_inusual)
    }
    
    with open("backend/outputs/metricas_ensemble_stack.json", "w") as f:
        json.dump(metrics, f, indent=4)
    
    print("✅ Modelo guardado: backend/outputs/modelo_ensemble_stack.pkl\n")

if __name__ == "__main__":
    main()
