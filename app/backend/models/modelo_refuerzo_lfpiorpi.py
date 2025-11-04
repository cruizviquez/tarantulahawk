# -*- coding: utf-8 -*-
"""
modelo_refuerzo_lfpiorpi_v2.py - VERSIÓN MEJORADA
Mejoras sobre V1 (manteniendo arquitectura Q-Learning):
✅ Reward function con costos LFPIORPI (FN preocupante pesa más)
✅ Integración de guardrails en evaluación
✅ Análisis de sensibilidad alrededor del óptimo
✅ Validación en conjunto separado (evita overfitting)
✅ Logging detallado de exploración
"""
import os, json, warnings
import numpy as np
import pandas as pd
import joblib
from datetime import datetime

os.environ["LOKY_MAX_CPU_COUNT"] = "4"
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

def log(msg): 
    print(f"[{pd.Timestamp.now().strftime('%H:%M:%S')}] {msg}")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "models", "config_modelos.json")
OUT_DIR = os.path.join(BASE_DIR, "outputs")
BUNDLE_SUP = os.path.join(OUT_DIR, "modelo_ensemble_stack.pkl")

# ✅ MEJORA 1: Costos diferenciados por tipo de error
COSTS = {
    "FN_preocupante": 5000.0,   # Crítico - multa regulatoria
    "FP_preocupante": 50.0,     # Operativo - tiempo analista  
    "FN_inusual": 500.0,        # Oportunidad perdida
    "FP_inusual": 10.0,         # Investigación innecesaria
    "penalty_norma": 10000.0    # Violación LFPIORPI directa
}

