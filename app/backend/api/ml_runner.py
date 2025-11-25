#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - VERSIÓN CORREGIDA Y OPTIMIZADA

Pipeline de inferencia ML para TarantulaHawk:
1. Carga CSV enriquecido desde pending/
2. Aplica modelo NO supervisado (anomalías)
3. Aplica modelo supervisado (clasificación ML)
4. Calcula EBR con ponderaciones
5. Fusiona ML + EBR + Guardrails LFPIORPI
6. Genera explicaciones
7. Aplica modelo de refuerzo (optimización thresholds)
8. Guarda resultados

Uso:
    python ml_runner.py                    # Procesa todos los pending/
    python ml_runner.py <analysis_id>      # Procesa archivo específico
"""

import os
import sys
import json
import shutil
import traceback
from pathlib import Path
from datetime import datetime
from collections import Counter
from typing import Dict, Any, List, Tuple, Optional

import numpy as np
import pandas as pd
import joblib

# ============================================================================
# CONFIGURACIÓN DE RUTAS
# ============================================================================
BASE_DIR = Path(__file__).resolve().parent.parent  # .../app/backend
PENDING_DIR = BASE_DIR / "outputs" / "enriched" / "pending"
PROCESSED_DIR = BASE_DIR / "outputs" / "enriched" / "processed"
FAILED_DIR = BASE_DIR / "outputs" / "enriched" / "failed"
MODELS_DIR = BASE_DIR / "outputs"
CONFIG_PATH = BASE_DIR / "models" / "config_modelos.json"

# Crear directorios
for d in (PENDING_DIR, PROCESSED_DIR, FAILED_DIR):
    d.mkdir(parents=True, exist_ok=True)


# ============================================================================
# LOGGING
# ============================================================================
def log(msg: str) -> None:
    """Log con timestamp"""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ============================================================================
# CARGA DE CONFIGURACIÓN
# ============================================================================
_CONFIG_CACHE: Dict[str, Any] = {}


def cargar_config() -> Dict[str, Any]:
    """Carga configuración desde config_modelos.json"""
    global _CONFIG_CACHE
    
    if _CONFIG_CACHE:
        return _CONFIG_CACHE
    
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Config no encontrado: {CONFIG_PATH}")
    
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        _CONFIG_CACHE = json.load(f)
    
    return _CONFIG_CACHE


def get_uma_mxn() -> float:
    """Obtiene UMA diaria en MXN"""
    cfg = cargar_config()
    lfpi = cfg.get("lfpiorpi", {})
    return float(lfpi.get("uma_diaria", lfpi.get("uma_mxn", 113.14)))


def mxn_a_umas(monto: float) -> float:
    """Convierte MXN a UMAs"""
    uma = get_uma_mxn()
    return monto / uma if uma > 0 else 0.0


# ============================================================================
# CARGA DE MODELOS
# ============================================================================
def cargar_modelo_supervisado() -> Tuple[Any, Any, List[str], List[str]]:
    """
    Carga el bundle del modelo supervisado.
    
    Returns:
        (modelo, scaler, feature_columns, classes)
    """
    bundle_path = MODELS_DIR / "modelo_ensemble_stack.pkl"
    
    if not bundle_path.exists():
        raise FileNotFoundError(f"Modelo supervisado no encontrado: {bundle_path}")
    
    bundle = joblib.load(bundle_path)
    
    model = bundle.get("model")
    scaler = bundle.get("scaler")
    # Buscar columnas en diferentes keys posibles
    feature_cols = bundle.get("feature_columns") or bundle.get("columns") or bundle.get("features") or []
    classes = list(bundle.get("classes", ["relevante", "inusual", "preocupante"]))
    
    if model is None:
        raise ValueError("Bundle no contiene 'model'")
    
    # ✅ Diagnóstico de features
    if feature_cols:
        onehot_cols = [c for c in feature_cols if "_" in c and any(
            p in c for p in ["fraccion_", "sector_actividad_", "tipo_operacion_"]
        )]
        log(f"  📋 Modelo: {len(feature_cols)} features, {len(onehot_cols)} one-hot")
    
    return model, scaler, feature_cols, classes


def cargar_modelo_no_supervisado() -> Optional[Dict[str, Any]]:
    """
    Carga el bundle del modelo no supervisado.
    
    Returns:
        Bundle con isolation_forest, dbscan, scaler, columns o None si no existe
    """
    bundle_path = MODELS_DIR / "no_supervisado_bundle.pkl"
    
    if not bundle_path.exists():
        log(f"  ⚠️ Modelo no supervisado no encontrado: {bundle_path}")
        return None
    
    bundle = joblib.load(bundle_path)
    
    # Diagnóstico
    columns = bundle.get("columns") or bundle.get("feature_columns") or []
    log(f"  📋 No supervisado: {len(columns)} features esperadas")
    
    return bundle


def cargar_modelo_refuerzo() -> Optional[Any]:
    """
    Carga el modelo de refuerzo para optimización de thresholds.
    
    Returns:
        Modelo RL o None si no existe
    """
    model_path = MODELS_DIR / "modelo_refuerzo_th.pkl"
    
    if not model_path.exists():
        log(f"  ⚠️ Modelo de refuerzo no encontrado: {model_path}")
        return None
    
    return joblib.load(model_path)


# ============================================================================
# PASO 1: APLICAR MODELO NO SUPERVISADO
# ============================================================================
def aplicar_no_supervisado(df: pd.DataFrame, bundle: Dict[str, Any]) -> pd.DataFrame:
    """
    Aplica modelo no supervisado para detectar anomalías.
    
    Agrega columnas:
    - anomaly_score_iso: score de Isolation Forest
    - is_outlier_iso: bool si es outlier
    - is_dbscan_noise: bool si es ruido en DBSCAN
    - anomaly_score_composite: score compuesto (0-1)
    """
    df = df.copy()
    
    try:
        # Obtener columnas esperadas por el modelo
        columns = bundle.get("columns", bundle.get("feature_columns", []))
        if not columns:
            raise ValueError("Bundle no tiene 'columns' ni 'feature_columns'")
        
        # ✅ CORREGIDO: Preparar features con one-hot si es necesario
        X = df.copy()
        
        # Eliminar columnas no-features
        drop_cols = ["clasificacion_lfpiorpi", "clasificacion_ml", "clasificacion", 
                     "cliente_id", "fecha", "id_transaccion"]
        X = X.drop(columns=[c for c in drop_cols if c in X.columns], errors="ignore")
        
        # Detectar si el modelo espera columnas one-hot
        has_onehot = any("_" in c and any(p in c for p in ["fraccion_", "sector_actividad_", "tipo_operacion_"]) 
                        for c in columns)
        
        if has_onehot:
            # One-hot encode categóricas (SIN drop_first para consistencia)
            cat_cols = ["tipo_operacion", "sector_actividad", "fraccion"]
            cat_cols = [c for c in cat_cols if c in X.columns]
            if cat_cols:
                X = pd.get_dummies(X, columns=cat_cols, drop_first=False, dtype=float)
        
        # Agregar columnas faltantes con 0
        for col in columns:
            if col not in X.columns:
                X[col] = 0.0
        
        # Seleccionar solo columnas del modelo en orden
        X = X[columns].copy()
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
        
        log(f"  📊 Features alineadas: {X.shape[1]} columnas")
        
        # Escalar
        scaler = bundle.get("scaler")
        if scaler:
            X_scaled = scaler.transform(X)
        else:
            X_scaled = X.values
        
        # Isolation Forest
        iso_forest = bundle.get("isolation_forest")
        if iso_forest:
            iso_scores = -iso_forest.decision_function(X_scaled)  # Mayor = más anómalo
            iso_outliers = iso_forest.predict(X_scaled) == -1
        else:
            iso_scores = np.zeros(len(df))
            iso_outliers = np.zeros(len(df), dtype=bool)
        
        # DBSCAN - NO re-fitear, solo marcar como fallback
        is_noise = np.zeros(len(df), dtype=bool)
        
        # Agregar columnas
        df["anomaly_score_iso"] = iso_scores
        df["is_outlier_iso"] = iso_outliers.astype(int)
        df["is_dbscan_noise"] = is_noise.astype(int)
        
        # Score compuesto normalizado (0-1)
        if len(iso_scores) > 0 and iso_scores.max() > iso_scores.min():
            normalized = (iso_scores - iso_scores.min()) / (iso_scores.max() - iso_scores.min() + 1e-10)
        else:
            normalized = np.zeros(len(df))
        
        df["anomaly_score_composite"] = normalized * 0.7 + iso_outliers.astype(float) * 0.3
        
        log(f"  ✅ Anomalías: mean={df['anomaly_score_composite'].mean():.3f}, outliers={iso_outliers.sum()}")
        
    except Exception as e:
        log(f"  ⚠️ Error en no supervisado: {e}")
        df["anomaly_score_iso"] = 0.0
        df["is_outlier_iso"] = 0
        df["is_dbscan_noise"] = 0
        df["anomaly_score_composite"] = 0.0
    
    return df


# ============================================================================
# PASO 2: APLICAR MODELO SUPERVISADO
# ============================================================================
def aplicar_supervisado(
    df: pd.DataFrame,
    model: Any,
    scaler: Any,
    feature_cols: List[str],
    classes: List[str]
) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """
    Aplica modelo supervisado para clasificación.
    
    Returns:
        (df con predicciones, array de predicciones, array de probabilidades)
    """
    df = df.copy()
    
    # Preparar features
    X = df.copy()
    
    # Eliminar columnas que no son features
    drop_cols = ["clasificacion_lfpiorpi", "clasificacion_ml", "clasificacion", 
                 "cliente_id", "fecha", "id_transaccion"]
    X = X.drop(columns=[c for c in drop_cols if c in X.columns], errors="ignore")
    
    # ✅ CORREGIDO: Detectar si el modelo espera columnas one-hot
    has_onehot = any("_" in c and any(p in c for p in ["fraccion_", "sector_actividad_", "tipo_operacion_"]) 
                    for c in feature_cols)
    
    if has_onehot:
        # One-hot encoding de categóricas (SIN drop_first para consistencia con entrenamiento)
        cat_cols = ["tipo_operacion", "sector_actividad", "fraccion"]
        cat_cols = [c for c in cat_cols if c in X.columns]
        if cat_cols:
            X = pd.get_dummies(X, columns=cat_cols, drop_first=False, dtype=float)
    
    # ✅ CORREGIDO: Agregar TODAS las columnas faltantes con 0
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0.0
    
    # Seleccionar solo columnas del modelo en el orden correcto
    X = X[feature_cols].copy()
    
    # Sanitizar valores
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    
    log(f"  📊 Features alineadas: {X.shape[1]} columnas")
    
    # Escalar
    if scaler:
        X_scaled = scaler.transform(X.values)
    else:
        X_scaled = X.values
    
    # Predecir
    predictions = model.predict(X_scaled)
    probabilities = model.predict_proba(X_scaled)
    
    # Agregar a DataFrame
    df["clasificacion_ml"] = predictions
    
    for i, cls in enumerate(classes):
        df[f"prob_{cls}"] = probabilities[:, i]
    
    # Calcular ICA (máxima probabilidad)
    df["ica"] = probabilities.max(axis=1)
    
    log(f"  ✅ ML: {Counter(predictions)}")
    
    return df, predictions, probabilities


# ============================================================================
# PASO 3: CALCULAR EBR CON PONDERACIONES
# ============================================================================
def calcular_ebr_ponderado(row: Dict[str, Any], cfg: Dict[str, Any]) -> Tuple[float, List[str]]:
    """
    Calcula score EBR con ponderaciones específicas para PLD.
    
    Ponderaciones:
    - Efectivo: 25 pts (ALTO peso para PLD)
    - Sector alto riesgo: 20 pts
    - Acumulado 6m > 500k: 15 pts
    - Internacional: 10 pts
    - Frecuencia alta: 10 pts
    - Ratio vs promedio > 3: 10 pts
    - Nocturno: 5 pts
    - Fin de semana: 5 pts
    - Monto redondo: 5 pts
    - Burst: 5 pts
    
    Returns:
        (score 0-100, lista de factores activos)
    """
    score = 0.0
    factores = []
    
    # Helper para obtener valores
    def get_num(key: str, default: float = 0.0) -> float:
        val = row.get(key, default)
        if pd.isna(val):
            return default
        try:
            return float(val)
        except (TypeError, ValueError):
            return default
    
    def get_int(key: str, default: int = 0) -> int:
        return int(get_num(key, float(default)))
    
    monto = get_num("monto")
    
    # 1. Efectivo (25 pts) - ALTO PESO
    if get_int("EsEfectivo") == 1:
        score += 25
        factores.append(f"Operación en efectivo de {monto:,.0f} MXN (+25 pts)")
    
    # 2. Sector alto riesgo (20 pts)
    if get_int("SectorAltoRiesgo") == 1:
        score += 20
        sector = row.get("sector_actividad", "")
        factores.append(f"Sector vulnerable: {sector} (+20 pts)")
    
    # 3. Acumulado 6m (15 pts)
    monto_6m = get_num("monto_6m")
    if monto_6m >= 500_000:
        score += 15
        factores.append(f"Acumulado 6m: ${monto_6m:,.0f} supera $500k (+15 pts)")
    
    # 4. Internacional (10 pts)
    if get_int("EsInternacional") == 1:
        score += 10
        factores.append("Transferencia internacional (+10 pts)")
    
    # 5. Frecuencia alta (10 pts)
    ops_6m = get_num("ops_6m")
    if ops_6m > 5:
        score += 10
        factores.append(f"Alta frecuencia: {ops_6m:.0f} ops en 6m (+10 pts)")
    
    # 6. Ratio vs promedio (10 pts)
    ratio = get_num("ratio_vs_promedio", 1.0)
    if ratio > 3.0:
        score += 10
        factores.append(f"Monto {ratio:.1f}x vs promedio (+10 pts)")
    
    # 7. Nocturno (5 pts)
    if get_int("es_nocturno") == 1:
        score += 5
        factores.append("Horario nocturno (+5 pts)")
    
    # 8. Fin de semana (5 pts)
    if get_int("fin_de_semana") == 1:
        score += 5
        factores.append("Fin de semana (+5 pts)")
    
    # 9. Monto redondo (5 pts)
    if get_int("es_monto_redondo") == 1:
        score += 5
        factores.append("Monto redondo (+5 pts)")
    
    # 10. Burst (5 pts)
    if get_int("posible_burst") == 1:
        score += 5
        factores.append("Operaciones en ráfaga (+5 pts)")
    
    # Limitar a 100
    score = min(100.0, max(0.0, score))
    
    return score, factores[:3]  # Top 3 factores


def clasificar_ebr(score: float) -> Tuple[str, str]:
    """
    Convierte score EBR a nivel y clasificación.
    
    Returns:
        (nivel_riesgo, clasificacion)
    """
    if score <= 50:
        return "bajo", "relevante"
    elif score <= 65:
        return "medio", "inusual"
    else:
        return "alto", "preocupante"


def aplicar_ebr(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    """Aplica cálculo EBR a todo el DataFrame"""
    df = df.copy()
    
    scores = []
    niveles = []
    clasificaciones = []
    factores_list = []
    
    for _, row in df.iterrows():
        row_dict = row.to_dict() if hasattr(row, 'to_dict') else dict(row)
        score, factores = calcular_ebr_ponderado(row_dict, cfg)
        nivel, clasif = clasificar_ebr(score)
        
        scores.append(score)
        niveles.append(nivel)
        clasificaciones.append(clasif)
        factores_list.append(factores)
    
    df["score_ebr"] = scores
    df["nivel_riesgo_ebr"] = niveles
    df["clasificacion_ebr"] = clasificaciones
    df["factores_ebr"] = factores_list
    
    log(f"  ✅ EBR: mean={np.mean(scores):.1f}, alto={sum(1 for n in niveles if n=='alto')}")
    
    return df


# ============================================================================
# PASO 4: APLICAR GUARDRAILS LFPIORPI
# ============================================================================
def verificar_guardrail(
    row: Dict[str, Any],
    cfg: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Verifica si una transacción activa guardrails LFPIORPI.
    
    Guardrails (fuerzan 'preocupante'):
    1. Monto >= umbral de aviso
    2. Efectivo >= límite de efectivo
    3. Acumulado 6m >= umbral de aviso
    
    Returns:
        (activa_guardrail, razon)
    """
    uma = get_uma_mxn()
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})
    
    # Obtener fracción
    fraccion = row.get("fraccion", "_general")
    u = umbrales.get(fraccion, umbrales.get("_general", {}))
    
    umbral_aviso_umas = float(u.get("aviso_UMA", 645))
    umbral_efectivo_umas = float(u.get("efectivo_max_UMA", 8025))
    
    umbral_aviso = umbral_aviso_umas * uma
    umbral_efectivo = umbral_efectivo_umas * uma
    
    monto = float(row.get("monto", 0) or 0)
    es_efectivo = row.get("EsEfectivo") in (1, True, "1")
    monto_6m = float(row.get("monto_6m", 0) or 0)
    
    # Verificar guardrails
    if monto >= umbral_aviso:
        return True, f"Monto {monto:,.0f} >= umbral aviso {umbral_aviso:,.0f} MXN ({umbral_aviso_umas:.0f} UMAs)"
    
    if es_efectivo and monto >= umbral_efectivo:
        return True, f"Efectivo {monto:,.0f} >= límite {umbral_efectivo:,.0f} MXN ({umbral_efectivo_umas:.0f} UMAs)"
    
    if monto < umbral_aviso and monto_6m >= umbral_aviso:
        return True, f"Acumulado 6m {monto_6m:,.0f} >= umbral {umbral_aviso:,.0f} MXN"
    
    return False, None


