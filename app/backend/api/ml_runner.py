#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ml_runner.py - Runner de inferencia para archivos enriquecidos

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
import pandas as pd

# Importar predictor
sys.path.insert(0, str(Path(__file__).parent / "utils"))
from predictor import TarantulaHawkPredictor

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

def process_file(csv_path: Path, predictor: TarantulaHawkPredictor) -> bool:
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
        
        # Ejecutar predictor ML (incluye 3 capas + guardrails)
        log(f"\n   🤖 Ejecutando TarantulaHawk Predictor...")
        pred_out = predictor.predict(df, return_probas=True, return_scores=True)
        if isinstance(pred_out, tuple) and len(pred_out) == 3:
            predictions, probas, scores = pred_out
        else:
            predictions, probas = pred_out
            scores = None
        
        # Clasificación
        preocupante = (predictions == "preocupante").sum()
        inusual = (predictions == "inusual").sum()
        relevante = (predictions == "relevante").sum()
        total = len(predictions)
        
        log(f"\n   📊 CLASIFICACIÓN:")
        log(f"      🔴 Preocupante: {preocupante} ({preocupante/total*100:.1f}%)")
        log(f"      🟠 Inusual: {inusual} ({inusual/total*100:.1f}%)")
        log(f"      🟡 Relevante: {relevante} ({relevante/total*100:.1f}%)")
        
        # Generar detalle de transacciones (primeras 100)
        transacciones = []
        
        flags_unsup = None
        try:
            flags_unsup = predictor.get_unsupervised_flags()
        except Exception:
            flags_unsup = None

        for i in range(min(100, len(df))):
            row = df.iloc[i]
            pred = predictions[i]
            
            # Obtener probabilidades por clase
            classes = predictor.model.classes_
            proba_dict = {cls: float(probas[i, j]) for j, cls in enumerate(classes)}
            anomaly_score = float(scores[i]) if scores is not None else None
            nota = None
            if flags_unsup is not None:
                try:
                    if bool(flags_unsup[i]):
                        nota = "nuevos casos detectados por AI no_supervisado, validarlo manualmente"
                except Exception:
                    pass
            
            transacciones.append({
                "id": f"TXN-{i+1:05d}",
                "monto": float(row.get("monto", 0)),
                "fecha": str(row.get("fecha", "")),
                "tipo_operacion": str(row.get("tipo_operacion", "")),
                "sector_actividad": str(row.get("sector_actividad", "")),
                "clasificacion": pred,
                "probabilidades": proba_dict,
                "anomaly_score": anomaly_score,
                "nota": nota
            })
        
        # Guardar resultados
        output_json = PROCESSED_DIR / f"{analysis_id}.json"
        ai_new = int(flags_unsup.sum()) if isinstance(flags_unsup, (list, tuple, set,)) or hasattr(flags_unsup, 'sum') else 0
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
                "ai_nuevos_casos": int(ai_new)
            },
            "transacciones": transacciones,
            "metadata": {
                "input_file": csv_path.name,
                "model_info": predictor.get_model_info()
            }
        }
        
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        log(f"\n✅ Resultados guardados: {output_json.name}")
        
        # Mover CSV a processed/
        processed_csv = PROCESSED_DIR / csv_path.name
        shutil.move(str(csv_path), str(processed_csv))
        log(f"✅ CSV movido a: processed/{csv_path.name}")
        
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
    log("\n📦 Inicializando TarantulaHawk Predictor...")
    try:
        predictor = TarantulaHawkPredictor(base_dir=str(BASE_DIR), verbose=True)
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
