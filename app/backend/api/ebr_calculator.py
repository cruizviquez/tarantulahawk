#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ebr_calculator.py - Enfoque Basado en Riesgos (EBR) con ponderaciones

Este módulo implementa el cálculo del score EBR según metodología de
prevención de lavado de dinero con ponderaciones configurables.

Variables de alto peso para PLD:
- Pagos en efectivo (25 pts)
- Sector vulnerable / alto riesgo (20 pts)
- Monto acumulado 6 meses (15 pts)
- Operaciones internacionales (10 pts)
- Horario inusual (5 pts)
- Ratio vs promedio (10 pts)
- Frecuencia de operaciones (10 pts)
- Monto redondo (5 pts)

Score total: 0-100
Clasificación:
- 0-50: Bajo (relevante)
- 51-65: Medio (inusual)
- 66-100: Alto (preocupante)
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
import numpy as np
import pandas as pd


@dataclass
class FactorEBR:
    """Representa un factor de riesgo EBR"""
    nombre: str
    descripcion: str
    puntos: float
    activo: bool = True


# ============================================================================
# CONFIGURACIÓN DE PONDERACIONES POR DEFECTO
# ============================================================================
PONDERACIONES_DEFAULT = {
    # Factores de ALTO peso para PLD
    "efectivo": {
        "nombre": "Pago en Efectivo",
        "descripcion": "Operación realizada en efectivo (alto riesgo PLD)",
        "puntos": 25,
        "condicion": "EsEfectivo == 1"
    },
    "sector_alto_riesgo": {
        "nombre": "Sector de Alto Riesgo",
        "descripcion": "Actividad en sector vulnerable LFPIORPI",
        "puntos": 20,
        "condicion": "SectorAltoRiesgo == 1"
    },
    "acumulado_alto": {
        "nombre": "Acumulado 6M Elevado",
        "descripcion": "Monto acumulado en 6 meses supera $500,000 MXN",
        "puntos": 15,
        "umbral_mxn": 500_000,
        "condicion": "monto_6m >= 500000"
    },
    
    # Factores de MEDIO peso
    "internacional": {
        "nombre": "Operación Internacional",
        "descripcion": "Transferencia internacional (mayor escrutinio)",
        "puntos": 10,
        "condicion": "EsInternacional == 1"
    },
    "ratio_alto": {
        "nombre": "Monto Atípico",
        "descripcion": "Monto 3x superior al promedio del cliente",
        "puntos": 10,
        "umbral_ratio": 3.0,
        "condicion": "ratio_vs_promedio > 3.0"
    },
    "frecuencia_alta": {
        "nombre": "Alta Frecuencia",
        "descripcion": "Más de 5 operaciones en 6 meses",
        "puntos": 10,
        "umbral_ops": 5,
        "condicion": "ops_6m > 5"
    },
    
    # Factores de BAJO peso (patrones)
    "nocturno": {
        "nombre": "Horario Nocturno",
        "descripcion": "Operación entre 10PM y 6AM",
        "puntos": 5,
        "condicion": "es_nocturno == 1"
    },
    "fin_semana": {
        "nombre": "Fin de Semana",
        "descripcion": "Operación en sábado o domingo",
        "puntos": 5,
        "condicion": "fin_de_semana == 1"
    },
    "monto_redondo": {
        "nombre": "Monto Redondo",
        "descripcion": "Monto exactamente divisible por $10,000",
        "puntos": 5,
        "condicion": "es_monto_redondo == 1"
    },
    "burst": {
        "nombre": "Operaciones en Ráfaga",
        "descripcion": "Múltiples operaciones en menos de 1 hora",
        "puntos": 5,
        "condicion": "posible_burst == 1"
    },
}

# Umbrales de clasificación EBR
UMBRALES_EBR = {
    "bajo_max": 50,      # 0-50 = bajo = relevante
    "medio_max": 65,     # 51-65 = medio = inusual
    # >65 = alto = preocupante
}


