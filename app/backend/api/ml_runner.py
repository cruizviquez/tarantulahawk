#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - Versión 6.0

Orquesta la aplicación de:
  - Reglas LFPIORPI (legales)
  - Índice EBR
  - Modelo no supervisado (Isolation Forest u otro)
  - Modelo supervisado
  - Lógica de fusión para clasificar operaciones en:
        relevante / inusual / preocupante

Este runner espera un CSV ENRIQUECIDO (salida de validador_enriquecedor v6).

MODOS DE USO
============

1) Modo "portal" (compatible con enhanced_main_api):

   python ml_runner.py <analysis_id>

   Busca:
     app/backend/outputs/enriched/pending/<analysis_id>.csv
   Escribe:
     app/backend/outputs/enriched/processed/<analysis_id>.csv
     app/backend/outputs/enriched/processed/<analysis_id>.json

2) Modo CLI directo:

   python ml_runner.py \
       --input data/historico_enriquecido_vehiculos.csv \
       --output data/historico_clasificado_vehiculos.csv \
       --config app/backend/models/config_modelos.json

   El JSON se guarda junto al CSV, con la misma base de nombre.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from datetime import datetime

import numpy as np
import pandas as pd
import joblib



# =============================================================================
# LOGGING
# =============================================================================

def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# =============================================================================
# CONFIG
# =============================================================================

_CONFIG_CACHE: Dict[str, Any] = {}


def _find_default_config() -> Path:
    here = Path(__file__).resolve().parent
    candidates = [
        here.parent / "models" / "config_modelos_v2.json",
        here.parent / "models" / "config_modelos.json",
        here.parent / "config" / "config_modelos_v4.json",
        Path.cwd() / "app" / "backend" / "models" / "config_modelos.json",
        Path.cwd() / "config_modelos.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError("No se encontró config_modelos.json en rutas conocidas")


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    global _CONFIG_CACHE
    p = Path(config_path) if config_path else _find_default_config()
    key = str(p.resolve())
    if key in _CONFIG_CACHE:
        return _CONFIG_CACHE[key]
    log(f"📁 Cargando config: {p}")
    with p.open("r", encoding="utf-8") as f:
        cfg = json.load(f)
    _CONFIG_CACHE[key] = cfg
    return cfg


def get_uma_mxn(cfg: Dict[str, Any]) -> float:
    lfpi = cfg.get("lfpiorpi", {})
    return float(lfpi.get("uma_mxn", lfpi.get("uma_diaria", 113.14)))


def obtener_umbrales_fraccion(fraccion: Optional[str], cfg: Dict[str, Any]) -> Dict[str, Any]:
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})

    def _fallback() -> Dict[str, Any]:
        if "servicios_generales" in umbrales:
            return umbrales["servicios_generales"]
        return {
            "identificacion_UMA": 0,
            "aviso_UMA": 0,
            "efectivo_max_UMA": 0,
            "es_actividad_vulnerable": False,
            "descripcion": f"Fracción desconocida: {fraccion}",
        }

    if not fraccion:
        return _fallback()

    fr_strip = str(fraccion).strip()
    if fr_strip in umbrales:
        return umbrales[fr_strip]

    fr_upper = fr_strip.upper()
    # match case-insensitive
    for key in umbrales.keys():
        if key.upper() == fr_upper:
            return umbrales[key]
    # solo número romano ("VIII")?
    if "_" not in fr_upper:
        for key in umbrales.keys():
            if key.upper().startswith(fr_upper + "_"):
                return umbrales[key]

    return _fallback()


# =============================================================================
# RUTAS POR DEFECTO (modo portal)
# =============================================================================

BACKEND_DIR = Path(__file__).resolve().parents[1]
OUTPUTS_DIR = BACKEND_DIR / "outputs"
PENDING_DIR = OUTPUTS_DIR / "enriched" / "pending"
PROCESSED_DIR = OUTPUTS_DIR / "enriched" / "processed"
MODELS_DIR = BACKEND_DIR / "outputs"


# =============================================================================
# EBR
# =============================================================================

@dataclass
class EBRFactor:
    flag_col: str        # nombre de columna booleana en df
    config_key: str      # clave en cfg["ebr"]["ponderaciones"]
    default_points: int  # puntaje por defecto
    descripcion: str     # texto corto para explicación


EBR_FACTORS: List[EBRFactor] = [
    EBRFactor("EsEfectivo",       "efectivo",           20, "monto en efectivo"),
    EBRFactor("efectivo_alto",    "efectivo_alto",      15, "efectivo cercano al límite"),
    EBRFactor("SectorAltoRiesgo", "sector_alto_riesgo", 10, "sector de alta vulnerabilidad"),
    EBRFactor("acumulado_alto",   "acumulado_alto",     15, "acumulado alto en 6 meses"),
    EBRFactor("EsInternacional",  "internacional",      10, "operación internacional"),
    EBRFactor("ratio_alto",       "ratio_alto",         10, "monto muy superior a su promedio"),
    EBRFactor("frecuencia_alta",  "frecuencia_alta",    10, "frecuencia alta de operaciones"),
    EBRFactor("posible_burst",    "burst",              10, "múltiples ops el mismo día"),
    EBRFactor("es_nocturno",      "nocturno",            5, "operación en horario inusual"),
    EBRFactor("fin_de_semana",    "fin_de_semana",       5, "operación en fin de semana"),
    EBRFactor("es_monto_redondo", "monto_redondo",       5, "monto redondo"),
]


def _ebr_points_from_config(cfg: Dict[str, Any]) -> Dict[str, int]:
    ebr_cfg = cfg.get("ebr", {}).get("ponderaciones", {})
    puntos: Dict[str, int] = {}
    for f in EBR_FACTORS:
        if f.config_key in ebr_cfg:
            try:
                puntos[f.config_key] = int(ebr_cfg[f.config_key].get("puntos", f.default_points))
            except Exception:
                puntos[f.config_key] = f.default_points
        else:
            puntos[f.config_key] = f.default_points
    return puntos


