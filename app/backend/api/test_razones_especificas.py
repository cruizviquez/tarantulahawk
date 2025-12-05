from app.backend.api.explicabilidad_transactions_v4 import _generar_razones_especificas

def run_test():
    tx = {
        'monto': 1000000,  # large amount to exceed umbral
        'sector_actividad': 'joyeria_metales',
        'fraccion': 'XI_joyeria',
        'EsEfectivo': 1,
        'monto_6m': 1200000,
        'EsInternacional': 0,
        'es_nocturno': 0,
        'ratio_vs_promedio': 1.0,
    }
    razones = _generar_razones_especificas(tx)
    print('Razones:', razones)
    assert any('Rebasó umbral de aviso' in r or 'Rebasó umbral' in r for r in razones), 'UMAs rebasado reason missing'
    assert any('joyeria' in r.lower() or 'fracc.' in r.lower() or 'fracc' in r.lower() for r in razones), 'Sector fracc reason missing'
    assert any('Acumulado 6 meses' in r or 'Acumulado' in r for r in razones), 'Acumulado 6m reason missing'
    print('test_razones_especificas OK')

if __name__ == '__main__':
    run_test()
