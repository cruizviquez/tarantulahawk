#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
explicabilidad_transactions.py - VERSIÓN CORREGIDA

Genera explicaciones completas para transacciones clasificadas.

Contenido de la explicación:
- ICA numérico (0-1, no etiquetas)
- Top 3 razones principales con fundamento legal
- Fundamento LFPIORPI con artículo, fracción y UMAs
- Acciones sugeridas según clasificación
- Contexto regulatorio

Funciones principales:
- build_explicacion(): Construye explicación completa
- generar_explicacion_transaccion(): Wrapper de compatibilidad
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple


# ============================================================================
# CONFIGURACIÓN LFPIORPI
# ============================================================================
_LFPI_CONFIG: Dict[str, Any] = {}


def _cargar_config_lfpiorpi() -> Dict[str, Any]:
    """Carga configuración LFPIORPI desde config_modelos.json"""
    global _LFPI_CONFIG
    
    if _LFPI_CONFIG:
        return _LFPI_CONFIG
    
    # Buscar config
    here = Path(__file__).resolve().parent
    candidates = [
        here.parent / "models" / "config_modelos.json",
        here.parent / "config" / "config_modelos.json",
        here / "config_modelos.json",
        Path.cwd() / "app" / "backend" / "models" / "config_modelos.json",
    ]
    
    for p in candidates:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    _LFPI_CONFIG = config.get("lfpiorpi", {})
                    return _LFPI_CONFIG
            except Exception:
                continue
    
    # Fallback con valores por defecto
    _LFPI_CONFIG = {
        "uma_mxn": 113.14,
        "uma_diaria": 113.14,
        "umbrales": {
            "_general": {"aviso_UMA": 645, "efectivo_max_UMA": 8025}
        }
    }
    return _LFPI_CONFIG


def get_uma_mxn() -> float:
    """Obtiene valor de UMA en MXN"""
    cfg = _cargar_config_lfpiorpi()
    return float(cfg.get("uma_mxn", cfg.get("uma_diaria", 113.14)))


# ============================================================================
# MAPEO SECTOR → FRACCIÓN LFPIORPI
# ============================================================================
MAPEO_FRACCIONES = {
    # Fracción I - Juegos y sorteos
    "juegos_apuestas": ("I", "realización habitual de juegos con apuesta, concursos o sorteos"),
    "casino": ("I", "realización habitual de juegos con apuesta, concursos o sorteos"),
    
    # Fracción II - Emisión de tarjetas
    "tarjetas": ("II", "emisión y comercialización de tarjetas de servicios y de crédito"),
    
    # Fracción III - Operaciones de divisas
    "casa_cambio": ("III", "operaciones de mutuo o de garantía, o de otorgamiento de préstamos"),
    "cambio_divisas": ("III", "operaciones de mutuo o de garantía, o de otorgamiento de préstamos"),
    
    # Fracción IV - Cheques de viajero
    "cheques_viajero": ("IV", "emisión y comercialización de cheques de viajero"),
    
    # Fracción V - Inmuebles
    "inmobiliaria": ("V", "transmisión o constitución de derechos reales sobre inmuebles"),
    "inmuebles": ("V", "transmisión o constitución de derechos reales sobre inmuebles"),
    "bienes_raices": ("V", "transmisión o constitución de derechos reales sobre inmuebles"),
    
    # Fracción VI - Tarjetas prepago
    "tarjetas_prepago": ("VI", "emisión, comercialización o distribución de tarjetas prepagadas"),
    
    # Fracción VII - Blindaje
    "blindaje": ("VII", "prestación habitual de servicios de blindaje"),
    
    # Fracción VIII - Inmuebles como garantía
    "garantias_inmobiliarias": ("VIII", "constitución de garantías sobre bienes inmuebles"),
    
    # Fracción IX - Transmisión de dinero
    "transmision_dinero": ("IX", "prestación de servicios de traslado o custodia de dinero o valores"),
    "envio_dinero": ("IX", "prestación de servicios de traslado o custodia de dinero o valores"),
    
    # Fracción X - Traslado de valores
    "traslado_valores": ("X", "servicios de traslado o custodia de dinero o valores"),
    
    # Fracción XI - Joyas y metales
    "joyeria_metales": ("XI", "comercialización de piedras preciosas, joyas, metales preciosos o relojes"),
    "joyeria": ("XI", "comercialización de piedras preciosas, joyas, metales preciosos o relojes"),
    "metales_preciosos": ("XI", "comercialización de piedras preciosas, joyas, metales preciosos o relojes"),
    "piedras_preciosas": ("XI", "comercialización de piedras preciosas, joyas, metales preciosos o relojes"),
    
    # Fracción XII - Arte
    "comercio_arte": ("XII", "comercialización de obras de arte"),
    "arte_antiguedades": ("XII", "comercialización de obras de arte"),
    
    # Fracción XIII - Vehículos
    "automotriz": ("XIII", "comercialización de vehículos nuevos o usados"),
    "vehiculos": ("XIII", "comercialización de vehículos nuevos o usados"),
    
    # Fracción XIV - Fe pública
    "notaria": ("XIV", "prestación de servicios de fe pública"),
    "fedatarios": ("XIV", "prestación de servicios de fe pública"),
    
    # Fracción XV - Administración de inmuebles
    "administracion_inmuebles": ("XV", "prestación de servicios de administración de inmuebles"),
    
    # Fracción XVI - Activos virtuales
    "activos_virtuales": ("XVI", "servicios relacionados con activos virtuales"),
    "criptomonedas": ("XVI", "servicios relacionados con activos virtuales"),
    
    # Fracción XVII - Sociedades mercantiles
    "sociedades_mercantiles": ("XVII", "constitución de sociedades mercantiles o personas morales"),
}


