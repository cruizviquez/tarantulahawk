#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validador_enriquecedor_v2.py - VERSIÓN OPTIMIZADA (AJUSTE REGLAS LFPORPI)

Mejoras clave en esta versión:
- Mantiene rolling 180D optimizado y features enriquecidas.
- Reglas de clasificación LFPORPI suavizadas:
  * "preocupante" sigue estrictamente el umbral de aviso / efectivo / acumulado 6m.
  * "inusual" requiere combinaciones de factores (monto relativo al umbral + patrón),
    ya NO basta con que sea nocturna, fin de semana, internacional o con frecuencia aislada.
- NO incluye EBR ni score_ebr: solo genera 'clasificacion_lfpiorpi' como target.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [validador] {msg}", flush=True)

CAMPOS_OBLIGATORIOS = ["cliente_id", "monto", "fecha", "tipo_operacion"]

TIPOS_OPERACION_VALIDOS = [
    "efectivo",
    "tarjeta",
    "transferencia_nacional",
    "transferencia_internacional",
]

SECTORES_DEFAULT = [
    "casa_cambio",
    "joyeria_metales",
    "arte_antiguedades",
    "transmision_dinero",
    "inmobiliaria",
    "automotriz",
    "traslado_valores",
    "activos_virtuales",
    "notaria",
    "servicios_financieros",
]

# --------------------------------------------------------------------
# Carga de configuración
# --------------------------------------------------------------------
def _candidate_configs(from_file: Path) -> list[Path]:
    return [
        from_file.parents[2] / "models" / "config_modelos.json",
        from_file.parents[2] / "config" / "config_modelos.json",
        Path.cwd() / "app" / "backend" / "models" / "config_modelos.json",
        Path.cwd() / "app" / "backend" / "config" / "config_modelos.json",
        Path("config_modelos.json"),
    ]

