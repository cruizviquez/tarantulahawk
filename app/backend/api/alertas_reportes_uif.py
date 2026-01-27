#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
alertas_reportes_uif.py

Módulo para generación de alertas y reportes para UIF según LFPIORPI 2025

Tipos de reportes:
- Aviso Mensual (Art. 23): Operaciones que superen umbral
- Aviso 24 Horas (Art. 24): Clientes en listas o indicios procedencia ilícita
- Informe de Ausencia (Art. 25 Reglamento): Si no hay ops reportables

Autor: TarantulaHawk Compliance Team
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import logging
import json
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

# ============================================================================
# ENUMERACIONES
# ============================================================================

class TipoAviso(Enum):
    """Tipos de avisos según LFPIORPI"""
    AVISO_MENSUAL = "aviso_mensual"      # Art. 23
    AVISO_24_HORAS = "aviso_24_horas"    # Art. 24
    INFORME_AUSENCIA = "informe_ausencia"  # Art. 25 Reg.


class EstadoAlerta(Enum):
    """Estados de una alerta"""
    PENDIENTE = "pendiente"
    PROCESADA = "procesada"
    ENVIADA_UIF = "enviada_uif"
    CONFIRMADA = "confirmada"
    RECHAZADA = "rechazada"


# ============================================================================
# ESTRUCTURAS DE DATOS
# ============================================================================

@dataclass
class Alerta:
    """Alerta individual de operación"""
    alerta_id: str
    operacion_id: str
    cliente_id: str
    cliente_nombre: str
    fecha_operacion: datetime
    monto_mxn: float
    monto_umas: float
    actividad_vulnerable: str
    tipo_alerta: TipoAviso
    razon: str
    fundamento_legal: str
    requiere_reporte_uif: bool
    estado: EstadoAlerta = EstadoAlerta.PENDIENTE
    fecha_creacion: datetime = field(default_factory=datetime.now)
    fecha_envio_uif: Optional[datetime] = None
    referencia_uif: Optional[str] = None
    notas_internas: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "alerta_id": self.alerta_id,
            "operacion_id": self.operacion_id,
            "cliente_id": self.cliente_id,
            "cliente_nombre": self.cliente_nombre,
            "fecha_operacion": self.fecha_operacion.isoformat(),
            "monto_mxn": self.monto_mxn,
            "monto_umas": self.monto_umas,
            "actividad_vulnerable": self.actividad_vulnerable,
            "tipo_alerta": self.tipo_alerta.value,
            "razon": self.razon,
            "fundamento_legal": self.fundamento_legal,
            "requiere_reporte_uif": self.requiere_reporte_uif,
            "estado": self.estado.value,
            "fecha_creacion": self.fecha_creacion.isoformat(),
            "fecha_envio_uif": self.fecha_envio_uif.isoformat() if self.fecha_envio_uif else None,
            "referencia_uif": self.referencia_uif,
            "notas_internas": self.notas_internas
        }


@dataclass
class ReporteUIF:
    """Reporte para envío a UIF"""
    reporte_id: str
    tipo_aviso: TipoAviso
    entidad_reportante: str
    fecha_reporte: datetime
    periodo_reporte: str  # "Enero 2025" o "2025-01-24 (24h)"
    total_operaciones: int
    total_clientes_afectados: int
    monto_total_mxn: float
    monto_total_umas: float
    operaciones: List[Dict[str, Any]] = field(default_factory=list)
    estado_envio: EstadoAlerta = EstadoAlerta.PENDIENTE
    fecha_envio: Optional[datetime] = None
    acuse_recibo_uif: Optional[str] = None
    validacion_sat: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "reporte_id": self.reporte_id,
            "tipo_aviso": self.tipo_aviso.value,
            "entidad_reportante": self.entidad_reportante,
            "fecha_reporte": self.fecha_reporte.isoformat(),
            "periodo_reporte": self.periodo_reporte,
            "total_operaciones": self.total_operaciones,
            "total_clientes_afectados": self.total_clientes_afectados,
            "monto_total_mxn": self.monto_total_mxn,
            "monto_total_umas": self.monto_total_umas,
            "operaciones": self.operaciones,
            "estado_envio": self.estado_envio.value,
            "fecha_envio": self.fecha_envio.isoformat() if self.fecha_envio else None,
            "acuse_recibo_uif": self.acuse_recibo_uif,
            "validacion_sat": self.validacion_sat
        }


