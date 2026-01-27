#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
operaciones_api.py

API para gestión de operaciones con validación LFPIORPI 2025 completa

Endpoints:
- POST /api/operaciones/crear - Crear nueva operación con validación
- GET /api/operaciones/{id} - Obtener detalles de operación
- GET /api/operaciones/cliente/{cliente_id} - Listar operaciones del cliente
- POST /api/operaciones/validar - Validar operación sin guardar

Autor: TarantulaHawk Compliance Team
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
import json

from .utils.validador_lfpiorpi_2025 import (
    ValidadorLFPIORPI2025,
    ValidacionOperacion,
    crear_validador
)
from .utils.rastreador_acumulado_6m import (
    RastreadorAcumulado6M,
    AccumulationReport,
    crear_rastreador
)

logger = logging.getLogger(__name__)

# ============================================================================
# ESQUEMAS PYDANTIC
# ============================================================================

class OperacionCrearRequest(BaseModel):
    """Request para crear operación"""
    cliente_id: str = Field(..., description="ID del cliente")
    fecha_operacion: datetime = Field(..., description="Fecha de la operación")
    hora_operacion: str = Field(..., description="Hora HH:MM:SS")
    actividad_vulnerable: str = Field(..., description="Actividad vulnerable (Art. 17)")
    tipo_operacion: str = Field(..., description="Tipo: venta, compra, arrendamiento, etc.")
    monto: float = Field(..., gt=0, description="Monto en MXN")
    moneda: str = Field(default="MXN", description="Divisa")
    metodo_pago: str = Field(..., description="Efectivo, transferencia, cheque, etc.")
    producto_servicio: str = Field(..., description="Descripción breve del producto/servicio")
    descripcion: Optional[str] = Field(default="", description="Notas adicionales")
    factura_numero: Optional[str] = Field(default="", description="Número de factura")
    referencia_pago: Optional[str] = Field(default="", description="Referencia bancaria")
    banco_origen: Optional[str] = Field(default="", description="Banco de origen (si aplica)")
    notas_internas: Optional[str] = Field(default="", description="Notas para equipo integridad")
    
    @validator("metodo_pago")
    def validar_metodo_pago(cls, v):
        metodos_validos = ["efectivo", "transferencia", "cheque", "tarjeta", "deposito"]
        if v.lower() not in metodos_validos:
            raise ValueError(f"Método de pago inválido: {v}")
        return v.lower()
    
    @validator("actividad_vulnerable")
    def validar_actividad(cls, v):
        # Validación básica (en producción, verificar contra config)
        if not v or v.startswith("_"):
            raise ValueError(f"Actividad vulnerable inválida: {v}")
        return v


class ClienteDataRequest(BaseModel):
    """Datos del cliente para validación"""
    cliente_id: str
    nombre: str
    rfc: Optional[str] = None
    curp: Optional[str] = None
    tipo_persona: str = Field(..., description="fisica o moral")
    sector_actividad: str
    estado: str
    origen_recursos: Optional[str] = "desconocido"
    origen_recursos_documentado: bool = False
    monto_mensual_estimado: float = 0
    en_lista_uif: bool = False
    en_lista_ofac: bool = False
    en_lista_csnu: bool = False
    en_lista_69b: bool = False
    es_pep: bool = False
    beneficiario_controlador_identificado: Optional[bool] = None


class OperacionValidarRequest(BaseModel):
    """Request para validar operación"""
    operacion: OperacionCrearRequest
    cliente: ClienteDataRequest
    operaciones_historicas: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Operaciones previas para calcular acumulado 6m"
    )


# ============================================================================
# RESPUESTAS
# ============================================================================

class ValidacionResponse(BaseModel):
    """Response de validación"""
    operacion_id: str
    es_valida: bool
    debe_bloquearse: bool
    requiere_aviso_uif: bool
    requiere_aviso_24hrs: bool
    alertas: List[str]
    fundamentos_legales: List[str]
    score_ebr: float
    recomendacion: str


class OperacionCrearResponse(BaseModel):
    """Response al crear operación"""
    exito: bool
    operacion_id: str
    mensaje: str
    validacion: ValidacionResponse
    timestamp: datetime


class OperacionDetalleResponse(BaseModel):
    """Response con detalles de operación"""
    operacion_id: str
    cliente_id: str
    fecha_creacion: datetime
    validacion_resultado: Dict[str, Any]
    estado: str  # "pendiente_aviso", "aviso_24hrs", "bloqueada", "procesada"


# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter(prefix="/api/operaciones", tags=["operaciones"])


