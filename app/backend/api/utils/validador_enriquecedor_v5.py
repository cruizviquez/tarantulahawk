#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validador_enriquecedor_v5.py

Versión simplificada y alineada a config_modelos_v4 para usuarios de
ACTIVIDADES VULNERABLES (Art. 17 LFPIORPI).

Flujo:
1. Carga config_modelos_v4.json
2. Valida estructura mínima del CSV
3. Enriquecer operaciones con:
   - Fracción fija desde el perfil del usuario
   - Features de comportamiento (15 core + extras para EBR)
4. Guarda CSV enriquecido listo para ml_runner_v5.py
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Tuple, List, Any, Optional, Union

import numpy as np
import pandas as pd


# ============================================================================
# CONFIG
# ============================================================================

def cargar_config(path: str) -> Dict[str, Any]:
    path_obj = Path(path)
    if not path_obj.exists():
        raise FileNotFoundError(f"No se encontró archivo de configuración: {path}")
    with path_obj.open("r", encoding="utf-8") as f:
        cfg = json.load(f)
    return cfg


def get_uma_mxn(cfg: Dict[str, Any]) -> float:
    """Obtiene UMA en MXN desde config.lfpiorpi.uma_mxn"""
    try:
        return float(cfg["lfpiorpi"]["uma_mxn"])
    except Exception:
        # Fallback defensivo
        return 113.14


# ============================================================================
# VALIDACIÓN / LIMPIEZA
# ============================================================================

