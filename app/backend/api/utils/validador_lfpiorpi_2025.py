#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validador_lfpiorpi_2025.py

Módulo de validación LFPIORPI 2025 con todas las reglas según Reforma jul-2025:
- Regla 1: Umbral de Aviso (Art. 23)
- Regla 2: Acumulación 6 meses (Art. 17 + Art. 7 Reg.)
- Regla 3: Listas Negras (Art. 24) - BLOQUEO
- Regla 4: Efectivo Prohibido (Art. 32)
- Regla 5: Indicios Procedencia Ilícita (Art. 24)
- EBR: Cálculo integral de riesgo del cliente

Author: TarantulaHawk Compliance Team
"""

from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# ESTRUCTURAS DE DATOS
# ============================================================================

@dataclass
class ValidacionOperacion:
    """Resultado de validación de operación"""
    operacion_id: str
    cliente_id: str
    monto_mxn: float
    monto_umas: float
    fecha_operacion: datetime
    actividad_vulnerable: str
    
    # Resultados validación
    es_valida: bool
    debe_bloquearse: bool
    requiere_aviso_uif: bool
    requiere_aviso_24hrs: bool
    
    # Detalles
    alertas: List[str]
    fundamentos_legales: List[str]
    score_ebr: float
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ValidadorLFPIORPI2025:
    """Validador de operaciones según LFPIORPI 2025"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.lfpiorpi = config.get("lfpiorpi", {})
        self.umbrales = self.lfpiorpi.get("umbrales", {})
        self.uma_mxn = float(self.lfpiorpi.get("uma_mxn", 113.14))
        
    # ========================================================================
    # REGLA 1: UMBRAL DE AVISO (Art. 23 LFPIORPI)
    # ========================================================================
    # EXPLICABILIDAD: Este método implementa Art. 23 LFPIORPI que requiere
    # generar "Aviso Mensual" cuando una operación supera el umbral establecido.
    #
    # DECISIÓN: LA OPERACIÓN SE PERMITE REALIZAR
    # ACCIÓN: Generar aviso mensual para reportar antes del día 17 del mes siguiente
    # CONDICIÓN: monto >= umbral_aviso O acumulado_6m >= umbral_aviso
    #
    # Ejemplos:
    # - Joyería $400,000 MXN > umbral $363,179 → PERMITIR + Aviso Mensual
    # - Transferencia bancaria (método de pago permitido)
    # ========================================================================
    
    def verificar_umbral_aviso(
        self,
        monto_mxn: float,
        actividad_vulnerable: str,
        monto_acumulado_6m: float = 0
    ) -> Tuple[bool, str, str]:
        """
        REGLA 1: Umbral de Aviso (Art. 23 LFPIORPI)
        
        Valida si operación supera umbral de aviso (individual o acumulado 6 meses).
        
        DECISIÓN LEGAL: La operación SE PERMITE realizar si el medio de pago
        está autorizado (no efectivo prohibido), pero REQUIERE generar Aviso Mensual
        para reportar a la UIF antes del día 17 del mes siguiente.
        
        Returns:
            (supera_umbral, mensaje_alerta, fundamento_legal)
            
        Explicabilidad:
            Si retorna (True, msg, fund): Operación permitida + Aviso Mensual requerido
            Si retorna (False, "", ""): No supera umbral, no requiere aviso
        """
        if not self._es_actividad_vulnerable(actividad_vulnerable):
            return False, "", ""
        
        umbrales = self.umbrales.get(actividad_vulnerable, {})
        umbral_aviso_umas = float(umbrales.get("aviso_UMA", 645))
        umbral_aviso_mxn = umbral_aviso_umas * self.uma_mxn
        
        monto_umas = monto_mxn / self.uma_mxn
        
        # Verificar monto individual
        if monto_umas >= umbral_aviso_umas:
            mensaje = (
                f"⚠️ Operación supera umbral de aviso: "
                f"{monto_umas:,.0f} UMAs >= {umbral_aviso_umas:,.0f} UMAs "
                f"(${umbral_aviso_mxn:,.0f} MXN)"
            )
            fundamento = (
                f"Art. 23 LFPIORPI: {umbrales.get('descripcion', actividad_vulnerable)}. "
                f"Obligación: Presentar aviso a la UIF antes del día 17 del mes siguiente."
            )
            return True, mensaje, fundamento
        
        # Verificar acumulado 6 meses
        acumulado_umas = monto_umas + (monto_acumulado_6m / self.uma_mxn)
        if acumulado_umas >= umbral_aviso_umas:
            mensaje = (
                f"⚠️ Acumulado 6 meses supera umbral de aviso: "
                f"{acumulado_umas:,.0f} UMAs >= {umbral_aviso_umas:,.0f} UMAs"
            )
            fundamento = (
                f"Art. 17 LFPIORPI (párrafo final) + Art. 7 Reglamento: "
                f"Acumulación de operaciones con cliente en 6 meses. "
                f"Obligación: Presentar aviso a la UIF."
            )
            return True, mensaje, fundamento
        
        return False, "", ""
    
    # ========================================================================
    # REGLA 2: ACUMULACIÓN 6 MESES (Art. 17 + Art. 7 Reg.)
    # ========================================================================
    
    def calcular_acumulado_6_meses(
        self,
        cliente_id: str,
        operaciones_historicas: List[Dict[str, Any]],
        monto_operacion_nueva: float
    ) -> Tuple[float, List[str]]:
        """
        Calcula acumulado de operaciones en últimos 6 meses
        
        Returns:
            (monto_acumulado_mxn, operaciones_consideradas)
        """
        fecha_cutoff = datetime.now() - timedelta(days=180)
        monto_acumulado = 0
        operaciones_validas = []
        
        for op in operaciones_historicas:
            fecha_op = op.get("fecha_operacion")
            if isinstance(fecha_op, str):
                fecha_op = datetime.fromisoformat(fecha_op)
            
            if fecha_op >= fecha_cutoff:
                monto_acumulado += float(op.get("monto", 0))
                operaciones_validas.append(op.get("folio_interno", ""))
        
        # Agregar operación nueva
        monto_acumulado += monto_operacion_nueva
        
        logger.info(
            f"Cliente {cliente_id}: Acumulado 6m = ${monto_acumulado:,.0f} MXN "
            f"({len(operaciones_validas)} operaciones históricas)"
        )
        
        return monto_acumulado, operaciones_validas
    
    # ========================================================================
    # REGLA 2.1: LISTAS NEGRAS (Art. 24 LFPIORPI) - CASO ESPECIAL
    # ========================================================================
    # EXPLICABILIDAD: Este método implementa un caso especial del Art. 24
    # cuando el cliente aparece en listas negras oficiales (UIF, OFAC, CSNU, 69B).
    #
    # DECISIÓN: LA OPERACIÓN DEBE BLOQUEARSE INMEDIATAMENTE
    # ACCIÓN: Rechazar operación + Generar aviso 24 horas a la UIF
    # CONDICIÓN: Cliente en cualquier lista negra oficial
    #
    # Listas verificadas:
    # - UIF (SAT): Personas bloqueadas México
    # - OFAC: Office of Foreign Assets Control (USA)
    # - CSNU: Consejo de Seguridad Naciones Unidas
    # - Lista 69B: Empresas fantasma SAT (Reforma jul-2025)
    # - PEP: Personas Expuestas Políticamente
    #
    # DIFERENCIA CON INDICIOS ILÍCITOS:
    # - Listas negras: Evidencia concreta → BLOQUEO + Aviso 24h
    # - Indicios ilícitos: Señales sospechosas → PERMITIR + Aviso 24h
    # ========================================================================
    
    def verificar_listas_negras(self, cliente_datos: Dict[str, Any]) -> Tuple[bool, str, str]:
        """
        REGLA 2.1: Listas Negras (Art. 24 LFPIORPI) - Caso Especial
        
        Verifica si cliente está en listas negras oficiales.
        
        DECISIÓN LEGAL: Si el cliente aparece en UIF, OFAC, CSNU, Lista 69B
        o es PEP, la operación DEBE BLOQUEARSE inmediatamente y generar
        Aviso 24 Horas a la UIF.
        
        DIFERENCIA: A diferencia de otros indicios del Art. 24, las listas
        negras son evidencia concreta de alto riesgo que requiere BLOQUEO,
        no solo aviso.
        
        Returns:
            (esta_en_listas, mensaje_bloqueo, fundamento_legal)
            
        Explicabilidad:
            Si retorna (True, msg, fund): BLOQUEAR operación + Aviso 24h
            Si retorna (False, "", ""): Cliente no está en listas negras
        """
        listas_a_verificar = [
            ("en_lista_uif", "UIF (SAT)"),
            ("en_lista_ofac", "OFAC (USA)"),
            ("en_lista_csnu", "CSNU (ONU)"),
            ("en_lista_69b", "Lista 69B (Reforma jul-2025)"),
            ("es_pep", "PEP (Persona Expuesta Políticamente)")
        ]
        
        listas_activadas = []
        
        for campo_lista, nombre_lista in listas_a_verificar:
            if cliente_datos.get(campo_lista, False):
                listas_activadas.append(nombre_lista)
        
        if listas_activadas:
            mensaje = (
                f"⛔ OPERACIÓN BLOQUEADA: Cliente encontrado en listas negras: "
                f"{', '.join(listas_activadas)}"
            )
            fundamento = (
                f"Art. 24 LFPIORPI (Reforma jul-2025): "
                f"Cuando cliente aparece en listas UIF, OFAC, CSNU o 69B. "
                f"Acción: BLOQUEAR operación + Aviso 24 horas a la UIF. "
                f"NO permitir realizar la operación."
            )
            return True, mensaje, fundamento
        
        return False, "", ""
    
    # ========================================================================
    # REGLA 3: PROHIBICIÓN EFECTIVO (Art. 32 LFPIORPI)
    # ========================================================================
    # EXPLICABILIDAD: Este método implementa Art. 32 LFPIORPI que PROHIBE
    # recibir pagos en efectivo por encima de ciertos montos en actividades específicas.
    #
    # DECISIÓN: LA OPERACIÓN DEBE BLOQUEARSE INMEDIATAMENTE
    # ACCIÓN: Rechazar operación, NO generar aviso (no se realiza)
    # CONDICIÓN: metodo_pago == "efectivo" Y monto >= limite_efectivo
    #
    # Ejemplos:
    # - Joyería $400,000 en EFECTIVO > límite $363,179 → BLOQUEAR (prohibido)
    # - Joyería $400,000 en TRANSFERENCIA → PERMITIR + Aviso Mensual (Art. 23)
    #
    # DIFERENCIA CON ART. 23:
    # - Art. 23: Operación permitida, reportar después
    # - Art. 32: Operación PROHIBIDA, no debe realizarse
    # ========================================================================
    
    def verificar_limite_efectivo(
        self,
        metodo_pago: str,
        monto_mxn: float,
        actividad_vulnerable: str
    ) -> Tuple[bool, str, str]:
        """
        REGLA 3: Prohibición de Efectivo (Art. 32 LFPIORPI)
        
        Verifica si el pago en efectivo está PROHIBIDO por ley.
        
        DECISIÓN LEGAL: Si el monto en efectivo supera el límite establecido,
        la operación NO DEBE REALIZARSE bajo ninguna circunstancia. Esta es
        una PROHIBICIÓN absoluta, no un requisito de aviso.
        
        Returns:
            (supera_limite, mensaje_bloqueo, fundamento_legal)
            
        Explicabilidad:
            Si retorna (True, msg, fund): BLOQUEAR operación inmediatamente
            Si retorna (False, "", ""): Efectivo permitido o no aplica
        """
        if metodo_pago.lower() != "efectivo":
            return False, "", ""
        
        if not self._es_actividad_vulnerable(actividad_vulnerable):
            return False, "", ""
        
        umbrales = self.umbrales.get(actividad_vulnerable, {})
        limite_efectivo_umas = float(umbrales.get("efectivo_max_UMA", 0))
        
        # Si no hay límite específico, usar el umbral de aviso
        if limite_efectivo_umas <= 0 or limite_efectivo_umas > 999999:
            return False, "", ""
        
        limite_efectivo_mxn = limite_efectivo_umas * self.uma_mxn
        monto_umas = monto_mxn / self.uma_mxn
        
        if monto_mxn >= limite_efectivo_mxn:
            mensaje = (
                f"⛔ OPERACIÓN BLOQUEADA - EFECTIVO PROHIBIDO: "
                f"Monto ${monto_mxn:,.0f} MXN ({monto_umas:,.0f} UMAs) "
                f"supera límite permitido de ${limite_efectivo_mxn:,.0f} MXN "
                f"({limite_efectivo_umas:,.0f} UMAs)"
            )
            fundamento = (
                f"Art. 32 LFPIORPI: Las personas sujetas a esta Ley tienen prohibición "
                f"de recibir pagos en efectivo en operaciones de compra/arrendamiento "
                f"de inmuebles, venta vehículos, joyería, metales preciosos y otras "
                f"actividades cuando el monto supera {limite_efectivo_umas:,.0f} UMAs. "
                f"Acción: BLOQUEAR operación inmediatamente."
            )
            return True, mensaje, fundamento
        
        return False, "", ""
    
    # ========================================================================
    # REGLA 2: INDICIOS DE PROCEDENCIA ILÍCITA (Art. 24 LFPIORPI)
    # ========================================================================
    # EXPLICABILIDAD: Este método implementa Art. 24 LFPIORPI que requiere
    # generar "Aviso 24 Horas" cuando existen indicios de procedencia ilícita.
    #
    # DECISIÓN: LA OPERACIÓN PUEDE PERMITIRSE (criterio del sujeto obligado)
    # ACCIÓN: Generar aviso 24 horas para reportar dentro de 24h a la UIF
    # CONDICIÓN: 2+ señales sospechosas detectadas, INDEPENDIENTE del monto
    #
    # Señales automáticas:
    # 1. Estructuración (fragmentación en 7 días)
    # 2. Origen recursos no documentado
    # 3. Monto inconsistente con perfil (5x superior)
    # 4. Acumulación acelerada (10x umbral)
    # 5. Montos muy similares (posible lavado)
    #
    # Ejemplos:
    # - $50,000 MXN con origen no documentado + 2 ops similares en 7 días
    #   → PERMITIR + Aviso 24h (indicios detectados)
    #
    # DIFERENCIA CON ART. 23:
    # - Art. 23: Por monto (umbral), plazo día 17
    # - Art. 24: Por indicios (patrones), plazo 24 horas
    # ========================================================================
    
    def verificar_indicios_ilicitos(
        self,
        cliente_id: str,
        cliente_datos: Dict[str, Any],
        monto_mxn: float,
        operaciones_recientes: List[Dict[str, Any]],
        monto_acumulado_6m: float
    ) -> Tuple[bool, List[str], str]:
        """
        REGLA 2: Indicios de Procedencia Ilícita (Art. 24 LFPIORPI)
        
        Detecta patrones sospechosos que indican posible procedencia ilícita.
        
        DECISIÓN LEGAL: La operación PUEDE PERMITIRSE según criterio del
        sujeto obligado, pero REQUIERE generar Aviso 24 Horas a la UIF.
        
        IMPORTANTE: Esta validación es INDEPENDIENTE del monto de la operación.
        Incluso operaciones pequeñas pueden requerir aviso 24h si presentan
        patrones sospechosos.
        
        Returns:
            (tiene_indicios, señales_detectadas, fundamento_legal)
            
        Explicabilidad:
            Si retorna (True, señales, fund): Operación permitida + Aviso 24h requerido
            Si retorna (False, [], ""): No hay indicios suficientes (< 2 señales)
        """
        senales = []
        
        # SENAL 1: Múltiples operaciones cercanas al umbral (estructuración)
        operaciones_7dias = [
            op for op in operaciones_recientes
            if (datetime.now() - datetime.fromisoformat(op.get("fecha_operacion", ""))) < timedelta(days=7)
        ]
        
        if len(operaciones_7dias) >= 2:
            montos_cercanos = sum(
                1 for op in operaciones_7dias
                if 0.8 * monto_mxn <= op.get("monto", 0) <= 1.2 * monto_mxn
            )
            if montos_cercanos >= 2:
                senales.append(
                    "🔴 2+ operaciones similares en 7 días (posible estructuración/fragmentación)"
                )
        
        # SENAL 2: Origen de recursos no documentado
        if not cliente_datos.get("origen_recursos_documentado", False):
            senales.append("🔴 Origen de recursos no documentado o no justificado")
        
        # SENAL 3: Desviación extrema del perfil (3σ+)
        perfil_cliente = cliente_datos.get("perfil_estadistico", {})
        monto_promedio = perfil_cliente.get("monto_promedio", monto_mxn)
        desviacion_std = perfil_cliente.get("desviacion_estandar", monto_mxn / 2)
        
        if desviacion_std > 0:
            desviacion_z = abs(monto_mxn - monto_promedio) / desviacion_std
            if desviacion_z >= 3.0:
                senales.append(
                    f"🔴 Desviación extrema del perfil: {desviacion_z:.1f}σ "
                    f"(promedio: ${monto_promedio:,.0f}, operación: ${monto_mxn:,.0f})"
                )
        
        # SENAL 4: Cliente en lista sospechosa (reportes SAT, etc.)
        if cliente_datos.get("en_lista_sospechosa_sat", False):
            senales.append("🔴 Cliente en lista sospechosa del SAT")
        
        # SENAL 5: Actividad inconsistente con perfil
        actividad_actual = cliente_datos.get("actividad_actual")
        actividad_registrada = cliente_datos.get("actividad_registrada")
        
        if actividad_actual and actividad_registrada and actividad_actual != actividad_registrada:
            senales.append(
                f"🔴 Actividad inconsistente: registrada '{actividad_registrada}' "
                f"vs. actual '{actividad_actual}'"
            )
        
        tiene_indicios = len(senales) >= 2  # Al menos 2 señales para activar alerta
        
        if tiene_indicios:
            fundamento = (
                f"Art. 24 LFPIORPI: Cuando el sujeto obligado tenga indicios de que los "
                f"recursos provienen de fuente ilícita. Acción: Presentar aviso dentro de "
                f"24 horas a la UIF. Señales detectadas: {len(senales)}"
            )
        else:
            fundamento = ""
        
        return tiene_indicios, senales, fundamento
    
    # ========================================================================
    # CÁLCULO EBR (ENFOQUE BASADO EN RIESGO)
    # ========================================================================
    
    def calcular_ebr_cliente(self, cliente_datos: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calcula Score EBR integral del cliente con enfoque jerárquico
        
        IMPORTANTE: Los valores de score son criterios de NEGOCIO, NO requisitos legales.
        Documentación completa en: EBR_JUSTIFICACION_NEGOCIO.md
        
        Factores:
        - Factor 1: Sanciones/Listas (30 puntos) - Enfoque jerárquico con max()
        - Factor 2: Actividad Económica (25 puntos)
        - Factor 3: Tipo de Persona (10 puntos)
        - Factor 4: Origen Recursos (15 puntos)
        - Factor 5: Ubicación Geográfica (10 puntos)
        - Factor 6: Monto Mensual (10 puntos)
        
        Returns: {score, nivel_riesgo, desglose_factores, razones_explicabilidad}
        """
        score = 0
        desglose = {}
        razones = []  # Para explicabilidad y auditoría
        
        # ====== COMPATIBILIDAD RETROACTIVA ======
        # Migrar campos viejos a nuevos si existen
        if "en_lista_uif" in cliente_datos and "en_lista_uif_oficial_sat" not in cliente_datos:
            cliente_datos["en_lista_uif_oficial_sat"] = cliente_datos["en_lista_uif"]
            # Agregar advertencia sobre falta de metadata
            if cliente_datos["en_lista_uif"] and not cliente_datos.get("en_lista_uif_metadata"):
                cliente_datos["en_lista_uif_metadata"] = {
                    "fuente": "LEGACY - Sin fuente especificada",
                    "fecha_consulta": "sin_fecha",
                    "requiere_actualizacion": True
                }
        
        if "en_lista_69b" in cliente_datos and "en_lista_69b_sat" not in cliente_datos:
            cliente_datos["en_lista_69b_sat"] = cliente_datos["en_lista_69b"]
            if cliente_datos["en_lista_69b"] and not cliente_datos.get("en_lista_69b_metadata"):
                cliente_datos["en_lista_69b_metadata"] = {
                    "fuente": "LEGACY - Sin fuente especificada",
                    "numero_publicacion": "sin_publicacion",
                    "requiere_actualizacion": True
                }
        
        # Factor 1: Sanciones y Listas (30 puntos) - ENFOQUE JERÁRQUICO
        # Usamos max() para evitar doble conteo (misma persona puede estar en OFAC+CSNU+UIF)
        factor_1 = 0
        factor_1_razones = []
        
        # Categoría A: Sanciones críticas internacionales (30 puntos)
        # Justificación: Bloqueo internacional, obligación legal de rechazo
        if any([
            cliente_datos.get("en_lista_ofac", False),
            cliente_datos.get("en_lista_csnu", False),
            cliente_datos.get("en_lista_uif_oficial_sat", False)  # Debe venir del portal SAT/UIF oficial
        ]):
            factor_1 = max(factor_1, 30)
            if cliente_datos.get("en_lista_ofac", False):
                factor_1_razones.append("OFAC (sanción internacional)")
            if cliente_datos.get("en_lista_csnu", False):
                factor_1_razones.append("CSNU (sanción ONU)")
            if cliente_datos.get("en_lista_uif_oficial_sat", False):
                # Verificar metadata para auditoría
                metadata_uif = cliente_datos.get("en_lista_uif_metadata", {})
                fuente = metadata_uif.get("fuente", "sin_fuente")
                fecha = metadata_uif.get("fecha_consulta", "sin_fecha")
                factor_1_razones.append(f"UIF oficial SAT (fuente: {fuente}, fecha: {fecha})")
        
        # Categoría B: Riesgo fiscal/EFOS - Lista 69-B (25 puntos)
        # Justificación: Es riesgo FISCAL (facturas falsas), NO es indicador automático PLD/AML
        # Menor peso que sanciones porque no implica lavado de dinero per se
        if cliente_datos.get("en_lista_69b_sat", False):
            factor_1 = max(factor_1, 25)
            metadata_69b = cliente_datos.get("en_lista_69b_metadata", {})
            fecha_pub = metadata_69b.get("numero_publicacion", "sin_publicacion")
            factor_1_razones.append(f"Lista 69-B SAT - EFOS (riesgo fiscal, pub: {fecha_pub})")
        
        # Categoría C: PEP - Persona Expuesta Políticamente (20 puntos)
        # Justificación: Mayor escrutinio regulatorio, pero no es sanción
        if cliente_datos.get("es_pep", False):
            factor_1 = max(factor_1, 20)
            factor_1_razones.append("PEP (Persona Expuesta Políticamente)")
        
        score += factor_1
        desglose["factor_1_listas_sanciones"] = factor_1
        if factor_1_razones:
            razones.append(f"Factor 1 ({factor_1} pts): {', '.join(factor_1_razones)}")
        
        # Factor 2: Actividad Económica (25 puntos)
        # Justificación: Actividades designadas y vulnerables según Artículo 17 LFPIORPI
        riesgo_actividad = {
            "joyeria_metales": 20,      # Art 17 fracc. IV - metales preciosos
            "casinos_juegos": 25,        # Art 17 fracc. III - juegos con apuesta
            "criptomonedas": 25,         # Art 17 fracc. XIII - activos virtuales
            "inmobiliario": 18,          # Art 17 fracc. V - inmuebles
            "vehiculos": 20,             # Art 17 fracc. VI - vehículos aéreos/marítimos
            "arte_antiguedades": 18,     # Art 17 fracc. VII - arte y antigüedades
            "prestamos": 22,             # Art 17 fracc. XII - servicios financieros
            "comercio_exterior": 15,     # Art 17 fracc. VIII - comercio exterior
            "blindaje": 15,              # Art 17 fracc. X - blindaje
            "default": 5
        }
        sector = cliente_datos.get("sector_actividad", "default")
        factor_2 = riesgo_actividad.get(sector, 5)
        score += factor_2
        desglose["factor_2_actividad_economica"] = factor_2
        if sector != "default" and factor_2 > 10:
            razones.append(f"Factor 2 ({factor_2} pts): Actividad vulnerable - {sector}")
        
        # Factor 3: Tipo de Persona (10 puntos)
        # Justificación: Personas morales sin beneficiario controlador identificado = riesgo opacidad
        factor_3 = 0
        if cliente_datos.get("tipo_persona") == "moral":
            factor_3 += 8
            if not cliente_datos.get("beneficiario_controlador_identificado", False):
                factor_3 += 7  # Total 15 pero se capea en desglose
                razones.append("Factor 3 (15 pts): Persona moral SIN beneficiario controlador identificado")
            else:
                razones.append("Factor 3 (8 pts): Persona moral con beneficiario controlador")
        else:
            factor_3 += 3
        
        score += factor_3
        desglose["factor_3_tipo_persona"] = factor_3
        
        # Factor 4: Origen Recursos (15 puntos)
        # Justificación: Origen no documentado o efectivo dificulta trazabilidad
        riesgo_origen = {
            "efectivo_negocio": 15,      # Alto riesgo: difícil rastreo
            "herencia": 8,               # Medio: requiere validación documental
            "prestamo_tercero": 12,      # Medio-alto: verificar contraparte
            "actividad_profesional": 5,  # Bajo: documentable con declaraciones
            "salario": 3,                # Bajo: comprobable con nómina
            "desconocido": 20            # Crítico: sin sustento
        }
        origen = cliente_datos.get("origen_recursos", "desconocido")
        factor_4 = riesgo_origen.get(origen, 10)
        score += factor_4
        desglose["factor_4_origen_recursos"] = factor_4
        if factor_4 >= 12:
            razones.append(f"Factor 4 ({factor_4} pts): Origen recursos - {origen}")
        
        # Factor 5: Ubicación Geográfica (10 puntos)
        # Justificación: Estados con mayor incidencia de actividades ilícitas según reportes PGR/SNSP
        estados_alto_riesgo = ["Sinaloa", "Michoacán", "Guerrero", "Tamaulipas", "Jalisco"]
        estado = cliente_datos.get("estado", "")
        factor_5 = 10 if estado in estados_alto_riesgo else 2
        score += factor_5
        desglose["factor_5_ubicacion"] = factor_5
        if factor_5 == 10:
            razones.append(f"Factor 5 ({factor_5} pts): Ubicación alto riesgo - {estado}")
        
        # Factor 6: Monto Mensual Estimado (10 puntos)
        # Justificación: Montos elevados incrementan impacto potencial de riesgo
        monto_mensual = float(cliente_datos.get("monto_mensual_estimado", 0))
        factor_6 = 0
        if monto_mensual >= 500000:
            factor_6 = 10
            razones.append(f"Factor 6 ({factor_6} pts): Monto mensual alto ≥$500K MXN")
        elif monto_mensual >= 200000:
            factor_6 = 7
        elif monto_mensual >= 100000:
            factor_6 = 5
        else:
            factor_6 = 2
        
        score += factor_6
        desglose["factor_6_monto_mensual"] = factor_6
        
        # Clasificación y Cap
        score = min(score, 100)
        
        # Clasificación de riesgo con criterios operativos
        # NOTA: Estos rangos son criterios de NEGOCIO para gestionar recursos de compliance
        if score <= 29:
            nivel_riesgo = "bajo"
            accion_recomendada = "Procesar normal - Monitoreo estándar"
        elif score <= 49:
            nivel_riesgo = "medio"
            accion_recomendada = "EDD básico - Revisión documental reforzada"
        elif score <= 79:
            nivel_riesgo = "alto"
            accion_recomendada = "EDD extendido - Aprobación gerencial requerida"
        else:
            nivel_riesgo = "critico"
            accion_recomendada = "Pausar/Rechazar - Análisis especializado + Comité de riesgos"
        
        # Casos especiales con acciones mandatorias
        if factor_1 == 30:  # Sanciones críticas internacionales
            accion_recomendada = "RECHAZAR - Match en sanciones OFAC/CSNU/UIF + EDD + Reporte regulador"
        
        return {
            "score_ebr": score,
            "nivel_riesgo": nivel_riesgo,
            "accion_recomendada": accion_recomendada,
            "desglose_factores": desglose,
            "razones_explicabilidad": razones,  # Array de strings para auditoría/LLM
            "descripcion": (
                f"Score EBR: {score}/100 - Riesgo {nivel_riesgo.upper()} - "
                f"Evaluación integral del perfil del cliente (independiente de reglas LFPIORPI). "
                f"Basado en {len(razones)} factores de riesgo identificados."
            ),
            "nota_legal": (
                "Los criterios de scoring son políticas internas de gestión de riesgo, "
                "NO son requisitos legales. Documentación en: EBR_JUSTIFICACION_NEGOCIO.md"
            )
        }
    
    # ========================================================================
    # VALIDACIÓN INTEGRAL
    # ========================================================================
    
    def validar_operacion_completa(
        self,
        operacion_data: Dict[str, Any],
        cliente_datos: Dict[str, Any],
        operaciones_historicas: Optional[List[Dict[str, Any]]] = None
    ) -> ValidacionOperacion:
        """
        Validación integral de operación según LFPIORPI 2025
        
        Flujo:
        1. Verificar listas negras → BLOQUEO
        2. Verificar límite efectivo → BLOQUEO
        3. Verificar umbral aviso (individual + acumulado 6m)
        4. Verificar indicios de procedencia ilícita
        5. Calcular EBR
        
        Returns: ValidacionOperacion con todos los detalles
        """
        if operaciones_historicas is None:
            operaciones_historicas = []
        
        operacion_id = operacion_data.get("folio_interno", "NO_ID")
        cliente_id = operacion_data.get("cliente_id", "NO_CLIENTE")
        monto_mxn = float(operacion_data.get("monto", 0))
        monto_umas = monto_mxn / self.uma_mxn
        fecha_op = operacion_data.get("fecha_operacion", datetime.now())
        actividad = operacion_data.get("actividad_vulnerable", "servicios_generales")
        metodo_pago = operacion_data.get("metodo_pago", "transferencia").lower()
        
        alertas = []
        fundamentos = []
        debe_bloquearse = False
        requiere_aviso_uif = False
        requiere_aviso_24hrs = False
        
        # ====== REGLA 3: LISTAS NEGRAS ======
        en_listas, msg_listas, fund_listas = self.verificar_listas_negras(cliente_datos)
        if en_listas:
            alertas.append(msg_listas)
            fundamentos.append(fund_listas)
            debe_bloquearse = True
            requiere_aviso_24hrs = True
        
        # ====== REGLA 4: EFECTIVO PROHIBIDO ======
        supera_efectivo, msg_efectivo, fund_efectivo = self.verificar_limite_efectivo(
            metodo_pago, monto_mxn, actividad
        )
        if supera_efectivo:
            alertas.append(msg_efectivo)
            fundamentos.append(fund_efectivo)
            debe_bloquearse = True
        
        # ====== REGLA 1: UMBRAL AVISO Y REGLA 2: ACUMULACIÓN 6M ======
        # Solo si la operación puede ejecutarse (no está bloqueada)
        if not debe_bloquearse:
            monto_acum_6m, ops_historicas = self.calcular_acumulado_6_meses(
                cliente_id, operaciones_historicas, monto_mxn
            )
            
            supera_umbral, msg_umbral, fund_umbral = self.verificar_umbral_aviso(
                monto_mxn, actividad, monto_acum_6m
            )
            
            if supera_umbral:
                alertas.append(msg_umbral)
                fundamentos.append(fund_umbral)
                requiere_aviso_uif = True
        
        # ====== REGLA 5: INDICIOS ILÍCITOS ======
        if not debe_bloquearse:
            ops_7dias = [
                op for op in operaciones_historicas
                if (datetime.now() - datetime.fromisoformat(
                    op.get("fecha_operacion", datetime.now().isoformat())
                )) < timedelta(days=7)
            ]
            
            tiene_indicios, senales, fund_indicios = self.verificar_indicios_ilicitos(
                cliente_id, cliente_datos, monto_mxn, ops_7dias, 
                monto_acum_6m if 'monto_acum_6m' in locals() else 0
            )
            
            if tiene_indicios:
                alertas.extend(senales)
                fundamentos.append(fund_indicios)
                requiere_aviso_24hrs = True
        
        # ====== EBR: CÁLCULO INTEGRAL ======
        ebr_resultado = self.calcular_ebr_cliente(cliente_datos)
        score_ebr = ebr_resultado.get("score_ebr", 0)
        
        # Agregar alerta EBR si es riesgo alto/crítico
        if score_ebr >= 50:
            alertas.append(
                f"📊 EBR Score: {score_ebr}/100 - Riesgo {ebr_resultado.get('nivel_riesgo', 'desconocido').upper()}"
            )
            fundamentos.append(ebr_resultado.get("descripcion", ""))
        
        # Construir resultado
        es_valida = not debe_bloquearse
        
        return ValidacionOperacion(
            operacion_id=operacion_id,
            cliente_id=cliente_id,
            monto_mxn=monto_mxn,
            monto_umas=monto_umas,
            fecha_operacion=fecha_op,
            actividad_vulnerable=actividad,
            es_valida=es_valida,
            debe_bloquearse=debe_bloquearse,
            requiere_aviso_uif=requiere_aviso_uif,
            requiere_aviso_24hrs=requiere_aviso_24hrs,
            alertas=alertas,
            fundamentos_legales=fundamentos,
            score_ebr=score_ebr
        )
    
    # ========================================================================
    # UTILIDADES INTERNAS
    # ========================================================================
    
    def _es_actividad_vulnerable(self, actividad: str) -> bool:
        """Determina si una actividad es vulnerable según LFPIORPI Art. 17"""
        if not actividad or actividad.startswith("_") or actividad == "servicios_generales":
            return False
        
        if actividad in self.umbrales:
            return bool(self.umbrales[actividad].get("es_actividad_vulnerable", False))
        
        return False
    
    def obtener_umbrales_actividad(self, actividad: str) -> Dict[str, Any]:
        """Obtiene umbrales completos para una actividad"""
        return self.umbrales.get(actividad, self.umbrales.get("_general", {}))
    
    def obtener_descripcion_actividad(self, actividad: str) -> str:
        """Obtiene descripción de actividad vulnerable"""
        um = self.obtener_umbrales_actividad(actividad)
        return um.get("descripcion", actividad)


# ============================================================================
# FUNCIONES DE CONVENIENCIA
# ============================================================================

def crear_validador(config: Dict[str, Any]) -> ValidadorLFPIORPI2025:
    """Factory para crear validador con configuración"""
    return ValidadorLFPIORPI2025(config)


def cargar_config_defecto() -> Dict[str, Any]:
    """Carga configuración por defecto (para testing)"""
    return {
        "lfpiorpi": {
            "uma_mxn": 113.14,
            "umbrales": {
                "_general": {
                    "aviso_UMA": 645,
                    "efectivo_max_UMA": 999999999,
                    "es_actividad_vulnerable": False
                },
                "VI_joyeria_metales": {
                    "identificacion_UMA": 1605,
                    "aviso_UMA": 3210,
                    "efectivo_max_UMA": 3210,
                    "es_actividad_vulnerable": True,
                    "descripcion": "Metales preciosos, joyas, relojes (Art. 17 VI)"
                }
            }
        }
    }


if __name__ == "__main__":
    # Testing básico
    logging.basicConfig(level=logging.INFO)
    
    config = cargar_config_defecto()
    validador = crear_validador(config)
    
    # Caso de prueba: Operación de joyería con cliente limpio
    op_data = {
        "folio_interno": "OP-2025-001",
        "cliente_id": "CLI-123",
        "monto": 200000,  # $200k MXN
        "fecha_operacion": datetime.now(),
        "actividad_vulnerable": "VI_joyeria_metales",
        "metodo_pago": "transferencia",
        "tipo_operacion": "venta"
    }
    
    cliente_data = {
        # Nuevos campos con metadata (refactorización jerárquica EBR v2.0)
        "en_lista_uif_oficial_sat": False,  # Cambió de "en_lista_uif"
        "en_lista_uif_metadata": {},  # Metadata para auditoría
        "en_lista_ofac": False,
        "en_lista_csnu": False,
        "en_lista_69b_sat": False,  # Cambió de "en_lista_69b"
        "en_lista_69b_metadata": {},  # Metadata para auditoría
        "es_pep": False,
        
        # Campos de perfil
        "sector_actividad": "joyeria_metales",
        "tipo_persona": "fisica",
        "origen_recursos": "actividad_profesional",
        "estado": "CDMX",
        "monto_mensual_estimado": 150000,
        "origen_recursos_documentado": True,
        "beneficiario_controlador_identificado": True  # Para personas morales
    }
    
    resultado = validador.validar_operacion_completa(op_data, cliente_data)
    print("\n=== RESULTADO VALIDACIÓN ===")
    print(json.dumps(resultado.to_dict(), indent=2, default=str))
