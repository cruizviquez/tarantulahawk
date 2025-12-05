#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validador_enriquecedor.py - VERSIÓN 6.0

Pipeline de validación y enriquecimiento para TarantulaHawk.

Flujo:
1. Valida campos obligatorios (cliente_id, monto, fecha, tipo_operacion)
2. Normaliza sector_actividad → fraccion LFPIORPI
3. Enriquece con features derivadas necesarias para:
   - Reglas LFPIORPI (en ml_runner)
   - Cálculo de EBR
   - Modelos no supervisado y supervisado
4. Guarda CSV listo para ml_runner.py

NOTAS:
- Las reglas LFPIORPI (preocupante, avisos, límites de efectivo)
  se aplican en ml_runner.py, NO aquí.
- Aquí solo calculamos las columnas necesarias (monto_umas, pct_umbral_aviso,
  efectivo_alto, acumulado_alto, etc.)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from datetime import datetime
import numpy as np
import pandas as pd


# ============================================================================
# LOGGING
# ============================================================================
def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [validador] {msg}", flush=True)


# ============================================================================
# CONFIG
# ============================================================================
_CONFIG_CACHE: Dict[str, Any] = {}


def _find_config_path() -> Path:
    """
    Busca config_modelos.json/config_modelos_v4.json en rutas típicas.
    Si no se pasa --config, se usa esto como fallback.
    """
    here = Path(__file__).resolve().parent
    candidates = [
        here.parent / "models" / "config_modelos_v4.json",
        here.parent / "models" / "config_modelos.json",
        here.parent / "config" / "config_modelos_v4.json",
        here.parent / "config" / "config_modelos.json",
        Path.cwd() / "app" / "backend" / "models" / "config_modelos_v4.json",
        Path.cwd() / "config_modelos_v4.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError("No se encontró config_modelos_v4.json")


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    global _CONFIG_CACHE
    p = Path(config_path) if config_path else _find_config_path()
    cache_key = str(p.resolve())
    if cache_key in _CONFIG_CACHE:
        return _CONFIG_CACHE[cache_key]
    log(f"📁 Cargando config: {p}")
    with p.open("r", encoding="utf-8") as f:
        cfg = json.load(f)
    _CONFIG_CACHE[cache_key] = cfg
    return cfg


def get_uma_mxn(cfg: Dict[str, Any]) -> float:
    lfpi = cfg.get("lfpiorpi", {})
    # algunas versiones usan "uma_diaria", otras "uma_mxn"
    return float(lfpi.get("uma_diaria", lfpi.get("uma_mxn", 113.14)))


# ============================================================================
# MAPEO SECTOR → FRACCIÓN (simplificado para art. 17)
# ============================================================================
SECTOR_TO_FRACCION_MAP: Dict[str, str] = {
    # Vehículos (VIII)
    "venta_vehiculos": "VIII_vehiculos",
    "venta_de_vehiculos": "VIII_vehiculos",
    "autos": "VIII_vehiculos",
    "vehiculos": "VIII_vehiculos",
    "vehículos": "VIII_vehiculos",

    # Inmuebles (V y V bis)
    "inmuebles": "V_inmuebles",
    "inmobiliaria": "V_inmuebles",
    "bienes_raices": "V_inmuebles",
    "bienes_raíces": "V_inmuebles",
    "desarrollo_inmobiliario": "V_bis_desarrollo_inmobiliario",

    # Joyería / metales (VI)
    "joyeria": "VI_joyeria_metales",
    "joyería": "VI_joyeria_metales",
    "metales": "VI_joyeria_metales",
    "joyeria_metales": "VI_joyeria_metales",

    # Traslado de valores (X)
    "traslado_valores": "X_traslado_valores",
    "transporte_valores": "X_traslado_valores",

    # Activos virtuales / cripto (XVI)
    "activos_virtuales": "XVI_activos_virtuales",
    "criptomonedas": "XVI_activos_virtuales",
    "crypto": "XVI_activos_virtuales",
}


# ============================================================================
# NORMALIZAR FRACCIÓN / SECTOR
# ============================================================================
def obtener_umbrales_fraccion(fraccion: Optional[str], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Busca en cfg['lfpiorpi']['umbrales'] la entrada para la fracción.
    Soporta:
      - Nombre completo ("VIII_vehiculos")
      - Solo número romano ("VIII")
    Con fallback a 'servicios_generales'.
    Nunca devuelve None (si no encuentra, retorna un dict 'plano').
    """
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})

    def _base_fallback() -> Dict[str, Any]:
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
        return _base_fallback()

    fr_strip = str(fraccion).strip()
    if fr_strip in umbrales:
        return umbrales[fr_strip]

    fr_upper = fr_strip.upper()

    # Coincidencia exacta insensible a mayúsculas
    for key in umbrales.keys():
        if key.upper() == fr_upper:
            return umbrales[key]

    # Si viene solo el número romano ("VIII"), intenta mapear a "VIII_..."
    if "_" not in fr_upper:
        for key in umbrales.keys():
            if key.upper().startswith(fr_upper + "_"):
                return umbrales[key]

    return _base_fallback()


def normalizar_sector(sector_raw: Any, cfg: Optional[Dict[str, Any]] = None) -> str:
    """
    Normaliza sector_actividad a fracción LFPIORPI.
    Reglas:
      1) Si ya coincide EXACTO con una clave de umbrales → se usa tal cual.
      2) Si viene solo número romano ("VIII") → intenta mapear a "VIII_..."
      3) Si está en SECTOR_TO_FRACCION_MAP → usar ese valor.
      4) Fallback → "servicios_generales"
    """
    if sector_raw is None or (isinstance(sector_raw, float) and pd.isna(sector_raw)):
        return "servicios_generales"

    s = str(sector_raw).strip()
    if not s:
        return "servicios_generales"

    s_norm = s.lower()

    cfg = cfg or {}
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})

    # 1) Exacto (tal cual) con una clave de umbrales
    if s in umbrales:
        return s

    # 2) Exacto case-insensitive
    for key in umbrales.keys():
        if key.lower() == s_norm:
            return key

    # 3) Si viene solo número romano ("VIII"), mapear a "VIII_..."
    s_upper = s.upper()
    if "_" not in s_upper:
        for key in umbrales.keys():
            if key.upper().startswith(s_upper + "_"):
                return key

    # 4) Usar el mapa simplificado de sectores
    #    normalizamos espacios/acentos básicos
    acentos = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ü": "u",
        "ñ": "n",
    }
    s_clean = s_norm
    for a, repl in acentos.items():
        s_clean = s_clean.replace(a, repl)

    s_clean = s_clean.replace(" ", "_").replace("-", "_")

    if s_clean in SECTOR_TO_FRACCION_MAP:
        return SECTOR_TO_FRACCION_MAP[s_clean]

    # 5) Fallback: servicios_generales
    return "servicios_generales"


def es_actividad_vulnerable(fraccion: str, cfg: Dict[str, Any]) -> bool:
    """
    Determina si una fracción es actividad vulnerable bajo LFPIORPI
    usando el config (campo es_actividad_vulnerable).
    """
    um = obtener_umbrales_fraccion(fraccion, cfg)
    return bool(um.get("es_actividad_vulnerable", False))


# ============================================================================
# VALIDACIÓN
# ============================================================================
def validar_campos_obligatorios(df: pd.DataFrame) -> Tuple[bool, str]:
    obligatorios = ["cliente_id", "monto", "fecha", "tipo_operacion"]
    faltantes = [c for c in obligatorios if c not in df.columns]
    if faltantes:
        return False, f"Faltan columnas obligatorias: {faltantes}"
    return True, ""


def validar_tipos_datos(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # monto
    df["monto"] = pd.to_numeric(df["monto"], errors="coerce").fillna(0.0)

    # fecha
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    return df


# ============================================================================
# ENRIQUECIMIENTO
# ============================================================================
def _rolling_6m(group: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula métricas rolling de 6 meses por cliente:
      - monto_6m
      - ops_6m
      - monto_max_6m
      - monto_std_6m
    """
    g = group.copy()
    g["fecha"] = pd.to_datetime(g["fecha"], errors="coerce")
    g["monto"] = pd.to_numeric(g["monto"], errors="coerce").fillna(0.0)
    g = g.sort_values("fecha")

    s = pd.Series(g["monto"].values, index=g["fecha"])
    ventana = "180D"

    monto_6m = s.rolling(ventana).sum()
    ops_6m = s.rolling(ventana).count()
    monto_max_6m = s.rolling(ventana).max()
    monto_std_6m = s.rolling(ventana).std().fillna(0.0)

    g["monto_6m"] = monto_6m.values
    g["ops_6m"] = ops_6m.values
    g["monto_max_6m"] = monto_max_6m.values
    g["monto_std_6m"] = monto_std_6m.values

    return g