def mapear_sector_a_fraccion(sector: str) -> Tuple[str, str]:
    """
    Mapea sector de actividad a fracción LFPIORPI.
    
    Returns:
        (numero_fraccion, descripcion_actividad)
    """
    if not sector:
        return "aplicable", "la actividad vulnerable correspondiente"
    
    sector_lower = sector.lower().strip()
    
    # Buscar en mapeo directo
    if sector_lower in MAPEO_FRACCIONES:
        return MAPEO_FRACCIONES[sector_lower]
    
    # Buscar por substring
    for key, value in MAPEO_FRACCIONES.items():
        if key in sector_lower or sector_lower in key:
            return value
    
    return "aplicable", "la actividad vulnerable correspondiente"


# ============================================================================
# FORMATEO DE MONTOS
# ============================================================================
def formatear_monto(monto: float) -> str:
    """Formatea monto como string en pesos mexicanos"""
    try:
        return f"${monto:,.2f} MXN"
    except (TypeError, ValueError):
        return f"${monto} MXN"


def monto_a_umas(monto: float, uma_mxn: Optional[float] = None) -> float:
    """Convierte monto MXN a UMAs"""
    if uma_mxn is None:
        uma_mxn = get_uma_mxn()
    if uma_mxn <= 0:
        return 0.0
    return monto / uma_mxn


