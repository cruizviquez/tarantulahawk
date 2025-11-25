from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import pandas as pd
import joblib
from api.utils.validador_cumplimiento import validar_lfpiorpi_datos
from api.utils.generar_xml import generar_xml_avisos
from explicabilidad_transactions import TransactionExplainer

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

    # Asignar clasificación textual (ejemplo: preocupante/inusual/relevante)
    df["clasificacion"] = df["pred_es_sospechoso"].map({1: "preocupante", 0: "relevante"})

    # Score EBR: aquí usamos la probabilidad como score_ebr (ajustar si hay lógica específica)
    df["score_ebr"] = prob

    # Triggers principales: para demo, solo ponemos un trigger dummy; en producción, usar lógica real
    explainer = TransactionExplainer()
    explicaciones = []
    for _, row in df.iterrows():
        # Aquí deberías obtener triggers reales; usamos ejemplo fijo para demo
        triggers = ["guardrail_aviso_umbral"] if row["pred_es_sospechoso"] == 1 else ["inusual_monto_rango_alto"]
        explicacion = explainer.explicar_transaccion(
            row, 
            row["score_ebr"],  # score_ebr
            triggers,  # triggers
            "ml",  # origen
            None  # probas_ml
        )
        explicaciones.append({
            "clasificacion": explicacion["clasificacion"],
            "score_ebr": explicacion["score_ebr"],
            "triggers_principales": explicacion["triggers_principales"],
            "accion_sugerida": explicacion["accion_sugerida"]
        })

    salida = OUT_DIR / "predicciones_supervisado.csv"
    df.to_csv(salida, index=False)

    # 🚨 Si hay preocupantes, generar XML automáticamente
    sospechosas = df[df["clasificacion"] == "preocupante"]
    xml_path = None
    if not sospechosas.empty:
        xml_path = generar_xml_avisos(sospechosas)

    return JSONResponse({
        "status": "ok",
        "total_registros": len(df),
        "umbral_usado": umbral,
        "archivo_resultado": str(salida),
        "archivo_xml": str(xml_path) if xml_path else None,
        "clasificaciones": explicaciones
    })

@router.post("/validar-umbrales")
async def validar(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)
    res = validar_lfpiorpi_datos(df)
    return res
