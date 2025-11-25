# -*- coding: utf-8 -*-

"""
explicabilidad_transactions.py - VERSIÓN MEJORADA

✅ CORRECCIONES APLICADAS:
- ICA numérico (0-1) en lugar de etiquetas textuales
- Top 3 razones principales estructuradas
- Fundamento legal con artículo y fracción LFPIORPI específicos
- Guardrails solo fuerzan clasificación hacia arriba (nunca hacia abajo)
- Combinación ML+EBR respetando la predicción del modelo

Función principal:
    build_explicacion(row, ml_info, ebr_info, lfpi_cfg, uma_cfg, clasificacion_final, nivel_riesgo_final)
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import json
from pathlib import Path

# Cargar configuración LFPIORPI
def _cargar_config_lfpiorpi():
    """Carga config desde config_modelos.json"""
    try:
        config_path = Path(__file__).parent.parent / "models" / "config_modelos.json"
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return config.get("lfpiorpi", {})
    except Exception:
        pass
    
    # Default fallback
    return {
        "uma_mxn": 108.57,
        "umbrales": {
            "relevante_umas": 325,
            "preocupante_umas": 650,
            "efectivo_umas": 7500
        }
    }

_LFPI_CONFIG = _cargar_config_lfpiorpi()




def _formatea_monto(monto: float) -> str:
    """Formatea monto en pesos mexicanos."""
    try:
        return f"${monto:,.2f} MXN"
    except Exception:
        return f"${monto} MXN"


def _mapear_sector_a_fraccion(sector: str) -> tuple[str, str]:
    """
    Mapea sector de actividad a fracción LFPIORPI específica.
    
    Returns:
        (fraccion_numero, descripcion_actividad)
    """
    sector_lower = sector.lower()
    
    # Mapeo exhaustivo LFPIORPI Artículo 17
    if "inmobili" in sector_lower or "inmueble" in sector_lower:
        return "V", "transmisión o constitución de derechos sobre bienes inmuebles"
    
    elif "joyeria" in sector_lower or "metal" in sector_lower or "oro" in sector_lower or "plata" in sector_lower or "piedras_preciosas" in sector_lower:
        return "XI", "comercialización de joyas, metales preciosos, piedras preciosas o relojes"
    
    elif "traslado" in sector_lower or "custodia" in sector_lower or "valores" in sector_lower:
        return "X", "servicios de traslado o custodia de dinero o valores"
    
    elif "activo_virtual" in sector_lower or "cripto" in sector_lower or "virtual" in sector_lower:
        return "XVI", "servicios de activos virtuales"
    
    elif "casa_cambio" in sector_lower or "cambio_divisas" in sector_lower:
        return "II", "operaciones de compra venta de divisas"
    
    elif "transmision_dinero" in sector_lower or "envio_dinero" in sector_lower:
        return "III", "prestación de servicios de transmisión de dinero"
    
    elif "blindaje" in sector_lower:
        return "VII", "prestación de servicios de blindaje"
    
    elif "comercio_arte" in sector_lower or "arte" in sector_lower:
        return "XII", "comercialización de obras de arte"
    
    elif "vehiculo" in sector_lower or "automovil" in sector_lower:
        return "XIII", "comercialización de vehículos"
    
    elif "juegos_apuestas" in sector_lower or "casino" in sector_lower:
        return "XIV", "prestación de servicios de juegos con apuesta, concursos o sorteos"
    
    elif "construccion" in sector_lower or "desarrolladora" in sector_lower:
        return "XV", "construcción o desarrollo de inmuebles"
    
    elif "asociacion_civil" in sector_lower or "sociedad_civil" in sector_lower:
        return "XVII", "asociaciones y sociedades sin fines de lucro"
    
    else:
        return "aplicable", "la actividad vulnerable correspondiente"


def _describe_top_3_razones(factores: List[Dict[str, Any]], triggers: List[str] = None) -> List[str]:
    """
    Extrae las 3 razones principales de clasificación.
    
    Prioridad:
    1. Guardrails LFPIORPI (si aplica)
    2. Factores EBR top 3
    3. Triggers adicionales
    
    Returns:
        Lista de exactamente 3 strings con razones principales
    """
    razones = []
    
    # 1) Verificar si hay guardrails aplicados
    if triggers:
        for trigger in triggers[:3]:
            if trigger.startswith("guardrail_"):
                razones.append("Rebasa umbrales normativos LFPIORPI (UMAs)")
                break
    
    # 2) Agregar factores EBR (top 3)
    if factores:
        for factor in factores[:3]:
            if isinstance(factor, dict):
                desc = factor.get("descripcion") or factor.get("label") or factor.get("feature") or str(factor)
            else:
                # aceptar strings u otros tipos sencillos
                desc = str(factor)
            if desc not in razones:  # Evitar duplicados
                razones.append(desc)
    
    # 3) Agregar triggers adicionales si no tenemos 3 razones
    if triggers and len(razones) < 3:
        for trigger in triggers:
            if not trigger.startswith("guardrail_"):
                # Formatear trigger a texto legible
                trigger_readable = trigger.replace("inusual_", "").replace("_", " ").title()
                if trigger_readable not in razones:
                    razones.append(trigger_readable)
                    if len(razones) >= 3:
                        break
    
    # 4) Completar con razones genéricas si falta información
    while len(razones) < 3:
        if len(razones) == 0:
            razones.append("Patrón de transacción atípico según perfil del cliente")
        elif len(razones) == 1:
            razones.append("Monto o frecuencia fuera del comportamiento histórico")
        else:
            razones.append("Características de la operación requieren revisión")
    
    return razones[:3]  # Garantizar exactamente 3


def _fundamento_legal_completo(
    row: Dict[str, Any],
    lfpi_cfg: Dict[str, Any],
    uma_cfg: Dict[str, Any],
    clasificacion_final: str,
) -> str:
    """
    Construye fundamento legal completo con:
    - Artículo 17 LFPIORPI
    - Fracción específica según sector
    - Relación con UMAs
    - Umbrales normativos
    """
    sector = (row.get("sector_actividad") or "").lower()
    monto = float(row.get("monto", 0.0))
    monto_txt = _formatea_monto(monto)
    
    uma = float(uma_cfg.get("uma_mxn", _LFPI_CONFIG.get("uma_mxn", 0)))

    def _resolve_umbral(name_flat: str, uma_cfg: Dict[str, Any], lfpi_cfg: Dict[str, Any]) -> float:
        # 1) prefer explicit uma_cfg flat key
        if uma_cfg and name_flat in uma_cfg:
            try:
                return float(uma_cfg[name_flat])
            except Exception:
                pass

        # 2) prefer lfpi_cfg['umbrales'] flat key (legacy shape)
        try:
            umbs = lfpi_cfg.get("umbrales", {})
            if isinstance(umbs, dict) and name_flat in umbs:
                return float(umbs[name_flat])
        except Exception:
            pass

        # 3) if umbrales is a per-fraccion dict, try to aggregate 'aviso_UMA' values
        try:
            umbs = lfpi_cfg.get("umbrales", {})
            if isinstance(umbs, dict):
                vals = []
                for v in umbs.values():
                    if isinstance(v, dict):
                        for k2 in ("aviso_UMA", "aviso_uma", "aviso"):
                            if k2 in v:
                                try:
                                    vals.append(float(v[k2]))
                                except Exception:
                                    pass
                    elif isinstance(v, (int, float)):
                        vals.append(float(v))
                if vals:
                    # use median as representative threshold (derived from config)
                    try:
                        import statistics

                        return float(statistics.median(vals))
                    except Exception:
                        return float(sorted(vals)[len(vals) // 2])
        except Exception:
            pass

        # 4) final fallback: explicator's internal legacy defaults (keeps behavior stable)
        legacy_defaults = {"umbral_relevante_umas": 325, "umbral_preocupante_umas": 650}
        return float(uma_cfg.get(name_flat, legacy_defaults.get(name_flat, 0)))

    umbral_rel_umas = _resolve_umbral("umbral_relevante_umas", uma_cfg, _LFPI_CONFIG)
    umbral_pre_umas = _resolve_umbral("umbral_preocupante_umas", uma_cfg, _LFPI_CONFIG)
    
    # Equivalente en UMAs
    umas_operacion = monto / uma if uma > 0 else 0.0
    
    # Mapear sector a fracción
    fraccion_num, actividad_desc = _mapear_sector_a_fraccion(sector)
    
    # Construir fundamento legal estructurado
    fundamento = f"""FUNDAMENTO LEGAL LFPIORPI

