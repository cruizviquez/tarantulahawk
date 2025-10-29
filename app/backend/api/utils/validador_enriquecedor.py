#!/usr/bin/env python3
"""
Validator + Enricher - LFPIORPI Compliant
Step 1: Validate and clean user uploads
Step 2: Enrich with ML-required features
"""

import pandas as pd
import numpy as np
from datetime import datetime
import json
import os

# ===================================================================
# MANDATORY FIELDS (user upload)
# ===================================================================
CAMPOS_OBLIGATORIOS = [
    "monto",
    "fecha",
    "tipo_operacion",
    "sector_actividad",
    "frecuencia_mensual",
    "cliente_id"
]

# High-risk sectors (LFPIORPI)
SECTORES_ALTO_RIESGO = {
    "casa_cambio", "joyeria_metales", "arte_antiguedades", "transmision_dinero"
}

# LFPIORPI thresholds
UMBRAL_RELEVANTE = 170_000
UMBRAL_EFECTIVO = 165_000
UMBRAL_ESTRUCTURACION_MIN = 150_000
UMBRAL_ESTRUCTURACION_MAX = 169_999


def validar_estructura(df: pd.DataFrame) -> tuple:
    """
    STEP 1: Validate file structure and data quality
    
    Returns:
        (df_valid, reporte)
    """
    
    reporte = {
        "archivo_valido": True,
        "errores": [],
        "advertencias": [],
        "registros_originales": len(df),
        "registros_validos": 0
    }
    
    print(f"\n{'='*70}")
    print("🔍 VALIDACIÓN DE ESTRUCTURA")
    print(f"{'='*70}")
    print(f"Registros recibidos: {len(df):,}\n")
    
    # Check mandatory columns
    faltantes = [c for c in CAMPOS_OBLIGATORIOS if c not in df.columns]
    if faltantes:
        reporte["archivo_valido"] = False
        reporte["errores"].append(f"Faltan columnas obligatorias: {faltantes}")
        print(f"❌ ERROR: Faltan columnas: {faltantes}\n")
        return None, reporte
    
    print("✅ Todas las columnas obligatorias presentes")
    
    # Clean column names (lowercase, strip spaces)
    df.columns = df.columns.str.lower().str.strip()
    
    # Validate and convert data types
    try:
        # 1. Monto (numeric, positive)
        df["monto"] = pd.to_numeric(df["monto"], errors='coerce')
        invalidos_monto = df["monto"].isna() | (df["monto"] <= 0)
        if invalidos_monto.sum() > 0:
            reporte["advertencias"].append(
                f"Eliminados {invalidos_monto.sum()} registros con monto inválido"
            )
            df = df[~invalidos_monto]
        
        # 2. Fecha (date format)
        df["fecha"] = pd.to_datetime(df["fecha"], errors='coerce')
        invalidos_fecha = df["fecha"].isna()
        if invalidos_fecha.sum() > 0:
            reporte["advertencias"].append(
                f"Eliminados {invalidos_fecha.sum()} registros con fecha inválida"
            )
            df = df[~invalidos_fecha]
        
        # 3. Tipo_operacion (string, not empty)
        df["tipo_operacion"] = df["tipo_operacion"].astype(str).str.strip().str.lower()
        invalidos_tipo = (df["tipo_operacion"] == "") | (df["tipo_operacion"] == "nan")
        if invalidos_tipo.sum() > 0:
            reporte["advertencias"].append(
                f"Eliminados {invalidos_tipo.sum()} registros sin tipo de operación"
            )
            df = df[~invalidos_tipo]
        
        # 4. Sector_actividad (string, not empty)
        df["sector_actividad"] = df["sector_actividad"].astype(str).str.strip().str.lower()
        invalidos_sector = (df["sector_actividad"] == "") | (df["sector_actividad"] == "nan")
        if invalidos_sector.sum() > 0:
            reporte["advertencias"].append(
                f"Eliminados {invalidos_sector.sum()} registros sin sector"
            )
            df = df[~invalidos_sector]
        
        # 5. Frecuencia_mensual (integer, positive)
        df["frecuencia_mensual"] = pd.to_numeric(df["frecuencia_mensual"], errors='coerce')
        df["frecuencia_mensual"] = df["frecuencia_mensual"].fillna(1).astype(int)
        df.loc[df["frecuencia_mensual"] < 1, "frecuencia_mensual"] = 1
        
        # 6. Cliente_id (integer, positive)
        df["cliente_id"] = pd.to_numeric(df["cliente_id"], errors='coerce')
        invalidos_cliente = df["cliente_id"].isna() | (df["cliente_id"] <= 0)
        if invalidos_cliente.sum() > 0:
            reporte["advertencias"].append(
                f"Eliminados {invalidos_cliente.sum()} registros sin cliente_id"
            )
            df = df[~invalidos_cliente]
        df["cliente_id"] = df["cliente_id"].astype(int)
        
    except Exception as e:
        reporte["archivo_valido"] = False
        reporte["errores"].append(f"Error en validación de tipos: {str(e)}")
        print(f"❌ ERROR: {str(e)}\n")
        return None, reporte
    
    # Remove duplicates
    duplicados = df.duplicated(subset=["monto", "fecha", "cliente_id"], keep='first')
    if duplicados.sum() > 0:
        reporte["advertencias"].append(f"Eliminados {duplicados.sum()} registros duplicados")
        df = df[~duplicados]
    
    # Remove completely empty rows
    df = df.dropna(how='all')
    
    reporte["registros_validos"] = len(df)
    
    # Summary
    print(f"\n📊 Resumen de validación:")
    print(f"   Registros válidos: {len(df):,}")
    if reporte["advertencias"]:
        print(f"   Advertencias: {len(reporte['advertencias'])}")
        for adv in reporte["advertencias"]:
            print(f"      - {adv}")
    
    if len(df) == 0:
        reporte["archivo_valido"] = False
        reporte["errores"].append("No quedan registros válidos después de validación")
        print(f"\n❌ ERROR: No hay registros válidos\n")
        return None, reporte
    
    print(f"\n✅ Validación completada exitosamente\n")
    
    return df, reporte


