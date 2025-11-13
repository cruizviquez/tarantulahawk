# explicabilidad_transactions.py
# ==========================================================
# Funciones reutilizables para explicar una transacción siguiendo
# el esquema de metadata consumido por tu UI.
# ==========================================================

from datetime import datetime
import numpy as np

def confianza_a_nivel(conf: float) -> str:
    if conf >= 0.85:
        return "alta"
    if conf >= 0.65:
        return "media"
    return "baja"

def compute_umbral_limites(cfg: dict, fraccion: str, efectivo: int):
    uma = cfg.get("uma", {})
    valor = float(uma.get("valor_diario_mxn", 108.57))
    fac_aviso = float(uma.get("factor_umbral_aviso", 3210))
    fac_efec = float(uma.get("factor_limite_efectivo", 3210))
    umbral_aviso = valor * fac_aviso
    limite_efectivo = valor * fac_efec if efectivo == 1 else np.inf
    return umbral_aviso, limite_efectivo

def redactar_contexto_regulatorio(cfg: dict, fraccion: str, monto: float, efectivo: int) -> str:
    umbral_aviso, limite_efectivo = compute_umbral_limites(cfg, fraccion, efectivo)
    pct = 0.0 if umbral_aviso <= 0 else (monto / umbral_aviso) * 100.0
    return (
        f"**Fracción {fraccion or 'N/A'}**\n"
        f"Umbral de aviso: ${umbral_aviso:,.2f} MXN\n"
        f"Límite efectivo: ${limite_efectivo:,.2f} MXN\n"
        f"Base legal: Art. 17 LFPIORPI - Actividades Vulnerables\n\n"
        f"Monto representa el {pct:.1f}% del umbral de aviso."
    )

def explicar_transaccion(row: dict, label: str, conf: float, proba_dict: dict, alertas: list, cfg: dict) -> dict:
    monto = float(row.get("monto", 0.0))
    tipo = str(row.get("tipo_operacion", ""))
    frac = str(row.get("fraccion", ""))
    sector = str(row.get("sector_actividad", ""))
    efectivo = int(row.get("EsEfectivo", 0))

    razones = []
    if int(row.get("EsInternacional", 0)) == 1:
        razones.append("Transferencia Internacional")
    if efectivo == 1:
        razones.append("Operación en efectivo")
    if int(row.get("SectorAltoRiesgo", 0)) == 1:
        razones.append("Sector catalogado de alto riesgo")
    if int(row.get("Acum6mAlcanzaAviso", 0)) == 1:
        razones.append("Acumulado 6m alcanza umbral de aviso")

    expl_p = (
        f"Clasificación '{label}' con confianza {conf*100:.0f}%."
        f" Tipo: {tipo}; Sector: {sector}; Monto: ${monto:,.2f}."
    )
    if alertas:
        expl_p += " (Se aplicaron reglas normativas)."

    expl_d = (
        f"Probabilidades del ensemble → "
        f"Relevante={proba_dict.get('relevante', 0):.2f}, "
        f"Inusual={proba_dict.get('inusual', 0):.2f}, "
        f"Preocupante={proba_dict.get('preocupante', 0):.2f}.\n"
        f"Se consideraron señales LFPIORPI (efectivo, transferencias internacionales, sector, acumulado 6m)."
    )

    acciones = []
    if label == "preocupante":
        acciones += ["📤 Preparar aviso a la UIF", "🔍 Verificar documentación soporte", "👤 Validar identidad y BF"]
    elif label == "inusual":
        acciones += ["👁️ Revisión manual", "📋 Documentar hallazgos", "🔎 Revisar perfil transaccional"]
    else:
        acciones += ["✔️ Operación dentro de perfil; monitoreo continuo"]

    return {
        "explicacion_principal": expl_p,
        "explicacion_detallada": expl_d,
        "razones": razones,
        "contexto_regulatorio": redactar_contexto_regulatorio(cfg, frac, monto, efectivo),
        "acciones_sugeridas": acciones,
        "nivel_confianza": confianza_a_nivel(conf)
    }
