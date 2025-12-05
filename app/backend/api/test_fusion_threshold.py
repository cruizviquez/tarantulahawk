from app.backend.api.ml_runner_ant import fusionar_clasificaciones, cargar_config


def run_test():
    cfg = cargar_config()
    # Row ML= 'relevante', EBR score = 60 -> expect elevation to 'inusual'
    row = {
        'clasificacion_ml': 'relevante',
        'clasificacion_ebr': 'inusual',
        'score_ebr': 60.0,
        'ica': 0.95,
    }
    res = fusionar_clasificaciones(row, cfg)
    print('fusion result:', res)
    assert res['clasificacion_final'] == 'inusual', 'Expected elevation to inusual at 60'
    print('test_fusion_threshold OK')

if __name__ == '__main__':
    run_test()
