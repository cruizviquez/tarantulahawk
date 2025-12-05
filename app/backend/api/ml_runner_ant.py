#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - VERSIÓN 4.1 CORREGIDA

CORRECCIONES vs v4.0:
1. Calcula efectivo_alto correctamente (>=75% del umbral de efectivo)
2. Alinea fracciones entre validador y modelo
3. EBR incluye efectivo_alto con peso alto (+20 pts)
4. Threshold de elevación EBR→inusual = 50 pts
5. Si EBR >= 50 y ML dice relevante → elevar a inusual

Pipeline:
1. PASO 0: Reglas LFPIORPI → PREOCUPANTE (100% certeza)
2. PASO 1: No supervisado → anomaly scores (opcional)
3. PASO 2: Supervisado (2 clases) → relevante/inusual
4. PASO 3: EBR → score de riesgo
5. PASO 4: Fusión → si EBR>=50 eleva a inusual
6. PASO 5: Unir resultados
7. PASO 6: Explicaciones
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
    print(f"[{ts}] {msg}", flush=True)


# ============================================================================
# CONFIGURACIÓN
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
# MAPEO DE FRACCIONES (normalizar nombres)
# ============================================================================
FRACCION_NORMALIZE = {
    # Mapeo de config → modelo
    "VI_joyeria_metales": "VI_joyeria",
    "VIII_vehiculos": "VIII_vehiculos",
    "V_inmuebles": "V_inmuebles",
    "V_bis_desarrollo_inmobiliario": "V_inmuebles",
    "XVI_activos_virtuales": "XVI_cripto",
    "XV_arrendamiento_inmuebles": "XV_arrendamiento",
    "X_traslado_valores": "X_traslado",
    "VII_obras_arte": "VII_arte",
    "I_juegos": "I_juegos",
    "II_tarjetas_servicios": "II_tarjetas",
    "II_tarjetas_prepago": "II_tarjetas",
    "IV_mutuo": "IV_mutuo",
    "servicios_generales": "servicios_generales",
    "_general": "servicios_generales",
}


def normalizar_fraccion_para_modelo(fraccion: str) -> str:
    """Normaliza nombre de fracción para que coincida con el modelo"""
    if fraccion in FRACCION_NORMALIZE:
        return FRACCION_NORMALIZE[fraccion]
    # Si ya está en formato corto, devolverlo
    if fraccion.startswith("fraccion_"):
        return fraccion.replace("fraccion_", "")
    return fraccion


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
    classes = list(bundle.get("classes", ["inusual", "relevante"]))
    
    if model is None:
        raise ValueError("Bundle no contiene 'model'")
    
    log(f"  📋 Supervisado: {len(feature_cols)} features, clases={classes}")
    return model, scaler, feature_cols, classes


def cargar_modelo_no_supervisado() -> Optional[Dict[str, Any]]:
    """Carga modelo no supervisado (Isolation Forest, KMeans, etc.)"""
    # Intentar varios nombres posibles
    possible_names = [
        "no_supervisado_bundle.pkl",
        "modelo_no_supervisado_th.pkl",
        "modelo_no_supervisado.pkl",
        "refuerzo_bundle.pkl"
    ]
    
    for name in possible_names:
        bundle_path = MODELS_DIR / name
        if bundle_path.exists():
            try:
                bundle = joblib.load(bundle_path)
                log(f"  ✅ No supervisado cargado: {name}")
                return bundle
            except Exception as e:
                log(f"  ⚠️ Error cargando {name}: {e}")
                continue
    
    log(f"  ⚠️ Modelo no supervisado no encontrado (continuando sin él)")
    return None


def cargar_modelo_refuerzo() -> Optional[Dict[str, Any]]:
    """Carga modelo de refuerzo (Q-Learning para optimización de thresholds)"""
    possible_names = [
        "modelo_refuerzo.pkl",
        "refuerzo_bundle.pkl"
    ]
    
    for name in possible_names:
        bundle_path = MODELS_DIR / name
        if bundle_path.exists():
            try:
                bundle = joblib.load(bundle_path)
                log(f"  ✅ Refuerzo cargado: {name}")
                return bundle
            except Exception as e:
                log(f"  ⚠️ Error cargando {name}: {e}")
                continue
    
    log(f"  ⚠️ Modelo refuerzo no encontrado (usando thresholds por defecto)")
    return None


# ============================================================================
# PASO 0: REGLAS LFPIORPI
# ============================================================================
def es_actividad_vulnerable(fraccion: str, cfg: Dict[str, Any]) -> bool:
    """Determina si una fracción es actividad vulnerable"""
    if not fraccion or fraccion.startswith("_"):
        return False
    NO_VULNERABLES = ["servicios_generales", "_general", "_no_vulnerable", "otro"]
    if fraccion.lower() in NO_VULNERABLES:
        return False
    
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})
    
    if fraccion in umbrales:
        u = umbrales[fraccion]
        if "es_actividad_vulnerable" in u:
            return bool(u["es_actividad_vulnerable"])
        aviso = float(u.get("aviso_UMA", 0))
        return aviso > 0 and aviso < 999999
    return False


def obtener_umbrales_fraccion(fraccion: str, cfg: Dict[str, Any]) -> Dict[str, float]:
    """Obtiene umbrales de aviso y efectivo para una fracción"""
    uma = get_uma_mxn()
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})
    
    u = umbrales.get(fraccion, umbrales.get("_general", {}))
    
    aviso_umas = float(u.get("aviso_UMA", 645))
    
    # CORRECCIÓN: Si efectivo_max_UMA es 0, usar aviso_UMA
    efectivo_umas = float(u.get("efectivo_max_UMA", 0))
    if efectivo_umas == 0:
        efectivo_umas = aviso_umas  # Usar mismo umbral que aviso
    
    return {
        "aviso_umas": aviso_umas,
        "aviso_mxn": aviso_umas * uma,
        "efectivo_umas": efectivo_umas,
        "efectivo_mxn": efectivo_umas * uma,
    }