def enriquecer_transacciones(
    df: pd.DataFrame,
    cfg: Dict[str, Any],
    tipo_usuario: str = "actividad_vulnerable",
    fraccion_override: Optional[str] = None,
) -> pd.DataFrame:
    """
    Enriquece el DataFrame con las columnas necesarias para:
    - Reglas LFPIORPI (aplicadas en ml_runner)
    - Modelos no supervisado y supervisado
    - Cálculo EBR

    Columns importantes generadas:
      - fraccion, es_actividad_vulnerable
      - EsEfectivo, EsInternacional, SectorAltoRiesgo
      - monto_umas, monto_6m, ops_6m, monto_max_6m, monto_std_6m
      - ratio_vs_promedio, pct_umbral_aviso
      - es_nocturno, fin_de_semana, es_monto_redondo, posible_burst
      - efectivo_alto, acumulado_alto
    """
    df = df.copy()

    # 1) Normalizar columnas básicas
    valid, err = validar_campos_obligatorios(df)
    if not valid:
        raise ValueError(err)

    df = validar_tipos_datos(df)

    # 2) Año, mes, día de la semana, fin de semana
    df["anio"] = df["fecha"].dt.year
    df["mes"] = df["fecha"].dt.month
    df["dia_semana"] = df["fecha"].dt.weekday
    df["fin_de_semana"] = df["dia_semana"].isin([5, 6]).astype(int)

    # 3) fraccion / sector_actividad
    if fraccion_override:
        df["fraccion"] = str(fraccion_override)
    else:
        if "fraccion" in df.columns:
            # usar la columna que venga, pero normalizada contra config
            df["fraccion"] = df["fraccion"].apply(lambda x: normalizar_sector(x, cfg))
        elif "sector_actividad" in df.columns:
            df["fraccion"] = df["sector_actividad"].apply(lambda x: normalizar_sector(x, cfg))
        else:
            df["fraccion"] = "servicios_generales"

    # Asegurar sector_actividad (si no viene, usar fraccion)
    if "sector_actividad" not in df.columns:
        df["sector_actividad"] = df["fraccion"]

    # 4) es_actividad_vulnerable
    df["es_actividad_vulnerable"] = df["fraccion"].apply(lambda f: es_actividad_vulnerable(f, cfg))

    # 5) EsEfectivo
    def _es_efectivo(x: Any) -> int:
        s = str(x).strip().lower()
        return int(s in ("efectivo", "cash", "efectivo_mn", "efectivo mn"))

    df["EsEfectivo"] = df["tipo_operacion"].apply(_es_efectivo)

    # 6) EsInternacional (simple: si país origen/destino != México)
    base_countries = {"mx", "mexico", "méxico"}
    if "pais_origen" in df.columns or "pais_destino" in df.columns:

        def _es_internacional(row: pd.Series) -> int:
            po = str(row.get("pais_origen", "")).strip().lower()
            pdest = str(row.get("pais_destino", "")).strip().lower()
            if po and po not in base_countries:
                return 1
            if pdest and pdest not in base_countries:
                return 1
            return 0

        df["EsInternacional"] = df.apply(_es_internacional, axis=1)
    else:
        df["EsInternacional"] = 0

    # 7) SectorAltoRiesgo (según config)
    alto = set(cfg.get("lfpiorpi", {}).get("actividad_alto_riesgo", []))
    df["SectorAltoRiesgo"] = df["fraccion"].isin(alto).astype(int)

    # 8) monto_umas
    uma = get_uma_mxn(cfg)
    df["monto_umas"] = (df["monto"] / uma).replace([np.inf, -np.inf], 0).round(2)

    # 9) Rolling 6m por cliente
    df = df.sort_values(["cliente_id", "fecha"])
    df = df.groupby("cliente_id", group_keys=False).apply(_rolling_6m)

    # Promedios y ratio_vs_promedio
    df["ops_6m"] = df["ops_6m"].fillna(1)
    df["monto_6m"] = df["monto_6m"].fillna(df["monto"])
    df["monto_promedio_cliente"] = (df["monto_6m"] / df["ops_6m"]).replace(0, np.nan)
    df["monto_promedio_cliente"] = df["monto_promedio_cliente"].fillna(df["monto"])
    df["ratio_vs_promedio"] = (
        df["monto"] / df["monto_promedio_cliente"].replace(0, 1)
    ).replace([np.inf, -np.inf], 1).round(2)

    # 10) pct_umbral_aviso (monto vs aviso_UMA, en %)
    def _pct_umbral(row: pd.Series) -> float:
        um = obtener_umbrales_fraccion(row.get("fraccion"), cfg)
        aviso_UMA = float(um.get("aviso_UMA", 0) or 0)
        if aviso_UMA <= 0:
            return 0.0
        umbral_mxn = aviso_UMA * uma
        if umbral_mxn <= 0:
            return 0.0
        return round((row["monto"] / umbral_mxn) * 100.0, 2)

    df["pct_umbral_aviso"] = df.apply(_pct_umbral, axis=1)

    # 11) es_nocturno
    if "hora" in df.columns:
        hora = pd.to_numeric(df["hora"], errors="coerce").fillna(12)
    else:
        hora = pd.Series(12, index=df.index)
    df["es_nocturno"] = ((hora >= 22) | (hora <= 5)).astype(int)

    # 12) es_monto_redondo (aprox múltiplos de 10,000)
    df["es_monto_redondo"] = ((df["monto"] % 10000).abs() < 100).astype(int)

    # 13) posible_burst (≥3 ops mismo cliente mismo día)
    df["fecha_sola"] = df["fecha"].dt.date
    counts = df.groupby(["cliente_id", "fecha_sola"])["monto"].transform("count")
    df["posible_burst"] = (counts >= 3).astype(int)
    df.drop(columns=["fecha_sola"], inplace=True)

    # 14) acumulado_alto (monto_6m > ~500,000 MXN)
    df["acumulado_alto"] = (df["monto_6m"] >= 500_000).astype(int)

    # 15) efectivo_alto (efectivo >= 75% del umbral permitido)
    def _efectivo_alto(row: pd.Series) -> int:
        if row.get("EsEfectivo", 0) != 1:
            return 0
        um = obtener_umbrales_fraccion(row.get("fraccion"), cfg)
        aviso_UMA = float(um.get("aviso_UMA", 0) or 0)
        efectivo_max_UMA = float(um.get("efectivo_max_UMA", 0) or 0)
        base_UMA = efectivo_max_UMA if efectivo_max_UMA > 0 else aviso_UMA
        if base_UMA <= 0:
            return 0
        return int(row.get("monto_umas", 0) >= 0.75 * base_UMA)

    df["efectivo_alto"] = df.apply(_efectivo_alto, axis=1)

    # 16) frecuencia_mensual, ratio_alto, frecuencia_alta
    df["frecuencia_mensual"] = (df["ops_6m"] / 6.0).round().astype(int).clip(lower=1)
    df["ratio_alto"] = (df["ratio_vs_promedio"] > 3).astype(int)
    df["frecuencia_alta"] = (df["ops_6m"] > 5).astype(int)

    return df


