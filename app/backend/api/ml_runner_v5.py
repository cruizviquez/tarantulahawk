#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - VERSIÓN 5.0 FUSIONADA

Pipeline (actividad vulnerable / Art. 17 LFPIORPI):

0) PASO 0: Reglas LFPIORPI → PREOCUPANTE (guardrails 100%)
1) PASO 1: Índice EBR (solo reglas / comportamiento, sin depender de ML)
2) PASO 2: No supervisado (IsolationForest v2) → anomaly_score_iso
3) PASO 3: Supervisado v2 (2 clases: relevante / inusual)
4) PASO 4: Fusión:
    - Preocupante solo viene de reglas
    - Relevante / inusual vienen de ML + EBR + anomalías
5) PASO 5: Unir resultados
6) PASO 6: Explicaciones (build_explicacion de explicabilidad_transactions)

Interfaz CLI (compatibilidad con enhanced_main_api):

    python ml_runner.py <analysis_id>

Donde:
    pending CSV:   outputs/enriched/pending/<analysis_id>.csv
    processed CSV: outputs/enriched/processed/<analysis_id>.csv
    processed JSON:outputs/enriched/processed/<analysis_id>.json
"""

import os
import sys
import json
import shutil
import traceback
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Tuple, Optional
from collections import Counter

import numpy as np
import pandas as pd
import joblib

# Explicabilidad (usa la versión nueva/simplificada)
from explicabilidad_transactions import build_explicacion


# ============================================================================
# RUTAS Y UTILIDADES BÁSICAS
# ============================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
PENDING_DIR = BASE_DIR / "outputs" / "enriched" / "pending"
PROCESSED_DIR = BASE_DIR / "outputs" / "enriched" / "processed"
FAILED_DIR = BASE_DIR / "outputs" / "enriched" / "failed"
MODELS_DIR = BASE_DIR / "outputs"
CONFIG_PATH = BASE_DIR / "models" / "config_modelos.json"

for d in (PENDING_DIR, PROCESSED_DIR, FAILED_DIR):
    d.mkdir(parents=True, exist_ok=True)


def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def cargar_config() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"No se encontró config_modelos: {CONFIG_PATH}")
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================================
# LFPIORPI / UMA / UMBRALES
# ============================================================================

def get_uma_mxn(cfg: Dict[str, Any]) -> float:
    return float(cfg["lfpiorpi"]["uma_mxn"])


def mxn_a_umas(monto_mxn: float, cfg: Dict[str, Any]) -> float:
    uma = get_uma_mxn(cfg)
    if uma <= 0:
        return 0.0
    return float(monto_mxn) / uma


def obtener_umbrales_fraccion(fraccion: str, cfg: Dict[str, Any]) -> Dict[str, Any]:
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})
    if fraccion in umbrales:
        return umbrales[fraccion]
    if "servicios_generales" in umbrales:
        return umbrales["servicios_generales"]
    # fallback súper simple
    return {
        "identificacion_UMA": 0,
        "aviso_UMA": 0,
        "efectivo_max_UMA": 0,
        "es_actividad_vulnerable": False,
        "descripcion": "Desconocido",
    }


def es_actividad_vulnerable(fraccion: str, cfg: Dict[str, Any]) -> bool:
    u = obtener_umbrales_fraccion(fraccion, cfg)
    return bool(u.get("es_actividad_vulnerable", False))


def evaluar_reglas_lfpiorpi(row: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evalúa reglas LFPIORPI básicas para una operación:
    - Monto >= aviso_UMA
    - Efectivo >= efectivo_max_UMA
    - Acumulado 6m >= aviso_UMA
    """
    fraccion = str(row.get("fraccion", "servicios_generales"))
    um = obtener_umbrales_fraccion(fraccion, cfg)
    uma_mxn = get_uma_mxn(cfg)

    aviso_UMA = float(um.get("aviso_UMA", 0.0))
    if aviso_UMA <= 0:
        aviso_UMA = 0.0
    aviso_mxn = aviso_UMA * uma_mxn

    efectivo_max_UMA = float(um.get("efectivo_max_UMA", 0.0))
    if efectivo_max_UMA <= 0:
        efectivo_max_UMA = aviso_UMA
    efectivo_mxn = efectivo_max_UMA * uma_mxn

    monto = float(row.get("monto", 0.0) or 0.0)
    monto_6m = float(row.get("monto_6m", 0.0) or 0.0)
    es_efectivo = str(row.get("EsEfectivo", 0)).lower() in ("1", "true", "si", "sí")

    cond_monto = aviso_mxn > 0 and monto >= aviso_mxn
    cond_efectivo = efectivo_mxn > 0 and es_efectivo and monto >= efectivo_mxn
    cond_acumulado = aviso_mxn > 0 and monto_6m >= aviso_mxn

    activa_guardrail = bool(cond_monto or cond_efectivo or cond_acumulado)

    razon = None
    if cond_monto:
        razon = f"Monto >= umbral de aviso ({aviso_UMA:.0f} UMA)"
    elif cond_efectivo:
        razon = f"Efectivo >= umbral permitido ({efectivo_max_UMA:.0f} UMA)"
    elif cond_acumulado:
        razon = f"Acumulado 6m >= umbral de aviso ({aviso_UMA:.0f} UMA)"

    fundamento = (
        f"Actividad vulnerable {fraccion} - Art. 17 LFPIORPI"
        if es_actividad_vulnerable(fraccion, cfg)
        else "Fuera del catálogo de actividades vulnerables (servicios generales)"
    )

    return {
        "activa_guardrail": activa_guardrail,
        "razon": razon or "No se activa guardrail",
        "fundamento_legal": fundamento,
        "es_actividad_vulnerable": es_actividad_vulnerable(fraccion, cfg),
    }


