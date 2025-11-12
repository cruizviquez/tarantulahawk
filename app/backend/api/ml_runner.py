#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - Runner de inferencia para archivos enriquecidos (CORREGIDO) fecha 11/11

✅ CORRECCIÓN APLICADA:
- Usa predictions de predict_adaptive() que YA incluyen guardrails
- NO recalcula con _predict_rule_based() que ignora guardrails

Procesa archivos de outputs/enriched/pending/*.csv usando TarantulaHawkPredictor:
1. Lee CSV enriquecido
2. Ejecuta predictor ML (3 capas + guardrails LFPIORPI)
3. Guarda resultados en processed/{analysis_id}.json
4. Mueve CSV a processed/ o failed/

Uso:
    python ml_runner.py                    # Procesa todos los pending/*.csv
    python ml_runner.py <analysis_id>      # Procesa un archivo específico
"""

import os
import sys
import json
import shutil
import traceback
from pathlib import Path
from datetime import datetime
from collections import Counter
import pandas as pd

# Importar predictor adaptativo (permite reglas + ML + guardrails)
sys.path.insert(0, str(Path(__file__).parent))
from predictor_adaptive import TarantulaHawkAdaptivePredictor
from explicabilidad_transactions import TransactionExplainer

# Paths
BASE_DIR = Path(__file__).parent.parent
PENDING_DIR = BASE_DIR / "outputs" / "enriched" / "pending"
PROCESSED_DIR = BASE_DIR / "outputs" / "enriched" / "processed"
FAILED_DIR = BASE_DIR / "outputs" / "enriched" / "failed"

# Crear directorios
for d in [PENDING_DIR, PROCESSED_DIR, FAILED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def process_file(csv_path: Path, predictor: TarantulaHawkAdaptivePredictor) -> bool:
    """
    Procesa un archivo CSV enriquecido y genera resultados JSON
    
    Returns:
        True si éxito, False si falla
    """
    analysis_id = csv_path.stem
    log(f"\n{'='*70}")
    log(f"📄 Procesando: {csv_path.name}")
    log(f"{'='*70}")
    
    try:
        # Leer CSV
        df = pd.read_csv(csv_path)
        log(f"   Cargado: {len(df)} filas, {len(df.columns)} columnas")
        
        # 🔒 PRESERVAR cliente_id original antes de que predictor lo droppee
        cliente_ids_originales = df["cliente_id"].copy() if "cliente_id" in df.columns else None
        
        # Ejecutar predictor adaptativo (rule-based / híbrido / ML puro + guardrails)
        log(f"\n   🤖 Ejecutando TarantulaHawk Adaptive Predictor...")
        predictions, probas, meta_pred = predictor.predict_adaptive(
            df, return_probas=True, return_metadata=True
        )
        # En modo rule-based, probas puede ser None
        scores = None  # Puntaje de anomalía no disponible en adaptativo por ahora
        
        # Clasificación
        preocupante = (predictions == "preocupante").sum()
        inusual = (predictions == "inusual").sum()
        relevante = (predictions == "relevante").sum()
        total = len(predictions)
        
        log(f"\n   📊 CLASIFICACIÓN:")
        log(f"      🔴 Preocupante: {preocupante} ({preocupante/total*100:.1f}%)")
        log(f"      🟠 Inusual: {inusual} ({inusual/total*100:.1f}%)")
        log(f"      🟡 Relevante: {relevante} ({relevante/total*100:.1f}%)")
        
        # ✅ VERIFICAR GUARDRAILS
        guardrails_count = meta_pred.get("guardrails_applied", 0) if isinstance(meta_pred, dict) else 0
        log(f"      🛡️  Guardrails aplicados: {guardrails_count}")
        
        # Generar detalle de transacciones (primeras 100) + triggers/origen
        transacciones = []
        
        flags_unsup = None
        try:
            # Algunos predictores pueden exponer flags no supervisados
            flags_unsup = getattr(predictor, "get_unsupervised_flags", lambda: None)()
        except Exception:
            flags_unsup = None

        # Helper severidad
        severidad = {"relevante": 0, "inusual": 1, "preocupante": 2}

        # Clases del modelo (si proba disponible)
        classes = None
        if probas is not None and getattr(predictor, "model", None) is not None:
            try:
                classes = predictor.model.classes_
            except Exception:
                classes = None

        # Determinar origen por transacción
        def determinar_origen(row: pd.Series, i: int, pred_final: str, strategy: str, triggers: list[str]) -> str:
            # 1) Normativo si hay guardrails
            if any(t.startswith("guardrail_") for t in triggers):
                return "normativo"
            # 2) Rule-based multi disparadores (solo aplica con strategy rule_based o híbrido)
            inusuales = [t for t in triggers if t.startswith("inusual_") or t == "sector_riesgo"]
            if strategy == "rule_based" and len(inusuales) >= 2:
                return "reglas_multi"
            if strategy == "hybrid":
                # Reconstruir clase rules estimada a partir de triggers
                rule_cls = "preocupante" if any(t.startswith("guardrail_") for t in triggers) else ("inusual" if len(inusuales) >= 2 else "relevante")
                # ML clase (si disponible)
                ml_cls = None
                ml_conf = 0.0
                if probas is not None and classes is not None:
                    j = int(probas[i].argmax())
                    ml_cls = str(classes[j])
                    ml_conf = float(probas[i, j])
                # Si final coincide con rules y difiere de ML -> origen reglas
                if pred_final == rule_cls and (ml_cls is None or pred_final != ml_cls):
                    return "reglas"
                # Alta confianza de ML
                if ml_cls is not None and ml_conf >= 0.8 and pred_final == ml_cls:
                    return "ml_alta_confianza"
                # Por defecto, atribuir a ML si coincide, si no conservador
                if ml_cls is not None and pred_final == ml_cls:
                    return "ml"
                return "conservador"
            # 3) En ML puro, si no fue normativo, atribuir a ML
            return "ml"

        # Acumuladores globales (agregados para dashboard)
        origen_counts = Counter()
        triggers_globales = Counter()

        # Control de costo: para agregación global, muestrear hasta N filas
        MAX_AGG_ROWS = 2000
        idx_iter = range(len(df)) if len(df) <= MAX_AGG_ROWS else range(MAX_AGG_ROWS)
        strategy = str(meta_pred.get("strategy", "unknown")) if isinstance(meta_pred, dict) else "unknown"

        for i in idx_iter:
            row = df.iloc[i]
            triggers = predictor._get_rule_triggers(row, df) if hasattr(predictor, "_get_rule_triggers") else []
            origen = determinar_origen(row, i, str(predictions[i]), strategy, triggers)
            origen_counts.update([origen])
            triggers_globales.update(triggers)

        # Inicializar explainer de transacciones
        explainer = TransactionExplainer(umbral_confianza_bajo=0.65)
        
        # Detalle transaccional (máx 100 filas)
        for i in range(min(100, len(df))):
            row = df.iloc[i]
            pred = predictions[i]
            
            # Obtener probabilidades por clase (si disponibles)
            proba_dict = {}
            if probas is not None and classes is not None:
                proba_dict = {cls: float(probas[i, j]) for j, cls in enumerate(classes)}
            anomaly_score = float(scores[i]) if scores is not None else None
            nota = None
            if flags_unsup is not None:
                try:
                    if bool(flags_unsup[i]):
                        nota = "nuevos casos detectados por AI no_supervisado, validarlo manualmente"
                except Exception:
                    pass
            triggers = predictor._get_rule_triggers(row, df) if hasattr(predictor, "_get_rule_triggers") else []
            origen = determinar_origen(row, i, str(pred), strategy, triggers)
            
            # 🆕 GENERAR EXPLICABILIDAD COMPLETA usando TransactionExplainer
            metadata_explicabilidad = explainer.explicar_transaccion(
                row=row,
                probabilidades=proba_dict if proba_dict else None,
                triggers=triggers
            )
            
            # Convertir triggers a lista de razones human-readable (fallback si no hay explicabilidad)
            razones_lista = metadata_explicabilidad.get('razones', [])
            if not razones_lista:
                for t in triggers[:3]:  # Top 3
                    if t.startswith("guardrail_"):
                        razones_lista.append("Umbral normativo LFPIORPI")
                    elif t.startswith("inusual_"):
                        razones_lista.append(t.replace("inusual_", "").replace("_", " ").title())
                    elif t == "sector_riesgo":
                        razones_lista.append("Sector alto riesgo")
                    else:
                        razones_lista.append(t.replace("_", " ").title())
            
            transacciones.append({
                "id": str(row.get("cliente_id", f"TXN-{i+1:05d}")),
                "monto": float(row.get("monto", 0)),
                "fecha": str(row.get("fecha", "")),
                "tipo_operacion": str(row.get("tipo_operacion", "")),
                "sector_actividad": str(row.get("sector_actividad", "")),
                "clasificacion": pred,
                "probabilidades": proba_dict,
                "risk_score": anomaly_score,  # Legacy: puntaje de anomalía
                "razones": razones_lista,  # Frontend expects array
                "nota": nota,
                "triggers": triggers,
                "origen": origen,
                # 🆕 CAMPOS DE EXPLICABILIDAD
                "score_confianza": metadata_explicabilidad.get('score_confianza'),
                "nivel_confianza": metadata_explicabilidad.get('nivel_confianza'),
                "explicacion_principal": metadata_explicabilidad.get('explicacion_principal'),
                "explicacion_detallada": metadata_explicabilidad.get('explicacion_detallada'),
                "flags": metadata_explicabilidad.get('flags'),
                "contexto_regulatorio": metadata_explicabilidad.get('contexto_regulatorio'),
                "acciones_sugeridas": metadata_explicabilidad.get('acciones_sugeridas')
            })
        
        # Guardar resultados
        output_json = PROCESSED_DIR / f"{analysis_id}.json"
        ai_new = int(flags_unsup.sum()) if isinstance(flags_unsup, (list, tuple, set,)) or hasattr(flags_unsup, 'sum') else 0
        # Top triggers (top-5)
        top_triggers = [
            {"trigger": k, "conteo": int(v)} for k, v in triggers_globales.most_common(5)
        ]
        # Indicadores
        indicadores = {
            "guardrails_aplicados": int(meta_pred.get("guardrails_applied", 0)) if isinstance(meta_pred, dict) else 0,
        }
        if isinstance(meta_pred, dict) and "small_volume_adjustments" in meta_pred:
            indicadores["ajustes_bajo_volumen"] = meta_pred["small_volume_adjustments"]
        results = {
            "success": True,
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "resumen": {
                "total_transacciones": int(total),
                "preocupante": int(preocupante),
                "inusual": int(inusual),
                "relevante": int(relevante),
                "limpio": 0,  # No usado en clasificación actual
                "ai_nuevos_casos": int(ai_new),
                "estrategia": strategy,
                "origen_clasificacion": {k: int(v) for k, v in origen_counts.items()},
                "top_triggers": top_triggers,
                "indicadores": indicadores
            },
            "transacciones": transacciones,
            "metadata": {
                "input_file": csv_path.name,
                "model_info": {
                    "strategy": strategy,
                    "details": meta_pred if isinstance(meta_pred, dict) else None
                },
                "triggers_globales": {k: int(v) for k, v in triggers_globales.items()}
            }
        }
        
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        log(f"\n✅ Resultados guardados: {output_json.name}")
        
        # 🔒 RESTAURAR cliente_id original si fue droppeado por predictor
        if cliente_ids_originales is not None and "cliente_id" not in df.columns:
            # Insertar al inicio para mantener orden de columnas lógico
            df.insert(0, "cliente_id", cliente_ids_originales)
        
        # ✅ OPCIÓN A: UNA SOLA COLUMNA DE CLASIFICACIÓN
        # predictions ya incluye guardrails LFPIORPI aplicados automáticamente
        df["clasificacion"] = predictions
        
        # ✅ Detectar qué transacciones fueron corregidas por guardrails
        def fue_corregido_por_guardrail(row):
            """Determina si esta fila debió ser forzada a preocupante por guardrails"""
            fraccion = str(row.get('fraccion', '_'))
            monto = float(row.get('monto', 0))
            es_efectivo = int(row.get('EsEfectivo', 0))
            monto_6m = float(row.get('monto_6m', 0))
            clasificacion = str(row.get('clasificacion', ''))
            
            # Solo aplica si fue clasificado como preocupante
            if clasificacion != 'preocupante':
                return False
            
            UMA = predictor.UMA
            umbral_aviso = predictor._get_umbral_mxn(fraccion, "aviso_UMA")
            umbral_efectivo = predictor._get_umbral_mxn(fraccion, "efectivo_max_UMA")
            
            # Verificar si dispara guardrail
            if monto >= umbral_aviso:
                return True
            if es_efectivo == 1 and monto >= umbral_efectivo:
                return True
            if monto < umbral_aviso and monto_6m >= umbral_aviso:
                return True
            
            return False
        
        df["fue_corregido_por_guardrail"] = df.apply(fue_corregido_por_guardrail, axis=1)
        
        # Agregar origen de la clasificación (normativo/ml/reglas/conservador)
        def determinar_origen_mejorado(row, idx):
            # PRIORIDAD 0: Si fue corregido por guardrail → normativo
            if row['fue_corregido_por_guardrail']:
                return "normativo"
            
            # Obtener triggers para análisis adicional
            triggers = predictor._get_rule_triggers(row, df) if hasattr(predictor, "_get_rule_triggers") else []
            
            # PRIORIDAD 1: Triggers de guardrail (fallback)
            if any(t.startswith("guardrail_") for t in triggers):
                return "normativo"
            
            pred_final = str(row['clasificacion'])
            
            # PRIORIDAD 2: Rule-based multi disparadores
            inusuales = [t for t in triggers if t.startswith("inusual_") or t == "sector_riesgo"]
            if strategy == "rule_based" and len(inusuales) >= 2:
                return "reglas_multi"
            
            # PRIORIDAD 3: Hybrid - analizar ML vs reglas
            if strategy == "hybrid":
                rule_cls = "preocupante" if any(t.startswith("guardrail_") for t in triggers) else \
                           ("inusual" if len(inusuales) >= 2 else "relevante")
                
                ml_cls = None
                ml_conf = 0.0
                if probas is not None and classes is not None:
                    ml_conf_arr = probas[idx]
                    j = int(ml_conf_arr.argmax())
                    ml_cls = str(classes[j])
                    ml_conf = float(ml_conf_arr[j])
                
                # Si final coincide con rules y difiere de ML
                if pred_final == rule_cls and (ml_cls is None or pred_final != ml_cls):
                    return "reglas"
                
                # Alta confianza de ML
                if ml_cls is not None and ml_conf >= 0.8 and pred_final == ml_cls:
                    return "ml_alta_confianza"
                
                # Default a ML si coincide
                if ml_cls is not None and pred_final == ml_cls:
                    return "ml"
                
                return "conservador"
            
            # PRIORIDAD 4: ML puro
            if probas is not None and classes is not None:
                ml_conf_arr = probas[idx]
                ml_conf = float(ml_conf_arr.max())
                if ml_conf >= 0.8:
                    return "ml_alta_confianza"
                return "ml"
            
            return "ml"
        
        df["origen"] = [determinar_origen_mejorado(df.iloc[i], i) for i in range(len(df))]
        
        # Agregar razones (top 3 triggers human-readable)
        def get_top_triggers_readable(row_idx):
            row = df.iloc[row_idx]
            
            # Si fue corregido por guardrail, razón principal es esa
            if row['fue_corregido_por_guardrail']:
                return "Umbral normativo LFPIORPI"
            
            triggers = predictor._get_rule_triggers(row, df) if hasattr(predictor, "_get_rule_triggers") else []
            razones = []
            for t in triggers[:3]:
                if t.startswith("guardrail_"):
                    razones.append("Umbral normativo LFPIORPI")
                elif t.startswith("inusual_"):
                    razones.append(t.replace("inusual_", "").replace("_", " ").title())
                elif t == "sector_riesgo":
                    razones.append("Sector alto riesgo")
                else:
                    razones.append(t.replace("_", " ").title())
            return "; ".join(razones) if razones else ""
        
        df["razones"] = [get_top_triggers_readable(i) for i in range(len(df))]
        
        # Opcional: Score de anomalía (si disponible)
        if scores is not None:
            df["score_anomalia"] = scores
        
        # Contar guardrails aplicados
        n_guardrails = int(df["fue_corregido_por_guardrail"].sum())
        
        log(f"   ✅ Clasificación final (con guardrails LFPIORPI) aplicada")
        log(f"   🛡️  Guardrails aplicaron: {n_guardrails} transacciones")
        log(f"   📊 Distribución por origen: {Counter(df['origen'])}")
        
        # Guardar CSV enriquecido con predicciones
        processed_csv = PROCESSED_DIR / csv_path.name
        df.to_csv(processed_csv, index=False, encoding='utf-8')
        log(f"✅ CSV con predicciones guardado: processed/{csv_path.name}")
        
        # Eliminar CSV temporal de pending/
        csv_path.unlink()
        
        return True
        
    except Exception as e:
        log(f"\n❌ ERROR procesando {csv_path.name}:")
        log(f"   {str(e)}")
        traceback.print_exc()
        
        # Mover a failed/
        failed_csv = FAILED_DIR / csv_path.name
        shutil.move(str(csv_path), str(failed_csv))
        
        # Guardar error
        error_json = FAILED_DIR / f"{analysis_id}_error.json"
        with open(error_json, 'w', encoding='utf-8') as f:
            json.dump({
                "success": False,
                "analysis_id": analysis_id,
                "error": str(e),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        
        log(f"❌ CSV movido a: failed/{csv_path.name}")
        return False

def main():
    log("\n" + "="*70)
    log("🚀 ML RUNNER - Inferencia de archivos enriquecidos")
    log("="*70)
    
    # Cargar predictor (carga modelos automáticamente)
    log("\n📦 Inicializando TarantulaHawk Adaptive Predictor...")
    try:
        predictor = TarantulaHawkAdaptivePredictor(base_dir=str(BASE_DIR), verbose=True)
    except Exception as e:
        log(f"❌ Error inicializando predictor: {e}")
        return 1
    
    # Determinar archivos a procesar
    if len(sys.argv) > 1:
        # Procesar archivo específico
        analysis_id = sys.argv[1]
        csv_file = PENDING_DIR / f"{analysis_id}.csv"
        
        if not csv_file.exists():
            log(f"❌ Archivo no encontrado: {csv_file}")
            return 1
        
        files_to_process = [csv_file]
    else:
        # Procesar todos los pending
        files_to_process = list(PENDING_DIR.glob("*.csv"))
    
    if not files_to_process:
        log("\nℹ️  No hay archivos pendientes en outputs/enriched/pending/")
        return 0
    
    log(f"\n📋 Archivos a procesar: {len(files_to_process)}")
    
    # Procesar
    success_count = 0
    failed_count = 0
    
    for csv_path in files_to_process:
        if process_file(csv_path, predictor):
            success_count += 1
        else:
            failed_count += 1
    
    # Resumen
    log("\n" + "="*70)
    log("📊 RESUMEN DE PROCESAMIENTO")
    log("="*70)
    log(f"✅ Exitosos: {success_count}")
    log(f"❌ Fallidos: {failed_count}")
    log(f"📁 Resultados en: {PROCESSED_DIR}")
    log("="*70 + "\n")
    
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())