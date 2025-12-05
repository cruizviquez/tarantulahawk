#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
explicabilidad_transactions.py - VERSIÓN 5.0

Objetivo: explicaciones muy simples y directas de "por qué fue etiquetado así".

- PREOCUPANTE:
    "Rebasa el umbral UMA: el máximo sin aviso es XX UMAs (~YY MXN) y el monto
     de la operación es ZZ MXN (≈CC UMAs)."

- RELEVANTE:
    "Sin anomalía detectada."

- INUSUAL:
    "monto redondo; efectivo muy cercano al máximo permitido; acumulado alto
     en los últimos 6 meses; frecuencia alta en los últimos 6 meses;
     patrón inusual detectado por el modelo no supervisado (score 0.82)."

Además se incluye un desglose del índice EBR en:
    detalles["detalle_ebr"] = {
        "score_total": <int>,
        "factores": [
            {"factor": "efectivo", "descripcion": "...", "puntos": 25},
            ...
        ]
    }
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

_CONFIG_CACHE: Dict[str, Any] = {}


def cargar_config() -> Dict[str, Any]:
    """Carga configuración (config_modelos.json / v4) una sola vez."""
    global _CONFIG_CACHE
    if _CONFIG_CACHE:
        return _CONFIG_CACHE

    here = Path(__file__).resolve().parent
    candidates = [
        here.parent / "models" / "config_modelos.json",
        here / "config_modelos.json",
        here / "config_modelos_v4.json",  # por compatibilidad
    ]

    for p in candidates:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                _CONFIG_CACHE = json.load(f)
                return _CONFIG_CACHE

    # Fallback mínimo
    _CONFIG_CACHE = {"lfpiorpi": {"uma_mxn": 113.14}, "ebr": {"ponderaciones": {}}}
    return _CONFIG_CACHE


def get_uma_mxn() -> float:
    cfg = cargar_config()
    return float(cfg.get("lfpiorpi", {}).get("uma_mxn", 113.14))


def get_umbrales_fraccion(fraccion: str) -> Tuple[float, float]:
    """
    Regresa (aviso_UMA, efectivo_max_UMA) para la fracción dada.
    Si no existe, regresa valores de '_general' o 0.
    """
    cfg = cargar_config()
    umbrales = cfg.get("lfpiorpi", {}).get("umbrales", {})
    data = umbrales.get(fraccion) or umbrales.get("_general", {})
    aviso_uma = float(data.get("aviso_UMA", 0) or 0)
    efectivo_max_uma = float(data.get("efectivo_max_UMA", 0) or 0)
    return aviso_uma, efectivo_max_uma


# ============================================================================
# MAPEO FRACCIÓN → DESCRIPCIÓN LEGAL
# (reutilizado de la versión anterior)
# ============================================================================

FRACCIONES_DESCRIPCION = {
    "I_juegos": ("I", "realización habitual de juegos con apuesta, concursos o sorteos"),
    "II_tarjetas_servicios": ("II", "emisión y comercialización de tarjetas de servicios y de crédito"),
    "II_tarjetas_prepago": ("II", "emisión y comercialización de tarjetas prepagadas"),
    "III_cheques_viajero": ("III", "operaciones de cambio de divisas"),
    "IV_mutuo": ("IV", "operaciones de mutuo, préstamos y crédito"),
    "V_inmuebles": ("V", "transmisión o constitución de derechos reales sobre inmuebles"),
    "V_bis_desarrollo_inmobiliario": ("V bis", "recepción de recursos para desarrollo inmobiliario"),
    "VI_joyeria_metales": ("VI", "comercialización de metales preciosos, piedras preciosas y joyería"),
    "VII_obras_arte": ("VII", "comercialización de obras de arte"),
    "VIII_vehiculos": ("VIII", "comercialización de vehículos nuevos o usados"),
    "IX_blindaje": ("IX", "blindaje de vehículos"),
    "X_traslado_valores": ("X", "traslado y custodia de valores"),
    "XI_servicios_profesionales": ("XI", "prestación de servicios profesionales independientes"),
    "XII_A_notarios_derechos_inmuebles": ("XII-A", "fe pública en operaciones inmobiliarias"),
    "XII_B_corredores": ("XII-B", "fe pública en constitución de personas morales"),
    "XV_arrendamiento_inmuebles": ("XV", "arrendamiento de inmuebles"),
    "XVI_activos_virtuales": ("XVI", "operaciones con activos virtuales"),
}


