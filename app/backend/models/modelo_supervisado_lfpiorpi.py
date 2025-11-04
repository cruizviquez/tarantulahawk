# -*- coding: utf-8 -*-
"""
modelo_supervisado_lfpiorpi_v2.py - VERSIÓN MEJORADA
Mejoras implementadas:
✅ Validación temporal (en lugar de random split)
✅ Calibración de probabilidades (Platt scaling)
✅ Explicabilidad con SHAP
✅ Métricas de drift detection
✅ Separación de accuracy con/sin guardrails
✅ Análisis de performance por estrato de monto
"""
import os, json, warnings
import numpy as np
import pandas as pd
from collections import Counter
from datetime import datetime, timedelta

os.environ["LOKY_MAX_CPU_COUNT"] = "4"
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score, f1_score, confusion_matrix
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, StackingClassifier
from sklearn.calibration import CalibratedClassifierCV
from imblearn.combine import SMOTETomek
from imblearn.over_sampling import BorderlineSMOTE

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
import joblib

# SHAP para explicabilidad
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    print("⚠️ SHAP no disponible - instalar con: pip install shap")

# ---------------- utilidades ----------------
def log(msg): 
    print(f"[{pd.Timestamp.now().strftime('%H:%M:%S')}] {msg}")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "models", "config_modelos.json")
MODEL_PATH = os.path.join(BASE_DIR, "outputs", "modelo_ensemble_stack_v2.pkl")
METRICAS_PATH = os.path.join(BASE_DIR, "outputs", "metricas_ensemble_stack_v2.json")
SHAP_PATH = os.path.join(BASE_DIR, "outputs", "shap_explainer_v2.pkl")