# Dependencias
def obtener_config() -> Dict[str, Any]:
    """Obtiene configuración LFPIORPI"""
    # En producción, cargar desde archivo/BD
    import json
    with open("/workspaces/tarantulahawk/app/backend/models/config_modelos.json") as f:
        return json.load(f)


def obtener_validador(config: Dict = Depends(obtener_config)) -> ValidadorLFPIORPI2025:
    """Factory de validador"""
    return crear_validador(config)


def obtener_rastreador(config: Dict = Depends(obtener_config)) -> RastreadorAcumulado6M:
    """Factory de rastreador"""
    uma_mxn = config.get("lfpiorpi", {}).get("uma_mxn", 113.14)
    return crear_rastreador(uma_mxn)


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/validar", response_model=ValidacionResponse)
async def validar_operacion(
    request: OperacionValidarRequest,
    validador: ValidadorLFPIORPI2025 = Depends(obtener_validador),
    rastreador: RastreadorAcumulado6M = Depends(obtener_rastreador),
    config: Dict = Depends(obtener_config)
) -> ValidacionResponse:
    """
    Valida una operación sin guardarla
    
    Ejecuta validación completa LFPIORPI:
    1. Listas negras (usa datos del cliente precargados)
    2. Límites efectivo
    3. Umbral aviso individual
    4. Acumulado 6 meses
    5. Indicios procedencia ilícita
    6. EBR del cliente
    
    IMPORTANTE: La validación de listas negras debe ejecutarse ANTES
    en el frontend usando POST /api/kyc/validar-listas.
    Los flags (en_lista_uif, en_lista_ofac, etc.) deben venir
    actualizados en request.cliente.
    """
    try:
        # Paso 1: Obtener acumulado 6 meses
        acumulado_report = rastreador.obtener_acumulado_cliente(
            request.cliente.cliente_id,
            actividad_vulnerable=request.operacion.actividad_vulnerable,
            operaciones_db=request.operaciones_historicas
        )
        
        # Paso 2: Preparar datos para validador (usa flags precargados del cliente)
        cliente_datos = {
            "en_lista_uif": request.cliente.en_lista_uif,
            "en_lista_ofac": request.cliente.en_lista_ofac,
            "en_lista_csnu": request.cliente.en_lista_csnu,
            "en_lista_69b": request.cliente.en_lista_69b,
            "es_pep": request.cliente.es_pep,
            "sector_actividad": request.cliente.sector_actividad,
            "tipo_persona": request.cliente.tipo_persona,
            "origen_recursos": request.cliente.origen_recursos,
            "origen_recursos_documentado": request.cliente.origen_recursos_documentado,
            "estado": request.cliente.estado,
            "monto_mensual_estimado": request.cliente.monto_mensual_estimado,
            "beneficiario_controlador_identificado": request.cliente.beneficiario_controlador_identificado
        }
        
        operacion_data = {
            "folio_interno": f"OP-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "cliente_id": request.cliente.cliente_id,
            "monto": request.operacion.monto,
            "fecha_operacion": request.operacion.fecha_operacion,
            "actividad_vulnerable": request.operacion.actividad_vulnerable,
            "metodo_pago": request.operacion.metodo_pago,
            "tipo_operacion": request.operacion.tipo_operacion
        }
        
        # Paso 3: Validar con LFPIORPI
        validacion = validador.validar_operacion_completa(
            operacion_data,
            cliente_datos,
            operaciones_historicas=request.operaciones_historicas
        )
        
        # Paso 4: Consolidar respuesta
        if validacion.debe_bloquearse:
            recomendacion = "⛔ OPERACIÓN BLOQUEADA - Presentar aviso 24 horas a UIF"
        elif validacion.requiere_aviso_24hrs:
            recomendacion = "⚠️ Requiere aviso 24 horas (indicios procedencia ilícita)"
        elif validacion.requiere_aviso_uif:
            recomendacion = "⚠️ Requiere aviso mensual a UIF (supera umbral)"
        else:
            recomendacion = "✅ Operación permitida (sin alertas LFPIORPI)"
        
        return ValidacionResponse(
            operacion_id=validacion.operacion_id,
            es_valida=validacion.es_valida,
            debe_bloquearse=validacion.debe_bloquearse,
            requiere_aviso_uif=validacion.requiere_aviso_uif,
            requiere_aviso_24hrs=validacion.requiere_aviso_24hrs,
            alertas=validacion.alertas,
            fundamentos_legales=validacion.fundamentos_legales,
            score_ebr=validacion.score_ebr,
            recomendacion=recomendacion
        )
    
    except Exception as e:
        logger.error(f"Error en validación: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en validación: {str(e)}")