def validar_y_limpiar(
    df: pd.DataFrame,
    cfg_validacion: Dict[str, Any],
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    - Verifica columnas obligatorias
    - Convierte tipos básicos (monto, fecha)
    - Separa filas inválidas
    """
    df = df.copy()

    # 1) Columnas obligatorias
    obligatorios = cfg_validacion.get("campos_obligatorios", [])
    faltantes = [c for c in obligatorios if c not in df.columns]
    if faltantes:
        raise ValueError(f"Faltan columnas obligatorias en el CSV: {faltantes}")

    # 2) Tipos básicos
    df["monto"] = pd.to_numeric(df["monto"], errors="coerce")

    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")

    # 3) Filas válidas
    mask_valida = (
        df["cliente_id"].notna()
        & df["monto"].notna()
        & (df["monto"] > 0)
        & df["fecha"].notna()
    )

    df_validas = df[mask_valida].copy()
    df_invalidas = df[~mask_valida].copy()

    return df_validas, df_invalidas


# ============================================================================
# FEATURES AUXILIARES
# ============================================================================

def detectar_efectivo(series_tipo: pd.Series) -> pd.Series:
    st = series_tipo.astype(str).str.lower()
    patrones = ["efectivo", "cash", "efvo"]
    mask = False
    for p in patrones:
        mask = mask | st.str.contains(p)
    return mask.astype(int)


def detectar_internacional(series_tipo: pd.Series) -> pd.Series:
    st = series_tipo.astype(str).str.lower()
    patrones = ["internacional", "international", "foreign", "extranjero", "ext"]
    mask = False
    for p in patrones:
        mask = mask | st.str.contains(p)
    return mask.astype(int)


def calcular_features_temporales(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # Asumimos fecha ya es datetime
    df["dia_semana"] = df["fecha"].dt.dayofweek  # 0=lun, 6=dom
    df["mes"] = df["fecha"].dt.month
    df["fin_de_semana"] = df["dia_semana"].isin([5, 6]).astype(int)
    df["quincena"] = (df["fecha"].dt.day > 15).astype(int)

    # Hora: si viene por separado o de la propia fecha
    if "hora" in df.columns:
        hora_num = pd.to_numeric(df["hora"], errors="coerce")
        hora_num = hora_num.fillna(df["fecha"].dt.hour)
    else:
        hora_num = df["fecha"].dt.hour

    df["hora_num"] = hora_num
    df["es_nocturno"] = df["hora_num"].between(22, 23) | df["hora_num"].between(0, 5)
    df["es_nocturno"] = df["es_nocturno"].astype(int)
    return df


def calcular_ventanas_6m(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula, por cliente, agregados en ventana deslizante de 180 días:
    - monto_6m
    - ops_6m
    - monto_max_6m
    - monto_std_6m
    Además:
    - monto_promedio_cliente
    - ratio_vs_promedio
    """
    df = df.copy()
    # Promedio histórico por cliente
    df["monto_promedio_cliente"] = (
        df.groupby("cliente_id")["monto"].transform("mean").replace(0, np.nan)
    )
    df["ratio_vs_promedio"] = df["monto"] / df["monto_promedio_cliente"]
    df["ratio_vs_promedio"] = df["ratio_vs_promedio"].fillna(1.0)

    # Rolling 180 días por cliente
    df = df.sort_values(["cliente_id", "fecha"])
    def _rolling_6m(g: pd.DataFrame) -> pd.DataFrame:
        g = g.set_index("fecha").sort_index()
        # Rolling 180D sobre monto
        roll = g["monto"].rolling("180D", closed="both")
        g["monto_6m"] = roll.sum()
        g["ops_6m"] = roll.count()
        g["monto_max_6m"] = roll.max()
        g["monto_std_6m"] = roll.std().fillna(0.0)
        return g.reset_index()

    df = (
        df.groupby("cliente_id", group_keys=False)
        .apply(_rolling_6m)
        .reset_index(drop=True)
    )

    # Por si algún cliente tiene una sola operación
    df["monto_6m"] = df["monto_6m"].fillna(df["monto"])
    df["ops_6m"] = df["ops_6m"].fillna(1)
    df["monto_max_6m"] = df["monto_max_6m"].fillna(df["monto"])
    df["monto_std_6m"] = df["monto_std_6m"].fillna(0.0)

    return df


def obtener_umbrales_fraccion(cfg: Dict[str, Any], fraccion: str) -> Dict[str, Any]:
    umbrales = cfg["lfpiorpi"]["umbrales"]
    if fraccion in umbrales:
        return umbrales[fraccion]
    # fallback a "_general"
    return umbrales.get("_general", {})


# ============================================================================
# ENRIQUECIMIENTO ART.17 (ACTIVIDAD VULNERABLE)
# ============================================================================

FEATURES_CORE_ART17: List[str] = [
    "monto",
    "monto_umas",
    "monto_6m",
    "pct_umbral_aviso",
    "EsEfectivo",
    "efectivo_alto",
    "EsInternacional",
    "SectorAltoRiesgo",
    "es_nocturno",
    "fin_de_semana",
    "ratio_vs_promedio",
    "ops_6m",
    "posible_burst",
    "es_monto_redondo",
    "acumulado_alto",
]


def enriquecer_art17(
    df: pd.DataFrame,
    cfg: Dict[str, Any],
    fraccion_lfpiorpi: str,
) -> pd.DataFrame:
    """
    Enriquecimiento para sujetos de ACTIVIDAD VULNERABLE (Art. 17)
    con fracción fija por usuario (perfil).
    """
    df = df.copy()
    uma_mxn = get_uma_mxn(cfg)

    # Ensure fraccion is a string and always present as column for downstream steps
    fr = str(fraccion_lfpiorpi) if fraccion_lfpiorpi is not None else "servicios_generales"
    df["fraccion"] = fr

    # Fracción info + flags de vulnerabilidad / alto riesgo
    info_frac = obtener_umbrales_fraccion(cfg, fr)
    es_vulnerable = bool(info_frac.get("es_actividad_vulnerable", True))
    df["es_actividad_vulnerable"] = int(es_vulnerable)

    actividades_alto_riesgo = set(cfg.get("lfpiorpi", {}).get("actividad_alto_riesgo", []))
    df["SectorAltoRiesgo"] = (df["fraccion"].apply(lambda x: str(x) in actividades_alto_riesgo)).astype(int)

    # Flags por tipo de operación
    df["tipo_operacion"] = df["tipo_operacion"].astype(str)
    df["EsEfectivo"] = detectar_efectivo(df["tipo_operacion"])
    df["EsInternacional"] = detectar_internacional(df["tipo_operacion"])

    # Features temporales
    df = calcular_features_temporales(df)

    # Ventanas 6m
    df = calcular_ventanas_6m(df)

    # UMA & umbrales por fracción
    aviso_UMA = float(info_frac.get("aviso_UMA", 645))
    aviso_mxn = aviso_UMA * uma_mxn

    efectivo_max_UMA = float(info_frac.get("efectivo_max_UMA", 0))
    if efectivo_max_UMA <= 0:
        # si no hay umbral específico de efectivo, usar aviso
        efectivo_max_UMA = aviso_UMA
    efectivo_mxn = efectivo_max_UMA * uma_mxn

    # Features LFPIORPI / UMA
    df["monto_umas"] = df["monto"] / uma_mxn
    df["pct_umbral_aviso"] = np.where(
        aviso_mxn > 0,
        (df["monto"] / aviso_mxn) * 100.0,
        0.0,
    )

    # Efectivo alto (>= 75% umbral efectivo)
    df["efectivo_alto"] = np.where(
        (df["EsEfectivo"] == 1) & (efectivo_mxn > 0),
        (df["monto"] >= 0.75 * efectivo_mxn).astype(int),
        0,
    )
# ---------------------------------------------------------------------------
# Compatibility wrapper and helpers expected by enhanced_main_api
# ---------------------------------------------------------------------------
def cargar_config_modelos(config_path: Optional[str] = None) -> Dict[str, Any]:
    if config_path:
        p = Path(config_path)
    else:
        p = Path(__file__).resolve().parents[1] / "models" / "config_modelos.json"
    if not p.exists():
        raise FileNotFoundError(f"No se encontró config_modelos: {p}")
    import json
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


# Minimal sector map placeholder; the function below uses it to keep compatibility.
SECTOR_TO_FRACCION_MAP_WRAPPER = {}


def normalizar_sector(sector_raw: Any) -> str:
    import pandas as _pd
    if _pd.isna(sector_raw) or sector_raw is None:
        return "servicios_generales"

    sector_clean = str(sector_raw).lower().strip()
    acentos = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u", "ñ": "n"}
    for a, s in acentos.items():
        sector_clean = sector_clean.replace(a, s)

    if not sector_clean or sector_clean in ("nan", "none", "null", ""):
        return "servicios_generales"

    if sector_clean in SECTOR_TO_FRACCION_MAP_WRAPPER:
        return SECTOR_TO_FRACCION_MAP_WRAPPER[sector_clean]

    sector_underscore = sector_clean.replace(" ", "_").replace("-", "_")
    if sector_underscore in SECTOR_TO_FRACCION_MAP_WRAPPER:
        return SECTOR_TO_FRACCION_MAP_WRAPPER[sector_underscore]

    for keyword, fraccion in SECTOR_TO_FRACCION_MAP_WRAPPER.items():
        if keyword in sector_clean or sector_clean in keyword:
            return fraccion

    return "servicios_generales"


# Load friendly->fraccion map from models/fracciones_display.json if present
try:
    _fracciones_file = Path(__file__).resolve().parents[1] / "models" / "fracciones_display.json"
    if _fracciones_file.exists():
        import json as _json
        data = _json.loads(_fracciones_file.read_text(encoding='utf-8'))
        mappings = data.get("mappings", {}) if isinstance(data, dict) else {}
        for display, meta in mappings.items():
            fr = meta.get("fraccion")
            if fr:
                # map lower-case and underscore variants
                SECTOR_TO_FRACCION_MAP_WRAPPER[display.lower()] = fr
                SECTOR_TO_FRACCION_MAP_WRAPPER[display.lower().replace(' ', '_')] = fr
                SECTOR_TO_FRACCION_MAP_WRAPPER[fr.lower()] = fr
except Exception:
    pass


def enriquecer_art17_df(df: pd.DataFrame, cfg: Dict[str, Any], fraccion_lfpiorpi: str) -> pd.DataFrame:
    # Reuse existing `enriquecer_art17` implementation in this module
    try:
        return enriquecer_art17(df.copy(), cfg, fraccion_lfpiorpi)
    except Exception:
        # As a safe fallback, compute minimal enrichment
        df = df.copy()
        uma = float(cfg.get("lfpiorpi", {}).get("uma_mxn", 113.14))
        df["monto_umas"] = df.get("monto", 0) / uma
        df["monto_6m"] = df.get("monto", 0)
        df["ops_6m"] = 1
        # ensure fraccion and SectorAltoRiesgo are present for downstream
        fr = str(fraccion_lfpiorpi) if fraccion_lfpiorpi else cfg.get("lfpiorpi_default", {}).get("fraccion_por_defecto", "servicios_generales")
        df["fraccion"] = fr
        actividades_alto_riesgo = set(cfg.get("lfpiorpi", {}).get("actividad_alto_riesgo", []))
        df["SectorAltoRiesgo"] = int(fr in actividades_alto_riesgo)
        return df
    


def enrich_features(
    df: pd.DataFrame,
    config_path: Optional[str] = None,
    tipo_usuario: str = "actividad_vulnerable",
    fraccion_lfpiorpi: Optional[str] = None,
    **kwargs,
) -> pd.DataFrame:
    cfg = cargar_config_modelos(config_path)
    if tipo_usuario != "actividad_vulnerable":
        return df.copy()

    if fraccion_lfpiorpi is None:
        fraccion_lfpiorpi = cfg.get("lfpiorpi_default", {}).get("fraccion_por_defecto", "V_inmuebles")

    return enriquecer_art17_df(df.copy(), cfg, fraccion_lfpiorpi)


def enriquecer_art17_file(
    input_path: str,
    cfg: Dict[str, Any],
    fraccion_lfpiorpi: str,
    training_mode: bool,
    analysis_id: Optional[str] = None,
) -> str:
    input_path = Path(input_path)
    df = pd.read_csv(input_path)
    # If fraccion_lfpiorpi seems missing or malformed, fallback to normalizar_sector
    if not fraccion_lfpiorpi:
        fraccion_lfpiorpi = normalizar_sector(df.get('sector_actividad', None))
    df_enriched = enriquecer_art17_df(df, cfg, fraccion_lfpiorpi)

    base_outputs = Path(__file__).resolve().parents[1] / "outputs" / "enriched"
    mode_dir = base_outputs / ("training" if training_mode else "pending")
    mode_dir.mkdir(parents=True, exist_ok=True)

    if analysis_id:
        out_path = mode_dir / f"{analysis_id}.csv"
    else:
        out_path = mode_dir / f"enriched_{input_path.name}"

    df_enriched.to_csv(out_path, index=False)
    return str(out_path)


def procesar_archivo(
    input_path: str,
    sector_actividad: str = "use_file",
    config_path: Optional[str] = None,
    training_mode: bool = False,
    analysis_id: Optional[str] = None,
) -> Union[str, tuple]:
    cfg = cargar_config_modelos(config_path)

    if sector_actividad not in (None, "", "use_file"):
        fraccion = normalizar_sector(sector_actividad)
    else:
        fraccion = cfg.get("lfpiorpi_default", {}).get("fraccion_por_defecto", "V_inmuebles")

    try:
        out_path = enriquecer_art17_file(
            input_path=input_path,
            cfg=cfg,
            fraccion_lfpiorpi=fraccion,
            training_mode=training_mode,
            analysis_id=analysis_id,
        )
        return out_path
    except Exception as e:
        return (False, f"Error en procesar_archivo: {e}")

    return True, f"Archivo enriquecido guardado en {output_path}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validador/Enriquecedor v5 para actividades vulnerables (Art.17)"
    )
    parser.add_argument("--input", required=True, help="CSV de entrada")
    parser.add_argument("--output", required=True, help="CSV de salida enriquecido")
    parser.add_argument("--config", required=True, help="Ruta a config_modelos_v4.json")
    parser.add_argument(
        "--tipo_usuario",
        required=True,
        choices=["actividad_vulnerable"],
        help="Tipo de usuario (por ahora solo 'actividad_vulnerable')",
    )
    parser.add_argument(
        "--fraccion",
        required=True,
        help="Fracción LFPIORPI del usuario (ej. 'V_inmuebles', 'VIII_vehiculos', etc.)",
    )

    args = parser.parse_args()
    try:
        ok, msg = procesar_archivo(
            input_path=args.input,
            output_path=args.output,
            config_path=args.config,
            tipo_usuario=args.tipo_usuario,
            fraccion_lfpiorpi=args.fraccion,
        )
        if ok:
            print(f"\n✅ Éxito: {msg}")
            return 0
        else:
            print(f"\n❌ Error: {msg}")
            return 1
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
