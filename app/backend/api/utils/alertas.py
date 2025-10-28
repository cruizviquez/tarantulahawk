from fastapi import APIRouter

router = APIRouter()

@router.get("/activas")
async def activas():
    return {"alertas": [{"id": "A001", "riesgo": "Alto"}, {"id": "A002", "riesgo": "Medio"}]}

@router.post("/{id}/investigar")
async def investigar(id: str, payload: dict):
    return {"id_alerta": id, "accion": "investigación iniciada", "datos": payload}

@router.put("/{id}/resolver")
async def resolver(id: str):
    return {"id_alerta": id, "estado": "resuelta"}
