#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
explicabilidad_transactions.py - VERSIÓN 4.0 (SIMPLIFICADA)

Genera explicaciones según el origen de la clasificación:

1. PREOCUPANTE (regla_lfpiorpi): Fundamento legal completo
   - Artículo y fracción LFPIORPI
   - Umbral rebasado
   - Acción obligatoria (aviso UIF)

2. RELEVANTE: Constante simple
   - "No se detectaron indicadores de riesgo"
   - Sin acción adicional requerida

3. INUSUAL: Una razón específica
   - Factor principal detectado por ML/EBR
   - Requiere revisión por oficial de cumplimiento

NO genera 3 razones forzadas. Solo la razón relevante.
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

# ============================================================================
# CONFIGURACIÓN
# ============================================================================
_CONFIG_CACHE: Dict[str, Any] = {}


def cargar_config() -> Dict[str, Any]:
    """Carga configuración LFPIORPI"""
    global _CONFIG_CACHE
    if _CONFIG_CACHE:
        return _CONFIG_CACHE
    
    here = Path(__file__).resolve().parent
    candidates = [
        here.parent / "models" / "config_modelos.json",
        here / "config_modelos.json",
    ]
    
    for p in candidates:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                _CONFIG_CACHE = json.load(f)
                return _CONFIG_CACHE
    
    # Fallback
    _CONFIG_CACHE = {"lfpiorpi": {"uma_mxn": 113.14}}
    return _CONFIG_CACHE


def get_uma_mxn() -> float:
    cfg = cargar_config()
    return float(cfg.get("lfpiorpi", {}).get("uma_mxn", 113.14))


