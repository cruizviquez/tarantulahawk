#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - VERSIÓN 4.0 - OPCIÓN A (Reglas LFPIORPI primero)

Pipeline de inferencia TarantulaHawk:
1. PASO 0: Aplicar reglas LFPIORPI → separar PREOCUPANTES (certeza 100%)
2. PASO 1: No supervisado (solo casos grises) → detectar anomalías
3. PASO 2: Supervisado (solo casos grises) → clasificar RELEVANTE/INUSUAL
4. PASO 3: EBR → score de riesgo
5. PASO 4: Fusión ML + EBR (solo entre relevante/inusual)
6. PASO 5: Unir preocupantes LFPIORPI + resultados ML
7. PASO 6: Explicaciones simplificadas
8. PASO 7: Guardar resultados

CAMBIOS CLAVE vs v3:
- Reglas LFPIORPI se aplican ANTES del ML (no después)
- ML solo clasifica entre RELEVANTE e INUSUAL (2 clases)
- PREOCUPANTE solo viene de reglas legales (100% certeza)
- servicios_generales pasa directo al ML (sin guardrails)

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
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ============================================================================
# CARGA DE CONFIGURACIÓN
# ============================================================================
_CONFIG_CACHE: Dict[str, Any] = {}


def cargar_config() -> Dict[str, Any]:
    global _CONFIG_CACHE
    if _CONFIG_CACHE:
        return _CONFIG_CACHE
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Config no encontrado: {CONFIG_PATH}")
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        _CONFIG_CACHE = json.load(f)
    return _CONFIG_CACHE


def get_uma_mxn() -> float:
    cfg = cargar_config()
    lfpi = cfg.get("lfpiorpi", {})
    return float(lfpi.get("uma_diaria", lfpi.get("uma_mxn", 113.14)))


def mxn_a_umas(monto: float) -> float:
    uma = get_uma_mxn()
    return monto / uma if uma > 0 else 0.0


# ============================================================================
# CARGA DE MODELOS
# ============================================================================
def cargar_modelo_supervisado() -> Tuple[Any, Any, List[str], List[str]]:
    """Carga modelo supervisado (2 clases: relevante, inusual)"""
    bundle_path = MODELS_DIR / "modelo_ensemble_stack.pkl"
    if not bundle_path.exists():
        raise FileNotFoundError(f"Modelo supervisado no encontrado: {bundle_path}")
    
    bundle = joblib.load(bundle_path)
    model = bundle.get("model")
    scaler = bundle.get("scaler")
    feature_cols = bundle.get("feature_columns") or bundle.get("columns") or []
    classes = list(bundle.get("classes", ["relevante", "inusual"]))
    
    if model is None:
        raise ValueError("Bundle no contiene 'model'")
    
    log(f"  📋 Supervisado: {len(feature_cols)} features, clases={classes}")
    return model, scaler, feature_cols, classes


def cargar_modelo_no_supervisado() -> Optional[Dict[str, Any]]:
    """Carga modelo no supervisado"""
    bundle_path = MODELS_DIR / "no_supervisado_bundle.pkl"
    if not bundle_path.exists():
        log(f"  ⚠️ Modelo no supervisado no encontrado: {bundle_path}")
        return None
    
    bundle = joblib.load(bundle_path)
    columns = bundle.get("columns") or bundle.get("feature_columns") or []
    log(f"  📋 No supervisado: {len(columns)} features")
    return bundle


def cargar_modelo_refuerzo() -> Optional[Any]:
    """Carga modelo de refuerzo"""
    model_path = MODELS_DIR / "refuerzo_bundle.pkl"
    if not model_path.exists():
        log(f"  ⚠️ Modelo de refuerzo no encontrado")
        return None
    return joblib.load(model_path)


# ============================================================================
# PASO 0: APLICAR REGLAS LFPIORPI (ANTES DEL ML)
# ============================================================================
def es_actividad_vulnerable(fraccion: str, cfg: Dict[str, Any]) -> bool:
    """
    Determina si una fracción es actividad vulnerable bajo LFPIORPI Art. 17.
    
    servicios_generales, _general, etc. → NO son vulnerables
    """
    if not fraccion or fraccion.startswith("_"):
        return False
    
    # Lista de fracciones NO vulnerables
    NO_VULNERABLES = [
        "servicios_generales", "_general", "_no_vulnerable",
        "otro", "servicios", "comercio", "retail"
    ]
    
    if fraccion.lower() in NO_VULNERABLES:
        return False
    
    # Verificar en config
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})
    
    if fraccion in umbrales:
        u = umbrales[fraccion]
        # Si tiene flag explícito
        if "es_actividad_vulnerable" in u:
            return bool(u["es_actividad_vulnerable"])
        # Si tiene umbral de aviso válido (< 999999)
        aviso = float(u.get("aviso_UMA", 0))
        return aviso > 0 and aviso < 999999
    
    return False