# ============================================================================
# PASO 5: FUSIÓN ML + EBR + GUARDRAILS
# ============================================================================
def fusionar_clasificaciones(
    row: Dict[str, Any],
    cfg: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Fusiona clasificación ML con EBR y aplica guardrails.
    
    Reglas:
    1. Si guardrail activo → preocupante (sin discusión)
    2. Si ML == EBR → no cambiar
    3. Si ML = relevante y EBR = alto → elevar a inusual
    4. Nunca bajar clasificación
    
    Returns:
        Dict con clasificacion_final, origen, guardrail_aplicado, etc.
    """
    clasif_ml = row.get("clasificacion_ml", "relevante")
    clasif_ebr = row.get("clasificacion_ebr", "relevante")
    score_ebr = float(row.get("score_ebr", 0) or 0)
    ica = float(row.get("ica", 0) or 0)
    
    # Orden de severidad
    orden = {"relevante": 0, "inusual": 1, "preocupante": 2}
    
    # 1. Verificar guardrails primero
    guardrail_activo, guardrail_razon = verificar_guardrail(row, cfg)
    
    if guardrail_activo:
        return {
            "clasificacion_final": "preocupante",
            "nivel_riesgo_final": "alto",
            "origen": "guardrail",
            "guardrail_aplicado": True,
            "guardrail_razon": guardrail_razon,
            "requiere_revision": False,
            "motivo_fusion": f"Guardrail LFPIORPI: {guardrail_razon}",
        }
    
    ml_nivel = orden.get(clasif_ml, 0)
    ebr_nivel = orden.get(clasif_ebr, 0)
    
    # 2. Si coinciden
    if ml_nivel == ebr_nivel:
        return {
            "clasificacion_final": clasif_ml,
            "nivel_riesgo_final": ["bajo", "medio", "alto"][ml_nivel],
            "origen": "ml_ebr_coinciden",
            "guardrail_aplicado": False,
            "guardrail_razon": None,
            "requiere_revision": False,
            "motivo_fusion": None,
        }
    
    # 3. Si EBR ve más riesgo que ML
    if ebr_nivel > ml_nivel:
        # Solo elevamos de relevante a inusual si EBR es alto
        if clasif_ml == "relevante" and clasif_ebr == "preocupante":
            return {
                "clasificacion_final": "inusual",
                "nivel_riesgo_final": "medio",
                "origen": "elevacion_ebr",
                "guardrail_aplicado": False,
                "guardrail_razon": None,
                "requiere_revision": True,
                "motivo_fusion": f"Elevado de relevante a inusual por EBR alto ({score_ebr:.1f})",
            }
        elif clasif_ml == "relevante" and clasif_ebr == "inusual":
            return {
                "clasificacion_final": "inusual",
                "nivel_riesgo_final": "medio",
                "origen": "elevacion_ebr",
                "guardrail_aplicado": False,
                "guardrail_razon": None,
                "requiere_revision": True,
                "motivo_fusion": f"Elevado de relevante a inusual por EBR medio ({score_ebr:.1f})",
            }
    
    # 4. ML tiene precedencia (nunca bajamos)
    return {
        "clasificacion_final": clasif_ml,
        "nivel_riesgo_final": ["bajo", "medio", "alto"][ml_nivel],
        "origen": "ml_predomina",
        "guardrail_aplicado": False,
        "guardrail_razon": None,
        "requiere_revision": ml_nivel != ebr_nivel,
        "motivo_fusion": f"ML ({clasif_ml}) difiere de EBR ({clasif_ebr}), se respeta ML" if ml_nivel != ebr_nivel else None,
    }


# ============================================================================
# PASO 6: GENERAR EXPLICACIONES
# ============================================================================
def generar_explicacion(
    row: Dict[str, Any],
    fusion: Dict[str, Any],
    cfg: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Genera explicación completa para una transacción.
    """
    # Importar módulo de explicabilidad
    try:
        from explicabilidad_transactions import build_explicacion, generar_acciones_sugeridas
    except ImportError:
        # Fallback simple
        return {
            "razones_principales": row.get("factores_ebr", []),
            "fundamento_legal": None,
            "acciones_sugeridas": [],
        }
    
    ml_info = {
        "clasificacion_ml": row.get("clasificacion_ml"),
        "probabilidades": {
            "relevante": row.get("prob_relevante", 0),
            "inusual": row.get("prob_inusual", 0),
            "preocupante": row.get("prob_preocupante", 0),
        },
        "ica": row.get("ica", 0),
    }
    
    ebr_info = {
        "score_ebr": row.get("score_ebr", 0),
        "nivel_riesgo_ebr": row.get("nivel_riesgo_ebr", "bajo"),
        "clasificacion_ebr": row.get("clasificacion_ebr", "relevante"),
        "factores": row.get("factores_ebr", []),
    }
    
    uma_cfg = {"uma_mxn": get_uma_mxn()}
    
    triggers = []
    if fusion.get("guardrail_aplicado"):
        triggers.append("guardrail_lfpiorpi")
    
    return build_explicacion(
        row=row,
        ml_info=ml_info,
        ebr_info=ebr_info,
        lfpi_cfg=cfg.get("lfpiorpi", {}),
        uma_cfg=uma_cfg,
        clasificacion_final=fusion["clasificacion_final"],
        nivel_riesgo_final=fusion["nivel_riesgo_final"],
        triggers=triggers,
    )


# ============================================================================
# PASO 7: MODELO DE REFUERZO
# ============================================================================
def aplicar_refuerzo(
    df: pd.DataFrame,
    rl_model: Any,
    analysis_id: str
) -> None:
    """
    Aplica modelo de refuerzo para sugerir optimización de thresholds.
    Guarda resultados en JSON para análisis futuro.
    """
    if rl_model is None:
        return
    
    try:
        # Calcular estado actual
        scores_ebr = df["score_ebr"].values if "score_ebr" in df.columns else []
        icas = df["ica"].values if "ica" in df.columns else []
        clasificaciones = df["clasificacion_final"].tolist() if "clasificacion_final" in df.columns else []
        
        n_total = len(clasificaciones)
        dist = {
            "preocupante": clasificaciones.count("preocupante") / n_total if n_total else 0,
            "inusual": clasificaciones.count("inusual") / n_total if n_total else 0,
            "relevante": clasificaciones.count("relevante") / n_total if n_total else 0,
        }
        
        # Estado para RL
        estado = [
            float(np.mean(scores_ebr)) if len(scores_ebr) else 0.0,
            float(np.mean(icas)) if len(icas) else 0.0,
            dist["preocupante"],
            dist["inusual"],
        ]
        
        # Obtener acción sugerida
        if hasattr(rl_model, "predict"):
            accion = rl_model.predict([estado])[0]
        elif isinstance(rl_model, dict) and "action_for_state" in rl_model:
            accion = rl_model["action_for_state"](estado)
        else:
            accion = None
        
        # Guardar para análisis futuro
        output = {
            "timestamp": datetime.now().isoformat(),
            "analysis_id": analysis_id,
            "estado_actual": {
                "ebr_promedio": estado[0],
                "ica_promedio": estado[1],
                "distribucion": dist,
            },
            "accion_recomendada": accion,
            "thresholds_actuales": {
                "ebr_inusual": 51.0,
                "ebr_preocupante": 65.0,
            },
            "nota": "Datos para ajuste de thresholds en futuras iteraciones",
        }
        
        output_path = PROCESSED_DIR / f"{analysis_id}_thresholds_rl.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        log(f"  ✅ Thresholds RL guardados: {output_path.name}")
        
    except Exception as e:
        log(f"  ⚠️ Error en refuerzo: {e}")


# ============================================================================
# PROCESO PRINCIPAL DE UN ARCHIVO
# ============================================================================
def procesar_archivo(csv_path: Path) -> bool:
    """
    Procesa un archivo CSV enriquecido.
    
    Pipeline:
    1. Cargar CSV
    2. Aplicar no supervisado
    3. Aplicar supervisado
    4. Calcular EBR
    5. Fusionar + guardrails
    6. Generar explicaciones
    7. Aplicar refuerzo
    8. Guardar resultados
    """
    analysis_id = csv_path.stem
    
    log("\n" + "=" * 70)
    log(f"📄 Procesando: {csv_path.name}")
    log("=" * 70)
    
    try:
        # Cargar config
        cfg = cargar_config()
        
        # 1. Cargar CSV
        df = pd.read_csv(csv_path)
        log(f"  📥 Cargado: {len(df)} filas, {len(df.columns)} columnas")
        
        # Backup cliente_id
        cliente_ids = df["cliente_id"].copy() if "cliente_id" in df.columns else None
        
        # 2. Modelo no supervisado
        log("\n  🔬 Paso 2: Modelo no supervisado...")
        bundle_ns = cargar_modelo_no_supervisado()
        if bundle_ns:
            df = aplicar_no_supervisado(df, bundle_ns)
        else:
            df["anomaly_score_composite"] = 0.0
            df["is_outlier_iso"] = 0
            df["is_dbscan_noise"] = 0
        
        # 3. Modelo supervisado
        log("\n  🤖 Paso 3: Modelo supervisado...")
        model, scaler, feature_cols, classes = cargar_modelo_supervisado()
        df, predictions, probabilities = aplicar_supervisado(df, model, scaler, feature_cols, classes)
        
        # 4. Calcular EBR
        log("\n  📊 Paso 4: Cálculo EBR con ponderaciones...")
        df = aplicar_ebr(df, cfg)
        
        # 5. Fusión ML + EBR + Guardrails
        log("\n  🔀 Paso 5: Fusión ML + EBR + Guardrails...")
        fusiones = []
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            fusion = fusionar_clasificaciones(row_dict, cfg)
            fusiones.append(fusion)
        
        df["clasificacion_final"] = [f["clasificacion_final"] for f in fusiones]
        df["nivel_riesgo_final"] = [f["nivel_riesgo_final"] for f in fusiones]
        df["origen"] = [f["origen"] for f in fusiones]
        df["guardrail_aplicado"] = [f["guardrail_aplicado"] for f in fusiones]
        df["guardrail_razon"] = [f["guardrail_razon"] for f in fusiones]
        
        guardrails_count = sum(1 for f in fusiones if f["guardrail_aplicado"])
        log(f"  ✅ Fusión completada. Guardrails aplicados: {guardrails_count}")
        log(f"  📊 Distribución final: {Counter(df['clasificacion_final'])}")
        
        # 6. Generar explicaciones
        log("\n  📝 Paso 6: Generando explicaciones...")
        explicaciones = []
        for i, row in df.iterrows():
            row_dict = row.to_dict()
            try:
                exp = generar_explicacion(row_dict, fusiones[i], cfg)
            except Exception as e:
                exp = {"error": str(e)}
            explicaciones.append(exp)
        
        # 7. Modelo de refuerzo
        log("\n  🎯 Paso 7: Modelo de refuerzo...")
        rl_model = cargar_modelo_refuerzo()
        aplicar_refuerzo(df, rl_model, analysis_id)
        
        # 8. Guardar resultados
        log("\n  💾 Paso 8: Guardando resultados...")
        
        # Construir JSON de transacciones
        transacciones = []
        for i, row in df.iterrows():
            tx = {
                "cliente_id": str(row.get("cliente_id", f"TXN-{i+1:05d}")),
                "monto": float(row.get("monto", 0)),
                "umas": mxn_a_umas(float(row.get("monto", 0))),
                "fecha": str(row.get("fecha", "")),
                "tipo_operacion": str(row.get("tipo_operacion", "")),
                "sector_actividad": str(row.get("sector_actividad", "")),
                
                "clasificacion": row.get("clasificacion_final", "relevante"),
                "nivel_riesgo": row.get("nivel_riesgo_final", "bajo"),
                "origen": row.get("origen", "ml"),
                
                "ica": float(row.get("ica", 0)),
                "score_ebr": float(row.get("score_ebr", 0)),
                
                "guardrail_aplicado": bool(row.get("guardrail_aplicado", False)),
                "guardrail_razon": row.get("guardrail_razon"),
                
                "probabilidades": {
                    "relevante": float(row.get("prob_relevante", 0)),
                    "inusual": float(row.get("prob_inusual", 0)),
                    "preocupante": float(row.get("prob_preocupante", 0)),
                },
                
                "anomaly_score_composite": float(row.get("anomaly_score_composite", 0)),
                "is_outlier_iso": bool(row.get("is_outlier_iso", 0)),
                
                "razones": explicaciones[i].get("razones_principales", row.get("factores_ebr", [])),
                "fundamento_legal": explicaciones[i].get("fundamento_legal"),
                "acciones_sugeridas": explicaciones[i].get("acciones_sugeridas", []),
                "explicacion_principal": explicaciones[i].get("resumen_ejecutivo", ""),
                "explicacion_detallada": explicaciones[i].get("explicacion_modelo", ""),
            }
            transacciones.append(tx)
        
        # Resumen
        dist_final = Counter(df["clasificacion_final"])
        resumen = {
            "total_transacciones": len(df),
            "preocupante": int(dist_final.get("preocupante", 0)),
            "inusual": int(dist_final.get("inusual", 0)),
            "relevante": int(dist_final.get("relevante", 0)),
            "guardrails_aplicados": guardrails_count,
            "score_ebr_promedio": float(df["score_ebr"].mean()),
            "ica_promedio": float(df["ica"].mean()),
            "estrategia": "ml_ebr_guardrails",
        }
        
        # Guardar JSON
        output_json = PROCESSED_DIR / f"{analysis_id}.json"
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump({
                "success": True,
                "analysis_id": analysis_id,
                "timestamp": datetime.now().isoformat(),
                "resumen": resumen,
                "transacciones": transacciones,
            }, f, indent=2, ensure_ascii=False)
        
        log(f"  ✅ JSON guardado: {output_json.name}")
        
        # Guardar CSV procesado
        output_csv = PROCESSED_DIR / csv_path.name
        df.to_csv(output_csv, index=False, encoding="utf-8")
        log(f"  ✅ CSV guardado: {output_csv.name}")
        
        # Eliminar de pending
        csv_path.unlink(missing_ok=True)
        
        log("\n" + "=" * 70)
        log(f"✅ PROCESAMIENTO COMPLETADO: {analysis_id}")
        log("=" * 70)
        
        return True
        
    except Exception as e:
        log(f"\n❌ ERROR: {e}")
        traceback.print_exc()
        
        # Mover a failed
        failed_path = FAILED_DIR / csv_path.name
        shutil.move(str(csv_path), str(failed_path))
        
        # Guardar error
        error_json = FAILED_DIR / f"{analysis_id}_error.json"
        with open(error_json, "w", encoding="utf-8") as f:
            json.dump({
                "success": False,
                "analysis_id": analysis_id,
                "error": str(e),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.now().isoformat(),
            }, f, indent=2, ensure_ascii=False)
        
        return False


# ============================================================================
# MAIN
# ============================================================================
def main() -> int:
    log("\n" + "=" * 70)
    log("🚀 ML RUNNER - Pipeline de Inferencia TarantulaHawk")
    log("=" * 70)
    
    # Verificar modelos
    try:
        model, scaler, feature_cols, classes = cargar_modelo_supervisado()
        log(f"  ✅ Modelo supervisado: {len(feature_cols)} features, {len(classes)} clases")
    except Exception as e:
        log(f"  ❌ Error cargando modelo supervisado: {e}")
        return 1
    
    # Determinar archivos a procesar
    if len(sys.argv) > 1:
        analysis_id = sys.argv[1]
        csv_file = PENDING_DIR / f"{analysis_id}.csv"
        
        if not csv_file.exists():
            log(f"  ❌ Archivo no encontrado: {csv_file}")
            return 1
        
        files = [csv_file]
    else:
        files = sorted(PENDING_DIR.glob("*.csv"))
    
    if not files:
        log("  ℹ️ No hay archivos pendientes")
        return 0
    
    log(f"\n📋 Archivos a procesar: {len(files)}")
    
    # Procesar
    ok = 0
    fail = 0
    
    for csv_path in files:
        if procesar_archivo(csv_path):
            ok += 1
        else:
            fail += 1
    
    # Resumen
    log("\n" + "=" * 70)
    log("📊 RESUMEN FINAL")
    log("=" * 70)
    log(f"  ✅ Exitosos: {ok}")
    log(f"  ❌ Fallidos: {fail}")
    log(f"  📁 Resultados en: {PROCESSED_DIR}")
    log("=" * 70 + "\n")
    
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())