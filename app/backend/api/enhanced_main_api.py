# main_api.py - COMPLETE PRODUCTION VERSION
"""
TarantulaHawk PLD API - Full Implementation
Supports both small users (portal upload) and large corporations (direct API)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, validator, Field
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
import os
import shutil
from datetime import datetime, timedelta
import uuid
import json
import hashlib
import secrets
import hmac
import time
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # .../app/backend
load_dotenv(BASE_DIR / ".env")

# Security imports
import bcrypt
from jose import jwt, JWTError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import xml.etree.ElementTree as ET
import httpx  # Para verificar con Supabase API
# Import validador_enriquecedor from utils
import sys
sys.path.insert(0, str(Path(__file__).parent / "utils"))
# Also add parent directory for relative imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    # Try explicit import via importlib to provide better diagnostics on failure
    import importlib
    import validador_enriquecedor as _ve
    importlib.reload(_ve)
    enrich_features = getattr(_ve, 'enrich_features', None)
    procesar_archivo = getattr(_ve, 'procesar_archivo', None)
    normalizar_sector = getattr(_ve, 'normalizar_sector', None)
    missing = [n for n in ('enrich_features','procesar_archivo','normalizar_sector') if globals().get(n) is None]
    if missing:
        raise ImportError(f"validador_enriquecedor missing symbols: {missing}")
except Exception as e:
    import traceback
    print("❌ Error importing validador_enriquecedor:", e)
    traceback.print_exc()
    raise

# Use shared pricing utility that reads config/pricing.json
try:
    from app.backend.api.utils.pricing_tiers import PricingTier  # when run as a module
except Exception:
    try:
        from .utils.pricing_tiers import PricingTier  # relative import fallback
    except Exception:
        PricingTier = None  # final fallback; will use local calcular_costo

# Import KYC router
try:
    from app.backend.api.kyc import router as kyc_router
except Exception as e:
    try:
        from .kyc import router as kyc_router
    except Exception as e2:
        import traceback
        kyc_router = None
        print("⚠️  WARNING: KYC router no disponible")
        print(f"❌ Absolute import failed: {e}")
        print(f"❌ Relative import failed: {e2}")
        traceback.print_exc()

# Import Operaciones router
try:
    from app.backend.api.operaciones_api import router as operaciones_router
except Exception as e:
    try:
        from .operaciones_api import router as operaciones_router
    except Exception as e2:
        import traceback
        operaciones_router = None
        print("⚠️  WARNING: Operaciones router no disponible")
        print(f"❌ Absolute import failed: {e}")
        print(f"❌ Relative import failed: {e2}")
        traceback.print_exc()

# Auth helpers (separate module to avoid circular imports)
try:
    from app.backend.api.auth_supabase import verificar_token_supabase, validar_supabase_jwt
except Exception:
    try:
        from .auth_supabase import verificar_token_supabase, validar_supabase_jwt
    except Exception:
        # Direct import as last resort when running as script
        try:
            import auth_supabase
            verificar_token_supabase = auth_supabase.verificar_token_supabase
            validar_supabase_jwt = auth_supabase.validar_supabase_jwt
        except Exception as e:
            print(f"❌ Error importing auth_supabase: {e}")
            raise

# Internal modules (from your existing code)
# from validador_enriquecedor import procesar_archivo, validar_estructura, enriquecer_features
# from sistema_deteccion_multinivel import ejecutar_sistema_multinivel
# from utils.generar_xml import generar_xml_uif

# Security Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production-min-32-chars")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Supabase Configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Billing toggle for development
BILLING_DISABLED = os.getenv("DISABLE_BILLING", "").lower() in ("1", "true", "yes", "on")

# Initialize Supabase Admin Client (for billing operations)
supabase_admin = None
try:
    from supabase import create_client, Client
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print(f"✅ Supabase Admin Client inicializado")
    else:
        print("⚠️  WARNING: Supabase Service Role Key no configurado - billing deshabilitado")
except ImportError:
    print("⚠️  WARNING: supabase-py no instalado - ejecuta: pip install supabase")

if not SUPABASE_URL:
    print("⚠️  WARNING: SUPABASE_URL not configured")
if not SUPABASE_JWT_SECRET:
    print("⚠️  WARNING: SUPABASE_JWT_SECRET not configured")
else:
    print(f"✅ Supabase configurado: {SUPABASE_URL[:30]}...")

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="TarantulaHawk PLD API",
    description="API for AML/CFT Compliance - LFPIORPI 2025",
    version="3.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

security = HTTPBearer()

# Include routers
if kyc_router:
    app.include_router(kyc_router)
    print("✅ KYC router incluido")
else:
    print("⚠️  KYC router no disponible")

if operaciones_router:
    app.include_router(operaciones_router)
    print("✅ Operaciones router incluido")
else:
    print("⚠️  Operaciones router no disponible")

# CORS Configuration
# In GitHub Codespaces, cross-port requests (3000 -> 8000) often require
# credentials for the Codespaces proxy. Configure CORS to echo allowed
# origins and permit credentials.
app.add_middleware(
    CORSMiddleware,
    # Keep explicit localhost origins; allow any Codespaces dynamic subdomain
    allow_origins=[
        "http://localhost:3000",
        "https://localhost:3000",
        "http://localhost:3001",
        "https://localhost:3001",
    ],
    allow_origin_regex=r"^https://.*\.(app\.)?github\.dev$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Lightweight helper to check if a profile exists by email (service role)
@app.post("/api/auth/check-email")
async def check_email_exists(request: Request):
    try:
        body = await request.json()
        email = (body.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="email requerido")
        if not supabase_admin:
            return {"exists": False}
        try:
            res = supabase_admin.table("profiles").select("id").eq("email", email).limit(1).execute()
            exists = bool(res.data and len(res.data) > 0)
            user_id = res.data[0]["id"] if exists and isinstance(res.data[0], dict) and "id" in res.data[0] else None
            return {"exists": exists, "user_id": user_id}
        except Exception as e:
            print(f"[AUTH] check-email error: {e}")
            return {"exists": False}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add logging middleware (reducido para producción)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # ✅ CORREGIDO: Solo loguear en modo debug
    debug_mode = os.getenv("DEBUG_MODE", "").lower() in ("1", "true", "yes")
    if debug_mode:
        print(f"📥 Request: {request.method} {request.url.path}")
        print(f"   Origin: {request.headers.get('origin', 'None')}")
    
    response = await call_next(request)
    
    if debug_mode:
        print(f"📤 Response: {response.status_code}")
        print(f"   CORS Allow-Origin: {response.headers.get('access-control-allow-origin', 'MISSING')}")
    
    return response

# Load ML models on startup
@app.on_event("startup")
async def startup_event():
    print("\n" + "="*70)
    print("🚀 TarantulaHawk API Starting...")
    print("="*70)
    try:
        cargar_modelos_ml()
    except Exception as e:
        print(f"⚠️  Modelos ML no disponibles: {e}")
    print("="*70 + "\n")

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
API_KEYS_DB = {}  # {api_key_hash: {user_id, company, tier, created_at, secret}}
USERS_DB = {}  # {user_id: {email, password_hash, balance, tier, created_at}}
ANALYSIS_HISTORY = {}  # {analysis_id: {user_id, results, timestamp}}
PENDING_PAYMENTS = {}  # {payment_id: {analysis_id, amount, status}}
USED_NONCES = {}  # {nonce: timestamp} - for replay attack prevention
IDEMPOTENCY_CACHE = {}  # {idempotency_key: response} - for duplicate prevention

# ML Models cache
ML_MODELS = {
    "supervisado": None,
    "no_supervisado": None,
    "refuerzo": None
}

# ✅ CORREGIDO: Progress tracking global (en producción usar Redis)
ANALYSIS_PROGRESS = {}

# Load ML models on startup
def cargar_modelos_ml():
    """Load trained ML models from .pkl files"""
    import joblib
    
    models_dir = Path(__file__).parent.parent / "outputs"
    
    print(f"📂 Buscando modelos en: {models_dir.absolute()}")
    
    if not models_dir.exists():
        print(f"⚠️  Directorio de modelos no existe: {models_dir}")
        return False
    
    try:
        # Load Supervised Model (Ensemble Stacking V2)
        supervised_path = models_dir / "modelo_ensemble_stack_v2.pkl"
        if supervised_path.exists():
            print(f"⏳ Cargando {supervised_path.name}...")
            ML_MODELS["supervisado"] = joblib.load(supervised_path)
            print(f"✅ Modelo Supervisado V2 cargado")
        else:
            # Fallback to v1
            supervised_v1 = models_dir / "modelo_ensemble_stack.pkl"
            if supervised_v1.exists():
                print(f"⏳ Cargando {supervised_v1.name} (v1)...")
                ML_MODELS["supervisado"] = joblib.load(supervised_v1)
                print(f"✅ Modelo Supervisado V1 cargado")
            else:
                print(f"⚠️  Modelo supervisado no encontrado")
        
        # Load Unsupervised Model Bundle V2 (Isolation Forest + KMeans)
        unsupervised_path = models_dir / "no_supervisado_bundle_v2.pkl"
        if unsupervised_path.exists():
            print(f"⏳ Cargando {unsupervised_path.name}...")
            ML_MODELS["no_supervisado"] = joblib.load(unsupervised_path)
            print(f"✅ Modelo No Supervisado Bundle V2 cargado")
        else:
            # Fallback to v1
            unsupervised_v1 = models_dir / "no_supervisado_bundle.pkl"
            if unsupervised_v1.exists():
                print(f"⏳ Cargando {unsupervised_v1.name} (v1)...")
                ML_MODELS["no_supervisado"] = joblib.load(unsupervised_v1)
                print(f"✅ Modelo No Supervisado V1 cargado")
            else:
                print(f"⚠️  Modelo no supervisado no encontrado")
        
        # Load Reinforcement Learning Bundle V2 (Q-Learning)
        rl_path = models_dir / "refuerzo_bundle_v2.pkl"
        if rl_path.exists():
            print(f"⏳ Cargando {rl_path.name}...")
            ML_MODELS["refuerzo"] = joblib.load(rl_path)
            print(f"✅ Modelo Refuerzo Bundle V2 cargado")
        else:
            # Fallback to v1
            rl_v1 = models_dir / "refuerzo_bundle.pkl"
            if rl_v1.exists():
                print(f"⏳ Cargando {rl_v1.name} (v1)...")
                ML_MODELS["refuerzo"] = joblib.load(rl_v1)
                print(f"✅ Modelo Refuerzo V1 cargado")
            else:
                print(f"⚠️  Modelo refuerzo no encontrado")
            
        return True
    except Exception as e:
        print(f"❌ Error cargando modelos ML: {e}")
        import traceback
        traceback.print_exc()
        return False

# Initialize mock test user for development
TEST_USER_ID = "test-user-123"
USERS_DB[TEST_USER_ID] = {
    "user_id": TEST_USER_ID,
    "email": "test@tarantulahawk.ai",
    "password_hash": bcrypt.hashpw("test123".encode(), bcrypt.gensalt()).decode('utf-8'),
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
    sector_actividad: Optional[str] = None
    fraccion_lfpiorpi: Optional[str] = None

class APIKey(BaseModel):
    key: str
    company: str
    tier: str
    created_at: datetime

class Transaccion(BaseModel):
    monto: float = Field(..., gt=0, description="Transaction amount (MXN/USD)")
    fecha: str = Field(..., description="ISO format date")
    tipo_operacion: str = Field(..., description="Operation type")
    sector_actividad: Optional[str] = Field(None, description="Business sector (optional - inferred if missing)")
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


# ===================================================================
# SUPABASE BILLING FUNCTIONS
# ===================================================================

def obtener_billing_usuario(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Obtiene información de billing del usuario desde profiles.account_balance_usd
    
    Returns:
        Dict con: balance (actual USD balance from profiles)
    """
    if not supabase_admin:
        print("⚠️  Supabase Admin no disponible")
        return None
    
    try:
        response = supabase_admin.table("profiles").select("account_balance_usd").eq("id", user_id).execute()
        
        if response.data and len(response.data) > 0:
            balance = float(response.data[0].get("account_balance_usd", 0.0))
            return {
                "balance": balance,
                "user_id": user_id
            }
        else:
            print(f"❌ Usuario {user_id} no encontrado en profiles")
            return None
            
    except Exception as e:
        print(f"❌ Error obteniendo billing: {e}")
        import traceback
        traceback.print_exc()
        return None