# ============================================================================
# MAPEO FRACCIÓN → DESCRIPCIÓN LEGAL
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
    """Retorna (número_fracción, descripción) para fundamento legal"""
    if fraccion in FRACCIONES_DESCRIPCION:
        return FRACCIONES_DESCRIPCION[fraccion]
    
    # Intentar extraer número de la fracción
    if "_" in fraccion:
        num = fraccion.split("_")[0]
        return (num, fraccion.replace("_", " "))
    
    return ("", fraccion)


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
        factores_ebr: Lista de factores EBR detectados
        score_ebr: Score EBR (0-100)
        ica: Índice de confianza del modelo
    
    Returns:
        Dict con explicación estructurada
    """
    
    # ================================================================
    # CASO 1: PREOCUPANTE (regla LFPIORPI)
    # ================================================================
    if clasificacion == "preocupante":
        fraccion = transaccion.get("fraccion", "")
        monto = float(transaccion.get("monto", 0) or 0)
        uma = get_uma_mxn()
        monto_umas = monto / uma if uma > 0 else 0
        
        # Usar fundamento ya generado o construir uno
        if guardrail_fundamento:
            fundamento = guardrail_fundamento
        else:
            num_fracc, desc_fracc = obtener_descripcion_fraccion(fraccion)
            fundamento = (
                f"Artículo 17, Fracción {num_fracc} de la LFPIORPI: {desc_fracc}. "
                f"Operación por {monto:,.0f} MXN ({monto_umas:,.0f} UMAs) "
                f"que rebasa el umbral de aviso establecido."
            )
        
        return {
            "tipo": "obligacion_legal",
            "clasificacion": "preocupante",
            "certeza": "100%",
            "razon_principal": guardrail_razon or "Operación rebasa umbral LFPIORPI",
            "fundamento_legal": fundamento,
            "accion_requerida": (
                "OBLIGATORIO: Presentar aviso a la UIF dentro de los 15 días hábiles "
                "siguientes a la fecha de la operación. Conservar documentación de respaldo "
                "por un mínimo de 5 años."
            ),
            "requiere_revision": False,
            "detalles": {
                "fraccion": fraccion,
                "monto": monto,
                "monto_umas": round(monto_umas, 2),
            }
        }
    
    # ================================================================
    # CASO 2: RELEVANTE (sin indicadores)
    # ================================================================
    elif clasificacion == "relevante":
        return {
            "tipo": "sin_riesgo",
            "clasificacion": "relevante",
            "certeza": f"{ica:.0%}" if ica > 0 else "95%",
            "razon_principal": "No se detectaron indicadores de riesgo PLD/FT",
            "fundamento_legal": None,
            "accion_requerida": (
                "Registro para trazabilidad conforme al artículo 18 LFPIORPI. "
                "Sin acción adicional requerida."
            ),
            "requiere_revision": False,
            "detalles": {
                "score_ebr": round(score_ebr, 1),
                "ica": round(ica, 2),
            }
        }
    
    # ================================================================
    # CASO 3: INUSUAL (requiere revisión)
    # ================================================================
    else:  # inusual
        # Determinar la razón principal
        razon = _determinar_razon_inusual(
            transaccion, origen, factores_ebr, score_ebr
        )
        
        return {
            "tipo": "requiere_analisis",
            "clasificacion": "inusual",
            "certeza": f"{ica:.0%}" if ica > 0 else "75%",
            "razon_principal": razon,
            "fundamento_legal": None,  # Inusual no tiene fundamento legal directo
            "accion_requerida": (
                "Revisión por oficial de cumplimiento. Documentar el análisis realizado "
                "y la decisión tomada. Si tras el análisis se determina que es sospechosa, "
                "proceder con el aviso correspondiente."
            ),
            "requiere_revision": True,
            "detalles": {
                "score_ebr": round(score_ebr, 1),
                "ica": round(ica, 2),
                "factores": factores_ebr[:3] if factores_ebr else [],
                "origen_clasificacion": origen,
            }
        }


def _determinar_razon_inusual(
    tx: Dict[str, Any],
    origen: str,
    factores_ebr: Optional[List[str]],
    score_ebr: float
) -> str:
    """
    Determina la razón principal para clasificación INUSUAL.
    
    Prioridad:
    1. Si fue por elevación EBR → mencionar score
    2. Si hay factores EBR → usar el más significativo
    3. Analizar features directamente
    4. Default genérico
    """
    
    # 1. Elevación por EBR
    if origen == "elevacion_ebr" and score_ebr > 0:
        return f"Score de riesgo elevado ({score_ebr:.0f}/100) requiere revisión"
    
    # 2. Factores EBR disponibles
    if factores_ebr and len(factores_ebr) > 0:
        # Usar el primer factor (el más significativo)
        factor = factores_ebr[0]
        # Limpiar formato si tiene puntos
        if "(+" in factor:
            factor = factor.split("(+")[0].strip()
        return factor
    
    # 3. Analizar features directamente
    razones = []
    
    # Efectivo alto
    if tx.get("efectivo_alto") in (1, True, "1"):
        razones.append("Operación en efectivo cercana al umbral permitido")
    
    # Monto cerca del umbral
    pct_umbral = float(tx.get("pct_umbral_aviso", 0) or 0)
    if pct_umbral >= 75:
        razones.append(f"Monto representa {pct_umbral:.0f}% del umbral de aviso")
    
    # Ratio alto
    ratio = float(tx.get("ratio_vs_promedio", 0) or 0)
    if ratio > 3:
        razones.append(f"Monto {ratio:.1f}x superior al promedio del cliente")
    
    # Frecuencia alta
    ops = int(tx.get("ops_6m", 0) or 0)
    if ops > 5:
        razones.append(f"Alta frecuencia transaccional ({ops} operaciones en 6 meses)")
    
    # Patrón temporal
    if tx.get("es_nocturno") in (1, True) and tx.get("fin_de_semana") in (1, True):
        razones.append("Operación en horario y día atípicos")
    elif tx.get("es_nocturno") in (1, True):
        razones.append("Operación en horario nocturno")
    
    # Posible fraccionamiento
    if tx.get("posible_burst") in (1, True, "1"):
        razones.append("Posible fraccionamiento de operaciones")
    
    # Outlier estadístico
    if tx.get("is_outlier_iso") in (1, True):
        razones.append("Comportamiento estadísticamente atípico detectado")
    
    # Retornar la razón más relevante o default
    if razones:
        return razones[0]
    
    return "Patrón de comportamiento atípico detectado por análisis ML"


# ============================================================================
# FUNCIONES DE COMPATIBILIDAD
# ============================================================================
def build_explicacion(
    row: Dict[str, Any],
    fusion: Optional[Dict[str, Any]] = None,
    cfg: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Wrapper de compatibilidad con ml_runner anterior.
    
    Args:
        row: Fila del DataFrame como dict
        fusion: Resultado de fusionar_clasificaciones (opcional)
        cfg: Configuración (opcional)
    
    Returns:
        Dict con explicación
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
    cfg: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Alias de compatibilidad"""
    return build_explicacion(row, cfg=cfg)