def cargar_ponderaciones(cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Carga ponderaciones desde config o usa defaults.
    
    Args:
        cfg: Configuración completa (puede contener 'ebr.ponderaciones')
    
    Returns:
        Diccionario de ponderaciones
    """
    if cfg is None:
        return PONDERACIONES_DEFAULT.copy()
    
    # Buscar en config
    ebr_cfg = cfg.get("ebr", {})
    ponderaciones = ebr_cfg.get("ponderaciones", {})
    
    if not ponderaciones:
        return PONDERACIONES_DEFAULT.copy()
    
    # Merge con defaults (config sobrescribe)
    result = PONDERACIONES_DEFAULT.copy()
    result.update(ponderaciones)
    return result


def cargar_umbrales_ebr(cfg: Optional[Dict[str, Any]] = None) -> Dict[str, int]:
    """Carga umbrales de clasificación EBR"""
    if cfg is None:
        return UMBRALES_EBR.copy()
    
    ebr_cfg = cfg.get("ebr", {})
    umbrales = ebr_cfg.get("umbrales_clasificacion", {})
    
    if not umbrales:
        return UMBRALES_EBR.copy()
    
    return {
        "bajo_max": umbrales.get("bajo_max", 50),
        "medio_max": umbrales.get("medio_max", 65),
    }


# ============================================================================
# CÁLCULO DE SCORE EBR
# ============================================================================
def calcular_score_ebr(
    row: Dict[str, Any],
    cfg: Optional[Dict[str, Any]] = None
) -> Tuple[float, List[str], str, str]:
    """
    Calcula el score EBR para una transacción.
    
    Args:
        row: Diccionario con datos de la transacción
        cfg: Configuración (opcional)
    
    Returns:
        (score, factores_activos, nivel_riesgo, clasificacion_ebr)
        - score: 0-100
        - factores_activos: lista de descripciones de factores que sumaron
        - nivel_riesgo: "bajo" | "medio" | "alto"
        - clasificacion_ebr: "relevante" | "inusual" | "preocupante"
    """
    ponderaciones = cargar_ponderaciones(cfg)
    umbrales = cargar_umbrales_ebr(cfg)
    
    score = 0.0
    factores_activos: List[str] = []
    
    # Evaluar cada factor
    for key, factor in ponderaciones.items():
        puntos = float(factor.get("puntos", 0))
        if puntos <= 0:
            continue
        
        activo = _evaluar_condicion(row, factor, cfg)
        
        if activo:
            score += puntos
            # Crear descripción útil del factor
            descripcion = factor.get("descripcion", factor.get("nombre", key))
            factores_activos.append(f"{descripcion} (+{puntos:.0f} pts)")
    
    # Limitar score a 100
    score = min(100.0, max(0.0, score))
    
    # Determinar nivel y clasificación
    if score <= umbrales["bajo_max"]:
        nivel_riesgo = "bajo"
        clasificacion = "relevante"
    elif score <= umbrales["medio_max"]:
        nivel_riesgo = "medio"
        clasificacion = "inusual"
    else:
        nivel_riesgo = "alto"
        clasificacion = "preocupante"
    
    return score, factores_activos, nivel_riesgo, clasificacion


def _evaluar_condicion(
    row: Dict[str, Any],
    factor: Dict[str, Any],
    cfg: Optional[Dict[str, Any]] = None
) -> bool:
    """Evalúa si un factor de riesgo está activo para una transacción"""
    
    # Helper para obtener valor numérico de row
    def get_num(key: str, default: float = 0.0) -> float:
        val = row.get(key, default)
        if pd.isna(val):
            return default
        try:
            return float(val)
        except (TypeError, ValueError):
            return default
    
    def get_int(key: str, default: int = 0) -> int:
        return int(get_num(key, float(default)))
    
    # Evaluar según el tipo de factor
    condicion = factor.get("condicion", "")
    
    # Factores simples (flags binarias)
    if "EsEfectivo == 1" in condicion:
        return get_int("EsEfectivo") == 1
    
    if "EsInternacional == 1" in condicion:
        return get_int("EsInternacional") == 1
    
    if "SectorAltoRiesgo == 1" in condicion:
        return get_int("SectorAltoRiesgo") == 1
    
    if "es_nocturno == 1" in condicion:
        return get_int("es_nocturno") == 1
    
    if "fin_de_semana == 1" in condicion:
        return get_int("fin_de_semana") == 1
    
    if "es_monto_redondo == 1" in condicion:
        return get_int("es_monto_redondo") == 1
    
    if "posible_burst == 1" in condicion:
        return get_int("posible_burst") == 1
    
    # Factores con umbrales
    if "monto_6m >=" in condicion:
        umbral = factor.get("umbral_mxn", 500_000)
        return get_num("monto_6m") >= umbral
    
    if "ratio_vs_promedio >" in condicion:
        umbral = factor.get("umbral_ratio", 3.0)
        return get_num("ratio_vs_promedio") > umbral
    
    if "ops_6m >" in condicion:
        umbral = factor.get("umbral_ops", 5)
        return get_num("ops_6m") > umbral
    
    # Default: no activo
    return False


# ============================================================================
# FUNCIONES DE ALTO NIVEL
# ============================================================================
def calcular_ebr_dataframe(
    df: pd.DataFrame,
    cfg: Optional[Dict[str, Any]] = None
) -> pd.DataFrame:
    """
    Calcula EBR para todo un DataFrame.
    
    Agrega columnas:
    - score_ebr: float (0-100)
    - nivel_riesgo_ebr: str ("bajo"|"medio"|"alto")
    - clasificacion_ebr: str ("relevante"|"inusual"|"preocupante")
    - factores_ebr: list[str] (factores que sumaron)
    """
    df = df.copy()
    
    scores = []
    niveles = []
    clasificaciones = []
    factores_list = []
    
    for _, row in df.iterrows():
        row_dict = row.to_dict() if hasattr(row, 'to_dict') else dict(row)
        score, factores, nivel, clasif = calcular_score_ebr(row_dict, cfg)
        
        scores.append(score)
        niveles.append(nivel)
        clasificaciones.append(clasif)
        factores_list.append(factores)
    
    df["score_ebr"] = scores
    df["nivel_riesgo_ebr"] = niveles
    df["clasificacion_ebr"] = clasificaciones
    df["factores_ebr"] = factores_list
    
    return df


def bucket_ebr(score_ebr: Optional[float]) -> Tuple[Optional[str], Optional[str]]:
    """
    Convierte score EBR a nivel de riesgo y clasificación.
    
    Returns:
        (nivel_riesgo, clasificacion) o (None, None) si score es None
    """
    if score_ebr is None or pd.isna(score_ebr):
        return None, None
    
    try:
        s = float(score_ebr)
    except (TypeError, ValueError):
        return None, None
    
    if s <= 50:
        return "bajo", "relevante"
    elif s <= 65:
        return "medio", "inusual"
    else:
        return "alto", "preocupante"


# ============================================================================
# FUSIÓN ML + EBR
# ============================================================================
def fusionar_ml_ebr(
    etiqueta_ml: str,
    score_ebr: float,
    aplicar_elevacion: bool = True
) -> Tuple[str, bool, Optional[str]]:
    """
    Fusiona clasificación ML con EBR según reglas de negocio.
    
    Reglas:
    1. Si ML == EBR: no hacer nada
    2. Si ML = "relevante" y EBR = "alto": elevar a "inusual"
    3. Nunca bajar clasificación (ML manda hacia arriba)
    
    Args:
        etiqueta_ml: Clasificación del modelo ML
        score_ebr: Score EBR (0-100)
        aplicar_elevacion: Si aplicar elevación automática
    
    Returns:
        (clasificacion_final, fue_modificada, motivo)
    """
    nivel_ebr, clasif_ebr = bucket_ebr(score_ebr)
    
    if clasif_ebr is None:
        return etiqueta_ml, False, None
    
    orden = {"relevante": 0, "inusual": 1, "preocupante": 2}
    ml_nivel = orden.get(etiqueta_ml.lower(), 0)
    ebr_nivel = orden.get(clasif_ebr, 0)
    
    # Caso 1: Coinciden
    if ml_nivel == ebr_nivel:
        return etiqueta_ml, False, None
    
    # Caso 2: EBR ve más riesgo que ML
    if ebr_nivel > ml_nivel and aplicar_elevacion:
        # Solo elevamos de relevante a inusual si EBR es alto
        if etiqueta_ml.lower() == "relevante" and clasif_ebr == "preocupante":
            return "inusual", True, f"Elevado de relevante a inusual por EBR alto ({score_ebr:.1f})"
        elif etiqueta_ml.lower() == "relevante" and clasif_ebr == "inusual":
            return "inusual", True, f"Elevado de relevante a inusual por EBR medio ({score_ebr:.1f})"
    
    # Caso 3: ML ve más riesgo que EBR - respetar ML (nunca bajar)
    return etiqueta_ml, False, None


# ============================================================================
# CLI para pruebas
# ============================================================================
if __name__ == "__main__":
    # Ejemplo de uso
    ejemplo = {
        "monto": 150_000,
        "EsEfectivo": 1,
        "EsInternacional": 0,
        "SectorAltoRiesgo": 1,
        "monto_6m": 600_000,
        "ops_6m": 8,
        "ratio_vs_promedio": 2.5,
        "es_nocturno": 0,
        "fin_de_semana": 1,
        "es_monto_redondo": 0,
        "posible_burst": 0,
    }
    
    score, factores, nivel, clasif = calcular_score_ebr(ejemplo)
    
    print(f"\n{'='*60}")
    print("📊 CÁLCULO EBR - EJEMPLO")
    print(f"{'='*60}")
    print(f"Score EBR: {score:.1f}/100")
    print(f"Nivel de riesgo: {nivel.upper()}")
    print(f"Clasificación: {clasif.upper()}")
    print(f"\nFactores activos:")
    for f in factores:
        print(f"  • {f}")
    print(f"{'='*60}\n")