@router.post("/crear", response_model=OperacionCrearResponse)
async def crear_operacion(
    request: OperacionValidarRequest,
    validador: ValidadorLFPIORPI2025 = Depends(obtener_validador),
    rastreador: RastreadorAcumulado6M = Depends(obtener_rastreador)
) -> OperacionCrearResponse:
    """
    Crea nueva operación con validación LFPIORPI completa
    
    Flujo:
    1. Validar operación
    2. Si bloqueada o requiere aviso 24h: NO permitir guardar
    3. Si válida o requiere aviso mensual: guardar
    4. Generar avisos si aplica
    """
    try:
        # Ejecutar validación
        validacion_endp = await validar_operacion(
            request, validador, rastreador
        )
        
        # Verificar si debe bloquearse
        if validacion_endp.debe_bloquearse:
            raise HTTPException(
                status_code=400,
                detail=f"⛔ Operación bloqueada por LFPIORPI. {validacion_endp.recomendacion}"
            )
        
        # Si llega aquí, puede guardarse
        # En producción: guardar en BD
        operacion_id = f"OP-{datetime.now().strftime('%Y%m%d%H%M%S')}-{request.cliente.cliente_id[-4:]}"
        
        logger.info(
            f"Operación creada: {operacion_id} - Cliente: {request.cliente.cliente_id} - "
            f"Monto: ${request.operacion.monto:,.0f} - Alertas: {len(validacion_endp.alertas)}"
        )
        
        # Determinar mensaje en base a avisos requeridos
        if validacion_endp.requiere_aviso_uif:
            mensaje = "Operación guardada ✅ - REQUIERE AVISO MENSUAL A UIF (Art. 23)"
        elif validacion_endp.requiere_aviso_24hrs:
            mensaje = "Operación guardada ✅ - REQUIERE AVISO 24 HORAS (Indicios procedencia ilícita)"
        else:
            mensaje = "Operación guardada ✅ - Sin alertas normativas"
        
        return OperacionCrearResponse(
            exito=True,
            operacion_id=operacion_id,
            mensaje=mensaje,
            validacion=validacion_endp,
            timestamp=datetime.now()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creando operación: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creando operación: {str(e)}")


@router.get("/cliente/{cliente_id}/acumulado-6m")
async def obtener_acumulado_cliente(
    cliente_id: str,
    actividad_vulnerable: Optional[str] = Query(None),
    rastreador: RastreadorAcumulado6M = Depends(obtener_rastreador)
) -> Dict[str, Any]:
    """
    Obtiene acumulado de cliente en últimos 6 meses
    
    Query params:
    - actividad_vulnerable: filtrar por actividad específica (opcional)
    """
    try:
        report = rastreador.obtener_acumulado_cliente(
            cliente_id,
            actividad_vulnerable=actividad_vulnerable
        )
        return report.to_dict()
    except Exception as e:
        logger.error(f"Error obteniendo acumulado: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cliente/{cliente_id}/patrones")
async def obtener_patrones_cliente(
    cliente_id: str,
    rastreador: RastreadorAcumulado6M = Depends(obtener_rastreador)
) -> Dict[str, Any]:
    """
    Analiza patrones de operación (estructuración, anomalías, etc.)
    """
    try:
        patrones = rastreador.análisis_patrones_operacion(cliente_id)
        return patrones
    except Exception as e:
        logger.error(f"Error analizando patrones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cliente/{cliente_id}/verificar-listas")
async def verificar_cliente_listas(
    cliente_id: str,
    nombre: str = Query(...),
    rfc: Optional[str] = Query(None)
) -> Dict[str, Any]:
    """
    Endpoint deprecado - Redirige a POST /api/kyc/validar-listas
    
    Este endpoint ahora retorna instrucciones para usar el
    endpoint KYC existente que maneja listas negras.
    """
    return {
        "deprecado": True,
        "mensaje": "Use POST /api/kyc/validar-listas para validación de listas negras",
        "endpoint_correcto": "/api/kyc/validar-listas",
        "metodo": "POST",
        "ejemplo_payload": {
            "nombre": nombre.split()[0] if nombre else "",
            "apellido_paterno": nombre.split()[1] if len(nombre.split()) > 1 else "",
            "apellido_materno": nombre.split()[2] if len(nombre.split()) > 2 else "",
            "rfc": rfc
        },
        "timestamp": datetime.now().isoformat()
    }


@router.get("/health")
async def health_check():
    """Health check del endpoint"""
    return {
        "status": "ok",
        "servicio": "operaciones_lfpiorpi",
        "timestamp": datetime.now().isoformat()
    }


# ============================================================================
# EXPORTAR ROUTER
# ============================================================================

__all__ = ["router"]