# ============================================================================
# GENERACIÓN DE RAZONES ESPECÍFICAS (FUNCIÓN QUE FALTABA)
# ============================================================================
def _generar_razones_especificas(tx: Dict[str, Any]) -> List[str]:
    """
    Genera razones específicas basadas en los datos de la transacción.
    
    Analiza los campos disponibles y genera hasta 3 razones relevantes
    con fundamento legal cuando aplica.
    
    Args:
        tx: Diccionario con datos de la transacción
    
    Returns:
        Lista de hasta 3 razones específicas
    """
    razones = []
    uma_mxn = get_uma_mxn()
    
    # Helper para obtener valores numéricos
    def get_num(key: str, default: float = 0.0) -> float:
        val = tx.get(key, default)
        if val is None or (isinstance(val, float) and not (val == val)):  # NaN check
            return default
        try:
            return float(val)
        except (TypeError, ValueError):
            return default
    
    def get_int(key: str, default: int = 0) -> int:
        return int(get_num(key, float(default)))
    
    monto = get_num("monto")
    umas = monto_a_umas(monto, uma_mxn)
    score_ebr = get_num("score_ebr")
    monto_6m = get_num("monto_6m")
    
    # 1. Razones por monto/UMAs
    if umas >= 645:  # Umbral general de aviso
        razones.append(
            f"Operación de {umas:,.0f} UMAs rebasa umbral de aviso (Art. 17 LFPIORPI)"
        )
    elif umas >= 500:
        razones.append(
            f"Operación de {umas:,.0f} UMAs se aproxima al umbral de aviso LFPIORPI"
        )
    elif monto >= 100_000:
        razones.append(
            f"Monto significativo de {formatear_monto(monto)} ({umas:,.0f} UMAs)"
        )
    
    # 2. Razones por tipo de operación
    if get_int("EsEfectivo") == 1:
        if monto >= 500_000:
            razones.append(
                "Operación en efectivo de alto monto - requiere identificación reforzada (Art. 18 LFPIORPI)"
            )
        else:
            razones.append(
                "Operación en efectivo - factor de riesgo PLD/FT incrementado"
            )
    
    if get_int("EsInternacional") == 1:
        razones.append(
            "Transferencia internacional - sujeta a mayor escrutinio por riesgo de operaciones transfronterizas"
        )
    
    # 3. Razones por sector
    if get_int("SectorAltoRiesgo") == 1:
        sector = tx.get("sector_actividad", "")
        fraccion, desc = mapear_sector_a_fraccion(sector)
        if fraccion != "aplicable":
            razones.append(
                f"Sector de alto riesgo: {desc} (Art. 17, Fracc. {fraccion} LFPIORPI)"
            )
        else:
            razones.append(
                "Operación en sector vulnerable según LFPIORPI"
            )
    
    # 4. Razones por acumulado
    if monto_6m >= 500_000:
        umas_6m = monto_a_umas(monto_6m, uma_mxn)
        razones.append(
            f"Acumulado 6 meses de {formatear_monto(monto_6m)} ({umas_6m:,.0f} UMAs) - monitoreo reforzado"
        )
    
    # 5. Razones por patrones
    if get_int("es_nocturno") == 1 and get_int("EsEfectivo") == 1:
        razones.append(
            "Efectivo en horario nocturno - patrón atípico que requiere validación"
        )
    
    if get_num("ratio_vs_promedio") > 3.0:
        ratio = get_num("ratio_vs_promedio")
        razones.append(
            f"Monto {ratio:.1f}x superior al promedio del cliente - desviación significativa"
        )
    
    if get_int("posible_burst") == 1:
        razones.append(
            "Operaciones consecutivas en corto tiempo - posible fraccionamiento (structuring)"
        )
    
    # 6. Razones por EBR
    if score_ebr >= 70 and len(razones) < 3:
        razones.append(
            f"Score de riesgo EBR alto: {score_ebr:.1f}/100 según matriz de riesgos institucional"
        )
    
    # Limitar a 3 y garantizar al menos una razón
    razones = razones[:3]
    
    if not razones:
        clasificacion = tx.get("clasificacion", tx.get("clasificacion_final", "relevante"))
        if clasificacion == "preocupante":
            razones = [
                "Combinación de factores de riesgo supera umbrales de alerta",
                "Requiere revisión prioritaria por oficial de cumplimiento",
                "Considerar reporte a UIF según Art. 18 LFPIORPI"
            ]
        elif clasificacion == "inusual":
            razones = [
                "Patrón de operación se desvía del comportamiento histórico del cliente",
                "Requiere documentación adicional para sustento",
                "Monitorear operaciones subsecuentes del cliente"
            ]
        else:
            razones = [
                "Operación dentro de parámetros normales del perfil del cliente",
                "Sin indicadores significativos de riesgo PLD/FT",
                "Registro para efectos de trazabilidad"
            ]
    
    # Rellenar si faltan
    while len(razones) < 3:
        if len(razones) == 1:
            razones.append("Evaluar en contexto de operaciones relacionadas del cliente")
        else:
            razones.append("Mantener monitoreo según políticas institucionales")
    
    return razones[:3]