Artículo 17, Fracción {fraccion_num}
La presente operación se clasifica como actividad vulnerable conforme a la fracción {fraccion_num} del artículo 17 de la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI), que regula: {actividad_desc}.

Análisis de Umbrales (UMAs)
- Monto de la operación: {monto_txt}
- Equivalente aproximado: {umas_operacion:,.1f} UMAs (UMA vigente: ${uma:,.2f} MXN)
- Umbral relevante (aviso): {umbral_rel_umas:,.0f} UMAs (${umbral_rel_umas * uma:,.2f} MXN)
- Umbral preocupante (reporte): {umbral_pre_umas:,.0f} UMAs (${umbral_pre_umas * uma:,.2f} MXN)

Clasificación Final: {clasificacion_final.upper()}"""
    
    # Agregar interpretación específica según clasificación
    if clasificacion_final == "preocupante":
        fundamento += """

Interpretación Normativa:
Esta operación rebasa los umbrales establecidos en las Reglas de Carácter General de la LFPIORPI para actividades vulnerables, clasificándose como PREOCUPANTE. Conforme al artículo 18 de la LFPIORPI, se requiere presentar aviso a la Unidad de Inteligencia Financiera (UIF) dentro de los plazos establecidos.

Acción Requerida: Generar aviso a UIF conforme artículo 18 LFPIORPI."""
    
    elif clasificacion_final == "inusual":
        fundamento += """

