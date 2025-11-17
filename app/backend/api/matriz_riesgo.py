#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
matriz_riesgo.py - Sistema de Niveles de Riesgo y Alertas

Calcula niveles de riesgo consolidados considerando:
- Clasificación final (EBR o ML)
- Guardrails LFPIORPI
- Discrepancias EBR vs ML
- Confianza del modelo ML
- Contexto regulatorio

Autor: TarantulaHawk Team
Fecha: 2025-11-14
"""

from typing import Dict, Any, Optional
import numpy as np

class MatrizRiesgo:
    """Calcula niveles de riesgo y genera alertas"""
    
    # Umbrales de confianza ML
    CONFIANZA_ALTA = 0.85
    CONFIANZA_MEDIA = 0.70
    
    # Severidades de alertas
    SEVERIDAD_CRITICA = "critica"
    SEVERIDAD_ALTA = "alta"
    SEVERIDAD_MEDIA = "media"
    SEVERIDAD_BAJA = "baja"
    
    @staticmethod
    def calcular_nivel_riesgo(
        clasificacion_final: str,
        clasificacion_ebr: str,
        clasificacion_ml: Optional[str],
        score_ebr: float,
        confianza_ml: Optional[float],
        es_guardrail: bool,
        trigger_guardrail: str,
        monto: float,
        estrategia: str
    ) -> Dict[str, Any]:
        """
        Calcula nivel de riesgo consolidado
        
        Args:
            clasificacion_final: Clasificación usada (ebr o ml)
            clasificacion_ebr: Resultado EBR
            clasificacion_ml: Resultado ML (None si no disponible)
            score_ebr: Score EBR (0-1)
            confianza_ml: Confianza ML (0-1)
            es_guardrail: Si activó guardrail
            trigger_guardrail: Razón del guardrail
            monto: Monto de la transacción
            estrategia: "ebr" o "ml"
        
        Returns:
            Dict con nivel, acción, urgencia, plazo, etc.
        """
        
        # NIVEL CRÍTICO: Guardrail activado
        if es_guardrail and clasificacion_final == "preocupante":
            return {
                "nivel": "critico",
                "color": "rojo",
                "emoji": "🔴",
                "razon": f"Guardrail LFPIORPI activado: {trigger_guardrail}",
                "detalle": "Umbral normativo excedido - Obligación legal de reporte",
                "accion": "Reportar a autoridades inmediatamente",
                "urgencia": "inmediata",
                "plazo": "Inmediato (mismo día)",
                "requiere_reporte_uif": True,
                "requiere_documentacion": True,
                "prioridad_revision": 1
            }
        
        # NIVEL ALTO: Clasificado como preocupante
        if clasificacion_final == "preocupante":
            return {
                "nivel": "alto",
                "color": "naranja",
                "emoji": "🟠",
                "razon": "Alto riesgo de lavado de dinero detectado",
                "detalle": f"Score EBR: {score_ebr:.2f} - Múltiples factores de riesgo",
                "accion": "Investigar y documentar exhaustivamente",
                "urgencia": "alta",
                "plazo": "12 horas",
                "requiere_reporte_uif": True,
                "requiere_documentacion": True,
                "prioridad_revision": 2
            }
        
        # Detectar discrepancia EBR vs ML
        discrepancia = False
        if clasificacion_ml and clasificacion_ebr != clasificacion_ml:
            discrepancia = True
        
        # Detectar confianza baja en ML
        confianza_baja = False
        if confianza_ml and confianza_ml < MatrizRiesgo.CONFIANZA_MEDIA:
            confianza_baja = True
        
        # NIVEL MEDIO: Inusual O discrepancia O confianza baja
        if (clasificacion_final == "inusual" or 
            discrepancia or 
            confianza_baja or
            score_ebr >= 0.35):
            
            razones = []
            if clasificacion_final == "inusual":
                razones.append("Clasificado como INUSUAL")
            if discrepancia:
                razones.append(f"Discrepancia EBR ({clasificacion_ebr}) vs ML ({clasificacion_ml})")
            if confianza_baja and confianza_ml:
                razones.append(f"Confianza ML baja ({confianza_ml:.0%})")
            if score_ebr >= 0.35:
                razones.append(f"Score EBR elevado ({score_ebr:.2f})")
            
            return {
                "nivel": "medio",
                "color": "amarillo",
                "emoji": "🟡",
                "razon": " | ".join(razones),
                "detalle": "Patrones atípicos que requieren validación manual",
                "accion": "Revisar manualmente con analista",
                "urgencia": "normal",
                "plazo": "24 horas",
                "requiere_reporte_uif": False,
                "requiere_documentacion": clasificacion_final == "inusual",
                "prioridad_revision": 3
            }
        
        # NIVEL BAJO: Todo normal
        return {
            "nivel": "bajo",
            "color": "verde",
            "emoji": "🟢",
            "razon": "Transacción dentro de parámetros normales",
            "detalle": f"EBR y ML coinciden en clasificación RELEVANTE (Score: {score_ebr:.2f})",
            "accion": "Ninguna - Monitoreo rutinario",
            "urgencia": "baja",
            "plazo": "N/A",
            "requiere_reporte_uif": False,
            "requiere_documentacion": False,
            "prioridad_revision": 4
        }
    
    @staticmethod
    def generar_alertas(
        clasificacion_final: str,
        clasificacion_ebr: str,
        clasificacion_ml: Optional[str],
        score_ebr: float,
        confianza_ml: Optional[float],
        es_guardrail: bool,
        estrategia: str
    ) -> Dict[str, Any]:
        """
        Genera alertas específicas para la transacción
        
        Returns:
            Dict con alertas categorizadas
        """
        alertas = {}
        
        # ALERTA 1: Discrepancia EBR vs ML
        if clasificacion_ml and clasificacion_ebr != clasificacion_ml:
            severidad = "alta" if abs(
                ["relevante", "inusual", "preocupante"].index(clasificacion_ebr) -
                ["relevante", "inusual", "preocupante"].index(clasificacion_ml)
            ) >= 2 else "media"
            
            alertas["discrepancia_ebr_ml"] = {
                "existe": True,
                "severidad": severidad,
                "titulo": "⚠️ Discrepancia EBR vs ML",
                "mensaje": (
                    f"El índice EBR clasificó como {clasificacion_ebr.upper()} "
                    f"pero la AI (ML) detectó una anomalía clasificándola como {clasificacion_ml.upper()}. "
                    f"Se recomienda validar manualmente."
                ),
                "razon": "ML detectó patrones de comportamiento anómalos no capturados por las reglas EBR",
                "accion_recomendada": "Revisar historial del cliente y contexto de la transacción",
                "icono": "⚠️"
            }
        
        # ALERTA 2: Confianza ML baja
        if confianza_ml and confianza_ml < MatrizRiesgo.CONFIANZA_MEDIA:
            alertas["confianza_ml_baja"] = {
                "existe": True,
                "severidad": "baja" if confianza_ml >= 0.60 else "media",
                "titulo": "ℹ️ Confianza ML Media-Baja",
                "mensaje": (
                    f"La confianza del modelo ML es {confianza_ml:.0%} "
                    f"({'media-baja' if confianza_ml >= 0.60 else 'baja'}). "
                    f"El modelo no está completamente seguro de su predicción."
                ),
                "razon": f"Umbral de confianza alta: {MatrizRiesgo.CONFIANZA_ALTA:.0%} | Actual: {confianza_ml:.0%}",
                "accion_recomendada": "Validar con analista si hay dudas sobre la clasificación",
                "icono": "ℹ️"
            }
        
        # ALERTA 3: Score EBR elevado sin guardrail
        if score_ebr >= 0.35 and not es_guardrail and clasificacion_final != "preocupante":
            alertas["score_ebr_elevado"] = {
                "existe": True,
                "severidad": "media",
                "titulo": "📊 Score EBR Elevado",
                "mensaje": (
                    f"El Score EBR es {score_ebr:.2f} (elevado) pero no activó guardrail normativo. "
                    f"Considerar revisar factores de riesgo."
                ),
                "razon": "Múltiples factores de riesgo detectados que no alcanzan umbrales normativos",
                "accion_recomendada": "Evaluar si amerita monitoreo adicional",
                "icono": "📊"
            }
        
        # ALERTA 4: Guardrail activado
        if es_guardrail:
            alertas["guardrail_activado"] = {
                "existe": True,
                "severidad": "critica",
                "titulo": "🛡️ Guardrail LFPIORPI Activado",
                "mensaje": (
                    "Se activó un guardrail normativo LFPIORPI. "
                    "Esta transacción requiere reporte obligatorio a la UIF."
                ),
                "razon": "Umbral normativo excedido según legislación mexicana",
                "accion_recomendada": "Preparar reporte UIF inmediatamente",
                "icono": "🛡️"
            }
        
        # ALERTA 5: ML y EBR coinciden en preocupante
        if (clasificacion_ml == "preocupante" and 
            clasificacion_ebr == "preocupante" and 
            not es_guardrail):
            alertas["coincidencia_alta_riesgo"] = {
                "existe": True,
                "severidad": "alta",
                "titulo": "🚨 Consenso de Alto Riesgo",
                "mensaje": (
                    "Tanto el índice EBR como el modelo ML coinciden en clasificar "
                    "esta transacción como PREOCUPANTE."
                ),
                "razon": "Múltiples sistemas independientes detectaron alto riesgo",
                "accion_recomendada": "Investigación prioritaria y documentación exhaustiva",
                "icono": "🚨"
            }
        
        return alertas
    
    @staticmethod
    def interpretar_confianza_ml(confianza: Optional[float]) -> Dict[str, str]:
        """
        Interpreta el nivel de confianza del modelo ML
        
        Returns:
            Dict con nivel, color, descripción
        """
        if confianza is None:
            return {
                "nivel": "N/A",
                "color": "gris",
                "descripcion": "Modelo ML no disponible",
                "emoji": "❓"
            }
        
        if confianza >= MatrizRiesgo.CONFIANZA_ALTA:
            return {
                "nivel": "alta",
                "color": "verde",
                "descripcion": f"El modelo está muy seguro de su predicción ({confianza:.0%})",
                "emoji": "✅"
            }
        
        if confianza >= MatrizRiesgo.CONFIANZA_MEDIA:
            return {
                "nivel": "media",
                "color": "amarillo",
                "descripcion": f"El modelo tiene confianza moderada ({confianza:.0%})",
                "emoji": "⚠️"
            }
        
        if confianza >= 0.60:
            return {
                "nivel": "media-baja",
                "color": "naranja",
                "descripcion": f"El modelo tiene confianza media-baja ({confianza:.0%}) - Revisar",
                "emoji": "⚠️"
            }
        
        return {
            "nivel": "baja",
            "color": "rojo",
            "descripcion": f"El modelo tiene baja confianza ({confianza:.0%}) - Validación manual requerida",
            "emoji": "❌"
        }
    
    @staticmethod
    def calcular_score_riesgo_numerico(
        nivel_riesgo: str,
        score_ebr: float,
        confianza_ml: Optional[float],
        es_guardrail: bool
    ) -> float:
        """
        Calcula un score numérico de riesgo (0-100)
        
        Returns:
            Score 0-100 (0=sin riesgo, 100=riesgo crítico)
        """
        # Base score por nivel
        base_scores = {
            "bajo": 10,
            "medio": 40,
            "alto": 70,
            "critico": 95
        }
        
        score = base_scores.get(nivel_riesgo, 0)
        
        # Ajustar por score EBR
        score += score_ebr * 20  # Max +20 puntos
        
        # Ajustar por confianza ML (inversamente)
        if confianza_ml:
            if confianza_ml < 0.7:
                score += (0.7 - confianza_ml) * 10  # Max +7 puntos
        
        # Guardrail siempre empuja a 100
        if es_guardrail:
            score = max(score, 95)
        
        return min(100, max(0, score))


# Test standalone
if __name__ == "__main__":
    print("🧪 Testing Matriz de Riesgo...")
    
    # Test 1: Guardrail activado
    print("\n1️⃣ Test: Guardrail activado")
    resultado = MatrizRiesgo.calcular_nivel_riesgo(
        clasificacion_final="preocupante",
        clasificacion_ebr="preocupante",
        clasificacion_ml="preocupante",
        score_ebr=0.8,
        confianza_ml=0.95,
        es_guardrail=True,
        trigger_guardrail="guardrail_aviso_umbral",
        monto=5000000,
        estrategia="ebr"
    )
    print(f"   Nivel: {resultado['nivel']} {resultado['emoji']}")
    print(f"   Acción: {resultado['accion']}")
    print(f"   Plazo: {resultado['plazo']}")
    
    # Test 2: Discrepancia EBR vs ML
    print("\n2️⃣ Test: Discrepancia EBR vs ML")
    resultado = MatrizRiesgo.calcular_nivel_riesgo(
        clasificacion_final="relevante",
        clasificacion_ebr="relevante",
        clasificacion_ml="inusual",
        score_ebr=0.1,
        confianza_ml=0.68,
        es_guardrail=False,
        trigger_guardrail="",
        monto=50000,
        estrategia="ebr"
    )
    alertas = MatrizRiesgo.generar_alertas(
        clasificacion_final="relevante",
        clasificacion_ebr="relevante",
        clasificacion_ml="inusual",
        score_ebr=0.1,
        confianza_ml=0.68,
        es_guardrail=False,
        estrategia="ebr"
    )
    print(f"   Nivel: {resultado['nivel']} {resultado['emoji']}")
    print(f"   Alertas: {len(alertas)}")
    for nombre, alerta in alertas.items():
        print(f"      - {alerta['titulo']}")
    
    # Test 3: Todo normal
    print("\n3️⃣ Test: Todo normal")
    resultado = MatrizRiesgo.calcular_nivel_riesgo(
        clasificacion_final="relevante",
        clasificacion_ebr="relevante",
        clasificacion_ml="relevante",
        score_ebr=0.0,
        confianza_ml=0.92,
        es_guardrail=False,
        trigger_guardrail="",
        monto=5000,
        estrategia="ebr"
    )
    print(f"   Nivel: {resultado['nivel']} {resultado['emoji']}")
    print(f"   Acción: {resultado['accion']}")
    
    print("\n✅ Test completado")