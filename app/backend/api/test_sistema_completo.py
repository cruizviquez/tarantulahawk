#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_sistema_completo_FINAL.py - Prueba Integrada del Sistema

Prueba el sistema completo:
1. Predictor adaptativo (EBR + ML siempre)
2. Matriz de riesgo
3. Alertas y recomendaciones
4. Output JSON enriquecido

Autor: TarantulaHawk Team
Fecha: 2025-11-14
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from predictor_adaptive import TarantulaHawkPredictorFinal
from explicabilidad_transactions import ExplicabilidadEnriquecida
import pandas as pd
import numpy as np
import json

def crear_dataset_prueba(n: int = 200) -> pd.DataFrame:
    """Crea dataset sintético de prueba"""
    np.random.seed(42)
    
    df = pd.DataFrame({
        "cliente_id": [f"CLT{i:05d}" for i in range(n)],
        "monto": np.random.lognormal(10, 2, n),
        "fecha": ["2025-01-15"] * n,
        "tipo_operacion": np.random.choice(["efectivo", "transferencia_nacional", "tarjeta"], n),
        "sector_actividad": ["joyeria_metales"] * n,
        "fraccion": ["XI_joyeria"] * n,
        "EsEfectivo": np.random.binomial(1, 0.3, n),
        "EsInternacional": np.random.binomial(1, 0.2, n),
        "SectorAltoRiesgo": np.zeros(n, dtype=int),
        "es_monto_redondo": np.random.binomial(1, 0.1, n),
        "mes": np.random.randint(1, 13, n),
        "dia_semana": np.random.randint(0, 7, n),
        "quincena": np.random.randint(0, 2, n),
        "frecuencia_mensual": np.ones(n),
        "monto_6m": np.random.lognormal(10, 2, n),
        "ops_6m": np.ones(n),
        "monto_max_6m": np.random.lognormal(10, 2, n),
        "monto_std_6m": np.random.lognormal(8, 1, n),
        "ops_relativas": np.random.uniform(0.001, 0.02, n),
        "diversidad_operaciones": np.random.uniform(0.2, 1.0, n),
        "concentracion_temporal": np.random.uniform(0.3, 1.0, n),
        "ratio_vs_promedio": np.random.lognormal(0, 1, n)
    })
    
    # Agregar algunas transacciones que activen guardrails
    df.loc[0, "monto"] = 5000000  # Guardrail aviso
    df.loc[1, "monto"] = 200000
    df.loc[1, "EsEfectivo"] = 1  # Guardrail efectivo
    df.loc[2, "monto"] = 150000
    df.loc[2, "monto_6m"] = 400000  # Guardrail acumulación
    
    return df

def print_estadisticas_basicas(predictions, probas, scores, metadata):
    """Imprime estadísticas básicas del resultado"""
    print("\n" + "="*70)
    print("📊 ESTADÍSTICAS BÁSICAS")
    print("="*70)
    
    print(f"\n🎯 Estrategia usada: {metadata['estrategia_clasificacion'].upper()}")
    print(f"   n = {metadata['n_transacciones']} (umbral ML: {metadata['umbral_ml_usado']})")
    
    print("\n📈 ÍNDICE EBR:")
    ebr = metadata['ebr']
    print(f"   Score promedio: {ebr['score_promedio']:.3f}")
    print(f"   Score rango: [{ebr['score_min']:.3f}, {ebr['score_max']:.3f}]")
    print(f"   Distribución:")
    for clase, count in ebr['distribucion_ebr'].items():
        pct = count / metadata['n_transacciones'] * 100
        print(f"      {clase:12s}: {count:3d} ({pct:5.1f}%)")
    
    if metadata['ml']['disponible']:
        print("\n🤖 MODELO ML:")
        ml = metadata['ml']
        print(f"   Confianza promedio: {ml['confianza_promedio']:.1%}")
        print(f"   Distribución:")
        for clase, count in ml['distribucion_ml'].items():
            pct = count / metadata['n_transacciones'] * 100
            print(f"      {clase:12s}: {count:3d} ({pct:5.1f}%)")
    
    print("\n🛡️  GUARDRAILS:")
    guardrails = metadata['guardrails']
    print(f"   Aplicados: {guardrails['aplicados']}")
    
    if metadata['ml']['disponible']:
        print("\n⚠️  DISCREPANCIAS EBR vs ML:")
        disc = metadata['discrepancias_ebr_ml']
        print(f"   Total: {disc['total']} ({disc['porcentaje']:.1f}%)")
    
    print("\n✅ CLASIFICACIÓN FINAL:")
    final = metadata['clasificacion_final']
    for clase, count in final['distribucion'].items():
        pct = count / metadata['n_transacciones'] * 100
        print(f"   {clase:12s}: {count:3d} ({pct:5.1f}%)")

