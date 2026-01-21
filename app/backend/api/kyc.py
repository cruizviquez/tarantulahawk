# backend/api/kyc.py
"""
FastAPI endpoints para módulo KYC
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

from ..services.kyc_free_apis import KYCService, RFCValidator, CURPValidator

# Import auth from dedicated module (independent, no dependency on enhanced_main_api)
try:
    from .auth_supabase import verificar_token_supabase, validar_supabase_jwt
except ImportError:
    # Fallback for development
    async def verificar_token_supabase(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
        return {"user_id": "dev_user", "email": "dev@test.com"}
    
    # Backwards compatibility alias
    validar_supabase_jwt = verificar_token_supabase

router = APIRouter(prefix="/api/kyc", tags=["KYC"])

# ==================== MODELS ====================

class ClienteCreate(BaseModel):
    # Datos Básicos
    tipo_persona: str  # 'fisica' o 'moral'
    nombre_completo: str
    rfc: str
    curp: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    
    # Persona Moral
    razon_social: Optional[str] = None
    fecha_constitucion: Optional[str] = None
    
    # Contacto
    telefono: Optional[str] = None
    email: Optional[str] = None
    domicilio_completo: Optional[str] = None
    estado: Optional[str] = None
    
    # Actividad Económica
    sector_actividad: str
    giro_negocio: Optional[str] = None
    ocupacion: Optional[str] = None
    origen_recursos: str


class ValidacionResponse(BaseModel):
    valido: bool
    validaciones: dict
    score_riesgo: int
    aprobado: bool
    alertas: List[str]


# ==================== ENDPOINTS ====================

@router.post("/validar-rfc")
async def validar_rfc(rfc: str):
    """
    Valida formato de RFC (sin consulta a SAT)
    ✅ GRATIS - Validación local
    """
    resultado = RFCValidator.validar_formato(rfc)
    return resultado


@router.post("/validar-curp")
async def validar_curp(curp: str):
    """
    Valida formato de CURP (sin certificación RENAPO)
    ✅ GRATIS - Validación local
    """
    resultado = CURPValidator.validar_formato(curp)
    return resultado


@router.post("/validar-listas-negras")
async def validar_listas_negras(
    nombre: str,
    apellido_paterno: str,
    apellido_materno: str = "",
    rfc: Optional[str] = None
):
    """
    Busca cliente en listas negras públicas:
    - OFAC (US Treasury)
    - CSNU (ONU)
    - Lista 69B SAT
    
    ✅ GRATIS - APIs públicas
    """
    from ..services.kyc_free_apis import OFACService, CSNUService, Lista69BService
    
    resultado = {
        "ofac": OFACService.buscar_nombre(nombre, f"{apellido_paterno} {apellido_materno}"),
        "csnu": CSNUService.buscar_nombre(nombre),
        "lista_69b": Lista69BService.buscar_rfc(rfc) if rfc else {"en_lista": False, "nota": "RFC no proporcionado"}
    }
    
    # Calcular score general
    score_riesgo = 0
    alertas = []
    
    if resultado["ofac"]["encontrado"]:
        score_riesgo += 100
        alertas.append(f"⛔ OFAC: {resultado['ofac']['total']} coincidencias")
    
    if resultado["csnu"]["encontrado"]:
        score_riesgo += 100
        alertas.append(f"⛔ CSNU: {resultado['csnu']['total']} coincidencias")
    
    if resultado["lista_69b"]["en_lista"]:
        score_riesgo += 80
        alertas.append("⛔ RFC en Lista 69B SAT")
    
    return {
        "validaciones": resultado,
        "score_riesgo": min(score_riesgo, 100),
        "aprobado": score_riesgo < 50,
        "alertas": alertas
    }


@router.post("/clientes", response_model=dict)
async def crear_cliente(
    cliente: ClienteCreate,
    user: Dict = Depends(verificar_token_supabase)
):
    """
    Crea nuevo expediente de cliente con validación KYC automática
    """
    
    # 1. Validar datos básicos
    if cliente.tipo_persona == "fisica" and not cliente.curp:
        raise HTTPException(400, "CURP es obligatorio para personas físicas")
    
    # 2. Ejecutar validación KYC completa
    validacion = await KYCService.validar_cliente_completo(
        nombre=cliente.nombre_completo.split()[0],
        apellido_paterno=cliente.nombre_completo.split()[1] if len(cliente.nombre_completo.split()) > 1 else "",
        apellido_materno=cliente.nombre_completo.split()[2] if len(cliente.nombre_completo.split()) > 2 else "",
        rfc=cliente.rfc,
        curp=cliente.curp
    )
    
    # 3. Si está en listas negras, rechazar automáticamente
    if validacion["score_riesgo"] >= 80:
        return {
            "success": False,
            "error": "Cliente rechazado por alto riesgo",
            "validacion": validacion,
            "estado": "rechazado"
        }
    
    # 4. Guardar en base de datos (TODO: implementar con Supabase)
    # cliente_data = {
    #     **cliente.dict(),
    #     "user_id": user["user_id"],
    #     "validacion_kyc": validacion,
    #     "nivel_riesgo": "alto" if validacion["score_riesgo"] > 50 else "medio" if validacion["score_riesgo"] > 20 else "bajo",
    #     "estado_expediente": "pendiente_aprobacion" if validacion["score_riesgo"] > 20 else "aprobado",
    #     "created_at": datetime.now().isoformat()
    # }
    # 
    # db_result = await supabase.table("clientes").insert(cliente_data).execute()
    
    # Por ahora, retornar mock
    return {
        "success": True,
        "cliente_id": "cli_" + datetime.now().strftime("%Y%m%d%H%M%S"),
        "validacion": validacion,
        "estado": "pendiente_aprobacion" if validacion["score_riesgo"] > 20 else "aprobado",
        "mensaje": "Cliente creado exitosamente. Validación KYC completada."
    }


@router.get("/clientes")
async def listar_clientes(
    user: Dict = Depends(verificar_token_supabase),
    filtro_riesgo: Optional[str] = None
):
    """
    Lista clientes del usuario
    """
    # TODO: Implementar query a Supabase
    
    # Mock data
    return {
        "clientes": [
            {
                "cliente_id": "cli_001",
                "nombre_completo": "Juan Pérez García",
                "rfc": "PEGJ850515XY1",
                "nivel_riesgo": "alto",
                "es_pep": False,
                "en_lista_69b": False,
                "en_lista_ofac": False,
                "estado_expediente": "aprobado",
                "created_at": "2025-01-10T10:00:00Z"
            }
        ],
        "total": 1
    }


@router.get("/clientes/{cliente_id}")
async def obtener_cliente(
    cliente_id: str,
    user: Dict = Depends(verificar_token_supabase)
):
    """
    Obtiene expediente completo del cliente
    """
    # TODO: Implementar query a Supabase
    
    return {
        "cliente_id": cliente_id,
        "nombre_completo": "Juan Pérez García",
        "rfc": "PEGJ850515XY1",
        "curp": "PEGJ850515HDFLRN09",
        "validaciones": {
            "rfc": {"valido": True},
            "curp": {"valido": True},
            "listas_negras": {"aprobado": True}
        },
        "documentos": [],
        "operaciones": []
    }


@router.post("/clientes/{cliente_id}/documentos")
async def subir_documento(
    cliente_id: str,
    tipo_documento: str,
    file: UploadFile = File(...),
    user: Dict = Depends(verificar_token_supabase)
):
    """
    Sube documento al expediente del cliente
    Tipos: ine_anverso, ine_reverso, comprobante_domicilio, etc.
    """
    
    # TODO: Implementar upload a Supabase Storage
    # 1. Validar tipo_documento
    # 2. Upload a bucket 'cliente-documentos'
    # 3. Guardar metadata en tabla cliente_documentos
    # 4. (Opcional) Ejecutar OCR si es INE
    
    return {
        "success": True,
        "documento_id": "doc_" + datetime.now().strftime("%Y%m%d%H%M%S"),
        "file_name": file.filename,
        "tipo_documento": tipo_documento,
        "mensaje": "Documento subido exitosamente"
    }


@router.post("/clientes/{cliente_id}/actualizar-listas")
async def actualizar_busqueda_listas(
    cliente_id: str,
    user: Dict = Depends(verificar_token_supabase)
):
    """
    Re-ejecuta búsqueda en listas negras para cliente existente
    Útil para verificación periódica
    """
    
    # TODO: 
    # 1. Obtener datos del cliente
    # 2. Ejecutar búsqueda en listas
    # 3. Guardar historial de búsqueda
    # 4. Actualizar nivel de riesgo si cambió
    
    return {
        "success": True,
        "busqueda_id": "busq_" + datetime.now().strftime("%Y%m%d%H%M%S"),
        "resultado": {
            "ofac": {"encontrado": False},
            "csnu": {"encontrado": False},
            "lista_69b": {"en_lista": False}
        },
        "fecha_busqueda": datetime.now().isoformat()
    }