def aplicar_reglas_lfpiorpi(
    df: pd.DataFrame, cfg: Dict[str, Any]
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    PASO 0: Separa PREOCUPANTES (guardrails LFPIORPI) del resto (para ML).
    """
    log("\n  ⚖️ Paso 0: Aplicando reglas LFPIORPI...")
    if df.empty:
        return df.copy(), df.copy()

    resultados = [evaluar_reglas_lfpiorpi(row.to_dict(), cfg) for _, row in df.iterrows()]
    df = df.copy()
    df["guardrail_activo"] = [r["activa_guardrail"] for r in resultados]
    df["guardrail_razon"] = [r["razon"] for r in resultados]
    df["guardrail_fundamento"] = [r["fundamento_legal"] for r in resultados]
    df["es_actividad_vulnerable"] = [r["es_actividad_vulnerable"] for r in resultados]

    df_pre = df[df["guardrail_activo"] == True].copy()
    df_ml = df[df["guardrail_activo"] != True].copy()

    # Etiquetar preocupantes
    if not df_pre.empty:
        df_pre["clasificacion_final"] = "preocupante"
        df_pre["nivel_riesgo_final"] = "alto"
        df_pre["origen"] = "regla_lfpiorpi"
        df_pre["ica"] = 1.0
        log(f"  ✅ Guardrails: {len(df_pre)} PREOCUPANTES")

    return df_pre, df_ml


# ============================================================================
# EBR (ÍNDICE DE RIESGO) - SOLO REGLAS / COMPORTAMIENTO
# ============================================================================

def _get_int(row: Dict[str, Any], col: str, default: int = 0) -> int:
    val = row.get(col, default)
    try:
        if pd.isna(val):
            return default
    except Exception:
        pass
    if isinstance(val, str):
        v = val.strip().lower()
        if v in ("true", "sí", "si", "1"):
            return 1
        if v in ("false", "0", ""):
            return 0
    try:
        return int(val)
    except Exception:
        try:
            return int(float(val))
        except Exception:
            return default


def _get_num(row: Dict[str, Any], col: str, default: float = 0.0) -> float:
    val = row.get(col, default)
    try:
        if pd.isna(val):
            return default
    except Exception:
        pass
    try:
        return float(val)
    except Exception:
        return default


def calcular_indice_ebr_row(
    row: Dict[str, Any],
    cfg: Dict[str, Any]
) -> Tuple[float, List[str]]:
    """
    Calcula el índice EBR y devuelve (score_ebr, factores_ebr).
    Score entre 0 y 100.
    Usa cfg["ebr"]["ponderaciones"].
    """
    ponder = cfg.get("ebr", {}).get("ponderaciones", {})
    score = 0.0
    factores: List[str] = []

    def add_if(cond: bool, key: str):
        nonlocal score
        if not cond:
            return
        if key not in ponder:
            return
        pts = float(ponder[key].get("puntos", 0))
        score += pts
        desc = ponder[key].get("descripcion", key)
        factores.append(f"{desc} (+{int(pts)} pts)")

    # Flags y condiciones
    add_if(_get_int(row, "EsEfectivo") == 1, "efectivo")
    add_if(_get_int(row, "efectivo_alto") == 1, "efectivo_alto")
    add_if(_get_int(row, "SectorAltoRiesgo") == 1, "sector_alto_riesgo")

    monto_6m = _get_num(row, "monto_6m", 0.0)
    add_if(monto_6m >= 500000.0, "acumulado_alto")

    add_if(_get_int(row, "EsInternacional") == 1, "internacional")

    ratio = _get_num(row, "ratio_vs_promedio", 1.0)
    add_if(ratio > 3.0, "ratio_alto")

    ops_6m = _get_num(row, "ops_6m", 0.0)
    add_if(ops_6m > 5, "frecuencia_alta")

    add_if(_get_int(row, "posible_burst") == 1, "burst")
    add_if(_get_int(row, "es_nocturno") == 1, "nocturno")
    add_if(_get_int(row, "fin_de_semana") == 1, "fin_semana")
    add_if(_get_int(row, "es_monto_redondo") == 1, "monto_redondo")

    score = float(max(0.0, min(100.0, score)))
    return score, factores[:3]


def aplicar_ebr(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    """
    PASO 1: Aplica EBR sobre df_para_ml.
    """
    if df.empty:
        return df

    log("\n  📊 Paso 1: Cálculo EBR...")
    df = df.copy()

    scores = []
    factores_list = []
    for _, row in df.iterrows():
        s, f = calcular_indice_ebr_row(row.to_dict(), cfg)
        scores.append(s)
        factores_list.append(f)

    df["score_ebr"] = scores
    df["factores_ebr"] = factores_list

    umbrales = cfg.get("ebr", {}).get("umbrales_clasificacion", {})
    relevante_max = float(umbrales.get("relevante_max", 40))

    df["clasificacion_ebr"] = np.where(
        df["score_ebr"] <= relevante_max, "relevante", "inusual"
    )

    df["nivel_riesgo_ebr"] = np.where(
        df["score_ebr"] <= relevante_max, "bajo", "medio_alto"
    )

    log(
        f"  ✅ EBR: mean={np.mean(df['score_ebr']):.1f}, "
        f"relevante={int((df['clasificacion_ebr']=='relevante').sum())}, "
        f"inusual={int((df['clasificacion_ebr']=='inusual').sum())}"
    )
    return df


# ============================================================================
# NO SUPERVISADO (IsolationForest v2)
# ============================================================================

NO_SUP_FEATURES_BASE = [
    "monto",
    "monto_6m",
    "ops_6m",
    "monto_max_6m",
    "monto_std_6m",
    "ratio_vs_promedio",
    "frecuencia_mensual",
    "dia_semana",
    "mes",
]

NO_SUP_BINARY_FLAGS = [
    "EsEfectivo",
    "EsInternacional",
    "SectorAltoRiesgo",
    "efectivo_alto",
    "fin_de_semana",
    "es_nocturno",
    "es_monto_redondo",
    "posible_burst",
]


def build_features_no_supervisado(df: pd.DataFrame) -> pd.DataFrame:
    cols: List[str] = []
    for c in NO_SUP_FEATURES_BASE + NO_SUP_BINARY_FLAGS:
        if c not in df.columns:
            df[c] = 0
        cols.append(c)

    X = df[cols].copy()
    for c in cols:
        X[c] = pd.to_numeric(X[c], errors="coerce").fillna(0.0)
    return X


def cargar_modelo_no_supervisado() -> Optional[Dict[str, Any]]:
    """
    Carga modelo no supervisado bundle.
    """
    possible = [
        "no_supervisado_bundle_v2.pkl",
        "no_supervisado_bundle.pkl",
        "modelo_no_supervisado_th.pkl",
        "modelo_no_supervisado.pkl",
    ]
    for name in possible:
        path = MODELS_DIR / name
        if path.exists():
            try:
                bundle = joblib.load(path)
                log(f"  ✅ No supervisado cargado: {name}")
                return bundle
            except Exception as e:
                log(f"  ⚠️ Error cargando {name}: {e}")
    log("  ⚠️ No se encontró modelo no supervisado, se usará IsolationForest ad-hoc")
    return None


def aplicar_no_supervisado(
    df: pd.DataFrame,
    bundle: Optional[Dict[str, Any]],
    cfg: Dict[str, Any],
    skip: bool = False,
) -> pd.DataFrame:
    if df.empty:
        df["anomaly_score_iso"] = 0.0
        df["is_outlier_iso"] = 0
        df["anomaly_score_composite"] = 0.0
        df["kmeans_dist"] = 0.0
        return df

    if skip:
        log("  ⚠️ SKIP_NO_SUPERVISED=1 → saltando modelo no supervisado")
        df = df.copy()
        df["anomaly_score_iso"] = 0.0
        df["is_outlier_iso"] = 0
        df["anomaly_score_composite"] = 0.0
        df["kmeans_dist"] = 0.0
        return df

    log("\n  🔍 Paso 2: Modelo no supervisado (IsolationForest)...")
    df = df.copy()
    X = build_features_no_supervisado(df)
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    if bundle is not None:
        iso = bundle.get("model")
        scaler = bundle.get("scaler")
        cols = bundle.get("columns", list(X.columns))
    else:
        iso = None
        scaler = None
        cols = list(X.columns)

    # Ajustar columnas a las del bundle si las hay
    X = X.reindex(columns=cols, fill_value=0.0)

    if scaler is None:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X.values)
    else:
        X_scaled = scaler.transform(X.values)

    if iso is None:
        contamination = float(cfg.get("no_supervisado", {}).get("contamination", 0.03))
        iso = IsolationForest(
            n_estimators=200,
            contamination=contamination,
            random_state=42,
        )
        iso.fit(X_scaled)

    scores_raw = -iso.decision_function(X_scaled)  # mayor = más anómalo
    if scores_raw.max() > scores_raw.min():
        scores_norm = (scores_raw - scores_raw.min()) / (scores_raw.max() - scores_raw.min())
    else:
        scores_norm = np.zeros_like(scores_raw)

    contamination = float(cfg.get("no_supervisado", {}).get("contamination", 0.03))
    threshold = np.quantile(scores_norm, 1 - contamination)
    is_outlier = (scores_norm >= threshold).astype(int)

    df["anomaly_score_iso"] = scores_norm
    df["is_outlier_iso"] = is_outlier
    # no tenemos kmeans aquí; lo dejamos en 0
    df["kmeans_dist"] = 0.0
    df["anomaly_score_composite"] = scores_norm

    log(
        f"  ✅ No supervisado: outliers={int(is_outlier.sum())} "
        f"({is_outlier.mean()*100:.2f}%)"
    )
    return df


# ============================================================================
# SUPERVISADO v2
# ============================================================================

COLUMNS_DROP_SUP = [
    "score_ebr",
    "factores_ebr",
    "clasificacion_ebr",
    "nivel_riesgo_ebr",
    "clasificacion_final",
    "nivel_riesgo_final",
    "clasificacion_lfpiorpi",
    "guardrail_activo",
    "guardrail_razon",
    "guardrail_fundamento",
    "ica",
]

CAT_COLS_SUP = ["tipo_operacion", "sector_actividad", "fraccion"]

NUM_COLS_SUP_EXTRA = [
    "monto",
    "monto_6m",
    "ops_6m",
    "monto_max_6m",
    "monto_std_6m",
    "ratio_vs_promedio",
    "frecuencia_mensual",
    "dia_semana",
    "mes",
    "EsEfectivo",
    "EsInternacional",
    "SectorAltoRiesgo",
    "efectivo_alto",
    "fin_de_semana",
    "es_nocturno",
    "es_monto_redondo",
    "posible_burst",
    "anomaly_score_iso",
    "anomaly_score_composite",
    "is_outlier_iso",
]


def build_features_supervisado(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    for c in COLUMNS_DROP_SUP:
        if c in df.columns:
            df = df.drop(columns=[c])

    for cat in CAT_COLS_SUP:
        if cat not in df.columns:
            df[cat] = "desconocido"
        df[cat] = df[cat].astype(str).str.strip().str.lower()

    for c in NUM_COLS_SUP_EXTRA:
        if c not in df.columns:
            df[c] = 0.0
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

    df_enc = pd.get_dummies(df, columns=CAT_COLS_SUP, drop_first=False, dtype=float)

    for c in df_enc.columns:
        if df_enc[c].dtype == bool:
            df_enc[c] = df_enc[c].astype(int)
        elif df_enc[c].dtype == object:
            df_enc[c] = df_enc[c].astype(str).apply(
                lambda x: 0 if x in ("", "nan", "none", "null") else 1
            )

    return df_enc


def cargar_modelo_supervisado() -> Tuple[Optional[Any], Optional[Any], List[str], List[str]]:
    """
    Carga modelo supervisado binario v2.
    """
    posibles = [
        "modelo_ensemble_stack_v2.pkl",
        "modelo_ensemble_stack.pkl",
        "modelo_supervisado.pkl",
    ]
    bundle = None
    for name in posibles:
        path = MODELS_DIR / name
        if path.exists():
            try:
                bundle = joblib.load(path)
                log(f"  ✅ Supervisado cargado: {name}")
                break
            except Exception as e:
                log(f"  ⚠️ Error cargando supervisado {name}: {e}")
    if bundle is None:
        log("  ⚠️ No se encontró modelo supervisado, se usará fallback (todo relevante)")
        return None, None, [], []

    model = bundle.get("model")
    scaler = bundle.get("scaler")
    feature_cols = bundle.get("feature_columns") or bundle.get("columns") or []
    classes = list(bundle.get("classes_") or bundle.get("classes", ["relevante", "inusual"]))

    if model is None:
        raise ValueError("Bundle supervisado no contiene 'model'")

    log(f"  📋 Supervisado: {len(feature_cols)} features, clases={classes}")
    return model, scaler, feature_cols, classes


def aplicar_supervisado(
    df: pd.DataFrame,
    model: Optional[Any],
    scaler: Optional[Any],
    feature_cols: List[str],
    classes: List[str],
) -> pd.DataFrame:
    if df.empty:
        df["clasificacion_ml"] = "relevante"
        df["prob_inusual"] = 0.0
        df["prob_relevante"] = 1.0
        df["ica"] = 1.0
        return df

    df = df.copy()

    if model is None or not feature_cols:
        log("  ⚠️ Sin modelo supervisado → todo RELEVANTE (fallback)")
        df["clasificacion_ml"] = "relevante"
        df["prob_inusual"] = 0.0
        df["prob_relevante"] = 1.0
        df["ica"] = 1.0
        return df

    log("\n  🤖 Paso 3: Modelo supervisado...")
    X = build_features_supervisado(df)

    # Forzar orden de columnas del modelo
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0.0
    X = X.reindex(columns=feature_cols, fill_value=0.0)
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    if scaler is not None:
        X_scaled = scaler.transform(X.values)
    else:
        X_scaled = X.values

    proba = model.predict_proba(X_scaled)
    # mapear clases
    prob_inu = np.zeros(len(df))
    prob_rel = np.zeros(len(df))
    for i, cls in enumerate(classes):
        s = str(cls).lower()
        if s.startswith("inu"):
            prob_inu = proba[:, i]
        else:
            prob_rel = proba[:, i]

    df["prob_inusual"] = prob_inu
    df["prob_relevante"] = prob_rel
    df["clasificacion_ml"] = np.where(prob_inu >= prob_rel, "inusual", "relevante")
    df["ica"] = np.maximum(prob_inu, prob_rel)

    return df


# ============================================================================
# REFUERZO (UMBRAL EBR)
# ============================================================================

def cargar_threshold_refuerzo(cfg: Dict[str, Any]) -> int:
    posibles = ["refuerzo_bundle_v2.pkl", "refuerzo_bundle.pkl"]
    best = None
    for name in posibles:
        path = MODELS_DIR / name
        if path.exists():
            try:
                bundle = joblib.load(path)
                log(f"  ✅ Refuerzo cargado: {name}")
                best = bundle
                break
            except Exception as e:
                log(f"  ⚠️ Error cargando refuerzo {name}: {e}")

    if best and "optimal_threshold" in best:
        return int(best["optimal_threshold"])

    # fallback a config
    ebr_cfg = cfg.get("ebr", {})
    thr = int(ebr_cfg.get("elevacion_inusual_threshold", 50))
    log(f"  ⚠️ Sin modelo refuerzo → usando umbral EBR {thr}")
    return thr


# ============================================================================
# FUSIÓN ML + EBR + NO SUPERVISADO
# ============================================================================

def fusionar_ml_ebr_anomalias(
    df: pd.DataFrame,
    umbral_ebr: int,
) -> pd.DataFrame:
    if df.empty:
        return df

    df = df.copy()

    clasificaciones = []
    niveles = []
    origenes = []
    motivos = []

    for _, row in df.iterrows():
        cls_ml = row.get("clasificacion_ml", "relevante")
        score_ebr = float(row.get("score_ebr", 0.0) or 0.0)
        cls_ebr = row.get("clasificacion_ebr", "relevante")
        is_outlier = int(row.get("is_outlier_iso", 0) or 0)

        final_cls = cls_ml
        final_nivel = "bajo"
        origen = "ml"
        motivo = None

        # Base por ML
        if cls_ml == "inusual":
            final_nivel = "medio"
            origen = "ml"
            motivo = "ml_inusual"

        # Elevación por EBR (si ML dijo relevante)
        if cls_ml == "relevante" and score_ebr >= umbral_ebr:
            final_cls = "inusual"
            final_nivel = "medio"
            origen = "elevacion_ebr"
            motivo = f"EBR {score_ebr:.1f} >= {umbral_ebr}"

        # Elevación por anomalía (no supervisado) si sigue relevante
        if final_cls == "relevante" and is_outlier == 1:
            final_cls = "inusual"
            final_nivel = "medio"
            origen = "anomalia_no_supervisado"
            motivo = "anomalia_no_supervisado"

        clasificaciones.append(final_cls)
        niveles.append(final_nivel)
        origenes.append(origen)
        motivos.append(motivo)

    df["clasificacion_final"] = clasificaciones
    df["nivel_riesgo_final"] = niveles
    df["origen"] = origenes
    df["motivo_fusion"] = motivos

    dist = Counter(clasificaciones)
    elev_ebr = sum(1 for o in origenes if o == "elevacion_ebr")
    elev_anom = sum(1 for o in origenes if o == "anomalia_no_supervisado")
    log(f"  ✅ Fusión: {dict(dist)}")
    log(f"     Elevados por EBR: {elev_ebr}")
    log(f"     Elevados por anomalía: {elev_anom}")

    return df


# ============================================================================
# EXPLICACIONES (wrapper a build_explicacion)
# ============================================================================

def generar_explicacion_simple(row: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Wrapper para mantener nombre antiguo pero usar build_explicacion.
    """
    return build_explicacion(row, cfg=cfg)


# ============================================================================
# PROCESO PRINCIPAL POR ARCHIVO
# ============================================================================

def process_file(csv_path: Path) -> bool:
    analysis_id = csv_path.stem

    log("\n" + "=" * 70)
    log(f"📄 Procesando: {csv_path.name}")
    log("=" * 70)

    try:
        df = pd.read_csv(csv_path)
        # If pipeline invoked with an explicit fraccion env var, enforce it
        env_fraccion = os.environ.get("FRACCION_LFPIORPI") or os.environ.get("FRACCION_LFPI")
        if env_fraccion:
            log(f"  🔁 Forzando fraccion desde env: {env_fraccion}")
            df["fraccion"] = env_fraccion
        cfg = cargar_config()
        log(f"  📊 Cargado: {len(df)} transacciones")

        # Cargar modelos
        log("\n  📦 Cargando modelos...")
        model_sup, scaler_sup, feature_cols_sup, classes = cargar_modelo_supervisado()
        bundle_no_sup = cargar_modelo_no_supervisado()
        umbral_ebr = cargar_threshold_refuerzo(cfg)
        log(f"  📈 Umbral EBR (refuerzo/config): {umbral_ebr}")

        # PASO 0: Reglas LFPIORPI
        df_preocupantes, df_para_ml = aplicar_reglas_lfpiorpi(df, cfg)

        # Si no hay nada para ML, solo preocupantes
        if df_para_ml.empty:
            log("  ⚠️ Sin operaciones para ML (solo PREOCUPANTES)")
            df_final = df_preocupantes.copy()
        else:
            # PASO 1: EBR
            df_para_ml = aplicar_ebr(df_para_ml, cfg)

            # PASO 2: No supervisado
            skip_no_sup = (
                os.environ.get("SKIP_NO_SUPERVISED", "").lower()
                in ("1", "true", "yes")
            )
            df_para_ml = aplicar_no_supervisado(df_para_ml, bundle_no_sup, cfg, skip=skip_no_sup)

            # PASO 3: Supervisado
            df_para_ml = aplicar_supervisado(
                df_para_ml, model_sup, scaler_sup, feature_cols_sup, classes
            )

            # PASO 4: Fusión
            log("\n  🔀 Paso 4: Fusión ML + EBR + No supervisado...")
            df_para_ml = fusionar_ml_ebr_anomalias(df_para_ml, umbral_ebr)

            # PASO 5: Unir
            log("\n  📦 Paso 5: Uniendo resultados...")
            all_cols = set(df_preocupantes.columns) | set(df_para_ml.columns)
            for col in all_cols:
                if col not in df_preocupantes.columns:
                    df_preocupantes[col] = None
                if col not in df_para_ml.columns:
                    df_para_ml[col] = None

            df_final = pd.concat([df_preocupantes, df_para_ml], ignore_index=True)

        # PASO 6: Explicaciones
        log("\n  📝 Paso 6: Generando explicaciones...")
        explicaciones: List[Dict[str, Any]] = []
        for _, row in df_final.iterrows():
            exp = generar_explicacion_simple(row.to_dict(), cfg)
            explicaciones.append(exp)
        df_final["explicacion"] = [json.dumps(e, ensure_ascii=False) for e in explicaciones]

        # Distribución final
        dist_final = Counter(df_final["clasificacion_final"])
        total = len(df_final)

        log("\n  📊 DISTRIBUCIÓN FINAL:")
        log(
            f"     🔴 Preocupante: {dist_final.get('preocupante', 0)} "
            f"({dist_final.get('preocupante', 0)/total*100:.1f}%)"
        )
        log(
            f"     🟡 Inusual: {dist_final.get('inusual', 0)} "
            f"({dist_final.get('inusual', 0)/total*100:.1f}%)"
        )
        log(
            f"     🟢 Relevante: {dist_final.get('relevante', 0)} "
            f"({dist_final.get('relevante', 0)/total*100:.1f}%)"
        )

        # Guardar CSV
        csv_out_path = PROCESSED_DIR / csv_path.name
        df_final.to_csv(csv_out_path, index=False, encoding="utf-8")
        log(f"\n  ✅ CSV: {csv_out_path.name}")

        # Construir JSON de resultados (compatible con frontend actual)
        cfg_local = cfg  # alias
        uma = get_uma_mxn(cfg_local)

        transacciones = []
        for i, row in df_final.iterrows():
            row_dict = row.to_dict()

            # Probabilidades
            prob_inu = float(row_dict.get("prob_inusual", 0) or 0)
            prob_rel = float(row_dict.get("prob_relevante", 0) or 0)
            probabilidades = {
                "inusual": round(prob_inu, 4),
                "relevante": round(prob_rel, 4),
            }

            factores_ebr = row_dict.get("factores_ebr", [])
            if isinstance(factores_ebr, str):
                try:
                    factores_ebr = json.loads(factores_ebr)
                except Exception:
                    factores_ebr = []

            try:
                exp_parsed = json.loads(row_dict.get("explicacion", "{}") or "{}")
            except Exception:
                exp_parsed = {}

            tx = {
                "id": str(row_dict.get("cliente_id", f"TXN-{i+1:05d}")),
                "monto": float(row_dict.get("monto", 0) or 0),
                "monto_umas": round(
                    mxn_a_umas(float(row_dict.get("monto", 0) or 0), cfg_local), 2
                ),
                "fecha": str(row_dict.get("fecha", "")),
                "tipo_operacion": str(row_dict.get("tipo_operacion", "")),
                "sector_actividad": str(row_dict.get("sector_actividad", "")),
                "fraccion": str(row_dict.get("fraccion", "")),
                "clasificacion": row_dict.get("clasificacion_final"),
                "nivel_riesgo": row_dict.get("nivel_riesgo_final"),
                "origen": row_dict.get("origen"),
                "ica": round(float(row_dict.get("ica", 0) or 0), 4),
                "score_ebr": round(float(row_dict.get("score_ebr", 0) or 0), 1),
                "probabilidades": probabilidades,
                "factores_ebr": factores_ebr if isinstance(factores_ebr, list) else [],
                "motivo_fusion": row_dict.get("motivo_fusion"),
                "anomaly": {
                    "score_iso": round(float(row_dict.get("anomaly_score_iso", 0) or 0), 4),
                    "is_outlier": int(row_dict.get("is_outlier_iso", 0) or 0),
                    "kmeans_dist": round(float(row_dict.get("kmeans_dist", 0) or 0), 4),
                    "score_composite": round(
                        float(row_dict.get("anomaly_score_composite", 0) or 0), 4
                    ),
                },
                "features": {
                    "EsEfectivo": int(row_dict.get("EsEfectivo", 0) or 0),
                    "efectivo_alto": int(row_dict.get("efectivo_alto", 0) or 0),
                    "EsInternacional": int(row_dict.get("EsInternacional", 0) or 0),
                    "SectorAltoRiesgo": int(row_dict.get("SectorAltoRiesgo", 0) or 0),
                    "fin_de_semana": int(row_dict.get("fin_de_semana", 0) or 0),
                    "es_nocturno": int(row_dict.get("es_nocturno", 0) or 0),
                    "es_monto_redondo": int(row_dict.get("es_monto_redondo", 0) or 0),
                    "posible_burst": int(row_dict.get("posible_burst", 0) or 0),
                    "monto_6m": float(row_dict.get("monto_6m", 0) or 0),
                    "ops_6m": float(row_dict.get("ops_6m", 0) or 0),
                    "ratio_vs_promedio": float(row_dict.get("ratio_vs_promedio", 0) or 0),
                    "frecuencia_mensual": float(
                        row_dict.get("frecuencia_mensual", 0) or 0
                    ),
                    "anomaly_score_iso": float(
                        row_dict.get("anomaly_score_iso", 0) or 0
                    ),
                },
                "umbrales": obtener_umbrales_fraccion(
                    str(row_dict.get("fraccion", "servicios_generales")), cfg_local
                ),
                "explicacion": exp_parsed,
            }
            transacciones.append(tx)

        resultados = {
            "success": True,
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "version": "5.0.0",
            "resumen": {
                "total_transacciones": total,
                "preocupante": int(dist_final.get("preocupante", 0)),
                "inusual": int(dist_final.get("inusual", 0)),
                "relevante": int(dist_final.get("relevante", 0)),
                "guardrails_aplicados": int(len(df_preocupantes)),
                "elevados_por_ebr": int(
                    sum(1 for o in df_final.get("origen", []) if o == "elevacion_ebr")
                ),
                "elevados_por_anomalia": int(
                    sum(1 for o in df_final.get("origen", []) if o == "anomalia_no_supervisado")
                ),
            },
            "transacciones": transacciones,
        }

        json_path = PROCESSED_DIR / f"{analysis_id}.json"
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(resultados, f, indent=2, ensure_ascii=False)
        log(f"  ✅ JSON: {json_path.name}")

        # Eliminar archivo pending
        csv_path.unlink()
        log("\n" + "=" * 70)
        log(f"✅ COMPLETADO: {analysis_id}")
        log("=" * 70 + "\n")

        return True

    except Exception as e:
        log(f"❌ ERROR procesando {csv_path.name}: {e}")
        traceback.print_exc()

        # Mover a FAILED_DIR
        failed_path = FAILED_DIR / csv_path.name
        shutil.move(str(csv_path), str(failed_path))
        log(f"  ⚠️ Archivo movido a FAILED: {failed_path}")
        return False


# ============================================================================
# MAIN (CLI)
# ============================================================================

def main() -> int:
    log("=" * 70)
    log("🚀 ML RUNNER v5.0 - Reglas + EBR + NoSup + Sup + Explicaciones")
    log("=" * 70)

    # Modo compatible con enhanced_main_api: ml_runner.py <analysis_id>
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        analysis_id = sys.argv[1]
        csv_file = PENDING_DIR / f"{analysis_id}.csv"
        if not csv_file.exists():
            log(f"❌ Archivo no encontrado: {csv_file}")
            return 1
        files = [csv_file]
    else:
        # Procesar todos los pending
        files = sorted(PENDING_DIR.glob("*.csv"))
        if not files:
            log(f"⚠️ No hay archivos en {PENDING_DIR}")
            return 0

    log(f"📋 Archivos a procesar: {len(files)}")

    success = 0
    for f in files:
        if process_file(f):
            success += 1

    failed = len(files) - success
    log("\n" + "=" * 70)
    log(f"📊 RESUMEN: ✅ {success}, ❌ {failed}")
    log("=" * 70 + "\n")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
