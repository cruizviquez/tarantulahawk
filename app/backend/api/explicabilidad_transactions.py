#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
explicabilidad_transactions.py - Sistema de Explicabilidad CORREGIDO

✅ MEJORAS:
1. Explicación principal usa "Rebasa umbral UMA" en lugar de "Guardrail"
2. Explicación detallada incluye fundamento legal (Art. 17 LFPIORPI)
3. Preocupante NO requiere revisión manual
4. Inusual/Relevante muestra top 3 factores EBR rebasados
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List

class TransactionExplainer:
    """Genera explicaciones para el portal con fundamento legal"""
    
    # Artículos LFPIORPI por fracción
    ARTICULOS_LFPIORPI = {
        "V_inmuebles": "Art. 17 Fracc. V",
        "VIII_vehiculos": "Art. 17 Fracc. VIII",
        "XI_joyeria": "Art. 17 Fracc. XI",
        "X_traslado_valores": "Art. 17 Fracc. X",
        "XVI_activos_virtuales": "Art. 17 Fracc. XVI",
        "_": "Art. 17"  # Genérico
    }
    
    # UMA 2025
    UMA = 113.14
    
    def __init__(self, umbral_confianza_bajo: float = 0.5):
        self.umbral_confianza_bajo = umbral_confianza_bajo
    
    def explicar_transaccion(
        self, 
        row: pd.Series,
        probabilidades: Dict[str, float] = None,
        triggers: List[str] = None,
        score_ebr: float = None
    ) -> Dict[str, Any]:
        """Genera explicación completa con fundamento legal"""
        
        clasificacion = str(row.get('clasificacion', ''))
        origen = str(row.get('origen', ''))
        fue_corregido = bool(row.get('fue_corregido_por_guardrail', False))
        monto = float(row.get('monto', 0))
        fraccion = str(row.get('fraccion', '_'))
        
        # Si no hay score_ebr en row, usar el parámetro o calcular básico
        if score_ebr is None:
            score_ebr = float(row.get('score_ebr', 0.5))
        
        # 1. Explicación Principal
        explicacion_principal = self._generar_explicacion_principal(
            clasificacion, origen, fue_corregido, triggers or [], monto, fraccion
        )
        
        # 2. Explicación Detallada (con fundamento legal)
        explicacion_detallada = self._generar_explicacion_detallada(
            row, clasificacion, origen, fue_corregido, triggers or [], score_ebr
        )
        
        # 3. Razones (Top 3 factores EBR para inusual/relevante)
        razones = self._generar_razones_ebr(
            triggers or [], fue_corregido, row, score_ebr
        )
        
        # 4. Flags de Revisión
        flags = self._generar_flags_revision(
            clasificacion, score_ebr, triggers or [], row, fue_corregido
        )
        
        # 5. Contexto Regulatorio
        contexto_regulatorio = self._generar_contexto_regulatorio(
            fraccion, monto
        )
        
        # 6. Acciones Sugeridas
        acciones_sugeridas = self._generar_acciones_sugeridas(
            clasificacion, origen, flags, row
        )
        
        # Nivel de confianza basado en Score EBR
        if clasificacion == "preocupante":
            nivel_confianza = "alta"  # Siempre alta para preocupante
        elif score_ebr >= 0.7:
            nivel_confianza = "alta"
        elif score_ebr >= 0.4:
            nivel_confianza = "media"
        else:
            nivel_confianza = "baja"
        
        return {
            "score_ebr": round(score_ebr, 2),
            "score_confianza": round(score_ebr, 2),  # Compatibilidad
            "nivel_confianza": nivel_confianza,
            "clasificacion": clasificacion,
            "origen": origen,
            "explicacion_principal": explicacion_principal,
            "explicacion_detallada": explicacion_detallada,
            "razones": razones,
            "flags": flags,
            "contexto_regulatorio": contexto_regulatorio,
            "acciones_sugeridas": acciones_sugeridas
        }
    
    def _generar_explicacion_principal(
        self, 
        clasificacion: str, 
        origen: str,
        fue_corregido: bool,
        triggers: List[str],
        monto: float,
        fraccion: str
    ) -> str:
        """✅ CORREGIDO: Usa 'Rebasa umbral UMA' en lugar de 'Guardrail'"""
        
        if fue_corregido or any(t.startswith("guardrail_") for t in triggers):
            # Calcular UMAs
            umbral_umas = self._get_umbral_umas(fraccion)
            umas_transaccion = monto / self.UMA
            
            return f"Rebasa umbral de {umbral_umas:,} UMA de LFPIORPI (transacción de {umas_transaccion:,.0f} UMA)"
        
        if clasificacion == "inusual":
            return "Operación inusual detectada por Enfoque Basado en Riesgos (EBR)"
        
        if clasificacion == "relevante":
            return "Operación relevante - Monitoreo normal"
        
        return f"Clasificación: {clasificacion}"
    
    def _generar_explicacion_detallada(
        self, 
        row: pd.Series,
        clasificacion: str,
        origen: str,
        fue_corregido: bool,
        triggers: List[str],
        score_ebr: float
    ) -> str:
        """✅ CORREGIDO: Incluye fundamento legal para preocupante"""
        
        monto = float(row.get('monto', 0))
        tipo_op = str(row.get('tipo_operacion', ''))
        sector = str(row.get('sector_actividad', ''))
        fraccion = str(row.get('fraccion', '_'))
        
        # PREOCUPANTE: Fundamento legal
        if clasificacion == "preocupante":
            articulo = self.ARTICULOS_LFPIORPI.get(fraccion, "Art. 17")
            umbral_umas = self._get_umbral_umas(fraccion)
            umbral_mxn = umbral_umas * self.UMA
            
            return f"""Transacción de ${monto:,.2f} MXN ({tipo_op}) en sector {sector}.

**FUNDAMENTO LEGAL:**
Con fundamento en el {articulo} de la Ley Federal de Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI), esta operación rebasa el umbral de {umbral_umas:,} UMA (${umbral_mxn:,.2f} MXN).

**OBLIGACIÓN:** Reporte inmediato a la Unidad de Inteligencia Financiera (UIF)."""
        
        # INUSUAL/RELEVANTE: Factores EBR
        else:
            partes = []
            partes.append(f"Transacción de ${monto:,.2f} MXN ({tipo_op}) en sector {sector}.")
            partes.append(f"\n**Score EBR:** {score_ebr:.2f}/1.0")
            
            # Top 3 factores que contribuyeron al score
            factores_ebr = self._analizar_factores_ebr(row, score_ebr)
            if factores_ebr:
                partes.append("\n**Factores de riesgo detectados:**")
                for i, (factor, valor) in enumerate(factores_ebr[:3], 1):
                    partes.append(f"\n{i}. {factor}: {valor}")
            
            return "".join(partes)
    
    def _analizar_factores_ebr(self, row: pd.Series, score_ebr: float) -> List[tuple]:
        """
        Identifica los 3 principales factores que contribuyen al Score EBR
        
        Returns:
            List[(factor_nombre, valor_descripcion), ...]
        """
        factores = []
        
        monto = float(row.get('monto', 0))
        es_efectivo = int(row.get('EsEfectivo', 0))
        es_internacional = int(row.get('EsInternacional', 0))
        es_nocturno = int(row.get('es_nocturno', 0))
        fin_semana = int(row.get('fin_de_semana', 0))
        es_monto_redondo = int(row.get('es_monto_redondo', 0))
        ops_6m = float(row.get('ops_6m', 1))
        ratio_vs_prom = float(row.get('ratio_vs_promedio', 1.0))
        
        # 1. Monto
        if monto >= 100_000:
            if monto >= 200_000:
                factores.append(("Monto muy alto", f"${monto:,.2f} MXN"))
            else:
                factores.append(("Monto alto", f"${monto:,.2f} MXN (>$100k)"))
        
        # 2. Efectivo
        if es_efectivo == 1:
            if monto >= 100_000:
                factores.append(("Efectivo alto riesgo", f"${monto:,.2f} en efectivo"))
            else:
                factores.append(("Pago en efectivo", f"${monto:,.2f}"))
        
        # 3. Monto redondo
        if es_monto_redondo == 1 and monto > 50_000:
            factores.append(("Monto redondo", "Posible estructuración"))
        
        # 4. Temporal
        if es_nocturno == 1 and fin_semana == 1:
            factores.append(("Horario inusual", "Nocturno + fin de semana"))
        elif es_nocturno == 1:
            factores.append(("Operación nocturna", "Fuera de horario"))
        elif fin_semana == 1:
            factores.append(("Fin de semana", "Operación no laborable"))
        
        # 5. Internacional
        if es_internacional == 1 and monto > 50_000:
            factores.append(("Transferencia internacional", f"${monto:,.2f}"))
        
        # 6. Primera operación grande
        if ops_6m == 1 and monto > 100_000:
            factores.append(("Primera operación alta", "Sin historial previo"))
        
        # 7. Desviación del perfil
        if ratio_vs_prom > 3.0:
            factores.append(("Desviación del perfil", f"{ratio_vs_prom:.1f}x sobre promedio"))
        
        # 8. Alta frecuencia
        if ops_6m > 20 and monto > 50_000:
            factores.append(("Alta frecuencia", f"{int(ops_6m)} ops en 6 meses"))
        
        # Ordenar por relevancia (efectivo y monto redondo son muy importantes)
        prioridad = {
            "Efectivo alto riesgo": 10,
            "Monto redondo": 9,
            "Monto muy alto": 8,
            "Primera operación alta": 7,
            "Horario inusual": 6,
            "Transferencia internacional": 5,
            "Desviación del perfil": 4,
            "Monto alto": 3,
            "Alta frecuencia": 2,
        }
        
        factores.sort(key=lambda x: prioridad.get(x[0], 0), reverse=True)
        
        return factores
    
    def _generar_razones_ebr(
        self, 
        triggers: List[str], 
        fue_corregido: bool,
        row: pd.Series,
        score_ebr: float
    ) -> List[str]:
        """✅ CORREGIDO: Para inusual/relevante muestra factores EBR en lugar de triggers"""
        
        if fue_corregido or any(t.startswith("guardrail_") for t in triggers):
            return ["Umbral normativo LFPIORPI"]
        
        # Usar factores EBR en lugar de triggers técnicos
        factores_ebr = self._analizar_factores_ebr(row, score_ebr)
        return [f[0] for f in factores_ebr[:3]]  # Top 3
    
    def _generar_flags_revision(
        self, 
        clasificacion: str,
        score_ebr: float,
        triggers: List[str],
        row: pd.Series,
        fue_corregido: bool
    ) -> Dict[str, Any]:
        """✅ CORREGIDO: Preocupante NO requiere revisión manual"""
        
        alertas = []
        
        # PREOCUPANTE: No requiere revisión
        if clasificacion == "preocupante":
            return {
                "requiere_revision_manual": False,  # ✅ Ya estamos seguros
                "sugerir_reclasificacion": False,
                "alertas": []
            }
        
        # INUSUAL: Revisar si score bajo
        if clasificacion == "inusual":
            if score_ebr < 0.55:
                alertas.append({
                    "tipo": "score_ebr_bajo",
                    "severidad": "warning",
                    "mensaje": f"Score EBR bajo ({score_ebr:.2f}) para clasificación inusual. Revisar factores."
                })
                return {
                    "requiere_revision_manual": True,
                    "sugerir_reclasificacion": False,
                    "alertas": alertas
                }
        
        # RELEVANTE: Revisar si múltiples factores de riesgo
        if clasificacion == "relevante":
            factores = self._analizar_factores_ebr(row, score_ebr)
            if len(factores) >= 2 and score_ebr >= 0.40:
                alertas.append({
                    "tipo": "multiples_factores",
                    "severidad": "info",
                    "mensaje": f"Detectados {len(factores)} factores de riesgo. Considere reclasificar como 'inusual'."
                })
                return {
                    "requiere_revision_manual": True,
                    "sugerir_reclasificacion": True,
                    "alertas": alertas
                }
        
        return {
            "requiere_revision_manual": False,
            "sugerir_reclasificacion": False,
            "alertas": alertas
        }
    
    def _generar_contexto_regulatorio(self, fraccion: str, monto: float) -> str:
        """Genera contexto regulatorio por fracción"""
        
        umbral_umas = self._get_umbral_umas(fraccion)
        umbral_mxn = umbral_umas * self.UMA
        articulo = self.ARTICULOS_LFPIORPI.get(fraccion, "Art. 17")
        
        # Nombres de fracciones
        nombres = {
            "V_inmuebles": "Inmuebles",
            "VIII_vehiculos": "Vehículos",
            "XI_joyeria": "Joyería, Piedras Preciosas y Metales",
            "X_traslado_valores": "Traslado y Custodia de Valores",
            "XVI_activos_virtuales": "Activos Virtuales"
        }
        
        nombre_fraccion = nombres.get(fraccion, "Actividad Comercial")
        
        texto = f"""**{articulo} LFPIORPI - {nombre_fraccion}**
Umbral de aviso: ${umbral_mxn:,.2f} MXN ({umbral_umas:,} UMA)
Valor UMA 2025: ${self.UMA} MXN
Base legal: Ley Federal de Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita

"""
        
        if monto >= umbral_mxn:
            texto += "⚠️ Esta transacción **SUPERA** el umbral de aviso."
        else:
            porcentaje = (monto / umbral_mxn) * 100 if umbral_mxn > 0 else 0
            texto += f"Monto representa el {porcentaje:.1f}% del umbral de aviso."
        
        return texto
    
    def _generar_acciones_sugeridas(
        self, 
        clasificacion: str,
        origen: str,
        flags: Dict[str, Any],
        row: pd.Series
    ) -> List[str]:
        """Genera lista de acciones sugeridas"""
        
        acciones = []
        
        if clasificacion == "preocupante":
            acciones.append("📤 **Preparar aviso a UIF (obligatorio dentro de 24 horas)**")
            acciones.append("🔍 Verificar documentación soporte completa")
            acciones.append("👤 Validar identidad del cliente y beneficiario final")
            acciones.append("📋 Documentar análisis en expediente del cliente")
        
        elif clasificacion == "inusual":
            if flags.get("requiere_revision_manual"):
                acciones.append("👁️ **Revisión manual requerida**")
            acciones.append("📋 Documentar operación en expediente")
            acciones.append("🔍 Revisar perfil transaccional del cliente")
            acciones.append("⚠️ Monitorear operaciones futuras")
            
            if int(row.get('EsEfectivo', 0)) == 1:
                acciones.append("💵 Verificar origen de efectivo")
        
        else:  # relevante
            if flags.get("sugerir_reclasificacion"):
                acciones.append("⚠️ Considerar reclasificación a nivel superior")
            acciones.append("📊 Monitoreo rutinario")
        
        return acciones
    
    def _get_umbral_umas(self, fraccion: str) -> int:
        """Retorna umbral en UMAs según fracción"""
        umbrales = {
            "V_inmuebles": 8025,
            "VIII_vehiculos": 3210,
            "XI_joyeria": 3210,
            "X_traslado_valores": 3210,
            "XVI_activos_virtuales": 3210,
            "_": 3210  # Genérico
        }
        return umbrales.get(fraccion, 3210)