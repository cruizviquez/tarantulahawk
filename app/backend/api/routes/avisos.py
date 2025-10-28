from fastapi import APIRouter, UploadFile, File, HTTPException
from api.utils.generar_xml import generar_xml_avisos
from pathlib import Path
import pandas as pd

router = APIRouter()
OUT_DIR = Path(__file__).resolve().parent.parent / "outputs"

@router.post("/generar-xml")
async def generar_xml(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)
    sospechosas = df[df.get("pred_es_sospechoso", 0) == 1]
    if sospechosas.empty:
        raise HTTPException(status_code=400, detail="No hay operaciones sospechosas para generar XML")

    xml_path = generar_xml_avisos(sospechosas)
    return {"status": "ok", "archivo_xml": str(xml_path)}

@router.get("/historico")
async def historico():
    avisos = list((OUT_DIR / "avisos").glob("*.xml"))
    return {"total_avisos": len(avisos), "archivos": [str(a) for a in avisos]}

@router.post("/enviar-shcp")
async def enviar(payload: dict):
    return {"status": "enviado", "acuse": "ACUSE12345", "fecha": "2025-10-17"}