def obtener_descripcion_fraccion(fraccion: str) -> Tuple[str, str]:
    """Retorna (número_fracción, descripción) para fundamento legal."""
    if fraccion in FRACCIONES_DESCRIPCION:
        return FRACCIONES_DESCRIPCION[fraccion]

    if "_" in fraccion:
        num = fraccion.split("_")[0]
        return (num, fraccion.replace("_", " "))

    return ("", fraccion)


# ============================================================================
# DESGLOSE EBR (efectivo 20, efectivo_alto 15, fin_semana 5, etc.)
# ============================================================================

# Mapeo entre clave de ponderación EBR y nombre de columna en la transacción
MAP_EBR_FLAG_COL = {
    "efectivo": "EsEfectivo",
    "efectivo_alto": "efectivo_alto",
    "sector_alto_riesgo": "SectorAltoRiesgo",
    "acumulado_alto": "acumulado_alto",
    "internacional": "EsInternacional",
    "ratio_alto": "ratio_alto",
    "frecuencia_alta": "frecuencia_alta",
    "burst": "posible_burst",
    "nocturno": "es_nocturno",
    "fin_semana": "fin_de_semana",
    "monto_redondo": "es_monto_redondo",
}


def desglose_ebr(transaccion: Dict[str, Any], score_ebr: float) -> Dict[str, Any]:
    """
    Construye un desglose de EBR del tipo:
    {
        "score_total": 50,
        "factores": [
            {"factor": "efectivo", "descripcion": "...", "puntos": 25},
            ...
        ]
    }
    Solo se incluyen factores cuyo flag está activo en la transacción.
    """
    cfg = cargar_config()
    ponder = cfg.get("ebr", {}).get("ponderaciones", {})

    factores: List[Dict[str, Any]] = []

    for key, meta in ponder.items():
        col_flag = MAP_EBR_FLAG_COL.get(key)
        if not col_flag:
            continue

        valor = transaccion.get(col_flag)
        activo = valor in (1, True, "1", "true", "True")

        if activo:
            factores.append(
                {
                    "factor": key,
                    "descripcion": meta.get("descripcion", ""),
                    "puntos": int(meta.get("puntos", 0)),
                }
            )

    return {
        "score_total": round(float(score_ebr or 0), 1),
        "factores": factores,
    }


# ============================================================================
# GENERADOR DE EXPLICACIONES
# ============================================================================

