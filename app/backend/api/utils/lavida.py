#!/usr/bin/env python3
# lavida.py
"""
Validador estructural de archivos CSV
para TarantulaHawk PLD.
Valida columnas, tipos de datos, formatos y limpia inconsistencias.
"""

import pandas as pd
import json

COLUMNAS_REQUERIDAS = [
    "id_operacion", "fecha", "monto", "tipo_operacion", "pais_origen",
    "cliente_riesgo", "canal", "producto", "frecuencia_operaciones"
]

def validar_estructura(ruta_archivo, salida_json="reporte_estructura.json"):
    resultado = {
        "archivo_valido": True,
        "errores": [],
        "total_registros": 0,
        "registros_validos": 0
    }

    try:
        # Leer archivo
        if ruta_archivo.endswith(".csv"):
            df = pd.read_csv(ruta_archivo)
        else:
            raise ValueError("Formato no soportado: solo CSV")

        resultado["total_registros"] = len(df)

        # Verificar columnas requeridas
        faltantes = [c for c in COLUMNAS_REQUERIDAS if c not in df.columns]
        if faltantes:
            resultado["archivo_valido"] = False
            resultado["errores"].append(f"Faltan columnas requeridas: {faltantes}")
            df = None

        if resultado["archivo_valido"]:
            # Limpieza general
            for col in df.columns:
                if df[col].dtype == "object":
                    df[col] = df[col].astype(str).str.strip()

            # Conversión de fechas
            if "fecha" in df.columns:
                df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")

            # Conversión de numéricos
            for campo in ["monto", "frecuencia_operaciones"]:
                if campo in df.columns:
                    df[campo] = pd.to_numeric(df[campo], errors="coerce")

            # Filtrar filas completamente vacías
            df.dropna(how="all", inplace=True)
            resultado["registros_validos"] = len(df)

        with open(salida_json, "w", encoding="utf-8") as f:
            json.dump(resultado, f, indent=4, ensure_ascii=False)

        return df, resultado

    except Exception as e:
        resultado["archivo_valido"] = False
        resultado["errores"].append(str(e))
        with open(salida_json, "w", encoding="utf-8") as f:
            json.dump(resultado, f, indent=4, ensure_ascii=False)
        return None, resultado