def calcular_ebr(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    puntos_cfg = _ebr_points_from_config(cfg)

    scores: List[float] = []
    detalles: List[str] = []

    for _, row in df.iterrows():
        total = 0
        razones: List[str] = []

        for factor in EBR_FACTORS:
            flag_val = row.get(factor.flag_col, 0)
            try:
                flag_int = int(flag_val)
            except Exception:
                flag_int = 0
            if flag_int > 0:
                pts = puntos_cfg.get(factor.config_key, factor.default_points)
                total += pts
                razones.append(f"{factor.descripcion}: +{pts}")

        scores.append(float(total))
        detalles.append("; ".join(razones) if razones else "")

    df = df.copy()
    df["score_ebr"] = scores

    # Clasificación EBR simple: relevante / inusual
    # (PREOCUPANTE se reserva a reglas legales en este runner)
    umbral_relevante_max = (
        cfg.get("ebr", {})
        .get("umbrales_clasificacion", {})
        .get("relevante_max", 39)
    )
    clasif = np.where(
        df["score_ebr"] <= umbral_relevante_max,
        "relevante",
        "inusual",
    )
    df["clasificacion_ebr"] = clasif
    df["detalles_ebr"] = detalles

    return df


def get_ebr_elevacion_threshold(cfg: Dict[str, Any]) -> float:
    return float(
        cfg.get("ebr", {}).get("elevacion_inusual_threshold", 50.0)
    )


# =============================================================================
# CARGA MODELOS
# =============================================================================

@dataclass
class ModeloNoSupervisado:
    modelo: Any
    feature_cols: List[str]


@dataclass
class ModeloSupervisado:
    modelo: Any
    feature_cols: List[str]
    clases_: List[Any]
    scaler: Any = None


def _load_no_supervisado(cfg: Dict[str, Any]) -> Optional[ModeloNoSupervisado]:
    rutas = cfg.get("modelos", {})
    ruta = rutas.get("no_supervisado") or str(MODELS_DIR / "no_supervisado_bundle_v2.pkl")
    p = Path(ruta)
    # Resolver rutas relativas con varias heurísticas
    if not p.exists():
        # Intentar como nombre de archivo dentro de MODELS_DIR
        candidate = MODELS_DIR / p.name
        if candidate.exists():
            p = candidate
        else:
            # Intentar relativo a BACKEND_DIR
            candidate2 = BACKEND_DIR / ruta
            if candidate2.exists():
                p = candidate2
    if not p.exists():
        log(f"⚠️  No se encontró modelo no supervisado en {p}, se omitirá.")
        return None
    log(f"  ✅ No supervisado cargado: {p.name}")
    bundle = joblib.load(p)

    # Esperamos un dict {"modelo": ..., "feature_cols": [...]}
    if isinstance(bundle, dict):
        modelo = bundle.get("modelo") or bundle.get("model")
        if modelo is None:
            log("  ⚠️  Bundle no_sup es dict pero no tiene 'modelo' ni 'model'.")
            return None
        feature_cols = bundle.get("feature_cols", [])
        return ModeloNoSupervisado(modelo=modelo, feature_cols=feature_cols)

    # Fallback: el bundle ES el modelo, y usamos todas las columnas numéricas+onehot
    log("  ⚠️  Bundle no tiene 'modelo'/'feature_cols'; se usará como pipeline directo.")
    return ModeloNoSupervisado(
        modelo=bundle,
        feature_cols=[],  # se rellenará dinámicamente más adelante
    )


def _load_supervisado(cfg: Dict[str, Any]) -> Optional[ModeloSupervisado]:
    rutas = cfg.get("modelos", {})
    ruta = rutas.get("supervisado") or str(MODELS_DIR / "modelo_supervisado_v2.pkl")
    p = Path(ruta)
    # Resolver rutas relativas con varias heurísticas
    if not p.exists():
        candidate = MODELS_DIR / p.name
        if candidate.exists():
            p = candidate
        else:
            candidate2 = BACKEND_DIR / ruta
            if candidate2.exists():
                p = candidate2
    if not p.exists():
        log(f"⚠️  No se encontró modelo supervisado en {p}, se omitirá.")
        return None
    log(f"  ✅ Supervisado cargado: {p.name}")
    bundle = joblib.load(p)

    # Caso bundle dict como el tuyo
    if isinstance(bundle, dict):
        modelo = bundle.get("modelo") or bundle.get("model")
        if modelo is None:
            log("  ⚠️  Bundle supervisado es dict pero no tiene 'modelo' ni 'model'.")
            return None

        feature_cols = bundle.get("feature_cols") or bundle.get("columns") or []
        clases_ = list(bundle.get("classes_", getattr(modelo, "classes_", [])))
        scaler = bundle.get("scaler")

        log(f"     Clases supervisado: {clases_}")
        log(f"     N columnas modelo: {len(feature_cols)}")

        return ModeloSupervisado(
            modelo=modelo,
            feature_cols=list(feature_cols),
            clases_=clases_,
            scaler=scaler,
        )

    # Fallback: el bundle ES el modelo directo
    modelo = bundle
    clases_ = list(getattr(modelo, "classes_", []))
    log(f"     Clases supervisado: {clases_}")
    return ModeloSupervisado(
        modelo=modelo,
        feature_cols=[],
        clases_=clases_,
        scaler=None,
    )




# =============================================================================
# FEATURES PARA LOS MODELOS
# =============================================================================

NUM_COLS_BASE = [
    "monto",
    "monto_umas",
    "monto_6m",
    "ops_6m",
    "monto_max_6m",
    "monto_std_6m",
    "monto_promedio_cliente",
    "ratio_vs_promedio",
    "pct_umbral_aviso",
    "anio",
    "mes",
    "dia_semana",
    "EsEfectivo",
    "EsInternacional",
    "SectorAltoRiesgo",
    "fin_de_semana",
    "es_nocturno",
    "es_monto_redondo",
    "posible_burst",
    "acumulado_alto",
    "efectivo_alto",
    "frecuencia_mensual",
    "ratio_alto",
    "frecuencia_alta",
]

CAT_COLS_BASE = [
    "tipo_operacion",
    "sector_actividad",  # 👈 volver a agregarla
    "fraccion",
]


def build_feature_matrix(
    df: pd.DataFrame,
    feature_cols: Optional[List[str]] = None,
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Construye la matriz de features X a partir de df y la lista de columnas
    que espera el modelo (feature_cols).

    - Si feature_cols se provee: se reindexa df a esas columnas (faltantes = 0).
    - Si no se provee: se infiere un set de columnas numéricas razonable.
    """
    if feature_cols is not None and len(feature_cols) > 0:
        # Usamos exactamente las columnas del bundle
        model_cols = list(feature_cols)
    else:
        # Fallback: inferir columnas numéricas automáticamente
        excl = {
            "cliente_id",
            "fecha",
            "fraccion",
            "sector_actividad",
            "clasificacion_ebr",
            "clasificacion_final",
            "clasificacion_reglas",
            "clasificacion_ml",
            "motivo_preocupante",
            "explicacion_final",
        }
        model_cols = [
            c
            for c in df.columns
            if c not in excl and pd.api.types.is_numeric_dtype(df[c])
        ]
        model_cols = sorted(model_cols)

    # 👇 Aquí estaba el bug: antes ponía `model_cols` sin estar definido
    X = df.reindex(columns=model_cols, fill_value=0)

    return X, model_cols



# =============================================================================
# REGLAS LFPIORPI (LEGALES)
# =============================================================================

def aplicar_reglas_lfpiorpi(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    """
    Calcula banderas legales:
      - flag_aviso_lfpiorpi: monto_umas >= aviso_UMA
      - flag_limite_efectivo: EsEfectivo == 1 y monto_umas > efectivo_max_UMA
      - legal_red_flag: igual que flag_limite_efectivo
      - clasificacion_legal: 'preocupante' si cualquiera es True

    PREOCUPANTE en este runner significa SIEMPRE fundamento legal.
    """
    df = df.copy()
    uma_mxn = get_uma_mxn(cfg)

    flag_aviso = []
    flag_limite = []
    legal_red = []
    motivo_legal = []
    aviso_UMA_list = []
    efectivo_max_UMA_list = []
    monto_umas_list = []
    fraccion_desc_list = []

    for _, row in df.iterrows():
        fr = row.get("fraccion")
        um = obtener_umbrales_fraccion(fr, cfg)
        aviso_UMA = float(um.get("aviso_UMA", 0) or 0)
        efectivo_max_UMA = float(um.get("efectivo_max_UMA", 0) or 0)
        fr_desc = str(um.get("descripcion", "") or "")

        monto_mxn = float(row.get("monto", 0.0) or 0.0)
        monto_umas = float(row.get("monto_umas", monto_mxn / uma_mxn))

        es_efectivo = int(row.get("EsEfectivo", 0) or 0) == 1

        cond_aviso = aviso_UMA > 0 and monto_umas >= aviso_UMA
        cond_limite = efectivo_max_UMA > 0 and es_efectivo and monto_umas > efectivo_max_UMA

        flag_aviso.append(int(cond_aviso))
        flag_limite.append(int(cond_limite))
        legal_red.append(int(cond_limite))
        aviso_UMA_list.append(aviso_UMA)
        efectivo_max_UMA_list.append(efectivo_max_UMA)
        monto_umas_list.append(monto_umas)
        fraccion_desc_list.append(fr_desc)

        m = ""
        if cond_aviso:
            m = (
                f"Monto = {monto_mxn:,.2f} MXN (~{monto_umas:.1f} UMA) "
                f"supera umbral de AVISO ({aviso_UMA:.1f} UMA) para la fracción {fr}."
            )
        if cond_limite:
            if m:
                m += " "
            m += (
                f"Monto en EFECTIVO supera el límite legal de efectivo "
                f"({efectivo_max_UMA:.1f} UMA) para la fracción {fr}."
            )
        motivo_legal.append(m)

    df["flag_aviso_lfpiorpi"] = flag_aviso
    df["flag_limite_efectivo"] = flag_limite
    df["legal_red_flag"] = legal_red
    df["motivo_preocupante_legal"] = motivo_legal

    # Exponer valores UMA útiles para la explicación detallada
    df["aviso_UMA"] = aviso_UMA_list
    df["efectivo_max_UMA"] = efectivo_max_UMA_list
    df["monto_umas"] = monto_umas_list
    df["fraccion_descripcion"] = fraccion_desc_list

    df["clasificacion_legal"] = np.where(
        (df["flag_aviso_lfpiorpi"] == 1) | (df["flag_limite_efectivo"] == 1),
        "preocupante",
        "ninguna",
    )

    return df


# =============================================================================
# APLICACIÓN DE MODELOS
# =============================================================================

def aplicar_no_supervisado(
    df: pd.DataFrame,
    modelo_ns: Optional[ModeloNoSupervisado],
) -> pd.DataFrame:
    df = df.copy()
    if modelo_ns is None:
        df["anomalía_no_sup"] = 0
        df["score_no_sup"] = 0.0
        return df

    X, cols = build_feature_matrix(df, modelo_ns.feature_cols)
    modelo = modelo_ns.modelo

    # Intentamos usar predict (-1 / 1) y decision_function si está disponible
    try:
        # Usamos arrays (sin nombres) para ser consistentes con el entrenamiento
        X_values = X.values
        y_pred = modelo.predict(X)
        df["anomalía_no_sup"] = (y_pred == -1).astype(int)
    except Exception as e:
        log(f"  ⚠️  Error en no supervisado.predict: {e}")
        # fallback a todo 0
        df["anomalía_no_sup"] = 0

    try:
        score = modelo.decision_function(X_values)
        df["score_no_sup"] = score
    except Exception as e:
        log(f"  ⚠️  Error en no supervisado.decision_function: {e}")
        df["score_no_sup"] = 0.0

    return df


def aplicar_supervisado(
    df: pd.DataFrame,
    modelo_sup: Optional[ModeloSupervisado],
) -> pd.DataFrame:
    df = df.copy()
    if modelo_sup is None:
        df["clasificacion_sup"] = "sin_modelo"
        df["prob_inusual_sup"] = 0.0
        return df

    # 1) Construir una matriz base con todas las numéricas + dummies de categóricas
    #    (usa tu build_feature_matrix, pero sin pasar columnas del modelo)
    X_full, cols_full = build_feature_matrix(df, None)

    # 2) Reindexar EXACTAMENTE a las columnas que se usaron en entrenamiento
    cols_model = modelo_sup.feature_cols or cols_full
    X = X_full.reindex(columns=cols_model, fill_value=0)

    # 3) Aplicar scaler si existe en el bundle
    if modelo_sup.scaler is not None:
        try:
            X_scaled = modelo_sup.scaler.transform(X)
        except Exception as e:
            log(f"  ⚠️  Error aplicando scaler supervisado: {e}")
            X_scaled = X
    else:
        X_scaled = X

    modelo = modelo_sup.modelo
    clases = modelo_sup.clases_ or getattr(modelo, "classes_", [])

    proba_inusual = np.zeros(len(df), dtype=float)
    label_pred = np.array(["relevante"] * len(df), dtype=object)

    try:
        if hasattr(modelo, "predict_proba") and len(clases) > 0:
            proba = modelo.predict_proba(X_scaled)
            clases_arr = np.array(clases)
            # tus clases son [0,1], asumimos que 1 = inusual
            if 1 in clases_arr:
                idx = np.where(clases_arr == 1)[0][0]
                proba_inusual = proba[:, idx]
            y_pred = modelo.predict(X_scaled)
            # Mapeamos 0/1 → relevante/inusual
            y_pred = np.where(y_pred == 1, "inusual", "relevante")
            label_pred = y_pred
        else:
            y_pred = modelo.predict(X_scaled)
            y_pred = np.where(y_pred == 1, "inusual", "relevante")
            label_pred = y_pred
    except Exception as e:
        log(f"  ⚠️  Error aplicando modelo supervisado: {e}")
        label_pred = np.array(["relevante"] * len(df), dtype=object)
        proba_inusual = np.zeros(len(df), dtype=float)

    df["clasificacion_sup"] = label_pred
    df["prob_inusual_sup"] = proba_inusual

    return df


# =============================================================================
# FUSIÓN
# =============================================================================

def fusionar_resultados(
    df: pd.DataFrame,
    cfg: Dict[str, Any],
) -> pd.DataFrame:
    """
    Fusión simple:
      1) Si clasificacion_legal == 'preocupante' → clasificacion_final = 'preocupante'
      2) Para el resto:
         - base = 'relevante'
         - si clasificacion_sup == 'inusual' → 'inusual'
         - si anomalía_no_sup == 1 eleva 'relevante' → 'inusual'
         - si score_ebr >= threshold eleva 'relevante' → 'inusual'
    """
    df = df.copy()
    thr_ebr = get_ebr_elevacion_threshold(cfg)

    final = []
    elev_por_ebr = 0
    elev_por_ana = 0
    elev_por_sup = 0

    for _, row in df.iterrows():
        if row.get("clasificacion_legal") == "preocupante":
            final.append("preocupante")
            continue

        lab = "relevante"

        # modelo supervisado
        if row.get("clasificacion_sup") == "inusual":
            lab = "inusual"
            elev_por_sup += 1

        # no supervisado
        if lab == "relevante" and int(row.get("anomalía_no_sup", 0) or 0) == 1:
            lab = "inusual"
            elev_por_ana += 1

        # EBR alto
        if lab == "relevante" and float(row.get("score_ebr", 0.0) or 0.0) >= thr_ebr:
            lab = "inusual"
            elev_por_ebr += 1

        final.append(lab)

    df["clasificacion_final"] = final
    df.attrs["elev_por_sup"] = elev_por_sup
    df.attrs["elev_por_ana"] = elev_por_ana
    df.attrs["elev_por_ebr"] = elev_por_ebr

    return df


# =============================================================================
# EXPLICACIONES
# =============================================================================


def construir_explicacion_simple(row: pd.Series) -> str:
    """
    Explicación corta y amigable para el usuario final.
    Responde básicamente: ¿por qué es preocupante / inusual / relevante?
    """
    clasif = (row.get("clasificacion_final") or "relevante").lower()
    fraccion = (row.get("fraccion") or "").strip()
    explic_legal = (row.get("motivo_preocupante_legal") or "").strip()

    score_ebr = float(row.get("score_ebr", 0.0) or 0.0)
    es_efectivo = bool(row.get("EsEfectivo", 0))
    efectivo_alto = bool(row.get("efectivo_alto", 0))
    acumulado_alto = bool(row.get("acumulado_alto", 0))

    # 1) PREOCUPANTE → manda la LEY
    if clasif == "preocupante":
        # Si el validador legal ya escribió un texto, lo usamos, pero corto
        if explic_legal:
            if fraccion:
                return f"Rebasa umbrales legales de la fracción {fraccion}. {explic_legal}"
            return f"Rebasa umbrales legales establecidos por LFPIORPI. {explic_legal}"
        return "Rebasa umbrales legales o internos de riesgo establecidos por LFPIORPI."

    # 2) INUSUAL → efectivo / acumulado / patrón raro, pero sin violar la ley
    if clasif == "inusual":
        # Caso típico: efectivo alto o acumulado alto
        if es_efectivo and (efectivo_alto or acumulado_alto):
            return (
                "El uso de efectivo o su acumulación es alto para el perfil del cliente; "
                "aunque no rebasa los límites legales, recomendamos observar su comportamiento."
            )

        # Si no tenemos flags de efectivo pero el EBR salió alto
        if score_ebr > 0:
            return (
                "Presenta un patrón poco habitual de monto o frecuencia; "
                "recomendamos revisión del perfil del cliente."
            )

        # Fallback
        return "Comportamiento poco habitual para el cliente; recomendamos monitoreo."

    # 3) RELEVANTE → nada raro
    return "No se detectó nada anormal en esta operación."





def agregar_explicaciones(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["explicacion"] = df.apply(construir_explicacion_simple, axis=1)
    return df



# =============================================================================
# JSON PARA PORTAL (compatible con complete_portal)
# =============================================================================

def _nivel_riesgo_from_clasif(clasif: str) -> str:
    """
    Mapea la etiqueta final a nivel de riesgo semántico
    (bajo / medio / alto) para el portal.
    """
    c = (clasif or "").strip().lower()
    if c == "preocupante":
        return "alto"
    if c == "inusual":
        return "medio"
    return "bajo"


def _build_tx_json_portal(row: pd.Series, idx: int) -> Dict[str, Any]:
    """
    Construye el dict de UNA operación en el formato que el portal
    espera en result.transacciones[*].

    Campos usados en el frontend (complete_portal_ui_ult.tsx):
      - id
      - monto
      - fecha
      - tipo_operacion
      - sector_actividad
      - clasificacion_final / clasificacion
      - score_ebr
      - explicacion_principal
      - explicacion_detallada
      - razones[]
      - nivel_riesgo
      - nivel_confianza
      - flags
      - contexto_regulatorio
      - acciones_sugeridas
      - probabilidades
      - origen
      - hora
    """
    # ------------------------------
    # Campos base de la operación
    # ------------------------------
    clasif_final = str(row.get("clasificacion_final", "relevante") or "relevante")
    clasif_sup = str(row.get("clasificacion_sup", "relevante") or "relevante")
    clasif_ebr = str(row.get("clasificacion_ebr", "relevante") or "relevante")

    nivel_riesgo = _nivel_riesgo_from_clasif(clasif_final)

    # IDs: `cliente_id` es la única fuente de identidad del cliente.
    cliente_id = row.get("cliente_id") or None

    monto = float(row.get("monto", 0.0) or 0.0)
    fecha = str(row.get("fecha", "") or "")
    hora = str(row.get("hora", "") or "") or "N/A"
    tipo_operacion = str(row.get("tipo_operacion", "") or "")
    sector_actividad = str(row.get("sector_actividad", "") or "")

    # ------------------------------
    # Índice EBR y detalle por factor
    # ------------------------------
    score_ebr = float(row.get("score_ebr", 0.0) or 0.0)
    detalles_ebr = str(row.get("detalles_ebr", "") or "")

    # Texto tipo: "Índice EBR = 60 (detalle: efectivo: +25; efectivo alto: +15; ...)"
    if score_ebr > 0:
        ebr_resumen_texto = f"Índice EBR = {score_ebr:.0f}"
        if detalles_ebr:
            ebr_resumen_texto += f" (detalle: {detalles_ebr})"
    else:
        ebr_resumen_texto = "Índice EBR sin factores relevantes."

    # ------------------------------
    # Reglas LFPIORPI (legales)
    # ------------------------------
    flag_aviso = int(row.get("flag_aviso_lfpiorpi", 0) or 0)
    flag_limite_efectivo = int(row.get("flag_limite_efectivo", 0) or 0)
    legal_red_flag = int(row.get("legal_red_flag", 0) or 0)
    motivo_legal = str(row.get("motivo_preocupante_legal", "") or "")

    # ------------------------------
    # Modelos ML (sup / no sup)
    # ------------------------------
    anomalia_no_sup = int(row.get("anomalía_no_sup", 0) or 0)
    prob_inusual_sup = float(row.get("prob_inusual_sup", 0.0) or 0.0)

    # ------------------------------
    # Razones (para chips en UI)
    # ------------------------------
    razones: List[str] = []

    if flag_aviso == 1:
        razones.append("Monto por encima del umbral de AVISO LFPIORPI")
    if flag_limite_efectivo == 1:
        razones.append("Límite legal de EFECTIVO superado")
    if score_ebr > 0:
        razones.append(f"Índice EBR = {score_ebr:.0f}")
    if clasif_ebr == "inusual":
        razones.append("EBR clasifica la operación como inusual")
    if clasif_sup == "inusual":
        razones.append(
            f"Modelo supervisado marcó 'inusual' (prob. ≈ {prob_inusual_sup * 100:.1f}%)"
        )
    if anomalia_no_sup == 1:
        razones.append("Modelo no supervisado detectó un patrón atípico")

    # Añadimos top 3 factores EBR tipo:
    # "Principales factores EBR: efectivo: +25; efectivo alto: +15; burst: +10"
    if detalles_ebr:
        partes = [p.strip() for p in detalles_ebr.split(";") if p.strip()]
        top3 = partes[:3]
        if top3:
            razones.append("Principales factores EBR: " + "; ".join(top3))

    # ------------------------------
    # Nivel de confianza (si deciden usarlo en la UI)
    # ------------------------------
    if legal_red_flag == 1 or prob_inusual_sup >= 0.80:
        nivel_confianza = "alta"
    elif prob_inusual_sup >= 0.60:
        nivel_confianza = "media"
    else:
        nivel_confianza = "baja"

    # ------------------------------
    # Explicaciones (simple + detallada)
    # ------------------------------
    explicacion_simple = construir_explicacion_simple(row)

    lineas_detalle: List[str] = []
    lineas_detalle.append(
        f"Clasificación final: {clasif_final.upper()} (nivel de riesgo {nivel_riesgo})."
    )
    lineas_detalle.append(ebr_resumen_texto)

    # Reglas legales
    if motivo_legal:
        # Intentamos construir una línea explícita indicando cuánto supera en UMA
        aviso_UMA_row = float(row.get("aviso_UMA", 0.0) or 0.0)
        monto_umas_row = float(row.get("monto_umas", 0.0) or 0.0)
        fr = str(row.get("fraccion") or "")
        if aviso_UMA_row > 0:
            delta = monto_umas_row - aviso_UMA_row
            lineas_detalle.append(
                f"Fundamento legal LFPIORPI: Monto = {monto:,.2f} MXN (~{monto_umas_row:.1f} UMA) "
                f"supera en {delta:.1f} UMA el umbral de AVISO ({aviso_UMA_row:.1f} UMA) para la fracción {fr}."
            )
        else:
            lineas_detalle.append(f"Fundamento legal LFPIORPI: {motivo_legal}")
    else:
        # Si no hay motivo legal, incluimos la descripción/artículo de la fracción si está disponible
        fr_desc = str(row.get("fraccion_descripcion") or "").strip()
        if fr_desc:
            lineas_detalle.append(f"Reglas LFPIORPI ({fr_desc}): sin disparos legales en esta operación.")
        else:
            lineas_detalle.append("Reglas LFPIORPI: sin disparos legales en esta operación.")

    # Modelo supervisado
    if clasif_sup == "inusual":
        lineas_detalle.append(
            f"Modelo supervisado: etiquetó la operación como 'inusual' con probabilidad aproximada de {prob_inusual_sup * 100:.1f}%."
        )
    else:
        lineas_detalle.append(
            "Modelo supervisado: no detectó inusualidad significativa."
        )

    # Modelo no supervisado
    if anomalia_no_sup == 1:
        lineas_detalle.append(
            "Modelo no supervisado: detectó un patrón atípico en el comportamiento de montos y/o frecuencia."
        )
    else:
        lineas_detalle.append(
            "Modelo no supervisado: no detectó anomalías adicionales."
        )

    # Recomendación final
    if clasif_final in ("preocupante", "inusual"):
        lineas_detalle.append(
            "Recomendación: la operación debe ser revisada por el oficial de cumplimiento."
        )
    else:
        lineas_detalle.append(
            "Recomendación: la operación se considera dentro de un rango normal, sin alertas relevantes."
        )

    explicacion_detallada = "\n".join(lineas_detalle)

    # ------------------------------
    # Flags y acciones sugeridas
    # ------------------------------
    flags = {
        "requiere_revision_manual": clasif_final in ("preocupante", "inusual"),
        "sugerir_reclasificacion": False,
        "alertas": [],
    }

    acciones_sugeridas: List[str] = []
    if clasif_final == "preocupante":
        acciones_sugeridas.append(
            "Revisar fundamento legal LFPIORPI y preparar, en su caso, el aviso correspondiente."
        )
        acciones_sugeridas.append(
            "Validar coherencia de la operación con el perfil transaccional del cliente."
        )
    elif clasif_final == "inusual":
        acciones_sugeridas.append(
            "Analizar si la operación es consistente con el comportamiento histórico del cliente."
        )
        acciones_sugeridas.append(
            "Documentar el análisis interno y decisión de seguimiento."
        )

    # ------------------------------
    # ICA (índice de confianza): para 'preocupante' y 'relevante' mostramos 100%
    # (indica confianza operativa en la clasificación por reglas/umbrales)
    # ------------------------------
    if clasif_final in ("preocupante", "relevante"):
        ica_val = 1.0
    else:
        ica_val = max(0.0, min(1.0, prob_inusual_sup))

    # ------------------------------
    # Origen principal de la alerta (forzamos 'lfpiorpi' si la clasificación final es 'preocupante')
    # ------------------------------
    if clasif_final == "preocupante":
        origen = "lfpiorpi"
    elif legal_red_flag == 1:
        origen = "lfpiorpi"
    elif clasif_ebr == "inusual":
        origen = "ebr"
    elif clasif_sup == "inusual" or anomalia_no_sup == 1:
        origen = "ml"
    else:
        origen = "sin_alerta"

    # ------------------------------
    # Contexto regulatorio corto
    # ------------------------------
    if legal_red_flag == 1 and motivo_legal:
        contexto_regulatorio = (
            "Esta operación se considera preocupante por criterios LFPIORPI. "
            + motivo_legal
        )
    else:
        contexto_regulatorio = ""

    # ------------------------------
    # Ajustes finales: construir exactamente 3 razones en el orden solicitado:
    # 1) LFPIORPI (cumple / no cumple)
    # 2) Enfoque Basado en Riesgos = <score_ebr>
    # 3) Resultado ML (supervisado / no supervisado)
    # ------------------------------
    # Razón 1: LFPIORPI (texto por clasificación)
    if clasif_final == "preocupante":
        if motivo_legal:
            razon_lfpiorpi = f"LFPIORPI: REBASA LOS LIMITES MAXIMOS DEFINIDOS EN LFPIORPI ({motivo_legal})"
        else:
            razon_lfpiorpi = "LFPIORPI: REBASA LOS LIMITES MAXIMOS DEFINIDOS EN LFPIORPI"
    else:
        razon_lfpiorpi = "LFPIORPI: NO REBASA LIMITES MAXIMOS DEFINIDOS EN LFPIORPI"

    # Razón 2: EBR (Enfoque Basado en Riesgos)
    try:
        razon_ebr = f"INDICE EBR: Enfoque Basado en Riesgos = {int(score_ebr)}"
    except Exception:
        razon_ebr = f"INDICE EBR: Enfoque Basado en Riesgos = {score_ebr}"

    # Razón 3: Resultado ML (resumen de supervisado + no supervisado)
    parts_ml: List[str] = []
    if clasif_sup == "inusual":
        parts_ml.append(f"supervisado=INUSUAL ({prob_inusual_sup * 100:.1f}%)")
    else:
        parts_ml.append("supervisado=RELEVANTE")

    if anomalia_no_sup == 1:
        parts_ml.append("no supervisado=ANOMALÍA")
    else:
        parts_ml.append("no supervisado=NORMAL")

    razon_ml = "Resultado ML: " + "; ".join(parts_ml)

    razones_unicas = [razon_lfpiorpi, razon_ebr, razon_ml]

    # ------------------------------
    # Señales de anomalía (detalle para el no supervisado)
    # ------------------------------
    if anomalia_no_sup == 1:
        detalles_anomalia = row.get("detalles_anomalia") or row.get("anomaly_details") or "Anomalía detectada por el modelo no supervisado."
        señales_anomalia = detalles_anomalia
    else:
        señales_anomalia = "No se detectaron anomalías significativas"

    # ------------------------------
    # Acciones sugeridas: simplificadas para preocupante
    # ------------------------------
    if clasif_final == "preocupante":
        acciones_sugeridas = ["Preparar reporte XML de aviso a UIF"]

    # ------------------------------
    # Dict final de transacción (lo que ve el front)
    # - `id` será `cliente_id` si existe, para que el modal muestre el ID cliente como cabecera
    # - eliminamos campo `probabilidades` por ser confuso
    # ------------------------------
    # Añadir información UMA máxima conforme LFPIORPI al final de la explicación detallada
    monto_umas_row = float(row.get("monto_umas", 0.0) or 0.0)
    efectivo_max_UMA_row = float(row.get("efectivo_max_UMA", 0.0) or 0.0)
    uma_append = ""
    if row.get("monto_umas") is not None:
        uma_append = (
            f"\nMonto aproximado en UMA: {monto_umas_row:.1f} UMA /DE MAX_UMA({efectivo_max_UMA_row:.1f} UMA)"
        )

    return {
        "id": str(cliente_id) if cliente_id else None,
        "cliente_id": str(cliente_id) if cliente_id else None,
        "monto": monto,
        "monto_umas": float(row.get("monto_umas", 0.0) or 0.0),
        "fecha": fecha,
        "hora": hora,
        "tipo_operacion": tipo_operacion,
        "sector_actividad": sector_actividad,
        "clasificacion_final": clasif_final,
        "score_ebr": score_ebr,
        "nivel_riesgo": nivel_riesgo,
        "ica": ica_val,
        "explicacion_principal": explicacion_simple,
        "explicacion_detallada": explicacion_detallada + uma_append,
        "razones": razones_unicas,
        "nivel_confianza": nivel_confianza,
        "flags": flags,
        "contexto_regulatorio": contexto_regulatorio,
        "acciones_sugeridas": acciones_sugeridas,
        "señales_anomalia": señales_anomalia,
        "origen": origen,
    }


def construir_json_portal(
    df: pd.DataFrame,
    analysis_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Construye el JSON completo que el endpoint /api/portal/upload puede devolver
    y que el componente TarantulaHawkPortal entiende sin transformaciones raras.
    """
    df = df.copy()
    # Si faltan `cliente_id` en el CSV, rellenar con consecutivos empezando en 12345.
    # Nota: el validador de subida debería evitar CSVs con campos vacíos; aquí
    # aplicamos un fallback para que la UI tenga siempre un identificador.
    if "cliente_id" not in df.columns:
        df["cliente_id"] = None
    missing_mask = df["cliente_id"].isnull() | (df["cliente_id"].astype(str).str.strip() == "")
    if missing_mask.any():
        start = 12345
        n = int(missing_mask.sum())
        ids = [str(start + i) for i in range(n)]
        df.loc[missing_mask, "cliente_id"] = ids
        log(f"⚠️  Se asignaron {n} cliente_id consecutivos iniciando en {start} para filas faltantes. El validador debe evitar campos vacíos en el CSV.")
    total = len(df)
    dist = df["clasificacion_final"].value_counts(dropna=False).to_dict()

    n_relevante = int(dist.get("relevante", 0))
    n_inusual = int(dist.get("inusual", 0))
    n_preocupante = int(dist.get("preocupante", 0))

    # Discrepancias simples entre EBR y clasificación final
    if "clasificacion_ebr" in df.columns:
        mask_ebr_inusual = df["clasificacion_ebr"] == "inusual"
        mask_final_relevante = df["clasificacion_final"] == "relevante"
        discrepancias = int((mask_ebr_inusual & mask_final_relevante).sum())
    else:
        discrepancias = 0

    porc_discrepancias = float((discrepancias / total) * 100.0) if total > 0 else 0.0

    # Alertas generadas (todo lo que no es relevante)
    alertas_generadas = int((df["clasificacion_final"] != "relevante").sum())

    resumen: Dict[str, Any] = {
        "total_transacciones": total,
        "clasificacion_final": {
            "relevante": n_relevante,
            "inusual": n_inusual,
            "preocupante": n_preocupante,
        },
        "discrepancias_ebr_ml": {
            "total": discrepancias,
            "porcentaje": round(porc_discrepancias, 2),
        },
        "alertas_generadas": alertas_generadas,
        # Por si quieres mostrar la “estrategia” usada en UI
        "estrategia": "hibrida_lfpiorpi_ebr_ml",
    }

    # Lista de transacciones explicadas
    transacciones: List[Dict[str, Any]] = []
    for idx, row in df.reset_index(drop=True).iterrows():
        transacciones.append(_build_tx_json_portal(row, idx))

    return {
        "analysis_id": analysis_id,
        "resumen": resumen,
        "transacciones": transacciones,
    }





