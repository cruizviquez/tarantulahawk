# main_api.py - COMPLETE PRODUCTION VERSION
"""
TarantulaHawk PLD API - Full Implementation
Supports both small users (portal upload) and large corporations (direct API)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, validator, Field
from typing import List, Optional, Dict, Any
import pandas as pd
import os
import shutil
from datetime import datetime, timedelta
import uuid
import json
import hashlib
import secrets
from pathlib import Path

# Use shared pricing utility that reads config/pricing.json
try:
    from app.backend.api.utils.pricing_tiers import PricingTier  # when run as a module
except Exception:
    try:
        from .utils.pricing_tiers import PricingTier  # relative import fallback
    except Exception:
        PricingTier = None  # final fallback; will use local calcular_costo

# Internal modules (from your existing code)
# from validador_enriquecedor import procesar_archivo, validar_estructura, enriquecer_features
# from sistema_deteccion_multinivel import ejecutar_sistema_multinivel
# from utils.generar_xml import generar_xml_uif

app = FastAPI(
    title="TarantulaHawk PLD API",
    description="API for AML/CFT Compliance - LFPIORPI 2025",
    version="3.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "https://tarantulahawk.ai",
        "https://*.app.github.dev",  # GitHub Codespaces
        "https://silver-funicular-wp59w7jgxvvf9j47-3000.app.github.dev"  # Current codespace
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory Structure
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
XML_DIR = OUTPUT_DIR / "xml"
REPORTS_DIR = OUTPUT_DIR / "reports"
HISTORY_DIR = Path("history")

for dir in [UPLOAD_DIR, OUTPUT_DIR, XML_DIR, REPORTS_DIR, HISTORY_DIR]:
    dir.mkdir(exist_ok=True, parents=True)

# ===================================================================
# DATABASE MODELS (In production, use PostgreSQL/MongoDB)
# ===================================================================

# Simple in-memory storage (replace with real DB)
API_KEYS_DB = {}  # {api_key: {user_id, company, tier, created_at}}
USERS_DB = {}  # {user_id: {email, balance, tier, created_at}}
ANALYSIS_HISTORY = {}  # {analysis_id: {user_id, results, timestamp}}
PENDING_PAYMENTS = {}  # {payment_id: {analysis_id, amount, status}}

# Initialize mock test user for development
TEST_USER_ID = "test-user-123"
USERS_DB[TEST_USER_ID] = {
    "user_id": TEST_USER_ID,
    "email": "test@tarantulahawk.ai",
    "password_hash": hashlib.sha256("test123".encode()).hexdigest(),
    "company": "Test Company",
    "tier": "standard",
    "balance": 500.0,  # $500 virtual credit for testing
    "created_at": datetime.now(),
    "total_analyses": 0
}

# ===================================================================
# PYDANTIC MODELS
# ===================================================================

class Usuario(BaseModel):
    email: str
    password: str
    company: Optional[str] = None
    tier: str = "free"  # free, small, enterprise

class APIKey(BaseModel):
    key: str
    company: str
    tier: str
    created_at: datetime

class Transaccion(BaseModel):
    monto: float = Field(..., gt=0, description="Transaction amount (MXN/USD)")
    fecha: str = Field(..., description="ISO format date")
    tipo_operacion: str = Field(..., description="Operation type")
    sector_actividad: str = Field(..., description="Business sector")
    frecuencia_mensual: int = Field(default=1, ge=1)
    cliente_id: int = Field(..., gt=0)
    tipo_persona: Optional[str] = "fisica"
    estado: Optional[str] = "CDMX"

class LoteTransacciones(BaseModel):
    transacciones: List[Transaccion]
    cliente_info: Optional[Dict[str, Any]] = {}
    metadata: Optional[Dict[str, Any]] = {}

class RespuestaAnalisis(BaseModel):
    success: bool
    analysis_id: str
    resumen: Dict[str, Any]
    transacciones: List[Dict[str, Any]]
    xml_path: Optional[str] = None
    costo: float
    requiere_pago: bool
    payment_id: Optional[str] = None
    errores: Optional[List[str]] = None
    timestamp: datetime

class PagoRequest(BaseModel):
    payment_id: str
    method: str  # "card", "bank_transfer", "crypto"
    payment_token: Optional[str] = None

# ===================================================================
# AUTHENTICATION & AUTHORIZATION
# ===================================================================

def generar_api_key() -> str:
    """Generate secure API key"""
    return f"thk_{secrets.token_urlsafe(32)}"

def validar_api_key(api_key: str = Header(None, alias="X-API-Key")) -> Dict:
    """Validate API key for enterprise users"""
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    if api_key not in API_KEYS_DB:
        raise HTTPException(status_code=403, detail="Invalid API key")
    
    return API_KEYS_DB[api_key]

def validar_usuario_portal(user_id: str = Header(None, alias="X-User-ID")) -> Dict:
    """Validate portal user session"""
    if not user_id or user_id not in USERS_DB:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    return USERS_DB[user_id]

# ===================================================================
# CORE PROCESSING FUNCTION (Shared by both flows)
# ===================================================================

def procesar_transacciones_core(
    df: pd.DataFrame, 
    cliente_info: Dict = None,
    user_tier: str = "free"
) -> Dict:
    """
    Core ML processing - shared by both small and large customers
    
    In production, this calls your actual ML models:
    - validador_enriquecedor.py
    - sistema_deteccion_multinivel.py
    - generar_xml.py
    """
    
    # MOCK IMPLEMENTATION - Replace with your actual code
    # from validador_enriquecedor import procesar_archivo
    # from sistema_deteccion_multinivel import ejecutar_sistema_multinivel
    
    total_txns = len(df)
    
    # Simulate ML processing
    resultados = {
        "resumen": {
            "total_transacciones": total_txns,
            "preocupante": int(total_txns * 0.008),  # 0.8%
            "inusual": int(total_txns * 0.035),  # 3.5%
            "relevante": int(total_txns * 0.15),  # 15%
            "limpio": total_txns - int(total_txns * 0.193),
            "false_positive_rate": 8.2,
            "processing_time_ms": total_txns * 0.15
        },
        "transacciones": [],
        "metadata": {
            "analysis_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "tier": user_tier,
            "cliente_info": cliente_info or {}
        }
    }
    
    # Generate detailed transaction results (mock)
    for i in range(min(100, total_txns)):  # Return top 100 for display
        row = df.iloc[i]
        score = float(row.get("monto", 0)) / 100000 * 10
        
        if score > 8:
            clasificacion = "preocupante"
        elif score > 6:
            clasificacion = "inusual"
        elif score > 4:
            clasificacion = "relevante"
        else:
            clasificacion = "limpio"
        
        resultados["transacciones"].append({
            "id": f"TXN-{i+1:05d}",
            "monto": float(row.get("monto", 0)),
            "fecha": str(row.get("fecha", "")),
            "tipo_operacion": str(row.get("tipo_operacion", "")),
            "sector_actividad": str(row.get("sector_actividad", "")),
            "clasificacion": clasificacion,
            "risk_score": round(score, 2),
            "razones": [
                "Monto elevado" if score > 7 else None,
                "Sector alto riesgo" if row.get("sector_actividad") in ["casa_cambio", "joyeria"] else None,
                "Patrón estructuración" if 150000 <= row.get("monto", 0) <= 169999 else None
            ]
        })
    
    # Generate XML if reportable transactions exist
    if resultados["resumen"]["preocupante"] > 0:
        xml_filename = f"aviso_uif_{resultados['metadata']['analysis_id']}.xml"
        xml_path = XML_DIR / xml_filename
        
        # Mock XML generation
        with open(xml_path, "w", encoding="utf-8") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write('<AvisoUIF>\n')
            f.write(f'  <FechaGeneracion>{datetime.now().isoformat()}</FechaGeneracion>\n')
            f.write(f'  <TotalOperaciones>{resultados["resumen"]["preocupante"]}</TotalOperaciones>\n')
            f.write('</AvisoUIF>')
        
        resultados["xml_path"] = str(xml_path)
    
    return resultados

def calcular_costo(num_transacciones: int, _tier: str = "ignored") -> float:
    """Calculate processing cost using shared config-driven tiers when available."""
    try:
        if PricingTier is not None:
            return float(PricingTier.calculate_cost(int(max(0, num_transacciones))))
    except Exception:
        pass
    # Fallback to hardcoded tiers if shared utility unavailable
    remaining = int(max(0, num_transacciones))
    cost = 0.0
    if remaining == 0:
        return 0.0
    take = min(remaining, 2000)
    cost += take * 1.0
    remaining -= take
    if remaining > 0:
        take = min(remaining, 3000)
        cost += take * 0.75
        remaining -= take
    if remaining > 0:
        take = min(remaining, 5000)
        cost += take * 0.50
        remaining -= take
    if remaining > 0:
        cost += remaining * 0.35
    return cost

# ===================================================================
# ENDPOINT 1: User Registration & Authentication
# ===================================================================

@app.post("/api/auth/register")
async def registrar_usuario(usuario: Usuario):
    """Register new user (portal flow)"""
    
    user_id = str(uuid.uuid4())
    
    USERS_DB[user_id] = {
        "user_id": user_id,
        "email": usuario.email,
        "password_hash": hashlib.sha256(usuario.password.encode()).hexdigest(),
        "company": usuario.company,
        "tier": usuario.tier,
        "balance": 0.0,
        "created_at": datetime.now(),
        "total_analyses": 0
    }
    
    return {
        "success": True,
        "user_id": user_id,
        "message": "Usuario registrado exitosamente"
    }

@app.post("/api/auth/login")
async def login_usuario(email: str, password: str):
    """User login"""
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    for user_id, user_data in USERS_DB.items():
        if user_data["email"] == email and user_data["password_hash"] == password_hash:
            return {
                "success": True,
                "user_id": user_id,
                "tier": user_data["tier"],
                "balance": user_data["balance"]
            }
    
    raise HTTPException(status_code=401, detail="Credenciales inválidas")

# ===================================================================
# ENDPOINT 2: API Key Management (Enterprise Flow)
# ===================================================================

@app.post("/api/enterprise/api-key/generate")
async def generar_nueva_api_key(
    company: str,
    tier: str = "enterprise",
    user: Dict = Depends(validar_usuario_portal)
):
    """Generate API key for enterprise customers"""
    
    if user["tier"] != "enterprise":
        raise HTTPException(status_code=403, detail="Solo disponible para tier Enterprise")
    
    api_key = generar_api_key()
    
    API_KEYS_DB[api_key] = {
        "user_id": user["user_id"],
        "company": company,
        "tier": tier,
        "created_at": datetime.now(),
        "requests_count": 0,
        "active": True
    }
    
    return {
        "success": True,
        "api_key": api_key,
        "message": "API key generada exitosamente. Guárdala de forma segura."
    }

@app.get("/api/enterprise/api-keys")
async def listar_api_keys(user: Dict = Depends(validar_usuario_portal)):
    """List all API keys for user"""
    
    keys = [
        {
            "key": key[:20] + "...",
            "company": data["company"],
            "created_at": data["created_at"],
            "requests_count": data["requests_count"],
            "active": data["active"]
        }
        for key, data in API_KEYS_DB.items()
        if data["user_id"] == user["user_id"]
    ]
    
    return {"api_keys": keys}

# ===================================================================
# ENDPOINT 3: Portal Upload Flow (Small Users)
# ===================================================================

@app.post("/api/portal/upload", response_model=RespuestaAnalisis)
async def upload_archivo_portal(
    file: UploadFile = File(...),
    user: Dict = Depends(validar_usuario_portal)
):
    """
    SMALL USER FLOW - Portal Upload
    
    1. User uploads file via web portal (max 500MB)
    2. Validate & enrich data
    3. Run ML models
    4. Generate payment if needed
    5. Return results (locked until payment)
    """
    
    # Validate file size (500MB max)
    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB in bytes
    
    try:
        # Save uploaded file and check size
        file_id = str(uuid.uuid4())
        file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
        
        file_size = 0
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(8192):  # Read in 8KB chunks
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"Archivo demasiado grande. Máximo: 500MB. Tu archivo: {file_size / 1024 / 1024:.2f}MB"
                    )
                buffer.write(chunk)
        
        # Load and validate with proper Excel handling
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_path, encoding='utf-8-sig', skip_blank_lines=True)
        elif file.filename.endswith(('.xlsx', '.xls')):
            # Force openpyxl engine for .xlsx, read ALL rows, skip empty rows
            df = pd.read_excel(
                file_path, 
                engine='openpyxl' if file.filename.endswith('.xlsx') else None,
                sheet_name=0,  # First sheet
                na_filter=True,  # Convert empty cells to NaN
            )
            # Drop completely empty rows
            df = df.dropna(how='all')
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado. Use .xlsx, .xls o .csv")
        
        # Process transactions
        resultados = procesar_transacciones_core(df, None, user.get("tier", "standard"))
        
        # Calculate cost
        costo = calcular_costo(len(df))
        requiere_pago = costo > user["balance"]
        
        analysis_id = resultados["metadata"]["analysis_id"]
        
        # Save to history (locked if payment required)
        ANALYSIS_HISTORY[analysis_id] = {
            "user_id": user["user_id"],
            "resultados": resultados,
            "costo": costo,
            "pagado": not requiere_pago,
            "timestamp": datetime.now()
        }
        
        # Generate payment if needed
        payment_id = None
        if requiere_pago:
            payment_id = str(uuid.uuid4())
            PENDING_PAYMENTS[payment_id] = {
                "analysis_id": analysis_id,
                "user_id": user["user_id"],
                "amount": costo - user["balance"],
                "status": "pending",
                "created_at": datetime.now()
            }
        else:
            # Deduct from balance
            USERS_DB[user["user_id"]]["balance"] -= costo
        
        # Clean up
        os.remove(file_path)
        
        return RespuestaAnalisis(
            success=True,
            analysis_id=analysis_id,
            resumen=resultados["resumen"],
            transacciones=resultados["transacciones"][:10] if requiere_pago else resultados["transacciones"],
            xml_path=None if requiere_pago else resultados.get("xml_path"),
            costo=costo,
            requiere_pago=requiere_pago,
            payment_id=payment_id,
            timestamp=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===================================================================
# ENDPOINT 4: Enterprise Direct API Flow
# ===================================================================

@app.post("/api/v1/analizar", response_model=RespuestaAnalisis)
async def analizar_transacciones_api(
    lote: LoteTransacciones,
    api_data: Dict = Depends(validar_api_key)
):
    """
    ENTERPRISE FLOW - Direct API
    
    Large corporations send JSON directly, process on their servers
    """
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame([t.dict() for t in lote.transacciones])
        
        # Process
        resultados = procesar_transacciones_core(
            df, 
            lote.cliente_info, 
            api_data["tier"]
        )
        
        # Calculate cost (billed monthly for enterprise)
        costo = calcular_costo(len(df), api_data["tier"])
        
        analysis_id = resultados["metadata"]["analysis_id"]
        
        # Save to history
        ANALYSIS_HISTORY[analysis_id] = {
            "api_key": api_data,
            "resultados": resultados,
            "costo": costo,
            "timestamp": datetime.now()
        }
        
        # Update API key usage
        for key, data in API_KEYS_DB.items():
            if data["user_id"] == api_data["user_id"]:
                data["requests_count"] += 1
        
        return RespuestaAnalisis(
            success=True,
            analysis_id=analysis_id,
            resumen=resultados["resumen"],
            transacciones=resultados["transacciones"],
            xml_path=resultados.get("xml_path"),
            costo=costo,
            requiere_pago=False,  # Enterprise billed monthly
            timestamp=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===================================================================
# ENDPOINT 5: Payment Processing
# ===================================================================

@app.post("/api/payment/process")
async def procesar_pago(
    pago: PagoRequest,
    user: Dict = Depends(validar_usuario_portal)
):
    """Process payment and unlock results"""
    
    if pago.payment_id not in PENDING_PAYMENTS:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    payment_info = PENDING_PAYMENTS[pago.payment_id]
    
    if payment_info["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # MOCK PAYMENT PROCESSING
    # In production, integrate with Stripe, PayPal, etc.
    if pago.method == "card" and pago.payment_token:
        # Simulate payment success
        payment_info["status"] = "completed"
        payment_info["completed_at"] = datetime.now()
        
        # Unlock analysis
        analysis_id = payment_info["analysis_id"]
        ANALYSIS_HISTORY[analysis_id]["pagado"] = True
        
        return {
            "success": True,
            "message": "Pago procesado exitosamente",
            "analysis_id": analysis_id
        }
    
    raise HTTPException(status_code=400, detail="Método de pago inválido")

@app.post("/api/payment/add-balance")
async def agregar_saldo(
    amount: float,
    payment_token: str,
    user: Dict = Depends(validar_usuario_portal)
):
    """Add balance to user account"""
    
    # Mock payment processing
    if amount > 0:
        USERS_DB[user["user_id"]]["balance"] += amount
        
        return {
            "success": True,
            "new_balance": USERS_DB[user["user_id"]]["balance"],
            "message": f"${amount:.2f} agregados exitosamente"
        }
    
    raise HTTPException(status_code=400, detail="Monto inválido")

# ===================================================================
# ENDPOINT 6: Results & History
# ===================================================================

@app.get("/api/analysis/{analysis_id}")
async def obtener_analisis(
    analysis_id: str,
    user: Dict = Depends(validar_usuario_portal)
):
    """Get analysis results (if paid)"""
    
    if analysis_id not in ANALYSIS_HISTORY:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    
    analysis = ANALYSIS_HISTORY[analysis_id]
    
    if analysis["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    if not analysis["pagado"]:
        raise HTTPException(status_code=402, detail="Pago requerido")
    
    return analysis["resultados"]

@app.get("/api/history")
async def obtener_historial(
    user: Dict = Depends(validar_usuario_portal),
    limit: int = 50
):
    """Get user analysis history"""
    
    historial = [
        {
            "analysis_id": aid,
            "timestamp": data["timestamp"],
            "total_transacciones": data["resultados"]["resumen"]["total_transacciones"],
            "preocupante": data["resultados"]["resumen"]["preocupante"],
            "costo": data["costo"],
            "pagado": data["pagado"]
        }
        for aid, data in ANALYSIS_HISTORY.items()
        if data["user_id"] == user["user_id"]
    ]
    
    return {"historial": sorted(historial, key=lambda x: x["timestamp"], reverse=True)[:limit]}

# ===================================================================
# ENDPOINT 7: Download XML
# ===================================================================

@app.get("/api/xml/{analysis_id}")
async def descargar_xml(
    analysis_id: str,
    user: Dict = Depends(validar_usuario_portal)
):
    """Download XML report"""
    
    if analysis_id not in ANALYSIS_HISTORY:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    
    analysis = ANALYSIS_HISTORY[analysis_id]
    
    if analysis["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    if not analysis["pagado"]:
        raise HTTPException(status_code=402, detail="Pago requerido")
    
    xml_path = analysis["resultados"].get("xml_path")
    
    if not xml_path or not os.path.exists(xml_path):
        raise HTTPException(status_code=404, detail="XML no generado")
    
    return FileResponse(
        xml_path,
        media_type="application/xml",
        filename=f"aviso_uif_{analysis_id}.xml"
    )

# ===================================================================
# ENDPOINT 8: Health & Stats
# ===================================================================

@app.get("/health")
async def health_check():
    """API health check"""
    return {
        "status": "ok",
        "version": "3.0.0",
        "timestamp": datetime.now().isoformat(),
        "endpoints": {
            "portal_upload": "/api/portal/upload",
            "enterprise_api": "/api/v1/analizar",
            "documentation": "/api/docs"
        },
        "test_user": {
            "user_id": TEST_USER_ID,
            "email": "test@tarantulahawk.ai",
            "balance": USERS_DB[TEST_USER_ID]["balance"],
            "note": "Use this user_id in X-User-ID header for testing"
        }
    }

@app.get("/api/stats")
async def obtener_estadisticas(user: Dict = Depends(validar_usuario_portal)):
    """User statistics"""
    
    user_analyses = [a for a in ANALYSIS_HISTORY.values() if a["user_id"] == user["user_id"]]
    
    return {
        "total_analyses": len(user_analyses),
        "total_transactions": sum(a["resultados"]["resumen"]["total_transacciones"] for a in user_analyses),
        "total_spent": sum(a["costo"] for a in user_analyses if a["pagado"]),
        "current_balance": user["balance"],
        "tier": user["tier"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