def enriquecer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    STEP 2: Add ML-required features (derived from core fields)
    
    This mimics what the validator does in production
    Creates TWO versions:
    - Full version (with fecha, cliente_id for tracking/XML)
    - ML version (only numeric/categorical features for training)
    """
    
    print(f"{'='*70}")
    print("🔧 ENRIQUECIMIENTO DE FEATURES")
    print(f"{'='*70}\n")
    
    df_enriched = df.copy()
    
    # Store original non-ML columns for later
    non_ml_columns = ["fecha", "cliente_id"]
    
    # Binary flags (critical for ML model)
    
    # 1. EsEfectivo (cash operations)
    df_enriched["EsEfectivo"] = df_enriched["tipo_operacion"].str.contains(
        "efectivo", case=False, na=False
    ).astype(int)
    
    # 2. EsInternacional (international transfers)
    df_enriched["EsInternacional"] = df_enriched["tipo_operacion"].str.contains(
        "internacional", case=False, na=False
    ).astype(int)
    
    # 3. SectorAltoRiesgo (high-risk business sectors)
    df_enriched["SectorAltoRiesgo"] = df_enriched["sector_actividad"].isin(
        SECTORES_ALTO_RIESGO
    ).astype(int)
    
    # 4. MontoAlto (amount >= 100k)
    df_enriched["MontoAlto"] = (df_enriched["monto"] >= 100_000).astype(int)
    
    # 5. MontoRelevante (LFPIORPI threshold)
    df_enriched["MontoRelevante"] = (df_enriched["monto"] >= UMBRAL_RELEVANTE).astype(int)
    
    # 6. MontoMuyAlto (amount >= 500k)
    df_enriched["MontoMuyAlto"] = (df_enriched["monto"] >= 500_000).astype(int)
    
    # 7. EsEstructurada (structuring pattern detection)
    df_enriched["EsEstructurada"] = (
        (df_enriched["monto"] >= UMBRAL_ESTRUCTURACION_MIN) & 
        (df_enriched["monto"] <= UMBRAL_ESTRUCTURACION_MAX)
    ).astype(int)
    
    # 8. FrecuenciaAlta (high transaction frequency)
    df_enriched["FrecuenciaAlta"] = (df_enriched["frecuencia_mensual"] > 20).astype(int)
    
    # 9. FrecuenciaBaja (low frequency - potential one-time large transaction)
    df_enriched["FrecuenciaBaja"] = (df_enriched["frecuencia_mensual"] <= 3).astype(int)
    
    # Summary
    print("✅ Features agregadas:")
    print(f"   - EsEfectivo: {df_enriched['EsEfectivo'].sum():,} operaciones en efectivo")
    print(f"   - EsInternacional: {df_enriched['EsInternacional'].sum():,} transferencias internacionales")
    print(f"   - SectorAltoRiesgo: {df_enriched['SectorAltoRiesgo'].sum():,} en sectores de alto riesgo")
    print(f"   - MontoAlto: {df_enriched['MontoAlto'].sum():,} montos >= 100k")
    print(f"   - MontoRelevante: {df_enriched['MontoRelevante'].sum():,} montos >= 170k (LFPIORPI)")
    print(f"   - EsEstructurada: {df_enriched['EsEstructurada'].sum():,} posibles estructuraciones")
    print(f"   - FrecuenciaAlta: {df_enriched['FrecuenciaAlta'].sum():,} alta frecuencia")
    
    print(f"\n📊 Dataset enriquecido:")
    print(f"   Columnas originales: {len(df.columns)}")
    print(f"   Columnas finales: {len(df_enriched.columns)}")
    print(f"   Features agregadas: {len(df_enriched.columns) - len(df.columns)}")
    print()
    
    return df_enriched


def preparar_para_ml(df_enriched: pd.DataFrame) -> pd.DataFrame:
    """
    STEP 3: Prepare ML-ready dataset (remove non-predictive columns)
    
    Removes:
    - fecha (tracking only, not predictive)
    - cliente_id (identifier only, not predictive)
    
    Keeps:
    - All numeric features
    - Categorical features (tipo_operacion, sector_actividad)
    - Label (clasificacion_lfpiorpi)
    """
    
    print(f"{'='*70}")
    print("🤖 PREPARACIÓN PARA ML")
    print(f"{'='*70}\n")
    
    df_ml = df_enriched.copy()
    
    # Remove non-predictive columns
    columns_to_remove = ["fecha", "cliente_id"]
    
    print("🗑️  Removiendo columnas no predictivas:")
    for col in columns_to_remove:
        if col in df_ml.columns:
            df_ml = df_ml.drop(columns=[col])
            print(f"   - {col}")
    
    print(f"\n📊 Dataset ML-ready:")
    print(f"   Registros: {len(df_ml):,}")
    print(f"   Features: {len(df_ml.columns)}")
    print(f"   Tipos: {df_ml.dtypes.value_counts().to_dict()}")
    print()
    
    return df_ml


def procesar_archivo(ruta_archivo: str, guardar_enriquecido: bool = True):
    """
    Complete processing pipeline:
    1. Load file
    2. Validate structure
    3. Enrich features
    4. Save enriched dataset
    
    Args:
        ruta_archivo: Path to CSV file
        guardar_enriquecido: Save enriched dataset
    
    Returns:
        (df_enriched, reporte)
    """
    
    print(f"\n{'='*70}")
    print("🚀 PROCESADOR DE ARCHIVOS PLD")
    print(f"{'='*70}")
    print(f"Archivo: {ruta_archivo}\n")
    
    # Load file
    try:
        if ruta_archivo.endswith(".csv"):
            df = pd.read_csv(ruta_archivo)
        elif ruta_archivo.endswith((".xlsx", ".xls")):
            df = pd.read_excel(ruta_archivo)
        else:
            return None, {
                "archivo_valido": False,
                "errores": ["Formato no soportado. Use CSV o Excel (.xlsx)"],
                "registros_originales": 0,
                "registros_validos": 0
            }
    except Exception as e:
        return None, {
            "archivo_valido": False,
            "errores": [f"Error al leer archivo: {str(e)}"],
            "registros_originales": 0,
            "registros_validos": 0
        }
    
    # STEP 1: Validate
    df_valid, reporte = validar_estructura(df)
    
    if not reporte["archivo_valido"] or df_valid is None:
        return None, reporte
    
    # STEP 2: Enrich
    df_enriched = enriquecer_features(df_valid)
    
    # STEP 3: Prepare ML-ready version
    df_ml = preparar_para_ml(df_enriched)
    
    # Save BOTH versions
    if guardar_enriquecido:
        # Full version (with fecha, cliente_id for XML/tracking)
        output_full = ruta_archivo.replace(".csv", "_enriquecido.csv")
        df_enriched.to_csv(output_full, index=False, encoding="utf-8")
        
        # ML version (ready for training)
        output_ml = ruta_archivo.replace(".csv", "_ml_ready.csv")
        df_ml.to_csv(output_ml, index=False, encoding="utf-8")
        
        print(f"{'='*70}")
        print(f"💾 ARCHIVOS GUARDADOS")
        print(f"{'='*70}")
        print(f"📄 Completo (con fecha/cliente_id):")
        print(f"   {output_full}")
        print(f"   Registros: {len(df_enriched):,} | Columnas: {len(df_enriched.columns)}")
        print(f"\n🤖 ML-Ready (sin fecha/cliente_id):")
        print(f"   {output_ml}")
        print(f"   Registros: {len(df_ml):,} | Columnas: {len(df_ml.columns)}")
        print(f"{'='*70}\n")
    
    # Save validation report
    report_path = ruta_archivo.replace(".csv", "_reporte_validacion.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(reporte, f, indent=4, ensure_ascii=False)
    
    print(f"📋 Reporte: {report_path}\n")
    
    return df_ml, reporte  # Return ML-ready version


# ===================================================================
# USAGE EXAMPLES
# ===================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("\n❌ ERROR: Falta argumento")
        print("Uso: python validador_enriquecedor.py <archivo.csv>")
        print("\nEjemplo:")
        print("  python validador_enriquecedor.py backend/datasets/dataset_pld_lfpiorpi_1k.csv\n")
        sys.exit(1)
    
    archivo = sys.argv[1]
    
    if not os.path.exists(archivo):
        print(f"\n❌ ERROR: Archivo no encontrado: {archivo}\n")
        sys.exit(1)
    
    # Process file
    df_ml, reporte = procesar_archivo(archivo)
    
    if df_ml is not None:
        print(f"{'='*70}")
        print("✅ PROCESO COMPLETADO")
        print(f"{'='*70}")
        print(f"Registros: {len(df_ml):,}")
        print(f"Listo para entrenar modelos ML")
        print(f"\n💡 Usa el archivo *_ml_ready.csv para entrenar modelos")
        print(f"💡 Usa el archivo *_enriquecido.csv para generar XML\n")
    else:
        print(f"{'='*70}")
        print("❌ PROCESO FALLÓ")
        print(f"{'='*70}")
        print("Revisa los errores en el reporte de validación\n")
        sys.exit(1)