def mostrar_casos_interesantes(df, predictions, probas, scores, metadata, explicador):
    """Muestra casos interesantes para análisis"""
    print("\n" + "="*70)
    print("🔍 CASOS INTERESANTES")
    print("="*70)
    
    # Caso 1: Guardrail activado
    idx_guardrail = 0
    print(f"\n1️⃣ CASO: Guardrail Activado (idx={idx_guardrail})")
    print("-" * 70)
    
    row = df.iloc[idx_guardrail]
    pred_final = predictions[idx_guardrail]
    pred_ebr = metadata['ebr']['clasificacion_ebr'][idx_guardrail]
    pred_ml = metadata['ml']['clasificacion_ml'][idx_guardrail] if metadata['ml']['disponible'] else None
    score = scores[idx_guardrail]
    
    explicacion = explicador.generar_explicacion_transaccion(
        row=row,
        idx=idx_guardrail,
        prediccion_final=pred_final,
        prediccion_ebr=pred_ebr,
        prediccion_ml=pred_ml,
        score_ebr=score,
        probas_ml=probas[idx_guardrail] if probas is not None else None,
        classes_ml=["preocupante", "inusual", "relevante"] if probas is not None else None,
        es_guardrail=True,
        trigger_guardrail=metadata['guardrails']['triggers'][idx_guardrail],
        triggers_ebr=[],
        estrategia=metadata['estrategia_clasificacion']
    )
    
    print(f"   Monto: {explicacion['datos_transaccion']['monto']}")
    print(f"   {explicacion['nivel_riesgo_consolidado']['emoji']} Nivel: {explicacion['nivel_riesgo_consolidado']['nivel'].upper()}")
    print(f"   Acción: {explicacion['nivel_riesgo_consolidado']['accion']}")
    print(f"   Plazo: {explicacion['nivel_riesgo_consolidado']['plazo']}")
    
    if explicacion['alertas']:
        print(f"\n   ⚠️  Alertas ({len(explicacion['alertas'])}):")
        for nombre, alerta in explicacion['alertas'].items():
            print(f"      - {alerta['titulo']}")
    
    # Caso 2: Discrepancia EBR vs ML (si existe)
    if metadata['ml']['disponible'] and metadata['discrepancias_ebr_ml']['total'] > 0:
        # Buscar primera discrepancia
        ebr_list = metadata['ebr']['clasificacion_ebr']
        ml_list = metadata['ml']['clasificacion_ml']
        
        idx_disc = None
        for i in range(len(ebr_list)):
            if ebr_list[i] != ml_list[i]:
                idx_disc = i
                break
        
        if idx_disc:
            print(f"\n2️⃣ CASO: Discrepancia EBR vs ML (idx={idx_disc})")
            print("-" * 70)
            
            row = df.iloc[idx_disc]
            pred_final = predictions[idx_disc]
            pred_ebr = ebr_list[idx_disc]
            pred_ml = ml_list[idx_disc]
            score = scores[idx_disc]
            
            explicacion = explicador.generar_explicacion_transaccion(
                row=row,
                idx=idx_disc,
                prediccion_final=pred_final,
                prediccion_ebr=pred_ebr,
                prediccion_ml=pred_ml,
                score_ebr=score,
                probas_ml=probas[idx_disc] if probas is not None else None,
                classes_ml=["preocupante", "inusual", "relevante"] if probas is not None else None,
                es_guardrail=False,
                trigger_guardrail="",
                triggers_ebr=[],
                estrategia=metadata['estrategia_clasificacion']
            )
            
            print(f"   Monto: {explicacion['datos_transaccion']['monto']}")
            print(f"   EBR: {pred_ebr} | ML: {pred_ml}")
            print(f"   {explicacion['nivel_riesgo_consolidado']['emoji']} Nivel: {explicacion['nivel_riesgo_consolidado']['nivel'].upper()}")
            
            if 'discrepancia_ebr_ml' in explicacion['alertas']:
                alerta = explicacion['alertas']['discrepancia_ebr_ml']
                print(f"\n   {alerta['icono']} {alerta['titulo']}")
                print(f"   {alerta['mensaje']}")

