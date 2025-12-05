#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validador_enriquecedor.py - VERSIÓN 4.0

Pipeline de validación y enriquecimiento para TarantulaHawk.

Flujo:
1. Valida campos obligatorios (cliente_id, monto, fecha, tipo_operacion)
2. Normaliza sector_actividad → fraccion LFPIORPI
3. Enriquece con features derivadas
4. Guarda CSV listo para ml_runner.py

IMPORTANTE:
- servicios_generales (restaurantes, tiendas, etc.) NO tienen fracción LFPIORPI
- Estas actividades pasan directamente al ML sin guardrails
- Solo las actividades vulnerables (Art. 17) tienen umbrales

Uso:
    python validador_enriquecedor.py archivo.csv
    python validador_enriquecedor.py archivo.xlsx --output enriched.csv
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, Tuple, List

# ============================================================================
# LOGGING
# ============================================================================
def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] [validador] {msg}", flush=True)


# ============================================================================
# CONFIGURACIÓN
# ============================================================================
_CONFIG_CACHE: Dict[str, Any] = {}


def _find_config_path() -> Path:
    """Busca config_modelos.json"""
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
    raise FileNotFoundError(f"config_modelos.json no encontrado")


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """Carga configuración"""
    global _CONFIG_CACHE
    p = Path(config_path) if config_path else _find_config_path()
    cache_key = str(p)
    if cache_key in _CONFIG_CACHE:
        return _CONFIG_CACHE[cache_key]
    log(f"📁 Cargando config: {p}")
    with open(p, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    _CONFIG_CACHE[cache_key] = cfg
    return cfg


def get_uma_mxn(cfg: Dict[str, Any]) -> float:
    """Obtiene UMA en MXN"""
    lfpi = cfg.get("lfpiorpi", {})
    return float(lfpi.get("uma_diaria", lfpi.get("uma_mxn", 113.14)))


# ============================================================================
# MAPEO SECTOR → FRACCIÓN LFPIORPI
# ============================================================================
SECTOR_TO_FRACCION_MAP = {
    # ========== FRACCIÓN I: JUEGOS Y SORTEOS ==========
    "juegos": "I_juegos",
    "juegos_apuestas": "I_juegos",
    "apuestas": "I_juegos",
    "casino": "I_juegos",
    "casinos": "I_juegos",
    "sorteos": "I_juegos",
    "loteria": "I_juegos",
    "lotería": "I_juegos",
    
    # ========== FRACCIÓN II: TARJETAS ==========
    "tarjetas": "II_tarjetas_servicios",
    "tarjetas_credito": "II_tarjetas_servicios",
    "tarjetas_servicios": "II_tarjetas_servicios",
    "tarjetas_prepago": "II_tarjetas_prepago",
    "prepago": "II_tarjetas_prepago",
    
    # ========== FRACCIÓN III: CHEQUES VIAJERO / CASA CAMBIO ==========
    "cheques_viajero": "III_cheques_viajero",
    "casa_cambio": "III_cheques_viajero",
    "cambio_divisas": "III_cheques_viajero",
    "divisas": "III_cheques_viajero",
    "forex": "III_cheques_viajero",
    
    # ========== FRACCIÓN IV: PRÉSTAMOS ==========
    "prestamos": "IV_mutuo",
    "préstamos": "IV_mutuo",
    "creditos": "IV_mutuo",
    "créditos": "IV_mutuo",
    "financiera": "IV_mutuo",
    "mutuo": "IV_mutuo",
    "sofom": "IV_mutuo",
    "sofipo": "IV_mutuo",
    
    # ========== FRACCIÓN V: INMUEBLES ==========
    "inmobiliaria": "V_inmuebles",
    "inmuebles": "V_inmuebles",
    "bienes_raices": "V_inmuebles",
    "bienes_raíces": "V_inmuebles",
    "real_estate": "V_inmuebles",
    "construccion": "V_inmuebles",
    "construcción": "V_inmuebles",
    "desarrollo_inmobiliario": "V_bis_desarrollo_inmobiliario",
    
    # ========== FRACCIÓN VI: JOYERÍA Y METALES ==========
    "joyeria": "VI_joyeria_metales",
    "joyería": "VI_joyeria_metales",
    "joyas": "VI_joyeria_metales",
    "metales": "VI_joyeria_metales",
    "metales_preciosos": "VI_joyeria_metales",
    "oro": "VI_joyeria_metales",
    "plata": "VI_joyeria_metales",
    "relojes": "VI_joyeria_metales",
    "relojes_lujo": "VI_joyeria_metales",
    "piedras_preciosas": "VI_joyeria_metales",
    "diamantes": "VI_joyeria_metales",
    
    # ========== FRACCIÓN VII: OBRAS DE ARTE ==========
    "arte": "VII_obras_arte",
    "obras_arte": "VII_obras_arte",
    "galeria": "VII_obras_arte",
    "galería": "VII_obras_arte",
    "subastas": "VII_obras_arte",
    "antiguedades": "VII_obras_arte",
    "antigüedades": "VII_obras_arte",
    "coleccionables": "VII_obras_arte",
    
    # ========== FRACCIÓN VIII: VEHÍCULOS ==========
    "vehiculos": "VIII_vehiculos",
    "vehículos": "VIII_vehiculos",
    "automotriz": "VIII_vehiculos",
    "autos": "VIII_vehiculos",
    "coches": "VIII_vehiculos",
    "agencia_autos": "VIII_vehiculos",
    "seminuevos": "VIII_vehiculos",
    "concesionaria": "VIII_vehiculos",
    "motos": "VIII_vehiculos",
    "motocicletas": "VIII_vehiculos",
    "barcos": "VIII_vehiculos",
    "yates": "VIII_vehiculos",
    "aviones": "VIII_vehiculos",
    "aeronaves": "VIII_vehiculos",
    
    # ========== FRACCIÓN IX: BLINDAJE ==========
    "blindaje": "IX_blindaje",
    "blindados": "IX_blindaje",
    "blindaje_vehiculos": "IX_blindaje",
    
    # ========== FRACCIÓN X: TRASLADO DE VALORES ==========
    "traslado_valores": "X_traslado_valores",
    "custodia_valores": "X_traslado_valores",
    "transporte_valores": "X_traslado_valores",
    "transmision_dinero": "X_traslado_valores",
    "envio_dinero": "X_traslado_valores",
    "remesas": "X_traslado_valores",
    "money_transfer": "X_traslado_valores",
    
    # ========== FRACCIÓN XI: SERVICIOS PROFESIONALES ==========
    # NOTA: Solo aplica cuando preparan operaciones del Art. 17
    "servicios_profesionales": "XI_servicios_profesionales",
    "abogados": "XI_servicios_profesionales",
    "contadores": "XI_servicios_profesionales",
    
    # ========== FRACCIÓN XII: FEDATARIOS ==========
    "notario": "XII_A_notarios_derechos_inmuebles",
    "notarios": "XII_A_notarios_derechos_inmuebles",
    "notaria": "XII_A_notarios_derechos_inmuebles",
    "notaría": "XII_A_notarios_derechos_inmuebles",
    "fedatario": "XII_A_notarios_derechos_inmuebles",
    "fedatarios": "XII_A_notarios_derechos_inmuebles",
    "corredor_publico": "XII_B_corredores",
    
    # ========== FRACCIÓN XV: ARRENDAMIENTO ==========
    "arrendamiento": "XV_arrendamiento_inmuebles",
    "arrendamiento_inmuebles": "XV_arrendamiento_inmuebles",
    "renta_inmuebles": "XV_arrendamiento_inmuebles",
    
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
    "vasp": "XVI_activos_virtuales",
    "tokens": "XVI_activos_virtuales",
    "nft": "XVI_activos_virtuales",
    "defi": "XVI_activos_virtuales",
    "blockchain": "XVI_activos_virtuales",
    
    # ==========================================================
    # SERVICIOS GENERALES - NO SON ACTIVIDAD VULNERABLE
    # Estas actividades NO tienen fracción LFPIORPI
    # Pasan directamente al ML sin guardrails
    # ==========================================================
    "servicios": "servicios_generales",
    "servicios_generales": "servicios_generales",
    "comercio": "servicios_generales",
    "retail": "servicios_generales",
    "tienda": "servicios_generales",
    "tiendas": "servicios_generales",
    "restaurante": "servicios_generales",
    "restaurantes": "servicios_generales",
    "comida": "servicios_generales",
    "alimentos": "servicios_generales",
    "hotel": "servicios_generales",
    "hoteles": "servicios_generales",
    "turismo": "servicios_generales",
    "salud": "servicios_generales",
    "hospital": "servicios_generales",
    "clinica": "servicios_generales",
    "clínica": "servicios_generales",
    "educacion": "servicios_generales",
    "educación": "servicios_generales",
    "escuela": "servicios_generales",
    "universidad": "servicios_generales",
    "tecnologia": "servicios_generales",
    "tecnología": "servicios_generales",
    "software": "servicios_generales",
    "ti": "servicios_generales",
    "consultoria": "servicios_generales",
    "consultoría": "servicios_generales",
    "profesional": "servicios_generales",
    "manufactura": "servicios_generales",
    "industrial": "servicios_generales",
    "fabrica": "servicios_generales",
    "fábrica": "servicios_generales",
    "agricola": "servicios_generales",
    "agrícola": "servicios_generales",
    "agricultura": "servicios_generales",
    "ganaderia": "servicios_generales",
    "ganadería": "servicios_generales",
    "farmacia": "servicios_generales",
    "farmacias": "servicios_generales",
    "textil": "servicios_generales",
    "moda": "servicios_generales",
    "ropa": "servicios_generales",
    "supermercado": "servicios_generales",
    "abarrotes": "servicios_generales",
    "ferreteria": "servicios_generales",
    "ferretería": "servicios_generales",
    "papeleria": "servicios_generales",
    "papelería": "servicios_generales",
    "gimnasio": "servicios_generales",
    "gym": "servicios_generales",
    "spa": "servicios_generales",
    "belleza": "servicios_generales",
    "estetica": "servicios_generales",
    "estética": "servicios_generales",
    "veterinaria": "servicios_generales",
    "mascotas": "servicios_generales",
    "transporte": "servicios_generales",
    "logistica": "servicios_generales",
    "logística": "servicios_generales",
    "mensajeria": "servicios_generales",
    "mensajería": "servicios_generales",
    "limpieza": "servicios_generales",
    "seguridad": "servicios_generales",
    "publicidad": "servicios_generales",
    "marketing": "servicios_generales",
    "medios": "servicios_generales",
    "entretenimiento": "servicios_generales",
    "eventos": "servicios_generales",
    "otro": "servicios_generales",
    "otros": "servicios_generales",
    "general": "servicios_generales",
    "no_especificado": "servicios_generales",
    "desconocido": "servicios_generales",
    "banco": "servicios_generales",  # Bancos tienen su propia regulación, no LFPIORPI
    "bancos": "servicios_generales",
}


def normalizar_sector(sector_raw: Any) -> str:
    """
    Normaliza sector de actividad a fracción LFPIORPI.
    
    - Si es actividad vulnerable → retorna fracción (ej: "VI_joyeria_metales")
    - Si NO es actividad vulnerable → retorna "servicios_generales"
    
    servicios_generales pasa LIBRE al ML (sin guardrails LFPIORPI)
    """
    if pd.isna(sector_raw) or sector_raw is None:
        return "servicios_generales"
    
    # Limpiar
    sector_clean = str(sector_raw).lower().strip()
    
    # Quitar acentos
    acentos = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n'}
    for a, s in acentos.items():
        sector_clean = sector_clean.replace(a, s)
    
    if not sector_clean or sector_clean in ("nan", "none", "null", ""):
        return "servicios_generales"
    
    # Match exacto
    if sector_clean in SECTOR_TO_FRACCION_MAP:
        return SECTOR_TO_FRACCION_MAP[sector_clean]
    
    # Match con underscores
    sector_underscore = sector_clean.replace(" ", "_").replace("-", "_")
    if sector_underscore in SECTOR_TO_FRACCION_MAP:
        return SECTOR_TO_FRACCION_MAP[sector_underscore]
    
    # Match parcial
    for keyword, fraccion in SECTOR_TO_FRACCION_MAP.items():
        if keyword in sector_clean or sector_clean in keyword:
            return fraccion
    
    # Default: servicios_generales (pasa al ML sin guardrails)
    return "servicios_generales"


def es_actividad_vulnerable(fraccion: str) -> bool:
    """
    Determina si una fracción es actividad vulnerable bajo LFPIORPI.
    
    servicios_generales → NO es vulnerable → pasa libre al ML
    """
    NO_VULNERABLES = [
        "servicios_generales", "_general", "_no_vulnerable",
        "otro", "servicios", "comercio"
    ]
    return fraccion not in NO_VULNERABLES and not fraccion.startswith("_")


# ============================================================================
# VALIDACIÓN
# ============================================================================
def validar_campos_obligatorios(df: pd.DataFrame, cfg: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Valida que existan campos obligatorios"""
    campos_req = cfg.get("validacion", {}).get("campos_obligatorios", 
                                                ["cliente_id", "monto", "fecha", "tipo_operacion"])
    errores = []
    
    for campo in campos_req:
        if campo not in df.columns:
            errores.append(f"Campo obligatorio faltante: {campo}")
    
    return len(errores) == 0, errores


def validar_tipos_datos(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Valida y convierte tipos de datos"""
    df = df.copy()
    warnings = []
    
    # Monto: debe ser numérico
    if "monto" in df.columns:
        df["monto"] = pd.to_numeric(df["monto"], errors="coerce")
        nulos = df["monto"].isna().sum()
        if nulos > 0:
            warnings.append(f"⚠️ {nulos} montos no numéricos convertidos a NaN")
    
    # Fecha: intentar parsear
    if "fecha" in df.columns:
        df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
        nulos = df["fecha"].isna().sum()
        if nulos > 0:
            warnings.append(f"⚠️ {nulos} fechas inválidas")
    
    return df, warnings


# ============================================================================
# ENRIQUECIMIENTO
# ============================================================================
def enriquecer_transacciones(df: pd.DataFrame, cfg: Dict[str, Any]) -> pd.DataFrame:
    """
    Enriquece el DataFrame con features derivadas.
    
    Features generadas:
    - fraccion: Fracción LFPIORPI normalizada
    - es_actividad_vulnerable: bool
    - EsEfectivo, EsInternacional, SectorAltoRiesgo
    - monto_6m, ops_6m (acumulados por cliente)
    - ratio_vs_promedio, efectivo_alto, acumulado_alto
    - es_nocturno, fin_de_semana, es_monto_redondo, posible_burst
    """
    df = df.copy()
    uma = get_uma_mxn(cfg)
    lfpi = cfg.get("lfpiorpi", {})
    umbrales = lfpi.get("umbrales", {})
    alto_riesgo_list = lfpi.get("actividad_alto_riesgo", [])
    
    # ================================================================
    # 1. Normalizar sector → fracción
    # ================================================================
    # Support alternative input column name 'giro_actividad' as alias of sector
    if "giro_actividad" in df.columns and "sector_actividad" not in df.columns:
        df["sector_actividad"] = df["giro_actividad"]

    if "sector_actividad" not in df.columns:
        df["sector_actividad"] = "servicios_generales"
    
    df["fraccion"] = df["sector_actividad"].apply(normalizar_sector)
    # Preserve input es_actividad_vulnerable if provided, otherwise derive from fraccion/config
    if "es_actividad_vulnerable" not in df.columns:
        df["es_actividad_vulnerable"] = df["fraccion"].apply(es_actividad_vulnerable)
    else:
        # Normalize if it's string/boolean
        df["es_actividad_vulnerable"] = df["es_actividad_vulnerable"].apply(lambda x: 1 if str(x).lower() in ("1","true","yes","si","sí") else 0)
    
    log(f"  📊 Fracciones: {df['fraccion'].value_counts().to_dict()}")
    log(f"  📊 Vulnerables: {df['es_actividad_vulnerable'].sum()}/{len(df)}")
    
    # ================================================================
    # 2. Flags de tipo de operación
    # ================================================================
    if "tipo_operacion" in df.columns:
        tipo_lower = df["tipo_operacion"].str.lower().fillna("")
        df["EsEfectivo"] = tipo_lower.str.contains("efectivo|cash|efvo", regex=True).astype(int)
        df["EsInternacional"] = tipo_lower.str.contains("internacional|inter|foreign|ext", regex=True).astype(int)
    else:
        df["EsEfectivo"] = 0
        df["EsInternacional"] = 0
    
    # ================================================================
    # 3. Sector alto riesgo
    # ================================================================
    df["SectorAltoRiesgo"] = df["fraccion"].isin(alto_riesgo_list).astype(int)
    
    # ================================================================
    # 4. Acumulados por cliente (últimos 6 months simulated)
    # ================================================================
    if "cliente_id" in df.columns and "monto" in df.columns:
        # Agrupar por cliente
        cliente_stats = df.groupby("cliente_id").agg({
            "monto": ["sum", "mean", "count"]
        }).reset_index()
        cliente_stats.columns = ["cliente_id", "monto_total", "monto_promedio", "num_ops"]
        
        df = df.merge(cliente_stats, on="cliente_id", how="left")
        
        # monto_6m = suma de operaciones del cliente (simplificado)
        df["monto_6m"] = df["monto_total"].fillna(0)
        df["ops_6m"] = df["num_ops"].fillna(1).astype(int)
        df["monto_promedio_cliente"] = df["monto_promedio"].fillna(df["monto"])
        # Initialize rolling stats; will fill with windowed values
        df["monto_max_6m"] = 0.0
        df["monto_std_6m"] = 0.0
        
        # Ratio vs promedio
        df["ratio_vs_promedio"] = (df["monto"] / df["monto_promedio_cliente"].replace(0, 1)).round(2)
        
        # Calculate windowed stats per cliente (last 180 days window)
        from datetime import timedelta
        df = df.sort_values(["cliente_id", "fecha"]).reset_index(drop=True)
        for cliente_id in df["cliente_id"].unique():
            mask_cliente = df["cliente_id"] == cliente_id
            ventana_idx = df[mask_cliente].index
            for idx in ventana_idx:
                fecha_actual = df.loc[idx, "fecha"]
                if pd.isna(fecha_actual):
                    df.loc[idx, "monto_6m"] = df.loc[idx, "monto"]
                    df.loc[idx, "ops_6m"] = 1
                    df.loc[idx, "monto_max_6m"] = df.loc[idx, "monto"]
                    df.loc[idx, "monto_std_6m"] = 0.0
                    continue
                fecha_inicio = fecha_actual - timedelta(days=180)
                mask_ventana = (df["cliente_id"] == cliente_id) & (df["fecha"] >= fecha_inicio) & (df["fecha"] <= fecha_actual)
                ventana_df = df[mask_ventana]
                if len(ventana_df) > 0:
                    df.loc[idx, "monto_6m"] = ventana_df["monto"].sum()
                    df.loc[idx, "ops_6m"] = len(ventana_df)
                    df.loc[idx, "monto_max_6m"] = ventana_df["monto"].max()
                    df.loc[idx, "monto_std_6m"] = ventana_df["monto"].std() if len(ventana_df) > 1 else 0.0
                else:
                    df.loc[idx, "monto_6m"] = df.loc[idx, "monto"]
                    df.loc[idx, "ops_6m"] = 1
                    df.loc[idx, "monto_max_6m"] = df.loc[idx, "monto"]
                    df.loc[idx, "monto_std_6m"] = 0.0

        # Limpiar columnas temporales
        df = df.drop(columns=["monto_total", "monto_promedio", "num_ops"], errors="ignore")
    else:
        df["monto_6m"] = df["monto"] if "monto" in df.columns else 0
        df["ops_6m"] = 1
        df["ratio_vs_promedio"] = 1.0
        df["monto_max_6m"] = df["monto"] if "monto" in df.columns else 0
        df["monto_std_6m"] = 0.0
    
    # ================================================================
    # 5. Efectivo alto (>=75% del umbral)
    # ================================================================
    def calcular_efectivo_alto(row):
        if row.get("EsEfectivo") != 1:
            return 0
        fraccion = row.get("fraccion", "servicios_generales")
        monto = float(row.get("monto", 0) or 0)
        
        # Obtener umbral de efectivo de la fracción
        u = umbrales.get(fraccion, umbrales.get("_general", {}))
        umbral_ef_umas = float(u.get("efectivo_max_UMA", u.get("aviso_UMA", 645)))
        umbral_ef_mxn = umbral_ef_umas * uma
        
        if umbral_ef_mxn > 0 and monto >= 0.75 * umbral_ef_mxn:
            return 1
        return 0
    
    df["efectivo_alto"] = df.apply(calcular_efectivo_alto, axis=1)
    
    # ================================================================
    # 6. Acumulado alto (monto_6m >= 500k o >= umbral)
    # ================================================================
    df["acumulado_alto"] = (df["monto_6m"] >= 500000).astype(int)
    
    # ================================================================
    # 7. Features temporales
    # ================================================================
    if "fecha" in df.columns and df["fecha"].dtype == "datetime64[ns]":
        df["dia_semana"] = df["fecha"].dt.dayofweek
        df["mes"] = df["fecha"].dt.month
        df["fin_de_semana"] = (df["dia_semana"] >= 5).astype(int)
        df["quincena"] = (df["fecha"].dt.day > 15).astype(int)
    else:
        df["dia_semana"] = 0
        df["mes"] = 1
        df["fin_de_semana"] = 0
        df["quincena"] = 0
    
    if "hora" in df.columns:
        hora = pd.to_numeric(df["hora"], errors="coerce").fillna(12)
        df["es_nocturno"] = ((hora >= 22) | (hora <= 5)).astype(int)
    else:
        df["es_nocturno"] = 0
    
    # ================================================================
    # 8. Monto redondo
    # ================================================================
    if "monto" in df.columns:
        df["es_monto_redondo"] = ((df["monto"] % 10000) < 100).astype(int)
    else:
        df["es_monto_redondo"] = 0
    
    # ================================================================
    # 9. Posible burst (múltiples ops del mismo cliente en poco tiempo)
    # ================================================================
    # 10. Rolling & advanced features: ops_relativas, diversidad, concentracion
    total_ops = len(df)
    df["ops_relativas"] = (df["ops_6m"] / total_ops) if total_ops > 0 else 0
    df["diversidad_operaciones"] = df.groupby("cliente_id")["tipo_operacion"].transform("nunique") / 4.0 if "cliente_id" in df.columns and "tipo_operacion" in df.columns else 0
    df["concentracion_temporal"] = df.groupby("cliente_id")["mes"].transform(lambda x: (x.value_counts().max() / len(x)) if len(x) > 0 else 0)

    # NOTE: Remove quantile bucket features by default to limit created columns.
    # Quantile features (q) can be added later if explicitly required by a bundle.

    # Create dummies for categorical features if present — limit to tipo_operacion, sector_actividad and fraccion
    # NOTE: We include sector_actividad because models were trained with sector_* one-hot columns
    cat_cols = [c for c in ["tipo_operacion", "sector_actividad", "fraccion"] if c in df.columns]
    if cat_cols:
        # Drop any pre-existing one-hot columns to avoid duplicate labels (e.g., fraccion_*, sector_actividad_*, tipo_operacion_*)
        dummy_prefixes = ("fraccion_", "sector_actividad_", "tipo_operacion_")
        cols_to_drop = [c for c in df.columns if any(c.startswith(p) for p in dummy_prefixes)]
        if cols_to_drop:
            log(f"  ⚠️ Eliminando columnas dummy preexistentes: {cols_to_drop[:20]}")
            df = df.drop(columns=cols_to_drop, errors="ignore")

        # Preserve original columns to avoid KeyError on later usage
        preserved = {c: df[c].copy() for c in cat_cols}
        df = pd.get_dummies(df, columns=cat_cols, drop_first=False, dtype=float)
        # Restore original columns
        for c, col in preserved.items():
            df[c] = col

    # Ensure 'fraccion' exists: if missing (e.g., dummies only), derive it from fraccion_* dummies
    if 'fraccion' not in df.columns:
        fr_cols = [c for c in df.columns if c.startswith('fraccion_')]
        if fr_cols:
            df['fraccion'] = df[fr_cols].idxmax(axis=1).str.replace('fraccion_', '', regex=False)
        else:
            df['fraccion'] = 'servicios_generales'

    # If input included 'es_actividad_vulnerable' (explicit), trust it; otherwise compute from fraccion/config
    if "es_actividad_vulnerable" not in df.columns:
        df["es_actividad_vulnerable"] = df["fraccion"].apply(lambda f: f in cfg.get("lfpiorpi", {}).get("actividad_alto_riesgo", []) if isinstance(f, str) else False).astype(int)
    if "cliente_id" in df.columns:
        # Simplificado: si tiene más de 3 operaciones
        df["posible_burst"] = (df["ops_6m"] > 3).astype(int)
    else:
        df["posible_burst"] = 0
    
    # ================================================================
    # 10. Features adicionales para ML
    # ================================================================
    df["monto_umas"] = (df["monto"] / uma).round(2) if "monto" in df.columns else 0
    
    # Porcentaje del umbral de aviso
    def calc_pct_umbral(row):
        fraccion = row.get("fraccion", "servicios_generales")
        monto = float(row.get("monto", 0) or 0)
        u = umbrales.get(fraccion, umbrales.get("_general", {}))
        umbral_umas = float(u.get("aviso_UMA", 645))
        umbral_mxn = umbral_umas * uma
        if umbral_mxn > 0 and umbral_mxn < 100000000:
            return round((monto / umbral_mxn) * 100, 2)
        return 0
    
    df["pct_umbral_aviso"] = df.apply(calc_pct_umbral, axis=1)
    
    # Frecuencia mensual aproximada
    df["frecuencia_mensual"] = (df["ops_6m"] / 6).round(0).astype(int).clip(lower=1)
    
    # Ratio alto flag
    df["ratio_alto"] = (df["ratio_vs_promedio"] > 3).astype(int)
    
    # Frecuencia alta flag
    df["frecuencia_alta"] = (df["ops_6m"] > 5).astype(int)

    # TODO: Implement supabase historical lookups for monto_6m by cliente_id (deferred)
    
    return df


# Backwards-compatible English alias expected by other modules
def enrich_features(df: pd.DataFrame, cfg: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
    """Backward compatibility wrapper: alias for `enriquecer_transacciones`.

    Some parts of the codebase import `enrich_features` (English name).
    Provide this wrapper for compatibility.
    """
    return enriquecer_transacciones(df, cfg or {})


# ============================================================================
# PIPELINE PRINCIPAL
# ============================================================================
def procesar_archivo(
    input_path: Optional[str] = None,
    output_path: Optional[str] = None,
    config_path: Optional[str] = None,
    # Backwards-compatible keyword names used across the repo
    input_csv: Optional[str] = None,
    sector_actividad: Optional[str] = None,
    training_mode: bool = False,
    analysis_id: Optional[str] = None,
    # If True, returns just the path string (used by some callers). Default: False
    return_path_only: bool = False,
    **kwargs
) -> Tuple[bool, str, Optional[pd.DataFrame]] | str:
    """
    Procesa un archivo CSV/Excel y genera CSV enriquecido.
    
    Returns:
        (success, message, df_enriched)
    """
    log(f"\n{'='*70}")
    log(f"📄 Procesando: {input_path}")
    log(f"{'='*70}")
    
    try:
        # Cargar config
        cfg = load_config(config_path)
        
        # Cargar archivo
        # Allow calling with either `input_path` or legacy `input_csv` kwarg
        if input_csv and not input_path:
            input_path = input_csv

        if not input_path:
            raise ValueError("input_path or input_csv must be provided")

        input_file = Path(input_path)
        if not input_file.exists():
            return False, f"Archivo no encontrado: {input_path}", None
        
        if input_file.suffix.lower() in [".xlsx", ".xls"]:
            df = pd.read_excel(input_file)
        else:
            df = pd.read_csv(input_file)
        
        log(f"  📊 Cargado: {len(df)} filas, {len(df.columns)} columnas")
        log(f"  📋 Columnas: {list(df.columns)}")
        
        # Validar campos obligatorios
        valid, errores = validar_campos_obligatorios(df, cfg)
        if not valid:
            return False, f"Validación fallida: {errores}", None
        
        # Validar tipos de datos
        df, warnings = validar_tipos_datos(df)
        for w in warnings:
            log(f"  {w}")
        
        # Enriquecer
        log("\n  🔧 Enriqueciendo datos...")
        df = enriquecer_transacciones(df, cfg)
        # Debug: log generated columns and show short sample
        cols = list(df.columns)
        log(f"   ✅ Columnas generadas ({len(cols)}): {cols[:40]}{('...' if len(cols) > 40 else '')}")
        
        # Resumen de enriquecimiento
        log(f"\n  📊 RESUMEN DE ENRIQUECIMIENTO:")
        log(f"     Columnas finales: {len(df.columns)}")
        log(f"     Actividades vulnerables: {df['es_actividad_vulnerable'].sum()}")
        # Avoid KeyError if 'fraccion' was replaced (e.g., get_dummies). Prefer 'fraccion' if present
        if 'fraccion' in df.columns:
            servicios_count = int((df['fraccion'] == 'servicios_generales').sum())
        else:
            # fallback: count dummy column if present
            dummy_col = 'fraccion_servicios_generales'
            servicios_count = int(df[dummy_col].sum()) if dummy_col in df.columns else 0
        log(f"     servicios_generales: {servicios_count}")
        log(f"     Efectivo: {df['EsEfectivo'].sum()}")
        log(f"     Efectivo alto: {df['efectivo_alto'].sum()}")
        
        # Guardar
        if output_path is None:
            output_dir = Path(input_path).parent.parent / "outputs" / "enriched" / "pending"
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{input_file.stem}.csv"
        else:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
        
        df.to_csv(output_path, index=False, encoding="utf-8")
        
        log(f"\n  ✅ Guardado: {output_path}")
        log(f"{'='*70}\n")
        
        # If caller expects only the path string (legacy code), return that
        if return_path_only or analysis_id or training_mode or input_csv:
            return str(output_path)

        return True, str(output_path), df
        
    except Exception as e:
        import traceback
        log(f"\n  ❌ Error: {e}")
        traceback.print_exc()
        return False, str(e), None


# ============================================================================
# CLI
# ============================================================================
def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Validador y Enriquecedor TarantulaHawk v4.0")
    parser.add_argument("input", help="Archivo CSV o Excel de entrada")
    parser.add_argument("--output", "-o", help="Archivo de salida (opcional)")
    parser.add_argument("--config", "-c", help="Ruta a config_modelos.json (opcional)")
    
    args = parser.parse_args()
    
    success, message, df = procesar_archivo(args.input, args.output, args.config)
    
    if success:
        print(f"\n✅ Éxito: {message}")
        return 0
    else:
        print(f"\n❌ Error: {message}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
