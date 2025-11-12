#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validador_enriquecedor_v3.py - Versión con Normalización de Sectores fecha 11/11

MEJORAS V3:
✅ Diccionario de normalización automática de sectores → fracciones LFPIORPI
✅ No requiere que el usuario sepa las fracciones exactas
✅ Mapeo inteligente: "metales", "oro", "bitcoin" → fracciones correctas
✅ Soporta variantes, typos, multi-idioma

Uso:
    from validador_enriquecedor_v3 import procesar_archivo
    enriched_path = procesar_archivo("input.csv", sector_actividad="use_file")
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta

# =====================================================
# DICCIONARIO MAESTRO DE NORMALIZACIÓN
# =====================================================

SECTOR_TO_FRACCION_MAP = {
    # ========== FRACCIÓN V: INMUEBLES ==========
    "inmobiliaria": "V_inmuebles",
    "inmuebles": "V_inmuebles",
    "bienes_raices": "V_inmuebles",
    "bienes raices": "V_inmuebles",
    "real_estate": "V_inmuebles",
    "real estate": "V_inmuebles",
    "construccion": "V_inmuebles",
    "constructora": "V_inmuebles",
    "desarrolladora": "V_inmuebles",
    "propiedades": "V_inmuebles",
    "terrenos": "V_inmuebles",
    "departamentos": "V_inmuebles",
    "casas": "V_inmuebles",
    
    # ========== FRACCIÓN VIII: VEHÍCULOS ==========
    "automotriz": "VIII_vehiculos",
    "vehiculos": "VIII_vehiculos",
    "autos": "VIII_vehiculos",
    "coches": "VIII_vehiculos",
    "automoviles": "VIII_vehiculos",
    "agencia_autos": "VIII_vehiculos",
    "agencia automotriz": "VIII_vehiculos",
    "concesionaria": "VIII_vehiculos",
    "seminuevos": "VIII_vehiculos",
    "refacciones": "VIII_vehiculos",
    "motocicletas": "VIII_vehiculos",
    "motos": "VIII_vehiculos",
    "camiones": "VIII_vehiculos",
    "transporte": "VIII_vehiculos",
    
    # ========== FRACCIÓN XI: JOYERÍA Y METALES ==========
    "joyeria": "XI_joyeria",
    "joyería": "XI_joyeria",
    "joyeria_metales": "XI_joyeria",
    "joyería metales": "XI_joyeria",
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
    "bisuteria": "XI_joyeria",
    "orfebreria": "XI_joyeria",
    
    # ========== FRACCIÓN X: TRASLADO DE VALORES ==========
    "traslado_valores": "X_traslado_valores",
    "traslado de valores": "X_traslado_valores",
    "blindaje": "X_traslado_valores",
    "seguridad": "X_traslado_valores",
    "transporte_valores": "X_traslado_valores",
    "transporte de valores": "X_traslado_valores",
    "custodia": "X_traslado_valores",
    
    # ========== FRACCIÓN XVI: ACTIVOS VIRTUALES ==========
    "activos_virtuales": "XVI_activos_virtuales",
    "activos virtuales": "XVI_activos_virtuales",
    "cripto": "XVI_activos_virtuales",
    "criptomonedas": "XVI_activos_virtuales",
    "crypto": "XVI_activos_virtuales",
    "bitcoin": "XVI_activos_virtuales",
    "ethereum": "XVI_activos_virtuales",
    "blockchain": "XVI_activos_virtuales",
    "exchange": "XVI_activos_virtuales",
    "exchange_cripto": "XVI_activos_virtuales",
    "wallet": "XVI_activos_virtuales",
    "nft": "XVI_activos_virtuales",
    "tokens": "XVI_activos_virtuales",
    "defi": "XVI_activos_virtuales",
}

def normalizar_sector(sector_raw):
    """
    Normaliza el sector del usuario a fracción LFPIORPI
    
    Args:
        sector_raw: Sector como lo escribe el usuario
    
    Returns:
        fraccion_lfpiorpi (str)
    
    Ejemplos:
        >>> normalizar_sector("METALES PRECIOSOS")
        'XI_joyeria'
        >>> normalizar_sector("Autos usados")
        'VIII_vehiculos'
        >>> normalizar_sector("Bitcoin Exchange")
        'XVI_activos_virtuales'
    """
    if not sector_raw or pd.isna(sector_raw):
        return "_"
    
    # Normalizar texto
    sector_clean = str(sector_raw).strip().lower()
    sector_clean = sector_clean.replace("á", "a").replace("é", "e").replace("í", "i")
    sector_clean = sector_clean.replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    
    # Buscar match exacto
    if sector_clean in SECTOR_TO_FRACCION_MAP:
        return SECTOR_TO_FRACCION_MAP[sector_clean]
    
    # Buscar match con guiones bajos
    sector_underscore = sector_clean.replace(" ", "_")
    if sector_underscore in SECTOR_TO_FRACCION_MAP:
        return SECTOR_TO_FRACCION_MAP[sector_underscore]
    
    # Buscar match parcial (contiene keyword)
    for keyword, fraccion in SECTOR_TO_FRACCION_MAP.items():
        if keyword in sector_clean or sector_clean in keyword:
            return fraccion
    
    # No encontrado → usar como-está (sin fracción)
    return "_"


