# ml_runner.py
# ==========================================================
# Runner ML con enfoque basado en riesgos (LFPIORPI):
# - Carga modelo supervisado (bundle .pkl) y, si existe, no supervisado (.pkl)
# - Aplica matriz de ponderación de riesgo configurable
# - Aplica guardrails normativos (UMAs, fracción, efectivo, acumulado 6m)
# - Genera JSON de metadata compatible con la UI del portal
#   (ver ejemplo de esquema que ya usas)  --> outputs/enriched/processed/<analysis_id>_metadata.json
# ==========================================================

import os
import json
import uuid
import argparse
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

# Evitar warnings de loky en Windows
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "8")

# -------------------- utils de logging --------------------
def log(msg: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

# -------------------- paths helpers -----------------------
def resolve_path(p: str) -> str:
    if not p:
        return p
    p = p.replace("\\", "/")
    if os.path.isabs(p):
        return p
    return os.path.join(os.getcwd(), p)

# -------------------- carga config ------------------------
def load_config(cfg_path: str) -> dict:
    cfg_path = resolve_path(cfg_path)
    if os.path.exists(cfg_path):
        with open(cfg_path, "r", encoding="utf-8") as f:
            return json.load(f)
    # default mínima si no hay config
    return {
        "paths": {
            "dataset_enriched_path": "app/backend/uploads/enriched/dataset_pld_lfpiorpi_50000_enriched.csv",
            "outputs_dir": "app/backend/outputs",
            "supervised_bundle": "app/backend/outputs/modelo_ensemble_stack.pkl",
            "unsupervised_bundle": "app/backend/outputs/no_supervisado_bundle.pkl"
        },
        "uma": {
            "valor_diario_mxn": 108.57,  # EJEMPLO 2025; ajusta si lo deseas
            "factor_umbral_aviso": 3210, # e.g. joyería
            "factor_limite_efectivo": 3210
        },
        "guardrails": {
            "usar_guardrails": True,
            "obligatorio_preocupante_si_supera_umbral": True,
            "obligatorio_inusual_si_quiere_decir_algo": True
        },
        "risk_matrix": {
            "base_weights": {
                "relevante": 0.2,
                "inusual": 0.6,
                "preocupante": 1.0
            },
            "feature_multipliers": {
                "EsEfectivo": 1.15,
                "EsInternacional": 1.15,
                "SectorAltoRiesgo": 1.10,
                "Acum6mAlcanzaAviso": 1.20
            },
            "anomalia_boost": 1.25,    # si no-superv marca anómala
            "max_clip": 1.0
        },
        "thresholds": {
            "preocupante": 0.30,
            "inusual": 0.30
        }
    }

# -------------------- UMA helpers -------------------------
def compute_umbral_limites(cfg: dict, fraccion: str, efectivo: int):
    """
    Calcula umbrales por UMA. Si tuvieras una tabla por fracción, podrías especializar aquí.
    Por simplicidad usamos factores del cfg y regresamos tuplas (umbral_aviso_mxn, limite_efectivo_mxn).
    """
    uma = cfg.get("uma", {})
    valor = float(uma.get("valor_diario_mxn", 108.57))
    fac_aviso = float(uma.get("factor_umbral_aviso", 3210))
    fac_efec = float(uma.get("factor_limite_efectivo", 3210))
    umbral_aviso = valor * fac_aviso
    limite_efectivo = valor * fac_efec if efectivo == 1 else np.inf
    return umbral_aviso, limite_efectivo

# -------------------- guardrails --------------------------
def apply_guardrails(row: pd.Series, cfg: dict, pred_label: str) -> (str, list):
    """
    Si supera umbral_normativo → forzar 'preocupante'.
    También puedes introducir otras reglas duras si quieres.
    Devuelve (label_final, alertas[])
    """
    alertas = []
    if not cfg.get("guardrails", {}).get("usar_guardrails", True):
        return pred_label, alertas

    monto = float(row.get("monto", 0.0))
    fraccion = row.get("fraccion", "")
    efectivo = int(row.get("EsEfectivo", 0))

    umbral_aviso_mxn, limite_efectivo_mxn = compute_umbral_limites(cfg, fraccion, efectivo)

    # Hard rule: si excede umbral → preocupante
    if monto >= umbral_aviso_mxn and cfg["guardrails"].get("obligatorio_preocupante_si_supera_umbral", True):
        alertas.append({
            "tipo": "umbral_normativo",
            "severidad": "warning",
            "mensaje": "Monto supera umbral LFPIORPI; clasificación forzada a PREOCUPANTE."
        })
        return "preocupante", alertas

    # Hard rule: efectivo por arriba del límite (si aplica)
    if efectivo == 1 and monto >= limite_efectivo_mxn and np.isfinite(limite_efectivo_mxn):
        alertas.append({
            "tipo": "limite_efectivo",
            "severidad": "warning",
            "mensaje": "Operación en efectivo supera límite LFPIORPI; revisar aviso."
        })
        # no forzamos la clase si no definimos tal regla, sólo advertimos
        # si quieres forzar: return "preocupante", alertas

    return pred_label, alertas

# -------------------- riesgo por ponderación ----------------
def risk_weighted_label(row: pd.Series, proba: dict, is_anomaly: bool, cfg: dict):
    """
    Construye un score ponderado por clase a partir de:
      - probabilidades del ensemble
      - multiplicadores por features regulatorias
      - boost si anómala
    Resultado: clase final, score_confianza [0..1]
    """
    rm = cfg.get("risk_matrix", {})
    base = rm.get("base_weights", {"relevante": 0.2, "inusual": 0.6, "preocupante": 1.0})
    mult = rm.get("feature_multipliers", {})
    anom_boost = float(rm.get("anomalia_boost", 1.25))
    max_clip = float(rm.get("max_clip", 1.0))

    # Probabilidades
    p_rel = float(proba.get("relevante", 0.0))
    p_inu = float(proba.get("inusual", 0.0))
    p_pre = float(proba.get("preocupante", 0.0))

    # Multiplicadores por señales (si existen)
    m = 1.0
    for col, fac in mult.items():
        val = float(row.get(col, 0.0))
        if val >= 1.0:  # binaria
            m *= float(fac)

    if is_anomaly:
        m *= anom_boost

    # Score ponderado por clase
    score_rel = p_rel * base.get("relevante", 0.2) * m
    score_inu = p_inu * base.get("inusual", 0.6) * m
    score_pre = p_pre * base.get("preocupante", 1.0) * m

    # Clip general (opcional)
    score_rel = min(score_rel, max_clip)
    score_inu = min(score_inu, max_clip)
    score_pre = min(score_pre, max_clip)

    # clase por score mayor
    scores = {
        "relevante": score_rel,
        "inusual": score_inu,
        "preocupante": score_pre
    }
    final_label = max(scores, key=scores.get)
    # “confianza” = score normalizado entre 0..1
    total = score_rel + score_inu + score_pre
    conf = (scores[final_label] / total) if total > 0 else 0.5
    return final_label, float(conf)

# -------------------- explicabilidad mínima ----------------
def redact_explanations(row: pd.Series, label: str, conf: float, proba: dict, alertas: list, cfg: dict):
    """
    Redacta ‘explicacion_principal’, ‘explicacion_detallada’, ‘razones’,
    ‘contexto_regulatorio’, ‘acciones_sugeridas’ alineado al esquema de tu UI.
    """
    monto = float(row.get("monto", 0.0))
    tipo = str(row.get("tipo_operacion", ""))
    frac = str(row.get("fraccion", ""))
    sector = str(row.get("sector_actividad", ""))
    efectivo = int(row.get("EsEfectivo", 0))

    # contexto regulatorio por UMA
    umbral_aviso, limite_efectivo = compute_umbral_limites(cfg, frac, efectivo)
    pct = 0.0 if umbral_aviso <= 0 else (monto / umbral_aviso) * 100.0

    contexto = (
        f"**Fracción {frac or 'N/A'}**\n"
        f"Umbral de aviso: ${umbral_aviso:,.2f} MXN\n"
        f"Límite efectivo: ${limite_efectivo:,.2f} MXN\n"
        f"Base legal: Art. 17 LFPIORPI - Actividades Vulnerables\n\n"
        f"Monto representa el {pct:.1f}% del umbral de aviso."
    )

    razones = []
    if int(row.get("EsInternacional", 0)) == 1:
        razones.append("Transferencia Internacional")
    if efectivo == 1:
        razones.append("Operación en efectivo")
    if int(row.get("SectorAltoRiesgo", 0)) == 1:
        razones.append("Sector catalogado de alto riesgo")
    if int(row.get("Acum6mAlcanzaAviso", 0)) == 1:
        razones.append("Acumulado 6m alcanza umbral de aviso")

    # explicación principal
    expl_p = (
        f"Clasificación '{label}' con confianza {conf*100:.0f}%."
        f" Tipo: {tipo}; Sector: {sector}; Monto: ${monto:,.2f}."
    )
    if alertas:
        expl_p += " (Se aplicaron reglas normativas)."

    # detallada
    expl_d = (
        f"Probabilidades del ensemble → "
        f"Relevante={proba.get('relevante', 0):.2f}, "
        f"Inusual={proba.get('inusual', 0):.2f}, "
        f"Preocupante={proba.get('preocupante', 0):.2f}.\n"
        f"Se consideraron señales LFPIORPI (efectivo, transferencias internacionales, sector, acumulado 6m)."
    )

    acciones = []
    if label == "preocupante":
        acciones += ["📤 Preparar aviso a la UIF", "🔍 Verificar documentación soporte", "👤 Validar identidad y BF"]
    elif label == "inusual":
        acciones += ["👁️ Revisión manual", "📋 Documentar hallazgos", "🔎 Revisar perfil transaccional"]
    else:
        acciones += ["✔️ Operación dentro de perfil; monitoreo continuo"]

    # confianza → nivel
    if conf >= 0.85:
        nivel = "alta"
    elif conf >= 0.65:
        nivel = "media"
    else:
        nivel = "baja"

    flags = {
        "requiere_revision_manual": (label != "relevante") or (nivel == "baja"),
        "sugerir_reclasificacion": (nivel == "baja"),
        "alertas": alertas
    }

    return expl_p, expl_d, razones, contexto, acciones, nivel

# -------------------- carga de bundles ---------------------
def try_load_pickle(p):
    import pickle
    p = resolve_path(p)
    if os.path.exists(p):
        with open(p, "rb") as f:
            return pickle.load(f)
    return None

# ==========================================================
# MAIN
# ==========================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="app/backend/models/config_modelos.json")
    ap.add_argument("--input", default=None, help="CSV enriquecido; si no se da, se toma de config")
    ap.add_argument("--analysis-id", default=None)
    args = ap.parse_args()

    cfg = load_config(args.config)
    paths = cfg.get("paths", {})
    dataset_path = resolve_path(args.input or paths.get("dataset_enriched_path", "app/backend/uploads/enriched/dataset_pld_lfpiorpi_50000_enriched.csv"))
    outputs_dir = resolve_path(paths.get("outputs_dir", "app/backend/outputs"))
    sup_bundle_path = resolve_path(paths.get("supervised_bundle", "app/backend/outputs/modelo_ensemble_stack.pkl"))
    unsup_bundle_path = resolve_path(paths.get("unsupervised_bundle", "app/backend/outputs/no_supervisado_bundle.pkl"))

    log("Runner ML (enfoque basado en riesgos)")
    log(f"dataset: {dataset_path}")
    log(f"outputs: {outputs_dir}")

    # Carga dataset
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"CSV no existe: {dataset_path}")
    df = pd.read_csv(dataset_path)
    log(f"Rows: {len(df):,}")

    # Carga bundle supervisado
    bundle = try_load_pickle(sup_bundle_path)
    if bundle is None:
        raise RuntimeError(f"No se encontró el bundle supervisado: {sup_bundle_path}")

    model = bundle["model"]
    scaler = bundle["scaler"]
    feature_cols = bundle["feature_cols"]
    class_mapping = bundle["class_mapping"]  # e.g. {'relevante':0,'inusual':1,'preocupante':2}
    inv_mapping = {v: k for k, v in class_mapping.items()}

    # Selección/One-hot igual que el entrenamiento
    # (repite el pipeline que usaste al entrenar)
    X_raw = df.drop(columns=["clasificacion_lfpiorpi"], errors="ignore").copy()
    X_raw = X_raw.drop(columns=["cliente_id", "fecha", "fecha_dt"], errors="ignore")
    cat_cols = [c for c in ["tipo_operacion", "sector_actividad", "fraccion"] if c in X_raw.columns]
    X = pd.get_dummies(X_raw, columns=cat_cols, drop_first=True, dtype=float)

    # Alinear a feature_cols
    for c in feature_cols:
        if c not in X.columns:
            X[c] = 0.0
    X = X[feature_cols]

    # Sanitizar
    X.replace([np.inf, -np.inf], np.nan, inplace=True)
    X.fillna(0, inplace=True)

    # Escalar
    X_scaled = scaler.transform(X)

    # Probabilidades del ensemble
    proba = model.predict_proba(X_scaled)  # shape (n, 3)
    # por fila, construir dict de clases
    # Además, intentar marcar anomalía usando bundle (si existe)
    unsup = try_load_pickle(unsup_bundle_path)
    if unsup is not None:
        try:
            # si el no-supervisado guardó scaler/cols, alineamos
            u_scaler = unsup.get("scaler", None)
            u_cols = unsup.get("feature_cols", feature_cols)
            Xu = X.copy()
            for c in u_cols:
                if c not in Xu.columns:
                    Xu[c] = 0.0
            Xu = Xu[u_cols]
            if u_scaler is not None:
                Xu = u_scaler.transform(Xu)
            anom_scores = unsup["model"].decision_function(Xu)  # IsolationForest: menor → más anómalo
            # umbral heurístico: percentil 2% más bajo
            cut = np.percentile(anom_scores, 2.0)
            is_anomaly = (anom_scores <= cut)
        except Exception:
            is_anomaly = np.zeros(len(df), dtype=bool)
    else:
        is_anomaly = np.zeros(len(df), dtype=bool)

    # Thresholds (por si quieres usarlos en flags, no en la decisión final ponderada)
    thr_p = float(cfg.get("thresholds", {}).get("preocupante", 0.3))
    thr_i = float(cfg.get("thresholds", {}).get("inusual", 0.3))

    # Construcción de metadata
    records = []
    for i, row in df.iterrows():
        p = proba[i]
        p_dict = {inv_mapping[j]: float(p[j]) for j in range(len(p))}
        # etiqueta por mayor prob antes de ponderar (solo informativa)
        base_pred = max(p_dict, key=p_dict.get)

        # etiqueta ponderada por riesgo (propuesta EBR)
        label_ebr, conf = risk_weighted_label(row, p_dict, bool(is_anomaly[i]), cfg)

        # aplicar guardrails normativos (puede forzar)
        final_label, alertas = apply_guardrails(row, cfg, label_ebr)

        expl_p, expl_d, razones, contexto, acciones, nivel = redact_explanations(
            row, final_label, conf, p_dict, alertas, cfg
        )

        record = {
            "index": int(i),
            "cliente_id": str(row.get("cliente_id", f"IDX{i}")),
            "score_confianza": round(conf, 4),
            "nivel_confianza": nivel,
            "clasificacion": final_label,
            "origen": "ml" if not alertas else "normativo",
            "explicacion_principal": expl_p,
            "explicacion_detallada": expl_d,
            "razones": razones,
            "flags": {
                "requiere_revision_manual": bool((final_label != "relevante") or (nivel == "baja")),
                "sugerir_reclasificacion": bool(nivel == "baja"),
                "alertas": alertas
            },
            "contexto_regulatorio": contexto,
            "acciones_sugeridas": acciones
        }
        records.append(record)

    # Ensamble de metadata
    analysis_id = args.analysis_id or str(uuid.uuid4())
    meta = {
        "analysis_id": analysis_id,
        "timestamp": datetime.now().isoformat(),
        "transacciones": records
    }

    # Guardar
    out_dir = Path(outputs_dir) / "enriched" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / f"{analysis_id}_metadata.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # CSV plano opcional
    flat_csv = Path(outputs_dir) / f"{analysis_id}_predicciones.csv"
    pd.DataFrame(records).to_csv(flat_csv, index=False, encoding="utf-8")

    log("====================================================")
    log(f"✅ Metadata guardada: {json_path}")
    log(f"✅ CSV resultados:    {flat_csv}")
    log("Listo.")

if __name__ == "__main__":
    main()