def load_config(path=CONFIG_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def resolve_path(p):
    if not p: return p
    return p if os.path.isabs(p) else os.path.join(BASE_DIR, p.replace("/", os.sep))

def temporal_split(df, X, y, months_test=3, months_val=3):
    """
    Split temporal para evitar data leakage temporal
    - Últimos 3 meses = test
    - 3 meses previos = validation
    - Resto = train
    """
    if "fecha" not in df.columns and "fecha_dt" not in df.columns:
        log("⚠️ No hay columna fecha - usando split aleatorio como fallback")
        from sklearn.model_selection import train_test_split
        return train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    fecha_col = "fecha_dt" if "fecha_dt" in df.columns else "fecha"
    df_temp = df.copy()
    
    if df_temp[fecha_col].dtype == 'object':
        df_temp[fecha_col] = pd.to_datetime(df_temp[fecha_col])
    
    max_date = df_temp[fecha_col].max()
    test_cutoff = max_date - timedelta(days=30*months_test)
    val_cutoff = test_cutoff - timedelta(days=30*months_val)
    
    mask_test = df_temp[fecha_col] >= test_cutoff
    mask_val = (df_temp[fecha_col] >= val_cutoff) & (df_temp[fecha_col] < test_cutoff)
    mask_train = df_temp[fecha_col] < val_cutoff
    
    log(f"📅 Split temporal:")
    log(f"   Train: {mask_train.sum():,} ({mask_train.sum()/len(df)*100:.1f}%) - hasta {val_cutoff.date()}")
    log(f"   Val:   {mask_val.sum():,} ({mask_val.sum()/len(df)*100:.1f}%) - {val_cutoff.date()} a {test_cutoff.date()}")
    log(f"   Test:  {mask_test.sum():,} ({mask_test.sum()/len(df)*100:.1f}%) - desde {test_cutoff.date()}")
    
    return (X[mask_train], X[mask_test], y[mask_train], y[mask_test],
            X[mask_val], y[mask_val])

def sanitize_train_test(*datasets):
    """Sanitiza múltiples datasets"""
    for X in datasets:
        X.replace([np.inf, -np.inf], np.nan, inplace=True)
        X.fillna(0, inplace=True)
    
    log(f"   ✓ Datasets sanitizados: {len(datasets)} conjuntos")

def apply_guardrails(df_test, y_pred, cfg):
    """Aplica guardrails normativos con tracking detallado"""
    UMA_MXN = float(cfg["normativa"]["uma_mxn"])
    fr_to_umbral = cfg["normativa"]["fracciones_umbral_aviso_mxn"]
    fr_to_cash   = cfg["normativa"]["fracciones_limite_efectivo_mxn"]

    fr = df_test.get("fraccion", pd.Series(["_"] * len(df_test)))
    aviso = fr.map(lambda x: UMA_MXN * float(fr_to_umbral.get(str(x), 1e12)))
    limite = fr.map(lambda x: UMA_MXN * float(fr_to_cash.get(str(x), 1e12)))

    es_efectivo = df_test.get("EsEfectivo", pd.Series([0]*len(df_test))).astype(int)
    monto = df_test.get("monto", pd.Series([0.0]*len(df_test))).astype(float)
    acum6m = df_test.get("monto_6m", pd.Series([0.0]*len(df_test))).astype(float)

    must_pre = (
        (acum6m >= aviso) |
        ((es_efectivo == 1) & (monto >= limite))
    )
    
    y_pred_original = y_pred.copy()
    y_pred_final = np.where(must_pre, "preocupante", y_pred)
    guardrails_aplicados = int(must_pre.sum())
    cambios_realizados = int((y_pred_original != y_pred_final).sum())
    
    return y_pred_final, {
        "total_aplicados": guardrails_aplicados,
        "cambios_realizados": cambios_realizados,
        "por_acumulacion": int((acum6m >= aviso).sum()),
        "por_efectivo": int(((es_efectivo == 1) & (monto >= limite)).sum())
    }

def analizar_por_estrato(df_test, y_test, y_pred, y_pred_sin_guardrails):
    """Analiza performance por estratos de monto"""
    df_analysis = df_test.copy()
    df_analysis['y_true'] = y_test
    df_analysis['y_pred'] = y_pred
    df_analysis['y_pred_raw'] = y_pred_sin_guardrails
    
    # Estratos de monto
    df_analysis['estrato'] = pd.cut(
        df_analysis['monto'], 
        bins=[0, 10000, 50000, 100000, 170000, np.inf],
        labels=['<10k', '10k-50k', '50k-100k', '100k-170k', '>170k']
    )
    
    log("\n" + "="*70)
    log("📊 ANÁLISIS POR ESTRATO DE MONTO")
    log("="*70)
    
    for estrato in ['<10k', '10k-50k', '50k-100k', '100k-170k', '>170k']:
        mask = df_analysis['estrato'] == estrato
        if mask.sum() == 0:
            continue
        
        acc = accuracy_score(df_analysis[mask]['y_true'], df_analysis[mask]['y_pred'])
        acc_raw = accuracy_score(df_analysis[mask]['y_true'], df_analysis[mask]['y_pred_raw'])
        
        log(f"\n{estrato}:")
        log(f"  N={mask.sum():,} | Acc={acc:.3f} | Acc sin guardrails={acc_raw:.3f}")
        log(f"  Distribución real: {Counter(df_analysis[mask]['y_true'])}")

def calcular_drift_metrics(y_train, y_val, y_test):
    """Calcula métricas de drift entre conjuntos"""
    from scipy.stats import chisquare
    
    dist_train = pd.Series(y_train).value_counts(normalize=True).sort_index()
    dist_val = pd.Series(y_val).value_counts(normalize=True).sort_index()
    dist_test = pd.Series(y_test).value_counts(normalize=True).sort_index()
    
    # Alinear índices
    all_classes = sorted(set(dist_train.index) | set(dist_val.index) | set(dist_test.index))
    dist_train = dist_train.reindex(all_classes, fill_value=0)
    dist_val = dist_val.reindex(all_classes, fill_value=0)
    dist_test = dist_test.reindex(all_classes, fill_value=0)
    
    # Chi-square test
    chi2_val, p_val = chisquare(dist_val * 100 + 1e-10, dist_train * 100 + 1e-10)
    chi2_test, p_test = chisquare(dist_test * 100 + 1e-10, dist_train * 100 + 1e-10)
    
    log("\n" + "="*70)
    log("🔍 DRIFT DETECTION - Distribución de Clases")
    log("="*70)
    log(f"Train:  {dict(dist_train)}")
    log(f"Val:    {dict(dist_val)} | χ²={chi2_val:.2f}, p={p_val:.4f}")
    log(f"Test:   {dict(dist_test)} | χ²={chi2_test:.2f}, p={p_test:.4f}")
    
    if p_test < 0.05:
        log("⚠️ ALERTA: Drift significativo detectado en test set (p<0.05)")
    
    return {
        "drift_val_chi2": float(chi2_val),
        "drift_val_pvalue": float(p_val),
        "drift_test_chi2": float(chi2_test),
        "drift_test_pvalue": float(p_test)
    }

def generar_shap_explainer(clf, X_train_scaled, X_test_scaled, feature_names):
    """Genera explicador SHAP y guarda top features"""
    if not SHAP_AVAILABLE:
        log("⚠️ SHAP no disponible - saltando explicabilidad")
        return None
    
    try:
        log("\n🔬 Generando explicador SHAP (puede tardar 2-3 min)...")
        
        # Usar muestra para SHAP (100 instancias)
        X_sample = shap.sample(X_train_scaled, 100)
        
        # Crear explainer (TreeExplainer es más rápido para ensemble)
        explainer = shap.Explainer(clf.predict, X_sample, feature_names=feature_names)
        
        # Calcular SHAP values en test sample
        X_test_sample = shap.sample(X_test_scaled, 50)
        shap_values = explainer(X_test_sample)
        
        # Feature importance global
        feature_importance = pd.DataFrame({
            'feature': feature_names,
            'importance': np.abs(shap_values.values).mean(axis=0)
        }).sort_values('importance', ascending=False)
        
        log("\n📊 Top 10 Features más importantes (SHAP):")
        for idx, row in feature_importance.head(10).iterrows():
            log(f"   {row['feature']}: {row['importance']:.4f}")
        
        # Guardar
        joblib.dump({
            'explainer': explainer,
            'feature_importance': feature_importance
        }, SHAP_PATH)
        
        log(f"✅ Explicador SHAP guardado: {os.path.abspath(SHAP_PATH)}")
        
        return feature_importance.to_dict('records')
        
    except Exception as e:
        log(f"⚠️ Error generando SHAP: {e}")
        return None

# ---------------- main ----------------
def main():
    log("🇲🇽 MODELO SUPERVISADO V2 - LFPIORPI 2025 (MEJORADO)")
    print("=" * 74)

    cfg = load_config(CONFIG_PATH)
    log(f"CONFIG_PATH -> {os.path.abspath(CONFIG_PATH)}")

    dataset_path = resolve_path(cfg["data"]["dataset_enriched_path"])
    log(f"Dataset -> {dataset_path}")
    df = pd.read_csv(dataset_path)
    log(f"Rows: {len(df):,} | Cols: {len(df.columns)}")

    # Distribución de clases
    y = df["clasificacion_lfpiorpi"]
    dist = Counter(y)
    log("\n📊 Distribución de clases:")
    for k,v in dist.items():
        log(f"  - {k}: {v:,} ({v/len(df):.1%})")

    # Preparación de features
    X = df.drop(columns=["clasificacion_lfpiorpi"]).copy()
    X.drop(columns=["cliente_id", "fecha", "fecha_dt"], errors="ignore", inplace=True)
    cat_cols = [c for c in ["tipo_operacion", "sector_actividad", "fraccion"] if c in X.columns]
    X = pd.get_dummies(X, columns=cat_cols, drop_first=True, dtype=float)
    log(f"🔧 Features: {len(X.columns)}")

    # ✅ MEJORA 1: Split temporal
    X_train, X_test, y_train, y_test, X_val, y_val = temporal_split(
        df, X, y, months_test=3, months_val=3
    )
    
    # ✅ MEJORA 2: Drift detection
    drift_metrics = calcular_drift_metrics(y_train, y_val, y_test)

    # Sanitizar
    log("\n🧼 Sanitizando INF/NaN en features…")
    sanitize_train_test(X_train, X_test, X_val)

    # Balanceo
    log("\n⚖️ Balanceando con BorderlineSMOTE + TomekLinks…")
    log(f"   Antes: {Counter(y_train)}")
    smote = BorderlineSMOTE(kind="borderline-1", sampling_strategy="not majority", random_state=42)
    Xb, yb = smote.fit_resample(X_train, y_train)
    Xb, yb = SMOTETomek(sampling_strategy="not majority", random_state=42).fit_resample(Xb, yb)
    log(f"   Después: {Counter(yb)}")

    # Escalado
    log("\n🔢 Escalando numéricas…")
    scaler = StandardScaler()
    Xb_scaled = scaler.fit_transform(Xb)
    X_test_scaled = scaler.transform(X_test)
    X_val_scaled = scaler.transform(X_val)

    # Modelos base
    xgb = XGBClassifier(
        n_estimators=250, max_depth=6, learning_rate=0.08, subsample=0.9,
        colsample_bytree=0.9, objective="multi:softprob", eval_metric="mlogloss",
        tree_method="hist", random_state=42, use_label_encoder=False, verbosity=0
    )
    lgb = LGBMClassifier(
        n_estimators=400, max_depth=-1, num_leaves=64, learning_rate=0.06,
        subsample=0.9, colsample_bytree=0.9, objective="multiclass", random_state=42, verbose=-1
    )
    rf = RandomForestClassifier(
        n_estimators=300, max_depth=None, min_samples_split=4, min_samples_leaf=2,
        n_jobs=-1, random_state=42
    )
    meta = LogisticRegression(max_iter=200, n_jobs=None)

    estimators = [("xgb", xgb), ("lgbm", lgb), ("rf", rf)]
    clf = StackingClassifier(
        estimators=estimators, final_estimator=meta, stack_method="predict_proba", 
        passthrough=False, n_jobs=-1
    )

    log("\n🚀 Entrenando ensemble (XGB + LGBM + RF -> LR)…")
    clf.fit(Xb_scaled, yb)
    log("✅ Entrenamiento completado.")
    
    # ✅ MEJORA 3: Calibración de probabilidades
    log("\n🎯 Calibrando probabilidades (isotonic regression)…")
    clf_calibrated = CalibratedClassifierCV(clf, method='isotonic', cv='prefit')
    clf_calibrated.fit(X_val_scaled, y_val)
    log("✅ Calibración completada.")

    # Inferencia en test
    proba = clf_calibrated.predict_proba(X_test_scaled)
    classes = clf_calibrated.classes_
    
    thr_p = float(cfg["modelos"]["ensemble"]["threshold_preocupante"])
    thr_i = float(cfg["modelos"]["ensemble"]["threshold_inusual"])
    idx_pre = np.argmax(classes == "preocupante")
    idx_inu = np.argmax(classes == "inusual")
    
    y_pred_sin_guardrails = np.where(proba[:, idx_pre] >= thr_p, "preocupante",
                            np.where(proba[:, idx_inu] >= thr_i, "inusual", "relevante"))

    # ✅ MEJORA 4: Separar métricas con/sin guardrails
    acc_sin = accuracy_score(y_test, y_pred_sin_guardrails)
    f1_sin = f1_score(y_test, y_pred_sin_guardrails, average="weighted")

    log("\n🛡️ Aplicando guardrails LFPIORPI…")
    y_pred, guardrails_info = apply_guardrails(df.loc[y_test.index], y_pred_sin_guardrails, cfg)
    
    log(f"   Guardrails aplicados: {guardrails_info['total_aplicados']}")
    log(f"   Cambios realizados: {guardrails_info['cambios_realizados']}")
    log(f"   Por acumulación 6m: {guardrails_info['por_acumulacion']}")
    log(f"   Por efectivo: {guardrails_info['por_efectivo']}")

    # Métricas finales
    acc_con = accuracy_score(y_test, y_pred)
    f1_con = f1_score(y_test, y_pred, average="weighted")
    
    log("\n" + "="*74)
    log("🎯 RESULTADOS COMPARATIVOS")
    log("="*74)
    log(f"SIN Guardrails: Accuracy={acc_sin:.4f} ({acc_sin*100:.2f}%) | F1w={f1_sin:.4f}")
    log(f"CON Guardrails: Accuracy={acc_con:.4f} ({acc_con*100:.2f}%) | F1w={f1_con:.4f}")
    log(f"Mejora: +{(acc_con-acc_sin)*100:.2f}% accuracy")
    
    print("\nClassification Report (CON guardrails):")
    print(classification_report(y_test, y_pred, digits=3))
    
    # ✅ MEJORA 5: Análisis por estrato
    analizar_por_estrato(df.loc[y_test.index], y_test, y_pred, y_pred_sin_guardrails)
    
    # ✅ MEJORA 6: SHAP explainability
    shap_features = generar_shap_explainer(clf_calibrated, Xb_scaled, X_test_scaled, X.columns.tolist())

    # Confusion matrix detallada
    cm = confusion_matrix(y_test, y_pred, labels=["relevante", "inusual", "preocupante"])
    log("\n📊 Matriz de Confusión:")
    log(f"                 Pred: relevante  inusual  preocupante")
    log(f"Real: relevante      {cm[0,0]:6d}     {cm[0,1]:6d}     {cm[0,2]:6d}")
    log(f"      inusual        {cm[1,0]:6d}     {cm[1,1]:6d}     {cm[1,2]:6d}")
    log(f"      preocupante    {cm[2,0]:6d}     {cm[2,1]:6d}     {cm[2,2]:6d}")

    # Bundle & métricas
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    bundle = {
        "model": clf_calibrated,
        "scaler": scaler,
        "columns": X.columns.tolist(),
        "classes": classes.tolist(),
        "version": "2.0",
        "trained_date": datetime.now().isoformat()
    }
    joblib.dump(bundle, MODEL_PATH)
    
    metricas = {
        "accuracy_sin_guardrails": float(acc_sin),
        "accuracy_con_guardrails": float(acc_con),
        "f1_weighted_sin": float(f1_sin),
        "f1_weighted_con": float(f1_con),
        "mejora_accuracy": float(acc_con - acc_sin),
        "guardrails_info": guardrails_info,
        "drift_metrics": drift_metrics,
        "confusion_matrix": cm.tolist(),
        "shap_top_features": shap_features[:10] if shap_features else None,
        "version": "2.0",
        "trained_date": datetime.now().isoformat()
    }
    
    with open(METRICAS_PATH, "w", encoding="utf-8") as f:
        json.dump(metricas, f, indent=2)
    
    log(f"\n✅ Modelo V2 guardado: {os.path.abspath(MODEL_PATH)}")
    log(f"✅ Métricas guardadas: {os.path.abspath(METRICAS_PATH)}")
    log("\nListo. 🎉")

if __name__ == "__main__":
    main()
