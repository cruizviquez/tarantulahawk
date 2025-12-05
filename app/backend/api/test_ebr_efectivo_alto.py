import json
from pathlib import Path
from app.backend.api.ml_runner_ant import calcular_ebr_ponderado, cargar_config


def run_test():
    cfg = cargar_config()
    # Choose a specific fraccion with efectivo_max_UMA > 0 from config
    uma_mxn = cfg.get('lfpiorpi', {}).get('uma_mxn', 113.14)
    umbrales_cfg = cfg.get('lfpiorpi', {}).get('umbrales', {})
    specific_fraccion = None
    for k, v in umbrales_cfg.items():
        if not str(k).startswith('_') and float(v.get('efectivo_max_UMA', 0) or 0) > 0:
            specific_fraccion = k
            umbral_efectivo_umas = float(v.get('efectivo_max_UMA'))
            break
    assert specific_fraccion is not None, 'No specific fraccion with efectivo_max_UMA found in config for test'
    umbral_efectivo_mxn = umbral_efectivo_umas * uma_mxn

    # monto just below the threshold (70%) -> should not trigger efectivo_alto
    monto_low = umbral_efectivo_mxn * 0.70
    row_low = {
        'monto': monto_low,
        'EsEfectivo': 1,
        'fraccion': specific_fraccion,
        'sector_actividad': 'joyeria_metales'
    }

    score_low, factors_low = calcular_ebr_ponderado(row_low, cfg)

    # monto at 80% -> should trigger efectivo_alto
    monto_high = umbral_efectivo_mxn * 0.80
    row_high = {
        'monto': monto_high,
        'EsEfectivo': 1,
        'fraccion': specific_fraccion,
        'sector_actividad': 'joyeria_metales'
    }

    score_high, factors_high = calcular_ebr_ponderado(row_high, cfg)

    print('score_low:', score_low, 'factors_low:', factors_low)
    print('score_high:', score_high, 'factors_high:', factors_high)

    assert score_high - score_low >= 15 - 1e-6, 'efectivo_alto weight was not applied'
    assert any('Efectivo cercano' in f or 'Operación en efectivo ALTA' in f or 'Efectivo alto' in f for f in factors_high), 'efectivo_alto reason missing'

    print('test_ebr_efectivo_alto OK')

    # Now test that for general fraccion (_general) we DO NOT get 'efectivo_alto'
    # Use the _general umbral from config
    umbral_efectivo_umas_general = cfg.get('lfpiorpi', {}).get('umbrales', {}).get('_general', {}).get('efectivo_max_UMA', 8025)
    umbral_efectivo_mxn_general = umbral_efectivo_umas_general * uma_mxn
    monto_high_general = umbral_efectivo_mxn_general * 0.80
    row_high_general = {
        'monto': monto_high_general,
        'EsEfectivo': 1,
        'fraccion': '_general',
        'sector_actividad': 'servicios_generales'
    }
    score_general, factors_general = calcular_ebr_ponderado(row_high_general, cfg)
    print('score_general_high:', score_general, 'factors_general:', factors_general)
    assert not any('Efectivo alto' in f or 'Efectivo cercano' in f for f in factors_general), 'efectivo_alto should NOT be applied to _general fraccion'
    print('test_ebr_efectivo_alto: _general check OK')


if __name__ == '__main__':
    run_test()
