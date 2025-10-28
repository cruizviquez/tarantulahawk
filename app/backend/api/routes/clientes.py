from fastapi import APIRouter

router = APIRouter()

@router.post("/identificacion")
async def identificacion(payload: dict):
    return {"status": "ok", "accion": "identificación registrada", "datos": payload}

@router.post("/beneficiario-controlador")
async def beneficiario(payload: dict):
    return {"status": "ok", "accion": "beneficiario/controlador registrado"}

@router.get("/{id}/perfil-riesgo")
async def perfil_riesgo(id: str):
    return {"id_cliente": id, "riesgo": "Medio", "ultima_evaluacion": "2025-09-01"}

@router.put("/{id}/actualizacion")
async def actualizacion(id: str, payload: dict):
    return {"status": "actualizado", "id_cliente": id, "nuevos_datos": payload}
