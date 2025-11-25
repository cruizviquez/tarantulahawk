#!/usr/bin/env python3
"""
Test script para verificar la integración de calcular_score_ebr
"""
import sys
import os
sys.path.insert(0, '/workspaces/tarantulahawk/app/backend/api')

import pandas as pd
from predictor_adaptive import TarantulaHawkAdaptivePredictor

def test_calcular_score_ebr():
    print('🧪 Probando función calcular_score_ebr integrada...')

    # Crear predictor
    predictor = TarantulaHawkAdaptivePredictor(verbose=False)

    # Datos de prueba
    test_row = pd.Series({
        'monto': 150000.0,
        'EsEfectivo': 1,
        'EsInternacional': 0,
        'es_monto_redondo': 1,
        'SectorAltoRiesgo': 0,
        'es_nocturno': 1,
        'fin_de_semana': 0,
        'ops_6m': 5,
        'monto_6m': 500000.0,
        'ratio_vs_promedio': 2.5,
        'monto_std_6m': 25000.0,
        'frecuencia_mensual': 3.0,
        'fraccion': 'A',
        'posible_burst': 0
    })

    triggers = ['inusual_monto_alto']
    df = pd.DataFrame()

    # Calcular score EBR
    score = predictor.calcular_score_ebr(test_row, triggers, df)

    print(f'✅ Score EBR calculado: {score:.3f}')
    print('✅ Función EBR funcionando correctamente')

    # Verificar que el score está en rango válido
    assert 0.0 <= score <= 1.0, f"Score fuera de rango: {score}"
    print('✅ Score en rango válido [0, 1]')

    return True

if __name__ == "__main__":
    test_calcular_score_ebr()
    print('🎉 Todos los tests pasaron exitosamente!')