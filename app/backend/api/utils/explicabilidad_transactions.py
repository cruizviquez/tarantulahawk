#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
explicabilidad_transactions.py

Sistema de explicabilidad para transacciones financieras AML.
Genera explicaciones automáticas basadas en triggers y Score EBR.
"""

import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime

class TransactionExplainer:
    """
    Genera explicaciones automáticas de clasificaciones de transacciones.
    
    Proporciona:
    - Justificación de la clasificación
    - Factores de riesgo detectados
    - Nivel de confianza del análisis
    - Recomendaciones de seguimiento
    """
    
    def __init__(self, umbral_confianza_bajo: float = 0.4):
        """
        Args:
            umbral_confianza_bajo: Score EBR bajo el cual se marca baja confianza
        """
        self.umbral_confianza_bajo = umbral_confianza_bajo
        
        # Plantillas de explicaciones
        self.explicaciones_triggers = {
            # Guardrails LFPIORPI
            "guardrail_aviso_umbral": "Monto supera umbral de aviso LFPIORPI Art. 18",
            "guardrail_efectivo_umbral": "Operación en efectivo supera límite normativo",
            "guardrail_acumulacion_6m": "Acumulación 6 meses cerca de umbral de reporte",
            
            # Triggers inusuales
            "inusual_monto_rango_alto": "Monto en rango inusual ($100k-umbral)",
            "inusual_nocturno": "Operación realizada en horario nocturno (22h-6h)",
            "inusual_fin_semana": "Operación realizada en fin de semana",
            "inusual_internacional": "Operación internacional",
            "inusual_ratio_anomalo": "Desviación significativa vs patrón histórico",
            "inusual_efectivo": "Operación en efectivo",
            "inusual_monto_redondo": "Monto redondo (posible estructuración)",
            "inusual_monto_alto_50k": "Monto superior a $50,000",
            "inusual_monto_alto_100k": "Monto superior a $100,000",
            "inusual_primera_operacion": "Cliente con historial limitado (≤1 op en 6m)",
            "inusual_burst_operaciones": "Concentración inusual de operaciones en periodo corto",
            "inusual_sector_alto_riesgo": "Sector económico de alto riesgo AML",
            "inusual_estructuracion": "Posible estructuración de operaciones",
        }
        
        self.recomendaciones_por_clasificacion = {
            "preocupante": [
                "Revisar documentación soporte inmediatamente",
                "Verificar identidad del cliente y beneficiario final",
                "Evaluar para reporte ante UIF según LFPIORPI Art. 17",
                "Documentar análisis en expediente del cliente"
            ],
            "inusual": [
                "Investigar contexto de la operación",
                "Revisar operaciones relacionadas del mismo cliente",
                "Solicitar documentación adicional si es necesario",
                "Monitorear actividad futura del cliente"
            ],
            "relevante": [
                "Continuar monitoreo rutinario",
                "No requiere acción inmediata",
                "Mantener en archivo de consulta"
            ]
        }
    
    def explicar_transaccion(
        self,
        row: pd.Series,
        score_confianza: Optional[float],
        triggers: List[str]
    ) -> Dict:
        """
        Genera explicación completa de una transacción.
        
        Args:
            row: Serie de pandas con datos de la transacción
            score_confianza: Score EBR calculado (0.0-1.0)
            triggers: Lista de triggers activados
        
        Returns:
            Dict con explicación estructurada
        """
        clasificacion = str(row.get("clasificacion", "relevante"))
        monto = float(row.get("monto", 0))
        
        # Identificar triggers activos
        triggers_guardrail = [t for t in triggers if t.startswith("guardrail_")]
        triggers_inusual = [t for t in triggers if t.startswith("inusual_")]
        
        # Generar explicación principal
        if triggers_guardrail:
            razon_principal = "Clasificada como PREOCUPANTE por cumplir umbral normativo LFPIORPI"
            origen = "normativo"
        elif triggers_inusual:
            razon_principal = f"Clasificada como {clasificacion.upper()} por {len(triggers_inusual)} factor(es) de riesgo detectado(s)"
            origen = "reglas"
        else:
            razon_principal = f"Clasificada como {clasificacion.upper()} por análisis de riesgo"
            origen = "ml"
        
        # Factores de riesgo
        factores_riesgo = []
        for t in triggers:
            if t in self.explicaciones_triggers:
                factores_riesgo.append({
                    "codigo": t,
                    "descripcion": self.explicaciones_triggers[t],
                    "tipo": "normativo" if t.startswith("guardrail_") else "behavioral"
                })
        
        # Nivel de confianza
        if score_confianza is not None:
            if score_confianza >= 0.7:
                nivel_confianza = "alta"
                comentario_confianza = "Clasificación respaldada por múltiples factores"
            elif score_confianza >= self.umbral_confianza_bajo:
                nivel_confianza = "media"
                comentario_confianza = "Clasificación basada en factores moderados"
            else:
                nivel_confianza = "baja"
                comentario_confianza = "Revisar contexto adicional recomendado"
        else:
            nivel_confianza = "no_disponible"
            comentario_confianza = "Score no calculado"
        
        # Recomendaciones
        recomendaciones = self.recomendaciones_por_clasificacion.get(
            clasificacion,
            ["Revisar clasificación manualmente"]
        )
        
        # Contexto adicional
        contexto = self._generar_contexto(row, triggers)
        
        return {
            "clasificacion": clasificacion,
            "razon_principal": razon_principal,
            "origen": origen,
            "score_confianza": score_confianza if score_confianza is not None else 0.0,
            "nivel_confianza": nivel_confianza,
            "comentario_confianza": comentario_confianza,
            "factores_riesgo": factores_riesgo,
            "n_factores": len(factores_riesgo),
            "recomendaciones": recomendaciones,
            "contexto": contexto,
            "requiere_revision_urgente": clasificacion == "preocupante",
            "timestamp_explicacion": datetime.now().isoformat()
        }
    
    def _generar_contexto(self, row: pd.Series, triggers: List[str]) -> Dict:
        """Genera contexto adicional de la transacción"""
        
        monto = float(row.get("monto", 0))
        ops_6m = int(row.get("ops_6m", 0))
        monto_6m = float(row.get("monto_6m", 0))
        
        contexto = {
            "monto_formateado": f"${monto:,.2f} MXN",
            "operaciones_historicas": ops_6m,
            "acumulado_6m": f"${monto_6m:,.2f} MXN" if monto_6m > 0 else "No disponible",
        }
        
        # Indicadores temporales
        if int(row.get("es_nocturno", 0)) == 1:
            contexto["horario"] = "Nocturno (22h-6h)"
        elif int(row.get("fin_de_semana", 0)) == 1:
            contexto["horario"] = "Fin de semana"
        else:
            contexto["horario"] = "Horario normal"
        
        # Tipo de operación
        detalles_operacion = []
        if int(row.get("EsEfectivo", 0)) == 1:
            detalles_operacion.append("Efectivo")
        if int(row.get("EsInternacional", 0)) == 1:
            detalles_operacion.append("Internacional")
        if int(row.get("es_monto_redondo", 0)) == 1:
            detalles_operacion.append("Monto redondo")
        
        if detalles_operacion:
            contexto["tipo_operacion"] = ", ".join(detalles_operacion)
        else:
            contexto["tipo_operacion"] = "Operación estándar"
        
        # Perfil de riesgo del cliente
        if ops_6m == 1:
            contexto["perfil_cliente"] = "Cliente nuevo o esporádico"
        elif ops_6m < 5:
            contexto["perfil_cliente"] = "Cliente ocasional"
        elif ops_6m < 20:
            contexto["perfil_cliente"] = "Cliente regular"
        else:
            contexto["perfil_cliente"] = "Cliente frecuente"
        
        # Ratio vs promedio
        ratio = float(row.get("ratio_vs_promedio", 1.0))
        if ratio > 5.0:
            contexto["patron_comportamiento"] = f"Monto {ratio:.1f}x superior al promedio"
        elif ratio > 2.0:
            contexto["patron_comportamiento"] = f"Monto {ratio:.1f}x superior al promedio"
        else:
            contexto["patron_comportamiento"] = "Consistente con patrón histórico"
        
        return contexto
    
    def generar_resumen_batch(
        self,
        explicaciones: List[Dict]
    ) -> Dict:
        """
        Genera resumen de múltiples explicaciones.
        
        Args:
            explicaciones: Lista de diccionarios de explicaciones
        
        Returns:
            Dict con estadísticas agregadas
        """
        total = len(explicaciones)
        
        if total == 0:
            return {
                "total_transacciones": 0,
                "error": "No hay explicaciones para resumir"
            }
        
        # Contar por clasificación
        clasificaciones = {}
        for exp in explicaciones:
            clasi = exp["clasificacion"]
            clasificaciones[clasi] = clasificaciones.get(clasi, 0) + 1
        
        # Contar por origen
        origenes = {}
        for exp in explicaciones:
            orig = exp["origen"]
            origenes[orig] = origenes.get(orig, 0) + 1
        
        # Contar por nivel de confianza
        niveles_confianza = {}
        for exp in explicaciones:
            nivel = exp["nivel_confianza"]
            niveles_confianza[nivel] = niveles_confianza.get(nivel, 0) + 1
        
        # Factores más comunes
        todos_factores = []
        for exp in explicaciones:
            todos_factores.extend([f["codigo"] for f in exp["factores_riesgo"]])
        
        from collections import Counter
        factores_top = Counter(todos_factores).most_common(10)
        
        # Transacciones urgentes
        urgentes = [
            exp for exp in explicaciones
            if exp["requiere_revision_urgente"]
        ]
        
        return {
            "total_transacciones": total,
            "distribucion_clasificacion": clasificaciones,
            "distribucion_origen": origenes,
            "distribucion_confianza": niveles_confianza,
            "transacciones_urgentes": len(urgentes),
            "factores_riesgo_mas_comunes": [
                {"codigo": codigo, "frecuencia": freq}
                for codigo, freq in factores_top
            ],
            "score_ebr_promedio": sum(
                exp["score_confianza"] for exp in explicaciones
            ) / total if total > 0 else 0.0,
            "timestamp_resumen": datetime.now().isoformat()
        }
    
    def generar_texto_explicacion(self, explicacion: Dict) -> str:
        """
        Genera texto legible de una explicación.
        
        Args:
            explicacion: Dict con explicación estructurada
        
        Returns:
            String con explicación en lenguaje natural
        """
        texto = []
        
        # Encabezado
        texto.append(f"CLASIFICACIÓN: {explicacion['clasificacion'].upper()}")
        texto.append(f"Score EBR: {explicacion['score_confianza']:.2f} ({explicacion['nivel_confianza']})")
        texto.append("")
        
        # Razón principal
        texto.append(f"JUSTIFICACIÓN:")
        texto.append(f"  {explicacion['razon_principal']}")
        texto.append("")
        
        # Factores de riesgo
        if explicacion['factores_riesgo']:
            texto.append(f"FACTORES DETECTADOS ({len(explicacion['factores_riesgo'])}):")
            for i, factor in enumerate(explicacion['factores_riesgo'], 1):
                texto.append(f"  {i}. {factor['descripcion']}")
            texto.append("")
        
        # Contexto
        ctx = explicacion['contexto']
        texto.append("CONTEXTO:")
        texto.append(f"  Monto: {ctx['monto_formateado']}")
        texto.append(f"  Horario: {ctx.get('horario', 'N/A')}")
        texto.append(f"  Tipo: {ctx.get('tipo_operacion', 'N/A')}")
        texto.append(f"  Perfil: {ctx.get('perfil_cliente', 'N/A')}")
        texto.append("")
        
        # Recomendaciones
        texto.append("RECOMENDACIONES:")
        for i, rec in enumerate(explicacion['recomendaciones'], 1):
            texto.append(f"  {i}. {rec}")
        
        return "\n".join(texto)


def demo_explicabilidad():
    """Función de demostración del sistema de explicabilidad"""
    
    print("="*70)
    print("DEMO: Sistema de Explicabilidad TarantulaHawk")
    print("="*70)
    
    # Crear explicador
    explainer = TransactionExplainer()
    
    # Ejemplo 1: Transacción preocupante
    txn1 = pd.Series({
        "cliente_id": "CLI-12345",
        "monto": 350000,
        "clasificacion": "preocupante",
        "es_nocturno": 0,
        "fin_de_semana": 0,
        "EsEfectivo": 1,
        "EsInternacional": 0,
        "es_monto_redondo": 1,
        "ops_6m": 5,
        "monto_6m": 450000,
        "ratio_vs_promedio": 4.2
    })
    
    triggers1 = ["guardrail_aviso_umbral", "inusual_efectivo_redondo"]
    exp1 = explainer.explicar_transaccion(txn1, 0.85, triggers1)
    
    print("\n" + "="*70)
    print("EJEMPLO 1: Transacción Preocupante")
    print("="*70)
    print(explainer.generar_texto_explicacion(exp1))
    
    # Ejemplo 2: Transacción inusual
    txn2 = pd.Series({
        "cliente_id": "CLI-67890",
        "monto": 125000,
        "clasificacion": "inusual",
        "es_nocturno": 1,
        "fin_de_semana": 1,
        "EsEfectivo": 0,
        "EsInternacional": 1,
        "es_monto_redondo": 0,
        "ops_6m": 15,
        "monto_6m": 250000,
        "ratio_vs_promedio": 2.1
    })
    
    triggers2 = ["inusual_monto_rango_alto", "inusual_nocturno", "inusual_fin_semana"]
    exp2 = explainer.explicar_transaccion(txn2, 0.62, triggers2)
    
    print("\n" + "="*70)
    print("EJEMPLO 2: Transacción Inusual")
    print("="*70)
    print(explainer.generar_texto_explicacion(exp2))
    
    # Resumen batch
    print("\n" + "="*70)
    print("RESUMEN BATCH")
    print("="*70)
    
    resumen = explainer.generar_resumen_batch([exp1, exp2])
    import json
    print(json.dumps(resumen, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    demo_explicabilidad()
