#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validador_enriquecedor.py - VERSIÓN CORREGIDA Y OPTIMIZADA

Mejoras en esta versión:
- sector_actividad es OPCIONAL (se obtiene del perfil de usuario si no viene)
- Pipeline limpio: valida → enriquece → guarda
- Lee TODAS las variables de config_modelos.json
- Código muerto eliminado
- Compatibilidad con llamadas desde API y CLI

Campos obligatorios: cliente_id, monto, fecha, tipo_operacion
Campos opcionales: sector_actividad (se infiere si falta)

Salida: CSV con ~26 columnas enriquecidas listo para ML
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, Tuple

# ============================================================================
# LOGGING
# ============================================================================
def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [validador] {msg}", flush=True)


# ============================================================================
# CONFIGURACIÓN - Todo desde config_modelos.json
# ============================================================================
_CONFIG_CACHE: Dict[str, Any] = {}

def _find_config_path() -> Path:
    """Busca config_modelos.json en ubicaciones conocidas"""
    here = Path(__file__).resolve().parent
    candidates = [
        here.parent / "models" / "config_modelos.json",
        here.parent / "config" / "config_modelos.json",
        here / "config_modelos.json",
        Path.cwd() / "app" / "backend" / "models" / "config_modelos.json",
        Path.cwd() / "config_modelos.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError(
        f"No se encontró config_modelos.json. Buscado en: {[str(c) for c in candidates]}"
    )


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """Carga configuración desde JSON (con cache)"""
    global _CONFIG_CACHE
    
    if config_path:
        p = Path(config_path)
    else:
        p = _find_config_path()
    
    cache_key = str(p)
    if cache_key in _CONFIG_CACHE:
        return _CONFIG_CACHE[cache_key]
    
    if not p.exists():
        raise FileNotFoundError(f"Config no encontrado: {p}")
    
    log(f"📁 Cargando config: {p}")
    with open(p, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    
    _CONFIG_CACHE[cache_key] = cfg
    return cfg


def get_campos_obligatorios(cfg: Dict[str, Any]) -> list:
    """Obtiene campos obligatorios desde config"""
    return cfg.get("validacion", {}).get("campos_obligatorios", [
        "cliente_id", "monto", "fecha", "tipo_operacion"
    ])


def get_tipos_operacion_validos(cfg: Dict[str, Any]) -> list:
    """Obtiene tipos de operación válidos desde config"""
    return cfg.get("validacion", {}).get("tipos_operacion_validos", [
        "efectivo", "tarjeta", "transferencia_nacional", "transferencia_internacional"
    ])


def get_sectores_default(cfg: Dict[str, Any]) -> list:
    """Obtiene sectores por defecto desde config"""
    lfpi = cfg.get("lfpiorpi", {})
    sectores = list(lfpi.get("actividad_a_fraccion", {}).keys())


# ============================================================================
# NORMALIZACIÓN DE SECTORES → FRACCIONES LFPIORPI
# ============================================================================
# Diccionario de mapeo de variantes de sector a fracción LFPIORPI oficial
# Permite al usuario escribir "metales" y el sistema lo normaliza a "XI_joyeria"
SECTOR_TO_FRACCION_MAP = {
    # ========== FRACCIÓN I: JUEGOS Y SORTEOS ==========
    "juegos": "I_juegos",
    "sorteos": "I_juegos",
    "loteria": "I_juegos",
    "lotería": "I_juegos",
    "casino": "I_juegos",
    "apuestas": "I_juegos",
    "bingo": "I_juegos",
    
    # ========== FRACCIÓN II: TARJETAS DE SERVICIO/CRÉDITO ==========
    "tarjetas": "II_tarjetas",
    "tarjetas_credito": "II_tarjetas",
    "tarjetas_servicio": "II_tarjetas",
    "emisor_tarjetas": "II_tarjetas",
    
    # ========== FRACCIÓN III: MUTUO/PRÉSTAMOS ==========
    "prestamos": "III_mutuo",
    "préstamos": "III_mutuo",
    "mutuo": "III_mutuo",
    "creditos": "III_mutuo",
    "créditos": "III_mutuo",
    "financiera": "III_mutuo",
    "sofom": "III_mutuo",
    "microfinanciera": "III_mutuo",
    
    # ========== FRACCIÓN V: INMUEBLES ==========
    "inmobiliaria": "V_inmuebles",
    "inmuebles": "V_inmuebles",
    "bienes_raices": "V_inmuebles",
    "bienes raices": "V_inmuebles",
    "real_estate": "V_inmuebles",
    "real estate": "V_inmuebles",
    "construccion": "V_inmuebles",
    "construcción": "V_inmuebles",
    "propiedades": "V_inmuebles",
    "terrenos": "V_inmuebles",
    "desarrolladora": "V_inmuebles",
    "fraccionamiento": "V_inmuebles",
    
    # ========== FRACCIÓN VIII: VEHÍCULOS ==========
    "automotriz": "VIII_vehiculos",
    "vehiculos": "VIII_vehiculos",
    "vehículos": "VIII_vehiculos",
    "autos": "VIII_vehiculos",
    "coches": "VIII_vehiculos",
    "automoviles": "VIII_vehiculos",
    "automóviles": "VIII_vehiculos",
    "agencia_autos": "VIII_vehiculos",
    "concesionaria": "VIII_vehiculos",
    "seminuevos": "VIII_vehiculos",
    "motocicletas": "VIII_vehiculos",
    "motos": "VIII_vehiculos",
    "camiones": "VIII_vehiculos",
    "carros": "VIII_vehiculos",
    
    # ========== FRACCIÓN IX: TRANSMISIÓN DE DERECHOS ==========
    "transmision": "IX_transmision",
    "transmisión": "IX_transmision",
    "derechos": "IX_transmision",
    "cesion_derechos": "IX_transmision",
    
    # ========== FRACCIÓN X: TRASLADO DE VALORES ==========
    "traslado_valores": "X_traslado_valores",
    "blindados": "X_traslado_valores",
    "custodia_valores": "X_traslado_valores",
    "transporte_valores": "X_traslado_valores",
    "valores": "X_traslado_valores",
    
    # ========== FRACCIÓN XI: JOYERÍA Y METALES ==========
    "joyeria": "XI_joyeria",
    "joyería": "XI_joyeria",
    "joyeria_metales": "XI_joyeria",
    "metales": "XI_joyeria",
    "metales_preciosos": "XI_joyeria",
    "metales preciosos": "XI_joyeria",
    "oro": "XI_joyeria",
    "plata": "XI_joyeria",
    "platino": "XI_joyeria",
    "diamantes": "XI_joyeria",
    "joyas": "XI_joyeria",
    "relojeria": "XI_joyeria",
    "relojería": "XI_joyeria",
    "relojes": "XI_joyeria",
    "piedras_preciosas": "XI_joyeria",
    "gemas": "XI_joyeria",
    "alhajas": "XI_joyeria",
    
    # ========== FRACCIÓN XII: ARTE Y ANTIGÜEDADES ==========
    "arte": "XII_arte",
    "antiguedades": "XII_arte",
    "antigüedades": "XII_arte",
    "galeria": "XII_arte",
    "galería": "XII_arte",
    "subastas": "XII_arte",
    "coleccionables": "XII_arte",
    "obras_arte": "XII_arte",
    
    # ========== FRACCIÓN XIV: FEDATARIOS ==========
    "notario": "XIV_fedatarios",
    "notarios": "XIV_fedatarios",
    "fedatario": "XIV_fedatarios",
    "fedatarios": "XIV_fedatarios",
    "corredor_publico": "XIV_fedatarios",
    "notaria": "XIV_fedatarios",
    "notaría": "XIV_fedatarios",
    
    # ========== FRACCIÓN XVI: ACTIVOS VIRTUALES ==========
    "activos_virtuales": "XVI_activos_virtuales",
    "criptomonedas": "XVI_activos_virtuales",
    "criptomoneda": "XVI_activos_virtuales",
    "cripto": "XVI_activos_virtuales",
    "crypto": "XVI_activos_virtuales",
    "bitcoin": "XVI_activos_virtuales",
    "btc": "XVI_activos_virtuales",
    "ethereum": "XVI_activos_virtuales",
    "eth": "XVI_activos_virtuales",
    "exchange": "XVI_activos_virtuales",
    "exchange_cripto": "XVI_activos_virtuales",
    "vasp": "XVI_activos_virtuales",
    "tokens": "XVI_activos_virtuales",
    "nft": "XVI_activos_virtuales",
    "defi": "XVI_activos_virtuales",
    "blockchain": "XVI_activos_virtuales",
    
    # ========== CASA DE CAMBIO ==========
    "casa_cambio": "casa_cambio",
    "cambio_divisas": "casa_cambio",
    "divisas": "casa_cambio",
    "forex": "casa_cambio",
    "cambio_moneda": "casa_cambio",
    "bureau_change": "casa_cambio",
    
    # ========== TRANSMISIÓN DE DINERO ==========
    "transmision_dinero": "transmision_dinero",
    "envio_dinero": "transmision_dinero",
    "envío_dinero": "transmision_dinero",
    "remesas": "transmision_dinero",
    "transferencias": "transmision_dinero",
    "money_transfer": "transmision_dinero",
    "western_union": "transmision_dinero",
    
    # ========== SERVICIOS GENERALES (sin fracción LFPIORPI específica) ==========
    "servicios": "servicios_generales",
    "servicios_generales": "servicios_generales",
    "comercio": "servicios_generales",
    "retail": "servicios_generales",
    "tienda": "servicios_generales",
    "restaurante": "servicios_generales",
    "hotel": "servicios_generales",
    "turismo": "servicios_generales",
    "salud": "servicios_generales",
    "educacion": "servicios_generales",
    "educación": "servicios_generales",
    "tecnologia": "servicios_generales",
    "tecnología": "servicios_generales",
    "software": "servicios_generales",
    "consultoria": "servicios_generales",
    "consultoría": "servicios_generales",
    "profesional": "servicios_generales",
    "manufactura": "servicios_generales",
    "industrial": "servicios_generales",
    "agricola": "servicios_generales",
    "agrícola": "servicios_generales",
    "alimentos": "servicios_generales",
    "farmacia": "servicios_generales",
    "farmacias": "servicios_generales",
    "textil": "servicios_generales",
    "moda": "servicios_generales",
    "ropa": "servicios_generales",
}


def normalizar_sector(sector_raw: Any) -> str:
    """
    Normaliza un sector de actividad a su fracción LFPIORPI correspondiente.
    
    Proceso:
    1. Limpia texto (lowercase, trim, quita acentos)
    2. Busca match exacto en diccionario
    3. Busca match con underscores
    4. Busca match parcial (contiene keyword)
    5. Si no encuentra, retorna "servicios_generales"
    
    Args:
        sector_raw: Valor del sector tal como viene del CSV
        
    Returns:
        Fracción LFPIORPI normalizada (ej: "XI_joyeria")
    """
    if pd.isna(sector_raw) or sector_raw is None:
        return "servicios_generales"
    
    # Convertir a string y limpiar
    sector_clean = str(sector_raw).lower().strip()
    
    # Quitar acentos
    acentos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ü': 'u', 'ñ': 'n'
    }
    for acento, sin_acento in acentos.items():
        sector_clean = sector_clean.replace(acento, sin_acento)
    
    # Si ya está vacío
    if not sector_clean or sector_clean in ("nan", "none", "null", ""):
        return "servicios_generales"
    
    # 1. Match exacto
    if sector_clean in SECTOR_TO_FRACCION_MAP:
        return SECTOR_TO_FRACCION_MAP[sector_clean]
    
    # 2. Match con underscores en lugar de espacios
    sector_underscore = sector_clean.replace(" ", "_").replace("-", "_")
    if sector_underscore in SECTOR_TO_FRACCION_MAP:
        return SECTOR_TO_FRACCION_MAP[sector_underscore]
    
    # 3. Match parcial (el sector contiene alguna keyword)
    for keyword, fraccion in SECTOR_TO_FRACCION_MAP.items():
        if keyword in sector_clean:
            return fraccion
    
    # 4. No encontrado - usar servicios_generales (sin fracción LFPIORPI específica)
    return "servicios_generales"