def evaluar_reglas_lfpiorpi(row: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Evalúa si una transacción activa guardrails LFPIORPI"""
    uma = get_uma_mxn()
    fraccion = str(row.get("fraccion", "servicios_generales"))
    monto = float(row.get("monto", 0) or 0)
    monto_6m = float(row.get("monto_6m", 0) or 0)
    es_efectivo = row.get("EsEfectivo") in (1, True, "1", "true")
    
    resultado = {
        "activa_guardrail": False,
        "clasificacion": None,
        "razon": None,
        "fundamento_legal": None,
        "es_actividad_vulnerable": False,
    }
    
    if not es_actividad_vulnerable(fraccion, cfg):
        return resultado
    
    resultado["es_actividad_vulnerable"] = True
    umbrales = obtener_umbrales_fraccion(fraccion, cfg)
    umbral_aviso_mxn = umbrales["aviso_mxn"]
    umbral_efectivo_mxn = umbrales["efectivo_mxn"]
    
    # Extraer número de fracción
    fraccion_num = fraccion.split("_")[0] if "_" in fraccion else fraccion
    
    # REGLA 1: Monto >= umbral de aviso
    if monto >= umbral_aviso_mxn:
        monto_umas = monto / uma
        resultado["activa_guardrail"] = True
        resultado["clasificacion"] = "preocupante"
        resultado["razon"] = f"Monto {monto:,.0f} MXN ({monto_umas:,.0f} UMAs) rebasa umbral de aviso {umbrales['aviso_umas']:,.0f} UMAs"
        resultado["fundamento_legal"] = f"Artículo 17, Fracción {fraccion_num} LFPIORPI. Umbral: {umbrales['aviso_umas']:,.0f} UMAs ({umbral_aviso_mxn:,.0f} MXN)."
        return resultado
    
    # REGLA 2: Efectivo >= límite
    if es_efectivo and umbral_efectivo_mxn > 0 and monto >= umbral_efectivo_mxn:
        monto_umas = monto / uma
        resultado["activa_guardrail"] = True
        resultado["clasificacion"] = "preocupante"
        resultado["razon"] = f"Efectivo {monto:,.0f} MXN rebasa límite {umbrales['efectivo_umas']:,.0f} UMAs"
        resultado["fundamento_legal"] = f"Artículo 17 y 18 LFPIORPI. Límite efectivo: {umbrales['efectivo_umas']:,.0f} UMAs."
        return resultado
    
    # REGLA 3: Acumulado 6m >= umbral
    if monto_6m >= umbral_aviso_mxn:
        monto_6m_umas = monto_6m / uma
        resultado["activa_guardrail"] = True
        resultado["clasificacion"] = "preocupante"
        resultado["razon"] = f"Acumulado 6 meses {monto_6m:,.0f} MXN ({monto_6m_umas:,.0f} UMAs) rebasa umbral {umbrales['aviso_umas']:,.0f} UMAs"
        resultado["fundamento_legal"] = f"Artículo 17, Fracción {fraccion_num} LFPIORPI. Operaciones acumuladas rebasan umbral."
        return resultado
    
    return resultado


def aplicar_reglas_lfpiorpi(df: pd.DataFrame, cfg: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """PASO 0: Separa preocupantes por reglas LFPIORPI"""
    log("\n  ⚖️ Paso 0: Aplicando reglas LFPIORPI...")
    
    resultados = []
    for _, row in df.iterrows():
        res = evaluar_reglas_lfpiorpi(row.to_dict(), cfg)
        resultados.append(res)
    
    df = df.copy()
    df["guardrail_activo"] = [r["activa_guardrail"] for r in resultados]
    df["guardrail_razon"] = [r["razon"] for r in resultados]
    df["guardrail_fundamento"] = [r["fundamento_legal"] for r in resultados]
    df["es_actividad_vulnerable"] = [r["es_actividad_vulnerable"] for r in resultados]
    
    mask_guardrail = df["guardrail_activo"] == True
    df_preocupantes = df[mask_guardrail].copy()
    df_para_ml = df[~mask_guardrail].copy()
    
    if len(df_preocupantes) > 0:
        df_preocupantes["clasificacion_final"] = "preocupante"
        df_preocupantes["nivel_riesgo_final"] = "alto"
        df_preocupantes["origen"] = "regla_lfpiorpi"
        df_preocupantes["clasificacion_ml"] = None
        df_preocupantes["ica"] = 1.0
        df_preocupantes["score_ebr"] = 100.0
    
    log(f"  🔴 PREOCUPANTES (regla LFPIORPI): {len(df_preocupantes)}")
    log(f"  ➡️ Pasan a ML: {len(df_para_ml)}")
    
    return df_preocupantes, df_para_ml


# ============================================================================
# PASO 1: CALCULAR/RECALCULAR efectivo_alto
# ============================================================================
def calcular_efectivo_alto(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    """
    Calcula/recalcula efectivo_alto para cada transacción.
    
    efectivo_alto = 1 si:
    - Es operación en efectivo (EsEfectivo=1)
    - Monto >= 65% del umbral de efectivo de la fracción (actividades vulnerables)
    - O si el acumulado 6 meses en efectivo >= 65% del umbral
    
    NOTA: Si efectivo_max_UMA = 0, usa aviso_UMA como referencia
    NOTA: 65% para actividades vulnerables (más sensible para análisis)
    """
    df = df.copy()
    uma = get_uma_mxn()
    lfpi = cfg.get("lfpiorpi", {})
    umbrales_cfg = lfpi.get("umbrales", {})
    
    # Threshold: 65% para actividades vulnerables
    THRESHOLD_VULNERABLE = 0.65
    THRESHOLD_GENERAL = 0.75  # servicios_generales usa 75%
    
    efectivo_alto_values = []
    debug_info = []  # Para logging
    
    for _, row in df.iterrows():
        es_efectivo = row.get("EsEfectivo") in (1, True, "1")
        
        if not es_efectivo:
            efectivo_alto_values.append(0)
            continue
        
        fraccion = str(row.get("fraccion", "servicios_generales"))
        monto = float(row.get("monto", 0) or 0)
        monto_6m = float(row.get("monto_6m", 0) or 0)
        es_vulnerable = row.get("es_actividad_vulnerable") in (1, True, "1", True)
        
        # Obtener umbral de efectivo
        u = umbrales_cfg.get(fraccion, umbrales_cfg.get("_general", {}))
        
        # CORRECCIÓN: Si efectivo_max_UMA es 0 o no existe, usar aviso_UMA
        umbral_ef_umas = float(u.get("efectivo_max_UMA", 0))
        if umbral_ef_umas == 0:
            umbral_ef_umas = float(u.get("aviso_UMA", 645))
        
        umbral_ef_mxn = umbral_ef_umas * uma
        
        # Si es servicios_generales, usar umbral estándar de 8025 UMAs
        if fraccion in ["servicios_generales", "_general"]:
            umbral_ef_mxn = 8025 * uma  # ~908k MXN
            threshold = THRESHOLD_GENERAL
        else:
            # Actividades vulnerables usan 65%
            threshold = THRESHOLD_VULNERABLE if es_vulnerable else THRESHOLD_GENERAL
        
        # ¿Es efectivo alto?
        # Verificar monto individual O acumulado 6 meses
        umbral_efectivo_alto = threshold * umbral_ef_mxn
        
        es_alto_por_monto = monto >= umbral_efectivo_alto
        es_alto_por_acumulado = monto_6m >= umbral_efectivo_alto
        
        if umbral_ef_mxn > 0 and (es_alto_por_monto or es_alto_por_acumulado):
            efectivo_alto_values.append(1)
            pct_monto = (monto / umbral_ef_mxn * 100)
            pct_acum = (monto_6m / umbral_ef_mxn * 100)
            razon = "monto" if es_alto_por_monto else "acumulado 6m"
            debug_info.append(f"{fraccion}: ${monto:,.0f} ({pct_monto:.0f}%), acum=${monto_6m:,.0f} ({pct_acum:.0f}%) - {razon}")
        else:
            efectivo_alto_values.append(0)
    
    df["efectivo_alto"] = efectivo_alto_values
    
    n_efectivo_alto = sum(efectivo_alto_values)
    log(f"  📊 efectivo_alto recalculado: {n_efectivo_alto}/{len(df)} (threshold={THRESHOLD_VULNERABLE*100:.0f}% vulnerables)")
    
    # Mostrar algunos ejemplos si hay efectivo_alto
    if debug_info and len(debug_info) <= 5:
        for info in debug_info:
            log(f"     💰 {info}")
    elif debug_info:
        log(f"     💰 Ejemplos: {debug_info[0]}, ... (+{len(debug_info)-1} más)")
    
    return df


# ============================================================================
# PASO 1.5: MODELO NO SUPERVISADO (Anomaly Detection)
# ============================================================================
def aplicar_no_supervisado(df: pd.DataFrame, bundle: Optional[Dict[str, Any]]) -> pd.DataFrame:
    """
    Aplica modelo no supervisado para detectar anomalías.
    
    Si no hay modelo cargado, usa un IsolationForest por defecto.
    
    Agrega columnas:
    - anomaly_score_iso: Score de Isolation Forest (0-1, más alto = más anómalo)
    - is_outlier_iso: 1 si es outlier según Isolation Forest
    - kmeans_dist: Distancia al centroide del cluster
    - anomaly_score_composite: Score compuesto ponderado
    """
    if df.empty:
        df["anomaly_score_iso"] = 0.0
        df["is_outlier_iso"] = 0
        df["kmeans_dist"] = 0.0
        df["anomaly_score_composite"] = 0.0
        return df
    
    df = df.copy()
    
    # Features numéricas para anomalía
    numeric_features = [
        "monto", "monto_umas", "monto_6m", "pct_umbral_aviso",
        "EsEfectivo", "efectivo_alto", "EsInternacional", "SectorAltoRiesgo",
        "es_nocturno", "fin_de_semana", "ratio_vs_promedio", "ops_6m",
        "posible_burst", "es_monto_redondo", "acumulado_alto"
    ]
    
    # Seleccionar features disponibles
    available_features = [f for f in numeric_features if f in df.columns]
    
    if len(available_features) < 3:
        log(f"  ⚠️ No supervisado: pocas features disponibles ({len(available_features)})")
        df["anomaly_score_iso"] = 0.0
        df["is_outlier_iso"] = 0
        df["kmeans_dist"] = 0.0
        df["anomaly_score_composite"] = 0.0
        return df
    
    X = df[available_features].copy()
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    
    try:
        # Intentar usar el modelo cargado
        if bundle is not None:
            iso_forest = bundle.get("isolation_forest") or bundle.get("iso_forest")
            scaler = bundle.get("scaler")
            # Intentar alinear X a las columnas del bundle si están presentes
            columns = bundle.get("columns") or bundle.get("feature_columns") or []

            if columns:
                log(f"  🔧 No supervisado: bundle espera {len(columns)} features")
                # Preparar X para matching con bundle.columns (one-hot si aplica)
                X_prep = df.copy()
                drop_cols = ["clasificacion_lfpiorpi", "clasificacion_ml", "clasificacion",
                             "clasificacion_final", "cliente_id", "fecha", "id_transaccion",
                             "guardrail_activo", "guardrail_razon", "guardrail_fundamento"]
                X_prep = X_prep.drop(columns=[c for c in drop_cols if c in X_prep.columns], errors="ignore")

                # Si el bundle incluye one-hot (fraccion_ o tipo_operacion_), crear dummies
                has_onehot = any("fraccion_" in c or "tipo_operacion_" in c for c in columns)
                if has_onehot:
                    cat_cols = [c for c in ["tipo_operacion", "sector_actividad", "fraccion"] if c in X_prep.columns]
                    if cat_cols:
                        X_prep = pd.get_dummies(X_prep, columns=cat_cols, drop_first=False, dtype=float)
                        # Remove duplicate columns (keep first occurrence) which can break reindex
                        if X_prep.columns.duplicated().any():
                            dup_list = [c for c in X_prep.columns[X_prep.columns.duplicated()]]
                            log(f"  ⚠️ Duplicated columns detected in X_prep, dropping duplicates: {dup_list[:10]}")
                            X_prep = X_prep.loc[:, ~X_prep.columns.duplicated()]

                # Alinear columnas
                for col in columns:
                    if col not in X_prep.columns:
                        X_prep[col] = 0.0
                X_aligned = X_prep[columns].copy()
                X_aligned = X_aligned.replace([np.inf, -np.inf], np.nan).fillna(0.0)
                # Ensure columns order/existence strictly matches bundle columns
                X_aligned = X_aligned.reindex(columns=columns, fill_value=0.0)
                X = X_aligned
                # DEBUG: report any missing columns (after alignment, all should exist)
                missing_cols = [c for c in columns if c not in X_prep.columns]
                if missing_cols:
                    log(f"  ⚠️ No supervisado: columnas esperadas faltantes en CSV: {len(missing_cols)} -> {missing_cols[:10]}")
            else:
                # No hay columnas en bundle: seguir usando numeric_features seleccionadas
                pass

            # Escalar y predecir si hay modelo no supervisado
            if iso_forest is not None:
                # Escalar si hay scaler
                try:
                    if scaler and hasattr(scaler, "n_features_in_"):
                        expected = int(getattr(scaler, "n_features_in_"))
                        actual = X.shape[1]
                        if expected != actual:
                                log(f"  ⚠️ Scaler mismatch: scaler espera {expected} features, X tiene {actual} features")
                                log(f"     → Bundle columns: {columns}")
                                log(f"     → X.columns: {list(X.columns)}")
                                # Reindex X to feature order if possible
                                X = X.reindex(columns=columns, fill_value=0.0)
                                actual = X.shape[1]
                                log(f"     → After reindex: X tiene {actual} features")
                    X_scaled = scaler.transform(X.values) if scaler else X.values
                except Exception as e:
                    # Log con detalle y re-raise para fallback
                    log(f"  ⚠️ Error aplicando scaler del bundle: {e}")
                    raise

                iso_scores = iso_forest.decision_function(X_scaled)
                iso_predictions = iso_forest.predict(X_scaled)
                
                # Normalizar scores a 0-1 (1 = más anómalo)
                iso_scores_norm = 1 - (iso_scores - iso_scores.min()) / (iso_scores.max() - iso_scores.min() + 1e-10)
                
                df["anomaly_score_iso"] = iso_scores_norm
                df["is_outlier_iso"] = (iso_predictions == -1).astype(int)
                
                n_outliers = df["is_outlier_iso"].sum()
                if n_outliers > 0:
                    log(f"  ✅ No supervisado (modelo): {n_outliers} outliers ({n_outliers/len(df)*100:.1f}%)")
                    df["kmeans_dist"] = 0.0
                    df["anomaly_score_composite"] = df["anomaly_score_iso"]
                    return df
                else:
                    log(f"  ⚠️ Modelo no supervisado no detectó outliers, usando fallback...")
        
        # FALLBACK: Crear IsolationForest más agresivo
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler
        
        log(f"  🔄 Usando IsolationForest fallback con {len(available_features)} features...")
        
        # Escalar datos
        scaler_fallback = StandardScaler()
        X_scaled = scaler_fallback.fit_transform(X.values)
        
        # IsolationForest con contamination más alto (esperamos ~10-15% de anomalías)
        iso_fallback = IsolationForest(
            n_estimators=100,
            contamination=0.15,  # Esperar 15% de anomalías
            random_state=42,
            n_jobs=-1
        )
        
        iso_fallback.fit(X_scaled)
        
        iso_scores = iso_fallback.decision_function(X_scaled)
        iso_predictions = iso_fallback.predict(X_scaled)
        
        # Normalizar scores
        iso_scores_norm = 1 - (iso_scores - iso_scores.min()) / (iso_scores.max() - iso_scores.min() + 1e-10)
        
        df["anomaly_score_iso"] = iso_scores_norm
        df["is_outlier_iso"] = (iso_predictions == -1).astype(int)
        df["kmeans_dist"] = 0.0
        df["anomaly_score_composite"] = iso_scores_norm
        
        n_outliers = df["is_outlier_iso"].sum()
        log(f"  ✅ No supervisado (fallback): {n_outliers} outliers ({n_outliers/len(df)*100:.1f}%)")
        
        # Mostrar las transacciones más anómalas
        if n_outliers > 0:
            top_anomalies = df.nlargest(3, "anomaly_score_iso")[["monto", "anomaly_score_iso"]]
            for _, row in top_anomalies.iterrows():
                log(f"     🔴 Anomalía: ${row['monto']:,.0f} (score={row['anomaly_score_iso']:.3f})")
        
    except Exception as e:
        log(f"  ⚠️ Error en no supervisado: {e}")
        import traceback
        traceback.print_exc()
        df["anomaly_score_iso"] = 0.0
        df["is_outlier_iso"] = 0
        df["kmeans_dist"] = 0.0
        df["anomaly_score_composite"] = 0.0
    
    return df


def obtener_threshold_refuerzo(bundle_rl: Optional[Dict[str, Any]], cfg: Dict[str, Any]) -> int:
    """
    Obtiene el threshold óptimo de EBR desde el modelo de refuerzo.
    
    Si no hay modelo de refuerzo, usa el valor por defecto del config.
    """
    default_threshold = cfg.get("ebr", {}).get("elevacion_inusual_threshold", 50)
    
    if bundle_rl is None:
        return default_threshold
    
    try:
        # El modelo de refuerzo puede tener diferentes estructuras
        if "optimal_threshold" in bundle_rl:
            return int(bundle_rl["optimal_threshold"])
        
        if "q_table" in bundle_rl:
            # Q-Learning: encontrar la acción con mayor Q-value
            q_table = bundle_rl["q_table"]
            if isinstance(q_table, dict) and q_table:
                # Promediar sobre estados y encontrar mejor acción
                best_action = max(q_table.values()) if q_table else default_threshold
                return int(best_action)
        
        if "threshold" in bundle_rl:
            return int(bundle_rl["threshold"])
        
    except Exception as e:
        log(f"  ⚠️ Error leyendo threshold de refuerzo: {e}")
    
    return default_threshold


# ============================================================================
# PASO 2: MODELO SUPERVISADO (2 CLASES)
# ============================================================================
def aplicar_supervisado(
    df: pd.DataFrame,
    model: Any,
    scaler: Any,
    feature_cols: List[str],
    classes: List[str]
) -> pd.DataFrame:
    """Aplica modelo supervisado para clasificar RELEVANTE vs INUSUAL"""
    if df.empty:
        return df
    
    df = df.copy()
    
    # Preparar features
    X = df.copy()
    
    # Normalizar fracciones para que coincidan con el modelo
    if "fraccion" in X.columns:
        X["fraccion_norm"] = X["fraccion"].apply(normalizar_fraccion_para_modelo)
    else:
        X["fraccion_norm"] = "servicios_generales"
    
    # Eliminar columnas que no son features
    drop_cols = ["clasificacion_lfpiorpi", "clasificacion_ml", "clasificacion",
                 "clasificacion_final", "cliente_id", "fecha", "id_transaccion",
                 "guardrail_activo", "guardrail_razon", "guardrail_fundamento",
                 "sector_actividad", "fraccion", "hora", "anomaly_score_iso",
                 "is_outlier_iso", "kmeans_dist", "anomaly_score_composite"]
    X = X.drop(columns=[c for c in drop_cols if c in X.columns], errors="ignore")
    
    # One-hot encode
    cat_cols_to_encode = []
    if "tipo_operacion" in X.columns:
        cat_cols_to_encode.append("tipo_operacion")
    if "fraccion_norm" in X.columns:
        cat_cols_to_encode.append("fraccion_norm")
    
    if cat_cols_to_encode:
        X = pd.get_dummies(X, columns=cat_cols_to_encode, drop_first=False, dtype=float, prefix={
            "tipo_operacion": "tipo_operacion",
            "fraccion_norm": "fraccion"
        })

    # Eliminar columnas duplicadas que puedan existir (mantener la primera aparición)
    if X.columns.duplicated().any():
        dup_list = [c for c in X.columns[X.columns.duplicated()]]
        log(f"  ⚠️ Duplicated columns detected in supervised features, dropping duplicates: {dup_list[:10]}")
        X = X.loc[:, ~X.columns.duplicated()]
    
    # Alinear columnas con el modelo
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0.0
    
    # Seleccionar solo columnas del modelo
    X = X[[c for c in feature_cols if c in X.columns]].copy()
    
    # Agregar columnas faltantes y reindexar estrictamente al orden del modelo
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0.0

    X = X.reindex(columns=feature_cols, fill_value=0.0).copy()
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    
    log(f"  📊 Features para supervisado: {X.shape[1]}")
    if hasattr(scaler, 'n_features_in_'):
        expected = int(getattr(scaler, 'n_features_in_'))
        actual = X.shape[1]
        if expected != actual:
            log(f"  ⚠️ Scaler mismatch (supervisado): scaler espera {expected} features, X tiene {actual} features")
            log(f"     → Feature cols (bundle): {feature_cols}")
            log(f"     → X.columns: {list(X.columns)}")
            # Try enforcing strict reindexing to match the model columns
            X = X.reindex(columns=feature_cols, fill_value=0.0)
            log(f"     → After reindex: X tiene {X.shape[1]} features")
    
    # Escalar y predecir
    X_scaled = scaler.transform(X.values) if scaler else X.values
    predictions_raw = model.predict(X_scaled)
    probabilities = model.predict_proba(X_scaled)
    
    # CORRECCIÓN: Convertir índices a etiquetas
    # El modelo puede devolver índices (0, 1) o etiquetas ("inusual", "relevante")
    if len(predictions_raw) > 0:
        # Verificar si son índices numéricos
        if isinstance(predictions_raw[0], (int, np.integer)):
            # Convertir índices a etiquetas
            predictions = [classes[int(p)] for p in predictions_raw]
        else:
            predictions = list(predictions_raw)
    else:
        predictions = []
    
    df["clasificacion_ml"] = predictions
    
    for i, cls in enumerate(classes):
        df[f"prob_{cls}"] = probabilities[:, i]
    
    df["ica"] = probabilities.max(axis=1)
    
    log(f"  ✅ Supervisado: {Counter(predictions)}")
    
    return df


# ============================================================================
# PASO 3: CALCULAR EBR (con efectivo_alto)
# ============================================================================
def calcular_ebr(row: Dict[str, Any], cfg: Dict[str, Any]) -> Tuple[float, List[str], str]:
    """
    Calcula score EBR con efectivo_alto y anomaly_score incluidos.
    
    Ponderaciones:
    - Efectivo: +25 pts
    - Efectivo alto (>=65% umbral): +20 pts
    - Sector alto riesgo: +20 pts
    - Acumulado alto (>500k): +15 pts
    - Anomalía detectada (no supervisado): +15 pts  ← NUEVO
    - Internacional: +10 pts
    - Ratio > 3x: +10 pts
    - Frecuencia alta: +10 pts
    - Burst: +10 pts
    - Nocturno: +5 pts
    - Fin semana: +5 pts
    - Monto redondo: +5 pts
    """
    score = 0.0
    factores = []
    
    # Efectivo base
    if row.get("EsEfectivo") in (1, True, "1"):
        score += 25
        factores.append("Operación en efectivo (+25 pts)")
    
    # EFECTIVO ALTO (65% para vulnerables)
    if row.get("efectivo_alto") in (1, True, "1"):
        score += 20
        factores.append("Efectivo alto (>=65% umbral) (+20 pts)")
    
    # Sector alto riesgo
    if row.get("SectorAltoRiesgo") in (1, True, "1"):
        score += 20
        factores.append("Sector de alto riesgo (+20 pts)")
    
    # Acumulado alto
    if row.get("acumulado_alto") in (1, True, "1"):
        score += 15
        factores.append("Acumulado 6m alto (+15 pts)")
    
    # ANOMALÍA DETECTADA (no supervisado)
    anomaly_score = float(row.get("anomaly_score_composite", 0) or 0)
    is_outlier = row.get("is_outlier_iso") in (1, True, "1")
    if is_outlier or anomaly_score >= 0.7:
        score += 15
        factores.append(f"Anomalía estadística detectada (+15 pts)")
    elif anomaly_score >= 0.5:
        score += 8
        factores.append(f"Comportamiento atípico (+8 pts)")
    
    # Internacional
    if row.get("EsInternacional") in (1, True, "1"):
        score += 10
        factores.append("Transferencia internacional (+10 pts)")
    
    # Ratio alto
    ratio = float(row.get("ratio_vs_promedio", 0) or 0)
    if ratio > 3:
        score += 10
        factores.append(f"Ratio vs promedio > 3x ({ratio:.1f}x) (+10 pts)")
    
    # Frecuencia alta
    ops = int(row.get("ops_6m", 0) or 0)
    if ops > 5:
        score += 10
        factores.append(f"Frecuencia alta ({ops} ops/6m) (+10 pts)")
    
    # Burst
    if row.get("posible_burst") in (1, True, "1"):
        score += 10
        factores.append("Posible fraccionamiento (+10 pts)")
    
    # Nocturno
    if row.get("es_nocturno") in (1, True, "1"):
        score += 5
        factores.append("Horario nocturno (+5 pts)")
    
    # Fin semana
    if row.get("fin_de_semana") in (1, True, "1"):
        score += 5
        factores.append("Fin de semana (+5 pts)")
    
    # Monto redondo
    if row.get("es_monto_redondo") in (1, True, "1"):
        score += 5
        factores.append("Monto redondo (+5 pts)")
    
    score = min(100, score)

    # Regla especial: servicios_generales con monto > umbral USD -> forzar inusual
    try:
        umbral_usd = float(cfg.get("ebr", {}).get("umbral_servicios_generales_usd", cfg.get('umbrales_adicionales', {}).get('umbral_servicios_generales_usd', 10000)))
        usd_to_mxn = float(cfg.get("fx", {}).get("usd_to_mxn", cfg.get("fx", {}).get("usd_mxn", 18)))
    except Exception:
        umbral_usd = 10000
        usd_to_mxn = 18.0
    threshold_mxn = umbral_usd * usd_to_mxn
    if str(row.get("fraccion", "")).lower() == "servicios_generales" and float(row.get("monto", 0) or 0) >= threshold_mxn:
        score = 100.0
        nivel = "alto"
        factores.append(f"Servicios generales > {umbral_usd} USD (umbral {threshold_mxn:.2f} MXN)")
    
    # Nivel
    if score <= 40:
        nivel = "bajo"
    elif score <= 65:
        nivel = "medio"
    else:
        nivel = "alto"
    
    return score, factores, nivel


def aplicar_ebr(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    """Aplica cálculo EBR"""
    if df.empty:
        return df
    
    df = df.copy()
    
    # CORRECCIÓN: Asegurar que actividades vulnerables tengan SectorAltoRiesgo=1
    # Las fracciones LFPIORPI son por definición de alto riesgo
    fracciones_alto_riesgo = [
        "VI_joyeria_metales", "VI_joyeria", 
        "V_inmuebles", "V_bis_desarrollo_inmobiliario",
        "XVI_activos_virtuales", "XVI_cripto",
        "I_juegos", "VII_obras_arte", "VII_arte",
        "X_traslado_valores", "X_traslado"
    ]
    
    if "fraccion" in df.columns:
        df["SectorAltoRiesgo"] = df.apply(
            lambda row: 1 if (
                row.get("SectorAltoRiesgo") in (1, True, "1") or
                str(row.get("fraccion", "")).lower() in [f.lower() for f in fracciones_alto_riesgo] or
                row.get("es_actividad_vulnerable") in (1, True, "1")
            ) else 0,
            axis=1
        )
    
    scores = []
    niveles = []
    factores_list = []
    
    # Debug: contar cuántos tienen cada factor
    debug_counts = {
        "efectivo": 0, "efectivo_alto": 0, "sector_riesgo": 0,
        "acumulado_alto": 0, "anomalia": 0, "internacional": 0
    }
    
    for _, row in df.iterrows():
        score, factores, nivel = calcular_ebr(row.to_dict(), cfg)
        scores.append(score)
        niveles.append(nivel)
        factores_list.append(factores)
        
        # Debug counts
        if row.get("EsEfectivo") in (1, True, "1"):
            debug_counts["efectivo"] += 1
        if row.get("efectivo_alto") in (1, True, "1"):
            debug_counts["efectivo_alto"] += 1
        if row.get("SectorAltoRiesgo") in (1, True, "1"):
            debug_counts["sector_riesgo"] += 1
        if row.get("acumulado_alto") in (1, True, "1"):
            debug_counts["acumulado_alto"] += 1
        if row.get("is_outlier_iso") in (1, True, "1"):
            debug_counts["anomalia"] += 1
        if row.get("EsInternacional") in (1, True, "1"):
            debug_counts["internacional"] += 1
    
    df["score_ebr"] = scores
    df["nivel_riesgo_ebr"] = niveles
    df["factores_ebr"] = factores_list
    
    # Estadísticas
    alto_count = sum(1 for n in niveles if n == "alto")
    medio_count = sum(1 for n in niveles if n == "medio")
    ebr_50_plus = sum(1 for s in scores if s >= 50)
    
    log(f"  ✅ EBR: mean={np.mean(scores):.1f}, alto={alto_count}, medio={medio_count}, >=50pts={ebr_50_plus}")
    log(f"     Factores: efectivo={debug_counts['efectivo']}, ef_alto={debug_counts['efectivo_alto']}, "
        f"sector={debug_counts['sector_riesgo']}, anomalía={debug_counts['anomalia']}, intl={debug_counts['internacional']}")
    
    return df


# ============================================================================
# PASO 4: FUSIÓN ML + EBR
# ============================================================================
def fusionar_ml_ebr(df: pd.DataFrame, cfg: Dict[str, Any], umbral_elevacion: int = 50) -> pd.DataFrame:
    """
    Fusiona ML + EBR.
    
    REGLA CLAVE: Si EBR >= umbral y ML dice relevante → elevar a INUSUAL
    
    Args:
        df: DataFrame con clasificaciones ML y scores EBR
        cfg: Configuración
        umbral_elevacion: Threshold de EBR para elevar (puede venir del modelo RL)
    """
    if df.empty:
        return df
    
    df = df.copy()
    
    clasificaciones = []
    niveles = []
    origenes = []
    motivos = []
    
    for _, row in df.iterrows():
        clasif_ml = row.get("clasificacion_ml", "relevante")
        score_ebr = float(row.get("score_ebr", 0) or 0)
        is_outlier = row.get("is_outlier_iso") in (1, True, "1")
        
        # Si ML dice inusual, respetar
        if clasif_ml == "inusual":
            clasificaciones.append("inusual")
            niveles.append("medio")
            origenes.append("ml")
            motivos.append(f"ML clasificó como inusual (score EBR: {score_ebr:.0f})")
            continue
        
        # Si ML dice relevante pero EBR >= umbral, elevar
        if clasif_ml == "relevante" and score_ebr >= umbral_elevacion:
            clasificaciones.append("inusual")
            niveles.append("medio")
            origenes.append("elevacion_ebr")
            motivos.append(f"EBR alto ({score_ebr:.0f}) eleva de relevante a inusual")
            continue
        
        # Si es outlier del no supervisado pero ML y EBR dicen relevante
        # → Elevar a inusual (el no supervisado detectó algo)
        if is_outlier and clasif_ml == "relevante":
            clasificaciones.append("inusual")
            niveles.append("medio")
            origenes.append("anomalia_no_supervisado")
            motivos.append("Anomalía estadística detectada por modelo no supervisado")
            continue
        
        # ML dice relevante y EBR < umbral y no es outlier
        clasificaciones.append("relevante")
        niveles.append("bajo")
        origenes.append("ml_ebr_coinciden")
        motivos.append(None)
    
    df["clasificacion_final"] = clasificaciones
    df["nivel_riesgo_final"] = niveles
    df["origen"] = origenes
    df["motivo_fusion"] = motivos
    
    # Estadísticas
    dist = Counter(clasificaciones)
    elevados_ebr = sum(1 for o in origenes if o == "elevacion_ebr")
    elevados_anomalia = sum(1 for o in origenes if o == "anomalia_no_supervisado")
    log(f"  ✅ Fusión: {dict(dist)}")
    log(f"     Elevados por EBR: {elevados_ebr}")
    log(f"     Elevados por anomalía: {elevados_anomalia}")
    log(f"     Threshold usado: {umbral_elevacion}")
    
    return df


# ============================================================================
# PASO 5: EXPLICACIONES
# ============================================================================
def generar_explicacion_simple(row: Dict[str, Any]) -> Dict[str, Any]:
    """Genera explicación según clasificación"""
    clasificacion = row.get("clasificacion_final", "relevante")
    origen = row.get("origen", "ml")
    
    if clasificacion == "preocupante":
        return {
            "tipo": "legal",
            "razon_principal": row.get("guardrail_razon", "Rebasa umbral LFPIORPI"),
            "fundamento_legal": row.get("guardrail_fundamento"),
            "accion_requerida": "Presentar aviso a la UIF dentro de 15 días hábiles.",
            "certeza": "100%",
            "requiere_revision": False,
        }
    
    elif clasificacion == "relevante":
        return {
            "tipo": "limpio",
            "razon_principal": "No se detectaron indicadores de riesgo PLD/FT",
            "fundamento_legal": None,
            "accion_requerida": "Registro para trazabilidad. Sin acción adicional requerida.",
            "certeza": f"{row.get('ica', 0.9):.0%}",
            "requiere_revision": False,
        }
    
    else:  # inusual
        factores = row.get("factores_ebr", [])
        score_ebr = row.get("score_ebr", 0)
        
        if origen == "elevacion_ebr":
            razon = f"Score de riesgo EBR elevado ({score_ebr:.0f}/100)"
        elif factores:
            razon = factores[0].split("(+")[0].strip() if "(+" in str(factores[0]) else str(factores[0])
        else:
            razon = "Patrón de comportamiento atípico detectado"
        
        return {
            "tipo": "sospecha",
            "razon_principal": razon,
            "fundamento_legal": None,
            "accion_requerida": "Revisión por oficial de cumplimiento.",
            "certeza": f"{row.get('ica', 0.7):.0%}",
            "requiere_revision": True,
            "factores": factores[:3] if factores else [],
        }


# ============================================================================
# PROCESO PRINCIPAL
# ============================================================================
def process_file(csv_path: Path) -> bool:
    """Procesa un archivo CSV enriquecido usando todos los modelos"""
    analysis_id = csv_path.stem
    
    log(f"\n{'='*70}")
    log(f"📄 Procesando: {csv_path.name}")
    log(f"{'='*70}")
    
    try:
        df = pd.read_csv(csv_path)
        cfg = cargar_config()
        log(f"  📊 Cargado: {len(df)} transacciones")
        
        # Cargar todos los modelos al inicio
        log("\n  📦 Cargando modelos...")
        model_sup, scaler_sup, feature_cols_sup, classes = cargar_modelo_supervisado()
        bundle_no_sup = cargar_modelo_no_supervisado()
        bundle_rl = cargar_modelo_refuerzo()
        
        # Obtener threshold del modelo de refuerzo
        umbral_elevacion = obtener_threshold_refuerzo(bundle_rl, cfg)
        log(f"  📈 Threshold EBR (refuerzo): {umbral_elevacion}")
        
        # PASO 0: Reglas LFPIORPI
        df_preocupantes, df_para_ml = aplicar_reglas_lfpiorpi(df, cfg)
        
        if len(df_para_ml) > 0:
            # PASO 1: Recalcular efectivo_alto
            log("\n  💰 Paso 1: Recalculando efectivo_alto...")
            df_para_ml = calcular_efectivo_alto(df_para_ml, cfg)
            
            # PASO 1.5: No supervisado (detección de anomalías)
            log("\n  🔍 Paso 1.5: Modelo no supervisado...")
            # If bundle has expected columns, log any difference to aid debugging
            if bundle_no_sup is not None:
                expected_cols = bundle_no_sup.get("columns") or bundle_no_sup.get("feature_columns") or []
                if expected_cols:
                    missing = [c for c in expected_cols if c not in df_para_ml.columns]
                    if missing:
                        log(f"  ⚠️ Enriquecedor: faltan {len(missing)} columnas esperadas por bundle_no_sup: {missing[:10]}")
            df_para_ml = aplicar_no_supervisado(df_para_ml, bundle_no_sup)
            
            # PASO 2: Supervisado
            log("\n  🤖 Paso 2: Modelo supervisado...")
            df_para_ml = aplicar_supervisado(df_para_ml, model_sup, scaler_sup, feature_cols_sup, classes)
            # CORRECCIÓN: Remapear etiqueta 'preocupante' que pueda venir del modelo a 'inusual'
            if "clasificacion_ml" in df_para_ml.columns:
                n_preocupante = int((df_para_ml["clasificacion_ml"] == "preocupante").sum())
                if n_preocupante > 0:
                    log(f"  🔁 Remapeando {n_preocupante} 'preocupante' → 'inusual' en clasificacion_ml")
                    df_para_ml.loc[df_para_ml["clasificacion_ml"] == "preocupante", "clasificacion_ml"] = "inusual"
            
            # PASO 3: EBR (ahora incluye anomaly_score)
            log("\n  📊 Paso 3: Cálculo EBR...")
            df_para_ml = aplicar_ebr(df_para_ml, cfg)
            
            # PASO 4: Fusión (usa threshold del modelo RL)
            log("\n  🔀 Paso 4: Fusión ML + EBR + No supervisado...")
            df_para_ml = fusionar_ml_ebr(df_para_ml, cfg, umbral_elevacion)
        
        # PASO 5: Unir
        log("\n  📦 Paso 5: Uniendo resultados...")
        
        all_cols = set(df_preocupantes.columns) | (set(df_para_ml.columns) if len(df_para_ml) > 0 else set())
        for col in all_cols:
            if col not in df_preocupantes.columns:
                df_preocupantes[col] = None
            if len(df_para_ml) > 0 and col not in df_para_ml.columns:
                df_para_ml[col] = None
        
        df_final = pd.concat([df_preocupantes, df_para_ml], ignore_index=True)
        
        # PASO 6: Explicaciones
        log("\n  📝 Paso 6: Generando explicaciones...")
        explicaciones = []
        for _, row in df_final.iterrows():
            exp = generar_explicacion_simple(row.to_dict())
            explicaciones.append(exp)
        
        df_final["explicacion"] = [json.dumps(e, ensure_ascii=False) for e in explicaciones]
        
        # Distribución final
        dist_final = Counter(df_final["clasificacion_final"])
        total = len(df_final)
        
        log(f"\n  📊 DISTRIBUCIÓN FINAL:")
        log(f"     🔴 Preocupante: {dist_final.get('preocupante', 0)} ({dist_final.get('preocupante', 0)/total*100:.1f}%)")
        log(f"     🟡 Inusual: {dist_final.get('inusual', 0)} ({dist_final.get('inusual', 0)/total*100:.1f}%)")
        log(f"     🟢 Relevante: {dist_final.get('relevante', 0)} ({dist_final.get('relevante', 0)/total*100:.1f}%)")
        
        # Guardar CSV
        csv_out_path = PROCESSED_DIR / csv_path.name
        df_final.to_csv(csv_out_path, index=False, encoding="utf-8")
        log(f"\n  ✅ CSV: {csv_out_path.name}")
        
        # Guardar JSON
        transacciones = []
        for i, row in df_final.iterrows():
            # Probabilidades del modelo
            probabilidades = {}
            if "prob_inusual" in row:
                probabilidades["inusual"] = round(float(row.get("prob_inusual", 0) or 0), 4)
            if "prob_relevante" in row:
                probabilidades["relevante"] = round(float(row.get("prob_relevante", 0) or 0), 4)
            
            # Factores EBR (limpiar formato para frontend)
            factores_ebr = row.get("factores_ebr", [])
            if isinstance(factores_ebr, str):
                try:
                    factores_ebr = eval(factores_ebr)
                except:
                    factores_ebr = []
            
            tx = {
                "id": str(row.get("cliente_id", f"TXN-{i+1:05d}")),
                "monto": float(row.get("monto", 0) or 0),
                "monto_umas": round(mxn_a_umas(float(row.get("monto", 0) or 0)), 2),
                "fecha": str(row.get("fecha", "")),
                "tipo_operacion": str(row.get("tipo_operacion", "")),
                "sector_actividad": str(row.get("sector_actividad", "")),
                "fraccion": str(row.get("fraccion", "")),
                "clasificacion": row.get("clasificacion_final"),
                "nivel_riesgo": row.get("nivel_riesgo_final"),
                "origen": row.get("origen"),
                "ica": round(float(row.get("ica", 0) or 0), 4),
                "score_ebr": round(float(row.get("score_ebr", 0) or 0), 1),
                "probabilidades": probabilidades,
                "factores_ebr": factores_ebr if isinstance(factores_ebr, list) else [],
                "motivo_fusion": row.get("motivo_fusion"),
                # Scores de anomalía (no supervisado)
                "anomaly": {
                    "score_iso": round(float(row.get("anomaly_score_iso", 0) or 0), 4),
                    "is_outlier": int(row.get("is_outlier_iso", 0) or 0),
                    "kmeans_dist": round(float(row.get("kmeans_dist", 0) or 0), 4),
                    "score_composite": round(float(row.get("anomaly_score_composite", 0) or 0), 4),
                },
                # Features clave para el modal
                "features": {
                    "EsEfectivo": int(row.get("EsEfectivo", 0) or 0),
                    "efectivo_alto": int(row.get("efectivo_alto", 0) or 0),
                    "EsInternacional": int(row.get("EsInternacional", 0) or 0),
                    "SectorAltoRiesgo": int(row.get("SectorAltoRiesgo", 0) or 0),
                    "es_actividad_vulnerable": int(row.get("es_actividad_vulnerable", 0) or 0),
                    "monto_6m": round(float(row.get("monto_6m", 0) or 0), 2),
                    "ops_6m": int(row.get("ops_6m", 0) or 0),
                    "ratio_vs_promedio": round(float(row.get("ratio_vs_promedio", 0) or 0), 2),
                    "pct_umbral_aviso": round(float(row.get("pct_umbral_aviso", 0) or 0), 2),
                    "es_nocturno": int(row.get("es_nocturno", 0) or 0),
                    "fin_de_semana": int(row.get("fin_de_semana", 0) or 0),
                    "posible_burst": int(row.get("posible_burst", 0) or 0),
                },
                # Guardrail info (si aplica)
                "guardrail": {
                    "activo": bool(row.get("guardrail_activo", False)),
                    "razon": row.get("guardrail_razon"),
                    "fundamento_legal": row.get("guardrail_fundamento"),
                } if row.get("guardrail_activo") else None,
                # Umbrales de la fracción (para mostrar en modal)
                "umbrales": obtener_umbrales_fraccion(str(row.get("fraccion", "servicios_generales")), cfg),
                "explicacion": explicaciones[i] if i < len(explicaciones) else {},
            }
            transacciones.append(tx)
        
        resultados = {
            "success": True,
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "version": "4.2.0",  # Actualizado por incluir no supervisado y refuerzo
            "resumen": {
                "total_transacciones": total,
                "preocupante": int(dist_final.get("preocupante", 0)),
                "inusual": int(dist_final.get("inusual", 0)),
                "relevante": int(dist_final.get("relevante", 0)),
                "guardrails_aplicados": int(len(df_preocupantes)),
                "elevados_por_ebr": int(sum(1 for o in df_final.get("origen", []) if o == "elevacion_ebr")),
                "elevados_por_anomalia": int(sum(1 for o in df_final.get("origen", []) if o == "anomalia_no_supervisado")),
            },
            "transacciones": transacciones,
        }
        
        # Generar metadata para modal de detalle del frontend
        metadata = {
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "version": "4.2.0",
            "config": {
                "uma_mxn": get_uma_mxn(),
                "umbral_elevacion_ebr": umbral_elevacion,
                "threshold_efectivo_alto_vulnerable": 0.65,
                "threshold_efectivo_alto_general": 0.75,
                "clases_modelo": classes if 'classes' in dir() else ["inusual", "relevante"],
                "modelo_no_supervisado": bundle_no_sup is not None,
                "modelo_refuerzo": bundle_rl is not None,
            },
            "resumen": {
                "total_transacciones": total,
                "distribucion": {
                    "preocupante": {
                        "count": int(dist_final.get("preocupante", 0)),
                        "porcentaje": round(dist_final.get("preocupante", 0) / total * 100, 2) if total > 0 else 0,
                    },
                    "inusual": {
                        "count": int(dist_final.get("inusual", 0)),
                        "porcentaje": round(dist_final.get("inusual", 0) / total * 100, 2) if total > 0 else 0,
                    },
                    "relevante": {
                        "count": int(dist_final.get("relevante", 0)),
                        "porcentaje": round(dist_final.get("relevante", 0) / total * 100, 2) if total > 0 else 0,
                    },
                },
                "guardrails_aplicados": int(len(df_preocupantes)),
                "elevados_por_ebr": int(sum(1 for o in df_final["origen"] if o == "elevacion_ebr")) if "origen" in df_final else 0,
            },
            "metricas": {
                "ebr": {
                    "promedio": round(float(df_final["score_ebr"].mean()), 2) if "score_ebr" in df_final else 0,
                    "min": round(float(df_final["score_ebr"].min()), 2) if "score_ebr" in df_final else 0,
                    "max": round(float(df_final["score_ebr"].max()), 2) if "score_ebr" in df_final else 0,
                    "mediana": round(float(df_final["score_ebr"].median()), 2) if "score_ebr" in df_final else 0,
                },
                "ica": {
                    "promedio": round(float(df_final["ica"].mean()), 4) if "ica" in df_final else 0,
                    "min": round(float(df_final["ica"].min()), 4) if "ica" in df_final else 0,
                    "max": round(float(df_final["ica"].max()), 4) if "ica" in df_final else 0,
                },
                "montos": {
                    "total_mxn": round(float(df_final["monto"].sum()), 2) if "monto" in df_final else 0,
                    "promedio_mxn": round(float(df_final["monto"].mean()), 2) if "monto" in df_final else 0,
                    "max_mxn": round(float(df_final["monto"].max()), 2) if "monto" in df_final else 0,
                    "min_mxn": round(float(df_final["monto"].min()), 2) if "monto" in df_final else 0,
                },
            },
            "origen_clasificacion": dict(Counter(df_final["origen"])) if "origen" in df_final else {},
            "fracciones": dict(Counter(df_final["fraccion"])) if "fraccion" in df_final else {},
            "tipos_operacion": dict(Counter(df_final["tipo_operacion"])) if "tipo_operacion" in df_final else {},
            "umbrales_aplicados": {
                fraccion: obtener_umbrales_fraccion(fraccion, cfg)
                for fraccion in df_final["fraccion"].unique() if "fraccion" in df_final
            },
        }
        
        metadata_path = PROCESSED_DIR / f"{analysis_id}_metadata.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        log(f"  ✅ Metadata: {metadata_path.name}")
        
        json_path = PROCESSED_DIR / f"{analysis_id}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(resultados, f, indent=2, ensure_ascii=False)
        log(f"  ✅ JSON: {json_path.name}")
        
        # Guardar métricas RL
        metrics = {
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "distribucion": {k: v/total for k, v in dist_final.items()},
            "ebr_promedio": float(df_final["score_ebr"].mean()) if "score_ebr" in df_final else 0,
            "ica_promedio": float(df_final["ica"].mean()) if "ica" in df_final else 0,
            "total_transacciones": total,
        }
        
        metrics_path = PROCESSED_DIR / f"{analysis_id}_rl_metrics.json"
        with open(metrics_path, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2, ensure_ascii=False)
        
        # Eliminar archivo pending
        csv_path.unlink()
        
        log(f"\n{'='*70}")
        log(f"✅ COMPLETADO: {analysis_id}")
        log(f"{'='*70}\n")
        
        return True
        
    except Exception as e:
        log(f"\n❌ ERROR: {e}")
        traceback.print_exc()
        
        failed_path = FAILED_DIR / csv_path.name
        shutil.move(str(csv_path), str(failed_path))
        
        error_json = FAILED_DIR / f"{analysis_id}_error.json"
        with open(error_json, "w", encoding="utf-8") as f:
            json.dump({
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc(),
            }, f, indent=2)
        
        return False


def main():
    log(f"\n{'='*70}")
    log("🚀 ML RUNNER v4.1 - Con efectivo_alto y elevación EBR")
    log(f"{'='*70}")
    
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
    
    log(f"📋 Archivos: {len(files)}")
    
    success = sum(1 for f in files if process_file(f))
    failed = len(files) - success
    
    log(f"\n{'='*70}")
    log(f"📊 RESUMEN: ✅ {success}, ❌ {failed}")
    log(f"{'='*70}\n")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())