def generar_explicacion(
    transaccion: Dict[str, Any],
    clasificacion: str,
    origen: str,
    guardrail_razon: Optional[str] = None,
    guardrail_fundamento: Optional[str] = None,
    factores_ebr: Optional[List[str]] = None,
    score_ebr: float = 0,
    ica: float = 0,
) -> Dict[str, Any]:
    """
    Genera explicación simplificada según clasificación y origen.
    
    Args:
        transaccion: Dict con datos de la transacción
        clasificacion: "preocupante", "inusual", "relevante"
        origen: "regla_lfpiorpi", "ml", "elevacion_ebr", etc.
        guardrail_razon: Razón del guardrail (si aplica)
        guardrail_fundamento: Fundamento legal (si aplica)
        factores_ebr: Lista de factores EBR detectados (opcional)
        score_ebr: Score EBR (0-100)
        ica: Índice de confianza del modelo (0-1)
    """
    clasificacion = (clasificacion or "").lower()

    # ------------------------------------------------------------------
    # CASO 1: PREOCUPANTE (regla LFPIORPI)
    # ------------------------------------------------------------------
    if clasificacion == "preocupante":
        fraccion = transaccion.get("fraccion", "")
        monto = float(transaccion.get("monto", 0) or 0.0)
        uma = get_uma_mxn()
        aviso_uma, efectivo_uma = get_umbrales_fraccion(fraccion)

        # Decidir cuál umbral mencionar (aviso o efectivo)
        es_efectivo = transaccion.get("EsEfectivo") in (1, True, "1")
        umbral_uma = efectivo_uma if es_efectivo and efectivo_uma > 0 else aviso_uma
        umbral_mxn = umbral_uma * uma if umbral_uma > 0 else 0
        monto_umas = monto / uma if uma > 0 else 0

        num_fracc, desc_fracc = obtener_descripcion_fraccion(fraccion)

        razon_texto = (
            guardrail_razon
            or "La operación rebasa el umbral legal establecido en UMAs."
        )

        detalle_umbral = (
            f"Rebasa el umbral UMA: el máximo sin aviso es {umbral_uma:,.0f} UMAs "
            f"(~{umbral_mxn:,.0f} MXN) y el monto de la operación es {monto:,.0f} MXN, "
            f"equivalente a {monto_umas:,.0f} UMAs."
        )

        fundamento = guardrail_fundamento or (
            f"Artículo 17, Fracción {num_fracc} de la LFPIORPI: {desc_fracc}."
        )

        return {
            "tipo": "obligacion_legal",
            "clasificacion": "preocupante",
            "motivo": razon_texto,
            "detalle": detalle_umbral,
            "fundamento_legal": fundamento,
            "accion": (
                "Aviso obligatorio a la UIF dentro del plazo legal y conservación "
                "de la documentación de respaldo."
            ),
            "requiere_revision": False,
            "detalles": {
                "fraccion": fraccion,
                "monto_mxn": round(monto, 2),
                "monto_umas": round(monto_umas, 2),
                "umbral_uma": round(umbral_uma, 2),
                "umbral_mxn": round(umbral_mxn, 2),
                "detalle_ebr": desglose_ebr(transaccion, score_ebr),
            },
        }

    # ------------------------------------------------------------------
    # CASO 2: RELEVANTE (sin anomalía)
    # ------------------------------------------------------------------
    elif clasificacion == "relevante":
        texto = "Sin anomalía detectada. No se observaron indicadores de riesgo relevantes."
        return {
            "tipo": "sin_riesgo",
            "clasificacion": "relevante",
            "motivo": texto,
            "accion": "Solo registro y conservación para trazabilidad.",
            "requiere_revision": False,
            "detalles": {
                "score_ebr": round(float(score_ebr or 0), 1),
                "ica": round(float(ica or 0), 2),
                "detalle_ebr": desglose_ebr(transaccion, score_ebr),
            },
        }

    # ------------------------------------------------------------------
    # CASO 3: INUSUAL (requiere análisis)
    # ------------------------------------------------------------------
    else:  # inusual
        motivo, lista_motivos = _motivos_inusual(transaccion, origen, score_ebr)
        return {
            "tipo": "requiere_analisis",
            "clasificacion": "inusual",
            "motivo": motivo,
            "motivos_detallados": lista_motivos,
            "accion": (
                "Revisión por Oficial de Cumplimiento. Documentar el análisis y, "
                "en su caso, determinar si procede reporte de operación inusual."
            ),
            "requiere_revision": True,
            "detalles": {
                "score_ebr": round(float(score_ebr or 0), 1),
                "ica": round(float(ica or 0), 2),
                "detalle_ebr": desglose_ebr(transaccion, score_ebr),
                "origen_clasificacion": origen,
            },
        }


# ============================================================================
# MOTIVOS PARA INUSUAL
# ============================================================================

def _motivos_inusual(
    tx: Dict[str, Any],
    origen: str,
    score_ebr: float,
) -> Tuple[str, List[str]]:
    """
    Construye una lista de motivos en lenguaje muy simple para INUSUAL.
    Ejemplo:
      [
        "monto redondo",
        "efectivo muy cercano al máximo permitido",
        "acumulado alto en los últimos 6 meses",
        "frecuencia alta en los últimos 6 meses",
        "patrón inusual detectado por el modelo no supervisado (score 0.82)"
      ]
    """
    motivos: List[str] = []

    # 1. Contexto por EBR (si la elevación fue por score)
    if origen == "elevacion_ebr" and score_ebr > 0:
        motivos.append(f"índice de riesgo EBR elevado ({score_ebr:.0f}/100)")

    # 2. Flags específicos
    if tx.get("es_monto_redondo") in (1, True, "1"):
        motivos.append("monto redondo")

    if tx.get("efectivo_alto") in (1, True, "1"):
        motivos.append("efectivo muy cercano al máximo permitido por ley")

    if tx.get("acumulado_alto") in (1, True, "1"):
        motivos.append("acumulado alto en los últimos 6 meses")

    ops_6m = int(tx.get("ops_6m", 0) or 0)
    if tx.get("frecuencia_alta") in (1, True, "1") or ops_6m > 5:
        motivos.append(f"frecuencia alta en los últimos 6 meses ({ops_6m} operaciones)")

    ratio = float(tx.get("ratio_vs_promedio", 0) or 0)
    if ratio > 3:
        motivos.append(f"monto {ratio:.1f} veces mayor al promedio del cliente")

    es_nocturno = tx.get("es_nocturno") in (1, True, "1")
    fin_semana = tx.get("fin_de_semana") in (1, True, "1")
    if es_nocturno and fin_semana:
        motivos.append("operación en horario nocturno y fin de semana")
    elif es_nocturno:
        motivos.append("operación en horario nocturno")
    elif fin_semana:
        motivos.append("operación en fin de semana")

    if tx.get("posible_burst") in (1, True, "1"):
        motivos.append("posible fraccionamiento de operaciones")

    if tx.get("is_outlier_iso") in (1, True, "1"):
        score_anom = float(tx.get("anomaly_score_composite", 0) or 0)
        motivos.append(
            f"patrón inusual detectado por el modelo no supervisado (anomalía {score_anom:.2f})"
        )

    # Si no encontramos nada específico, usar un texto genérico
    if not motivos:
        motivos.append("patrón de comportamiento atípico detectado por análisis ML")

    # La razón principal será la primera de la lista
    razon_principal = "; ".join(motivos)
    return razon_principal, motivos