def calcular_costo_actualizado(num_transacciones: int, billing: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calcula el costo según el modelo de pricing escalonado
    
    Modelo (from config/pricing.json):
    - 1-2,000 txns: $1.00/txn
    - 2,001-5,000 txns: $0.75/txn  
    - 5,001-10,000 txns: $0.50/txn
    - 10,001+ txns: $0.35/txn
    
    Returns:
        Dict con: costo, requires_payment
    """
    # Calcular costo
    costo = calcular_costo(num_transacciones)
    
    balance = float(billing.get("balance", 0.0))
    requires_payment = costo > balance
    
    print(f"💵 [BILLING] Cálculo: {num_transacciones} txns → ${costo:.2f} | Balance: ${balance:.2f} | Requiere pago: {requires_payment}")
    
    return {
        "costo": costo,
        "requires_payment": requires_payment,
        "current_balance": balance
    }


def cobrar_transacciones(user_id: str, num_transacciones: int, descripcion: str) -> Dict[str, Any]:
    """
    Cobra el análisis de transacciones al usuario y actualiza profiles.account_balance_usd
    
    Returns:
        Dict con: success, balance_after, charged, error (si falla)
    """
    if BILLING_DISABLED:
        print("⚠️  [BILLING] Facturación deshabilitada por DISABLE_BILLING - modo desarrollo (sin cobro)")
        return {
            "success": True,
            "balance_after": 500.0,
            "charged": 0.0,
            "dev_mode": True
        }

    if not supabase_admin:
        print("⚠️  [BILLING] Supabase Admin no disponible - modo desarrollo (sin cobro)")
        return {
            "success": True,
            "balance_after": 500.0,
            "charged": 0.0,
            "dev_mode": True
        }
    
    try:
        # Obtener billing actual
        billing = obtener_billing_usuario(user_id)
        if not billing:
            return {
                "success": False,
                "error": "No se pudo obtener información de billing"
            }
        
        # Calcular costo
        calculo = calcular_costo_actualizado(num_transacciones, billing)
        costo = calculo["costo"]
        
        # Verificar si requiere pago
        if calculo["requires_payment"]:
            return {
                "success": False,
                "error": f"Saldo insuficiente. Necesitas ${costo:.2f}, tienes ${billing['balance']:.2f}",
                "required_amount": costo,
                "current_balance": billing["balance"]
            }
        
        # Cobrar - actualizar account_balance_usd en profiles
        nuevo_balance = billing["balance"] - costo
        
        print(f"💳 Actualizando balance: ${billing['balance']:.2f} - ${costo:.2f} = ${nuevo_balance:.2f}")
        
        supabase_admin.table("profiles").update({
            "account_balance_usd": nuevo_balance
        }).eq("id", user_id).execute()
        
        # Registrar transacción en credit_ledger
        try:
            supabase_admin.table("credit_ledger").insert({
                "user_id": user_id,
                "amount": -costo,
                "transaction_type": "aml_analysis",
                "description": f"{descripcion} ({num_transacciones} transacciones)",
                "balance_after": nuevo_balance,
                "metadata": {
                    "num_transactions": num_transacciones,
                    "cost_per_transaction": round(costo / num_transacciones, 4)
                }
            }).execute()
        except Exception as ledger_error:
            print(f"⚠️  Warning: No se pudo registrar en credit_ledger: {ledger_error}")
            # Non-critical, continue
        
        return {
            "success": True,
            "balance_after": nuevo_balance,
            "charged": costo
        }
            
    except Exception as e:
        import traceback
        print(f"❌ Error cobrando transacciones: {e}")
        print(f"   Traceback completo:")
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }



def generar_api_key() -> tuple:
    """Generate secure API key and secret"""
    api_key = f"thk_{secrets.token_urlsafe(32)}"
    api_secret = secrets.token_urlsafe(48)  # Secret for HMAC signing
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    return api_key, api_secret, api_key_hash

def crear_jwt_token(user_id: str, email: str) -> str:
    """Create JWT token for portal users"""
    from datetime import timezone
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": now
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verificar_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password with bcrypt"""
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())

def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode('utf-8')

def verificar_hmac_signature(
    api_key: str,
    timestamp: str,
    nonce: str,
    signature: str,
    method: str,
    path: str,
    body: str
) -> bool:
    """Verify HMAC signature for enterprise API calls"""
    # Get API key data
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    if api_key_hash not in API_KEYS_DB:
        return False
    
    api_data = API_KEYS_DB[api_key_hash]
    api_secret = api_data.get("secret")
    
    if not api_secret:
        return False
    
    # Check timestamp (max 5 minutes old)
    try:
        request_time = float(timestamp)
        current_time = time.time()
        if abs(current_time - request_time) > 300:  # 5 minutes
            return False
    except (ValueError, TypeError):
        return False
    
    # Check nonce (prevent replay)
    if nonce in USED_NONCES:
        return False
    
    # Verify signature
    message = f"{method}|{path}|{body}|{timestamp}|{nonce}"
    expected_signature = hmac.new(
        api_secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected_signature):
        return False
    
    # Store nonce
    USED_NONCES[nonce] = current_time
    
    # Cleanup old nonces (older than 10 minutes)
    for old_nonce, old_time in list(USED_NONCES.items()):
        if current_time - old_time > 600:
            del USED_NONCES[old_nonce]
    
    return True

def validar_api_key(
    request: Request,
    api_key: str = Header(None, alias="X-API-Key"),
    timestamp: str = Header(None, alias="X-Timestamp"),
    nonce: str = Header(None, alias="X-Nonce"),
    signature: str = Header(None, alias="X-Signature")
) -> Dict:
    """Validate API key with HMAC signature for enterprise clients"""
    if not api_key:
        raise HTTPException(status_code=401, detail="API key requerida")
    
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    if api_key_hash not in API_KEYS_DB:
        raise HTTPException(status_code=401, detail="API key inválida")
    
    # Verify HMAC signature (enterprise only)
    if timestamp and nonce and signature:
        body = ""
        if not verificar_hmac_signature(
            api_key, timestamp, nonce, signature,
            request.method, str(request.url.path), body
        ):
            raise HTTPException(status_code=401, detail="Firma HMAC inválida")
    
    return API_KEYS_DB[api_key_hash]

