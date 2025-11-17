#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - VERSIÓN FINAL CORREGIDA

✅ CORRECCIONES APLICADAS:
1. Triggers granulares (nocturno y fin_semana separados)
2. Trigger de monto en rango alto ($100k-umbral)
3. Lógica inusual: 1 trigger + monto alto = inusual
4. Score EBR (Enfoque Basado en Riesgos) en lugar de confianza ML
5. Sistema de explicabilidad completo

Procesa archivos de outputs/enriched/pending/*.csv usando TarantulaHawkPredictor.
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
import numpy as np

# Importar predictor adaptativo
sys.path.insert(0, str(Path(__file__).parent))
from predictor_adaptive import TarantulaHawkAdaptivePredictor
from explicabilidad_transactions import TransactionExplainer

# Paths
BASE_DIR = Path(__file__).parent.parent
PENDING_DIR = BASE_DIR / "outputs" / "enriched" / "pending"
PROCESSED_DIR = BASE_DIR / "outputs" / "enriched" / "processed"
FAILED_DIR = BASE_DIR / "outputs" / "enriched" / "failed"

for d in [PENDING_DIR, PROCESSED_DIR, FAILED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def process_file(csv_path: Path, predictor: TarantulaHawkAdaptivePredictor) -> bool:
    """Procesa CSV enriquecido y genera resultados con Score EBR"""
    
    analysis_id = csv_path.stem
    log(f"\n{'='*70}")
    log(f"📄 Procesando: {csv_path.name}")
    log(f"{'='*70}")
    
    try:
        df = pd.read_csv(csv_path)
        log(f"   Cargado: {len(df)} filas, {len(df.columns)} columnas")
        
        cliente_ids_originales = df["cliente_id"].copy() if "cliente_id" in df.columns else None
        
        # Ejecutar predictor
        log(f"\n   🤖 Ejecutando TarantulaHawk Adaptive Predictor...")
        predictions, probas, meta_pred = predictor.predict_adaptive(
            df, return_probas=True, return_metadata=True
        )
        
        # Clasificación
        preocupante = (predictions == "preocupante").sum()
        inusual = (predictions == "inusual").sum()
        relevante = (predictions == "relevante").sum()
        total = len(predictions)
        
        log(f"\n   📊 CLASIFICACIÓN:")
        log(f"      🔴 Preocupante: {preocupante} ({preocupante/total*100:.1f}%)")
        log(f"      🟠 Inusual: {inusual} ({inusual/total*100:.1f}%)")
        log(f"      🟡 Relevante: {relevante} ({relevante/total*100:.1f}%)")
        
        guardrails_count = meta_pred.get("guardrails_applied", 0) if isinstance(meta_pred, dict) else 0
        log(f"      🛡️  Guardrails aplicados: {guardrails_count}")
        
        # ✅ CALCULAR SCORE EBR (no confianza ML)
        log(f"\n   📊 Calculando Score EBR (Enfoque Basado en Riesgos)...")
        scores_ebr = []
        for idx, row in df.iterrows():
            triggers = predictor._get_rule_triggers(row, df) if hasattr(predictor, "_get_rule_triggers") else []
            score = predictor.calcular_score_ebr(row, triggers, df) if hasattr(predictor, "calcular_score_ebr") else 0.5
            scores_ebr.append(score)
        
        scores_ebr = np.array(scores_ebr)
        
        # Generar transacciones para JSON
        transacciones = []
        strategy = str(meta_pred.get("strategy", "unknown")) if isinstance(meta_pred, dict) else "unknown"
        
        classes = None
        if probas is not None and getattr(predictor, "model", None) is not None:
            try:
                classes = predictor.model.classes_
            except Exception:
                pass
        
        for i in range(min(100, len(df))):
            row = df.iloc[i]
            pred = predictions[i]
            
            proba_dict = {}
            if probas is not None and classes is not None:
                proba_dict = {cls: float(probas[i, j]) for j, cls in enumerate(classes)}
            
            triggers = predictor._get_rule_triggers(row, df) if hasattr(predictor, "_get_rule_triggers") else []
            
            # Determinar origen
            fue_corregido = any(t.startswith("guardrail_") for t in triggers)
            if fue_corregido:
                origen = "normativo"
            elif strategy == "rule_based":
                origen = "reglas"
            else:
                origen = "ml"
            
            razones_lista = []
            for t in triggers[:3]:
                if t.startswith("guardrail_"):
                    razones_lista.append("Umbral normativo LFPIORPI")
                elif t.startswith("inusual_"):
                    razones_lista.append(t.replace("inusual_", "").replace("_", " ").title())
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
                "score_ebr": float(scores_ebr[i]),  # ✅ Score EBR
                "razones": razones_lista,
                "triggers": triggers,
                "origen": origen
            })
        
        # Guardar JSON
        output_json = PROCESSED_DIR / f"{analysis_id}.json"
        results = {
            "success": True,
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "resumen": {
                "total_transacciones": int(total),
                "preocupante": int(preocupante),
                "inusual": int(inusual),
                "relevante": int(relevante),
                "estrategia": strategy,
                "score_ebr_promedio": float(scores_ebr.mean()),
                "indicadores": {
                    "guardrails_aplicados": int(guardrails_count),
                }
            },
            "transacciones": transacciones
        }
        
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        log(f"\n✅ Resultados guardados: {output_json.name}")
        
        # Guardar CSV
        if cliente_ids_originales is not None and "cliente_id" not in df.columns:
            df.insert(0, "cliente_id", cliente_ids_originales)
        
        df["clasificacion"] = predictions
        df["score_ebr"] = scores_ebr  # ✅ Score EBR en CSV
        
        # Detectar guardrails
        def fue_corregido_por_guardrail(row):
            fraccion = str(row.get('fraccion', '_'))
            monto = float(row.get('monto', 0))
            es_efectivo = int(row.get('EsEfectivo', 0))
            monto_6m = float(row.get('monto_6m', 0))
            clasificacion = str(row.get('clasificacion', ''))
            
            if clasificacion != 'preocupante':
                return False
            
            UMA = predictor.UMA
            umbral_aviso = predictor._get_umbral_mxn(fraccion, "aviso_UMA")
            umbral_efectivo = predictor._get_umbral_mxn(fraccion, "efectivo_max_UMA")
            
            if monto >= umbral_aviso:
                return True
            if es_efectivo == 1 and monto >= umbral_efectivo:
                return True
            if monto < umbral_aviso and monto_6m >= umbral_aviso:
                return True
            
            return False
        
        df["fue_corregido_por_guardrail"] = df.apply(fue_corregido_por_guardrail, axis=1)
        
        # Determinar origen
        def determinar_origen(row):
            if row['fue_corregido_por_guardrail']:
                return "normativo"
            if strategy == "rule_based":
                return "reglas"
            return "ml"
        
        df["origen"] = df.apply(determinar_origen, axis=1)
        
        # Razones
        def get_razones(row_idx):
            row = df.iloc[row_idx]
            if row['fue_corregido_por_guardrail']:
                return "Umbral normativo LFPIORPI"
            
            triggers = predictor._get_rule_triggers(row, df) if hasattr(predictor, "_get_rule_triggers") else []
            razones = []
            for t in triggers[:3]:
                if t.startswith("inusual_"):
                    razones.append(t.replace("inusual_", "").replace("_", " ").title())
                else:
                    razones.append(t.replace("_", " ").title())
            return "; ".join(razones) if razones else ""
        
        df["razones"] = [get_razones(i) for i in range(len(df))]
        
        n_guardrails = int(df["fue_corregido_por_guardrail"].sum())
        
        log(f"   ✅ Clasificación final (con guardrails LFPIORPI) aplicada")
        log(f"   🛡️  Guardrails aplicaron: {n_guardrails} transacciones")
        log(f"   📊 Distribución por origen: {Counter(df['origen'])}")
        log(f"   📈 Score EBR promedio: {scores_ebr.mean():.3f}")
        
        # ✅ SISTEMA DE EXPLICABILIDAD
        log(f"\n   🔍 Generando metadata de explicabilidad...")
        
        explainer = TransactionExplainer(umbral_confianza_bajo=0.4)
        metadata_list = []
        
        for idx, row in df.iterrows():
            triggers = predictor._get_rule_triggers(row, df) if hasattr(predictor, "_get_rule_triggers") else []
            
            # Aquí el "score" es EBR, no confianza ML
            metadata = explainer.explicar_transaccion(row, None, triggers)
            
            # Reemplazar score_confianza con score_ebr
            metadata["score_ebr"] = float(scores_ebr[idx])
            metadata["score_confianza"] = float(scores_ebr[idx])  # Mantener compatibilidad
            
            metadata_list.append(metadata)
        
        # Guardar metadata JSON
        metadata_json_path = PROCESSED_DIR / f"{analysis_id}_metadata.json"
        with open(metadata_json_path, 'w', encoding='utf-8') as f:
            json.dump({
                "analysis_id": analysis_id,
                "timestamp": datetime.now().isoformat(),
                "transacciones": [
                    {
                        "index": i,
                        "cliente_id": str(df.iloc[i]['cliente_id']),
                        **metadata_list[i]
                    }
                    for i in range(len(df))
                ]
            }, f, indent=2, ensure_ascii=False)
        
        log(f"   ✅ Metadata guardada: {metadata_json_path.name}")
        
        # Guardar CSV
        processed_csv = PROCESSED_DIR / csv_path.name
        df.to_csv(processed_csv, index=False, encoding='utf-8')
        log(f"✅ CSV guardado: processed/{csv_path.name}")
        
        csv_path.unlink()
        
        return True
        
    except Exception as e:
        log(f"\n❌ ERROR: {str(e)}")
        traceback.print_exc()
        
        failed_csv = FAILED_DIR / csv_path.name
        shutil.move(str(csv_path), str(failed_csv))
        
        error_json = FAILED_DIR / f"{analysis_id}_error.json"
        with open(error_json, 'w') as f:
            json.dump({
                "success": False,
                "analysis_id": analysis_id,
                "error": str(e),
                "traceback": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        
        return False

def main():
    log("\n" + "="*70)
    log("🚀 ML RUNNER - VERSIÓN FINAL")
    log("="*70)
    
    log("\n📦 Inicializando Predictor...")
    try:
        predictor = TarantulaHawkAdaptivePredictor(base_dir=str(BASE_DIR), verbose=True)
    except Exception as e:
        log(f"❌ Error: {e}")
        return 1
    
    if len(sys.argv) > 1:
        analysis_id = sys.argv[1]
        csv_file = PENDING_DIR / f"{analysis_id}.csv"
        
        if not csv_file.exists():
            log(f"❌ Archivo no encontrado: {csv_file}")
            return 1
        
        files_to_process = [csv_file]
    else:
        files_to_process = list(PENDING_DIR.glob("*.csv"))
    
    if not files_to_process:
        log("\nℹ️  No hay archivos pendientes")
        return 0
    
    log(f"\n📋 Archivos a procesar: {len(files_to_process)}")
    
    success_count = 0
    failed_count = 0
    
    for csv_path in files_to_process:
        if process_file(csv_path, predictor):
            success_count += 1
        else:
            failed_count += 1
    
    log("\n" + "="*70)
    log("📊 RESUMEN")
    log("="*70)
    log(f"✅ Exitosos: {success_count}")
    log(f"❌ Fallidos: {failed_count}")
    log(f"📁 Resultados en: {PROCESSED_DIR}")
    log("="*70 + "\n")
    
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main())