def normalizar_sectores_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normaliza la columna sector_actividad y crea la columna fraccion.
    
    Args:
        df: DataFrame con columna sector_actividad
        
    Returns:
        DataFrame con columna 'fraccion' agregada
    """
    df = df.copy()
    
    if "sector_actividad" not in df.columns:
        df["sector_actividad"] = "servicios_generales"
        df["fraccion"] = "servicios_generales"
        return df
    
    # Aplicar normalización
    df["fraccion"] = df["sector_actividad"].apply(normalizar_sector)
    
    # Log de mapeos realizados
    mapeos = df.groupby(["sector_actividad", "fraccion"]).size().reset_index(name="count")
    if len(mapeos) > 0:
        log(f"  📋 Sectores normalizados:")
        for _, row in mapeos.head(10).iterrows():
            orig = row["sector_actividad"]
            dest = row["fraccion"]
            cnt = row["count"]
            if orig != dest:
                log(f"     '{orig}' → '{dest}' ({cnt} registros)")
    
    return df
    if not sectores:
        sectores = [
            "casa_cambio", "joyeria_metales", "inmobiliaria", 
            "transmision_dinero", "activos_virtuales"
        ]
    return sectores


# ============================================================================
# HELPERS LFPIORPI - Umbrales en MXN
# ============================================================================
def get_uma_diaria(cfg: Dict[str, Any]) -> float:
    """Obtiene UMA diaria desde config"""
    lfpi = cfg.get("lfpiorpi", {})
    return float(lfpi.get("uma_diaria", lfpi.get("uma_mxn", 113.14)))


def uma_to_mxn(uma_diaria: float, uma_count: Any) -> float:
    """Convierte UMAs a MXN"""
    if uma_count is None:
        return float('inf')
    try:
        val = float(uma_count)
        if not np.isfinite(val):
            return float('inf')
        return uma_diaria * val
    except (TypeError, ValueError):
        return float('inf')


def get_umbral_aviso_mxn(fraccion: str, cfg: Dict[str, Any]) -> float:
    """Obtiene umbral de aviso en MXN para una fracción"""
    uma = get_uma_diaria(cfg)
    umbrales = cfg.get("lfpiorpi", {}).get("umbrales", {})
    u = umbrales.get(fraccion, {})
    return uma_to_mxn(uma, u.get("aviso_UMA"))


def get_umbral_efectivo_mxn(fraccion: str, cfg: Dict[str, Any]) -> float:
    """Obtiene límite de efectivo en MXN para una fracción"""
    uma = get_uma_diaria(cfg)
    umbrales = cfg.get("lfpiorpi", {}).get("umbrales", {})
    u = umbrales.get(fraccion, {})
    return uma_to_mxn(uma, u.get("efectivo_max_UMA"))


# ============================================================================
# VALIDACIÓN DE ESTRUCTURA
# ============================================================================
def validar_estructura(
    df: pd.DataFrame, 
    cfg: Dict[str, Any]
) -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    """
    Valida estructura del DataFrame.
    
    Returns:
        (DataFrame válido o None, reporte de validación)
    """
    reporte = {
        "archivo_valido": True,
        "errores": [],
        "advertencias": [],
        "filas_originales": len(df),
        "filas_validas": 0
    }
    
    df = df.copy()
    df.columns = df.columns.str.strip().str.lower()
    
    # Verificar campos obligatorios
    campos_obligatorios = get_campos_obligatorios(cfg)
    missing = [c for c in campos_obligatorios if c not in df.columns]
    
    if missing:
        reporte["archivo_valido"] = False
        reporte["errores"].append(f"Faltan columnas obligatorias: {missing}")
        return None, reporte
    
    # Normalizar tipos de datos
    df["cliente_id"] = df["cliente_id"].astype(str).str.strip()
    df["monto"] = pd.to_numeric(df["monto"], errors="coerce")
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df["tipo_operacion"] = df["tipo_operacion"].astype(str).str.strip().str.lower()
    
    # Validar valores
    tipos_validos = get_tipos_operacion_validos(cfg)
    
    mask = (
        (df["cliente_id"] != "") &
        (df["cliente_id"].notna()) &
        (df["monto"].notna()) &
        (df["monto"] > 0) &
        (df["fecha"].notna()) &
        (df["tipo_operacion"].isin(tipos_validos))
    )
    
    dropped = int((~mask).sum())
    if dropped > 0:
        reporte["advertencias"].append(f"Eliminados {dropped} registros inválidos")
    
    df = df[mask].reset_index(drop=True)
    reporte["filas_validas"] = len(df)
    
    if len(df) == 0:
        reporte["archivo_valido"] = False
        reporte["errores"].append("No quedan registros válidos tras limpieza")
        return None, reporte
    
    return df, reporte


# ============================================================================
# SECTOR DE ACTIVIDAD (OPCIONAL)
# ============================================================================
def asignar_sector_actividad(
    df: pd.DataFrame,
    sector_arg: Optional[str],
    cfg: Dict[str, Any],
    user_profile: Optional[Dict[str, Any]] = None
) -> pd.DataFrame:
    """
    Asigna sector_actividad al DataFrame.
    
    Prioridad:
    1. Si ya existe en el CSV, respetarlo
    2. Si se proporciona sector_arg, usarlo
    3. Si hay perfil de usuario con giro, usarlo
    4. Si sector_arg == "random", asignar aleatorio
    5. Default: "servicios_generales"
    """
    df = df.copy()
    
    # Si ya existe la columna y tiene valores, respetarla
    if "sector_actividad" in df.columns:
        # Normalizar valores existentes
        df["sector_actividad"] = df["sector_actividad"].astype(str).str.strip().str.lower()
        
        # Si hay valores válidos (no vacíos, no NaN), mantenerlos
        valid_mask = (df["sector_actividad"] != "") & (df["sector_actividad"] != "nan")
        if valid_mask.any():
            log(f"  · Usando sector_actividad del archivo ({valid_mask.sum()} registros)")
            
            # Solo rellenar los que faltan
            if (~valid_mask).any():
                default_sector = _get_default_sector(sector_arg, cfg, user_profile)
                df.loc[~valid_mask, "sector_actividad"] = default_sector
                log(f"  · Asignado '{default_sector}' a {(~valid_mask).sum()} registros sin sector")
            
            return df
    
    # Si no existe o está vacía, asignar
    default_sector = _get_default_sector(sector_arg, cfg, user_profile)
    
    if sector_arg == "random":
        sectores = get_sectores_default(cfg)
        df["sector_actividad"] = np.random.choice(sectores, size=len(df))
        log(f"  · Sector asignado: aleatorio entre {len(sectores)} opciones")
    else:
        df["sector_actividad"] = default_sector
        log(f"  · Sector asignado: '{default_sector}'")
    
    return df


def _get_default_sector(
    sector_arg: Optional[str],
    cfg: Dict[str, Any],
    user_profile: Optional[Dict[str, Any]] = None
) -> str:
    """Determina el sector por defecto a usar"""
    # Prioridad 1: Argumento explícito (si no es "random" o "use_file")
    if sector_arg and sector_arg not in ("random", "use_file", ""):
        return sector_arg.lower()
    
    # Prioridad 2: Perfil de usuario
    if user_profile:
        giro = user_profile.get("giro_actividad") or user_profile.get("sector_actividad")
        if giro:
            return str(giro).lower()
    
    # Prioridad 3: Default de config
    default = cfg.get("validacion", {}).get("sector_default", "servicios_generales")
    return default


# ============================================================================
# FEATURES DE ROLLING 180 DÍAS
# ============================================================================
def calcular_rolling_180d(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula features de ventana deslizante de 180 días por cliente.
    
    Features generadas:
    - monto_6m: suma de montos en últimos 180 días
    - ops_6m: cantidad de operaciones en últimos 180 días
    - monto_max_6m: monto máximo en últimos 180 días
    - monto_std_6m: desviación estándar en últimos 180 días
    """
    df = df.sort_values(["cliente_id", "fecha"]).copy()
    
    # Usar fecha como índice para rolling temporal
    df_indexed = df.set_index("fecha")
    grouped = df_indexed.groupby("cliente_id", group_keys=False)
    
    df["monto_6m"] = grouped["monto"].rolling("180D", min_periods=1).sum().values
    df["ops_6m"] = grouped["monto"].rolling("180D", min_periods=1).count().values
    df["monto_max_6m"] = grouped["monto"].rolling("180D", min_periods=1).max().values
    df["monto_std_6m"] = grouped["monto"].rolling("180D", min_periods=1).std().fillna(0).values
    
    return df