# ============================================================================
# FUNCIONES DE COMPATIBILIDAD (con ml_runner)
# ============================================================================

def build_explicacion(
    row: Dict[str, Any],
    fusion: Optional[Dict[str, Any]] = None,
    cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Wrapper de compatibilidad con ml_runner anterior.

    row: Fila del DataFrame como dict (debe contener:
         clasificacion_final, origen, score_ebr, ica, etc.)
    """
    clasificacion = row.get("clasificacion_final", row.get("clasificacion", "relevante"))
    origen = row.get("origen", fusion.get("origen") if fusion else "ml")

    return generar_explicacion(
        transaccion=row,
        clasificacion=clasificacion,
        origen=origen,
        guardrail_razon=row.get("guardrail_razon"),
        guardrail_fundamento=row.get("guardrail_fundamento"),
        factores_ebr=row.get("factores_ebr", []),
        score_ebr=float(row.get("score_ebr", 0) or 0),
        ica=float(row.get("ica", 0) or 0),
    )


def generar_explicacion_transaccion(
    row: Dict[str, Any],
    cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Alias de compatibilidad."""
    return build_explicacion(row, cfg=cfg)


# ============================================================================
# TEST RÁPIDO
# ============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🧪 TEST RÁPIDO EXPLICABILIDAD v5")
    print("=" * 70)

    # PREOCUPANTE
    tx_preocupante = {
        "monto": 2_000_000,
        "fraccion": "V_inmuebles",
        "clasificacion_final": "preocupante",
        "origen": "regla_lfpiorpi",
        "guardrail_razon": "Monto rebasa el umbral de aviso",
        "EsEfectivo": 0,
    }
    exp_p = build_explicacion(tx_preocupante)
    print("\n🔴 PREOCUPANTE:")
    print("  Motivo:", exp_p["motivo"])
    print("  Detalle:", exp_p["detalle"])

    # RELEVANTE
    tx_rel = {
        "monto": 15_000,
        "fraccion": "servicios_generales",
        "clasificacion_final": "relevante",
        "origen": "ml",
        "score_ebr": 10,
        "ica": 0.95,
    }
    exp_r = build_explicacion(tx_rel)
    print("\n🟢 RELEVANTE:")
    print("  Motivo:", exp_r["motivo"])
    print("  Detalle EBR:", exp_r["detalles"]["detalle_ebr"])

    # INUSUAL
    tx_inu = {
        "monto": 800_000,
        "fraccion": "V_inmuebles",
        "clasificacion_final": "inusual",
        "origen": "elevacion_ebr",
        "efectivo_alto": 1,
        "acumulado_alto": 1,
        "frecuencia_alta": 1,
        "ops_6m": 12,
        "es_monto_redondo": 1,
        "es_nocturno": 1,
        "fin_de_semana": 0,
        "posible_burst": 1,
        "is_outlier_iso": 1,
        "anomaly_score_composite": 0.82,
        "score_ebr": 55,
        "ica": 0.8,
    }
    exp_i = build_explicacion(tx_inu)
    print("\n🟡 INUSUAL:")
    print("  Motivo:", exp_i["motivo"])
    print("  Motivos detallados:", exp_i["motivos_detallados"])
    print("  Detalle EBR:", exp_i["detalles"]["detalle_ebr"])

    print("\n" + "=" * 70)
    print("✅ Test de explicabilidad v5 completado")
    print("=" * 70 + "\n")