# Alias en inglés para compatibilidad con otros módulos
def enrich_features(
    df: pd.DataFrame,
    cfg: Optional[Dict[str, Any]] = None,
    tipo_usuario: str = "actividad_vulnerable",
    fraccion_lfpiorpi: Optional[str] = None,
) -> pd.DataFrame:
    cfg = cfg or load_config()
    return enriquecer_transacciones(df, cfg, tipo_usuario=tipo_usuario, fraccion_override=fraccion_lfpiorpi)


# ============================================================================
# PIPELINE PRINCIPAL (procesar_archivo)
# ============================================================================
def procesar_archivo(
    input_path: Optional[str] = None,
    output_path: Optional[str] = None,
    config_path: Optional[str] = None,
    # keywords usados en otros módulos (enhanced_main_api):
    input_csv: Optional[str] = None,
    sector_actividad: Optional[str] = None,
    training_mode: bool = False,
    analysis_id: Optional[str] = None,
    tipo_usuario: str = "actividad_vulnerable",
    fraccion: Optional[str] = None,
    return_path_only: bool = False,
    **kwargs: Any,
) -> Tuple[bool, str, Optional[pd.DataFrame]] | str:
    """
    Procesa un archivo CSV/Excel y genera un CSV enriquecido.
    Compatible con:
      - llamada directa desde CLI
      - llamada desde enhanced_main_api (portal/API)
    """
    try:
        if input_csv and not input_path:
            input_path = input_csv

        if input_path is None:
            raise ValueError("input_path no especificado")

        input_file = Path(input_path)
        if not input_file.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {input_file}")

        cfg = load_config(config_path)

        log("=" * 70)
        log(f"📄 Procesando: {input_file}")
        log(f"  📁 Config: {config_path or _find_config_path()}")

        # Leer archivo
        if input_file.suffix.lower() in (".xlsx", ".xls"):
            df = pd.read_excel(input_file)
        else:
            df = pd.read_csv(input_file)

        log(f"  📊 Cargado: {len(df)} filas, columnas: {list(df.columns)}")

        # Determinar fracción en función de parámetros
        fraccion_lfpiorpi = fraccion
        if fraccion_lfpiorpi is None and sector_actividad and sector_actividad != "use_file":
            fraccion_lfpiorpi = normalizar_sector(sector_actividad, cfg)

        # Enriquecer
        log("  🔧 Enriqueciendo datos...")
        df_enriched = enriquecer_transacciones(
            df,
            cfg,
            tipo_usuario=tipo_usuario,
            fraccion_override=fraccion_lfpiorpi,
        )
        log(f"   ✅ Columnas generadas: {len(df_enriched.columns)}")

        # Resumen rápido
        vul = int(df_enriched["es_actividad_vulnerable"].sum())
        log("  📊 RESUMEN:")
        log(f"     es_actividad_vulnerable = {vul}")
        log(f"     EsEfectivo             = {int(df_enriched['EsEfectivo'].sum())}")
        log(f"     efectivo_alto          = {int(df_enriched['efectivo_alto'].sum())}")
        log(f"     acumulado_alto         = {int(df_enriched['acumulado_alto'].sum())}")

        # Output path
        if output_path is None:
            # comportamiento tipo producción: outputs/enriched/pending/<archivo>.csv
            output_dir = input_file.parent.parent / "outputs" / "enriched" / "pending"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{input_file.stem}_enriched.csv"
        else:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

        df_enriched.to_csv(output_path, index=False, encoding="utf-8")
        log(f"  ✅ Guardado: {output_path}")
        log("=" * 70)

        if return_path_only or analysis_id or training_mode or input_csv:
            # algunos llamadores sólo esperan el path
            return str(output_path)

        return True, str(output_path), df_enriched

    except Exception as e:
        import traceback

        log(f"  ❌ Error: {e}")
        traceback.print_exc()
        if return_path_only or analysis_id or training_mode or input_csv:
            return ""
        return False, str(e), None


# ============================================================================
# CLI
# ============================================================================
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validador y Enriquecedor TarantulaHawk v6.0"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Archivo CSV o Excel de entrada",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Archivo de salida enriquecido",
    )
    parser.add_argument(
        "--config",
        required=False,
        help="Ruta al config_modelos_v4.json (opcional, intenta auto-detectar si no se pasa)",
    )
    parser.add_argument(
        "--tipo_usuario",
        choices=["actividad_vulnerable"],
        default="actividad_vulnerable",
        help="Tipo de usuario (por ahora solo actividad_vulnerable)",
    )
    parser.add_argument(
        "--fraccion",
        required=False,
        help="Fracción LFPIORPI (ej. VIII_vehiculos). Si se omite, se intentará usar sector_actividad del archivo.",
    )

    args = parser.parse_args()

    ok, msg, _ = procesar_archivo(
        input_path=args.input,
        output_path=args.output,
        config_path=args.config,
        tipo_usuario=args.tipo_usuario,
        fraccion=args.fraccion,
    )

    if ok:
        print(f"\n✅ Éxito: {msg}")
        return 0
    else:
        print(f"\n❌ Error: {msg}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