# ============================================================================
# GENERADOR DE ALERTAS Y REPORTES
# ============================================================================

class GeneradorAlertasUIF:
    """Generador de alertas y reportes para UIF"""
    
    def __init__(self, entidad_reportante: str = "TarantulaHawk", uma_mxn: float = 113.14):
        """
        Inicializa generador
        
        Args:
            entidad_reportante: Nombre de la entidad/sujeto obligado
            uma_mxn: Valor UMA en MXN
        """
        self.entidad_reportante = entidad_reportante
        self.uma_mxn = uma_mxn
        self.alertas_almacenadas: List[Alerta] = []
    
    # ========================================================================
    # CREACIÓN DE ALERTAS
    # ========================================================================
    
    def crear_alerta(
        self,
        operacion_id: str,
        cliente_id: str,
        cliente_nombre: str,
        fecha_operacion: datetime,
        monto_mxn: float,
        actividad_vulnerable: str,
        tipo_alerta: TipoAviso,
        razon: str,
        fundamento_legal: str,
        requiere_reporte_uif: bool = False
    ) -> Alerta:
        """
        Crea una alerta individual
        
        Returns:
            Objeto Alerta
        """
        alerta_id = self._generar_id_alerta()
        monto_umas = monto_mxn / self.uma_mxn
        
        alerta = Alerta(
            alerta_id=alerta_id,
            operacion_id=operacion_id,
            cliente_id=cliente_id,
            cliente_nombre=cliente_nombre,
            fecha_operacion=fecha_operacion,
            monto_mxn=monto_mxn,
            monto_umas=monto_umas,
            actividad_vulnerable=actividad_vulnerable,
            tipo_alerta=tipo_alerta,
            razon=razon,
            fundamento_legal=fundamento_legal,
            requiere_reporte_uif=requiere_reporte_uif
        )
        
        self.alertas_almacenadas.append(alerta)
        
        logger.info(
            f"Alerta creada: {alerta_id} - {tipo_alerta.value} - "
            f"Cliente: {cliente_id} - Monto: ${monto_mxn:,.0f}"
        )
        
        return alerta
    
    def crear_alerta_desde_validacion(
        self,
        operacion_id: str,
        cliente_id: str,
        cliente_nombre: str,
        fecha_operacion: datetime,
        monto_mxn: float,
        actividad_vulnerable: str,
        debe_bloquearse: bool,
        requiere_aviso_uif: bool,
        requiere_aviso_24hrs: bool,
        razon_principal: str,
        fundamentos: List[str]
    ) -> Optional[Alerta]:
        """
        Crea alerta a partir de resultado de validación LFPIORPI
        
        Returns:
            Alerta creada o None si no hay alerta
        """
        if not (requiere_aviso_uif or requiere_aviso_24hrs or debe_bloquearse):
            return None
        
        # Determinar tipo de alerta
        if requiere_aviso_24hrs or debe_bloquearse:
            tipo_alerta = TipoAviso.AVISO_24_HORAS
            requiere_reporte = True
        else:
            tipo_alerta = TipoAviso.AVISO_MENSUAL
            requiere_reporte = True
        
        fundamento_legal = "; ".join(fundamentos) if fundamentos else razon_principal
        
        return self.crear_alerta(
            operacion_id=operacion_id,
            cliente_id=cliente_id,
            cliente_nombre=cliente_nombre,
            fecha_operacion=fecha_operacion,
            monto_mxn=monto_mxn,
            actividad_vulnerable=actividad_vulnerable,
            tipo_alerta=tipo_alerta,
            razon=razon_principal,
            fundamento_legal=fundamento_legal,
            requiere_reporte_uif=requiere_reporte
        )
    
    # ========================================================================
    # GENERACIÓN DE REPORTES
    # ========================================================================
    
    def generar_aviso_mensual(
        self,
        mes: int,
        ano: int
    ) -> Optional[ReporteUIF]:
        """
        Genera Aviso Mensual (Art. 23)
        
        Incluye todas operaciones del mes que superen umbral
        Presentar antes del 17 del mes siguiente
        
        Args:
            mes: Mes (1-12)
            ano: Año
        
        Returns:
            ReporteUIF o None si no hay operaciones reportables
        """
        # Obtener alertas del mes
        alertas_mes = [
            a for a in self.alertas_almacenadas
            if (a.fecha_operacion.month == mes and 
                a.fecha_operacion.year == ano and
                a.requiere_reporte_uif and
                a.tipo_alerta == TipoAviso.AVISO_MENSUAL)
        ]
        
        if not alertas_mes:
            logger.info(f"No hay operaciones reportables para {mes}/{ano}")
            return None
        
        # Construir reporte
        reporte_id = self._generar_id_reporte("MENSUAL", mes, ano)
        fecha_reporte = datetime.now()
        periodo_str = datetime(ano, mes, 1).strftime("%B de %Y")
        
        # Consolidar datos
        clientes_unicos = set(a.cliente_id for a in alertas_mes)
        monto_total_mxn = sum(a.monto_mxn for a in alertas_mes)
        monto_total_umas = sum(a.monto_umas for a in alertas_mes)
        
        # Operaciones detalladas
        operaciones_detalle = [
            {
                **a.to_dict(),
                "referencia_sat": f"REF-{a.alerta_id}"
            }
            for a in alertas_mes
        ]
        
        reporte = ReporteUIF(
            reporte_id=reporte_id,
            tipo_aviso=TipoAviso.AVISO_MENSUAL,
            entidad_reportante=self.entidad_reportante,
            fecha_reporte=fecha_reporte,
            periodo_reporte=periodo_str,
            total_operaciones=len(alertas_mes),
            total_clientes_afectados=len(clientes_unicos),
            monto_total_mxn=monto_total_mxn,
            monto_total_umas=monto_total_umas,
            operaciones=operaciones_detalle
        )
        
        logger.info(
            f"Aviso Mensual generado: {reporte_id} - "
            f"{len(alertas_mes)} operaciones - ${monto_total_mxn:,.0f}"
        )
        
        return reporte
    
    def generar_aviso_24_horas(self) -> Optional[ReporteUIF]:
        """
        Genera Aviso 24 Horas (Art. 24)
        
        Para clientes en listas o indicios procedencia ilícita
        Enviar dentro de 24 horas de detectar
        
        Returns:
            ReporteUIF con alertas de 24h pendientes
        """
        alertas_24h = [
            a for a in self.alertas_almacenadas
            if (a.tipo_alerta == TipoAviso.AVISO_24_HORAS and
                a.estado == EstadoAlerta.PENDIENTE and
                (datetime.now() - a.fecha_creacion) < timedelta(hours=24))
        ]
        
        if not alertas_24h:
            logger.info("No hay alertas de 24 horas pendientes")
            return None
        
        reporte_id = self._generar_id_reporte("24HORAS")
        
        clientes_unicos = set(a.cliente_id for a in alertas_24h)
        monto_total_mxn = sum(a.monto_mxn for a in alertas_24h)
        monto_total_umas = sum(a.monto_umas for a in alertas_24h)
        
        operaciones_detalle = [a.to_dict() for a in alertas_24h]
        
        reporte = ReporteUIF(
            reporte_id=reporte_id,
            tipo_aviso=TipoAviso.AVISO_24_HORAS,
            entidad_reportante=self.entidad_reportante,
            fecha_reporte=datetime.now(),
            periodo_reporte=datetime.now().strftime("%Y-%m-%d %H:%M:%S (Aviso 24h)"),
            total_operaciones=len(alertas_24h),
            total_clientes_afectados=len(clientes_unicos),
            monto_total_mxn=monto_total_mxn,
            monto_total_umas=monto_total_umas,
            operaciones=operaciones_detalle
        )
        
        logger.warning(
            f"Aviso 24 Horas generado: {reporte_id} - "
            f"{len(alertas_24h)} alertas - URGENTE"
        )
        
        return reporte
    
    def generar_informe_ausencia(
        self,
        mes: int,
        ano: int
    ) -> ReporteUIF:
        """
        Genera Informe de Ausencia (Art. 25 Reglamento)
        
        Si no hubo operaciones objeto de aviso durante el mes
        Presentar antes del 17 del mes siguiente
        
        Args:
            mes: Mes (1-12)
            ano: Año
        
        Returns:
            ReporteUIF de ausencia
        """
        # Verificar si hay reportables en el período
        alertas_mes = [
            a for a in self.alertas_almacenadas
            if (a.fecha_operacion.month == mes and 
                a.fecha_operacion.year == ano and
                a.requiere_reporte_uif)
        ]
        
        reporte_id = self._generar_id_reporte("AUSENCIA", mes, ano)
        fecha_reporte = datetime.now()
        periodo_str = datetime(ano, mes, 1).strftime("%B de %Y")
        
        # Si hay reportables, generar aviso mensual en su lugar
        if alertas_mes:
            logger.warning(f"Hay operaciones reportables - usar Aviso Mensual, no Ausencia")
        
        reporte = ReporteUIF(
            reporte_id=reporte_id,
            tipo_aviso=TipoAviso.INFORME_AUSENCIA,
            entidad_reportante=self.entidad_reportante,
            fecha_reporte=fecha_reporte,
            periodo_reporte=f"Informe de Ausencia - {periodo_str}",
            total_operaciones=0,
            total_clientes_afectados=0,
            monto_total_mxn=0,
            monto_total_umas=0,
            operaciones=[]
        )
        
        logger.info(f"Informe de Ausencia generado: {reporte_id}")
        
        return reporte
    
    # ========================================================================
    # EXPORTACIÓN DE REPORTES
    # ========================================================================
    
    def exportar_json(self, reporte: ReporteUIF) -> str:
        """Exporta reporte en formato JSON"""
        return json.dumps(reporte.to_dict(), indent=2, default=str)
    
    def exportar_xml(self, reporte: ReporteUIF) -> str:
        """
        Exporta reporte en formato XML (compatible SAT SPPLD)
        
        En producción, usar esquema oficial SAT
        """
        root = ET.Element("aviso_uif")
        
        # Encabezado
        encabezado = ET.SubElement(root, "encabezado")
        ET.SubElement(encabezado, "id_reporte").text = reporte.reporte_id
        ET.SubElement(encabezado, "tipo_aviso").text = reporte.tipo_aviso.value
        ET.SubElement(encabezado, "entidad_reportante").text = reporte.entidad_reportante
        ET.SubElement(encabezado, "fecha_reporte").text = reporte.fecha_reporte.isoformat()
        ET.SubElement(encabezado, "periodo").text = reporte.periodo_reporte
        
        # Resumen
        resumen = ET.SubElement(root, "resumen")
        ET.SubElement(resumen, "total_operaciones").text = str(reporte.total_operaciones)
        ET.SubElement(resumen, "total_clientes").text = str(reporte.total_clientes_afectados)
        ET.SubElement(resumen, "monto_total_mxn").text = f"{reporte.monto_total_mxn:,.2f}"
        ET.SubElement(resumen, "monto_total_umas").text = f"{reporte.monto_total_umas:,.2f}"
        
        # Operaciones
        operaciones_elem = ET.SubElement(root, "operaciones")
        for op in reporte.operaciones:
            op_elem = ET.SubElement(operaciones_elem, "operacion")
            for key, value in op.items():
                ET.SubElement(op_elem, key).text = str(value)
        
        return ET.tostring(root, encoding='unicode')
    
    # ========================================================================
    # UTILITARIOS
    # ========================================================================
    
    def _generar_id_alerta(self) -> str:
        """Genera ID único para alerta"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        contador = len(self.alertas_almacenadas) + 1
        return f"ALT-{timestamp}-{contador:04d}"
    
    def _generar_id_reporte(self, tipo: str, mes: int = 0, ano: int = 0) -> str:
        """Genera ID único para reporte"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        if mes > 0 and ano > 0:
            periodo = f"{ano}{mes:02d}"
        else:
            periodo = timestamp[:8]
        
        return f"REP-{tipo}-{periodo}-{timestamp[8:]}"
    
    def obtener_alertas_pendientes(
        self,
        tipo_alerta: Optional[TipoAviso] = None,
        cliente_id: Optional[str] = None
    ) -> List[Alerta]:
        """Obtiene alertas pendientes con filtros opcionales"""
        alertas = [
            a for a in self.alertas_almacenadas
            if a.estado == EstadoAlerta.PENDIENTE
        ]
        
        if tipo_alerta:
            alertas = [a for a in alertas if a.tipo_alerta == tipo_alerta]
        
        if cliente_id:
            alertas = [a for a in alertas if a.cliente_id == cliente_id]
        
        return alertas
    
    def obtener_estadosenvio(self) -> Dict[str, Any]:
        """Obtiene estadísticas de enviós"""
        total_alertas = len(self.alertas_almacenadas)
        pendientes = len([a for a in self.alertas_almacenadas if a.estado == EstadoAlerta.PENDIENTE])
        enviadas = len([a for a in self.alertas_almacenadas if a.estado == EstadoAlerta.ENVIADA_UIF])
        confirmadas = len([a for a in self.alertas_almacenadas if a.estado == EstadoAlerta.CONFIRMADA])
        rechazadas = len([a for a in self.alertas_almacenadas if a.estado == EstadoAlerta.RECHAZADA])
        
        return {
            "total_alertas": total_alertas,
            "pendientes": pendientes,
            "enviadas_uif": enviadas,
            "confirmadas": confirmadas,
            "rechazadas": rechazadas,
            "porcentaje_confirmacion": (confirmadas / total_alertas * 100) if total_alertas > 0 else 0
        }


# ============================================================================
# FUNCIONES DE CONVENIENCIA
# ============================================================================

def crear_generador(entidad: str = "TarantulaHawk", uma: float = 113.14) -> GeneradorAlertasUIF:
    """Factory para crear generador"""
    return GeneradorAlertasUIF(entidad, uma)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    generador = crear_generador()
    
    # Crear alerta de prueba
    alerta = generador.crear_alerta(
        operacion_id="OP-2025-001",
        cliente_id="CLI-123",
        cliente_nombre="Juan Pérez García",
        fecha_operacion=datetime.now(),
        monto_mxn=400000,
        actividad_vulnerable="VI_joyeria_metales",
        tipo_alerta=TipoAviso.AVISO_MENSUAL,
        razon="Supera umbral de aviso",
        fundamento_legal="Art. 23 LFPIORPI - Umbral 3,210 UMAs",
        requiere_reporte_uif=True
    )
    
    print("\n=== ALERTA CREADA ===")
    print(json.dumps(alerta.to_dict(), indent=2, default=str))
    
    # Estadísticas
    print("\n=== ESTADÍSTICAS ===")
    print(json.dumps(generador.obtener_estadosenvio(), indent=2))