# ============================================================================
# FEATURES DE RED / COMPORTAMIENTO
# ============================================================================
def calcular_features_red(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula features de comportamiento relativo y red.
    
    Features generadas:
    - ops_relativas: proporción de operaciones del cliente vs total
    - diversidad_operaciones: entropía de tipos de operación
    - concentracion_temporal: variabilidad en días entre operaciones
    """
    df = df.copy()
    n_clientes = df["cliente_id"].nunique()
    
    if n_clientes > 1:
        # Operaciones relativas
        ops_por_cliente = df.groupby("cliente_id").size()
        df["ops_relativas"] = df["cliente_id"].map(ops_por_cliente) / len(df)
        
        # Diversidad de operaciones (entropía)
        from scipy.stats import entropy
        tipo_counts = df.groupby("cliente_id")["tipo_operacion"].value_counts(normalize=True)
        tipo_entropy = tipo_counts.groupby(level=0).apply(lambda x: entropy(x))
        df["diversidad_operaciones"] = df["cliente_id"].map(tipo_entropy).fillna(0)
        
        # Concentración temporal
        df_sorted = df.sort_values(["cliente_id", "fecha"])
        df_sorted["_dias_diff"] = df_sorted.groupby("cliente_id")["fecha"].diff().dt.days
        dias_std = df_sorted.groupby("cliente_id")["_dias_diff"].std()
        df["concentracion_temporal"] = df["cliente_id"].map(dias_std).fillna(0)
    else:
        df["ops_relativas"] = 1.0
        df["diversidad_operaciones"] = 0.0
        df["concentracion_temporal"] = 0.0
    
    return df


# ============================================================================
# ENRIQUECIMIENTO PRINCIPAL
# ============================================================================
def enriquecer_dataframe(df: pd.DataFrame, cfg: Dict[str, Any], training_mode: bool = False) -> pd.DataFrame:
    """
    Enriquece el DataFrame con todas las features necesarias para ML.
    
    Args:
        df: DataFrame con datos validados
        cfg: Configuración cargada
        training_mode: Si True, genera clasificacion_lfpiorpi como target
                      Si False, NO genera (para inferencia con ML)
    
    Genera ~26 columnas a partir de las 4-5 originales.
    """
    df = df.copy()
    log("  · Generando features básicas...")
    
    # 1. Flags de tipo de operación
    df["EsEfectivo"] = (df["tipo_operacion"] == "efectivo").astype(int)
    df["EsInternacional"] = (df["tipo_operacion"] == "transferencia_internacional").astype(int)
    
    # ✅ 2. NORMALIZAR SECTORES → FRACCIONES LFPIORPI
    log("  · Normalizando sectores de actividad...")
    df = normalizar_sectores_df(df)  # Crea columna 'fraccion' normalizada
    
    # 3. Sector de alto riesgo (ahora usa fraccion normalizada)
    sectores_alto_riesgo = set(
        cfg.get("lfpiorpi", {}).get("actividad_alto_riesgo", [
            "XVI_activos_virtuales", "X_traslado_valores", "casa_cambio",
            "transmision_dinero", "XI_joyeria"
        ])
    )
    # Verificar tanto por fraccion como por sector_actividad original
    df["SectorAltoRiesgo"] = (
        df["fraccion"].isin(sectores_alto_riesgo) | 
        df["sector_actividad"].astype(str).str.lower().isin(sectores_alto_riesgo)
    ).astype(int)
    
    # 4. Features temporales
    df["mes"] = df["fecha"].dt.month.astype(int)
    df["dia_semana"] = df["fecha"].dt.weekday.astype(int)
    df["quincena"] = df["fecha"].dt.day.between(13, 17).astype(int)
    df["fin_de_semana"] = (df["fecha"].dt.weekday >= 5).astype(int)
    df["hora"] = df["fecha"].dt.hour.fillna(12).astype(int)
    df["es_nocturno"] = ((df["hora"] >= 22) | (df["hora"] <= 6)).astype(int)
    
    # 5. Frecuencia mensual
    df["frecuencia_mensual"] = df.groupby("cliente_id")["cliente_id"].transform("count").astype(int)
    
    # ✅ NOTA: fraccion ya fue asignada por normalizar_sectores_df()
    # Si la normalización no encontró match, ya tiene "servicios_generales"
    log(f"  · Fracciones LFPIORPI únicas: {df['fraccion'].nunique()}")
    
    # 6. Rolling 180 días
    log("  · Calculando rolling 180D...")
    df = calcular_rolling_180d(df)
    
    # 7. Features de red
    log("  · Calculando features de red...")
    df = calcular_features_red(df)
    
    # 8. Features de comportamiento
    log("  · Calculando features de comportamiento...")
    monto_promedio_cliente = df.groupby("cliente_id")["monto"].transform("mean")
    df["ratio_vs_promedio"] = (df["monto"] / monto_promedio_cliente).replace([np.inf, -np.inf], 1.0).fillna(1.0)
    df["es_monto_redondo"] = (df["monto"] % 10000 == 0).astype(int)
    
    # Detección de bursts (operaciones muy seguidas)
    df_sorted = df.sort_values(["cliente_id", "fecha"])
    df_sorted["_seg_diff"] = df_sorted.groupby("cliente_id")["fecha"].diff().dt.total_seconds()
    df["posible_burst"] = (df_sorted["_seg_diff"] < 3600).fillna(False).astype(int)
    
    # ========================================================================
    # CLASIFICACIÓN LFPIORPI PRELIMINAR (SOLO PARA ENTRENAMIENTO)
    # ========================================================================
    if training_mode:
        log("  · Aplicando reglas LFPIORPI (modo entrenamiento)...")
        clasificaciones = []
        
        for _, row in df.iterrows():
            fraccion = row["fraccion"]
            umbral_aviso = get_umbral_aviso_mxn(fraccion, cfg)
            umbral_efectivo = get_umbral_efectivo_mxn(fraccion, cfg)
            
            monto = float(row["monto"])
            es_efectivo = int(row["EsEfectivo"]) == 1
            monto_6m = float(row["monto_6m"])
            ops_6m = int(row["ops_6m"])
            es_internacional = int(row["EsInternacional"]) == 1
            sector_riesgo = int(row["SectorAltoRiesgo"]) == 1
            es_nocturno = int(row["es_nocturno"]) == 1
            es_weekend = int(row["fin_de_semana"]) == 1
            ratio = float(row["ratio_vs_promedio"])
            
            # Thresholds graduados
            thr_70 = 0.7 * umbral_aviso
            thr_50 = 0.5 * umbral_aviso
            thr_70_ef = 0.7 * umbral_efectivo
            
            # =====================================================================
            # PREOCUPANTE: Umbrales LFPIORPI estrictos (guardrails)
            # =====================================================================
            es_preocupante = (
                (monto >= umbral_aviso) or
                (es_efectivo and monto >= umbral_efectivo) or
                (monto < umbral_aviso and monto_6m >= umbral_aviso)
            )
            
            if es_preocupante:
                clasificaciones.append("preocupante")
                continue
            
            # =====================================================================
            # INUSUAL: Combinación de factores (no flags aislados)
            # =====================================================================
            condiciones_inusual = [
                # Sector riesgo + monto significativo
                sector_riesgo and (monto >= 0.3 * umbral_aviso),
                
                # Internacional + frecuencia + monto alto
                es_internacional and ops_6m >= 3 and monto >= thr_70 and monto_6m >= thr_70,
                
                # Efectivo nocturno + monto significativo
                es_efectivo and es_nocturno and monto >= thr_70_ef,
                
                # Efectivo fin de semana + monto significativo
                es_efectivo and es_weekend and monto >= thr_70_ef,
                
                # Frecuencia + acumulado alto
                ops_6m >= 3 and monto_6m >= thr_70,
                
                # Ratio muy alto + monto significativo
                ratio > 3.0 and monto >= thr_50,
            ]
            
            es_inusual = any(condiciones_inusual)
            clasificaciones.append("inusual" if es_inusual else "relevante")
        
        df["clasificacion_lfpiorpi"] = clasificaciones
    else:
        log("  · Modo inferencia: clasificacion_lfpiorpi será generada por ML")
    
    # ========================================================================
    # SELECCIÓN DE COLUMNAS FINALES
    # ========================================================================
    columnas_base = [
        # Identificación
        "cliente_id", "monto", "fecha", "tipo_operacion",
        # Sector
        "sector_actividad", "fraccion",
        # Flags binarias
        "EsEfectivo", "EsInternacional", "SectorAltoRiesgo",
        "fin_de_semana", "es_nocturno", "es_monto_redondo",
        # Temporales
        "frecuencia_mensual", "mes", "dia_semana", "quincena", "hora",
        # Rolling 180D
        "monto_6m", "ops_6m", "monto_max_6m", "monto_std_6m",
        # Red / comportamiento
        "ops_relativas", "diversidad_operaciones", "concentracion_temporal",
        "ratio_vs_promedio", "posible_burst",
    ]
    
    # Solo agregar target si estamos en modo entrenamiento
    if training_mode:
        columnas_base.append("clasificacion_lfpiorpi")
    
    columnas_finales = [c for c in columnas_base if c in df.columns]
    df = df[columnas_finales]
    
    # Sanitizar valores numéricos
    num_cols = df.select_dtypes(include=[np.number]).columns
    df[num_cols] = df[num_cols].replace([np.inf, -np.inf], np.nan)
    medians = df[num_cols].median()
    df[num_cols] = df[num_cols].fillna(medians)
    
    return df


# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================
def procesar_archivo(
    input_csv: str,
    sector_actividad: Optional[str] = None,
    config_path: Optional[str] = None,
    training_mode: bool = False,
    analysis_id: Optional[str] = None,
    user_profile: Optional[Dict[str, Any]] = None,
    output_dir: Optional[str] = None,
) -> str:
    """
    Procesa un archivo CSV: valida, enriquece y guarda.
    
    COMPATIBLE CON enhanced_main_api.py
    
    Args:
        input_csv: Ruta al archivo CSV de entrada
        sector_actividad: Sector (opcional). Valores especiales:
            - "use_file": usar columna del archivo si existe
            - "random": asignar aleatorio
            - None o vacío: inferir de perfil o usar default
            - otro valor: usar como sector literal
        config_path: Ruta a config_modelos.json (opcional)
        training_mode: Si True, genera clasificacion_lfpiorpi como target
                      Si False (inferencia), NO genera clasificacion_lfpiorpi
        analysis_id: ID del análisis para nombrar archivos (opcional)
        user_profile: Perfil del usuario para inferir sector (opcional)
        output_dir: Directorio de salida (opcional)
    
    Returns:
        str: Ruta al archivo CSV enriquecido (compatible con API)
    """
    log("=" * 70)
    log("🚀 VALIDADOR-ENRIQUECEDOR v3.0")
    log(f"   Modo: {'ENTRENAMIENTO' if training_mode else 'INFERENCIA'}")
    log("=" * 70)
    
    input_path = Path(input_csv).resolve()
    log(f"📄 Entrada: {input_path}")
    log(f"🏢 Sector: {sector_actividad or 'auto-detectar'}")
    
    # Cargar configuración
    cfg = load_config(config_path)
    uma = get_uma_diaria(cfg)
    log(f"💰 UMA diaria: ${uma:,.2f} MXN")
    
    # Leer CSV
    df = pd.read_csv(input_csv)
    log(f"📊 Cargadas {len(df):,} filas | {len(df.columns)} columnas")
    
    # Validar estructura
    df_valid, reporte = validar_estructura(df, cfg)
    
    if not reporte["archivo_valido"]:
        log("❌ Archivo inválido:")
        for err in reporte["errores"]:
            log(f"   - {err}")
        raise ValueError(f"Archivo inválido: {reporte['errores']}")
    
    for adv in reporte["advertencias"]:
        log(f"⚠️ {adv}")
    
    # Asignar sector (OPCIONAL - ahora se infiere si falta)
    log("🏭 Asignando sector de actividad...")
    df_con_sector = asignar_sector_actividad(df_valid, sector_actividad, cfg, user_profile)
    
    # Enriquecer (pasamos training_mode para controlar si genera clasificacion_lfpiorpi)
    log("🔧 Enriqueciendo datos...")
    df_enriched = enriquecer_dataframe(df_con_sector, cfg, training_mode=training_mode)
    
    # Determinar ruta de salida
    if output_dir:
        out_dir = Path(output_dir)
    elif analysis_id:
        # Para API: guardar en outputs/enriched/pending para que ml_runner lo procese
        out_dir = input_path.parent.parent / "outputs" / "enriched" / "pending"
    else:
        out_dir = input_path.parent / "enriched"
    
    out_dir.mkdir(parents=True, exist_ok=True)
    
    if analysis_id:
        out_filename = f"{analysis_id}.csv"
    else:
        out_filename = f"{input_path.stem}_enriched.csv"
    
    out_path = out_dir / out_filename
    df_enriched.to_csv(out_path, index=False, encoding="utf-8")
    
    if training_mode and "clasificacion_lfpiorpi" in df_enriched.columns:
        dist = df_enriched["clasificacion_lfpiorpi"].value_counts().to_dict()
        log(f"   Distribución: {dist}")
    else:
        log(f"   (Sin clasificacion_lfpiorpi - modo inferencia)")
    log("=" * 70)
    
    # Retornar solo string para compatibilidad con API
    return str(out_path)


# ============================================================================
# FUNCIONES DE COMPATIBILIDAD
# ============================================================================
def normalizar_sector_legacy(
    df: Optional[pd.DataFrame],
    sector_arg: str,
    cfg: Dict[str, Any]
) -> pd.DataFrame:
    """Wrapper de compatibilidad con código legacy (DEPRECATED - usar asignar_sector_actividad)"""
    if df is None:
        raise ValueError("DataFrame no puede ser None")
    return asignar_sector_actividad(df, sector_arg, cfg)


def add_sector(df: pd.DataFrame, sector_arg: str, cfg: Dict[str, Any]) -> pd.DataFrame:
    """Alias para compatibilidad"""
    return asignar_sector_actividad(df, sector_arg, cfg)


# ============================================================================
# ALIASES DE COMPATIBILIDAD CON enhanced_main_api.py
# ============================================================================
def enrich_features(df: pd.DataFrame, cfg: Dict[str, Any] = None) -> pd.DataFrame:
    """
    Alias de compatibilidad para enhanced_main_api.py
    Llama a enriquecer_dataframe con training_mode=False
    
    Si no se pasa config, lo carga automáticamente.
    """
    if cfg is None:
        cfg = load_config()
    return enriquecer_dataframe(df, cfg, training_mode=False)


# Alias adicionales que tu API podría estar usando
validar_archivo = validar_estructura  # Si usa este nombre
validate_structure = validar_estructura  # Versión en inglés


# ============================================================================
# CLI
# ============================================================================
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(
            "\nUso: python validador_enriquecedor.py <input.csv> [sector|random] [config_path]\n"
            "\nEjemplos:\n"
            "  python validador_enriquecedor.py datos.csv\n"
            "  python validador_enriquecedor.py datos.csv inmobiliaria\n"
            "  python validador_enriquecedor.py datos.csv random config.json\n",
            file=sys.stderr,
        )
        sys.exit(1)
    
    input_csv = sys.argv[1]
    sector = sys.argv[2] if len(sys.argv) >= 3 else None
    cfg_path = sys.argv[3] if len(sys.argv) >= 4 else None
    
    try:
        output_path = procesar_archivo(input_csv, sector, cfg_path, training_mode=True)
        print(f"\n✅ Archivo procesado: {output_path}")
    except Exception as e:
        log(f"❌ Error: {e}")
        sys.exit(1)