def log(msg):
    """Print timestamped log message"""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def load_config(config_path):
    """Load config_modelos.json"""
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def enrich_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Agrega 20 features de enriquecimiento para ML
    """
    df = df.copy()
    
    # Fecha a datetime
    df["fecha_dt"] = pd.to_datetime(df["fecha"], errors="coerce")
    
    # Features binarias
    df["EsEfectivo"] = (df["tipo_operacion"] == "efectivo").astype(int)
    df["EsInternacional"] = (df["tipo_operacion"] == "transferencia_internacional").astype(int)
    
    # Temporales
    df["fin_de_semana"] = df["fecha_dt"].dt.dayofweek.isin([5, 6]).astype(int)
    df["es_nocturno"] = ((df["fecha_dt"].dt.hour >= 0) & (df["fecha_dt"].dt.hour < 6)).astype(int)
    df["es_monto_redondo"] = (df["monto"] % 1000 == 0).astype(int)
    df["mes"] = df["fecha_dt"].dt.month
    df["dia_semana"] = df["fecha_dt"].dt.dayofweek
    df["quincena"] = (df["fecha_dt"].dt.day > 15).astype(int)
    
    # Agregar frecuencia_mensual (placeholder)
    df["frecuencia_mensual"] = 1  # Se calcularía en un sistema real
    
    # Rolling features (por cliente)
    df = df.sort_values(["cliente_id", "fecha_dt"]).reset_index(drop=True)
    
    rolling_cols = []
    for col in ["monto_6m", "ops_6m", "monto_max_6m", "monto_std_6m"]:
        df[col] = 0.0
        rolling_cols.append(col)
    
    # Calcular por cliente
    for cliente_id in df["cliente_id"].unique():
        mask = df["cliente_id"] == cliente_id
        cliente_df = df[mask].sort_values("fecha_dt")
        
        # Window de 6 meses (180 días)
        window_days = 180
        
        for idx in cliente_df.index:
            fecha_actual = df.loc[idx, "fecha_dt"]
            fecha_inicio = fecha_actual - timedelta(days=window_days)
            
            # Transacciones previas del cliente en ventana
            mask_ventana = (df["cliente_id"] == cliente_id) & \
                          (df["fecha_dt"] >= fecha_inicio) & \
                          (df["fecha_dt"] <= fecha_actual)
            
            ventana_df = df[mask_ventana]
            
            if len(ventana_df) > 0:
                df.loc[idx, "monto_6m"] = ventana_df["monto"].sum()
                df.loc[idx, "ops_6m"] = len(ventana_df)
                df.loc[idx, "monto_max_6m"] = ventana_df["monto"].max()
                df.loc[idx, "monto_std_6m"] = ventana_df["monto"].std() if len(ventana_df) > 1 else 0.0
    
    # Features derivadas
    total_ops = len(df)
    df["ops_relativas"] = df["ops_6m"] / total_ops if total_ops > 0 else 0
    df["diversidad_operaciones"] = df.groupby("cliente_id")["tipo_operacion"].transform("nunique") / 4.0
    df["concentracion_temporal"] = df.groupby("cliente_id")["mes"].transform(lambda x: (x.value_counts().max() / len(x)) if len(x) > 0 else 0)
    
    # Ratio vs promedio
    monto_promedio = df["monto"].mean()
    df["ratio_vs_promedio"] = df["monto"] / monto_promedio if monto_promedio > 0 else 1.0
    
    # Posible burst (operaciones concentradas)
    df["posible_burst"] = ((df["ops_6m"] > df["ops_6m"].quantile(0.95)) & 
                           (df["monto"] > df["monto"].quantile(0.75))).astype(int)
    
    return df


def procesar_archivo(
    file_path: str,
    sector_actividad: str = "use_file",
    config_path: str = None,
    training_mode: bool = False,
    analysis_id: str = None
):
    """
    Procesa archivo CSV: valida estructura y enriquece con features
    
    Args:
        file_path: Ruta al CSV de entrada (4-5 columnas)
        sector_actividad: "use_file" para usar columna del archivo, o especificar
        config_path: Ruta a config_modelos.json
        training_mode: Si True, agrega clasificacion_lfpiorpi (solo entrenamiento)
        analysis_id: ID único para guardar en pending/ (modo inferencia)
    
    Returns:
        str: Ruta al archivo enriquecido
    """
    
    log("==== INICIO VALIDACIÓN/ENRIQUECIMIENTO V3 (con normalización) ====")
    log(f"Archivo de entrada: {file_path}")
    log(f"Sector actividad: {sector_actividad}")
    
    # Load config
    if config_path is None:
        config_path = Path(__file__).parent.parent.parent / "models" / "config_modelos.json"
    
    log(f"Config encontrado: {config_path}")
    config = load_config(str(config_path))
    
    # Load CSV
    df = pd.read_csv(file_path, encoding="utf-8-sig", skip_blank_lines=True)
    log(f"Cargado: {len(df)} filas, {len(df.columns)} columnas")
    
    # Validar columnas requeridas
    required = ["cliente_id", "monto", "fecha", "tipo_operacion"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Columnas faltantes: {missing}")
    
    # ✅ NORMALIZACIÓN DE SECTOR_ACTIVIDAD → FRACCIÓN
    if "sector_actividad" in df.columns:
        log(f"📋 Normalizando {len(df['sector_actividad'].unique())} sectores únicos...")
        
        df["fraccion"] = df["sector_actividad"].apply(normalizar_sector)
        
        # Reportar mapeos
        mapeos = df[["sector_actividad", "fraccion"]].drop_duplicates()
        log(f"   ✅ Mapeos aplicados:")
        for _, row in mapeos.iterrows():
            if row["fraccion"] != "_":
                log(f"      {row['sector_actividad']:30} → {row['fraccion']}")
        
        # Advertir sin fracción
        sin_fraccion = df[df["fraccion"] == "_"]["sector_actividad"].unique()
        if len(sin_fraccion) > 0:
            log(f"   ⚠️  {len(sin_fraccion)} sectores sin fracción LFPIORPI:")
            for s in list(sin_fraccion)[:5]:
                log(f"      - {s}")
    else:
        log("   ⚠️  Sin columna sector_actividad - asignando fracción '_'")
        df["fraccion"] = "_"
    
    # Detectar SectorAltoRiesgo
    sectores_alto_riesgo = config.get("lfpiorpi", {}).get("actividad_alto_riesgo", [])
    df["SectorAltoRiesgo"] = df["fraccion"].isin(["XVI_activos_virtuales", "X_traslado_valores"]).astype(int)
    
    # Enriquecer features
    log("🔧 Enriqueciendo features...")
    df = enrich_features(df)
    
    log(f"✅ Enriquecimiento completo: {len(df.columns)} columnas")
    
    # Guardar archivo enriquecido
    if training_mode:
        # Modo entrenamiento: guardar con _clase_interna
        output_path = file_path.replace(".csv", "_enriched.csv")
        df.to_csv(output_path, index=False, encoding="utf-8")
        log(f"✅ Guardado (training): {output_path}")
    else:
        # Modo inferencia: guardar en outputs/enriched/pending/
        if analysis_id is None:
            import uuid
            analysis_id = str(uuid.uuid4())
        
        pending_dir = Path(__file__).parent.parent.parent / "outputs" / "enriched" / "pending"
        pending_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = pending_dir / f"{analysis_id}.csv"
        df.to_csv(output_path, index=False, encoding="utf-8")
        log(f"✅ Guardado (inferencia): {output_path}")
    
    log("==== FIN VALIDACIÓN/ENRIQUECIMIENTO ====\n")
    
    return str(output_path)


if __name__ == "__main__":
    # Test
    print("="*70)
    print("🧪 TEST: Validador V3 con Normalización")
    print("="*70)
    
    # Casos de prueba
    test_cases = [
        ("METALES PRECIOSOS", "XI_joyeria"),
        ("joyeria", "XI_joyeria"),
        ("Autos Usados", "VIII_vehiculos"),
        ("bienes raices", "V_inmuebles"),
        ("Bitcoin Exchange", "XVI_activos_virtuales"),
        ("Restaurante", "_"),
    ]
    
    print("\n📋 Pruebas de Normalización:")
    for sector, expected in test_cases:
        result = normalizar_sector(sector)
        status = "✅" if result == expected else "❌"
        print(f"   {status} '{sector:30}' → {result:20} (esperado: {expected})")
    
    print("\n" + "="*70)