# ============================================================================
# FUNDAMENTO LEGAL COMPLETO
# ============================================================================
def generar_fundamento_legal(
    tx: Dict[str, Any],
    clasificacion_final: str,
    uma_mxn: Optional[float] = None
) -> str:
    """
    Genera fundamento legal completo con artículo, fracción y UMAs.
    
    Args:
        tx: Datos de la transacción
        clasificacion_final: Clasificación asignada
        uma_mxn: Valor de UMA (opcional)
    
    Returns:
        Texto de fundamento legal estructurado
    """
    if uma_mxn is None:
        uma_mxn = get_uma_mxn()
    
    # Obtener datos
    monto = float(tx.get("monto", 0) or 0)
    sector = str(tx.get("sector_actividad", "")).lower()
    fraccion_num, actividad_desc = mapear_sector_a_fraccion(sector)
    
    umas_operacion = monto_a_umas(monto, uma_mxn)
    monto_fmt = formatear_monto(monto)
    
    # Obtener umbrales (usar valores por defecto si no hay config específica)
    cfg = _cargar_config_lfpiorpi()
    umbrales = cfg.get("umbrales", {})
    fraccion_key = tx.get("fraccion", "_general")
    u = umbrales.get(fraccion_key, umbrales.get("_general", {}))
    
    umbral_aviso_umas = float(u.get("aviso_UMA", 645))
    umbral_efectivo_umas = float(u.get("efectivo_max_UMA", 8025))
    umbral_aviso_mxn = umbral_aviso_umas * uma_mxn
    umbral_efectivo_mxn = umbral_efectivo_umas * uma_mxn
    
    # Construir fundamento
    fundamento = f"""FUNDAMENTO LEGAL LFPIORPI

Artículo 17, Fracción {fraccion_num}
La presente operación se clasifica como actividad vulnerable conforme a la fracción {fraccion_num} del artículo 17 de la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI), que regula: {actividad_desc}.

Análisis de Umbrales (UMAs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Monto de la operación: {monto_fmt}
• Equivalente en UMAs: {umas_operacion:,.1f} UMAs
• UMA vigente: {formatear_monto(uma_mxn)}
• Umbral de aviso: {umbral_aviso_umas:,.0f} UMAs ({formatear_monto(umbral_aviso_mxn)})
• Límite efectivo: {umbral_efectivo_umas:,.0f} UMAs ({formatear_monto(umbral_efectivo_mxn)})

Clasificación Final: {clasificacion_final.upper()}"""
    
    # Agregar interpretación según clasificación
    if clasificacion_final == "preocupante":
        fundamento += """

Interpretación Normativa
━━━━━━━━━━━━━━━━━━━━━━━━━
Esta operación rebasa los umbrales establecidos en las Reglas de Carácter General de la LFPIORPI para actividades vulnerables, clasificándose como PREOCUPANTE.

Conforme al artículo 18 de la LFPIORPI, se requiere:
1. Presentar aviso a la Unidad de Inteligencia Financiera (UIF)
2. Plazo máximo: 15 días hábiles siguientes a la operación
3. Conservar documentación soporte por 5 años

ACCIÓN REQUERIDA: Generar aviso a UIF conforme artículo 18 LFPIORPI."""
    
    elif clasificacion_final == "inusual":
        fundamento += """

Interpretación Normativa
━━━━━━━━━━━━━━━━━━━━━━━━━
Esta operación presenta características de monto, frecuencia o patrón que se apartan del perfil transaccional esperado del cliente, sin rebasar necesariamente los umbrales legales máximos.

Bajo el Enfoque Basado en Riesgos (artículo 3, Reglas Generales LFPIORPI), se clasifica como INUSUAL.

Se recomienda:
1. Documentar análisis de la operación
2. Solicitar información adicional al cliente de ser necesario
3. Incluir en monitoreo reforzado

ACCIÓN REQUERIDA: Revisión y documentación bajo criterio del oficial de cumplimiento."""
    
    else:  # relevante
        fundamento += """

Interpretación Normativa
━━━━━━━━━━━━━━━━━━━━━━━━━
Esta operación se encuentra dentro de los parámetros habituales del perfil transaccional del cliente y no rebasa umbrales legales significativos, clasificándose como RELEVANTE.

Se mantiene registro para:
1. Cumplimiento de obligaciones de identificación (Art. 17 LFPIORPI)
2. Trazabilidad de operaciones
3. Base para análisis de comportamiento futuro

ACCIÓN REQUERIDA: Registro documental conforme políticas internas."""
    
    return fundamento


# ============================================================================
# ACCIONES SUGERIDAS
# ============================================================================
def generar_acciones_sugeridas(clasificacion: str) -> List[str]:
    """
    Genera lista de acciones sugeridas según clasificación.
    
    Args:
        clasificacion: "relevante" | "inusual" | "preocupante"
    
    Returns:
        Lista de acciones sugeridas
    """
    acciones = {
        "preocupante": [
            "Generar Reporte de Operación Preocupante (ROP) para UIF",
            "Recopilar documentación soporte completa",
            "Notificar al oficial de cumplimiento en máximo 24 horas",
            "Evaluar necesidad de bloqueo preventivo de cuenta",
            "Documentar análisis y justificación de clasificación"
        ],
        "inusual": [
            "Documentar análisis detallado de la operación",
            "Solicitar información adicional al cliente si aplica",
            "Incluir cliente en monitoreo reforzado",
            "Revisar operaciones relacionadas en últimos 6 meses",
            "Actualizar perfil transaccional del cliente"
        ],
        "relevante": [
            "Mantener registro para trazabilidad",
            "Incluir en reportes periódicos de cumplimiento",
            "Continuar monitoreo estándar del cliente"
        ]
    }
    
    return acciones.get(clasificacion.lower(), acciones["relevante"])