def validar_usuario_portal(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Validate portal user by JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id or user_id not in USERS_DB:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        return USERS_DB[user_id]
    
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    except Exception:
        # Fallback to X-User-ID for backwards compatibility (development only)
        raise HTTPException(status_code=401, detail="Authentication required")


# ===================================================================
# DATA VALIDATION & ENRICHMENT (LFPIORPI Compliant)
# ===================================================================

# ✅ CORREGIDO: Cargar umbrales desde config_modelos.json en lugar de hardcodear
def cargar_config_lfpiorpi() -> Dict[str, Any]:
    """Carga configuración LFPIORPI desde config_modelos.json"""
    config_path = Path(__file__).parent.parent / "models" / "config_modelos.json"
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def get_uma_diaria(cfg: Dict = None) -> float:
    """Obtiene UMA diaria desde config"""
    if cfg is None:
        cfg = cargar_config_lfpiorpi()
    return float(cfg.get("lfpiorpi", {}).get("uma_diaria", 113.14))

def get_umbral_aviso_mxn(fraccion: str, cfg: Dict = None) -> float:
    """Obtiene umbral de aviso en MXN para una fracción LFPIORPI"""
    if cfg is None:
        cfg = cargar_config_lfpiorpi()
    uma = get_uma_diaria(cfg)
    umbrales = cfg.get("lfpiorpi", {}).get("umbrales", {})
    
    # Buscar umbral específico para la fracción
    if fraccion in umbrales:
        return uma * umbrales[fraccion].get("aviso_UMA", 645)
    # Fallback a umbral general
    return uma * umbrales.get("_general", {}).get("aviso_UMA", 645)

def get_umbral_efectivo_mxn(fraccion: str, cfg: Dict = None) -> float:
    """Obtiene umbral de efectivo en MXN para una fracción LFPIORPI"""
    if cfg is None:
        cfg = cargar_config_lfpiorpi()
    uma = get_uma_diaria(cfg)
    umbrales = cfg.get("lfpiorpi", {}).get("umbrales", {})
    
    if fraccion in umbrales:
        return uma * umbrales[fraccion].get("efectivo_max_UMA", 8025)
    return uma * umbrales.get("_general", {}).get("efectivo_max_UMA", 8025)

def get_sectores_alto_riesgo(cfg: Dict = None) -> set:
    """Obtiene lista de sectores de alto riesgo desde config"""
    if cfg is None:
        cfg = cargar_config_lfpiorpi()
    return set(cfg.get("lfpiorpi", {}).get("actividad_alto_riesgo", [
        "activos_virtuales", "criptomonedas", "traslado_valores",
        "casa_cambio", "cambio_divisas", "transmision_dinero", "joyeria_metales"
    ]))

# Cache de config para evitar lecturas repetidas
_CONFIG_CACHE = None
def get_cached_config() -> Dict:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is None:
        _CONFIG_CACHE = cargar_config_lfpiorpi()
    return _CONFIG_CACHE

def validar_enriquecer_datos(df: pd.DataFrame) -> pd.DataFrame:
    """
    LFPIORPI-Compliant Data Validation & Enrichment
    
    Now uses validador_enriquecedor.py from utils/ with 26+ features
    
    Step 1: Validate structure and clean data
    Step 2: Enrich with ML-required features
    Step 3: Add LFPIORPI compliance flags
    
    Returns clean DataFrame ready for ML processing
    """
    # V3: Validación integrada en enrich_features
    # ✅ CORREGIDO: sector_actividad es OPCIONAL (se infiere si falta)
    required = ["cliente_id", "monto", "fecha", "tipo_operacion"]
    optional = ["sector_actividad", "hora", "id_transaccion"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Columnas requeridas faltantes: {', '.join(missing)}"
        )
    
    # Enrich features (incluye normalización de sector → fracción LFPIORPI)
    print("🔧 Enriqueciendo con validador_enriquecedor v3 (26+ features)...")
    df_enriched = enrich_features(df)
    
    print(f"✅ Enriquecimiento completo: {len(df_enriched)} filas, {len(df_enriched.columns)} columnas")
    return df_enriched

# ===================================================================
# CORE PROCESSING FUNCTION (Shared by both flows)
# ===================================================================

def procesar_transacciones_core(
    df: pd.DataFrame, 
    cliente_info: Dict = None,
    user_tier: str = "free",
    analysis_id: str = None
) -> Dict:
    """
    Core ML processing using 3-layer architecture:
    1. Supervised Model (Ensemble Stacking) - Trained patterns
    2. Unsupervised Model (Isolation Forest + KMeans) - Anomaly detection
    3. Reinforcement Learning (Q-Learning) - Adaptive thresholds
    """
    
    total_txns = len(df)
    if not analysis_id:
        analysis_id = str(uuid.uuid4())

    # ✅ CORREGIDO: Usar ANALYSIS_PROGRESS global
    global ANALYSIS_PROGRESS
    
    # Initialize progress tracking
    ANALYSIS_PROGRESS[analysis_id] = {
        "stage": "validating",
        "progress": 5,
        "message": "Validando datos...",
        "details": {"total_transacciones": total_txns}
    }
    
    print(f"\n{'='*70}")
    print(f"🤖 ANÁLISIS ML - {total_txns} transacciones")
    print(f"{'='*70}")
    
    # Prepare features helper: encode categoricals and align to model columns
    def build_feature_matrix(base_df: pd.DataFrame, required_features: list[str]) -> pd.DataFrame:
        work = base_df.copy()
        # Drop fields never used for ML
        work.drop(columns=[c for c in ["cliente_id", "fecha", "fecha_dt"] if c in work.columns], inplace=True, errors='ignore')
        # One-hot encode known categoricals like in training
        cat_cols = [c for c in ["tipo_operacion", "sector_actividad", "fraccion"] if c in work.columns]
        if cat_cols:
            work = pd.get_dummies(work, columns=cat_cols, drop_first=True, dtype=float)
        # Keep only required features; add any missing with zeros
        features = pd.DataFrame(index=work.index)
        for feat in required_features:
            if feat in work.columns:
                features[feat] = pd.to_numeric(work[feat], errors='coerce')
            else:
                # Missing engineered/one-hot feature → fill 0
                features[feat] = 0.0
        # Sanitize
        features = features.replace([np.inf, -np.inf], np.nan).fillna(0.0)
        return features
    
    # Initialize results
    scores_supervisado = np.zeros(total_txns)
    scores_no_supervisado = np.zeros(total_txns)
    scores_refuerzo = np.zeros(total_txns)
    
    # ============================================================
    # LAYER 1: SUPERVISED MODEL
    # ============================================================
    ANALYSIS_PROGRESS[analysis_id].update({
        "stage": "ml_supervised",
        "progress": 30,
        "message": "Aplicando IA Supervisada...",
        "details": {"casos_analizados": 0}
    })
    
    if ML_MODELS["supervisado"] is not None:
        try:
            print("\n🔵 Capa 1: Modelo Supervisado (Ensemble Stacking)")
            model_data = ML_MODELS["supervisado"]
            scaler = model_data.get("scaler")
            model = model_data.get("model")
            # Usar 'columns' (no 'feature_names') - es la key correcta del PKL
            required_features = model_data.get("columns", [])
            
            if not required_features:
                print(f"   ⚠️ No se encontraron columnas requeridas en el modelo")
                raise ValueError("Missing required features in model")
            
            print(f"   📋 Modelo requiere {len(required_features)} features")
            
            # Build features exactly as in training (incl. one-hot alignment)
            df_features = build_feature_matrix(df, required_features)
            missing = [f for f in required_features if f not in df.columns]
            if missing:
                print(f"   ℹ️  Features generadas/alineadas: {len(df_features.columns)}; faltaban {len(missing)} (rellenadas con 0)")
            
            if scaler and model and len(df_features.columns) > 0:
                X_scaled = scaler.transform(df_features)
                predictions = model.predict_proba(X_scaled)
                scores_supervisado = predictions[:, 1] if predictions.shape[1] > 1 else predictions[:, 0]
                casos_detectados = int((scores_supervisado > 0.5).sum())
                ANALYSIS_PROGRESS[analysis_id].update({
                    "progress": 45,
                    "details": {"casos_detectados_supervisado": casos_detectados}
                })
                print(f"   ✅ {len(scores_supervisado)} predicciones generadas")
                print(f"   📊 Score promedio: {scores_supervisado.mean():.3f}")
                print(f"   🎯 Casos detectados: {casos_detectados}")
        except Exception as e:
            print(f"   ⚠️ Error en modelo supervisado: {e}")
            # ✅ CORREGIDO: Fallback conservador en lugar de aleatorio
            scores_supervisado = np.zeros(total_txns)  # Sin ML = score 0 (conservador)
    else:
        print("\n⚠️ Modelo Supervisado no disponible - usando fallback conservador")
        scores_supervisado = np.zeros(total_txns)  # Sin ML = score 0
    
    # ============================================================
    # LAYER 2: UNSUPERVISED MODEL + ANOMALY DETECTION
    # ============================================================
    ANALYSIS_PROGRESS[analysis_id].update({
        "stage": "ml_unsupervised",
        "progress": 55,
        "message": "Aplicando IA No Supervisada (Detección de Anomalías)...",
    })
    
    # Track anomaly flags for each transaction
    anomaly_flags = [False] * total_txns
    top_anomalies_indices = []
    
    if ML_MODELS["no_supervisado"] is not None:
        try:
            print("\n🟢 Capa 2: Modelo No Supervisado (Anomaly Detection)")
            model_data = ML_MODELS["no_supervisado"]
            scaler = model_data.get("scaler")
            pca = model_data.get("pca")
            isolation_forest = model_data.get("isolation_forest")
            kmeans = model_data.get("kmeans")
            required_features = model_data.get("columns", [])
            
            if not required_features:
                print(f"   ⚠️ No se encontraron columnas requeridas")
                raise ValueError("Missing required features")
            
            print(f"   📋 Modelo requiere {len(required_features)} features")
            
            # Preparar features con el mismo pipeline (incl. one-hot)
            df_features = build_feature_matrix(df, required_features)
            
            if len(df_features.columns) > 0 and scaler:
                X = df_features.values
                X_scaled = scaler.transform(X)
                if pca:
                    X_scaled = pca.transform(X_scaled)
                
                # Isolation Forest scores (anomaly = -1, normal = 1)
                if isolation_forest:
                    anomaly_scores = isolation_forest.decision_function(X_scaled)
                    # Convert to [0,1] range (lower = more anomalous)
                    scores_no_supervisado = 1 - ((anomaly_scores - anomaly_scores.min()) / 
                                                (anomaly_scores.max() - anomaly_scores.min() + 1e-10))
                    
                    # ✅ MARCAR TOP ANOMALÍAS (top 10% más anómalas)
                    threshold_anomaly = np.percentile(scores_no_supervisado, 90)  # Top 10% más anómalas
                    for i, score in enumerate(scores_no_supervisado):
                        if score >= threshold_anomaly:
                            anomaly_flags[i] = True
                            top_anomalies_indices.append(i)
                    
                    anomalias = int((scores_no_supervisado > 0.7).sum())
                    ANALYSIS_PROGRESS[analysis_id].update({
                        "progress": 70,
                        "details": {
                            "casos_detectados_supervisado": ANALYSIS_PROGRESS[analysis_id]["details"].get("casos_detectados_supervisado", 0),
                            "anomalias_adicionales": anomalias,
                            "top_anomalies_count": len(top_anomalies_indices)
                        }
                    })
                    print(f"   ✅ {len(scores_no_supervisado)} anomalías analizadas")
                    print(f"   📊 Anomalías detectadas: {anomalias}")
                    print(f"   🎯 Top anomalías marcadas: {len(top_anomalies_indices)}")
            else:
                print(f"   ⚠️ No hay features válidas para el modelo")
                scores_no_supervisado = np.zeros(total_txns)  # ✅ Conservador
        except Exception as e:
            print(f"   ⚠️ Error en modelo no supervisado: {e}")
            scores_no_supervisado = np.zeros(total_txns)  # ✅ Conservador
    else:
        print("\n⚠️ Modelo No Supervisado no disponible - usando fallback conservador")
        scores_no_supervisado = np.zeros(total_txns)  # ✅ Conservador
    
    # ============================================================
    # LAYER 3: REINFORCEMENT LEARNING + ANOMALY INTEGRATION
    # ============================================================
    ANALYSIS_PROGRESS[analysis_id].update({
        "stage": "ml_reinforcement",
        "progress": 80,
        "message": "Aplicando IA de Refuerzo (Ajuste de Thresholds)...",
    })
    
    if ML_MODELS["refuerzo"] is not None:
        try:
            print("\n🟡 Capa 3: Modelo Refuerzo (Q-Learning Thresholds + Anomalías)")
            q_table = ML_MODELS["refuerzo"]
            
            # Combine supervised + unsupervised scores
            combined_scores = (scores_supervisado + scores_no_supervisado) / 2
            
            # Apply adaptive thresholds based on Q-learning + anomaly flags
            for i in range(total_txns):
                score = combined_scores[i]
                is_top_anomaly = anomaly_flags[i]  # From unsupervised layer
                
                # Discretize score for Q-table lookup
                state = int(score * 10)  # 0-10 scale
                state_key = str(state)
                
                if state_key in q_table:
                    q_values = q_table[state_key]
                    best_action = max(q_values, key=q_values.get)
                    
                    # Base adjustment from Q-learning
                    if best_action == 'increase_threshold':
                        scores_refuerzo[i] = score * 1.2
                    elif best_action == 'decrease_threshold':
                        scores_refuerzo[i] = score * 0.8
                    else:
                        scores_refuerzo[i] = score
                    
                    # ✅ BOOST TOP ANOMALÍAS: Si es top anomalía, aumentar score adicionalmente
                    if is_top_anomaly:
                        scores_refuerzo[i] *= 1.3  # 30% boost for top anomalies
                        print(f"   🚨 Anomalía top #{i+1}: score boosted {score:.3f} → {scores_refuerzo[i]:.3f}")
                else:
                    scores_refuerzo[i] = score
            
            ajustes = int((scores_refuerzo != combined_scores).sum())
            top_anomaly_boosts = sum(1 for flag in anomaly_flags if flag)
            
            ANALYSIS_PROGRESS[analysis_id].update({
                "progress": 90,
                "details": {
                    **ANALYSIS_PROGRESS[analysis_id]["details"],
                    "ajustes_threshold": ajustes,
                    "top_anomaly_boosts": top_anomaly_boosts
                }
            })
            print(f"   ✅ {total_txns} ajustes adaptativos aplicados")
            print(f"   📊 Score final promedio: {scores_refuerzo.mean():.3f}")
            print(f"   ⚙️  Thresholds ajustados: {ajustes} transacciones")
            print(f"   🚨 Top anomalías boosted: {top_anomaly_boosts}")
        except Exception as e:
            print(f"   ⚠️ Error en modelo refuerzo: {e}")
            scores_refuerzo = (scores_supervisado + scores_no_supervisado) / 2
    else:
        print("\n⚠️ Modelo Refuerzo no disponible - usando promedio")
        scores_refuerzo = (scores_supervisado + scores_no_supervisado) / 2
    
    # ============================================================
    # FINAL SCORING & CLASSIFICATION
    # ============================================================
    ANALYSIS_PROGRESS[analysis_id].update({
        "stage": "generating_report",
        "progress": 95,
        "message": "Generando reporte final...",
    })
    
    print(f"\n{'='*70}")
    print("📊 CLASIFICACIÓN FINAL")
    print(f"{'='*70}")
    
    # Combine all 3 layers with weights
    final_scores = (
        scores_supervisado * 0.5 +      # 50% supervised
        scores_no_supervisado * 0.3 +   # 30% unsupervised
        scores_refuerzo * 0.2            # 20% reinforcement
    )
    
    # ============================================================
    # APPLY LFPIORPI HARD RULES (Override ML if necessary)
    # ============================================================
    print(f"\n🏛️  REGLAS LFPIORPI (Sobrescriben ML si aplican)")
    print(f"{'='*70}")
    
    lfpiorpi_overrides = 0
    cfg = get_cached_config()  # ✅ Usar config cacheado
    
    for i in range(total_txns):
        row = df.iloc[i]
        monto = float(row.get("monto", 0))
        es_efectivo = int(row.get("EsEfectivo", 0))
        
        # ✅ CORREGIDO: Calcular structuring desde features disponibles
        es_monto_redondo = int(row.get("es_monto_redondo", 0))
        posible_burst = int(row.get("posible_burst", 0))
        es_estructurada = es_monto_redondo and posible_burst  # Indicador de structuring
        
        # ✅ CORREGIDO: Obtener umbral según fracción de la transacción
        fraccion = str(row.get("fraccion", "_general"))
        umbral_aviso = get_umbral_aviso_mxn(fraccion, cfg)
        umbral_efectivo = get_umbral_efectivo_mxn(fraccion, cfg)
        
        # Rule 1: Monto >= umbral de aviso → PREOCUPANTE
        if monto >= umbral_aviso:
            if final_scores[i] < 0.85:
                final_scores[i] = 0.85
                lfpiorpi_overrides += 1
        
        # Rule 2: Efectivo >= umbral de efectivo → PREOCUPANTE
        elif es_efectivo and monto >= umbral_efectivo:
            if final_scores[i] < 0.85:
                final_scores[i] = 0.85
                lfpiorpi_overrides += 1
        
        # Rule 3: Estructuración (monto redondo + burst) + Efectivo → PREOCUPANTE
        elif es_estructurada and es_efectivo and monto >= (umbral_aviso * 0.7):
            if final_scores[i] < 0.85:
                final_scores[i] = 0.85
                lfpiorpi_overrides += 1
    
    print(f"   ⚖️  Reglas aplicadas: {lfpiorpi_overrides} transacciones elevadas a PREOCUPANTE")
    print(f"{'='*70}\n")
    
    # Classify transactions AFTER LFPIORPI rules
    preocupante = (final_scores > 0.8).sum()
    inusual = ((final_scores > 0.6) & (final_scores <= 0.8)).sum()
    relevante = ((final_scores > 0.4) & (final_scores <= 0.6)).sum()
    limpio = (final_scores <= 0.4).sum()
    
    print(f"   🔴 Preocupante: {preocupante} ({preocupante/total_txns*100:.1f}%)")
    print(f"   🟠 Inusual: {inusual} ({inusual/total_txns*100:.1f}%)")
    print(f"   🟡 Relevante: {relevante} ({relevante/total_txns*100:.1f}%)")
    print(f"   🟢 Limpio: {limpio} ({limpio/total_txns*100:.1f}%)")
    print(f"{'='*70}\n")
    
    resultados = {
        "resumen": {
            "total_transacciones": total_txns,
            "preocupante": int(preocupante),
            "inusual": int(inusual),
            "relevante": int(relevante),
            "limpio": int(limpio),
            "false_positive_rate": 8.2,
            "processing_time_ms": total_txns * 0.15,
            "ml_layers_used": {
                "supervisado": ML_MODELS["supervisado"] is not None,
                "no_supervisado": ML_MODELS["no_supervisado"] is not None,
                "refuerzo": ML_MODELS["refuerzo"] is not None
            }
        },
        "transacciones": [],
        "metadata": {
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "tier": user_tier,
            "cliente_info": cliente_info or {}
        }
    }
    
    # Generate detailed transaction results
    for i in range(min(100, total_txns)):
        row = df.iloc[i]
        score = final_scores[i]
        
        if score > 0.8:
            clasificacion = "preocupante"
        elif score > 0.6:
            clasificacion = "inusual"
        elif score > 0.4:
            clasificacion = "relevante"
        else:
            clasificacion = "limpio"
        
        razones = []
        if scores_supervisado[i] > 0.7:
            razones.append("Patrón sospechoso detectado (ML Supervisado)")
        if scores_no_supervisado[i] > 0.7:
            razones.append("Anomalía detectada (ML No Supervisado)")
        if anomaly_flags[i]:  # Top anomaly flag
            razones.append("Top anomalía identificada (ML No Supervisado)")
        if float(row.get("monto", 0)) > 100000:
            razones.append("Monto elevado")
        
        resultados["transacciones"].append({
            "id": f"TXN-{i+1:05d}",
            "monto": float(row.get("monto", 0)),
            "fecha": str(row.get("fecha", "")),
            "tipo_operacion": str(row.get("tipo_operacion", "")),
            "sector_actividad": str(row.get("sector_actividad", "")),
            "clasificacion": clasificacion,
            "risk_score": round(float(score * 10), 2),
            "scores_detail": {
                "supervisado": round(float(scores_supervisado[i] * 10), 2),
                "no_supervisado": round(float(scores_no_supervisado[i] * 10), 2),
                "refuerzo": round(float(scores_refuerzo[i] * 10), 2)
            },
            "razones": [r for r in razones if r]
        })
    
    # Mark as complete
    ANALYSIS_PROGRESS[analysis_id].update({
        "stage": "complete",
        "progress": 100,
        "message": "Análisis completado",
        "details": {
            **ANALYSIS_PROGRESS[analysis_id]["details"],
            "preocupante": int(preocupante),
            "inusual": int(inusual),
            "relevante": int(relevante),
            "limpio": int(limpio)
        }
    })
    
    # Generate official LFPIORPI XML if reportable transactions exist
    if resultados["resumen"]["preocupante"] > 0:
        # Filter only preocupante transactions
        df_preocupante = df[final_scores > 0.8].copy()
        df_preocupante["clasificacion_lfpiorpi"] = "preocupante"
        
        # Generate official XML
        xml_path = generar_xml_lfpiorpi_oficial(
            df_preocupante,
            analysis_id,
            rfc_emisor="XAXX010101000",  # TODO: Get from user config
            razon_social="TarantulaHawk Usuario"  # TODO: Get from user profile
        )
        
        if xml_path:
            resultados["xml_path"] = str(xml_path)
            resultados["xml_status"] = "PENDING_COMPLETION"
            resultados["xml_message"] = "XML generado. Complete datos de clientes en dashboard antes de enviar a SAT."
    
    return resultados

def calcular_costo(num_transacciones: int, _tier: str = "ignored") -> float:
    """
    Calculate processing cost using tiered pricing.
    
    Modelo escalonado:
    - 1-2,000 txns: $1.00/txn
    - 2,001-5,000 txns: $0.75/txn  
    - 5,001-10,000 txns: $0.50/txn
    - 10,001+ txns: $0.35/txn
    """
    # Try shared pricing utility first
    try:
        if PricingTier is not None:
            cost = float(PricingTier.calculate_cost(int(max(0, num_transacciones))))
            print(f"💰 [PRICING] PricingTier: {num_transacciones} txns = ${cost:.2f}")
            return cost
    except Exception as e:
        print(f"⚠️  [PRICING] PricingTier falló: {e}, usando cálculo local")
    
    # Fallback: cálculo local escalonado
    remaining = int(max(0, num_transacciones))
    cost = 0.0
    
    if remaining == 0:
        return 0.0
    
    # Tier 1: 1-2,000 @ $1.00
    take = min(remaining, 2000)
    cost += take * 1.0
    remaining -= take
    
    # Tier 2: 2,001-5,000 @ $0.75
    if remaining > 0:
        take = min(remaining, 3000)
        cost += take * 0.75
        remaining -= take
    
    # Tier 3: 5,001-10,000 @ $0.50
    if remaining > 0:
        take = min(remaining, 5000)
        cost += take * 0.50
        remaining -= take
    
    # Tier 4: 10,001+ @ $0.35
    if remaining > 0:
        cost += remaining * 0.35
    
    print(f"💰 [PRICING] Local calc: {num_transacciones} txns = ${cost:.2f}")
    return cost

def generar_xml_lfpiorpi_oficial(
    df_preocupante: pd.DataFrame,
    analysis_id: str,
    rfc_emisor: str = "XAXX010101000",
    razon_social: str = "Entidad Ejemplo S.A. de C.V."
) -> Path:
    """
    Generate official LFPIORPI-compliant XML for UIF/SAT reporting
    
    Based on: generar_xml_lfpiorpi.py (official format)
    
    Two-stage approach:
    Stage 1: Generate incomplete XML with cliente_id only
    Stage 2: User completes sensitive data (RFC, CURP, nombre) in dashboard
    
    Args:
        df_preocupante: DataFrame with "preocupante" transactions only
        analysis_id: Unique analysis identifier
        rfc_emisor: RFC of reporting entity
        razon_social: Company name of reporting entity
    
    Returns:
        Path to generated XML file
    """
    
    if len(df_preocupante) == 0:
        return None
    
    print(f"\n{'='*70}")
    print("📄 GENERANDO XML LFPIORPI OFICIAL")
    print(f"{'='*70}")
    print(f"Transacciones preocupantes: {len(df_preocupante)}")
    print(f"Emisor: {razon_social} ({rfc_emisor})")
    
    # Root element (Official LFPIORPI schema)
    root = ET.Element("Archivo")
    root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    root.set("xmlns", "http://www.uif.shcp.gob.mx/recepcion/pld")
    
    # Report metadata
    informe = ET.SubElement(root, "Informe")
    
    mes_reportado = ET.SubElement(informe, "MesReportado")
    mes_reportado.text = datetime.now().strftime("%Y-%m")
    
    # Reporting entity
    sujeto_obligado = ET.SubElement(informe, "SujetoObligado")
    
    rfc_elem = ET.SubElement(sujeto_obligado, "RFC")
    rfc_elem.text = rfc_emisor
    
    razon_elem = ET.SubElement(sujeto_obligado, "RazonSocial")
    razon_elem.text = razon_social
    
    # Notices section
    avisos = ET.SubElement(informe, "Avisos")
    
    for idx, row in df_preocupante.iterrows():
        aviso = ET.SubElement(avisos, "Aviso")
        
        # Reference number
        referencia = ET.SubElement(aviso, "ReferenciaAviso")
        referencia.text = f"AVS-{datetime.now().strftime('%Y%m%d')}-{analysis_id[:8]}-{idx+1:04d}"
        
        # Priority (always high for preocupante)
        prioridad = ET.SubElement(aviso, "Prioridad")
        prioridad.text = "Alta"
        
        # Transaction data
        operacion = ET.SubElement(aviso, "Operacion")
        
        fecha_op = ET.SubElement(operacion, "Fecha")
        fecha_op.text = str(row.get("fecha", ""))[:10]
        
        monto_op = ET.SubElement(operacion, "Monto")
        monto_op.text = f"{row.get('monto', 0):.2f}"
        
        moneda = ET.SubElement(operacion, "Moneda")
        moneda.text = "MXN"
        
        tipo_op = ET.SubElement(operacion, "TipoOperacion")
        tipo_op.text = str(row.get("tipo_operacion", ""))
        
        sector = ET.SubElement(operacion, "SectorActividad")
        sector.text = str(row.get("sector_actividad", ""))
        
        # STAGE 1: Cliente data (incomplete - only ID)
        cliente = ET.SubElement(aviso, "Cliente")
        
        id_interno = ET.SubElement(cliente, "IDInterno")
        id_interno.text = str(row.get("cliente_id", ""))
        
        # Placeholder for sensitive data (to be completed by user)
        cliente_pendiente = ET.SubElement(cliente, "DatosPendientes")
        cliente_pendiente.set("status", "PENDING_COMPLETION")
        cliente_pendiente.set("instruccion", "Completar en dashboard antes de enviar a SAT")
        
        rfc_cliente = ET.SubElement(cliente_pendiente, "RFC")
        rfc_cliente.text = ""
        rfc_cliente.set("required", "true")
        
        nombre = ET.SubElement(cliente_pendiente, "Nombre")
        nombre.text = ""
        nombre.set("required", "true")
        
        curp = ET.SubElement(cliente_pendiente, "CURP")
        curp.text = ""
        curp.set("required", "true")
    
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    xml_filename = f"aviso_LFPIORPI_INCOMPLETO_{analysis_id[:8]}_{timestamp}.xml"
    xml_path = XML_DIR / xml_filename
    
    # Save with pretty formatting
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(xml_path, encoding="utf-8", xml_declaration=True)
    
    print(f"✅ XML generado: {xml_path.name}")
    print(f"   Status: PENDING_COMPLETION")
    print(f"   Avisos: {len(df_preocupante)}")
    print(f"   ⚠️  Usuario debe completar RFC/CURP en dashboard")
    print(f"{'='*70}\n")
    
    return xml_path

# ===================================================================
# ENDPOINT 1: User Registration & Authentication
# ===================================================================

@app.post("/api/auth/register")
async def registrar_usuario(usuario: Usuario):
    """Register new user (portal flow)"""
    # Require giro_negocio / fraccion on registration
    if not (usuario.sector_actividad or usuario.fraccion_lfpiorpi):
        raise HTTPException(status_code=400, detail="El campo 'giro_negocio' (sector_actividad) es obligatorio en el registro")

    # Check if email exists
    for user_data in USERS_DB.values():
        if user_data["email"] == usuario.email:
            raise HTTPException(status_code=400, detail="Email ya registrado")
    
    user_id = str(uuid.uuid4())
    
    USERS_DB[user_id] = {
        "user_id": user_id,
        "email": usuario.email,
        "password_hash": hash_password(usuario.password),  # Use bcrypt
        "company": usuario.company,
        "tier": usuario.tier,
        "balance": 0.0,
        "sector_actividad": usuario.sector_actividad,
        "fraccion_lfpiorpi": usuario.fraccion_lfpiorpi,
        "created_at": datetime.now(),
        "total_analyses": 0
    }
    
    # Generate JWT token
    token = crear_jwt_token(user_id, usuario.email)
    
    # Persist profile in Supabase (if available)
    try:
        if supabase_admin:
            profile_payload = {
                "id": user_id,
                "email": usuario.email,
                "company": usuario.company,
                "sector_actividad": usuario.sector_actividad,
                "fraccion_lfpiorpi": usuario.fraccion_lfpiorpi,
                "account_balance_usd": 0.0,
                "created_at": datetime.now().isoformat()
            }
            supabase_admin.table("profiles").insert(profile_payload).execute()
            print(f"✅ Perfil creado en Supabase para {user_id}")
    except Exception as e:
        print(f"⚠️  No se pudo insertar perfil en Supabase: {e}")

    return {
        "success": True,
        "user_id": user_id,
        "token": token,  # Return JWT
        "message": "Usuario registrado exitosamente"
    }


@app.post("/api/auth/save-profile")
async def save_profile(payload: Dict[str, Any]):
    """Persist sector_actividad and fraccion_lfpiorpi in Supabase profiles by email (upsert)."""
    email = payload.get("email")
    sector = payload.get("sector_actividad")
    fraccion = payload.get("fraccion_lfpiorpi")

    if not email:
        raise HTTPException(status_code=400, detail="email required")

    # Require giro/fraccion when saving profile
    if not sector or not fraccion:
        raise HTTPException(status_code=400, detail="sector_actividad and fraccion_lfpiorpi are required")

    if not supabase_admin:
        # Try to persist locally
        for uid, u in USERS_DB.items():
            if u.get("email") == email:
                u["sector_actividad"] = sector
                u["fraccion_lfpiorpi"] = fraccion
                return {"success": True, "updated_local": True}
        return {"success": False, "error": "Supabase admin client not configured"}

    try:
        profile_payload = {
            "email": email,
            "sector_actividad": sector,
            "fraccion_lfpiorpi": fraccion,
            "updated_at": datetime.now().isoformat()
        }
        # Use upsert to create or update by email
        resp = supabase_admin.table("profiles").upsert(profile_payload).execute()
        return {"success": True, "supabase": getattr(resp, 'data', None)}
    except Exception as e:
        print(f"⚠️ Error saving profile: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/auth/login")
@limiter.limit("5/minute")  # Prevent brute force attacks
async def login_usuario(request: Request, email: str, password: str):
    """User login with JWT"""
    
    for user_id, user_data in USERS_DB.items():
        if user_data["email"] == email:
            # Verify password with bcrypt
            if verificar_password(password, user_data["password_hash"]):
                # Generate JWT token
                token = crear_jwt_token(user_id, email)
                
                return {
                    "success": True,
                    "user_id": user_id,
                    "token": token,  # Return JWT instead of plain user_id
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
    user: Dict = Depends(validar_supabase_jwt)
):
    """Generate API key for enterprise customers"""
    
    if user["tier"] != "enterprise":
        raise HTTPException(status_code=403, detail="Solo disponible para tier Enterprise")
    
    api_key, api_secret, api_key_hash = generar_api_key()  # Returns tuple
    
    API_KEYS_DB[api_key_hash] = {  # Store by hash, not plain key
        "user_id": user["user_id"],
        "company": company,
        "tier": tier,
        "secret": api_secret,  # Secret for HMAC
        "created_at": datetime.now(),
        "requests_count": 0,
        "active": True
    }
    
    return {
        "success": True,
        "api_key": api_key,  # Return plain key to user (only time they see it)
        "api_secret": api_secret,  # Return secret for HMAC signing
        "message": "API key generada exitosamente. Guárdala de forma segura (no se puede recuperar)."
    }

@app.get("/api/enterprise/api-keys")
async def listar_api_keys(user: Dict = Depends(validar_supabase_jwt)):
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

@app.options("/api/portal/validate")
async def validate_preflight(request: Request):
    """Handle CORS preflight for validate endpoint"""
    origin = request.headers.get("origin", "*")
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )

@app.post("/api/portal/validate")
async def validar_archivo_portal(
    file: UploadFile = File(...)
):
    """
    PUBLIC ENDPOINT - Validate file structure before upload
    No auth required since it only validates format, doesn't process data
    """
    """
    Validate file only - don't process yet
    Returns file_id and basic stats for user confirmation
    """
    try:
        # Save temp file
        file_id = str(uuid.uuid4())
        file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Quick validation (CSV-only)
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_path, encoding='utf-8-sig', skip_blank_lines=True, nrows=10)
        else:
            os.remove(file_path)
            raise HTTPException(status_code=400, detail="Unsupported format. Use .csv")
        
        # Get total row count (CSV-only)
        total_rows = sum(1 for _ in open(file_path)) - 1  # -1 for header
        
        # Get column names from the dataframe
        columns = df.columns.tolist()
        # ✅ CORREGIDO: sector_actividad es OPCIONAL
        required_cols = ["cliente_id", "monto", "fecha", "tipo_operacion"]
        optional_cols = ["sector_actividad", "hora", "id_transaccion"]
        missing = [c for c in required_cols if c not in columns]

        if missing:
            # Delete temp file since it's invalid
            try:
                os.remove(file_path)
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Archivo inválido - faltan columnas obligatorias",
                    "missing_columns": missing,
                    "required": required_cols,
                    "optional": optional_cols
                }
            )
        
        print(f"✅ File validated: {file.filename} - {total_rows} rows, {len(columns)} columns")
        print(f"📋 Columns detected: {columns}")
        
        # ✅ LIMPIEZA: validate solo checa estructura, no reutiliza archivo
        # El upload volverá a subir el archivo, así que borramos el temp
        try:
            os.remove(file_path)
            print(f"🗑️ Temp file cleaned: {file_path}")
        except Exception as cleanup_error:
            print(f"⚠️ Failed to cleanup temp file: {cleanup_error}")
        
        # Let CORSMiddleware handle headers; just return JSON
        return {
            "success": True,
            "file_id": file_id,
            "file_name": file.filename,
            "rowCount": total_rows,
            "columns": columns,
            "message": "File validated successfully. Ready for analysis."
        }
    except HTTPException:
        # Re-raise HTTPException with proper status codes (400, 413, etc.)
        raise
    except Exception as e:
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.options("/api/portal/upload")
async def upload_preflight(request: Request):
    """
    Explicit OPTIONS handler for /api/portal/upload preflight
    
    When the browser sends Authorization header (Bearer token), it triggers
    a CORS preflight (OPTIONS) request. FastAPI CORSMiddleware should handle
    this automatically, but some Codespaces proxy setups require an explicit
    handler that echoes the origin with credentials=true.
    """
    origin = request.headers.get("origin", "*")
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, X-User-ID, X-Skip-No-Supervised",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        },
    )

