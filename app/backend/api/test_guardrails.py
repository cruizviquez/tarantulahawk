from app.backend.api.ml_runner_ant import verificar_guardrail, cargar_config


def run_test():
    cfg = cargar_config()
    uma_mxn = cfg.get('lfpiorpi', {}).get('uma_mxn', 113.14)

    # _general fraccion should NOT activate guardrails even if monto exceeds _general umbral
    umbral_general_umas = cfg.get('lfpiorpi', {}).get('umbrales', {}).get('_general', {}).get('aviso_UMA', 645)
    umbral_general_mxn = umbral_general_umas * uma_mxn

    row = {
        'monto': umbral_general_mxn * 1.5,
        'fraccion': '_general',
        'EsEfectivo': 1,
    }
    active, reason = verificar_guardrail(row, cfg)
    print('general guardrail:', active, reason)
    assert not active, 'guardrail should not be applied for _general fraccion'

    # Now test with a specific fraccion that should trigger guardrail
    # Find any fraccion in config that is not _general
    umbrales = cfg.get('lfpiorpi', {}).get('umbrales', {})
    specific_fr = None
    for k in umbrales.keys():
        if not str(k).startswith('_'):
            specific_fr = k
            break
    assert specific_fr is not None, 'No specific fraccion found in config to run guardrail test'

    umbral_umas = umbrales.get(specific_fr, {}).get('aviso_UMA', 645)
    umbral_mxn = umbral_umas * uma_mxn
    row2 = {
        'monto': umbral_mxn * 1.1,
        'fraccion': specific_fr,
        'EsEfectivo': 1,
    }
    active2, reason2 = verificar_guardrail(row2, cfg)
    print('specific guardrail:', active2, reason2)
    assert active2, 'guardrail should be applied for specific fraccion when exceeding threshold'

    print('test_guardrails OK')


if __name__ == '__main__':
    run_test()