def evaluar_reglas_lfpiorpi(row: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evalúa si una transacción activa reglas LFPIORPI.
    
    Reglas (solo para actividades vulnerables):
    1. Monto >= umbral de aviso → PREOCUPANTE
    2. Efectivo >= límite de efectivo → PREOCUPANTE
    3. Acumulado 6m >= umbral de aviso → PREOCUPANTE
    
    Returns:
        {
            "activa_guardrail": bool,
            "clasificacion": "preocupante" | None,
            "razon": str,
            "fundamento_legal": str,
            "fraccion": str,
            "umbral_umas": float,
            "umbral_mxn": float,
            "es_actividad_vulnerable": bool
        }
    """
    uma = get_uma_mxn()
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})
    
    fraccion = str(row.get("fraccion", "_general"))
    monto = float(row.get("monto", 0) or 0)
    monto_6m = float(row.get("monto_6m", 0) or 0)
    es_efectivo = row.get("EsEfectivo") in (1, True, "1", "true")
    
    # Resultado base
    resultado = {
        "activa_guardrail": False,
        "clasificacion": None,
        "razon": None,
        "fundamento_legal": None,
        "fraccion": fraccion,
        "umbral_aviso_umas": None,
        "umbral_aviso_mxn": None,
        "umbral_efectivo_umas": None,
        "umbral_efectivo_mxn": None,
        "es_actividad_vulnerable": False,
    }
    
    # Si NO es actividad vulnerable, no aplican guardrails
    if not es_actividad_vulnerable(fraccion, cfg):
        resultado["es_actividad_vulnerable"] = False
        return resultado
    
    resultado["es_actividad_vulnerable"] = True
    
    # Obtener umbrales de la fracción
    u = umbrales.get(fraccion, umbrales.get("_general", {}))
    umbral_aviso_umas = float(u.get("aviso_UMA", 645))
    umbral_efectivo_umas = float(u.get("efectivo_max_UMA", 0))
    descripcion = u.get("descripcion", fraccion)
    
    umbral_aviso_mxn = umbral_aviso_umas * uma
    umbral_efectivo_mxn = umbral_efectivo_umas * uma if umbral_efectivo_umas > 0 else 0
    
    resultado["umbral_aviso_umas"] = umbral_aviso_umas
    resultado["umbral_aviso_mxn"] = umbral_aviso_mxn
    resultado["umbral_efectivo_umas"] = umbral_efectivo_umas
    resultado["umbral_efectivo_mxn"] = umbral_efectivo_mxn
    
    # Extraer número de fracción para fundamento legal
    fraccion_num = fraccion.split("_")[0] if "_" in fraccion else fraccion
    
    # REGLA 1: Monto >= umbral de aviso
    if monto >= umbral_aviso_mxn:
        monto_umas = monto / uma
        resultado["activa_guardrail"] = True
        resultado["clasificacion"] = "preocupante"
        resultado["razon"] = f"Monto {monto:,.0f} MXN ({monto_umas:,.0f} UMAs) rebasa umbral de aviso {umbral_aviso_umas:,.0f} UMAs"
        resultado["fundamento_legal"] = (
            f"Artículo 17, Fracción {fraccion_num} LFPIORPI: {descripcion}. "
            f"Umbral de aviso: {umbral_aviso_umas:,.0f} UMAs ({umbral_aviso_mxn:,.0f} MXN). "
            f"Obligación: Presentar aviso a la UIF dentro de los 15 días hábiles siguientes."
        )
        return resultado
    
    # REGLA 2: Efectivo >= límite (si aplica)
    if es_efectivo and umbral_efectivo_mxn > 0 and monto >= umbral_efectivo_mxn:
        monto_umas = monto / uma
        resultado["activa_guardrail"] = True
        resultado["clasificacion"] = "preocupante"
        resultado["razon"] = f"Efectivo {monto:,.0f} MXN ({monto_umas:,.0f} UMAs) rebasa límite {umbral_efectivo_umas:,.0f} UMAs"
        resultado["fundamento_legal"] = (
            f"Artículo 17, Fracción {fraccion_num} y Artículo 18 LFPIORPI: {descripcion}. "
            f"Límite de efectivo: {umbral_efectivo_umas:,.0f} UMAs ({umbral_efectivo_mxn:,.0f} MXN). "
            f"Obligación: Presentar aviso a la UIF. Restricción de pagos en efectivo."
        )
        return resultado
    
    # REGLA 3: Acumulado 6m >= umbral
    if monto_6m >= umbral_aviso_mxn:
        monto_6m_umas = monto_6m / uma
        resultado["activa_guardrail"] = True
        resultado["clasificacion"] = "preocupante"
        resultado["razon"] = f"Acumulado 6 meses {monto_6m:,.0f} MXN ({monto_6m_umas:,.0f} UMAs) rebasa umbral {umbral_aviso_umas:,.0f} UMAs"
        resultado["fundamento_legal"] = (
            f"Artículo 17, Fracción {fraccion_num} LFPIORPI: {descripcion}. "
            f"El acumulado de operaciones en 6 meses rebasa el umbral de aviso. "
            f"Obligación: Presentar aviso a la UIF considerando operaciones acumuladas."
        )
        return resultado
    
    return resultado


def aplicar_reglas_lfpiorpi(df: pd.DataFrame, cfg: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    PASO 0: Aplica reglas LFPIORPI y separa transacciones.
    
    Returns:
        (df_preocupantes, df_para_ml)
        - df_preocupantes: Transacciones que activan guardrails (PREOCUPANTE 100%)
        - df_para_ml: Transacciones que pasan al ML (relevante/inusual)
    """
    log("\n  ⚖️ Paso 0: Aplicando reglas LFPIORPI...")
    
    resultados = []
    for _, row in df.iterrows():
        res = evaluar_reglas_lfpiorpi(row.to_dict(), cfg)
        resultados.append(res)
    
    # Agregar columnas de evaluación
    df = df.copy()
    df["guardrail_activo"] = [r["activa_guardrail"] for r in resultados]
    df["guardrail_razon"] = [r["razon"] for r in resultados]
    df["guardrail_fundamento"] = [r["fundamento_legal"] for r in resultados]
    df["es_actividad_vulnerable"] = [r["es_actividad_vulnerable"] for r in resultados]
    df["umbral_aviso_umas"] = [r["umbral_aviso_umas"] for r in resultados]
    df["umbral_aviso_mxn"] = [r["umbral_aviso_mxn"] for r in resultados]
    
    # Separar
    mask_guardrail = df["guardrail_activo"] == True
    df_preocupantes = df[mask_guardrail].copy()
    df_para_ml = df[~mask_guardrail].copy()
    
    # Asignar clasificación a preocupantes
    if len(df_preocupantes) > 0:
        df_preocupantes["clasificacion_final"] = "preocupante"
        df_preocupantes["nivel_riesgo_final"] = "alto"
        df_preocupantes["origen"] = "regla_lfpiorpi"
        df_preocupantes["clasificacion_ml"] = None
        df_preocupantes["ica"] = 1.0  # Certeza 100%
    
    n_vulnerables = df["es_actividad_vulnerable"].sum()
    n_preocupantes = len(df_preocupantes)
    n_para_ml = len(df_para_ml)
    
    log(f"  📊 Actividades vulnerables: {n_vulnerables}/{len(df)}")
    log(f"  🔴 PREOCUPANTES (regla LFPIORPI): {n_preocupantes}")
    log(f"  ➡️ Pasan a ML: {n_para_ml}")
    
    return df_preocupantes, df_para_ml


# ============================================================================
# PASO 1: APLICAR MODELO NO SUPERVISADO
# ============================================================================
def aplicar_no_supervisado(df: pd.DataFrame, bundle: Dict[str, Any]) -> pd.DataFrame:
    """
    Aplica modelo no supervisado para detectar anomalías.
    Solo se aplica a transacciones que NO activaron guardrails.
    """
    if df.empty:
        return df
    
    df = df.copy()
    
    try:
        columns = bundle.get("columns", bundle.get("feature_columns", []))
        if not columns:
            raise ValueError("Bundle no tiene 'columns'")
        
        # Preparar features
        X = df.copy()
        drop_cols = ["clasificacion_lfpiorpi", "clasificacion_ml", "clasificacion", 
                     "clasificacion_final", "cliente_id", "fecha", "id_transaccion",
                     "guardrail_activo", "guardrail_razon", "guardrail_fundamento"]
        X = X.drop(columns=[c for c in drop_cols if c in X.columns], errors="ignore")
        
        # One-hot si necesario
        has_onehot = any("fraccion_" in c or "tipo_operacion_" in c for c in columns)
        if has_onehot:
            cat_cols = ["tipo_operacion", "sector_actividad", "fraccion"]
            cat_cols = [c for c in cat_cols if c in X.columns]
            if cat_cols:
                X = pd.get_dummies(X, columns=cat_cols, drop_first=False, dtype=float)
        
        # Alinear columnas
        for col in columns:
            if col not in X.columns:
                X[col] = 0.0
        X = X[columns].copy()
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
        
        # Escalar
        scaler = bundle.get("scaler")
        X_scaled = scaler.transform(X) if scaler else X.values
        
        # Isolation Forest
        iso_forest = bundle.get("isolation_forest")
        if iso_forest:
            iso_scores = -iso_forest.decision_function(X_scaled)
            iso_outliers = iso_forest.predict(X_scaled) == -1
        else:
            iso_scores = np.zeros(len(df))
            iso_outliers = np.zeros(len(df), dtype=bool)
        
        df["anomaly_score_iso"] = iso_scores
        df["is_outlier_iso"] = iso_outliers.astype(int)
        
        # KMeans (opcional)
        kmeans = bundle.get("kmeans")
        if kmeans:
            dists = kmeans.transform(X_scaled)
            df["kmeans_dist"] = np.min(dists, axis=1)
        else:
            df["kmeans_dist"] = 0.0
        
        # PCA (opcional)
        pca = bundle.get("pca")
        if pca and hasattr(pca, "inverse_transform"):
            X_recon = pca.inverse_transform(pca.transform(X_scaled))
            df["pca_recon_mse"] = np.mean((X_scaled - X_recon) ** 2, axis=1)
        else:
            df["pca_recon_mse"] = 0.0
        
        # Composite score
        weights = bundle.get("weights", {})
        log(f"  🔧 No supervisado weights: {weights}")
        if weights:
            def _norm(arr):
                a = np.array(arr, dtype=float)
                if a.max() - a.min() < 1e-12:
                    return np.zeros_like(a)
                return (a - a.min()) / (a.max() - a.min() + 1e-12)
            
            w_iso = float(weights.get("iso", 0.6))
            w_km = float(weights.get("kmeans", 0.2))
            w_pca = float(weights.get("pca", 0.2))
            ws = w_iso + w_km + w_pca
            if ws > 0:
                composite = (_norm(iso_scores) * w_iso + 
                            _norm(df["kmeans_dist"]) * w_km + 
                            _norm(df["pca_recon_mse"]) * w_pca) / ws
                df["anomaly_score_composite"] = composite
                log("  🔍 anomaly_score_composite computed from bundle weights")
        else:
            df["anomaly_score_composite"] = iso_scores / (iso_scores.max() + 1e-12) if iso_scores.max() > 0 else 0
            log("  🔍 anomaly_score_composite computed from ISO fallback (no weights)")
        
        log(f"  ✅ No supervisado: outliers={iso_outliers.sum()}, anomaly_mean={df['anomaly_score_composite'].mean():.3f}")
        
    except Exception as e:
        log(f"  ⚠️ Error en no supervisado: {e}")
        df["anomaly_score_iso"] = 0.0
        df["is_outlier_iso"] = 0
        df["anomaly_score_composite"] = 0.0
    
    return df


# ============================================================================
# PASO 2: APLICAR MODELO SUPERVISADO (2 CLASES)
# ============================================================================
def aplicar_supervisado(
    df: pd.DataFrame,
    model: Any,
    scaler: Any,
    feature_cols: List[str],
    classes: List[str]
) -> pd.DataFrame:
    """
    Aplica modelo supervisado para clasificar RELEVANTE vs INUSUAL.
    
    IMPORTANTE: Este modelo solo tiene 2 clases.
    PREOCUPANTE ya fue asignado en PASO 0 por reglas LFPIORPI.
    """
    if df.empty:
        return df
    
    df = df.copy()
    
    # Preparar features
    X = df.copy()
    drop_cols = ["clasificacion_lfpiorpi", "clasificacion_ml", "clasificacion",
                 "clasificacion_final", "cliente_id", "fecha", "id_transaccion",
                 "guardrail_activo", "guardrail_razon", "guardrail_fundamento"]
    X = X.drop(columns=[c for c in drop_cols if c in X.columns], errors="ignore")
    
    # One-hot si necesario
    has_onehot = any("fraccion_" in c or "tipo_operacion_" in c for c in feature_cols)
    if has_onehot:
        cat_cols = ["tipo_operacion", "sector_actividad", "fraccion"]
        cat_cols = [c for c in cat_cols if c in X.columns]
        if cat_cols:
            X = pd.get_dummies(X, columns=cat_cols, drop_first=False, dtype=float)
    
    # Alinear columnas
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0.0
    X = X[feature_cols].copy()
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    # Debugging: report any features that were missing and filled with zeros
    missing_features = [f for f in feature_cols if f not in X.columns or X[f].sum() == 0]
    if missing_features:
        log(f"  ⚠️ Supervisado - missing/zero-filled features: {missing_features[:10]}{'...' if len(missing_features)>10 else ''}")
    
    # Escalar
    X_scaled = scaler.transform(X.values) if scaler else X.values
    
    # Predecir
    predictions = model.predict(X_scaled)
    probabilities = model.predict_proba(X_scaled)
    
    # Agregar resultados
    df["clasificacion_ml"] = predictions
    
    for i, cls in enumerate(classes):
        df[f"prob_{cls}"] = probabilities[:, i]
    
    # ICA = máxima probabilidad
    df["ica"] = probabilities.max(axis=1)
    
    log(f"  ✅ Supervisado (2 clases): {Counter(predictions)}")

    
    return df


# ============================================================================
# PASO 3: CALCULAR EBR
# ============================================================================
def calcular_ebr(row: Dict[str, Any], cfg: Dict[str, Any]) -> Tuple[float, List[str], str]:
    """
    Calcula score EBR (Enfoque Basado en Riesgo).
    
    Returns:
        (score, factores, nivel)
    """
    score = 0.0
    factores = []
    
    ebr_cfg = cfg.get("ebr", {})
    pesos = ebr_cfg.get("ponderaciones", {})
    
    monto = float(row.get("monto", 0) or 0)
    es_efectivo = row.get("EsEfectivo") in (1, True, "1")
    es_internacional = row.get("EsInternacional") in (1, True, "1")
    sector_alto = row.get("SectorAltoRiesgo") in (1, True, "1")
    es_nocturno = row.get("es_nocturno") in (1, True, "1")
    fin_semana = row.get("fin_de_semana") in (1, True, "1")
    monto_redondo = row.get("es_monto_redondo") in (1, True, "1")
    posible_burst = row.get("posible_burst") in (1, True, "1")
    efectivo_alto = row.get("efectivo_alto") in (1, True, "1")
    acumulado_alto = row.get("acumulado_alto") in (1, True, "1")
    ratio_alto = row.get("ratio_vs_promedio", 0)
    ratio_alto = float(ratio_alto) > 3 if ratio_alto else False
    frecuencia_alta = int(row.get("ops_6m", 0) or 0) > 5
    
    # Aplicar pesos
    if es_efectivo:
        pts = float(pesos.get("efectivo", {}).get("puntos", 25))
        score += pts
        factores.append(f"Operación en efectivo (+{pts:.0f} pts)")
    
    if efectivo_alto:
        pts = float(pesos.get("efectivo_alto", {}).get("puntos", 20))
        score += pts
        factores.append(f"Efectivo alto (>=75% umbral) (+{pts:.0f} pts)")
    
    if sector_alto:
        pts = float(pesos.get("sector_alto_riesgo", {}).get("puntos", 20))
        score += pts
        factores.append(f"Sector de alto riesgo (+{pts:.0f} pts)")
    
    if acumulado_alto:
        pts = float(pesos.get("acumulado_alto", {}).get("puntos", 15))
        score += pts
        factores.append(f"Acumulado 6m alto (+{pts:.0f} pts)")
    
    if es_internacional:
        pts = float(pesos.get("internacional", {}).get("puntos", 10))
        score += pts
        factores.append(f"Transferencia internacional (+{pts:.0f} pts)")
    
    if ratio_alto:
        pts = float(pesos.get("ratio_alto", {}).get("puntos", 10))
        score += pts
        factores.append(f"Ratio vs promedio > 3x (+{pts:.0f} pts)")
    
    if frecuencia_alta:
        pts = float(pesos.get("frecuencia_alta", {}).get("puntos", 10))
        score += pts
        factores.append(f"Frecuencia alta (>5 ops/6m) (+{pts:.0f} pts)")
    
    if posible_burst:
        pts = float(pesos.get("burst", {}).get("puntos", 10))
        score += pts
        factores.append(f"Posible fraccionamiento (+{pts:.0f} pts)")
    
    if es_nocturno:
        pts = float(pesos.get("nocturno", {}).get("puntos", 5))
        score += pts
        factores.append(f"Horario nocturno (+{pts:.0f} pts)")
    
    if fin_semana:
        pts = float(pesos.get("fin_semana", {}).get("puntos", 5))
        score += pts
        factores.append(f"Fin de semana (+{pts:.0f} pts)")
    
    if monto_redondo:
        pts = float(pesos.get("monto_redondo", {}).get("puntos", 5))
        score += pts
        factores.append(f"Monto redondo (+{pts:.0f} pts)")
    
    score = min(100, score)
    
    # Determinar nivel
    umbrales = ebr_cfg.get("umbrales_clasificacion", {})
    umbral_bajo = float(umbrales.get("relevante_max", umbrales.get("bajo_max", 40)))
    umbral_medio = float(umbrales.get("inusual_max", umbrales.get("medio_max", 65)))
    
    if score <= umbral_bajo:
        nivel = "bajo"
    elif score <= umbral_medio:
        nivel = "medio"
    else:
        nivel = "alto"
    
    return score, factores, nivel


def aplicar_ebr(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    """Aplica cálculo EBR a todas las transacciones"""
    if df.empty:
        return df
    
    df = df.copy()
    scores = []
    niveles = []
    factores_list = []
    
    for _, row in df.iterrows():
        score, factores, nivel = calcular_ebr(row.to_dict(), cfg)
        scores.append(score)
        niveles.append(nivel)
        factores_list.append(factores)
    
    df["score_ebr"] = scores
    df["nivel_riesgo_ebr"] = niveles
    df["factores_ebr"] = factores_list
    
    log(f"  ✅ EBR: mean={np.mean(scores):.1f}, alto={sum(1 for n in niveles if n=='alto')}")
    
    return df


# ============================================================================
# PASO 4: FUSIÓN ML + EBR (SOLO RELEVANTE/INUSUAL)
# ============================================================================
def fusionar_ml_ebr(row: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fusiona ML + EBR para decidir entre RELEVANTE e INUSUAL.
    
    NOTA: Esta función NO maneja PREOCUPANTE (ya asignado en PASO 0).
    """
    clasif_ml = row.get("clasificacion_ml", "relevante")
    score_ebr = float(row.get("score_ebr", 0) or 0)
    nivel_ebr = row.get("nivel_riesgo_ebr", "bajo")
    ica = float(row.get("ica", 0) or 0)
    
    ebr_cfg = cfg.get("ebr", {})
    umbral_elevacion = float(ebr_cfg.get("elevacion_inusual_threshold", 50))
    
    # Si ML dice inusual, respetar
    if clasif_ml == "inusual":
        return {
            "clasificacion_final": "inusual",
            "nivel_riesgo_final": "medio",
            "origen": "ml",
            "motivo": f"ML clasificó como inusual (ICA={ica:.2f})"
        }
    
    # Si ML dice relevante pero EBR es alto, elevar a inusual
    if clasif_ml == "relevante" and score_ebr >= umbral_elevacion:
        return {
            "clasificacion_final": "inusual",
            "nivel_riesgo_final": "medio",
            "origen": "elevacion_ebr",
            "motivo": f"EBR alto ({score_ebr:.0f}) eleva de relevante a inusual"
        }
    
    # Si ML dice relevante y EBR confirma
    return {
        "clasificacion_final": "relevante",
        "nivel_riesgo_final": "bajo",
        "origen": "ml_ebr_coinciden",
        "motivo": None
    }


def aplicar_fusion(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    """Aplica fusión ML + EBR"""
    if df.empty:
        return df
    
    df = df.copy()
    
    clasificaciones = []
    niveles = []
    origenes = []
    motivos = []
    
    for _, row in df.iterrows():
        fusion = fusionar_ml_ebr(row.to_dict(), cfg)
        clasificaciones.append(fusion["clasificacion_final"])
        niveles.append(fusion["nivel_riesgo_final"])
        origenes.append(fusion["origen"])
        motivos.append(fusion.get("motivo"))
    
    df["clasificacion_final"] = clasificaciones
    df["nivel_riesgo_final"] = niveles
    df["origen"] = origenes
    df["motivo_fusion"] = motivos
    
    log(f"  ✅ Fusión: {Counter(clasificaciones)}")
    
    return df


# ============================================================================
# PASO 5: GENERAR EXPLICACIONES SIMPLIFICADAS
# ============================================================================
def generar_explicacion_simple(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Genera explicación simplificada según el origen de la clasificación.
    
    - PREOCUPANTE (regla_lfpiorpi): Fundamento legal
    - RELEVANTE: Constante "sin indicadores"
    - INUSUAL: Razón específica del ML/EBR
    """
    clasificacion = row.get("clasificacion_final", "relevante")
    origen = row.get("origen", "ml")
    
    if origen == "regla_lfpiorpi" or clasificacion == "preocupante":
        # PREOCUPANTE: Fundamento legal completo
        return {
            "tipo": "legal",
            "razon_principal": row.get("guardrail_razon", "Rebasa umbral LFPIORPI"),
            "fundamento_legal": row.get("guardrail_fundamento"),
            "accion_requerida": "Presentar aviso a la UIF dentro de los 15 días hábiles siguientes a la operación.",
            "certeza": "100%",
            "requiere_revision": False,
        }
    
    elif clasificacion == "relevante":
        # RELEVANTE: Sin indicadores
        return {
            "tipo": "limpio",
            "razon_principal": "No se detectaron indicadores de riesgo PLD/FT",
            "fundamento_legal": None,
            "accion_requerida": "Registro para trazabilidad. Sin acción adicional requerida.",
            "certeza": f"{row.get('ica', 0.9):.0%}",
            "requiere_revision": False,
        }
    
    else:  # INUSUAL
        # Determinar razón específica
        factores = row.get("factores_ebr", [])
        score_ebr = row.get("score_ebr", 0)
        origen_fusion = row.get("origen", "ml")
        
        if origen_fusion == "elevacion_ebr":
            razon = f"Score de riesgo EBR elevado ({score_ebr:.0f}/100)"
        elif factores:
            # Usar el factor más significativo
            razon = factores[0] if factores else "Patrón de comportamiento atípico detectado"
        else:
            razon = "Patrón de comportamiento atípico detectado por modelo ML"
        
        return {
            "tipo": "sospecha",
            "razon_principal": razon,
            "fundamento_legal": None,
            "accion_requerida": "Revisión por oficial de cumplimiento. Documentar análisis realizado.",
            "certeza": f"{row.get('ica', 0.7):.0%}",
            "requiere_revision": True,
            "factores_adicionales": factores[:3] if factores else [],
        }


# ============================================================================
# PASO 6: MODELO DE REFUERZO
# ============================================================================
def aplicar_refuerzo(df: pd.DataFrame, rl_model: Any, analysis_id: str) -> None:
    """Aplica modelo de refuerzo para optimización"""
    if rl_model is None or df.empty:
        return
    
    try:
        # Calcular métricas para el modelo de refuerzo
        dist = df["clasificacion_final"].value_counts(normalize=True).to_dict()
        ebr_mean = df["score_ebr"].mean() if "score_ebr" in df.columns else 0
        ica_mean = df["ica"].mean() if "ica" in df.columns else 0
        
        # Guardar métricas para feedback loop
        metrics = {
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "distribucion": dist,
            "ebr_promedio": float(ebr_mean),
            "ica_promedio": float(ica_mean),
            "total_transacciones": len(df),
        }
        
        metrics_path = PROCESSED_DIR / f"{analysis_id}_rl_metrics.json"
        with open(metrics_path, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
        
        log(f"  ✅ Refuerzo: métricas guardadas")
        
    except Exception as e:
        log(f"  ⚠️ Error en refuerzo: {e}")


# ============================================================================
# PROCESO PRINCIPAL
# ============================================================================
def process_file(csv_path: Path) -> bool:
    """Procesa un archivo CSV enriquecido"""
    analysis_id = csv_path.stem
    
    log(f"\n{'='*70}")
    log(f"📄 Procesando: {csv_path.name}")
    log(f"{'='*70}")
    
    try:
        # Cargar datos y config
        df = pd.read_csv(csv_path)
        cfg = cargar_config()
        log(f"  📊 Cargado: {len(df)} transacciones, {len(df.columns)} columnas")
        
        # ================================================================
        # PASO 0: REGLAS LFPIORPI (ANTES DE TODO)
        # ================================================================
        df_preocupantes, df_para_ml = aplicar_reglas_lfpiorpi(df, cfg)
        
        # ================================================================
        # PASOS 1-4: SOLO PARA df_para_ml (casos grises)
        # ================================================================
        if len(df_para_ml) > 0:
            # PASO 1: No supervisado
            # NOTE: To debug supervised-only behavior, set SKIP_NO_SUPERVISED=1 in env and the
            # no_supervisado step will be skipped. This helps isolate supervised+refuerzo behavior.
            skip_no_supervised = os.getenv("SKIP_NO_SUPERVISED", "0").lower() in ("1", "true", "yes")
            if skip_no_supervised:
                log("\n  ⚠️ SKIPPING Paso 1: Modelo no supervisado (SKIP_NO_SUPERVISED=1)")
            else:
                log("\n  🔬 Paso 1: Modelo no supervisado...")
                bundle_ns = cargar_modelo_no_supervisado()
                if bundle_ns:
                    df_para_ml = aplicar_no_supervisado(df_para_ml, bundle_ns)

            # PASO 2: Supervisado (2 clases)
            log("\n  🤖 Paso 2: Modelo supervisado...")
            model, scaler, feature_cols, classes = cargar_modelo_supervisado()
            df_para_ml = aplicar_supervisado(df_para_ml, model, scaler, feature_cols, classes)

            # PASO 3: EBR
            log("\n  📊 Paso 3: Cálculo EBR...")
            df_para_ml = aplicar_ebr(df_para_ml, cfg)

            # PASO 4: Fusión ML + EBR
            log("\n  🔀 Paso 4: Fusión ML + EBR...")
            df_para_ml = aplicar_fusion(df_para_ml, cfg)
        
        # ================================================================
        # PASO 5: UNIR RESULTADOS
        # ================================================================
        log("\n  📦 Paso 5: Uniendo resultados...")
        
        # Asegurar columnas consistentes
        all_cols = set(df_preocupantes.columns) | set(df_para_ml.columns) if len(df_para_ml) > 0 else set(df_preocupantes.columns)
        
        for col in all_cols:
            if col not in df_preocupantes.columns:
                df_preocupantes[col] = None
            if len(df_para_ml) > 0 and col not in df_para_ml.columns:
                df_para_ml[col] = None
        
        df_final = pd.concat([df_preocupantes, df_para_ml], ignore_index=True)
        
        # ================================================================
        # PASO 6: EXPLICACIONES
        # ================================================================
        log("\n  📝 Paso 6: Generando explicaciones...")
        explicaciones = []
        for _, row in df_final.iterrows():
            exp = generar_explicacion_simple(row.to_dict())
            explicaciones.append(exp)
        
        df_final["explicacion"] = [json.dumps(e, ensure_ascii=False) for e in explicaciones]
        
        # ================================================================
        # PASO 7: MODELO DE REFUERZO
        # ================================================================
        log("\n  🎯 Paso 7: Modelo de refuerzo...")
        rl_model = cargar_modelo_refuerzo()
        aplicar_refuerzo(df_final, rl_model, analysis_id)
        
        # ================================================================
        # GUARDAR RESULTADOS
        # ================================================================
        log("\n  💾 Guardando resultados...")
        
        # Distribución final
        dist_final = Counter(df_final["clasificacion_final"])
        log(f"\n  📊 DISTRIBUCIÓN FINAL:")
        log(f"     🔴 Preocupante: {dist_final.get('preocupante', 0)} ({dist_final.get('preocupante', 0)/len(df_final)*100:.1f}%)")
        log(f"     🟡 Inusual: {dist_final.get('inusual', 0)} ({dist_final.get('inusual', 0)/len(df_final)*100:.1f}%)")
        log(f"     🟢 Relevante: {dist_final.get('relevante', 0)} ({dist_final.get('relevante', 0)/len(df_final)*100:.1f}%)")
        
        # JSON de resultados
        transacciones = []
        for i, row in df_final.iterrows():
            tx = {
                "id": str(row.get("cliente_id", f"TXN-{i+1:05d}")),
                "monto": float(row.get("monto", 0) or 0),
                "monto_umas": mxn_a_umas(float(row.get("monto", 0) or 0)),
                "fecha": str(row.get("fecha", "")),
                "tipo_operacion": str(row.get("tipo_operacion", "")),
                "sector_actividad": str(row.get("sector_actividad", "")),
                "fraccion": str(row.get("fraccion", "")),
                "clasificacion": row.get("clasificacion_final"),
                "nivel_riesgo": row.get("nivel_riesgo_final"),
                "origen": row.get("origen"),
                "ica": float(row.get("ica", 0) or 0),
                "score_ebr": float(row.get("score_ebr", 0) or 0),
                "es_actividad_vulnerable": bool(row.get("es_actividad_vulnerable", False)),
                "anomaly_score_composite": float(row.get("anomaly_score_composite", 0) or 0),
                "is_outlier_iso": bool(row.get("is_outlier_iso", False)),
                "anomaly_score_iso": float(row.get("anomaly_score_iso", 0) or 0),
                "kmeans_dist": float(row.get("kmeans_dist", 0) or 0),
                "pca_recon_mse": float(row.get("pca_recon_mse", 0) or 0),
                "explicacion": explicaciones[i] if i < len(explicaciones) else {},
            }
            transacciones.append(tx)
        
        resultados = {
            "success": True,
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "version": "4.0.0",
            "resumen": {
                "total_transacciones": len(df_final),
                "preocupante": int(dist_final.get("preocupante", 0)),
                "inusual": int(dist_final.get("inusual", 0)),
                "relevante": int(dist_final.get("relevante", 0)),
                "actividades_vulnerables": int(df_final["es_actividad_vulnerable"].sum()),
                "guardrails_aplicados": int(len(df_preocupantes)),
            },
            "transacciones": transacciones,
        }
        
        # Guardar JSON
        json_path = PROCESSED_DIR / f"{analysis_id}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(resultados, f, indent=2, ensure_ascii=False)
        log(f"  ✅ JSON: {json_path.name}")
        
        # Guardar CSV procesado
        csv_out_path = PROCESSED_DIR / csv_path.name
        df_final.to_csv(csv_out_path, index=False, encoding="utf-8")
        log(f"  ✅ CSV: {csv_out_path.name}")
        
        # Eliminar archivo pending
        csv_path.unlink()
        
        log(f"\n{'='*70}")
        log(f"✅ COMPLETADO: {analysis_id}")
        log(f"{'='*70}\n")
        
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
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        
        return False


# ============================================================================
# MAIN
# ============================================================================
def main():
    log(f"\n{'='*70}")
    log("🚀 ML RUNNER v4.0 - Reglas LFPIORPI + ML (2 clases)")
    log(f"{'='*70}")
    
    # Determinar archivos a procesar
    if len(sys.argv) > 1:
        analysis_id = sys.argv[1]
        csv_file = PENDING_DIR / f"{analysis_id}.csv"
        if not csv_file.exists():
            log(f"❌ Archivo no encontrado: {csv_file}")
            return 1
        files = [csv_file]
    else:
        files = list(PENDING_DIR.glob("*.csv"))
    
    if not files:
        log("ℹ️ No hay archivos pendientes")
        return 0
    
    log(f"📋 Archivos a procesar: {len(files)}")
    
    success = 0
    failed = 0
    
    for csv_path in files:
        if process_file(csv_path):
            success += 1
        else:
            failed += 1
    
    log(f"\n{'='*70}")
    log(f"📊 RESUMEN: ✅ {success} exitosos, ❌ {failed} fallidos")
    log(f"{'='*70}\n")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