# =============================================================================
# RESUMEN JSON
# =============================================================================

def construir_resumen_json(df: pd.DataFrame, analysis_id: Optional[str] = None) -> Dict[str, Any]:
    total = len(df)
    dist = df["clasificacion_final"].value_counts(dropna=False).to_dict()

    resumen = {
        "analysis_id": analysis_id,
        "total_operaciones": total,
        "distribucion": {
            "relevante": int(dist.get("relevante", 0)),
            "inusual": int(dist.get("inusual", 0)),
            "preocupante": int(dist.get("preocupante", 0)),
        },
        "elevadas_por": {
            "supervisado": int(df.attrs.get("elev_por_sup", 0)),
            "no_supervisado": int(df.attrs.get("elev_por_ana", 0)),
            "ebr": int(df.attrs.get("elev_por_ebr", 0)),
        },
    }

    return resumen


# =============================================================================
# PIPELINE PRINCIPAL
# =============================================================================

def procesar_df_enriquecido(
    df: pd.DataFrame,
    cfg: Dict[str, Any],
    modelo_ns: Optional[ModeloNoSupervisado],
    modelo_sup: Optional[ModeloSupervisado],
    analysis_id: Optional[str] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    log("  ⚖️ Paso 0: Reglas LFPIORPI (legales)...")
    df = aplicar_reglas_lfpiorpi(df, cfg)

    log("  📊 Paso 1: Índice EBR...")
    df = calcular_ebr(df, cfg)

    log("  🔍 Paso 2: Modelo no supervisado...")
    df = aplicar_no_supervisado(df, modelo_ns)

    log("  🤖 Paso 3: Modelo supervisado...")
    df = aplicar_supervisado(df, modelo_sup)

    log("  🔀 Paso 4: Fusión...")
    df = fusionar_resultados(df, cfg)

    log("  📝 Paso 5: Explicaciones...")
    df = agregar_explicaciones(df)

    resumen = construir_resumen_json(df, analysis_id=analysis_id)

    # Log resumen
    dist = resumen["distribucion"]
    total = max(resumen["total_operaciones"], 1)
    log("")
    log("  📊 DISTRIBUCIÓN FINAL:")
    log(f"     🔴 Preocupante: {dist['preocupante']} ({dist['preocupante'] / total:.1%})")
    log(f"     🟡 Inusual:     {dist['inusual']} ({dist['inusual'] / total:.1%})")
    log(f"     🟢 Relevante:   {dist['relevante']} ({dist['relevante'] / total:.1%})")
    log("")

    return df, resumen


def run_for_file(
    input_csv: Path,
    output_csv: Path,
    cfg: Dict[str, Any],
    analysis_id: Optional[str] = None,
) -> Dict[str, Any]:
    log("=" * 70)
    log(f"📄 Procesando: {input_csv.name}")
    df = pd.read_csv(input_csv)
    log(f"  📊 Cargado: {len(df)} filas")

    # modelos
    log("")
    log("  📦 Cargando modelos...")
    modelo_ns = _load_no_supervisado(cfg)
    modelo_sup = _load_supervisado(cfg)

    df_out, resumen = procesar_df_enriquecido(df, cfg, modelo_ns, modelo_sup, analysis_id)

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df_out.to_csv(output_csv, index=False, encoding="utf-8")
    log(f"  ✅ CSV:  {output_csv.name}")

    # JSON V2: incluir resumen + transacciones (compatibilidad con enhanced_main_api)
    output_json_v2 = output_csv.with_name(f"{output_csv.stem}_v2.json")
    full_results = construir_json_portal(df_out, analysis_id=analysis_id)
    # construir_json_portal ya retorna {'analysis_id','resumen','transacciones'} compatible
    with output_json_v2.open("w", encoding="utf-8") as f:
        json.dump(full_results, f, indent=2, ensure_ascii=False)

    # También guardar un JSON legacy (solo resumen) para compatibilidad hacia atrás
    output_json = output_csv.with_suffix(".json")
    with output_json.open("w", encoding="utf-8") as f:
        json.dump(resumen, f, indent=2, ensure_ascii=False)

    log(f"  ✅ JSON: {output_json.name}")
    log(f"  ✅ JSON v2: {output_json_v2.name}")
    log("=" * 70)
    return full_results


# =============================================================================
# CLI
# =============================================================================

def _run_portal_mode(analysis_id: str, config_path: Optional[str]) -> int:
    cfg = load_config(config_path)

    input_csv = PENDING_DIR / f"{analysis_id}.csv"
    if not input_csv.exists():
        log(f"❌ No se encontró archivo en pendiente: {input_csv}")
        return 1

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_csv = PROCESSED_DIR / f"{analysis_id}.csv"

    run_for_file(input_csv, output_csv, cfg, analysis_id=analysis_id)
    return 0


def _run_cli_mode(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)

    input_csv = Path(args.input)
    if not input_csv.exists():
        log(f"❌ No se encontró archivo de entrada: {input_csv}")
        return 1

    output_csv = Path(args.output)
    run_for_file(input_csv, output_csv, cfg, analysis_id=None)
    return 0


def parse_args_cli(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ML Runner v6 - reglas LFPIORPI + EBR + modelos"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="CSV enriquecido de entrada",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="CSV de salida con clasificaciones",
    )
    parser.add_argument(
        "--config",
        required=False,
        help="Ruta a config_modelos_v4.json (opcional, se intenta auto-detectar si no se pasa)",
    )
    return parser.parse_args(argv)


def main() -> int:
    # Modo portal: primer argumento sin prefijo se toma como analysis_id
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        analysis_id = sys.argv[1]
        log(f"🤖 Ejecutando ML runner (modo portal) para analysis_id={analysis_id}...")
        return _run_portal_mode(analysis_id, config_path=None)

    # Modo CLI tradicional
    args = parse_args_cli(sys.argv[1:])
    log("🤖 Ejecutando ML runner (modo CLI)...")
    return _run_cli_mode(args)


if __name__ == "__main__":
    raise SystemExit(main())