def load_config(path_cfg: str | None) -> dict:
    here = Path(__file__).resolve()
    if path_cfg:
        p = Path(path_cfg)
        if p.exists():
            log(f"Config encontrado (argumento): {p}")
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        else:
            log(f"⚠️ Ruta de config (argumento) no existe: {p}. Buscando candidatos…")
    for cand in _candidate_configs(here):
        if cand.exists():
            log(f"Config encontrado (auto): {cand}")
            with open(cand, "r", encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError("No se encontró config_modelos.json en ubicaciones conocidas.")

# --------------------------------------------------------------------
# Helpers LFPORPI (umbrales en MXN)
# --------------------------------------------------------------------
def uma_to_mxn(uma_diaria: float, uma_count) -> float:
    if uma_count is None or (isinstance(uma_count, float) and not np.isfinite(uma_count)):
        return 1e12
    try:
        return float(uma_diaria) * float(uma_count)
    except Exception:
        return 1e12

def aviso_mxn(fr: str, cfg: dict) -> float:
    law = cfg.get("lfpiorpi", {})
    UMA = float(law.get("uma_diaria", 113.14))
    umbrales = law.get("umbrales", {})
    u = umbrales.get(fr, {})
    return uma_to_mxn(UMA, u.get("aviso_UMA", None))

def efectivo_lim_mxn(fr: str, cfg: dict) -> float:
    law = cfg.get("lfpiorpi", {})
    UMA = float(law.get("uma_diaria", 113.14))
    umbrales = law.get("umbrales", {})
    u = umbrales.get(fr, {})
    return uma_to_mxn(UMA, u.get("efectivo_max_UMA", None))

# --------------------------------------------------------------------
# Validación de estructura
# --------------------------------------------------------------------
def validar_estructura(df: pd.DataFrame):
    rep = {"archivo_valido": True, "errores": [], "advertencias": []}
    df = df.copy()
    df.columns = df.columns.str.strip().str.lower()

    missing = [c for c in CAMPOS_OBLIGATORIOS if c not in df.columns]
    if missing:
        rep["archivo_valido"] = False
        rep["errores"].append(f"Faltan columnas obligatorias: {missing}")
        return None, rep

    df["cliente_id"] = df["cliente_id"].astype(str).str.strip()
    df["monto"] = pd.to_numeric(df["monto"], errors="coerce")
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df["tipo_operacion"] = df["tipo_operacion"].astype(str).str.strip().str.lower()

    mask = (
        (df["cliente_id"] != "") &
        (~df["monto"].isna()) & (df["monto"] > 0) &
        (~df["fecha"].isna()) &
        (df["tipo_operacion"].isin(TIPOS_OPERACION_VALIDOS))
    )
    dropped = int(len(df) - mask.sum())
    if dropped > 0:
        rep["advertencias"].append(f"Eliminados {dropped} registros inválidos")
    df = df[mask].reset_index(drop=True)

    if len(df) == 0:
        rep["archivo_valido"] = False
        rep["errores"].append("No quedan registros válidos tras limpieza.")
        return None, rep

    return df, rep

# --------------------------------------------------------------------
# Sector
# --------------------------------------------------------------------
def add_sector(df: pd.DataFrame, sector_arg: str, cfg: dict):
    df = df.copy()
    if sector_arg == "random":
        sectores_cfg = list(cfg.get("lfpiorpi", {}).get("actividad_a_fraccion", {}).keys())
        sectores = sectores_cfg if sectores_cfg else SECTORES_DEFAULT
        df["sector_actividad"] = np.random.choice(sectores, size=len(df))
    else:
        df["sector_actividad"] = str(sector_arg)
    return df

# --------------------------------------------------------------------
# Rolling 180D optimizado
# --------------------------------------------------------------------
def calcular_rolling_optimizado(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["cliente_id", "fecha"]).copy()
    df_rolling = df.set_index("fecha").groupby("cliente_id", group_keys=False)

    df["monto_6m"] = df_rolling["monto"].rolling("180D", min_periods=1).sum().values
    df["ops_6m"] = df_rolling["monto"].rolling("180D", min_periods=1).count().values
    df["monto_max_6m"] = df_rolling["monto"].rolling("180D", min_periods=1).max().values
    df["monto_std_6m"] = df_rolling["monto"].rolling("180D", min_periods=1).std().fillna(0).values

    return df

# --------------------------------------------------------------------
# Features de red / grafo
# --------------------------------------------------------------------
def calcular_features_red(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    n_clientes = df["cliente_id"].nunique()

    if n_clientes > 1:
        ops_por_cliente = df.groupby("cliente_id").size()
        df["ops_relativas"] = df["cliente_id"].map(ops_por_cliente) / len(df)

        from scipy.stats import entropy
        tipo_counts = df.groupby("cliente_id")["tipo_operacion"].value_counts(normalize=True)
        tipo_entropy = tipo_counts.groupby(level=0).apply(lambda x: entropy(x))
        df["diversidad_operaciones"] = df["cliente_id"].map(tipo_entropy).fillna(0)

        df_sorted = df.sort_values(["cliente_id", "fecha"])
        df_sorted["dias_desde_anterior"] = df_sorted.groupby("cliente_id")["fecha"].diff().dt.days
        dias_std = df_sorted.groupby("cliente_id")["dias_desde_anterior"].std()
        df["concentracion_temporal"] = df["cliente_id"].map(dias_std).fillna(0)
    else:
        df["ops_relativas"] = 1.0
        df["diversidad_operaciones"] = 0.0
        df["concentracion_temporal"] = 0.0

    return df

# --------------------------------------------------------------------
# Enriquecimiento + clasificación LFPORPI (sin EBR)
# --------------------------------------------------------------------
def enrich_features(df: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    df = df.copy()

    # 1. Flags básicas
    df["EsEfectivo"] = (df["tipo_operacion"] == "efectivo").astype(int)
    df["EsInternacional"] = (df["tipo_operacion"] == "transferencia_internacional").astype(int)

    # 2. Sector alto riesgo
    alto_riesgo = set(cfg.get("lfpiorpi", {}).get("actividad_alto_riesgo", []))
    df["sector_actividad"] = df["sector_actividad"].astype(str)
    df["SectorAltoRiesgo"] = df["sector_actividad"].isin(alto_riesgo).astype(int)

    # 3. Features temporales
    df["mes"] = df["fecha"].dt.month.astype(int)
    df["dia_semana"] = df["fecha"].dt.weekday.astype(int)
    df["quincena"] = df["fecha"].dt.day.between(13, 17).astype(int)
    df["fin_de_semana"] = (df["fecha"].dt.weekday >= 5).astype(int)
    df["hora"] = df["fecha"].dt.hour.astype(int)
    df["es_nocturno"] = ((df["hora"] >= 22) | (df["hora"] <= 6)).astype(int)

    # 4. Frecuencia mensual (dentro del archivo)
    df["frecuencia_mensual"] = df.groupby("cliente_id")["fecha"].transform("count").astype(int)

    # 5. Fracción normativa
    act2frac = cfg.get("lfpiorpi", {}).get("actividad_a_fraccion", {})
    df["fraccion"] = df["sector_actividad"].map(act2frac).fillna(df["sector_actividad"])

    # 6. Rolling 180D
    log("  · Calculando rolling 180D (optimizado)…")
    df = calcular_rolling_optimizado(df)

    # 7. Features de red/grafo
    log("  · Calculando features de red…")
    df = calcular_features_red(df)

    # 8. Comportamiento adicional
    monto_promedio_cliente = df.groupby("cliente_id")["monto"].transform("mean")
    df["ratio_vs_promedio"] = (df["monto"] / monto_promedio_cliente).replace([np.inf, -np.inf], np.nan).fillna(1.0)
    df["es_monto_redondo"] = (df["monto"] % 10000 == 0).astype(int)

    df_sorted = df.sort_values(["cliente_id", "fecha"])
    df_sorted["segundos_desde_anterior"] = (
        df_sorted.groupby("cliente_id")["fecha"].diff().dt.total_seconds()
    )
    df["posible_burst"] = (df_sorted["segundos_desde_anterior"] < 3600).fillna(0).astype(int)

    # --------------------------------------------------
    # REGLAS LFPORPI - CLASIFICACIÓN (SIN EBR)
    # --------------------------------------------------
    labels = []
    for _, row in df.iterrows():
        fr = row["fraccion"]
        umbral = aviso_mxn(fr, cfg)
        lim_ef = efectivo_lim_mxn(fr, cfg)
        monto = float(row["monto"])
        es_ef = int(row["EsEfectivo"]) == 1
        m6 = float(row["monto_6m"])
        ops6 = int(row["ops_6m"])
        es_int = int(row["EsInternacional"]) == 1
        sector_riesgo = int(row["SectorAltoRiesgo"]) == 1
        es_noct = int(row["es_nocturno"]) == 1
        es_weekend = int(row["fin_de_semana"]) == 1
        ratio = float(row["ratio_vs_promedio"])

        # Para reglas graduadas
        thr_70_umbral = 0.7 * umbral
        thr_50_umbral = 0.5 * umbral
        thr_70_lim_ef = 0.7 * lim_ef

        # 1) PREOCUPANTE -> alineado a LFPORPI
        es_preocupante = (
            (monto >= umbral) or
            (es_ef and monto >= lim_ef) or
            ((monto < umbral) and (m6 >= umbral))
        )
        if es_preocupante:
            labels.append("preocupante")
            continue

        # 2) INUSUAL -> requiere combinaciones, no flags aislados
        cond_sector_riesgo = sector_riesgo and (monto >= 0.3 * umbral)

        cond_int_freq_monto = (
            es_int and
            ops6 >= 3 and
            monto >= thr_70_umbral and
            m6 >= thr_70_umbral
        )

        cond_noct_efectivo = (
            es_ef and
            es_noct and
            (monto >= thr_70_lim_ef)
        )

        cond_weekend_cash = (
            es_ef and
            es_weekend and
            (monto >= thr_70_lim_ef)
        )

        cond_freq_monto = (
            ops6 >= 3 and
            m6 >= thr_70_umbral
        )

        cond_ratio = (
            ratio > 3.0 and
            monto >= thr_50_umbral
        )

        es_inusual = any([
            cond_sector_riesgo,
            cond_int_freq_monto,
            cond_noct_efectivo,
            cond_weekend_cash,
            cond_freq_monto,
            cond_ratio,
        ])

        labels.append("inusual" if es_inusual else "relevante")

    df["clasificacion_lfpiorpi"] = labels

    # --------------------------------------------------
    # Selección final de columnas para ML
    # --------------------------------------------------
    columnas_finales = [
        # Base
        "cliente_id", "monto", "fecha", "tipo_operacion",
        # Sector / fracción
        "sector_actividad", "fraccion",
        # Flags
        "EsEfectivo", "EsInternacional", "SectorAltoRiesgo",
        "fin_de_semana", "es_nocturno", "es_monto_redondo",
        # Temporales
        "frecuencia_mensual", "mes", "dia_semana", "quincena",
        # Rolling
        "monto_6m", "ops_6m", "monto_max_6m", "monto_std_6m",
        # Red / grafo
        "ops_relativas", "diversidad_operaciones", "concentracion_temporal",
        # Comportamiento
        "ratio_vs_promedio", "posible_burst",
        # Target
        "clasificacion_lfpiorpi",
    ]

    columnas_finales = [c for c in columnas_finales if c in df.columns]
    df = df[columnas_finales]

    # Sanitizar numéricas
    num_cols = df.select_dtypes(include=[np.number]).columns
    df[num_cols] = df[num_cols].replace([np.inf, -np.inf], np.nan)
    med = df[num_cols].median()
    df[num_cols] = df[num_cols].fillna(med)

    return df

# --------------------------------------------------------------------
# Orquestador
# --------------------------------------------------------------------
def procesar_archivo(input_csv: str, sector_actividad: str, config_path: str | None, training_mode: bool = False, analysis_id: str | None = None):
    log("==== INICIO VALIDACIÓN/ENRIQUECIMIENTO V2 (optimizado, sin EBR) ====")
    input_csv = str(Path(input_csv).resolve())
    log(f"Archivo de entrada: {input_csv}")
    log(f"Sector actividad: {sector_actividad}")

    cfg = load_config(config_path)

    df = pd.read_csv(input_csv)
    log(f"Cargadas {len(df):,} filas | columnas: {len(df.columns)}")

    df_valid, rep = validar_estructura(df)
    if not rep["archivo_valido"]:
        log("❌ Archivo inválido:")
        for err in rep["errores"]:
            log(f"  - {err}")
        raise ValueError("Archivo inválido")
    for adv in rep["advertencias"]:
        log(f"⚠️ {adv}")

    # If caller indicates the CSV already contains `sector_actividad`, respect it
    if sector_actividad == "use_file":
        if "sector_actividad" in df_valid.columns:
            df_sys = df_valid.copy()
        else:
            # Fallback to provided default behavior (treat as literal sector)
            df_sys = add_sector(df_valid, "unknown", cfg)
    else:
        df_sys = add_sector(df_valid, sector_actividad, cfg)

    log("Enriqueciendo (versión optimizada, sin EBR)…")
    df_enriched = enrich_features(df_sys, cfg)

    # If an analysis_id is provided, place outputs under that identifier
    out_dir = Path(input_csv).parent / "enriched"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / (Path(input_csv).stem + "_enriched_v2.csv")
    df_enriched.to_csv(out_path, index=False, encoding="utf-8")

    log(f"✅ Enriquecido V2 guardado en: {out_path}")
    log(f"   Registros: {len(df_enriched):,}")
    log(f"   Columnas: {len(df_enriched.columns)}")
    log("==== FIN VALIDACIÓN/ENRIQUECIMIENTO V2 ====")

    return str(out_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(
            "\nUso: python validador_enriquecedor.py <input.csv> <sector_actividad|random> [config_path]\n",
            file=sys.stderr,
        )
        sys.exit(1)


# Compatibilidad: normalizar_sector era esperado por otros módulos
def normalizar_sector(df: pd.DataFrame | None, sector_arg: str, cfg: dict):
    """
    Wrapper de compatibilidad que normaliza/añade la columna `sector_actividad`.
    Firma compatible con llamadas previas que importaban `normalizar_sector`.
    """
    # Si se pasa DataFrame, operar sobre él; si no, no hacemos nada
    if df is None:
        # devolver una función parcial que acepta DataFrame
        def _inner(d: pd.DataFrame):
            return add_sector(d, sector_arg, cfg)

        return _inner

    return add_sector(df, sector_arg, cfg)

    input_csv = sys.argv[1]
    sector = sys.argv[2]
    cfg_path = sys.argv[3] if len(sys.argv) >= 4 else None

    try:
        procesar_archivo(input_csv, sector, cfg_path)
    except Exception as e:
        log(f"❌ Error: {e}")
        raise