def load_config(path=CONFIG_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def resolve_path(p):
    if not p: return p
    return p if os.path.isabs(p) else os.path.join(BASE_DIR, p.replace("/", os.sep))

def apply_guardrails(df, y_pred, cfg):
    """
    ✅ MEJORA 2: Aplicar guardrails LFPIORPI durante evaluación
    Calcula umbrales al vuelo (sin leakage)
    """
    law = cfg.get("lfpiorpi", {})
    UMA = float(law.get("uma_diaria", 113.14))
    umbrales = law.get("umbrales", {})
    
    fr = df.get("fraccion", pd.Series(["_"] * len(df))).astype(str)
    
    def to_mxn(frac, key):
        u = umbrales.get(frac, {})
        uma_val = u.get(key, None)
        if uma_val is None:
            return 1e12
        try:
            return float(UMA) * float(uma_val)
        except Exception:
            return 1e12
    
    aviso_arr = fr.map(lambda x: to_mxn(x, "aviso_UMA")).to_numpy()
    ef_lim_arr = fr.map(lambda x: to_mxn(x, "efectivo_max_UMA")).to_numpy()
    
    monto = df.get("monto", pd.Series([0.0]*len(df))).astype(float).to_numpy()
    es_ef = df.get("EsEfectivo", pd.Series([0]*len(df))).astype(int).to_numpy()
    m6 = df.get("monto_6m", pd.Series([0.0]*len(df))).astype(float).to_numpy()
    
    must_pre = (
        (monto >= aviso_arr) |
        ((es_ef == 1) & (monto >= ef_lim_arr)) |
        ((monto < aviso_arr) & (m6 >= aviso_arr))
    )
    
    y_pred_corrected = np.where(must_pre, "preocupante", y_pred)
    n_corrections = int((y_pred != y_pred_corrected).sum())
    
    return y_pred_corrected, n_corrections

def calculate_reward(y_true, y_pred, df, cfg, costs=COSTS):
    """
    ✅ MEJORA 3: Reward function con penalizaciones LFPIORPI
    Minimiza costo total considerando gravedad de errores
    """
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    # Costos por tipo de error
    cost = 0.0
    cost += costs["FN_preocupante"] * np.sum((y_true == "preocupante") & (y_pred != "preocupante"))
    cost += costs["FP_preocupante"] * np.sum((y_true != "preocupante") & (y_pred == "preocupante"))
    cost += costs["FN_inusual"] * np.sum((y_true == "inusual") & (y_pred == "relevante"))
    cost += costs["FP_inusual"] * np.sum((y_true == "relevante") & (y_pred == "inusual"))
    
    # Penalización normativa (casos que deberían ser preocupante por guardrails)
    must_pre = apply_guardrails(df, y_pred, cfg)[0]
    violations = np.sum((y_pred != "preocupante") & (must_pre == "preocupante"))
    cost += costs["penalty_norma"] * violations
    
    # Reward = -cost (mayor reward = menor costo)
    return -float(cost), {
        "fn_preocupante": int(np.sum((y_true == "preocupante") & (y_pred != "preocupante"))),
        "fp_preocupante": int(np.sum((y_true != "preocupante") & (y_pred == "preocupante"))),
        "fn_inusual": int(np.sum((y_true == "inusual") & (y_pred == "relevante"))),
        "fp_inusual": int(np.sum((y_true == "relevante") & (y_pred == "inusual"))),
        "violations": int(violations),
        "total_cost": float(cost)
    }

def temporal_split(df, val_months=2):
    """
    ✅ MEJORA 4: Split temporal para validación
    Últimos val_months para validar thresholds
    """
    if "fecha" not in df.columns and "fecha_dt" not in df.columns:
        # Fallback: random 80/20
        from sklearn.model_selection import train_test_split
        return train_test_split(df, test_size=0.2, random_state=42)
    
    fecha_col = "fecha_dt" if "fecha_dt" in df.columns else "fecha"
    df_temp = df.copy()
    
    if df_temp[fecha_col].dtype == 'object':
        df_temp[fecha_col] = pd.to_datetime(df_temp[fecha_col])
    
    from datetime import timedelta
    max_date = df_temp[fecha_col].max()
    val_cutoff = max_date - timedelta(days=30*val_months)
    
    mask_val = df_temp[fecha_col] >= val_cutoff
    df_train = df_temp[~mask_val].reset_index(drop=True)
    df_val = df_temp[mask_val].reset_index(drop=True)
    
    log(f"   Split temporal: Train={len(df_train):,} | Val={len(df_val):,}")
    
    return df_train, df_val

def main():
    log("🤖 MODELO DE REFUERZO V2 - Q-Learning con costos LFPIORPI")
    print("=" * 74)

    cfg = load_config()
    dataset_path = resolve_path(cfg["data"]["dataset_enriched_path"])
    log(f"[RL] CONFIG_PATH -> {os.path.abspath(CONFIG_PATH)}")
    log(f"Dataset -> {dataset_path}")

    # Cargar bundle supervisado
    if not os.path.exists(BUNDLE_SUP):
        log(f"❌ No existe {BUNDLE_SUP}")
        return
    
    bundle = joblib.load(BUNDLE_SUP)
    model, scaler, cols = bundle["model"], bundle["scaler"], bundle["columns"]

    # Cargar dataset y preparar
    df = pd.read_csv(dataset_path)
    log(f"Rows: {len(df):,}")
    
    # ✅ Split temporal train/val
    df_train, df_val = temporal_split(df, val_months=2)
    
    # Preparar features para TRAIN
    X_train = df_train.drop(columns=["clasificacion_lfpiorpi", "cliente_id", "fecha", "fecha_dt"], errors="ignore")
    X_train = pd.get_dummies(X_train, columns=[c for c in ["tipo_operacion","sector_actividad","fraccion"] if c in X_train], drop_first=True, dtype=float)
    X_train = X_train.reindex(columns=cols, fill_value=0).replace([np.inf, -np.inf], np.nan).fillna(0)
    Xs_train = scaler.transform(X_train)
    y_train = df_train["clasificacion_lfpiorpi"].values
    
    # Preparar features para VAL
    X_val = df_val.drop(columns=["clasificacion_lfpiorpi", "cliente_id", "fecha", "fecha_dt"], errors="ignore")
    X_val = pd.get_dummies(X_val, columns=[c for c in ["tipo_operacion","sector_actividad","fraccion"] if c in X_val], drop_first=True, dtype=float)
    X_val = X_val.reindex(columns=cols, fill_value=0).replace([np.inf, -np.inf], np.nan).fillna(0)
    Xs_val = scaler.transform(X_val)
    y_val = df_val["clasificacion_lfpiorpi"].values

    # Probabilidades
    log("\n📊 Calculando probabilidades con ensemble...")
    proba_train = model.predict_proba(Xs_train)
    proba_val = model.predict_proba(Xs_val)
    
    classes = model.classes_
    idx_pre = np.argmax(classes == "preocupante")
    idx_inu = np.argmax(classes == "inusual")

    # ✅ Q-Learning con grid search en TRAIN
    log("\n🎮 Q-Learning: Explorando espacio de thresholds...")
    grid = np.linspace(0.1, 0.9, 17)  # 17 puntos (más fino que V1)
    q_table = np.zeros((len(grid), len(grid)))
    
    best_reward = -np.inf
    best_idx = None
    best_metrics = None
    
    total_combinations = len(grid) * len(grid)
    evaluated = 0
    
    for i, thr_p in enumerate(grid):
        for j, thr_i in enumerate(grid):
            y_pred = np.where(proba_train[:, idx_pre] >= thr_p, "preocupante",
                     np.where(proba_train[:, idx_inu] >= thr_i, "inusual", "relevante"))
            
            # Aplicar guardrails
            y_pred, _ = apply_guardrails(df_train, y_pred, cfg)
            
            # Calcular reward
            reward, metrics = calculate_reward(y_train, y_pred, df_train, cfg)
            q_table[i, j] = reward
            
            if reward > best_reward:
                best_reward = reward
                best_idx = (i, j)
                best_metrics = metrics
            
            evaluated += 1
            if evaluated % 50 == 0:
                log(f"   Progreso: {evaluated}/{total_combinations} ({evaluated/total_combinations*100:.1f}%)")
    
    thr_p_best = round(float(grid[best_idx[0]]), 3)
    thr_i_best = round(float(grid[best_idx[1]]), 3)
    
    log(f"\n✅ Exploración completada: {total_combinations} combinaciones")
    log(f"   Best en TRAIN: thr_p={thr_p_best}, thr_i={thr_i_best}, reward={best_reward:.0f}")
    
    # ✅ Validación en VAL set
    log("\n🔍 Validando thresholds óptimos en VAL set...")
    y_pred_val = np.where(proba_val[:, idx_pre] >= thr_p_best, "preocupante",
                 np.where(proba_val[:, idx_inu] >= thr_i_best, "inusual", "relevante"))
    
    y_pred_val, n_corrections = apply_guardrails(df_val, y_pred_val, cfg)
    reward_val, metrics_val = calculate_reward(y_val, y_pred_val, df_val, cfg)
    
    log(f"   Reward en VAL: {reward_val:.0f}")
    log(f"   Guardrails aplicados: {n_corrections}")
    log(f"   FN preocupante: {metrics_val['fn_preocupante']} {'✅' if metrics_val['fn_preocupante'] == 0 else '⚠️'}")
    log(f"   FP preocupante: {metrics_val['fp_preocupante']}")
    log(f"   Costo total: ${metrics_val['total_cost']:,.0f}")
    
    # ✅ Análisis de sensibilidad (grid fino alrededor del óptimo)
    log("\n📊 Análisis de sensibilidad...")
    sensitivity = []
    delta = 0.05
    sens_grid = np.linspace(max(0.1, thr_p_best-delta), min(0.9, thr_p_best+delta), 5)
    
    for thr_p_sens in sens_grid:
        for thr_i_sens in sens_grid:
            y_pred_sens = np.where(proba_val[:, idx_pre] >= thr_p_sens, "preocupante",
                         np.where(proba_val[:, idx_inu] >= thr_i_sens, "inusual", "relevante"))
            y_pred_sens, _ = apply_guardrails(df_val, y_pred_sens, cfg)
            reward_sens, metrics_sens = calculate_reward(y_val, y_pred_sens, df_val, cfg)
            
            sensitivity.append({
                "thr_preocupante": float(thr_p_sens),
                "thr_inusual": float(thr_i_sens),
                "reward": float(reward_sens),
                "fn_preocupante": metrics_sens["fn_preocupante"],
                "fp_preocupante": metrics_sens["fp_preocupante"],
                "total_cost": metrics_sens["total_cost"]
            })
    
    sens_df = pd.DataFrame(sensitivity).sort_values("reward", ascending=False)
    
    # Guardar resultados
    os.makedirs(OUT_DIR, exist_ok=True)
    
    result = {
        "threshold_preocupante": thr_p_best,
        "threshold_inusual": thr_i_best,
        "reward_train": float(best_reward),
        "reward_val": float(reward_val),
        "metrics_train": best_metrics,
        "metrics_val": metrics_val,
        "costs_used": COSTS,
        "n_combinations_explored": total_combinations,
        "version": "2.0",
        "timestamp": datetime.now().isoformat()
    }
    
    with open(os.path.join(OUT_DIR, "refuerzo_thresholds_v2.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    
    np.save(os.path.join(OUT_DIR, "refuerzo_qtable_v2.npy"), q_table)
    
    sens_df.to_csv(os.path.join(OUT_DIR, "refuerzo_sensitivity_v2.csv"), index=False)
    
    bundle_rl = {
        "thresholds": {"preocupante": thr_p_best, "inusual": thr_i_best},
        "q_table": q_table,
        "result": result,
        "version": "2.0"
    }
    joblib.dump(bundle_rl, os.path.join(OUT_DIR, "refuerzo_bundle_v2.pkl"))
    
    log("\n" + "="*74)
    log("✅ RESULTADOS")
    log("="*74)
    log(f"Thresholds óptimos:")
    log(f"  Preocupante: {thr_p_best}")
    log(f"  Inusual:     {thr_i_best}")
    log(f"\nPerformance en TRAIN:")
    log(f"  FN preocupante: {best_metrics['fn_preocupante']}")
    log(f"  Costo total: ${best_metrics['total_cost']:,.0f}")
    log(f"\nPerformance en VAL:")
    log(f"  FN preocupante: {metrics_val['fn_preocupante']} {'✅' if metrics_val['fn_preocupante'] == 0 else '⚠️ RE-OPTIMIZAR'}")
    log(f"  FP preocupante: {metrics_val['fp_preocupante']}")
    log(f"  Costo total: ${metrics_val['total_cost']:,.0f}")
    log(f"\n📁 Archivos guardados:")
    log(f"  {os.path.abspath(os.path.join(OUT_DIR,'refuerzo_thresholds_v2.json'))}")
    log(f"  {os.path.abspath(os.path.join(OUT_DIR,'refuerzo_qtable_v2.npy'))}")
    log(f"  {os.path.abspath(os.path.join(OUT_DIR,'refuerzo_sensitivity_v2.csv'))}")
    log(f"  {os.path.abspath(os.path.join(OUT_DIR,'refuerzo_bundle_v2.pkl'))}")
    log("\nListo.")

if __name__ == "__main__":
    main()