# ============================================================================
# FUNCIÓN PRINCIPAL: BUILD_EXPLICACION
# ============================================================================
def build_explicacion(
    row: Dict[str, Any],
    ml_info: Dict[str, Any],
    ebr_info: Dict[str, Any],
    lfpi_cfg: Dict[str, Any],
    uma_cfg: Dict[str, Any],
    clasificacion_final: str,
    nivel_riesgo_final: str,
    triggers: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Construye explicación completa para una transacción.
    
    Args:
        row: Datos de la transacción
        ml_info: Info del modelo ML (clasificacion_ml, probabilidades, ica)
        ebr_info: Info EBR (score_ebr, nivel_riesgo_ebr, factores)
        lfpi_cfg: Config LFPIORPI
        uma_cfg: Config UMA
        clasificacion_final: Clasificación combinada
        nivel_riesgo_final: "bajo" | "medio" | "alto"
        triggers: Lista de triggers que activaron clasificación
    
    Returns:
        Diccionario con explicación completa
    """
    # Obtener valores
    monto = float(row.get("monto", 0) or 0)
    tipo_op = row.get("tipo_operacion", "operación")
    sector = row.get("sector_actividad", "no especificado")
    
    score_ebr = float(ebr_info.get("score_ebr", 0) or 0)
    clasif_ml = ml_info.get("clasificacion_ml", "relevante")
    ica = float(ml_info.get("ica", 0) or 0)
    probs = ml_info.get("probabilidades", {})
    factores = ebr_info.get("factores", [])
    
    uma_mxn = float(uma_cfg.get("uma_mxn", get_uma_mxn()))
    
    # Generar razones específicas
    tx_completo = {**row, "score_ebr": score_ebr, "clasificacion": clasificacion_final}
    razones_principales = _generar_razones_especificas(tx_completo)
    
    # Generar fundamento legal
    fundamento_legal = generar_fundamento_legal(tx_completo, clasificacion_final, uma_mxn)
    
    # Resumen ejecutivo
    resumen_ejecutivo = (
        f"Operación de {formatear_monto(monto)} clasificada como '{clasificacion_final.upper()}' "
        f"(Nivel de riesgo: {nivel_riesgo_final.upper()}). "
        f"Tipo: {tipo_op} | Sector: {sector}"
    )
    
    # Explicación del modelo
    explicacion_modelo = (
        f"El modelo de machine learning asignó la clasificación '{clasif_ml}' "
        f"con un Índice de Confianza Algorítmica (ICA) de {ica:.2%}. "
        f"Este valor representa la certeza del modelo en su predicción."
    )
    
    # Explicación EBR
    nivel_ebr = ebr_info.get("nivel_riesgo_ebr", "bajo")
    clasif_ebr = ebr_info.get("clasificacion_ebr", "relevante")
    explicacion_ebr = (
        f"El Enfoque Basado en Riesgos (EBR) asignó un puntaje de {score_ebr:.1f}/100, "
        f"correspondiente a un nivel de riesgo '{nivel_ebr}' "
        f"(clasificación EBR: '{clasif_ebr}')."
    )
    
    # Nota de guardrails si aplica
    nota_guardrails = None
    if triggers and any(t.startswith("guardrail_") for t in triggers):
        nota_guardrails = (
            "⚠️ Esta transacción fue clasificada como 'preocupante' por guardrails normativos LFPIORPI, "
            "ya que rebasa umbrales legales establecidos en UMAs."
        )
    
    # Acciones sugeridas
    acciones_sugeridas = generar_acciones_sugeridas(clasificacion_final)
    
    return {
        # Para UI
        "resumen_ejecutivo": resumen_ejecutivo,
        "razones_principales": razones_principales,
        "fundamento_legal": fundamento_legal,
        
        # Métricas numéricas
        "ica_numerico": ica,
        "score_ebr": score_ebr,
        
        # Explicaciones técnicas
        "explicacion_modelo": explicacion_modelo,
        "explicacion_ebr": explicacion_ebr,
        "nota_guardrails": nota_guardrails,
        
        # Acciones
        "acciones_sugeridas": acciones_sugeridas,
        
        # Detalles técnicos completos
        "detalles_tecnicos": {
            "ml": {
                "clasificacion_ml": clasif_ml,
                "probabilidades": probs,
                "ica": ica,
            },
            "ebr": {
                "score_ebr": score_ebr,
                "nivel_riesgo_ebr": nivel_ebr,
                "clasificacion_ebr": clasif_ebr,
                "factores_completos": factores,
            },
            "clasificacion_final": clasificacion_final,
            "nivel_riesgo_final": nivel_riesgo_final,
            "triggers": triggers or [],
            "uma_mxn": uma_mxn,
            "timestamp_explicacion": datetime.now().isoformat(),
        },
    }


# ============================================================================
# WRAPPER DE COMPATIBILIDAD
# ============================================================================
def generar_explicacion_transaccion(tx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Wrapper de compatibilidad para llamadas desde código existente.
    
    Extrae ml_info, ebr_info de los campos disponibles en tx.
    """
    # Normalizar tx a dict
    if not isinstance(tx, dict):
        try:
            tx = dict(tx)
        except Exception:
            tx = {}
    
    # Extraer ml_info
    ml_info = {
        "clasificacion_ml": tx.get("clasificacion_ml", tx.get("clasificacion")),
        "probabilidades": tx.get("probabilidades", {}),
        "ica": tx.get("ica", tx.get("ica_score", 0)),
    }
    
    # Extraer ebr_info
    ebr_info = {
        "score_ebr": tx.get("score_ebr", 0),
        "nivel_riesgo_ebr": tx.get("nivel_riesgo_ebr", "bajo"),
        "clasificacion_ebr": tx.get("clasificacion_ebr", "relevante"),
        "factores": tx.get("factores_ebr", []),
    }
    
    # Config por defecto
    lfpi_cfg = _cargar_config_lfpiorpi()
    uma_cfg = {"uma_mxn": get_uma_mxn()}
    
    # Clasificación final
    clasificacion_final = tx.get("clasificacion_final", tx.get("clasificacion", "relevante"))
    
    # Nivel de riesgo
    nivel_map = {"relevante": "bajo", "inusual": "medio", "preocupante": "alto"}
    nivel_riesgo_final = nivel_map.get(
        str(clasificacion_final).lower(),
        tx.get("nivel_riesgo_final", "bajo")
    )
    
    triggers = tx.get("triggers", [])
    
    # Construir explicación
    explicacion = build_explicacion(
        row=tx,
        ml_info=ml_info,
        ebr_info=ebr_info,
        lfpi_cfg=lfpi_cfg,
        uma_cfg=uma_cfg,
        clasificacion_final=clasificacion_final,
        nivel_riesgo_final=nivel_riesgo_final,
        triggers=triggers,
    )
    
    return explicacion


# ============================================================================
# CLI para pruebas
# ============================================================================
if __name__ == "__main__":
    # Ejemplo
    tx_ejemplo = {
        "cliente_id": "CLI-001",
        "monto": 150_000,
        "fecha": "2025-01-15",
        "tipo_operacion": "efectivo",
        "sector_actividad": "inmobiliaria",
        "EsEfectivo": 1,
        "SectorAltoRiesgo": 0,
        "monto_6m": 450_000,
        "score_ebr": 72.5,
        "clasificacion": "inusual",
        "ica": 0.85,
    }
    
    explicacion = generar_explicacion_transaccion(tx_ejemplo)
    
    print("\n" + "=" * 70)
    print("📋 EXPLICACIÓN GENERADA")
    print("=" * 70)
    print(f"\n{explicacion['resumen_ejecutivo']}\n")
    print("Razones principales:")
    for i, r in enumerate(explicacion['razones_principales'], 1):
        print(f"  {i}. {r}")
    print(f"\nICA: {explicacion['ica_numerico']:.2%}")
    print(f"Score EBR: {explicacion['score_ebr']:.1f}/100")
    print(f"\n{explicacion['fundamento_legal']}")
    print("\nAcciones sugeridas:")
    for a in explicacion['acciones_sugeridas']:
        print(f"  • {a}")
    print("=" * 70)
