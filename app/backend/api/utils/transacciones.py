from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import pandas as pd
import joblib
from api.utils.validador_cumplimiento import validar_lfpiorpi_datos
from api.utils.generar_xml import generar_xml_avisos

router = APIRouter()
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"
OUT_DIR = BASE_DIR / "outputs"

@router.post("/registro")
async def registro(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)
    return {"status": "ok", "registros": len(df)}

@router.post("/analisis")
async def analisis(file: UploadFile = File(...)):
    model_path = MODEL_DIR / "modelo_supervisado.pkl"
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    df = pd.read_csv(file.file)
    modelo_data = joblib.load(model_path)
    modelo = modelo_data["modelo"]
    umbral = modelo_data["umbral"]

    prob = modelo.predict_proba(df)[:, 1]
    pred = (prob >= umbral).astype(int)
    df["pred_es_sospechoso"] = pred

    sospechosas = df[df["pred_es_sospechoso"] == 1]
    salida = OUT_DIR / "predicciones_supervisado.csv"
    df.to_csv(salida, index=False)

    # 🚨 Si hay sospechosas, generar XML automáticamente
    xml_path = None
    if not sospechosas.empty:
        xml_path = generar_xml_avisos(sospechosas)

    return JSONResponse({
        "status": "ok",
        "total_registros": len(df),
        "operaciones_sospechosas": len(sospechosas),
        "umbral_usado": umbral,
        "archivo_resultado": str(salida),
        "archivo_xml": str(xml_path) if xml_path else None
    })

@router.post("/validar-umbrales")
async def validar(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)
    res = validar_lfpiorpi_datos(df)
    return res