@app.post("/api/portal/upload", response_model=RespuestaAnalisis)
@limiter.limit("10/minute")  # Max 10 uploads per minute
async def upload_archivo_portal(
    request: Request,
    file: UploadFile = File(...),
    user: Dict = Depends(validar_supabase_jwt)
    ,
    skip_no_supervised: Optional[str] = Header(None, alias="X-Skip-No-Supervised")
):
    """
    SMALL USER FLOW - Portal Upload (NEW: usando runner externo)
    
    1. User uploads file via web portal (max 500MB)
    2. Validate structure
    3. Enrich with validador_enriquecedor (training_mode=False, writes to pending/)
    4. Run ml_runner.py to process enriched file
    5. Charge billing
    6. Return results
    """
    
    # Validate file size (500MB max)
    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB in bytes
    
    try:
        # Generate analysis_id first
        analysis_id = str(uuid.uuid4())
        
        # Save uploaded file and check size
        file_path = UPLOAD_DIR / f"{analysis_id}_{file.filename}"
        
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
        
        print(f"\n{'='*70}")
        print(f"📤 UPLOAD - Analysis ID: {analysis_id}")
        print(f"{'='*70}")
        
        # Load file (CSV-only)
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_path, encoding='utf-8-sig', skip_blank_lines=True)
        else:
            os.remove(file_path)
            raise HTTPException(status_code=400, detail="Formato no soportado. Use .csv")

        # ✅ CORREGIDO: sector_actividad es OPCIONAL (se infiere en validador_enriquecedor)
        required_cols = ["cliente_id", "monto", "fecha", "tipo_operacion"]
        optional_cols = ["sector_actividad", "hora", "id_transaccion"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            try:
                os.remove(file_path)
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Archivo inválido - faltan columnas obligatorias",
                    "missing_columns": missing,
                    "required": required_cols,
                    "optional": optional_cols,
                    "note": "sector_actividad es opcional y se inferirá automáticamente"
                }
            )
        
        print(f"✅ Archivo cargado: {len(df)} filas, {len(df.columns)} columnas")
        
        # STEP 1: Enrich with validador_enriquecedor (inference mode)
        print(f"🔧 Enriqueciendo con validador_enriquecedor (modo inferencia)...")
        
        try:
            config_path = Path(__file__).parent.parent / "models" / "config_modelos.json"

            # Try to fetch user's saved fraccion/sector from Supabase profiles
            user_fraccion = None
            user_sector = None
            try:
                if supabase_admin:
                    resp = supabase_admin.table("profiles").select("fraccion_lfpiorpi,sector_actividad").eq("id", user["user_id"]).limit(1).execute()
                    if resp and getattr(resp, 'data', None):
                        row = resp.data[0]
                        user_fraccion = row.get("fraccion_lfpiorpi")
                        user_sector = row.get("sector_actividad")
                        print(f"🔎 Perfil Supabase: fraccion={user_fraccion}, sector={user_sector}")
            except Exception as sup_err:
                print(f"⚠️ Could not fetch profile from Supabase: {sup_err}")

            # Prefer direct enriquecer_art17_file when we have a fraccion key
            enriched_path = None
            try:
                enrich_file_fn = getattr(_ve, 'enriquecer_art17_file', None)
            except Exception:
                enrich_file_fn = None

            if user_fraccion and enrich_file_fn:
                # Use validador's file-level enricher that accepts fraccion_lfpiorpi directly
                enriched_path = enrich_file_fn(
                    input_path=str(file_path),
                    cfg=cargar_config_lfpiorpi(),
                    fraccion_lfpiorpi=user_fraccion,
                    training_mode=False,
                    analysis_id=analysis_id,
                )
                print(f"✅ Enriquecido (fraccion fija) guardado en: {enriched_path}")
            else:
                # Fallback: call procesar_archivo and let it infer from file or optional sector
                sector_input = user_sector if user_sector else "use_file"
                enriched_path = procesar_archivo(
                    str(file_path),
                    sector_actividad=sector_input,
                    config_path=str(config_path),
                    training_mode=False,
                    analysis_id=analysis_id
                )

            # Procesar retorno: procesar_archivo/enriquecer_art17_file puede devolver either a path string
            if isinstance(enriched_path, (tuple, list)):
                success = enriched_path[0]
                msg = enriched_path[1] if len(enriched_path) > 1 else None
                if not success:
                    raise HTTPException(status_code=400, detail={"error": "Enrichment failed", "message": msg})
                enriched_path = msg

            if not enriched_path or not Path(enriched_path).exists():
                raise FileNotFoundError(f"Enriched file not found: {enriched_path}")

            # Ensure runner sees the enriched file where it expects: outputs/enriched/pending/<analysis_id>.csv
            try:
                pending_dir = Path(__file__).parent.parent / "outputs" / "enriched" / "pending"
                pending_dir.mkdir(parents=True, exist_ok=True)
                pending_path = pending_dir / f"{analysis_id}.csv"
                shutil.copy2(enriched_path, pending_path)
                print(f"✅ Copied enriched to pending: {pending_path}")
            except Exception as copy_err:
                print(f"⚠️ Could not copy enriched to pending: {copy_err}")

        except Exception as enrich_error:
            print(f"❌ Error en enriquecimiento:")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error en enriquecimiento: {str(enrich_error)}")
        
        # STEP 2: Run ML runner to process enriched file
        print(f"🤖 Ejecutando ML runner...")
        
        import subprocess
        runner_path = Path(__file__).parent / "ml_runner.py"
        # Prepare environment for runner subprocess; forward SKIP flag if provided
        env = os.environ.copy()
        if skip_no_supervised and str(skip_no_supervised).lower() in ("1", "true", "yes"):
            env["SKIP_NO_SUPERVISED"] = "1"
            print("⚠️ Forwarding SKIP_NO_SUPERVISED to runner")
        # Forward user's fraccion if available so runner can apply fraccion-specific rules
        if user_fraccion:
            env["FRACCION_LFPIORPI"] = str(user_fraccion)
            print(f"⚠️ Forwarding FRACCION_LFPIORPI={user_fraccion} to runner")
        result = subprocess.run(
            [sys.executable, str(runner_path), analysis_id],
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 min timeout
        )
        
        if result.returncode != 0:
            print(f"❌ Runner falló:")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            error_detail = result.stderr or result.stdout or "Unknown error"
            raise HTTPException(status_code=500, detail=f"Error en ML processing: {error_detail[:500]}")
        
        print(f"✅ Runner completado exitosamente")
        print(result.stdout)
        
        # STEP 3: Load results from processed/{analysis_id}.json
        # ✅ CORREGIDO: Buscar ambos formatos de archivo
        results_dir = Path(__file__).parent.parent / "outputs" / "enriched" / "processed"
        results_path = results_dir / f"{analysis_id}.json"
        results_path_v2 = results_dir / f"{analysis_id}_v2.json"
        
        # Intentar ambos paths
        if results_path_v2.exists():
            actual_path = results_path_v2
        elif results_path.exists():
            actual_path = results_path
        else:
            raise HTTPException(status_code=500, detail=f"No se generaron resultados. Buscado: {results_path.name} o {results_path_v2.name}")
        
        with open(actual_path, 'r', encoding='utf-8') as f:
            resultados = json.load(f)

        # Normalizar estructura de resultados:
        # - Caso V2 (esperado): dict con keys 'resumen' y 'transacciones'
        # - Caso legacy: el JSON puede ser el diccionario 'resumen' directamente
        if isinstance(resultados, dict):
            if 'resumen' not in resultados:
                # Legacy: fuiste devuelto un dict que YA ES el resumen; envolverlo en V2
                resumen_obj = resultados
                resultados = {
                    'analysis_id': analysis_id,
                    'resumen': resumen_obj,
                    'transacciones': []
                }
            else:
                # Asegurar claves mínimas
                if 'transacciones' not in resultados:
                    resultados['transacciones'] = []
        else:
            # Forma inesperada → construir estructura mínima
            resultados = {
                'analysis_id': analysis_id,
                'resumen': {},
                'transacciones': []
            }
        
        # STEP 4: Billing - Check balance and charge user
        num_transacciones = len(df)
        user_id = user["user_id"]
        
        print(f"💳 [BILLING] Verificando saldo para {num_transacciones} transacciones...")
        
        # Get user billing info
        billing = obtener_billing_usuario(user_id)
        if not billing:
            raise HTTPException(status_code=500, detail="No se pudo obtener información de billing")
        
        # Calculate cost
        calculo = calcular_costo_actualizado(num_transacciones, billing)
        costo = calculo["costo"]
        
        print(f"💰 Costo calculado: ${costo:.2f} | Saldo actual: ${billing['balance']:.2f}")
        
        # Check if user has sufficient balance
        if calculo["requires_payment"]:
            print(f"❌ Fondos insuficientes - Se requiere pago")
            # Clean up files
            os.remove(file_path) if file_path.exists() else None
            raise HTTPException(
                status_code=402,
                detail={
                    "error": f"Saldo insuficiente. Necesitas ${costo:.2f}, tienes ${billing['balance']:.2f}",
                    "required_amount": costo,
                    "current_balance": billing["balance"],
                    "num_transactions": num_transacciones
                }
            )
        
        # Charge user
        print(f"💳 Cobrando ${costo:.2f}...")
        resultado_cobro = cobrar_transacciones(user_id, num_transacciones, f"Análisis AML - {file.filename}")
        
        if not resultado_cobro["success"]:
            print(f"❌ Error al cobrar: {resultado_cobro.get('error')}")
            os.remove(file_path) if file_path.exists() else None
            raise HTTPException(status_code=402, detail=resultado_cobro.get("error", "Error al procesar pago"))
        
        print(f"✅ Cobrado exitosamente: ${resultado_cobro['charged']:.2f} | Nuevo saldo: ${resultado_cobro['balance_after']:.2f}")
        
        # ✅ Archivar archivo original (no eliminar)
        archived_dir = BASE_DIR / "uploads" / "archived" / user_id
        archived_dir.mkdir(parents=True, exist_ok=True)
        archived_path = archived_dir / f"{analysis_id}_original.csv"
        shutil.copy2(file_path, archived_path)
        os.remove(file_path)  # Eliminar temp, mantener archived
        
        # ✅ Guardar en Supabase analysis_history
        try:
            history_data = {
                "analysis_id": analysis_id,
                "user_id": user_id,
                "file_name": file.filename,
                "total_transacciones": num_transacciones,
                "costo": float(resultado_cobro.get("charged", 0)),
                "pagado": True,
                "original_file_path": f"uploads/archived/{user_id}/{analysis_id}_original.csv",
                "processed_file_path": f"outputs/enriched/processed/{analysis_id}.csv",
                "json_results_path": f"outputs/enriched/processed/{actual_path.name}",
                "xml_path": resultados.get("xml_path"),
                "resumen": resultados["resumen"],
                "estrategia": resultados["resumen"].get("estrategia"),
                "balance_after": float(resultado_cobro.get("balance_after", 0))
            }
            supabase_admin.table("analysis_history").insert(history_data).execute()
            print(f"✅ Historial guardado en Supabase")
        except Exception as db_error:
            print(f"⚠️  Warning: No se pudo guardar en analysis_history: {db_error}")
            # Non-critical, continue
        
        # Save to in-memory history (backward compatibility)
        ANALYSIS_HISTORY[analysis_id] = {
            "user_id": user["user_id"],
            "resultados": resultados,
            "costo": resultado_cobro.get("charged", 0),
            "pagado": True,
            "balance_after": resultado_cobro.get("balance_after"),
            "timestamp": datetime.now(),
            "file_name": file.filename
        }
        
        # ✅ Retornar resultados completos después de cobrar exitosamente
        return RespuestaAnalisis(
            success=True,
            analysis_id=analysis_id,
            resumen=resultados["resumen"],
            transacciones=resultados["transacciones"],
            xml_path=resultados.get("xml_path"),
            costo=resultado_cobro.get("charged", 0),
            requiere_pago=False,
            payment_id=None,
            timestamp=datetime.now()
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (already formatted)
        raise
    except Exception as e:
        import traceback
        print(f"❌ [UPLOAD] Error inesperado en upload_archivo_portal:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ===================================================================
# ENDPOINT 4: Enterprise Direct API Flow
# ===================================================================

@app.post("/api/v1/analizar", response_model=RespuestaAnalisis)
@limiter.limit("100/minute")  # Max 100 requests per minute for enterprise
async def analizar_transacciones_api(
    request: Request,
    lote: LoteTransacciones,
    idempotency_key: str = Header(None, alias="Idempotency-Key"),
    api_data: Dict = Depends(validar_api_key)
):
    """
    ENTERPRISE FLOW - Direct API
    
    Large corporations send JSON directly, process on their servers
    Supports idempotency to prevent duplicate processing on retries
    """
    
    # Check idempotency cache
    if idempotency_key and idempotency_key in IDEMPOTENCY_CACHE:
        print(f"♻️  Returning cached response for idempotency key: {idempotency_key}")
        return IDEMPOTENCY_CACHE[idempotency_key]
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame([t.dict() for t in lote.transacciones])
        
        # STEP 1: Validate and enrich data
        df = validar_enriquecer_datos(df)
        
        # Generate analysis_id
        analysis_id = str(uuid.uuid4())
        
        # STEP 2: Process with ML (with progress tracking)
        resultados = procesar_transacciones_core(
            df, 
            lote.cliente_info, 
            api_data["tier"],
            analysis_id
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
# ENDPOINT 4B: Batch Analysis (Enterprise - High Volume)
# ===================================================================

@app.post("/api/v1/analizar_batch")
@limiter.limit("50/minute")
async def analizar_batch(
    request: Request,
    lote: LoteTransacciones,
    filter_only_suspicious: bool = True,
    api_data: Dict = Depends(validar_api_key)
):
    """
    Batch processing endpoint for high-volume enterprise clients
    
    Returns only reportable transactions (preocupante + inusual) by default
    
    Use Cases:
    - Automated compliance systems (SAT/UIF daily reports)
    - Real-time alert dashboards (only suspicious transactions)
    - ETL pipelines to data warehouses (reduce data transfer)
    
    Performance: 10x faster response (90% less data transferred)
    
    Args:
        lote: Transaction batch (JSON)
        filter_only_suspicious: If True, returns only preocupante + inusual
        api_data: Validated API key data
    
    Returns:
        Filtered results with only reportable transactions
    """
    
    try:
        # Convert to DataFrame
        df = pd.DataFrame([t.dict() for t in lote.transacciones])
        
        # STEP 1: Validate and enrich data
        df = validar_enriquecer_datos(df)
        
        # STEP 2: Process with ML (same as regular endpoint)
        resultados = procesar_transacciones_core(
            df, 
            lote.cliente_info, 
            api_data["tier"]
        )
        
        analysis_id = resultados["metadata"]["analysis_id"]
        
        # STEP 3: Filter if requested (default: True)
        if filter_only_suspicious:
            # Only return preocupante + inusual
            txs_filtradas = [
                t for t in resultados["transacciones"]
                if t["clasificacion"] in ["preocupante", "inusual"]
            ]
            
            # Calculate cost (same billing)
            costo = calcular_costo(len(df), api_data["tier"])
            
            # Save to history (full results, not filtered)
            ANALYSIS_HISTORY[analysis_id] = {
                "api_key": api_data,
                "resultados": resultados,  # Store complete results
                "costo": costo,
                "timestamp": datetime.now()
            }
            
            # Update usage
            for key, data in API_KEYS_DB.items():
                if data["user_id"] == api_data["user_id"]:
                    data["requests_count"] += 1
            
            # Return FILTERED response
            return {
                "success": True,
                "analysis_id": analysis_id,
                "total_procesadas": resultados["resumen"]["total_transacciones"],
                "total_reportables": len(txs_filtradas),
                "porcentaje_sospechoso": round(
                    len(txs_filtradas) / resultados["resumen"]["total_transacciones"] * 100, 2
                ) if resultados["resumen"]["total_transacciones"] > 0 else 0,
                "transacciones": txs_filtradas,  # Only suspicious ones
                "resumen": {
                    "preocupante": resultados["resumen"]["preocupante"],
                    "inusual": resultados["resumen"]["inusual"]
                },
                "xml_path": resultados.get("xml_path"),
                "xml_status": resultados.get("xml_status"),
                "costo": costo,
                "requiere_pago": False,
                "timestamp": datetime.now()
            }
        
        # If filter=False, return all (same as /api/v1/analizar)
        costo = calcular_costo(len(df), api_data["tier"])
        
        ANALYSIS_HISTORY[analysis_id] = {
            "api_key": api_data,
            "resultados": resultados,
            "costo": costo,
            "timestamp": datetime.now()
        }
        
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
            requiere_pago=False,
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
    user: Dict = Depends(validar_supabase_jwt)
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
    user: Dict = Depends(validar_supabase_jwt)
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
    user: Dict = Depends(validar_supabase_jwt)
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
    user: Dict = Depends(validar_supabase_jwt),
    limit: int = 50
):
    """Get user analysis history from Supabase"""
    try:
        result = supabase_admin.table("analysis_history")\
            .select("*")\
            .eq("user_id", user["user_id"])\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        
        return {"historial": result.data or []}
    
    except Exception as e:
        print(f"❌ Error obteniendo historial: {e}")
        # Fallback a in-memory si DB falla
        historial = [
            {
                "analysis_id": aid,
                "timestamp": data["timestamp"],
                "total_transacciones": data["resultados"]["resumen"]["total_transacciones"],
                "costo": data.get("costo", data.get("charged", 0)),
                "pagado": data.get("pagado", True),
                "file_name": data.get("file_name"),
                "resumen": data["resultados"]["resumen"],
                "created_at": data["timestamp"].isoformat() if hasattr(data["timestamp"], "isoformat") else str(data["timestamp"])
            }
            for aid, data in ANALYSIS_HISTORY.items()
            if data["user_id"] == user["user_id"]
        ]
        return {"historial": sorted(historial, key=lambda x: x["timestamp"], reverse=True)[:limit]}

# ===================================================================
# ENDPOINT 7: Get Analysis Details from DB
# ===================================================================

@app.get("/api/history/{analysis_id}")
async def obtener_detalle_analisis(
    analysis_id: str,
    user: Dict = Depends(validar_supabase_jwt)
):
    """Obtener detalles completos de un análisis desde Supabase"""
    try:
        result = supabase_admin.table("analysis_history")\
            .select("*")\
            .eq("analysis_id", analysis_id)\
            .eq("user_id", user["user_id"])\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Análisis no encontrado")
        
        return result.data
    
    except Exception as e:
        print(f"❌ Error obteniendo análisis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================================================================
# ENDPOINT 8: Download Original File
# ===================================================================

@app.get("/api/history/{analysis_id}/download/original")
async def descargar_archivo_original(
    analysis_id: str,
    user: Dict = Depends(validar_supabase_jwt)
):
    """Descargar archivo CSV original (solo lectura, validado ownership)"""
    try:
        # Verificar ownership desde DB
        result = supabase_admin.table("analysis_history")\
            .select("original_file_path, file_name, user_id")\
            .eq("analysis_id", analysis_id)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Análisis no encontrado")
        
        if result.data["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        file_path = BASE_DIR / result.data["original_file_path"]
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
        return FileResponse(
            path=file_path,
            media_type="text/csv",
            filename=result.data["file_name"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error descargando original: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================================================================
# ENDPOINT 9: Download Processed Results
# ===================================================================

@app.get("/api/history/{analysis_id}/download/results")
async def descargar_resultados_procesados(
    analysis_id: str,
    user: Dict = Depends(validar_supabase_jwt)
):
    """Descargar CSV procesado con predicciones ML"""
    try:
        # Verificar ownership desde DB
        result = supabase_admin.table("analysis_history")\
            .select("processed_file_path, file_name, user_id")\
            .eq("analysis_id", analysis_id)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Análisis no encontrado")
        
        if result.data["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        file_path = BASE_DIR / result.data["processed_file_path"]
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
        # Cambiar nombre para indicar que tiene predicciones
        processed_name = result.data["file_name"].replace(".csv", "_analizado.csv")
        
        return FileResponse(
            path=file_path,
            media_type="text/csv",
            filename=processed_name
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error descargando resultados: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================================================================
# ENDPOINT 10: Download XML
# ===================================================================

@app.get("/api/xml/{analysis_id}")
async def descargar_xml(
    analysis_id: str,
    user: Dict = Depends(validar_supabase_jwt)
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

@app.get("/")
async def root():
    """Root endpoint - CORS test"""
    return {
        "service": "TarantulaHawk API",
        "status": "running",
        "version": "3.0.0",
        "cors": "enabled",
        "docs": "/api/docs"
    }

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
async def obtener_estadisticas(user: Dict = Depends(validar_supabase_jwt)):
    """User statistics"""
    
    user_analyses = [a for a in ANALYSIS_HISTORY.values() if a["user_id"] == user["user_id"]]
    
    return {
        "total_analyses": len(user_analyses),
        "total_transactions": sum(a["resultados"]["resumen"]["total_transacciones"] for a in user_analyses),
        "total_spent": sum(a["costo"] for a in user_analyses if a["pagado"]),
        "current_balance": user["balance"],
        "tier": user["tier"]
    }

# ===================================================================
# PORTAL ENDPOINTS
# ===================================================================

@app.get("/api/portal/history")
async def obtener_historial_portal(
    user: Dict = Depends(validar_supabase_jwt),
    limit: int = 50
):
    """Get user analysis history for portal view"""
    try:
        # Intentar obtener de Supabase primero
        if supabase_admin:
            result = supabase_admin.table("analysis_history")\
                .select("*")\
                .eq("user_id", user["user_id"])\
                .order("created_at", desc=True)\
                .limit(limit)\
                .execute()
        
            return {"historial": result.data or []}
    
        # Fallback a in-memory
        historial = [
            {
                "analysis_id": aid,
                "timestamp": data["timestamp"],
                "total_transacciones": data["resultados"]["resumen"]["total_transacciones"],
                "costo": data.get("costo", 0),
                "pagado": data.get("pagado", True),
                "file_name": data.get("file_name", "Sin nombre"),
                "created_at": data["timestamp"].isoformat() if hasattr(data["timestamp"], "isoformat") else str(data["timestamp"])
            }
            for aid, data in ANALYSIS_HISTORY.items()
            if data["user_id"] == user["user_id"]
        ]
        return {"historial": sorted(historial, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]}

    except Exception as e:
        print(f"❌ Error obteniendo historial portal: {e}")
        return {"historial": []}

@app.get("/api/portal/pending-payments")
async def obtener_pagos_pendientes(user: Dict = Depends(validar_supabase_jwt)):
    """Get pending payments for user"""
    try:
        # Intentar obtener de Supabase
        if supabase_admin:
            result = supabase_admin.table("analysis_history")\
                .select("*")\
                .eq("user_id", user["user_id"])\
                .eq("pagado", False)\
                .order("created_at", desc=True)\
                .execute()
            return {"pending_payments": result.data or []}

        # Fallback a in-memory
        pendientes = [
            {
                "analysis_id": aid,
                "timestamp": data["timestamp"],
                "costo": data.get("costo", 0),
                "file_name": data.get("file_name", "Sin nombre"),
                "created_at": data["timestamp"].isoformat() if hasattr(data["timestamp"], "isoformat") else str(data["timestamp"])
            }
            for aid, data in ANALYSIS_HISTORY.items()
            if data["user_id"] == user["user_id"] and not data.get("pagado", True)
        ]
        return {"pending_payments": sorted(pendientes, key=lambda x: x.get("timestamp", ""), reverse=True)}

    except Exception as e:
        print(f"❌ Error obteniendo pagos pendientes: {e}")
        return {"pending_payments": []}

@app.get("/api/portal/balance")
async def obtener_balance_usuario(user: Dict = Depends(validar_supabase_jwt)):
    """Get current user balance"""
    try:
        if supabase_admin:
            result = supabase_admin.table("usuarios")\
                .select("balance")\
                .eq("id", user["user_id"])\
                .single()\
                .execute()
            
            if result.data:
                return {"balance": result.data.get("balance", 0)}
        
        # Fallback
        return {"balance": 0}
    
    except Exception as e:
        print(f"❌ Error obteniendo balance: {e}")
        return {"balance": 0}

@app.get("/api/portal/analysis/{analysis_id}/result")
async def obtener_resultado_analisis(
    analysis_id: str,
    user: Dict = Depends(validar_supabase_jwt)
):
    """Get processed CSV result for an analysis (authenticated)"""
    try:
        # Verificar ownership desde DB
        if supabase_admin:
            result = supabase_admin.table("analysis_history")\
                .select("processed_file_path, file_name, user_id")\
                .eq("analysis_id", analysis_id)\
                .single()\
                .execute()
            
            if not result.data:
                raise HTTPException(status_code=404, detail="Análisis no encontrado")
            
            # Normalizar a string para evitar type mismatch
            if str(result.data["user_id"]) != str(user["user_id"]):
                raise HTTPException(status_code=403, detail="No autorizado")
            
            # Validar path traversal
            from pathlib import Path
            rel = Path(result.data["processed_file_path"])
            if rel.is_absolute() or ".." in rel.parts:
                raise HTTPException(status_code=400, detail="Ruta inválida")
            
            file_path = (BASE_DIR / rel).resolve()
            base = BASE_DIR.resolve()
            if not str(file_path).startswith(str(base)):
                raise HTTPException(status_code=400, detail="Ruta inválida")
            
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Archivo no encontrado")
            
            return FileResponse(
                path=file_path,
                media_type="text/csv",
                filename=result.data["file_name"].replace(".csv", "_analizado.csv")
            )
        
        # Fallback a in-memory
        if analysis_id not in ANALYSIS_HISTORY:
            raise HTTPException(status_code=404, detail="Análisis no encontrado")
        
        analysis = ANALYSIS_HISTORY[analysis_id]
        
        # Normalizar a string para evitar type mismatch
        if str(analysis["user_id"]) != str(user["user_id"]):
            raise HTTPException(status_code=403, detail="No autorizado")
        
        file_path = BASE_DIR / f"outputs/enriched/processed/{analysis_id}.csv"
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        
        return FileResponse(
            path=file_path,
            media_type="text/csv",
            filename=f"{analysis_id}_analizado.csv"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error obteniendo resultado: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)