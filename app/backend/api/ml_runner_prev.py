#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - Versión productiva (PENDING_DIR + bundle supervisado)

- Procesa archivos CSV enriquecidos ubicados en:
    outputs/enriched/pending/<analysis_id>.csv
- Usa el bundle del modelo supervisado entrenado
  (outputs/modelo_ensemble_stack.pkl)
- Genera:
    outputs/enriched/processed/<analysis_id>.csv
    outputs/enriched/processed/<analysis_id>.json
    outputs/enriched/processed/<analysis_id>_metadata.json

Se integra con FastAPI llamando:

    import numpy as np
    python ml_runner.py <analysis_id>

Si no se pasa `analysis_id`, procesa todos los CSV en `pending/`.
"""

import os
import sys
import json
import shutil
import traceback
from pathlib import Path
from datetime import datetime

# BASE_DIR debe estar definido antes de NS_BUNDLE_PATH
BASE_DIR = Path(__file__).parent.parent  # .../app/backend
NS_BUNDLE_PATH = BASE_DIR / "outputs" / "no_supervisado_bundle.pkl"
from collections import Counter
from typing import Optional, Dict, Any

import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler

# Control de verbosidad: desactivar logs por transacción para evitar saturar la consola
VERBOSE = False

# -----------------------------------------------------------------------------
# Paths base
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.parent  # .../app/backend
PENDING_DIR = BASE_DIR / "outputs" / "enriched" / "pending"
PROCESSED_DIR = BASE_DIR / "outputs" / "enriched" / "processed"
FAILED_DIR = BASE_DIR / "outputs" / "enriched" / "failed"
MODEL_BUNDLE_PATH = BASE_DIR / "outputs" / "modelo_ensemble_stack.pkl"

for d in (PENDING_DIR, PROCESSED_DIR, FAILED_DIR):
    d.mkdir(parents=True, exist_ok=True)


# =============================================================================
# ✅ CONFIGURACIÓN LFPIORPI Y UMAS - Carga desde config_modelos.json
# =============================================================================

def cargar_configuracion_lfpiorpi():
    """Carga configuración LFPIORPI desde config_modelos.json"""
    config_path = BASE_DIR / "models" / "config_modelos.json"

    # No se usan valores por defecto: el archivo `config_modelos.json` es la fuente
    if not config_path.exists():
        raise RuntimeError(f"config_modelos.json no encontrado en {config_path}; el runner requiere este archivo y no debe usar valores por defecto.")

    with open(config_path, "r", encoding="utf-8") as f:
        cfg_all = json.load(f)

    if not isinstance(cfg_all, dict):
        raise RuntimeError("Formato inválido en config_modelos.json: se esperaba un objeto JSON en la raíz.")

    lfp = cfg_all.get("lfpiorpi", {}) or {}
    normativa = cfg_all.get("normativa", {}) or {}

    # UMA: preferimos lfpiorpi.uma_diaria, luego lfpiorpi.uma_mxn, luego normativa.uma_mxn
    uma = None
    if isinstance(lfp, dict):
        if "uma_diaria" in lfp:
            uma = lfp.get("uma_diaria")
        elif "uma_mxn" in lfp:
            uma = lfp.get("uma_mxn")

    if uma is None and isinstance(normativa, dict):
        uma = normativa.get("uma_mxn") or normativa.get("uma_diaria")

    if uma is None:
        raise RuntimeError(
            "Falta el valor de la UMA en config_modelos.json. Se esperaba 'lfpiorpi.uma_diaria' o 'normativa.uma_mxn'."
        )

    # Umbrales: preferimos lfpiorpi.umbrales (formato por fracción), si no, intentamos construir desde normativa
    umbrales = {}
    if isinstance(lfp, dict) and isinstance(lfp.get("umbrales"), dict):
        umbrales = lfp.get("umbrales")
    else:
        aviso = normativa.get("fracciones_umbral_aviso_mxn", {}) or {}
        efectivo = normativa.get("fracciones_limite_efectivo_mxn", {}) or {}
        if aviso or efectivo:
            # Interpretamos estos valores como conteos de UMAs en la configuración
            for k, v in aviso.items():
                if k not in umbrales:
                    umbrales[k] = {}
                umbrales[k]["aviso_UMA"] = int(v)
            for k, v in efectivo.items():
                if k not in umbrales:
                    umbrales[k] = {}
                umbrales[k]["efectivo_max_UMA"] = int(v)

    if not umbrales:
        raise RuntimeError(
            "Faltan umbrales en config_modelos.json. Se esperaba 'lfpiorpi.umbrales' o las fracciones en 'normativa'."
        )

    return {"uma_mxn": float(uma), "umbrales": umbrales, "actividad_a_fraccion": lfp.get("actividad_a_fraccion", {})}


# Cargar configuración al inicio
LFPI_CONFIG = cargar_configuracion_lfpiorpi()
UMA_MXN = float(LFPI_CONFIG["uma_mxn"])

# Helper de normalización de explicaciones: garantiza esquema y añade detalles UMA
def _normalize_explicacion(exp_short: dict | None, exp_enriched: dict | None, registro: dict) -> dict:
    base = {}
    if isinstance(exp_enriched, dict) and exp_enriched:
        base.update(exp_enriched)
    elif isinstance(exp_short, dict) and exp_short:
        base.update(exp_short)

    # Campos principales normalizados
    base["explicacion_principal"] = base.get("explicacion_principal") or base.get("resumen_ejecutivo") or base.get("resumen") or ""
    base["explicacion_detallada"] = base.get("explicacion_detallada") or base.get("detallada") or base.get("explicacion_modelo") or base.get("explicacion_ebr") or ""

    # Añadir detalles de UMA: monto -> UMAs, UMA usada y umbrales por fracción (UMAs y MXN)
    try:
        monto = float(registro.get("monto", 0.0) or 0.0)
    except Exception:
        monto = 0.0

    umas_operacion = mxn_a_umas(monto)

    fraccion = registro.get("fraccion") or LFPI_CONFIG.get("actividad_a_fraccion", {}).get(str(registro.get("sector_actividad", "")).lower())

    detalles = base.get("detalles_tecnicos") or {}
    detalles["uma_mxn"] = UMA_MXN
    detalles["umas_operacion"] = round(umas_operacion, 3)
    detalles["fraccion_aplicada"] = fraccion

    # Umbrales en UMAs y en MXN para referencia en la explicación
    umbrales_umas = LFPI_CONFIG.get("umbrales", {})
    detalles["umbrales_umas"] = umbrales_umas

    umbrales_mxn = {}
    for k, v in umbrales_umas.items():
        sub = {}
        if isinstance(v, dict):
            for sk, sv in v.items():
                try:
                    sub[sk] = float(sv) * UMA_MXN
                except Exception:
                    sub[sk] = None
        umbrales_mxn[k] = sub

    detalles["umbrales_mxn"] = umbrales_mxn
    base["detalles_tecnicos"] = detalles

    return base


def generar_explicacion_detallada(registro: dict) -> str:
    """Genera explicación útil con datos específicos"""
    clasificacion = registro.get('clasificacion', '')
    score_ebr = float(registro.get('score_ebr', 0) or 0)
    ica = float(registro.get('ica', 0) or 0)
    monto = float(registro.get('monto', 0) or 0)
    sector = registro.get('sector_actividad', '') or ''
    razones = registro.get('razones') or []

    texto = f"Clasificación: {str(clasificacion).upper()}\n\n"
    texto += f"Análisis EBR: Score de {score_ebr:.1f}/100. "
    if score_ebr > 65:
        texto += "Nivel alto de riesgo detectado por múltiples factores. "
    elif score_ebr > 50:
        texto += "Nivel medio de riesgo que requiere validación. "
    else:
        texto += "Nivel bajo de riesgo, dentro de parámetros normales. "

    if razones:
        texto += f"\n\nFactores identificados:\n"
        for i, razon in enumerate(razones, 1):
            texto += f"{i}. {razon}\n"

    if clasificacion == 'preocupante':
        texto += "\n\nACCIÓN REQUERIDA: Generar ROP para UIF en 24h."
    elif clasificacion == 'inusual':
        texto += "\n\nACCIÓN SUGERIDA: Revisar y documentar análisis."
    else:
        texto += "\n\nNo requiere acción adicional."

    return texto


def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


log(f"✅ Config LFPIORPI cargada: UMA=${UMA_MXN} MXN | Umbrales cargados: {len(LFPI_CONFIG.get('umbrales', {}))} fracciones")


# =============================================================================
# FUNCIONES HELPER - Trabajar en UMAs internamente
# =============================================================================

def mxn_a_umas(monto_mxn: float) -> float:
    """Convierte MXN a UMAs."""
    return monto_mxn / UMA_MXN if UMA_MXN > 0 else 0.0

def umas_a_mxn(umas: float) -> float:
    """Convierte UMAs a MXN."""
    return umas * UMA_MXN

def verificar_umbral_lfpiorpi(monto_mxn: float, es_efectivo: bool = False, fraccion: str | None = None, sector_actividad: str | None = None) -> tuple[bool, str, float]:
    """
    Verifica si un monto rebasa umbrales LFPIORPI usando los umbrales definidos en `config_modelos.json`.

    Parámetros:
      - monto_mxn: monto de la transacción en MXN
      - es_efectivo: si la transacción es en efectivo
      - fraccion: (opcional) clave de fracción (ej. 'V_inmuebles')
      - sector_actividad: (opcional) nombre de actividad para mapear a fracción

    Returns:
        (rebasa_umbral: bool, razon: str, umas_operacion: float)
    """
    umas = mxn_a_umas(monto_mxn)

    # Determinar fracción si no fue provista
    if not fraccion and sector_actividad:
        try:
            sec = str(sector_actividad).lower()
        except Exception:
            sec = str(sector_actividad)
        fraccion = LFPI_CONFIG.get("actividad_a_fraccion", {}).get(sec) or fraccion

    # Buscar umbrales aplicables para la fracción
    umbrales = LFPI_CONFIG.get("umbrales", {})
    if fraccion and isinstance(umbrales, dict) and fraccion in umbrales:
        u = umbrales.get(fraccion, {}) or {}
        aviso = u.get("aviso_UMA") or u.get("aviso_uma")
        efectivo_um = u.get("efectivo_max_UMA") or u.get("efectivo_umas") or u.get("efectivo_max_uma")

        if es_efectivo and efectivo_um is not None:
            try:
                if umas >= float(efectivo_um):
                    return True, f"Efectivo rebasa {efectivo_um} UMAs (fracción {fraccion})", umas
            except Exception:
                pass

        if aviso is not None:
            try:
                if umas >= float(aviso):
                    return True, f"Rebasa umbral de aviso {aviso} UMAs (fracción {fraccion})", umas
            except Exception:
                pass

        return False, "", umas
# -----------------------------------------------------------------------------
# Logging helper
# -----------------------------------------------------------------------------
def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# -----------------------------------------------------------------------------
# Explicador
# -----------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent))
# ✅ Importar explicabilidad MEJORADA (con top 3 razones + fundamento legal)
from explicabilidad_transactions import (
    build_explicacion,
    generar_explicacion_transaccion,
)  # noqa: E402

# Inyectar la configuración LFPI/UMA en el módulo del explicador para evitar KeyError
try:
    import explicabilidad_transactions as explic_mod  # type: ignore

    if not isinstance(getattr(explic_mod, "_LFPI_CONFIG", None), dict):
        explic_mod._LFPI_CONFIG = {}

    # Normalizar la clave de UMA esperada por el explicador
    if "uma_mxn" not in explic_mod._LFPI_CONFIG:
        if "uma_diaria" in explic_mod._LFPI_CONFIG:
            explic_mod._LFPI_CONFIG["uma_mxn"] = explic_mod._LFPI_CONFIG.get("uma_diaria")
        else:
            explic_mod._LFPI_CONFIG["uma_mxn"] = LFPI_CONFIG.get("uma_mxn", UMA_MXN)

    # Garantizar que existan umbrales en la configuración del módulo
    # Solo sobrescribimos `umbrales` en el módulo explicador si la configuración
    # cargada en `LFPI_CONFIG` contiene las claves planas que el explicador espera
    # (ej. 'relevante_umas', 'preocupante_umas'). Si no, dejamos los valores por
    # defecto del explicador para evitar KeyError sobre claves faltantes.
    lfpi_umbrales = LFPI_CONFIG.get("umbrales", {})
    if isinstance(lfpi_umbrales, dict) and (
        "relevante_umas" in lfpi_umbrales or "preocupante_umas" in lfpi_umbrales
    ):
        explic_mod._LFPI_CONFIG["umbrales"] = lfpi_umbrales
except Exception:
    # No bloquear el runner si la inyección falla; el explicador tiene sus propios valores por defecto
    pass


class TransactionExplainer:
    """Pequeño adaptador para compatibilidad con el runner.

    El paquete original exponía una clase con método `explicar_transaccion`.
    Aquí delegamos en la función moderna `generar_explicacion_transaccion`
    y transformamos su salida al formato esperado por el resto del script.
    """

    def explicar_transaccion(self, tx, score_ebr=None, triggers=None, origen=None, proba_ml=None):
        # Asegurar que el explicador reciba un dict con claves mínimas esperadas
        try:
            if hasattr(tx, "to_dict"):
                tx_dict = tx.to_dict()
            else:
                tx_dict = dict(tx) if isinstance(tx, dict) else dict(tx)
        except Exception:
            tx_dict = {}

        # Garantizar clasificación disponible para el explicador
        if not tx_dict.get("clasificacion_final"):
            # Preferir campo 'clasificacion' si existe
            tx_dict["clasificacion_final"] = tx_dict.get("clasificacion") or None

        # Si aún no hay clasificación, inferir desde probabilidades ML si se proporcionaron
        if not tx_dict.get("clasificacion_final") and isinstance(proba_ml, dict) and proba_ml:
            try:
                # elegir la clase con mayor probabilidad
                inferred = max(proba_ml.items(), key=lambda kv: float(kv[1]))[0]
                tx_dict["clasificacion_final"] = inferred
            except Exception:
                tx_dict["clasificacion_final"] = None

        # Asegurar score_ebr y probabilidades en el objeto que recibe el explicador
        if score_ebr is not None:
            tx_dict["score_ebr"] = score_ebr
        if isinstance(proba_ml, dict) and proba_ml:
            tx_dict["probabilidades"] = proba_ml

        expl = generar_explicacion_transaccion(tx_dict)

        # Detectar campos en ambos formatos (legacy y nuevo)
        # ICA: preferir 'ica', luego 'ica_numerico', luego detalles_tecnicos.ml.ica
        ica_val = None
        try:
            if isinstance(expl, dict):
                if expl.get("ica") is not None:
                    ica_val = float(expl.get("ica"))
                elif expl.get("ica_numerico") is not None:
                    ica_val = float(expl.get("ica_numerico"))
                else:
                    dt = expl.get("detalles_tecnicos", {}) or {}
                    ml_dt = dt.get("ml", {}) if isinstance(dt, dict) else {}
                    if ml_dt and ml_dt.get("ica") is not None:
                        ica_val = float(ml_dt.get("ica"))
            if ica_val is not None and ica_val > 1.0:
                ica_val = ica_val / 100.0
        except Exception:
            ica_val = None

        # Factores / razones: aceptar 'factores_clave' o 'razones_principales' o detalles_tecnicos.ebr.factores_completos
        factores = []
        if isinstance(expl, dict):
            if expl.get("factores_clave"):
                factores = expl.get("factores_clave") or []
            elif expl.get("razones_principales"):
                factores = expl.get("razones_principales") or []
            else:
                dt = expl.get("detalles_tecnicos", {}) or {}
                ebr_dt = dt.get("ebr", {}) if isinstance(dt, dict) else {}
                factores = ebr_dt.get("factores_completos") or ebr_dt.get("factores") or []

        # Fundamento
        fundamento = ""
        if isinstance(expl, dict):
            fundamento = expl.get("fundamento_legal") or expl.get("contexto_regulatorio") or ""

        # Explicacion principal preferida
        principal = ""
        if isinstance(expl, dict):
            principal = expl.get("resumen_ejecutivo") or expl.get("resumen") or expl.get("explicacion_principal") or ""
        if not principal and factores:
            # usar primer factor como principal si no hay resumen
            principal = str(factores[0]) if factores else ""

        # Explicacion detallada
        explicacion_detallada = ""
        if isinstance(expl, dict):
            explicacion_detallada = (
                expl.get("detallada")
                or expl.get("explicacion_detallada")
                or expl.get("explicacion_modelo")
                or expl.get("explicacion_ebr")
                or fundamento
                or ""
            )

        meta = {
            "score_ebr": (expl.get("score_ebr") if isinstance(expl, dict) else None) or score_ebr,
            "ica": ica_val,
            "clasificacion": (expl.get("clasificacion_final") if isinstance(expl, dict) else None) or (expl.get("clasificacion") if isinstance(expl, dict) else None),
            "origen": origen,
            "origen_clasificacion": origen,
            "explicacion_principal": principal,
            "explicacion_detallada": explicacion_detallada,
            "razon_principal": None,
            "razones": factores,
            "factores_riesgo": factores,
            "flags": (expl.get("flags") if isinstance(expl, dict) else {}) or {},
            "contexto_regulatorio": fundamento,
            "acciones_sugeridas": (expl.get("acciones_sugeridas") if isinstance(expl, dict) else []) or [],
            "recomendaciones": (expl.get("recomendaciones") if isinstance(expl, dict) else []) or [],
            "contexto": (expl.get("contexto") if isinstance(expl, dict) else {}) or {},
            "requiere_revision_urgente": (expl.get("requiere_revision_urgente") if isinstance(expl, dict) else False) or False,
            "triggers": triggers or (expl.get("triggers") if isinstance(expl, dict) else []) or [],
        }

        return meta


def calcular_score_ebr_simple(tx) -> tuple[float, list]:
    """Score EBR simplificado (solo para runner) y lista de factores que lo detonaron.

    Retorna: (score, factores_list)
    """
    score = 0.0
    factores: list[str] = []
    try:
        monto = float(tx.get("monto", 0.0) or 0.0)
    except Exception:
        monto = 0.0

    # UmAs calculadas si no vienen
    try:
        umas = float(tx.get("umas")) if tx.get("umas") is not None else mxn_a_umas(monto)
    except Exception:
        umas = mxn_a_umas(monto)

    # Factor: monto absoluto
    if monto > 1_000_000:
        score += 40
        factores.append(f"Monto alto: ${monto:,.0f} MXN ({umas:.0f} UMAs)")
    elif monto > 100_000:
        score += 25
        factores.append(f"Monto alto: ${monto:,.0f} MXN ({umas:.0f} UMAs)")
    elif monto > 10_000:
        score += 5
        factores.append(f"Monto elevado: ${monto:,.0f} MXN")
    elif monto > 1_000:
        score += 1

    sector = str(tx.get("sector_actividad", "")).lower()
    sectores_alto_riesgo = {
        "activos_virtuales": "LFPIORPI Art. 17 Fracc. ?",
        "joyeria_metales": "LFPIORPI Art. 17 Fracc. XI",
        "casa_cambio": "LFPIORPI Art. 17 Fracc. I",
        "transmision_dinero": "LFPIORPI Art. 17 Fracc. ?",
        "traslado_valores": "LFPIORPI Art. 17 Fracc. ?",
    }
    if sector in sectores_alto_riesgo:
        score += 15
        codigo = sectores_alto_riesgo.get(sector)
        if codigo:
            factores.append(f"Sector riesgoso: {sector} ({codigo} - actividad vulnerable)")
        else:
            factores.append(f"Sector riesgoso: {sector}")

    tipo = str(tx.get("tipo_operacion", "")).lower()
    es_efectivo = int(tx.get('EsEfectivo', 0)) == 1 or ("efectivo" in tipo)
    if es_efectivo:
        score += 15
        factores.append(
            f"Operación en efectivo: ${monto:,.0f} MXN (LFPIORPI Art. 32 - declaración obligatoria si aplica)"
        )

    # Acumulado 6 meses
    try:
        monto_6m = float(tx.get('monto_6m', 0) or 0)
    except Exception:
        monto_6m = 0.0
    if monto_6m >= 500_000:
        score += 15
        factores.append(f"Acumulado 6m: ${monto_6m:,.0f} MXN (supera umbral $500k para monitoreo reforzado)")

    # Internacional
    try:
        es_int = int(tx.get('EsInternacional', 0)) == 1
    except Exception:
        es_int = False
    if es_int:
        score += 10
        factores.append("Operación internacional (mayor escrutinio por riesgo cambiario)")

    # Horario / patrón
    try:
        es_nocturno = int(tx.get('es_nocturno', 0)) == 1
    except Exception:
        es_nocturno = False
    if es_nocturno:
        score += 5
        factores.append("Operación nocturna (horario inusual)")

    try:
        fin_semana = int(tx.get('fin_de_semana', 0)) == 1
    except Exception:
        fin_semana = False
    if fin_semana:
        score += 5
        factores.append("Operación en fin de semana (patrón atípico)")

    # Limitar a top 3 factores (los primeros detectados)
    factores = factores[:3]

    score = float(max(0.0, min(100.0, score)))
    return score, factores


def bucket_ebr(score_ebr: float | None) -> tuple[str | None, str | None]:
    if score_ebr is None:
        return None, None
    # Nuevos umbrales solicitados:
    # score <= 51 -> Riesgo Bajo / Relevante
    # 51 < score <= 65 -> Riesgo Medio / Inusual
    # score > 65 -> Riesgo Alto / Preocupante
    try:
        s = float(score_ebr)
    except Exception:
        return None, None

    if s <= 51:
        return "bajo", "relevante"
    elif s <= 65:
        return "medio", "inusual"
    else:
        return "alto", "preocupante"


def fusionar_ml_con_ebr_suave(
    ml_label: str,
    score_ebr: float | None,
    tx_row: dict | None = None,
) -> dict:
    """
    NO reetiqueta por defecto. 
    Solo:
      - calcula nivel_riesgo_ebr / ebr_label,
      - marca discrepancias,
      - permite override solo en casos extremos.
    """
    nivel_riesgo_ebr, ebr_label = bucket_ebr(score_ebr)

    result = {
        "final_label": ml_label,             # el modelo manda
        "nivel_riesgo_ebr": nivel_riesgo_ebr,
        "ebr_label": ebr_label,
        "requiere_revision_manual": False,
        "sugerir_reclasificacion": False,
        "motivo_reclasificacion": None,
    }

    if ebr_label is None:
        return result

    # Orden de gravedad para comparar
    orden = {"relevante": 0, "inusual": 1, "preocupante": 2}
    ml_nivel = orden.get(ml_label, 0)
    ebr_nivel = orden.get(ebr_label, 0)

    # Caso 1: coinciden → perfecto, no hacemos ruido
    if ml_nivel == ebr_nivel:
        return result

    # Caso 2: EBR ve MÁS riesgo que el modelo
    if ebr_nivel > ml_nivel:
        result["requiere_revision_manual"] = True

        # Guardrails: solo en condiciones explícitas elevamos a 'preocupante'.
        # Regla conservadora:
        #  - si el score_ebr >= 90 -> preocuparte
        #  - o si el monto en tx_row >= 1_000_000 -> preocuparte
        #  - o si es efectivo internacional con monto alto -> preocuparte
        guardrail_triggered = False
        try:
            s = float(score_ebr or 0.0)
        except Exception:
            s = 0.0

        if s >= 90:
            guardrail_triggered = True

        if not guardrail_triggered and tx_row is not None:
            try:
                monto_tx = float(tx_row.get("monto", 0.0) or 0.0)
            except Exception:
                monto_tx = 0.0

            es_efectivo = tx_row.get("EsEfectivo") in (1, True, "1", "True", "true") or (
                str(tx_row.get("tipo_operacion", "")).lower().find("efectivo") >= 0
            )
            es_internacional = tx_row.get("EsInternacional") in (1, True, "1", "True", "true")
            # ✅ Guardrails LFPIORPI oficiales - Trabajar en UMAs
            # Determinar fracción aplicable desde la tx (o desde el mapping en la config)
            fr = None
            try:
                if tx_row is not None:
                    fr = tx_row.get("fraccion") or LFPI_CONFIG.get("actividad_a_fraccion", {}).get(str(tx_row.get("sector_actividad", "")).lower())
            except Exception:
                fr = None

            rebasa, razon_guardrail, umas_tx = verificar_umbral_lfpiorpi(monto_tx, es_efectivo, fraccion=fr)
            if rebasa:
                guardrail_triggered = True
                if VERBOSE:
                    log(f"      🛡️ Guardrail: {razon_guardrail} ({umas_tx:.1f} UMAs = ${monto_tx:,.2f} MXN)")

        # Aplicar override solo si guardrail se activó y EBR es 'preocupante'
        if guardrail_triggered and etiqueta_ml == "relevante" and ebr_label == "preocupante":
            result["final_label"] = "preocupante"
            result["sugerir_reclasificacion"] = True
            result["motivo_reclasificacion"] = (
                "Guardrail activado: combinación de EBR y condiciones transaccionales que requieren elevación a 'preocupante'."
            )
        else:
            # No reetiquetamos automáticamente aquí; el manejo fino lo hace fusionar_riesgos
            result["motivo_reclasificacion"] = (
                f"EBR ({ebr_label}) indica mayor riesgo que el modelo ({etiqueta_ml}); "
                "se mantiene la etiqueta del modelo pero se requiere revisión manual."
            )

    # Caso 3: el modelo ve MÁS riesgo que el EBR
    else:
        # Conservador: respetamos al modelo, pero marcamos discrepancia
        result["requiere_revision_manual"] = True
        result["motivo_reclasificacion"] = (
            f"El modelo clasifica como {ml_label} mientras que el EBR sugiere {ebr_label}; "
            "se mantiene la etiqueta del modelo por enfoque conservador."
        )

    return result


# Nuevo cálculo de ICA y mapeos solicitados
RISK_ORDER = {"relevante": 0, "inusual": 1, "preocupante": 2}


def calcular_ica(prob_relevante: float, prob_inusual: float, prob_preocupante: float) -> float:
    """
    ICA = Índice de Certeza Algorítmica (max de las probabilidades).
    Devuelve solo el valor numérico (float) en rango 0..1.
    """
    try:
        ica = float(max(prob_relevante or 0.0, prob_inusual or 0.0, prob_preocupante or 0.0))
    except Exception:
        ica = 0.0

    # Asegurar límites
    if ica < 0.0:
        ica = 0.0
    if ica > 1.0:
        ica = 1.0

    return ica


def nivel_riesgo_desde_etiqueta(etiqueta: str) -> str:
    """
    Mapea la etiqueta LFPIORPI a nivel de riesgo textual.
    """
    mapping = {
        "relevante": "bajo",
        "inusual": "medio",
        "preocupante": "alto",
    }
    return mapping.get(etiqueta, "no_disponible")


# -----------------------------------------------------------------------------
# Construir transacción limpia (estructura reducida para la UI)
# -----------------------------------------------------------------------------
def construir_transaccion_limpia(row, pred, probs, explic, classes):
    try:
        umas = mxn_a_umas(float(row.get('monto', 0)))
    except Exception:
        umas = 0.0

    try:
        ica = float(np.max(probs))
    except Exception:
        ica = 0.0

    try:
        score_ebr = float(row.get('score_ebr', 0))
    except Exception:
        score_ebr = 0.0

    clasificacion = (explic.get('clasificacion') if isinstance(explic, dict) else None) or pred
    nivel_riesgo = {"relevante": "bajo", "inusual": "medio", "preocupante": "alto"}.get(clasificacion, "bajo")

    guardrail_aplicado = bool(row.get('guardrail_aplicado', False))
    guardrail_razon = row.get('guardrail_razon')

    # Priorizar factores EBR calculados directamente sobre razones genéricas del explicador
    factores_ebr_row = row.get('factores_ebr') if row is not None else None
    razones = []
    if factores_ebr_row:
        # Asegurar que sea lista y limitar a 3
        try:
            razones = list(factores_ebr_row)[:3]
        except Exception:
            razones = []
    else:
        if isinstance(explic, dict):
            razones = explic.get('razones') or explic.get('razones_principales') or []
        if not razones:
            razones = [
                f"Score EBR: {score_ebr:.1f}/100",
                f"Confianza ML (ICA): {ica:.2%}",
                "Requiere revisión según criterios",
            ]
        razones = razones[:3]

    fundamento = ""
    if isinstance(explic, dict):
        fundamento = explic.get('contexto_regulatorio') or explic.get('fundamento_legal') or ''

    # Normalizar fundamento: preferir None en lugar de cadena vacía
    fundamento = fundamento or None

    # Representación legible del nivel de riesgo
    nivel_display_map = {"bajo": "Bajo", "medio": "Medio", "alto": "Alto"}
    nivel_riesgo_display = nivel_display_map.get(nivel_riesgo, nivel_riesgo.capitalize())

    # ICA en porcentaje (útil para la UI) además del valor 0..1
    try:
        ica_percent = round(float(ica) * 100.0, 2)
    except Exception:
        ica_percent = None

    detalle_tecnico = {
        "ml": {
            "etiqueta": pred,
            "probabilidades": {classes[j]: float(probs[j]) for j in range(len(classes))},
        },
        "ebr": {
            "score": float(score_ebr),
            "clasificacion": bucket_ebr(float(row.get('score_ebr', 0)))[1] if 'score_ebr' in row else None,
        },
        "anomalias": None,
    }

    if 'anomaly_score_composite' in row or 'is_outlier_iso' in row:
        detalle_tecnico['anomalias'] = {
            "score": float(row.get('anomaly_score_composite', 0)),
            "is_outlier": bool(row.get('is_outlier_iso', False)),
        }

    # Construir fundamento legal estructurado si falta información en 'explic'
    fr = row.get('fraccion') or LFPI_CONFIG.get('actividad_a_fraccion', {}).get(str(row.get('sector_actividad', '')).lower())
    try:
        monto_mxn = float(row.get('monto', 0) or 0)
    except Exception:
        monto_mxn = 0.0
    umas_oper = mxn_a_umas(monto_mxn)

    umbrales_fr = LFPI_CONFIG.get('umbrales', {}) or {}
    umbrales_for_fr = umbrales_fr.get(fr, {}) if fr and isinstance(umbrales_fr, dict) else {}
    # Buscar un umbral representativo (preferir efectivo_max_UMA, luego aviso_UMA)
    threshold_uma = None
    if isinstance(umbrales_for_fr, dict):
        threshold_uma = umbrales_for_fr.get('efectivo_max_UMA') or umbrales_for_fr.get('efectivo_umas') or umbrales_for_fr.get('aviso_UMA') or umbrales_for_fr.get('aviso_uma')
        try:
            threshold_uma = float(threshold_uma) if threshold_uma is not None else None
        except Exception:
            threshold_uma = None

    umas_rebasadas = None
    if threshold_uma is not None:
        umas_rebasadas = round(max(0.0, umas_oper - float(threshold_uma)), 3)

    fundamento_struct = {
        'articulo': None,
        'fraccion': fr,
        'umas_operacion': round(umas_oper, 3),
        'uma_mxn': UMA_MXN,
        'umbral_uma': threshold_uma,
        'umas_rebasadas': umas_rebasadas,
        'texto': None,
    }

    # Rellenar desde explic si existe
    if isinstance(explic, dict):
        # expl puede traer 'fundamento_legal' como texto o estructura
        expl_fund = explic.get('fundamento_legal') or explic.get('contexto_regulatorio')
        if expl_fund:
            fundamento_struct['texto'] = expl_fund
            # si expl_fund es dict, extraer articulo
            if isinstance(expl_fund, dict):
                fundamento_struct['articulo'] = expl_fund.get('articulo') or fundamento_struct['articulo']
    # Si no hay texto de explicador, construir texto mínimo basado en umbrales
    if fundamento_struct['texto'] is None:
        if clasificacion == 'relevante' and fundamento_struct.get('articulo'):
            fundamento_struct['texto'] = f"Con fundamento en el artículo {fundamento_struct['articulo']} de la LFPiorpi, esta transacción se clasifica como relevante ya que el ML no detectó anomalías."
        elif threshold_uma is not None:
            fundamento_struct['texto'] = (
                f"Fracción {fr}: la operación equivale a {fundamento_struct['umas_operacion']:.2f} UMAs; umbral relevante={threshold_uma} UMAs; UMA utilizada=${UMA_MXN:.2f} MXN."
            )
        else:
            fundamento_struct['texto'] = None

    # Asignar al campo fundamento_legal legible y estructurado
    fundamento_text = fundamento_struct['texto'] if fundamento_struct['texto'] is not None else fundamento

    # Construir explicación legible final basada en la clasificación final (evita inconsistencias
    # entre lo que devuelve el explicador y la fusión de riesgos).
    tipo_op = row.get('tipo_operacion') or ''
    sector = row.get('sector_actividad') or ''
    try:
        display_monto = f"${float(monto_mxn):,.2f}"
    except Exception:
        display_monto = f"${row.get('monto', 0)}"

    explicacion_principal_final = (
        f"Operación de {display_monto} MXN clasificada como '{str(clasificacion).upper()}' "
        f"(Nivel de riesgo: {nivel_riesgo_display}). Tipo: {tipo_op} | Sector: {sector}"
    )

    explicacion_detallada_final = (
        f"El modelo de machine learning asignó la clasificación '{pred}' con un Índice de Coherencia "
        f"Algorítmica (ICA) de {ica_percent:.2f}%. Score EBR: {score_ebr:.1f}/100."
    )
    # continuar construcción del registro (se realiza más abajo)


def fusionar_riesgos(
    etiqueta_ml: str,
    ica_valor: float,
    ebr_score: float | None,
    ebr_clasificacion: str | None,
    ebr_nivel_riesgo: str | None,
    tx_row: dict | None = None,
):
    """
    Fusiona ML y EBR y devuelve un dict con la clasificación final y metadatos.
    """
    risk_rank = {"relevante": 0, "inusual": 1, "preocupante": 2}

    # Valores base = modelo supervisado
    clas_final = etiqueta_ml
    fuente = "modelo_supervisado"
    requiere_revision = False
    sugerir_reclasificacion = False
    motivo = None

    # Si no viene EBR, nos quedamos con ML
    if not ebr_clasificacion:
        return {
            "clasificacion_final": clas_final,
            "nivel_riesgo_final": nivel_riesgo_desde_etiqueta(clas_final),
            "indice_confianza_final": float(ica_valor),
            "fuente_predominante": fuente,
            "requiere_revision_manual": requiere_revision,
            "sugerir_reclasificacion": sugerir_reclasificacion,
            "motivo_revision": motivo,
        }

    ml_rank = risk_rank.get(etiqueta_ml, 0)
    ebr_rank = risk_rank.get(ebr_clasificacion, 0)

    # PRIORIDAD 1: Guardrails - si se activa un umbral LFPIORPI devolvemos 'preocupante' inmediatamente
    try:
        if tx_row is not None:
            monto_tx = float(tx_row.get("monto", 0.0) or 0.0)
            es_efectivo = tx_row.get("EsEfectivo") in (1, True, "1", "True", "true") or (
                str(tx_row.get("tipo_operacion", "")).lower().find("efectivo") >= 0
            )
            fr = tx_row.get("fraccion") or LFPI_CONFIG.get("actividad_a_fraccion", {}).get(
                str(tx_row.get("sector_actividad", "")).lower()
            )
            rebasa, razon_guardrail, umas_tx = verificar_umbral_lfpiorpi(monto_tx, es_efectivo, fraccion=fr)
            if rebasa:
                return {
                    "clasificacion_final": "preocupante",
                    "nivel_riesgo_final": nivel_riesgo_desde_etiqueta("preocupante"),
                    "indice_confianza_final": float(ica_valor),
                    "fuente_predominante": "guardrail",
                    "requiere_revision_manual": True,
                    "sugerir_reclasificacion": True,
                    "motivo_revision": f"Guardrail activado: {razon_guardrail}",
                }
    except Exception:
        # No bloquear por errores en la comprobación de guardrails
        pass

    # PRIORIDAD 2: Si coinciden ML y EBR -> consenso
    if ml_rank == ebr_rank:
        return {
            "clasificacion_final": etiqueta_ml,
            "nivel_riesgo_final": nivel_riesgo_desde_etiqueta(etiqueta_ml),
            "indice_confianza_final": float(ica_valor),
            "fuente_predominante": "consistente",
            "requiere_revision_manual": False,
            "sugerir_reclasificacion": False,
            "motivo_revision": None,
        }

    # PRIORIDAD 3: Si EBR es más restrictivo -> adoptamos la clasificación EBR
    if ebr_rank > ml_rank:
        clas_final = ebr_clasificacion
        fuente = "matriz_ebr"
        requiere_revision = True
        sugerir_reclasificacion = True
        motivo = (
            f"La matriz EBR sugiere mayor riesgo ({ebr_clasificacion}) que el modelo ({etiqueta_ml}); adoptando clasificación EBR."
        )
        return {
            "clasificacion_final": clas_final,
            "nivel_riesgo_final": nivel_riesgo_desde_etiqueta(clas_final),
            "indice_confianza_final": float(ica_valor),
            "fuente_predominante": fuente,
            "requiere_revision_manual": requiere_revision,
            "sugerir_reclasificacion": sugerir_reclasificacion,
            "motivo_revision": motivo,
        }

    # Caso restante: ML > EBR -> mantener etiqueta del modelo (más conservador)
    clas_final = etiqueta_ml
    fuente = "modelo_supervisado"
    # Marcamos para revisión si hay una discrepancia significativa
    requiere_revision = True
    motivo = (
        f"El modelo supervisado clasifica como {etiqueta_ml} mientras que la matriz EBR sugiere {ebr_clasificacion}; se mantiene la clasificación del modelo."
    )

    return {
        "clasificacion_final": clas_final,
        "nivel_riesgo_final": nivel_riesgo_desde_etiqueta(clas_final),
        "indice_confianza_final": float(ica_valor),
        "fuente_predominante": fuente,
        "requiere_revision_manual": requiere_revision,
        "sugerir_reclasificacion": sugerir_reclasificacion,
        "motivo_revision": motivo,
    }


# -----------------------------------------------------------------------------
# Carga del bundle supervisado
# -----------------------------------------------------------------------------
def load_ml_bundle(path: Path = MODEL_BUNDLE_PATH):
    """Carga el bundle del modelo supervisado entrenado.

    Espera un dict con al menos:
      - 'model'        : clasificador (StackingClassifier calibrado)
      - 'scaler'       : StandardScaler
      - 'columns'      : lista de columnas de entrenamiento (feature_cols)
      - 'classes'      : clases del modelo (orden de columnas de predict_proba)
      - 'thresholds'   : dict con umbrales (no se usan aquí pero viajan en bundle)
    """
    if not path.exists():
        raise FileNotFoundError(
            f"No se encontró el bundle del modelo supervisado en: {path}"
        )

    log(f"📦 Cargando bundle supervisado desde: {path}")
    bundle = joblib.load(path)

    model = bundle["model"]
    scaler: StandardScaler = bundle["scaler"]
    feature_cols = bundle.get("columns") or bundle.get("feature_cols")
    classes = bundle.get("classes", getattr(model, "classes_", None))

    if feature_cols is None:
        raise KeyError("El bundle no contiene la clave 'columns' o 'feature_cols'")
    if classes is None:
        raise KeyError("No se pudieron determinar las clases del modelo")

    feature_cols = list(feature_cols)
    classes = list(classes)

    log(f"   ✅ Bundle cargado: {len(feature_cols)} features, clases={classes}")
    return model, scaler, feature_cols, classes


def aplicar_no_supervisado_inferencia(df, bundle_ns):
    """Calcula anomalías con Isolation Forest + DBSCAN usando el bundle no supervisado.

    El bundle esperado contiene al menos:
      - 'columns': columnas a usar (lista)
      - 'scaler': objeto scaler (con transform)
      - 'isolation_forest': modelo IsolationForest entrenado
      - 'dbscan': objeto DBSCAN o similar (con fit_predict)
    """
    try:
        X = df[list(bundle_ns.get("columns", []))].copy()
    except Exception:
        # Si no existen las columnas esperadas, devolver DF sin cambios y columnas por defecto
        df["anomaly_score_composite"] = df.get("anomaly_score_composite", 0.0)
        df["is_outlier_iso"] = df.get("is_outlier_iso", 0)
        df["is_dbscan_noise"] = df.get("is_dbscan_noise", 0)
        return df

    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    try:
        X_scaled = bundle_ns["scaler"].transform(X)
    except Exception:
        X_scaled = X.values

    # Isolation Forest scores (negación para que mayor = más anómalo)
    try:
        iso_scores = -bundle_ns["isolation_forest"].decision_function(X_scaled)
        iso_outliers = bundle_ns["isolation_forest"].predict(X_scaled) == -1
    except Exception:
        iso_scores = np.zeros(len(df))
        iso_outliers = np.zeros(len(df), dtype=bool)

    # DBSCAN (fit_predict puede devolver -1 para ruido)
    try:
        db_labels = bundle_ns["dbscan"].fit_predict(X_scaled)
        is_noise = db_labels == -1
    except Exception:
        is_noise = np.zeros(len(df), dtype=bool)

    df["anomaly_score_iso"] = iso_scores
    df["is_outlier_iso"] = iso_outliers.astype(int)
    df["is_dbscan_noise"] = is_noise.astype(int)
    df["anomaly_score_composite"] = (
        pd.Series(iso_scores).rank(pct=True).fillna(0) * 0.6
        + pd.Series(iso_outliers.astype(int)) * 0.2
        + pd.Series(is_noise.astype(int)) * 0.2
    )

    return df


# -----------------------------------------------------------------------------
# Procesamiento de un archivo enriquecido
# -----------------------------------------------------------------------------
def process_file(csv_path: Path) -> bool:
    """Procesa un archivo CSV enriquecido y genera JSON + metadata.

    - Carga el CSV
    - Alinea features con el bundle
    - Corre el modelo supervisado
    - Calcula score_ebr_simple
    - Llama al TransactionExplainer por cada fila
    - Escribe:
        processed/<id>.csv
        processed/<id>.json
        processed/<id>_metadata.json
    """
    analysis_id = csv_path.stem
    log("\n" + "=" * 70)
    log(f"📄 Procesando archivo: {csv_path.name}")
    log("=" * 70)

    try:
        # 1) Carga de datos
        df = pd.read_csv(csv_path)
        log(f"   📥 Cargado: {len(df)} filas / {len(df.columns)} columnas")

        # Normalizar nombres básicos por seguridad
        rename_map = {}
        for col in df.columns:
            low = col.lower().strip()
            if low in {
                "monto",
                "fecha",
                "tipo_operacion",
                "sector_actividad",
                "cliente_id",
                "fraccion",
            }:
                if col != low:
                    rename_map[col] = low
        if rename_map:
            df = df.rename(columns=rename_map)
            log(f"   📝 Columnas normalizadas: {rename_map}")

        # Backup de cliente_id (para ID amigable)
        cliente_ids = df["cliente_id"].copy() if "cliente_id" in df.columns else None

        # 2) (Opcional) Aplicar modelo no supervisado PRIMERO para enriquecer con anomalías
        log("\n   🔬 Aplicando modelo no supervisado...")
        try:
            bundle_ns_path = BASE_DIR / "outputs" / "no_supervisado_bundle.pkl"
            if bundle_ns_path.exists():
                bundle_ns = joblib.load(bundle_ns_path)
                df = aplicar_no_supervisado_inferencia(df, bundle_ns)
                log(f"   ✅ Anomalías: mean={df['anomaly_score_composite'].mean():.3f}")
            else:
                log("   ⚠️ no_supervisado_bundle.pkl no encontrado")
                df["anomaly_score_composite"] = 0.0
                df["is_outlier_iso"] = 0
                df["is_dbscan_noise"] = 0
        except Exception as e:
            log(f"   ⚠️ Error no_supervisado: {e}")
            df["anomaly_score_composite"] = 0.0
            df["is_outlier_iso"] = 0
            df["is_dbscan_noise"] = 0

        # 3) Carga del modelo supervisado y preparación de X
        model, scaler, feature_cols, classes = load_ml_bundle(MODEL_BUNDLE_PATH)

        X_raw = df.copy()
        X_raw = X_raw.drop(
            columns=[
                "clasificacion_lfpiorpi",
                "clasificacion_lfpiorpi_pred",
                "cliente_id",
                "fecha",
            ],
            errors="ignore",
        )

        # Categóricas a dummies (mismo criterio que el entrenamiento)
        cat_cols = [
            c
            for c in ["tipo_operacion", "sector_actividad", "fraccion"]
            if c in X_raw.columns
        ]
        X_enc = pd.get_dummies(X_raw, columns=cat_cols, drop_first=True, dtype=float)

        # Alinear con las columnas del bundle
        for col in feature_cols:
            if col not in X_enc.columns:
                X_enc[col] = 0.0
        # Quitar columnas extra (por seguridad)
        X_enc = X_enc[feature_cols]

        # Escalar
        X_scaled = scaler.transform(X_enc)

        # 3) Predicción ML
        log("   🤖 Ejecutando modelo supervisado...")
        proba_all = model.predict_proba(X_scaled)  # (n_samples, n_classes)
        preds = model.predict(X_scaled)

        total = len(preds)
        dist = Counter(preds)
        log("\n   📊 Distribución de predicciones (ML):")
        for c in ["preocupante", "inusual", "relevante"]:
            if c in dist:
                log(f"      {c:>12}: {dist[c]:6d} ({dist[c]/total*100:5.1f}%)")

        # 4) Score EBR simplificado
        log("\n   📈 Calculando score_ebr_simple por transacción...")
        # Calcular score EBR y factores detonantes por fila
        resultados_ebr = [calcular_score_ebr_simple(df.iloc[i]) for i in range(len(df))]
        df["score_ebr"] = [r[0] for r in resultados_ebr]
        df["factores_ebr"] = [r[1] for r in resultados_ebr]

        # 5) Explicabilidad
        log("   🔍 Generando explicaciones (TransactionExplainer)...")
        explainer = TransactionExplainer()
        metadata_list = []
        explic_errors: list[str] = []

        for i, (_, tx) in enumerate(df.iterrows()):
            monto_val = float(tx.get("monto", 0.0) or 0.0)
            score_ebr = float(df.iloc[i]["score_ebr"])

            # Probabilidades ML en dict
            probs = proba_all[i]
            proba_ml = {classes[j]: float(probs[j]) for j in range(len(classes))}

            # Índice de Confianza Algorítmica (ICA): max de probabilidades del modelo
            try:
                score_confianza_model = float(np.max(probs))
            except Exception:
                score_confianza_model = 0.0

            if score_confianza_model >= 0.85:
                nivel_confianza_model = "alta"
            elif score_confianza_model >= 0.6:
                nivel_confianza_model = "media"
            else:
                nivel_confianza_model = "baja"
            clase_ml = preds[i]

            # Estrategia híbrida por monto (igual que diseño original)
            if monto_val < 100.0:
                clas_final = "relevante"
                origen = "EBR_only"
            elif 100.0 <= monto_val < 1000.0:
                clas_final = clase_ml
                origen = "ML_with_EBR_context"
            else:
                clas_final = clase_ml
                origen = "ML_primary_EBR_context"

            triggers: list[str] = []

            try:
                meta = explainer.explicar_transaccion(
                    tx,
                    score_ebr,
                    triggers,
                    origen,
                    proba_ml,
                )
                # Anexar ICA del modelo (score + nivel) para usar en el JSON final
                # Asegurar que la metadata incluye el ICA numérico (0..1)
                ica_meta = float(score_confianza_model or 0.0)
                if ica_meta < 0.0:
                    ica_meta = 0.0
                if ica_meta > 1.0:
                    ica_meta = 1.0
                meta["ica"] = ica_meta
                meta["score_confianza_model"] = score_confianza_model
                meta["nivel_confianza_model"] = nivel_confianza_model
            except Exception as e:  # noqa: BLE001
                # No loguear por cada fila (puede saturar consola). Acumular errores y emitir resumen.
                explic_errors.append(f"fila {i}: {e}")
                meta = {
                    "score_ebr": score_ebr,
                    "ica": score_confianza_model,
                    "score_confianza_model": score_confianza_model,
                    "nivel_confianza_model": nivel_confianza_model,
                    "clasificacion": clas_final,
                    "origen": origen,
                    "origen_clasificacion": origen,
                    "explicacion_principal": "Error generando explicación automática.",
                    "explicacion_detallada": str(e),
                    "razon_principal": "Error explicador",
                    "razones": [],
                    "factores_riesgo": [],
                    "flags": {
                        "requiere_revision_manual": True,
                        "sugerir_reclasificacion": False,
                        "alertas": ["Error explicador"],
                    },
                    "contexto_regulatorio": None,
                    "fundamento_legal": None,
                    "acciones_sugeridas": [],
                    "recomendaciones": [],
                    "contexto": {},
                    "requiere_revision_urgente": False,
                }

            metadata_list.append(meta)

        log(f"   ✅ Metadata generada para {len(metadata_list)} transacciones")
        if explic_errors:
            # Loguear resumen y primeros errores para diagnóstico sin saturar la consola
            preview = explic_errors[:5]
            log(f"   ⚠️ Explicabilidad: {len(explic_errors)} errores (ej: {preview})")

        # 6) Construir JSON de salida
        risk_map = {
            "relevante": "bajo",
            "inusual": "medio",
            "preocupante": "alto",
        }

        transacciones = []
        resultados = []
        for i, (_, row) in enumerate(df.iterrows()):
            pred = preds[i]
            probs = proba_all[i]
            proba_dict = {classes[j]: float(probs[j]) for j in range(len(classes))}
            explic = metadata_list[i]

            # Calcular ICA aquí a partir de las probabilidades del modelo para
            # asegurarnos de que siempre exista un valor numérico disponible
            # antes de asignarlo a la metadata / explicaciones.
            def _prob_for_arr(arr, label: str) -> float:
                try:
                    return float(arr[classes.index(label)])
                except Exception:
                    try:
                        return float(max(arr))
                    except Exception:
                        return 0.0

            prob_relevante = _prob_for_arr(probs, "relevante")
            prob_inusual = _prob_for_arr(probs, "inusual")
            prob_preocupante = _prob_for_arr(probs, "preocupante")

            ica_valor = calcular_ica(prob_relevante, prob_inusual, prob_preocupante)

            # Asegurar que la metadata contiene el ICA calculado aquí (no confiar solo en el valor
            # que pudiera venir del explicador). Esto permite que la UI muestre el número correcto.
            if isinstance(explic, dict):
                explic["ica"] = ica_valor

            # Monto y origen híbrido
            monto_raw = row.get("monto", 0.0)
            try:
                monto_val = float(monto_raw or 0.0)
            except (TypeError, ValueError):
                monto_val = 0.0

            if monto_val < 100.0:
                origen = "EBR_only"
            elif 100.0 <= monto_val < 1000.0:
                origen = "ML_with_EBR_context"
            else:
                origen = "ML_primary_EBR_context"

            # ID amigable
            if cliente_ids is not None:
                tx_id = str(cliente_ids.iloc[i])
            else:
                tx_id = f"TXN-{i+1:05d}"

            nivel_riesgo = risk_map.get(pred, "desconocido")

            # Probabilidades y ICA (por etiqueta estándar)
            probs_arr = proba_all[i]

            def _prob_for(label: str) -> float:
                try:
                    return float(probs_arr[classes.index(label)])
                except Exception:
                    try:
                        return float(max(probs_arr))
                    except Exception:
                        return 0.0

            prob_relevante = _prob_for("relevante")
            prob_inusual = _prob_for("inusual")
            prob_preocupante = _prob_for("preocupante")

            ica_valor = calcular_ica(prob_relevante, prob_inusual, prob_preocupante)

            etiqueta_ml = str(preds[i])
            nivel_riesgo_ml = nivel_riesgo_desde_etiqueta(etiqueta_ml)

            # Derivar clasificación EBR desde score_ebr y luego fusionar
            score_ebr_val = float(df.iloc[i]["score_ebr"])
            nivel_riesgo_ebr, ebr_label = bucket_ebr(score_ebr_val)

            # Fusion real que puede reclasificar según EBR
            fusion = fusionar_riesgos(
                etiqueta_ml=etiqueta_ml,
                ica_valor=ica_valor,
                ebr_score=score_ebr_val,
                ebr_clasificacion=ebr_label,
                ebr_nivel_riesgo=nivel_riesgo_ebr,
                tx_row=row.to_dict() if hasattr(row, "to_dict") else dict(row),
            )

            final_label = fusion.get("clasificacion_final", etiqueta_ml)
            nivel_riesgo_final = fusion.get("nivel_riesgo_final", nivel_riesgo_desde_etiqueta(final_label))
            requiere_revision_manual = fusion.get("requiere_revision_manual", False)
            sugerir_reclasificacion = fusion.get("sugerir_reclasificacion", False)
            motivo_reclasificacion = fusion.get("motivo_revision")

            # Construir registro con esquema canónico (ver JSON_ESTRUCTURA_IDEAL.json)
            umas_oper = mxn_a_umas(monto_val)

            # Extraer campos de la explicación normalizada
            explic_norm = explic if isinstance(explic, dict) else {}

            # Priorizar factores EBR provistos por cálculo previo (row puede traer lista o JSON-string)
            factores_ebr = row.get('factores_ebr') or row.get('factores_ebr_json') or []
            if isinstance(factores_ebr, str):
                try:
                    factores_ebr = json.loads(factores_ebr)
                except Exception:
                    factores_ebr = [factores_ebr] if factores_ebr else []

            if factores_ebr:
                razones = factores_ebr[:3]
            else:
                # Fallback conservador: generar razones a partir de campos disponibles (no inventar datos)
                razones = []
                try:
                    monto = float(row.get('monto', 0) or 0)
                except Exception:
                    monto = 0.0
                try:
                    score_ebr = float(row.get('score_ebr', 0) or 0)
                except Exception:
                    score_ebr = 0.0
                sector = str(row.get('sector_actividad', '') or '')

                if monto >= 100000:
                    razones.append(f"Monto alto: ${monto:,.0f} MXN requiere análisis")

                if score_ebr > 50:
                    razones.append(f"Score EBR de {score_ebr:.0f} indica factores de riesgo")

                sectores_riesgo = ['joyeria_metales', 'casas_cambio', 'inmobiliaria']
                if sector in sectores_riesgo:
                    razones.append(f"Sector '{sector}' clasificado como actividad vulnerable LFPIORPI")

                if not razones:
                    razones = ["Clasificación basada en análisis multifactorial"]

            # Fundamento legal: verificar tipos y evitar .get() sobre strings
            fundamento = None
            if isinstance(explic_norm, dict):
                fundamento = explic_norm.get('fundamento_legal') or explic_norm.get('contexto_regulatorio')
                if not fundamento:
                    dt = explic_norm.get('detalles_tecnicos') if isinstance(explic_norm.get('detalles_tecnicos'), dict) else None
                    if isinstance(dt, dict):
                        fundamento = dt.get('fundamento_legal')

            if not fundamento and 'fundamento_legal' in row:
                fund_row = row.get('fundamento_legal')
                if isinstance(fund_row, str) and len(fund_row) > 10:
                    fundamento = fund_row

            if not fundamento:
                fraccion = row.get('fraccion', '') or ''
                clasificacion_tmp = final_label or ''
                fracciones_map = {
                    'XI_joyeria': 'Artículo 17, Fracción XI - Joyería y metales preciosos',
                    'V_inmuebles': 'Artículo 17, Fracción V - Operaciones inmobiliarias',
                    'I_casas_cambio': 'Artículo 17, Fracción I - Casas de cambio'
                }
                fundamento = f"FUNDAMENTO LEGAL LFPIORPI\n\n"
                fundamento += fracciones_map.get(fraccion, "Artículo 17 - Actividades vulnerables")
                if clasificacion_tmp == 'preocupante':
                    fundamento += "\n\nOperación Preocupante: Requiere reporte a UIF en plazo de 24 horas."
                elif clasificacion_tmp == 'inusual':
                    fundamento += "\n\nOperación Inusual: Requiere análisis detallado y documentación."

            guardrail_aplicado = fusion.get("fuente_predominante") == "guardrail" or False
            guardrail_razon = fusion.get("motivo_revision") if guardrail_aplicado else None

            detalle_tecnico = {
                "ml": {
                    "etiqueta": etiqueta_ml,
                    "probabilidades": {
                        "relevante": prob_relevante,
                        "inusual": prob_inusual,
                        "preocupante": prob_preocupante,
                    },
                    "indice_confianza": ica_valor,
                },
                "ebr": {
                    "score": float(score_ebr_val),
                    "nivel": nivel_riesgo_ebr,
                    "clasificacion": ebr_label,
                },
                "no_supervisado": {
                    "anomaly_score_composite": float(row.get("anomaly_score_composite", 0.0) or 0.0),
                    "is_outlier_iso": bool(row.get("is_outlier_iso", 0)),
                    "is_dbscan_noise": bool(row.get("is_dbscan_noise", 0)),
                },
                "fusion": {
                    "fuente": fusion.get("fuente_predominante") or fusion.get("fuente") or "modelo_supervisado",
                    "requiere_revision": bool(fusion.get("requiere_revision_manual", False)),
                    "motivo": fusion.get("motivo_revision") or fusion.get("motivo") or None,
                },
            }

            registro = {
                "cliente_id": str(row.get("cliente_id", "")),
                "fecha": str(row.get("fecha", "")),
                "monto": float(monto_val),
                "umas": round(umas_oper, 3),
                "sector_actividad": str(row.get("sector_actividad", "")),
                "tipo_operacion": str(row.get("tipo_operacion", "")),

                "clasificacion": final_label,
                "nivel_riesgo": nivel_riesgo_final,
                "origen": fusion.get("fuente_predominante") or origen,

                "ica": float(ica_valor),
                "score_ebr": float(score_ebr_val),

                "guardrail_aplicado": bool(guardrail_aplicado),
                "guardrail_razon": guardrail_razon,

                "razones": razones,
                "fundamento_legal": fundamento,

                "detalle_tecnico": detalle_tecnico,
            }

            transacciones.append(registro)

            # Añadir explicación de negocio/legal generada por la función dedicada
            try:
                # Pasar configuración UMA/umbrales explícita al explicador (sin inventar valores)
                uma_cfg = {
                    "uma_mxn": UMA_MXN,
                    "umbrales": LFPI_CONFIG.get("umbrales", {}),
                }
                # Usar el wrapper disponible en el módulo de explicabilidad
                expl_neg = generar_explicacion_transaccion(registro)
                exp_short = registro.get("explicacion") if isinstance(registro.get("explicacion"), dict) else {}
                try:
                    normalized = _normalize_explicacion(exp_short, expl_neg, registro)
                except Exception:
                    # Fallback sencillo si la normalización falla
                    normalized = expl_neg or exp_short or {}

                # Evitar duplicar la explicación completa en la raíz del registro.
                # En su lugar inyectamos solo los campos relevantes que necesita la UI:
                # - detalles_tecnicos (incluye UMA y umbrales)
                # - fundamento_legal (texto)
                explic = normalized
                try:
                    dt = normalized.get("detalles_tecnicos") if isinstance(normalized, dict) else None
                    if isinstance(dt, dict):
                        registro["detalles_tecnicos"] = dt
                        # exponer UMAs de forma plana por compatibilidad
                        if dt.get("uma_mxn") is not None:
                            registro["uma_mxn"] = dt.get("uma_mxn")
                        if dt.get("umas_operacion") is not None:
                            registro["umas_operacion"] = dt.get("umas_operacion")
                        if dt.get("fraccion_aplicada") is not None:
                            registro["fraccion_aplicada"] = dt.get("fraccion_aplicada")

                    # Fundamento legal (texto) preferido desde la explicación normalizada
                    fund = None
                    if isinstance(normalized, dict):
                        fund = normalized.get("fundamento_legal") or normalized.get("contexto_regulatorio")
                        # fallback a detalles_tecnicos.fundamento_legal
                        if not fund and isinstance(dt, dict):
                            fund = dt.get("fundamento_legal")

                    if fund:
                        registro["fundamento_legal"] = fund

                    # Propagar campos principales/detallados al top-level del registro
                    registro["explicacion_principal"] = normalized.get("explicacion_principal")
                    # Generar explicación detallada enriquecida y específica
                    try:
                        registro["explicacion_detallada"] = generar_explicacion_detallada(registro)
                    except Exception:
                        registro["explicacion_detallada"] = normalized.get("explicacion_detallada")
                except Exception:
                    pass
            except Exception:
                # No bloquear el flujo si la explicación enriquecida falla
                pass

            # (Se suprime el log por transacción para evitar salida excesiva en consola)

            # Construir resultado v2.0 con secciones ML / EBR / flags / explicaciones
            try:
                probs_arr = probs
            except NameError:
                probs_arr = proba_all[i]

            # ICA desde el modelo (probabilidad de la clase predicha)
            try:
                ica_model = float(np.max(probs_arr))
            except Exception:
                ica_model = 0.0

            # Alinear nombres usados en la sección v2 con los calculados arriba
            ml_label = etiqueta_ml

            # Usar los valores calculados anteriormente (no confiar en columnas del DF)
            # `nivel_riesgo_ebr` y `ebr_label` vienen de `bucket_ebr(score_ebr_val)` más arriba
            # (no sobrescribimos con valores del row que pueden ser None).
            # Mantener los nombres locales coherentes para la construcción v2.
            # `ica_model` y `nivel_conf_ica` deben derivarse de `ica_valor`.
            # (Evita que v2 muestre `null` donde ya hay un valor calculado.)
            # nivel_riesgo_ebr, ebr_label  <-- ya definidos arriba

            ica_model = ica_valor
            if ica_model >= 0.85:
                nivel_conf_ica = "alta"
            elif ica_model >= 0.6:
                nivel_conf_ica = "media"
            else:
                nivel_conf_ica = "baja"

            explicacion_ml = explic.get("explicacion_principal") if isinstance(explic, dict) else None
            explicacion_ebr = None
            explicacion_fusion = motivo_reclasificacion

            # Construir JSON limpio para UI usando la función centralizada
            try:
                row_dict = row.to_dict() if hasattr(row, "to_dict") else dict(row)
            except Exception:
                row_dict = dict(row)

            txn_json = construir_transaccion_limpia(
                row=row_dict,
                pred=etiqueta_ml,
                probs=probs_arr,
                explic=explic,
                classes=classes,
            )

            resultados.append(txn_json)

        # Resumen alto nivel
        dist_final = Counter([t["clasificacion"] for t in transacciones])
        n_total = len(transacciones)
        scores_ebr_arr = df["score_ebr"].values

        # Resumen de indicadores (evitar métricas redundantes de 'confianza_*')
        req_rev = sum(
            1
            for m in metadata_list
            if m.get("flags", {}).get("requiere_revision_manual", False)
        )
        sug_reclas = sum(
            1
            for m in metadata_list
            if m.get("flags", {}).get("sugerir_reclasificacion", False)
        )

        guardrails_count = sum(1 for t in transacciones if t.get("guardrail_aplicado", False))

        resumen = {
            "total_transacciones": int(n_total),
            "preocupante": int(dist_final.get("preocupante", 0)),
            "inusual": int(dist_final.get("inusual", 0)),
            "relevante": int(dist_final.get("relevante", 0)),
            "estrategia": "ml_hibrido_ebr",  # etiqueta para frontend
            "score_ebr_promedio": float(scores_ebr_arr.mean()) if len(scores_ebr_arr) else 0.0,
            "indicadores": {
                "guardrails_aplicados": int(guardrails_count),
                "requiere_revision_manual": int(req_rev),
                "sugerir_reclasificacion": int(sug_reclas),
            },
        }

        # --------------------------------------------------
        # Aplicar modelo refuerzo para optimizar thresholds (opcional)
        # --------------------------------------------------
        log("\n   🎯 Aplicando modelo refuerzo (optimización thresholds)...")
        try:
            rl_model_path = BASE_DIR / "outputs" / "modelo_refuerzo_th.pkl"
            if rl_model_path.exists():
                rl_model = joblib.load(rl_model_path)

                # Extraer métricas del batch actual
                scores_ebr = df["score_ebr"].values if "score_ebr" in df.columns else []
                icas = [t.get("ica", 0) for t in transacciones]
                clasificaciones = [t.get("clasificacion") for t in transacciones]

                # Calcular distribuciones
                dist_clasificaciones = {
                    "preocupante": clasificaciones.count("preocupante") / len(clasificaciones) if clasificaciones else 0.0,
                    "inusual": clasificaciones.count("inusual") / len(clasificaciones) if clasificaciones else 0.0,
                    "relevante": clasificaciones.count("relevante") / len(clasificaciones) if clasificaciones else 0.0,
                }

                # Estado para RL: [ebr_mean, ica_mean, pct_preocupante, pct_inusual]
                estado_actual = [
                    float(np.mean(scores_ebr)) if len(scores_ebr) else 0.0,
                    float(np.mean(icas)) if len(icas) else 0.0,
                    dist_clasificaciones["preocupante"],
                    dist_clasificaciones["inusual"],
                ]

                # Ejecutar RL para sugerir thresholds
                if hasattr(rl_model, "predict"):
                    accion_sugerida = rl_model.predict([estado_actual])[0]
                else:
                    accion_sugerida = rl_model.get("action_for_state", lambda x: None)(estado_actual)

                # Guardar recomendaciones en JSON separado
                thresholds_output = {
                    "timestamp": datetime.now().isoformat(),
                    "analysis_id": analysis_id,
                    "estado_actual": {
                        "ebr_promedio": estado_actual[0],
                        "ica_promedio": estado_actual[1],
                        "distribucion": dist_clasificaciones,
                    },
                    "accion_recomendada": accion_sugerida,
                    "thresholds_actuales": {
                        "ebr_inusual": 51.0,
                        "ebr_preocupante": 65.0,
                    },
                    "nota": "Usar estos datos para ajustar thresholds en futuras iteraciones",
                }

                thresholds_path = PROCESSED_DIR / f"{analysis_id}_thresholds_rl.json"
                with open(thresholds_path, "w") as f:
                    json.dump(thresholds_output, f, indent=2)

                log(f"   ✅ Thresholds RL guardados: {thresholds_path.name}")
            else:
                log("   ⚠️ modelo_refuerzo_th.pkl no encontrado")
        except Exception as e:
            log(f"   ⚠️ Error RL: {e}")

        # Escribir SOLO la versión v2.0 como artefacto canónico
        v2_json = PROCESSED_DIR / f"{analysis_id}_v2.json"
        with open(v2_json, "w", encoding="utf-8") as f2:
            # Incluir ambos bloques por compatibilidad: 'transacciones' (legacy) y 'resultados' (v2)
            json.dump(
                {
                    "success": True,
                    "analysis_id": analysis_id,
                    "timestamp": datetime.now().isoformat(),
                    "resumen": resumen,
                    "transacciones": transacciones,
                    "resultados": resultados,
                },
                f2,
                indent=2,
                ensure_ascii=False,
            )

        log(f"\n✅ JSON v2.0 (único): {v2_json}")

        # Metadata detallada por transacción
        metadata_json = PROCESSED_DIR / f"{analysis_id}_metadata.json"
        with open(metadata_json, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "analysis_id": analysis_id,
                    "timestamp": datetime.now().isoformat(),
                    "transacciones": [
                            {
                                "index": i,
                                "cliente_id": transacciones[i]["cliente_id"],
                                **metadata_list[i],
                            }
                            for i in range(len(transacciones))
                        ],
                    "explic_errors": explic_errors if explic_errors else [],
                },
                f,
                indent=2,
                ensure_ascii=False,
            )

        log(f"✅ Metadata JSON: {metadata_json}")

        # CSV procesado
        processed_csv = PROCESSED_DIR / csv_path.name
        df.to_csv(processed_csv, index=False, encoding="utf-8")
        log(f"✅ CSV procesado: {processed_csv}")

        # Borrar de pending
        csv_path.unlink(missing_ok=True)
        return True

    except Exception as e:  # noqa: BLE001
        log(f"\n❌ ERROR procesando {csv_path.name}: {e}")
        traceback.print_exc()

        FAILED_DIR.mkdir(parents=True, exist_ok=True)
        failed_csv = FAILED_DIR / csv_path.name
        shutil.move(str(csv_path), str(failed_csv))

        error_json = FAILED_DIR / f"{analysis_id}_error.json"
        with open(error_json, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "success": False,
                    "analysis_id": analysis_id,
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                    "timestamp": datetime.now().isoformat(),
                },
                f,
                indent=2,
                ensure_ascii=False,
            )

        log(f"   ⚠️ Detalles de error en: {error_json}")
        return False


# -----------------------------------------------------------------------------
# main
# -----------------------------------------------------------------------------
def main() -> int:
    log("\n" + "=" * 70)
    log("🚀 ML RUNNER - Versión productiva v4 (bundle + FastAPI)")
    log("=" * 70)

    # Verificar bundle al inicio
    try:
        _model, _scaler, feature_cols, classes = load_ml_bundle(MODEL_BUNDLE_PATH)
        log("   ✅ Bundle verificado correctamente")
        log(f"   📊 Features esperados: {len(feature_cols)} | clases={classes}")
    except Exception as e:  # noqa: BLE001
        log(f"❌ No se pudo cargar el bundle supervisado: {e}")
        return 1

    # Modo 1: con analysis_id explícito (llamado desde FastAPI)
    if len(sys.argv) > 1:
        analysis_id = sys.argv[1]
        csv_file = PENDING_DIR / f"{analysis_id}.csv"

        if not csv_file.exists():
            log(f"❌ Archivo no encontrado en pending/: {csv_file}")
            return 1

        files = [csv_file]
    else:
        # Modo 2: procesar todo lo pendiente
        files = sorted(PENDING_DIR.glob("*.csv"))

    if not files:
        log("ℹ️ No hay archivos pendientes en pending/")
        return 0

    log(f"\n📋 Archivos a procesar: {len(files)}")

    ok = 0
    fail = 0
    for csv_path in files:
        if process_file(csv_path):
            ok += 1
        else:
            fail += 1

    log("\n" + "=" * 70)
    log("📊 RESUMEN ML RUNNER")
    log("=" * 70)
    log(f"✅ Exitosos: {ok}")
    log(f"❌ Fallidos: {fail}")
    log(f"📁 Carpeta processed/: {PROCESSED_DIR}")
    log("=" * 70 + "\n")

    return 0 if fail == 0 else 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
