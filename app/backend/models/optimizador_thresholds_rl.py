#!/usr/bin/env python3
"""
RL Threshold Optimizer
Finds optimal confidence thresholds to minimize false negatives
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.metrics import classification_report, confusion_matrix

# Cost matrix (regulatory penalties)
COSTS = {
    'fn_preocupante': -1000,  # Miss reportable → huge fine
    'fn_inusual': -500,       # Miss suspicious → moderate risk
    'fp_preocupante': -10,    # False alarm → manual review cost
    'fp_inusual': -5,         # False alarm → minor cost
    'correct': 15             # Correct classification → reward
}

def load_models():
    """Load trained models"""
    supervised = joblib.load("backend/outputs/modelo_ensemble_stack.pkl")
    return supervised

def calculate_cost(y_true, y_pred):
    """Calculate total cost based on confusion matrix"""
    cm = confusion_matrix(y_true, y_pred, labels=['relevante', 'inusual', 'preocupante'])
    
    # Extract confusion matrix values
    # cm[i][j] = true class i, predicted class j
    
    # False negatives (critical!)
    fn_preocupante = cm[2, 0] + cm[2, 1]  # Preocupante → relevante or inusual
    fn_inusual = cm[1, 0]                  # Inusual → relevante
    
    # False positives (less critical)
    fp_preocupante = cm[0, 2] + cm[1, 2]  # Relevante/inusual → preocupante
    fp_inusual = cm[0, 1]                  # Relevante → inusual
    
    # True positives
    correct = cm[0, 0] + cm[1, 1] + cm[2, 2]
    
    total_cost = (
        fn_preocupante * COSTS['fn_preocupante'] +
        fn_inusual * COSTS['fn_inusual'] +
        fp_preocupante * COSTS['fp_preocupante'] +
        fp_inusual * COSTS['fp_inusual'] +
        correct * COSTS['correct']
    )
    
    return total_cost, {
        'fn_preocupante': fn_preocupante,
        'fn_inusual': fn_inusual,
        'fp_preocupante': fp_preocupante,
        'fp_inusual': fp_inusual,
        'correct': correct
    }

def test_thresholds(y_proba, y_true, class_mapping, threshold_preoc, threshold_inusual):
    """Test specific threshold combination"""
    predictions = []
    
    for probs in y_proba:
        if probs[class_mapping["preocupante"]] > threshold_preoc:
            predictions.append("preocupante")
        elif probs[class_mapping["inusual"]] > threshold_inusual:
            predictions.append("inusual")
        else:
            predictions.append("relevante")
    
    return np.array(predictions)

def optimize_thresholds(dataset_path, output_path="backend/outputs/rl_thresholds_optimized.json"):
    """
    Main optimization function
    Tests grid of threshold combinations to find optimal balance
    """
    
    print(f"\n{'='*70}")
    print("🎯 OPTIMIZACIÓN DE THRESHOLDS CON RL")
    print(f"{'='*70}\n")
    
    # Load data
    df = pd.read_csv(dataset_path)
    
    # Prepare features (same as training)
    X = df.drop(columns=["clasificacion_lfpiorpi"])
    y = df["clasificacion_lfpiorpi"]
    
    categorical_cols = ["tipo_operacion", "sector_actividad"]
    X_encoded = pd.get_dummies(X, columns=categorical_cols, drop_first=True, dtype=float)
    
    # Load trained model
    print("📂 Cargando modelo supervisado...")
    model_data = load_models()
    ensemble = model_data['ensemble']
    scaler = model_data['scaler']
    class_mapping = model_data['class_mapping']
    current_thresholds = model_data['thresholds']
    
    print(f"   Thresholds actuales:")
    print(f"      Preocupante: {current_thresholds['preocupante']}")
    print(f"      Inusual: {current_thresholds['inusual']}\n")
    
    # Scale features
    X_scaled = scaler.transform(X_encoded)
    
    # Get probabilities
    print("🔮 Generando probabilidades...")
    y_proba = ensemble.predict_proba(X_scaled)
    print(f"   Predicciones para {len(y_proba):,} transacciones\n")
    
    # Grid search for optimal thresholds
    print("🔍 Búsqueda de thresholds óptimos...")
    print("   (Testing 400+ combinations...)\n")
    
    threshold_preoc_range = np.arange(0.05, 0.30, 0.01)
    threshold_inusual_range = np.arange(0.05, 0.35, 0.01)
    
    best_cost = float('-inf')
    best_thresholds = None
    best_metrics = None
    best_predictions = None
    
    results = []
    
    for t_preoc in threshold_preoc_range:
        for t_inusual in threshold_inusual_range:
            # Test this combination
            predictions = test_thresholds(y_proba, y, class_mapping, t_preoc, t_inusual)
            
            # Calculate cost
            cost, metrics = calculate_cost(y, predictions)
            
            results.append({
                'threshold_preocupante': float(t_preoc),
                'threshold_inusual': float(t_inusual),
                'cost': float(cost),
                'fn_preocupante': int(metrics['fn_preocupante']),
                'fn_inusual': int(metrics['fn_inusual']),
                'fp_preocupante': int(metrics['fp_preocupante']),
                'fp_inusual': int(metrics['fp_inusual'])
            })
            
            # Track best
            if cost > best_cost:
                best_cost = cost
                best_thresholds = {
                    'preocupante': t_preoc,
                    'inusual': t_inusual
                }
                best_metrics = metrics
                best_predictions = predictions
    
    # Calculate metrics for best thresholds
    report = classification_report(y, best_predictions, output_dict=True)
    
    print(f"{'='*70}")
    print("✅ OPTIMIZACIÓN COMPLETADA")
    print(f"{'='*70}\n")
    
    print("📊 THRESHOLDS ÓPTIMOS ENCONTRADOS:")
    print(f"   Preocupante: {best_thresholds['preocupante']:.3f}")
    print(f"   Inusual:     {best_thresholds['inusual']:.3f}\n")
    
    print("📈 COMPARACIÓN:")
    print(f"{'':25} | Actual      | Óptimo")
    print(f"{'-'*70}")
    print(f"   Threshold Preocupante | {current_thresholds['preocupante']:.3f}      | {best_thresholds['preocupante']:.3f}")
    print(f"   Threshold Inusual     | {current_thresholds['inusual']:.3f}      | {best_thresholds['inusual']:.3f}\n")
    
    print("⚠️  MÉTRICAS CON THRESHOLDS ÓPTIMOS:")
    print(f"   FN Preocupante: {best_metrics['fn_preocupante']}")
    print(f"   FN Inusual:     {best_metrics['fn_inusual']}")
    print(f"   FP Preocupante: {best_metrics['fp_preocupante']}")
    print(f"   FP Inusual:     {best_metrics['fp_inusual']}\n")
    
    for clase in ["preocupante", "inusual", "relevante"]:
        if clase in report:
            m = report[clase]
            print(f"   {clase.upper()}:")
            print(f"      Recall: {m['recall']:.3f}")
            print(f"      Precision: {m['precision']:.3f}")
    
    print(f"\n💰 Costo total óptimo: {best_cost:,.0f}")
    print(f"{'='*70}\n")
    
    # Recommendation
    if best_thresholds['preocupante'] < current_thresholds['preocupante']:
        print("💡 RECOMENDACIÓN: Reducir thresholds")
        print("   ✅ Mejora detección de FN (más sensible)")
        print("   ⚠️  Puede aumentar FP (más alertas)")
    else:
        print("💡 RECOMENDACIÓN: Mantener thresholds actuales")
        print("   ✅ Ya están bien calibrados")
    
    # Save results
    output_data = {
        "timestamp": datetime.now().isoformat(),
        "dataset_size": len(y),
        "thresholds_actuales": current_thresholds,
        "thresholds_optimizados": {
            "preocupante": float(best_thresholds['preocupante']),
            "inusual": float(best_thresholds['inusual'])
        },
        "metricas_optimizadas": {
            "fn_preocupante": int(best_metrics['fn_preocupante']),
            "fn_inusual": int(best_metrics['fn_inusual']),
            "fp_preocupante": int(best_metrics['fp_preocupante']),
            "fp_inusual": int(best_metrics['fp_inusual']),
            "costo_total": float(best_cost)
        },
        "reporte_clasificacion": report,
        "recomendacion": "reducir_thresholds" if best_thresholds['preocupante'] < current_thresholds['preocupante'] else "mantener_thresholds",
        "top_10_combinaciones": sorted(results, key=lambda x: x['cost'], reverse=True)[:10]
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=4, ensure_ascii=False)
    
    print(f"\n💾 Resultados guardados: {output_path}\n")
    
    return output_data

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("\n❌ ERROR: Falta argumento")
        print("Uso: python optimizador_thresholds_rl.py <dataset_ml_ready.csv>")
        print("\nEjemplo:")
        print("  python optimizador_thresholds_rl.py backend/datasets/dataset_pld_lfpiorpi_100k_ml_ready.csv\n")
        sys.exit(1)
    
    dataset_path = sys.argv[1]
    
    if not os.path.exists(dataset_path):
        print(f"\n❌ ERROR: Archivo no encontrado: {dataset_path}\n")
        sys.exit(1)
    
    # Optimize
    optimize_thresholds(dataset_path)
