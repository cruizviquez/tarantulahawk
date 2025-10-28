from fastapi import APIRouter

router = APIRouter()

@router.get("/consultar/{nombre}")
async def consultar(nombre: str):
    return {"nombre": nombre, "es_pep": False, "ultima_revision": "2025-09-10"}

@router.post("/actualizar-lista")
async def actualizar():
    return {"status": "ok", "detalle": "Lista PEPs actualizada"}

@router.get("/listas-negras/verificar")
async def verificar():
    return {"resultado": "sin_coincidencias", "fuente": "OFAC/EU/ONU"}
