#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rastreador_acumulado_6m.py

Módulo para rastreo de acumulación de operaciones en 6 meses por cliente.

Implementa Regla 2 del flujo LFPIORPI 2025:
- Art. 17 (párrafo final): Acumulación de actos u operaciones con cliente
- Art. 7 Reglamento: Período de 6 meses

Author: TarantulaHawk Compliance Team
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from enum import Enum

logger = logging.getLogger(__name__)

# ============================================================================
# ENUMERACIONES
# ============================================================================

class TipoMoneda(Enum):
    """Monedas soportadas"""
    MXN = "MXN"
    USD = "USD"
    EUR = "EUR"
    CNY = "CNY"


# ============================================================================
# ESTRUCTURAS DE DATOS
# ============================================================================

@dataclass
class OperacionRegistrada:
    """Registro de operación individual"""
    folio_interno: str
    cliente_id: str
    fecha_operacion: datetime
    hora_operacion: str
    actividad_vulnerable: str
    tipo_operacion: str
    monto: float
    moneda: TipoMoneda
    metodo_pago: str
    descripcion: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "folio_interno": self.folio_interno,
            "cliente_id": self.cliente_id,
            "fecha_operacion": self.fecha_operacion.isoformat(),
            "hora_operacion": self.hora_operacion,
            "actividad_vulnerable": self.actividad_vulnerable,
            "tipo_operacion": self.tipo_operacion,
            "monto": self.monto,
            "moneda": self.moneda.value,
            "metodo_pago": self.metodo_pago,
            "descripcion": self.descripcion
        }


@dataclass
class AccumulationReport:
    """Reporte de acumulación de cliente en período 6m"""
    cliente_id: str
    fecha_reporte: datetime
    periodo_desde: datetime
    periodo_hasta: datetime
    total_operaciones: int
    monto_acumulado_umas: float
    monto_acumulado_mxn: float
    operaciones: List[OperacionRegistrada] = field(default_factory=list)
    actividades_vulnerables_detectadas: List[str] = field(default_factory=list)
    montos_por_actividad: Dict[str, float] = field(default_factory=dict)
    montos_por_tipo_pago: Dict[str, float] = field(default_factory=dict)
    alerta_umbral_alcanzado: bool = False
    umbral_relevante: str = ""
    fundamento_legal: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "cliente_id": self.cliente_id,
            "fecha_reporte": self.fecha_reporte.isoformat(),
            "periodo": {
                "desde": self.periodo_desde.isoformat(),
                "hasta": self.periodo_hasta.isoformat(),
                "dias": (self.periodo_hasta - self.periodo_desde).days
            },
            "resumen": {
                "total_operaciones": self.total_operaciones,
                "monto_acumulado_umas": round(self.monto_acumulado_umas, 2),
                "monto_acumulado_mxn": round(self.monto_acumulado_mxn, 2)
            },
            "operaciones_detalle": [op.to_dict() for op in self.operaciones],
            "actividades_detectadas": self.actividades_vulnerables_detectadas,
            "montos_por_actividad": self.montos_por_actividad,
            "montos_por_tipo_pago": self.montos_por_tipo_pago,
            "alerta": {
                "umbral_alcanzado": self.alerta_umbral_alcanzado,
                "umbral_relevante": self.umbral_relevante,
                "fundamento_legal": self.fundamento_legal
            }
        }


# ============================================================================
# RASTREADOR PRICIPAL
# ============================================================================