Interpretación Normativa:
Esta operación presenta características de monto, frecuencia o patrón que se apartan del perfil transaccional esperado del cliente, sin rebasar necesariamente los umbrales legales máximos. Bajo el enfoque basado en riesgos (artículo 3 Reglas Generales LFPIORPI), se clasifica como INUSUAL.

Acción Requerida: Revisión y documentación bajo criterio del oficial de cumplimiento."""
    
    else:  # relevante
        fundamento += """

Interpretación Normativa:
Esta operación se encuentra dentro de los parámetros habituales del perfil transaccional del cliente y no rebasa umbrales legales significativos, clasificándose como RELEVANTE. Se mantiene registro para efectos de trazabilidad y cumplimiento.

Acción Requerida: Registro documental conforme políticas internas."""
    
    return fundamento


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
    Construye explicación completa para frontend.
    
    Parámetros:
      - row: dict con datos de transacción (monto, tipo_operacion, sector_actividad, etc.)
      - ml_info: dict con {
            "clasificacion_ml": str,
            "probabilidades": {clase: prob},
            "ica": float (0-1),  # ✅ NUMÉRICO, NO ETIQUETA
            "thresholds": {...}
        }
      - ebr_info: dict con {
            "score_ebr": float (0-100),
            "nivel_riesgo_ebr": "bajo/medio/alto",
            "clasificacion_ebr": str,
            "factores": [ {descripcion/label/feature...}, ...]
        }
      - lfpi_cfg: configuración LFPIORPI
      - uma_cfg: valores UMA y umbrales
      - clasificacion_final: clasificación combinada ML+EBR+guardrails
      - nivel_riesgo_final: "bajo/medio/alto"
      - triggers: lista de triggers que activaron esta clasificación
    
    Returns:
        Dict con estructura lista para frontend:
        - razones_principales: List[str] (exactamente 3)
        - fundamento_legal: str (completo con artículo y fracción)
        - ica_numerico: float (0-1)
        - detalles_tecnicos: dict con info ML y EBR
    """
    
    monto = float(row.get("monto", 0.0))
    tipo_op = row.get("tipo_operacion") or "operación"
    sector = row.get("sector_actividad") or "no especificado"
    
    score_ebr = float(ebr_info.get("score_ebr", 0.0))
    nivel_ebr = ebr_info.get("nivel_riesgo_ebr", "bajo")
    clasif_ebr = ebr_info.get("clasificacion_ebr", "relevante")
    factores = ebr_info.get("factores", [])
    
    clasif_ml = ml_info.get("clasificacion_ml")
    ica = float(ml_info.get("ica", 0.0))  # ✅ MANTENER NUMÉRICO
    probs = ml_info.get("probabilidades", {})
    
    # 1) Top 3 razones principales (estructuradas)
    razones_principales = _describe_top_3_razones(factores, triggers)
    
    # 2) Fundamento legal completo (con artículo y fracción)
    fundamento_legal = _fundamento_legal_completo(
        row=row,
        lfpi_cfg=lfpi_cfg,
        uma_cfg=uma_cfg,
        clasificacion_final=clasificacion_final,
    )
    
    # 3) Resumen ejecutivo
    resumen_ejecutivo = (
        f"Operación de {_formatea_monto(monto)} clasificada como '{clasificacion_final.upper()}' "
        f"(Nivel de riesgo: {nivel_riesgo_final.upper()}). "
        f"Tipo: {tipo_op} | Sector: {sector}"
    )
    
    # 4) Explicación técnica del modelo
    explicacion_modelo = (
        f"El modelo de machine learning asignó la clasificación '{clasif_ml}' "
        f"con un Índice de Coherencia Algorítmica (ICA) de {ica:.2%}. "
        f"Este valor representa la confianza numérica del modelo en su predicción, "
        f"calculado a partir de las probabilidades asignadas a cada categoría."
    )
    
    # 5) Explicación EBR
    explicacion_ebr = (
        f"El Enfoque Basado en Riesgos (EBR) asignó un puntaje de {score_ebr:.1f}/100, "
        f"correspondiente a un nivel de riesgo '{nivel_ebr}' según la matriz de riesgos configurada. "
        f"La clasificación EBR es '{clasif_ebr}'."
    )
    
    # 6) Nota sobre guardrails (si aplican)
    nota_guardrails = None
    if triggers and any(t.startswith("guardrail_") for t in triggers):
        nota_guardrails = (
            "⚠️ Esta transacción fue forzada a 'preocupante' por guardrails normativos LFPIORPI, "
            "ya que rebasa umbrales legales establecidos en UMAs, independientemente de la "
            "clasificación inicial del modelo ML."
        )
    
    return {
        # Para renderizar en UI
        "resumen_ejecutivo": resumen_ejecutivo,
        "razones_principales": razones_principales,  # ✅ Exactamente 3 razones
        "fundamento_legal": fundamento_legal,        # ✅ Con artículo y fracción
        
        # Métricas numéricas (sin etiquetas confusas)
        "ica_numerico": ica,  # ✅ 0.89 en lugar de "confianza alta"
        "score_ebr": score_ebr,
        
        # Explicaciones técnicas
        "explicacion_modelo": explicacion_modelo,
        "explicacion_ebr": explicacion_ebr,
        "nota_guardrails": nota_guardrails,
        
        # Detalles técnicos completos (para auditoría)
        "detalles_tecnicos": {
            "ml": {
                "clasificacion_ml": clasif_ml,
                "probabilidades": probs,
                "ica": ica,
                "thresholds": ml_info.get("thresholds", {}),
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
            "timestamp_explicacion": datetime.now().isoformat(),
        },
    }


# Función de compatibilidad con código legacy
def generar_explicacion_transaccion(tx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Wrapper de compatibilidad para llamadas desde código existente.
    Extrae ml_info, ebr_info, etc. del registro tx.
    """
    # Normalizar/asegurar que `tx` sea un dict antes de acceder con .get()
    tx_dict: Dict[str, Any]
    if isinstance(tx, dict):
        tx_dict = tx
    else:
        # Intentar parsear si es JSON-string
        if isinstance(tx, str):
            try:
                parsed = json.loads(tx)
                if isinstance(parsed, dict):
                    tx_dict = parsed
                else:
                    tx_dict = {"raw": parsed}
            except Exception:
                # No es JSON válido; enviar como valor crudo
                tx_dict = {"raw": tx}
        else:
            # Intentar construir dict desde objeto (pandas.Series u otros)
            try:
                tx_dict = dict(tx)
            except Exception:
                tx_dict = {"raw": str(tx)}

    # Extraer información del registro desde tx_dict
    ml_info = {
        "clasificacion_ml": tx_dict.get("clasificacion_ml", tx_dict.get("clasificacion")),
        "probabilidades": tx_dict.get("probabilidades", {}),
        "ica": tx_dict.get("ica", 0.0),
        "thresholds": {},
    }
    
    ebr_info = {
        "score_ebr": tx_dict.get("score_ebr", 0.0),
        "nivel_riesgo_ebr": tx_dict.get("nivel_riesgo_ebr", "bajo"),
        "clasificacion_ebr": tx_dict.get("clasificacion_ebr", "relevante"),
        "factores": tx_dict.get("factores_ebr", []),
    }
    
    # Configuración por defecto
    lfpi_cfg = {}
    uma_cfg = {
        "uma_mxn": 108.57,
        "umbral_relevante_umas": 325,
        "umbral_preocupante_umas": 650,
    }
    
    clasificacion_final = tx_dict.get("clasificacion_final", tx_dict.get("clasificacion"))
    # Mapear clasificación a nivel de riesgo (real) respetando convención del frontend
    nivel_riesgo_map = {"relevante": "bajo", "inusual": "medio", "preocupante": "alto"}
    nivel_riesgo_final = nivel_riesgo_map.get(str(clasificacion_final).lower(), tx_dict.get("nivel_riesgo_final", "bajo"))
    triggers = tx_dict.get("triggers", [])

    explicacion = build_explicacion(
        row=tx_dict,
        ml_info=ml_info,
        ebr_info=ebr_info,
        lfpi_cfg=lfpi_cfg,
        uma_cfg=uma_cfg,
        clasificacion_final=clasificacion_final,
        nivel_riesgo_final=nivel_riesgo_final,
        triggers=triggers,
    )

    # Reemplazar/añadir razones específicas si es posible
    try:
        razones_especificas = _generar_razones_especificas(tx)
        if razones_especificas:
            explicacion["razones_principales"] = razones_especificas
    except Exception:
        pass

    # Asegurar que `fundamento_legal` esté presente en la explicación (usar raíz si existe)
    if tx_dict.get("fundamento_legal"):
        explicacion["fundamento_legal"] = tx_dict.get("fundamento_legal")

    return explicacion
