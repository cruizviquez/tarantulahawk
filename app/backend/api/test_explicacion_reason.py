from app.backend.api.explicabilidad_transactions_v4 import generar_explicacion_transaccion


def test_txn_29_reason_not_rebase():
    tx = {
        "cliente_id": "CLT69598",
        "monto": 160250.28,
        "fraccion": "XI_joyeria",
        "fecha": "2025-03-07",
        "tipo_operacion": "efectivo",
        "sector_actividad": "joyeria_metales",
        "EsEfectivo": 1,
        "monto_6m": 160250.28,
        "score_ebr": 50.0,
        "clasificacion": "relevante",
    }
    expl = generar_explicacion_transaccion(tx)
    razones = expl.get("razones_principales", [])
    assert isinstance(razones, list)
    # Ensure the reason does not state it rebasa umbral de aviso for XI_joyeria (which needs 3210 UMAs)
    assert not any("rebasa umbral de aviso" in r.lower() and "fracc" not in r.lower() for r in razones)
    print("test_explicacion_reason: OK", razones)


if __name__ == "__main__":
    test_txn_29_reason_not_rebase()