class RastreadorAcumulado6M:
    """Rastreador de acumulación de operaciones en 6 meses"""
    
    def __init__(self, uma_mxn: float = 113.14):
        """
        Inicializa el rastreador
        
        Args:
            uma_mxn: Valor de UMA en MXN (2025: 113.14)
        """
        self.uma_mxn = uma_mxn
        self.periodo_dias = 180  # 6 meses ≈ 180 días
        
        # En producción, esto vendría de una BD
        self.operaciones_almacenadas: List[OperacionRegistrada] = []
    
    # ========================================================================
    # MÉTODOS DE ACUMULACIÓN Y SEGUIMIENTO
    # ========================================================================
    
    def obtener_acumulado_cliente(
        self,
        cliente_id: str,
        actividad_vulnerable: Optional[str] = None,
        fecha_cutoff: Optional[datetime] = None,
        operaciones_db: Optional[List[Dict[str, Any]]] = None
    ) -> AccumulationReport:
        """
        Obtiene acumulado de un cliente en los últimos 6 meses
        
        Args:
            cliente_id: ID del cliente
            actividad_vulnerable: Filtrar por actividad específica (opcional)
            fecha_cutoff: Fecha de referencia (hoy por defecto)
            operaciones_db: Operaciones desde BD (para test/integration)
        
        Returns:
            AccumulationReport con detalles del acumulado
        """
        if fecha_cutoff is None:
            fecha_cutoff = datetime.now()
        
        fecha_inicio = fecha_cutoff - timedelta(days=self.periodo_dias)
        
        # Obtener operaciones del cliente en período
        if operaciones_db:
            operaciones = self._parsear_operaciones_db(
                cliente_id, operaciones_db, fecha_inicio, fecha_cutoff
            )
        else:
            operaciones = self._obtener_operaciones_historicas(
                cliente_id, fecha_inicio, fecha_cutoff
            )
        
        # Filtrar por actividad si se especifica
        if actividad_vulnerable:
            operaciones = [
                op for op in operaciones
                if op.actividad_vulnerable == actividad_vulnerable
            ]
        
        # Calcular acumulados
        monto_acumulado_mxn = sum(op.monto for op in operaciones)
        monto_acumulado_umas = monto_acumulado_mxn / self.uma_mxn
        
        # Agrupar por actividad
        actividades = set(op.actividad_vulnerable for op in operaciones)
        montos_por_actividad = {
            act: sum(op.monto for op in operaciones if op.actividad_vulnerable == act)
            for act in actividades
        }
        
        # Agrupar por tipo de pago
        metodos_pago = set(op.metodo_pago for op in operaciones)
        montos_por_tipo_pago = {
            metodo: sum(op.monto for op in operaciones if op.metodo_pago == metodo)
            for metodo in metodos_pago
        }
        
        # Crear reporte
        report = AccumulationReport(
            cliente_id=cliente_id,
            fecha_reporte=fecha_cutoff,
            periodo_desde=fecha_inicio,
            periodo_hasta=fecha_cutoff,
            total_operaciones=len(operaciones),
            monto_acumulado_umas=monto_acumulado_umas,
            monto_acumulado_mxn=monto_acumulado_mxn,
            operaciones=operaciones,
            actividades_vulnerables_detectadas=sorted(list(actividades)),
            montos_por_actividad=montos_por_actividad,
            montos_por_tipo_pago=montos_por_tipo_pago
        )
        
        logger.info(
            f"Acumulado cliente {cliente_id}: {len(operaciones)} ops, "
            f"${monto_acumulado_mxn:,.0f} MXN ({monto_acumulado_umas:,.0f} UMAs)"
        )
        
        return report
    
    def verificar_proximidad_umbral(
        self,
        cliente_id: str,
        monto_nueva_operacion: float,
        actividad_vulnerable: str,
        umbrales_config: Dict[str, Dict[str, float]],
        operaciones_db: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Verifica si operación causa que acumulado supere umbral (Regla 2)
        
        Args:
            cliente_id: ID del cliente
            monto_nueva_operacion: Monto de la nueva operación en MXN
            actividad_vulnerable: Actividad de la operación
            umbrales_config: Configuración de umbrales por actividad
            operaciones_db: Operaciones históricas (opcional)
        
        Returns:
            (supera_umbral, detalles)
        """
        # Obtener acumulado actual
        report = self.obtener_acumulado_cliente(
            cliente_id,
            actividad_vulnerable=actividad_vulnerable,
            operaciones_db=operaciones_db
        )
        
        # Acumulado con nueva operación
        monto_nuevo_acumulado = report.monto_acumulado_mxn + monto_nueva_operacion
        monto_nuevo_acumulado_umas = monto_nuevo_acumulado / self.uma_mxn
        
        # Obtener umbral para la actividad
        umbral_aviso_umas = self._obtener_umbral_aviso(actividad_vulnerable, umbrales_config)
        umbral_aviso_mxn = umbral_aviso_umas * self.uma_mxn
        
        supera = monto_nuevo_acumulado >= umbral_aviso_mxn
        
        detalles = {
            "cliente_id": cliente_id,
            "actividad_vulnerable": actividad_vulnerable,
            "acumulado_actual": report.monto_acumulado_mxn,
            "acumulado_actual_umas": report.monto_acumulado_umas,
            "monto_nueva_operacion": monto_nueva_operacion,
            "acumulado_con_nueva_op": monto_nuevo_acumulado,
            "acumulado_con_nueva_op_umas": monto_nuevo_acumulado_umas,
            "umbral_aviso": umbral_aviso_mxn,
            "umbral_aviso_umas": umbral_aviso_umas,
            "supera_umbral": supera,
            "operaciones_en_periodo": len(report.operaciones),
            "periodos_incluidos": f"{report.periodo_desde.date()} a {report.periodo_hasta.date()}",
            "regla_aplicable": (
                f"Art. 17 LFPIORPI (párrafo final) + Art. 7 Reglamento: "
                f"Acumulación de actos u operaciones en 6 meses"
            )
        }
        
        if supera:
            logger.warning(
                f"⚠️ ACUMULADO SUPERA UMBRAL - Cliente {cliente_id}: "
                f"${monto_nuevo_acumulado:,.0f} MXN >= ${umbral_aviso_mxn:,.0f} MXN"
            )
        else:
            logger.info(
                f"✅ Acumulado OK - Cliente {cliente_id}: "
                f"${monto_nuevo_acumulado:,.0f} MXN < ${umbral_aviso_mxn:,.0f} MXN "
                f"(proximidad: {(monto_nuevo_acumulado / umbral_aviso_mxn * 100):.1f}%)"
            )
        
        return supera, detalles
    
    def análisis_patrones_operacion(
        self,
        cliente_id: str,
        operaciones_db: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Analiza patrones de operación del cliente (estructuración, etc.)
        
        Returns:
            {conteo, promedio, desviacion_std, frecuencia_media, alertas}
        """
        report = self.obtener_acumulado_cliente(cliente_id, operaciones_db=operaciones_db)
        operaciones = report.operaciones
        
        if not operaciones:
            return {
                "cliente_id": cliente_id,
                "resultado": "sin_operaciones",
                "alertas": []
            }
        
        # Estadísticas básicas
        montos = [op.monto for op in operaciones]
        total_ops = len(operaciones)
        monto_promedio = sum(montos) / total_ops if total_ops > 0 else 0
        
        # Desviación estándar
        varianza = sum((m - monto_promedio) ** 2 for m in montos) / total_ops if total_ops > 0 else 0
        desviacion_std = varianza ** 0.5
        
        # Frecuencia media (ops por mes)
        dias_periodo = (report.periodo_hasta - report.periodo_desde).days
        meses_aprox = dias_periodo / 30
        frecuencia_mensual = total_ops / meses_aprox if meses_aprox > 0 else 0
        
        # Detectar alertas de patrones
        alertas = []
        
        # ALERTA: Muchas operaciones pequeñas (posible estructuración)
        operaciones_pequenas = [m for m in montos if m < monto_promedio * 0.5]
        if len(operaciones_pequenas) >= 3:
            alertas.append({
                "tipo": "fragmentacion_posible",
                "descripcion": f"{len(operaciones_pequenas)} operaciones bajo promedio (fragmentación posible)",
                "severidad": "media"
            })
        
        # ALERTA: Variabilidad muy baja (montos sospechosamente similares)
        operaciones_similares = [m for m in montos if abs(m - monto_promedio) < desviacion_std * 0.1]
        if len(operaciones_similares) >= 3 and desviacion_std < monto_promedio * 0.1:
            alertas.append({
                "tipo": "montos_sospechosamente_iguales",
                "descripcion": f"Montos muy similares detectados ({len(operaciones_similares)} ops)",
                "severidad": "media"
            })
        
        # ALERTA: Aumento súbito de frecuencia
        if frecuencia_mensual > 5:  # Más de 5 ops/mes
            alertas.append({
                "tipo": "frecuencia_alta",
                "descripcion": f"Frecuencia elevada: {frecuencia_mensual:.1f} operaciones/mes",
                "severidad": "baja"
            })
        
        return {
            "cliente_id": cliente_id,
            "estadisticas": {
                "total_operaciones": total_ops,
                "monto_total": sum(montos),
                "monto_promedio": round(monto_promedio, 2),
                "monto_minimo": min(montos),
                "monto_maximo": max(montos),
                "desviacion_estandar": round(desviacion_std, 2),
                "coeficiente_variacion": round(desviacion_std / monto_promedio, 3) if monto_promedio > 0 else 0
            },
            "frecuencia": {
                "operaciones_por_mes": round(frecuencia_mensual, 2),
                "dias_en_periodo": dias_periodo,
                "dia_promedio_entre_ops": round(dias_periodo / total_ops, 1) if total_ops > 0 else 0
            },
            "patrones": {
                "operaciones_bajo_promedio": len(operaciones_pequenas),
                "operaciones_sobre_promedio": len([m for m in montos if m > monto_promedio * 1.5]),
                "operaciones_muy_similares": len(operaciones_similares)
            },
            "alertas": alertas
        }
    
    # ========================================================================
    # MÉTODOS INTERNOS DE OBTENCIÓN DE DATOS
    # ========================================================================
    
    def _obtener_operaciones_historicas(
        self,
        cliente_id: str,
        fecha_desde: datetime,
        fecha_hasta: datetime
    ) -> List[OperacionRegistrada]:
        """
        Obtiene operaciones históricas del cliente desde BD
        
        En producción, esto consultaría una BD real
        """
        # Placeholder: en producción, query a DB
        # SELECT * FROM operaciones WHERE cliente_id = ? AND fecha BETWEEN ? AND ?
        return []
    
    def _parsear_operaciones_db(
        self,
        cliente_id: str,
        operaciones_db: List[Dict[str, Any]],
        fecha_desde: datetime,
        fecha_hasta: datetime
    ) -> List[OperacionRegistrada]:
        """Parsea operaciones desde BD (dict) a objetos"""
        resultado = []
        
        for op_dict in operaciones_db:
            # Filtrar por cliente y fecha
            if op_dict.get("cliente_id") != cliente_id:
                continue
            
            fecha_op_str = op_dict.get("fecha_operacion")
            if isinstance(fecha_op_str, str):
                fecha_op = datetime.fromisoformat(fecha_op_str)
            else:
                fecha_op = fecha_op_str
            
            if not (fecha_desde <= fecha_op <= fecha_hasta):
                continue
            
            # Parsear
            try:
                moneda_str = op_dict.get("moneda", "MXN")
                moneda = TipoMoneda(moneda_str) if moneda_str in [m.value for m in TipoMoneda] else TipoMoneda.MXN
                
                op = OperacionRegistrada(
                    folio_interno=op_dict.get("folio_interno", ""),
                    cliente_id=cliente_id,
                    fecha_operacion=fecha_op,
                    hora_operacion=op_dict.get("hora_operacion", "00:00:00"),
                    actividad_vulnerable=op_dict.get("actividad_vulnerable", ""),
                    tipo_operacion=op_dict.get("tipo_operacion", ""),
                    monto=float(op_dict.get("monto", 0)),
                    moneda=moneda,
                    metodo_pago=op_dict.get("metodo_pago", ""),
                    descripcion=op_dict.get("descripcion", "")
                )
                resultado.append(op)
            except Exception as e:
                logger.warning(f"Error parseando operación: {e}")
                continue
        
        return resultado
    
    def _obtener_umbral_aviso(
        self,
        actividad: str,
        umbrales_config: Dict[str, Dict[str, float]]
    ) -> float:
        """Obtiene umbral de aviso en UMAs para una actividad"""
        if actividad in umbrales_config:
            return float(umbrales_config[actividad].get("aviso_UMA", 645))
        
        # Fallback
        return 645  # UMA general por defecto


# ============================================================================
# FUNCIONES DE CONVENIENCIA
# ============================================================================

def crear_rastreador(uma_mxn: float = 113.14) -> RastreadorAcumulado6M:
    """Factory para crear rastreador"""
    return RastreadorAcumulado6M(uma_mxn)


if __name__ == "__main__":
    # Testing
    import json
    
    logging.basicConfig(level=logging.INFO)
    
    rastreador = crear_rastreador(uma_mxn=113.14)
    
    # Operaciones de prueba
    ops_test = [
        {
            "folio_interno": "OP-2025-001",
            "cliente_id": "CLI-123",
            "fecha_operacion": (datetime.now() - timedelta(days=50)).isoformat(),
            "hora_operacion": "10:30:00",
            "actividad_vulnerable": "VI_joyeria_metales",
            "tipo_operacion": "venta",
            "monto": 100000,
            "moneda": "MXN",
            "metodo_pago": "transferencia"
        },
        {
            "folio_interno": "OP-2025-002",
            "cliente_id": "CLI-123",
            "fecha_operacion": (datetime.now() - timedelta(days=30)).isoformat(),
            "hora_operacion": "14:15:00",
            "actividad_vulnerable": "VI_joyeria_metales",
            "tipo_operacion": "venta",
            "monto": 150000,
            "moneda": "MXN",
            "metodo_pago": "efectivo"
        }
    ]
    
    # Reportes
    report = rastreador.obtener_acumulado_cliente(
        "CLI-123",
        operaciones_db=ops_test
    )
    
    print("\n=== REPORTE ACUMULADO 6M ===")
    print(json.dumps(report.to_dict(), indent=2, default=str))
    
    # Análisis de patrones
    patrones = rastreador.análisis_patrones_operacion("CLI-123", ops_test)
    print("\n=== ANÁLISIS DE PATRONES ===")
    print(json.dumps(patrones, indent=2, default=str))