# ============================================================================
# MAPEO SECTOR → FRACCIÓN (para compatibilidad)
# ============================================================================
def mapear_sector_a_fraccion(sector: str) -> Tuple[str, str]:
    """
    Mapea un sector de actividad a su fracción LFPIORPI.
    
    Returns:
        (numero_fraccion, descripcion)
    """
    # Mapeo básico sector → fracción
    SECTOR_FRACCION = {
        "joyeria": "VI_joyeria_metales",
        "joyas": "VI_joyeria_metales",
        "metales": "VI_joyeria_metales",
        "inmobiliaria": "V_inmuebles",
        "inmuebles": "V_inmuebles",
        "vehiculos": "VIII_vehiculos",
        "autos": "VIII_vehiculos",
        "cripto": "XVI_activos_virtuales",
        "bitcoin": "XVI_activos_virtuales",
        "notario": "XII_A_notarios_derechos_inmuebles",
        "casino": "I_juegos",
        "apuestas": "I_juegos",
    }
    
    sector_lower = str(sector).lower().strip()
    
    # Buscar en mapeo
    for key, fraccion in SECTOR_FRACCION.items():
        if key in sector_lower:
            return obtener_descripcion_fraccion(fraccion)
    
    # Si ya es una fracción válida
    if sector in FRACCIONES_DESCRIPCION:
        return obtener_descripcion_fraccion(sector)
    
    return ("", "Actividad no especificada")


# ============================================================================
# TESTING
# ============================================================================
if __name__ == "__main__":
    # Test de explicaciones
    print("\n" + "="*70)
    print("🧪 TEST DE EXPLICACIONES v4.0")
    print("="*70)
    
    # Test PREOCUPANTE
    tx_preocupante = {
        "monto": 200000,
        "fraccion": "VI_joyeria_metales",
        "clasificacion_final": "preocupante",
        "origen": "regla_lfpiorpi",
        "guardrail_razon": "Monto 200,000 MXN rebasa umbral de aviso 1,605 UMAs",
    }
    exp = build_explicacion(tx_preocupante)
    print(f"\n🔴 PREOCUPANTE:")
    print(f"   Razón: {exp['razon_principal']}")
    print(f"   Acción: {exp['accion_requerida'][:60]}...")
    
    # Test RELEVANTE
    tx_relevante = {
        "monto": 15000,
        "fraccion": "servicios_generales",
        "clasificacion_final": "relevante",
        "origen": "ml_ebr_coinciden",
        "ica": 0.92,
        "score_ebr": 15,
    }
    exp = build_explicacion(tx_relevante)
    print(f"\n🟢 RELEVANTE:")
    print(f"   Razón: {exp['razon_principal']}")
    print(f"   Certeza: {exp['certeza']}")
    
    # Test INUSUAL
    tx_inusual = {
        "monto": 80000,
        "fraccion": "servicios_generales",
        "clasificacion_final": "inusual",
        "origen": "elevacion_ebr",
        "efectivo_alto": 1,
        "ratio_vs_promedio": 4.5,
        "score_ebr": 55,
        "ica": 0.78,
        "factores_ebr": ["Operación en efectivo (+25 pts)", "Ratio alto (+10 pts)"],
    }
    exp = build_explicacion(tx_inusual)
    print(f"\n🟡 INUSUAL:")
    print(f"   Razón: {exp['razon_principal']}")
    print(f"   Acción: {exp['accion_requerida'][:60]}...")
    print(f"   Requiere revisión: {exp['requiere_revision']}")
    
    print("\n" + "="*70)
    print("✅ Tests completados")
    print("="*70 + "\n")