def guardar_resultados_json(df, predictions, probas, scores, metadata, explicador, output_path):
    """Guarda resultados completos en JSON"""
    print("\n" + "="*70)
    print("💾 GUARDANDO RESULTADOS")
    print("="*70)
    
    resultados = {
        "success": True,
        "timestamp": pd.Timestamp.now().isoformat(),
        "metadata": metadata,
        "transacciones": []
    }
    
    # Generar explicación para primeras 100 transacciones
    for i in range(min(100, len(df))):
        row = df.iloc[i]
        pred_final = predictions[i]
        pred_ebr = metadata['ebr']['clasificacion_ebr'][i]
        pred_ml = metadata['ml']['clasificacion_ml'][i] if metadata['ml']['disponible'] else None
        score = scores[i]
        
        es_guardrail = metadata['guardrails']['triggers'][i] != ""
        trigger = metadata['guardrails']['triggers'][i]
        
        explicacion = explicador.generar_explicacion_transaccion(
            row=row,
            idx=i,
            prediccion_final=pred_final,
            prediccion_ebr=pred_ebr,
            prediccion_ml=pred_ml,
            score_ebr=score,
            probas_ml=probas[i] if probas is not None else None,
            classes_ml=["preocupante", "inusual", "relevante"] if probas is not None else None,
            es_guardrail=es_guardrail,
            trigger_guardrail=trigger,
            triggers_ebr=[],
            estrategia=metadata['estrategia_clasificacion']
        )
        
        resultados["transacciones"].append(explicacion)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(resultados, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Resultados guardados: {output_path}")
    print(f"   Total transacciones: {len(resultados['transacciones'])}")

def main():
    """Función principal de prueba"""
    print("\n" + "="*70)
    print("🚀 TEST SISTEMA COMPLETO - TARANTULAHAWK FINAL")
    print("="*70)
    
    # 1. Crear dataset de prueba
    print("\n1️⃣ Creando dataset de prueba...")
    df = crear_dataset_prueba(n=200)
    print(f"   ✅ Dataset creado: {len(df)} transacciones")
    
    # 2. Inicializar predictor
    print("\n2️⃣ Inicializando predictor...")
    predictor = TarantulaHawkPredictorFinal(verbose=False)
    print(f"   ✅ Predictor inicializado")
    
    # 3. Ejecutar predicción
    print("\n3️⃣ Ejecutando predicción adaptativa...")
    predictions, probas, scores, metadata = predictor.predict(df, return_metadata=True)
    print(f"   ✅ Predicción completada")
    
    # 4. Mostrar estadísticas
    print_estadisticas_basicas(predictions, probas, scores, metadata)
    
    # 5. Inicializar explicador
    explicador = ExplicabilidadEnriquecida()
    
    # 6. Mostrar casos interesantes
    mostrar_casos_interesantes(df, predictions, probas, scores, metadata, explicador)
    
    # 7. Guardar resultados
    output_path = Path(__file__).parent / "test_resultados_FINAL.json"
    guardar_resultados_json(df, predictions, probas, scores, metadata, explicador, output_path)
    
    print("\n" + "="*70)
    print("✅ TEST COMPLETADO EXITOSAMENTE")
    print("="*70)
    print(f"\n📁 Archivo generado: {output_path}")
    print("\n💡 Revisa el JSON para ver:")
    print("   - Clasificaciones EBR + ML")
    print("   - Niveles de riesgo consolidados")
    print("   - Alertas de discrepancias")
    print("   - Recomendaciones accionables")
    print("\n")

if __name__ == "__main__":
    main()